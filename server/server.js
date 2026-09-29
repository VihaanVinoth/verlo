import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import Groq from "groq-sdk";

dotenv.config();

/* =========================================================
   PATHS
========================================================= */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* =========================================================
   CONFIG
========================================================= */

const PORT = Number(process.env.PORT || 5001);

const CLIENT_URL =
  process.env.CLIENT_URL || "http://localhost:5173";

const GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID;

const GOOGLE_CLIENT_SECRET =
  process.env.GOOGLE_CLIENT_SECRET;

const GOOGLE_REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI ||
  `http://127.0.0.1:${PORT}/api/auth/google/callback`;

const JWT_SECRET =
  process.env.JWT_SECRET;

const GROQ_API_KEY =
  process.env.GROQ_API_KEY;

/* =========================================================
   APP
========================================================= */

const app = express();

/* =========================================================
   CORS
========================================================= */

const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  CLIENT_URL,
].filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Requests such as curl/server-to-server don't have an origin.
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Allow localhost Vite ports during development.
      if (
        process.env.NODE_ENV !== "production" &&
        /^http:\/\/localhost:\d+$/.test(origin)
      ) {
        return callback(null, true);
      }

      if (
        process.env.NODE_ENV !== "production" &&
        /^http:\/\/127\.0\.0\.1:\d+$/.test(origin)
      ) {
        return callback(null, true);
      }

      return callback(
        new Error("CORS origin not allowed.")
      );
    },

    credentials: true,
  })
);

app.use(
  express.json({
    limit: "10mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
  })
);

/* =========================================================
   DATA FILES
========================================================= */

const DATA_DIR =
  path.join(__dirname, "data");

const USERS_FILE =
  path.join(
    DATA_DIR,
    "users.json"
  );

const HISTORY_FILE =
  path.join(
    DATA_DIR,
    "history.json"
  );

await fs.mkdir(DATA_DIR, {
  recursive: true,
});

/* =========================================================
   FILE HELPERS
========================================================= */

async function ensureJSONFile(
  file,
  fallback
) {
  try {
    await fs.access(file);
  } catch {
    await fs.writeFile(
      file,
      JSON.stringify(
        fallback,
        null,
        2
      ),
      "utf8"
    );
  }
}

async function readJSON(file) {
  try {
    const contents =
      await fs.readFile(
        file,
        "utf8"
      );

    return JSON.parse(contents);
  } catch (error) {
    console.error(
      `[VERLO] Failed to read ${file}:`,
      error
    );

    return [];
  }
}

async function writeJSON(
  file,
  data
) {
  await fs.writeFile(
    file,
    JSON.stringify(
      data,
      null,
      2
    ),
    "utf8"
  );
}

await ensureJSONFile(
  USERS_FILE,
  []
);

await ensureJSONFile(
  HISTORY_FILE,
  []
);

/* =========================================================
   GOOGLE OAUTH
========================================================= */

const googleClient =
  new OAuth2Client(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );

/* =========================================================
   GROQ
========================================================= */

const groq = GROQ_API_KEY
  ? new Groq({
      apiKey: GROQ_API_KEY,
    })
  : null;

/* =========================================================
   STARTUP WARNINGS
========================================================= */

if (!JWT_SECRET) {
  console.warn(
    "[VERLO] WARNING: JWT_SECRET is missing."
  );
}

if (
  !GOOGLE_CLIENT_ID ||
  !GOOGLE_CLIENT_SECRET
) {
  console.warn(
    "[VERLO] WARNING: Google OAuth credentials are missing."
  );
}

if (!GROQ_API_KEY) {
  console.warn(
    "[VERLO] WARNING: GROQ_API_KEY is missing."
  );
}

/* =========================================================
   PUBLIC USER
========================================================= */

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    picture: user.picture || null,
    provider:
      user.provider || "local",
  };
}

/* =========================================================
   JWT
========================================================= */

function createJWT(user) {
  if (!JWT_SECRET) {
    throw new Error(
      "JWT_SECRET is not configured."
    );
  }

  return jwt.sign(
    {
      id: user.id,
      email: user.email,
    },
    JWT_SECRET,
    {
      expiresIn: "7d",
    }
  );
}

/* =========================================================
   GET BEARER TOKEN
========================================================= */

function getTokenFromRequest(req) {
  const authorization =
    req.headers.authorization || "";

  if (
    authorization.startsWith(
      "Bearer "
    )
  ) {
    return authorization.substring(7);
  }

  return null;
}

/* =========================================================
   GET COOKIE
========================================================= */

function getCookie(
  req,
  name
) {
  const cookieHeader =
    req.headers.cookie;

  if (!cookieHeader) {
    return null;
  }

  const cookies =
    cookieHeader.split(";");

  for (const cookie of cookies) {
    const separator =
      cookie.indexOf("=");

    if (separator === -1) {
      continue;
    }

    const key =
      cookie
        .slice(0, separator)
        .trim();

    if (key !== name) {
      continue;
    }

    const value =
      cookie
        .slice(separator + 1)
        .trim();

    try {
      return decodeURIComponent(
        value
      );
    } catch {
      return value;
    }
  }

  return null;
}

/* =========================================================
   AUTHENTICATION MIDDLEWARE
========================================================= */

function authenticate(
  req,
  res,
  next
) {
  try {
    /*
     * First support the Authorization header.
     */
    let token =
      getTokenFromRequest(req);

    /*
     * If there isn't one, use the
     * HttpOnly Google/local-login cookie.
     */
    if (!token) {
      token =
        getCookie(
          req,
          "verlo_token"
        );
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error:
          "Authentication required.",
      });
    }

    if (!JWT_SECRET) {
      return res.status(500).json({
        success: false,
        error:
          "JWT_SECRET is not configured.",
      });
    }

    const decoded =
      jwt.verify(
        token,
        JWT_SECRET
      );

    req.user = decoded;

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error:
        "Invalid or expired authentication token.",
    });
  }
}

/* =========================================================
   SET AUTH COOKIE
========================================================= */

function setAuthCookie(
  res,
  token
) {
  const isProduction =
    process.env.NODE_ENV ===
    "production";

  const cookie = [
    `verlo_token=${encodeURIComponent(
      token
    )}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=604800",
  ];

  /*
   * Secure cookies only work over HTTPS.
   * Localhost development is HTTP.
   */
  if (isProduction) {
    cookie.push("Secure");
  }

  res.setHeader(
    "Set-Cookie",
    cookie.join("; ")
  );
}

/* =========================================================
   CLEAR AUTH COOKIE
========================================================= */

function clearAuthCookie(res) {
  const cookie = [
    "verlo_token=",
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ];

  if (
    process.env.NODE_ENV ===
    "production"
  ) {
    cookie.push("Secure");
  }

  res.setHeader(
    "Set-Cookie",
    cookie.join("; ")
  );
}

/* =========================================================
   HEALTH
========================================================= */

app.get(
  "/",
  (req, res) => {
    res.json({
      success: true,
      name: "Verlo API",
      status: "online",
    });
  }
);

app.get(
  "/api/health",
  (req, res) => {
    res.json({
      success: true,
      status: "online",
      timestamp:
        new Date().toISOString(),
    });
  }
);

/* =========================================================
   SIGN UP
========================================================= */

app.post(
  "/api/auth/signup",
  async (req, res) => {
    try {
      const {
        name,
        email,
        password,
      } = req.body;

      if (
        !email ||
        !password
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Email and password are required.",
        });
      }

      if (
        String(password).length <
        6
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Password must be at least 6 characters.",
        });
      }

      const normalizedEmail =
        String(email)
          .trim()
          .toLowerCase();

      let users =
        await readJSON(
          USERS_FILE
        );

      const existingUser =
        users.find(
          (user) =>
            user.email ===
            normalizedEmail
        );

      if (existingUser) {
        return res.status(409).json({
          success: false,
          error:
            "An account with that email already exists.",
        });
      }

      const passwordHash =
        await bcrypt.hash(
          password,
          12
        );

      const user = {
        id: randomUUID(),

        name:
          String(name || "")
            .trim() ||
          normalizedEmail.split(
            "@"
          )[0],

        email:
          normalizedEmail,

        passwordHash,

        provider: "local",

        picture: null,

        createdAt:
          new Date().toISOString(),
      };

      users.push(user);

      await writeJSON(
        USERS_FILE,
        users
      );

      const token =
        createJWT(user);

      /*
       * Set the same HttpOnly cookie
       * used by Google login.
       */
      setAuthCookie(
        res,
        token
      );

      return res.status(201).json({
        success: true,
        token,
        user:
          publicUser(user),
      });
    } catch (error) {
      console.error(
        "[VERLO] Signup error:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          "Unable to create your account.",
      });
    }
  }
);

/* =========================================================
   LOGIN
========================================================= */

app.post(
  "/api/auth/login",
  async (req, res) => {
    try {
      const {
        email,
        password,
      } = req.body;

      if (
        !email ||
        !password
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Email and password are required.",
        });
      }

      const normalizedEmail =
        String(email)
          .trim()
          .toLowerCase();

      const users =
        await readJSON(
          USERS_FILE
        );

      const user =
        users.find(
          (item) =>
            item.email ===
            normalizedEmail
        );

      if (
        !user ||
        !user.passwordHash
      ) {
        return res.status(401).json({
          success: false,
          error:
            "Invalid email or password.",
        });
      }

      const valid =
        await bcrypt.compare(
          password,
          user.passwordHash
        );

      if (!valid) {
        return res.status(401).json({
          success: false,
          error:
            "Invalid email or password.",
        });
      }

      const token =
        createJWT(user);

      setAuthCookie(
        res,
        token
      );

      return res.json({
        success: true,
        token,
        user:
          publicUser(user),
      });
    } catch (error) {
      console.error(
        "[VERLO] Login error:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          "Unable to log you in.",
      });
    }
  }
);

/* =========================================================
   LOGOUT
========================================================= */

app.post(
  "/api/auth/logout",
  (req, res) => {
    clearAuthCookie(res);

    return res.json({
      success: true,
    });
  }
);

/* =========================================================
   CURRENT USER
========================================================= */

app.get(
  "/api/auth/me",
  authenticate,
  async (req, res) => {
    try {
      const users =
        await readJSON(
          USERS_FILE
        );

      const user =
        users.find(
          (item) =>
            item.id ===
            req.user.id
        );

      if (!user) {
        clearAuthCookie(res);

        return res.status(404).json({
          success: false,
          error:
            "User not found.",
        });
      }

      return res.json({
        success: true,
        user:
          publicUser(user),
      });
    } catch (error) {
      console.error(
        "[VERLO] /me error:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          "Unable to load your account.",
      });
    }
  }
);

/* =========================================================
   GOOGLE LOGIN
========================================================= */

app.get(
  "/api/auth/google",
  (req, res) => {
    try {
      if (
        !GOOGLE_CLIENT_ID ||
        !GOOGLE_CLIENT_SECRET
      ) {
        return res.status(500).send(
          "Google OAuth is not configured."
        );
      }

      const authorizationUrl =
        googleClient.generateAuthUrl(
          {
            access_type: "offline",

            scope: [
              "openid",
              "email",
              "profile",
            ],

            prompt:
              "select_account",
          }
        );

      console.log(
        "[VERLO] Starting Google login."
      );

      console.log(
        "[VERLO] Google redirect URI:",
        GOOGLE_REDIRECT_URI
      );

      return res.redirect(
        authorizationUrl
      );
    } catch (error) {
      console.error(
        "[VERLO] Google login start failed:",
        error
      );

      return res.status(500).send(
        "Unable to start Google authentication."
      );
    }
  }
);

/* =========================================================
   GOOGLE CALLBACK
========================================================= */

app.get(
  "/api/auth/google/callback",
  async (req, res) => {
    try {
      const {
        code,
        error,
      } = req.query;

      if (error) {
        console.error(
          "[VERLO] Google returned an error:",
          error
        );

        return res.redirect(
          `${CLIENT_URL}/?auth_error=google_cancelled`
        );
      }

      if (!code) {
        console.error(
          "[VERLO] Google callback contained no code."
        );

        return res.redirect(
          `${CLIENT_URL}/?auth_error=missing_code`
        );
      }

      console.log(
        "[VERLO] Google callback received."
      );

      /*
       * Exchange Google's authorization
       * code for Google's tokens.
       */
      const { tokens } =
        await googleClient.getToken(
          code
        );

      if (!tokens.id_token) {
        throw new Error(
          "Google did not return an ID token."
        );
      }

      /*
       * Verify the ID token.
       */
      const ticket =
        await googleClient.verifyIdToken(
          {
            idToken:
              tokens.id_token,

            audience:
              GOOGLE_CLIENT_ID,
          }
        );

      const payload =
        ticket.getPayload();

      if (
        !payload ||
        !payload.email
      ) {
        throw new Error(
          "Google account information was missing."
        );
      }

      const email =
        payload.email
          .trim()
          .toLowerCase();

      let users =
        await readJSON(
          USERS_FILE
        );

      /*
       * Find an existing account.
       */
      let user =
        users.find(
          (item) =>
            item.email ===
            email
        );

      /*
       * Create the account if necessary.
       */
      if (!user) {
        user = {
          id: randomUUID(),

          name:
            payload.name ||
            email.split(
              "@"
            )[0],

          email,

          passwordHash: null,

          provider: "google",

          picture:
            payload.picture ||
            null,

          googleId:
            payload.sub ||
            null,

          createdAt:
            new Date().toISOString(),
        };

        users.push(user);
      } else {
        /*
         * Update Google profile
         * information.
         */
        user.name =
          payload.name ||
          user.name;

        user.picture =
          payload.picture ||
          user.picture ||
          null;

        user.googleId =
          payload.sub ||
          user.googleId ||
          null;

        user.provider =
          "google";

        users =
          users.map(
            (item) =>
              item.id === user.id
                ? user
                : item
          );
      }

      await writeJSON(
        USERS_FILE,
        users
      );

      /*
       * Create Verlo's JWT.
       */
      const token =
        createJWT(user);

      /*
       * Store JWT in HttpOnly cookie.
       *
       * THIS IS THE IMPORTANT PART.
       *
       * There is NO auth_code.
       * There is NO token in the URL.
       */
      setAuthCookie(
        res,
        token
      );

      console.log(
        "[VERLO] Google authentication successful."
      );

      console.log(
        "[VERLO] Redirecting directly to:",
        CLIENT_URL
      );

      /*
       * Straight back to the homepage.
       */
      return res.redirect(
        `${CLIENT_URL}/`
      );
    } catch (error) {
      console.error(
        "======================================"
      );

      console.error(
        "[VERLO] GOOGLE CALLBACK FAILED"
      );

      console.error(error);

      console.error(
        "======================================"
      );

      return res.redirect(
        `${CLIENT_URL}/?auth_error=google_failed`
      );
    }
  }
);

/* =========================================================
   HISTORY
========================================================= */

app.get(
  "/api/history",
  authenticate,
  async (req, res) => {
    try {
      const history =
        await readJSON(
          HISTORY_FILE
        );

      const userHistory =
        history.filter(
          (item) =>
            item.userId ===
            req.user.id
        );

      return res.json({
        success: true,
        history:
          userHistory,
      });
    } catch (error) {
      console.error(
        "[VERLO] History load error:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          "Unable to load history.",
      });
    }
  }
);

app.post(
  "/api/history/save",
  authenticate,
  async (req, res) => {
    try {
      const {
        prompt,
        result,
      } = req.body;

      if (!prompt) {
        return res.status(400).json({
          success: false,
          error:
            "Prompt is required.",
        });
      }

      const history =
        await readJSON(
          HISTORY_FILE
        );

      const item = {
        id: randomUUID(),

        userId:
          req.user.id,

        prompt,

        result:
          result || null,

        createdAt:
          new Date().toISOString(),
      };

      history.unshift(item);

      /*
       * Keep history at a sensible size.
       */
      const limitedHistory =
        history.slice(
          0,
          2000
        );

      await writeJSON(
        HISTORY_FILE,
        limitedHistory
      );

      return res.json({
        success: true,
        item,
      });
    } catch (error) {
      console.error(
        "[VERLO] History save error:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          "Unable to save history.",
      });
    }
  }
);

/* =========================================================
   GROQ HELPER
========================================================= */

async function askGroq(
  messages,
  options = {}
) {
  if (!groq) {
    throw new Error(
      "GROQ_API_KEY is not configured."
    );
  }

  const completion =
    await groq.chat.completions.create(
      {
        model:
          options.model ||
          "llama-3.3-70b-versatile",

        messages,

        temperature:
          options.temperature ??
          0.7,

        max_tokens:
          options.max_tokens ||
          2500,
      }
    );

  return (
    completion
      .choices?.[0]
      ?.message?.content || ""
  );
}

/* =========================================================
   ADAPTIVE QUESTION
========================================================= */

app.post(
  "/api/adaptive-question",
  async (req, res) => {
    try {
      const {
        prompt,
        answers = [],
        questionNumber = 1,
      } = req.body;

      if (!prompt) {
        return res.status(400).json({
          success: false,
          error:
            "Prompt is required.",
        });
      }

      const previousAnswers =
        answers.length > 0
          ? JSON.stringify(
              answers,
              null,
              2
            )
          : "No previous answers.";

      const response =
        await askGroq(
          [
            {
              role: "system",

              content: `
You are Verlo, an adaptive guidance assistant.

Your job is to ask exactly ONE useful follow-up question.

The question must:
- directly relate to the user's original prompt
- use the previous answers
- avoid repeating earlier questions
- help personalise the final response
- be natural and easy to understand
- not contain unnecessary explanation

Return ONLY valid JSON:

{
  "question": "..."
}
`,
            },

            {
              role: "user",

              content: `
Original prompt:

${prompt}

Previous answers:

${previousAnswers}

This is adaptive question number ${questionNumber}.

Generate the next question.
`,
            },
          ],
          {
            temperature: 0.6,
            max_tokens: 300,
          }
        );

      let parsed;

      try {
        parsed =
          JSON.parse(
            response
          );
      } catch {
        const match =
          response.match(
            /\{[\s\S]*\}/
          );

        if (match) {
          parsed =
            JSON.parse(
              match[0]
            );
        }
      }

      if (
        !parsed ||
        !parsed.question
      ) {
        throw new Error(
          "Invalid adaptive question response."
        );
      }

      return res.json({
        success: true,
        question:
          parsed.question,
      });
    } catch (error) {
      console.error(
        "[VERLO] Adaptive question error:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          "Unable to generate an adaptive question.",
      });
    }
  }
);

/* =========================================================
   ANALYSE
========================================================= */

app.post(
  "/api/analyze",
  async (req, res) => {
    try {
      const {
        prompt,
        answers = [],
      } = req.body;

      if (!prompt) {
        return res.status(400).json({
          success: false,
          error:
            "Prompt is required.",
        });
      }

      const response =
        await askGroq(
          [
            {
              role: "system",

              content: `
You are Verlo.

Create a personalised, practical and clear response
based on the user's original request and answers.

Return valid JSON:

{
  "title": "short title",
  "summary": "short summary",
  "steps": [
    {
      "title": "step title",
      "description": "step explanation"
    }
  ],
  "tips": [
    "tip 1",
    "tip 2"
  ],
  "resources": [
    {
      "title": "resource title",
      "url": "https://example.com"
    }
  ]
}

Do not invent fake URLs.
If useful resources are not known,
return an empty resources array.
`,
            },

            {
              role: "user",

              content: `
Original request:

${prompt}

Answers:

${JSON.stringify(
  answers,
  null,
  2
)}
`,
            },
          ],
          {
            temperature: 0.7,
            max_tokens: 3500,
          }
        );

      let parsed;

      try {
        parsed =
          JSON.parse(
            response
          );
      } catch {
        const match =
          response.match(
            /\{[\s\S]*\}/
          );

        if (match) {
          parsed =
            JSON.parse(
              match[0]
            );
        }
      }

      if (!parsed) {
        throw new Error(
          "AI returned invalid JSON."
        );
      }

      return res.json({
        success: true,
        result: parsed,
      });
    } catch (error) {
      console.error(
        "[VERLO] Analyse error:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          "Unable to analyse your request.",
      });
    }
  }
);

/* =========================================================
   CHAT
========================================================= */

app.post(
  "/api/chat",
  async (req, res) => {
    try {
      const {
        message,
        context,
      } = req.body;

      if (!message) {
        return res.status(400).json({
          success: false,
          error:
            "Message is required.",
        });
      }

      const response =
        await askGroq(
          [
            {
              role: "system",

              content: `
You are Verlo's helpful assistant.

Answer naturally and clearly.
Use the provided context when useful.
Do not claim to have done something you did not do.
`,
            },

            {
              role: "user",

              content: `
Context:

${JSON.stringify(
  context || {},
  null,
  2
)}

User message:

${message}
`,
            },
          ],
          {
            temperature: 0.7,
            max_tokens: 1500,
          }
        );

      return res.json({
        success: true,
        message: response,
      });
    } catch (error) {
      console.error(
        "[VERLO] Chat error:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          "Unable to process your message.",
      });
    }
  }
);

/* =========================================================
   ERROR HANDLER
========================================================= */

app.use(
  (
    error,
    req,
    res,
    next
  ) => {
    console.error(
      "[VERLO] Server error:",
      error
    );

    if (
      error.message ===
      "CORS origin not allowed."
    ) {
      return res.status(403).json({
        success: false,
        error:
          "CORS origin not allowed.",
      });
    }

    return res.status(500).json({
      success: false,
      error:
        "Internal server error.",
    });
  }
);

/* =========================================================
   START SERVER
========================================================= */

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log("");
    console.log(
      "=========================================="
    );
    console.log(
      "              VERLO SERVER"
    );
    console.log(
      "=========================================="
    );
    console.log(
      `API:             http://127.0.0.1:${PORT}`
    );
    console.log(
      `Frontend:        ${CLIENT_URL}`
    );
    console.log(
      `Google callback: ${GOOGLE_REDIRECT_URI}`
    );
    console.log(
      "OAuth mode:      HttpOnly cookie"
    );
    console.log(
      "Auth code:       DISABLED"
    );
    console.log(
      "=========================================="
    );
    console.log("");
  }
);