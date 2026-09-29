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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const PORT = Number(process.env.PORT || 5001);

const CLIENT_URL =
  process.env.CLIENT_URL || "http://localhost:5173";

const API_URL =
  process.env.API_URL || `http://127.0.0.1:${PORT}`;

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

const GOOGLE_REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI ||
  `http://127.0.0.1:${PORT}/api/auth/google/callback`;

const JWT_SECRET = process.env.JWT_SECRET;

const GROQ_API_KEY = process.env.GROQ_API_KEY;

if (!JWT_SECRET) {
  console.warn(
    "[VERLO] WARNING: JWT_SECRET is not configured."
  );
}

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  console.warn(
    "[VERLO] WARNING: Google OAuth credentials are not configured."
  );
}

if (!GROQ_API_KEY) {
  console.warn(
    "[VERLO] WARNING: GROQ_API_KEY is not configured."
  );
}

/* =========================================================
   DIRECTORIES / FILES
========================================================= */

const DATA_DIR = path.join(__dirname, "data");

const USERS_FILE = path.join(
  DATA_DIR,
  "users.json"
);

const HISTORY_FILE = path.join(
  DATA_DIR,
  "history.json"
);

await fs.mkdir(DATA_DIR, {
  recursive: true,
});

async function ensureJSONFile(file, fallback) {
  try {
    await fs.access(file);
  } catch {
    await fs.writeFile(
      file,
      JSON.stringify(fallback, null, 2),
      "utf8"
    );
  }
}

await ensureJSONFile(USERS_FILE, []);
await ensureJSONFile(HISTORY_FILE, []);

/* =========================================================
   JSON HELPERS
========================================================= */

async function readJSON(file) {
  try {
    const contents = await fs.readFile(
      file,
      "utf8"
    );

    return JSON.parse(contents);
  } catch (error) {
    console.error(
      `[VERLO] Failed reading ${file}:`,
      error
    );

    return [];
  }
}

async function writeJSON(file, data) {
  await fs.writeFile(
    file,
    JSON.stringify(data, null, 2),
    "utf8"
  );
}

/* =========================================================
   MIDDLEWARE
========================================================= */

const allowedOrigins = [
  CLIENT_URL,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
].filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      /*
       * Useful for deployed frontends.
       * For production, replace this with your exact
       * frontend URL if desired.
       */
      if (
        process.env.NODE_ENV !== "production" &&
        /^http:\/\/localhost:\d+$/.test(origin)
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

app.use(express.json({ limit: "10mb" }));
app.use(
  express.urlencoded({
    extended: true,
  })
);

/* =========================================================
   GOOGLE OAUTH
========================================================= */

const googleClient = new OAuth2Client(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI
);

/*
 * Temporary one-time authentication codes.
 *
 * Google -> server
 * server -> temporary code
 * frontend -> server
 * server -> JWT
 *
 * These expire after 60 seconds and can only be used once.
 */
const googleAuthCodes = new Map();

/* Clean expired OAuth codes every minute. */
setInterval(() => {
  const now = Date.now();

  for (const [
    code,
    value,
  ] of googleAuthCodes.entries()) {
    if (value.expiresAt <= now) {
      googleAuthCodes.delete(code);
    }
  }
}, 60_000);

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

function getTokenFromRequest(req) {
  const header =
    req.headers.authorization || "";

  if (!header.startsWith("Bearer ")) {
    return null;
  }

  return header.substring(7);
}

function authenticate(req, res, next) {
  try {
    const token =
      getTokenFromRequest(req);

    if (!token) {
      return res.status(401).json({
        success: false,
        error: "Authentication required.",
      });
    }

    const decoded = jwt.verify(
      token,
      JWT_SECRET
    );

    req.user = decoded;

    next();
  } catch {
    return res.status(401).json({
      success: false,
      error: "Invalid or expired authentication token.",
    });
  }
}

/* =========================================================
   BASIC ROUTES
========================================================= */

app.get("/", (req, res) => {
  res.json({
    success: true,
    name: "Verlo API",
    status: "online",
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    status: "online",
    timestamp: new Date().toISOString(),
  });
});

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

      if (password.length < 6) {
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
        await readJSON(USERS_FILE);

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
          normalizedEmail.split("@")[0],
        email: normalizedEmail,
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

      const publicUser = {
        id: user.id,
        name: user.name,
        email: user.email,
        picture: user.picture,
        provider: user.provider,
      };

      return res.status(201).json({
        success: true,
        token,
        user: publicUser,
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
        await readJSON(USERS_FILE);

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

      const publicUser = {
        id: user.id,
        name: user.name,
        email: user.email,
        picture: user.picture || null,
        provider:
          user.provider || "local",
      };

      return res.json({
        success: true,
        token,
        user: publicUser,
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
   CURRENT USER
========================================================= */

app.get(
  "/api/auth/me",
  authenticate,
  async (req, res) => {
    try {
      const users =
        await readJSON(USERS_FILE);

      const user =
        users.find(
          (item) =>
            item.id === req.user.id
        );

      if (!user) {
        return res.status(404).json({
          success: false,
          error: "User not found.",
        });
      }

      return res.json({
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          picture:
            user.picture || null,
          provider:
            user.provider || "local",
        },
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
   START GOOGLE LOGIN
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
          "Google OAuth is not configured on the server."
        );
      }

      const authorizationUrl =
        googleClient.generateAuthUrl({
          access_type: "offline",
          scope: [
            "openid",
            "email",
            "profile",
          ],
          prompt: "select_account",
        });

      return res.redirect(
        authorizationUrl
      );
    } catch (error) {
      console.error(
        "[VERLO] Could not start Google login:",
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
          `${CLIENT_URL}/auth/callback?error=${encodeURIComponent(
            error
          )}`
        );
      }

      if (!code) {
        return res.redirect(
          `${CLIENT_URL}/auth/callback?error=missing_google_code`
        );
      }

      console.log(
        "[VERLO] Received Google callback."
      );

      const { tokens } =
        await googleClient.getToken(
          code
        );

      if (!tokens.id_token) {
        throw new Error(
          "Google did not return an ID token."
        );
      }

      const ticket =
        await googleClient.verifyIdToken({
          idToken:
            tokens.id_token,
          audience:
            GOOGLE_CLIENT_ID,
        });

      const payload =
        ticket.getPayload();

      if (
        !payload ||
        !payload.email
      ) {
        throw new Error(
          "Google account information could not be read."
        );
      }

      const email =
        payload.email
          .trim()
          .toLowerCase();

      let users =
        await readJSON(USERS_FILE);

      let user =
        users.find(
          (item) =>
            item.email === email
        );

      if (!user) {
        user = {
          id: randomUUID(),
          name:
            payload.name ||
            email.split("@")[0],
          email,
          passwordHash: null,
          provider: "google",
          picture:
            payload.picture ||
            null,
          googleId:
            payload.sub || null,
          createdAt:
            new Date().toISOString(),
        };

        users.push(user);
      } else {
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
          user.provider ||
          "google";

        users = users.map(
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

      const token =
        createJWT(user);

      /*
       * Create a temporary one-time code.
       * The frontend exchanges this for the JWT.
       */
      const authCode =
        randomUUID();

      googleAuthCodes.set(
        authCode,
        {
          token,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            picture:
              user.picture ||
              null,
            provider:
              user.provider ||
              "google",
          },
          expiresAt:
            Date.now() +
            60 * 1000,
        }
      );

      console.log(
        "[VERLO] Google login successful."
      );

      /*
       * IMPORTANT:
       *
       * Do NOT redirect to:
       *
       * /?auth_code=...
       *
       * Instead use the dedicated callback page.
       */
      const callbackURL =
        `${CLIENT_URL}/auth/callback?auth_code=${encodeURIComponent(
          authCode
        )}`;

      console.log(
        "[VERLO] Redirecting to:",
        callbackURL
      );

      return res.redirect(
        callbackURL
      );
    } catch (error) {
      console.error(
        "[VERLO] Google callback failed:",
        error
      );

      return res.redirect(
        `${CLIENT_URL}/auth/callback?error=google_auth_failed`
      );
    }
  }
);

/* =========================================================
   GOOGLE CODE EXCHANGE
========================================================= */

app.post(
  "/api/auth/google/exchange",
  async (req, res) => {
    try {
      const { code } =
        req.body;

      if (!code) {
        return res.status(400).json({
          success: false,
          error:
            "Authentication code is required.",
        });
      }

      const stored =
        googleAuthCodes.get(
          code
        );

      if (!stored) {
        return res.status(400).json({
          success: false,
          error:
            "Authentication code is invalid or has already been used.",
        });
      }

      if (
        Date.now() >
        stored.expiresAt
      ) {
        googleAuthCodes.delete(
          code
        );

        return res.status(400).json({
          success: false,
          error:
            "Authentication code has expired.",
        });
      }

      /*
       * Delete BEFORE returning.
       *
       * This makes the code genuinely one-time-use.
       */
      googleAuthCodes.delete(
        code
      );

      return res.json({
        success: true,
        token: stored.token,
        user: stored.user,
      });
    } catch (error) {
      console.error(
        "[VERLO] Google exchange failed:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          "Google authentication exchange failed.",
      });
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
        history: userHistory,
      });
    } catch (error) {
      console.error(
        "[VERLO] History error:",
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
        userId: req.user.id,
        prompt,
        result: result || null,
        createdAt:
          new Date().toISOString(),
      };

      history.unshift(item);

      /*
       * Keep the file from growing forever.
       */
      const limited =
        history.slice(0, 2000);

      await writeJSON(
        HISTORY_FILE,
        limited
      );

      return res.json({
        success: true,
        item,
      });
    } catch (error) {
      console.error(
        "[VERLO] Save history error:",
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
   GROQ
========================================================= */

const groq = GROQ_API_KEY
  ? new Groq({
      apiKey: GROQ_API_KEY,
    })
  : null;

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
    completion.choices?.[0]
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
        answers.length
          ? JSON.stringify(
              answers,
              null,
              2
            )
          : "No previous answers.";

      const system = `
You are Verlo, an adaptive guidance assistant.

Your job is to ask ONE useful follow-up question
that helps understand what the user actually needs.

The question must:
- be directly related to the user's prompt
- build on previous answers
- not repeat an earlier question
- be simple and natural
- be useful for producing a personalised final answer
- contain no unnecessary explanation

Return ONLY valid JSON:

{
  "question": "..."
}
`;

      const response =
        await askGroq(
          [
            {
              role: "system",
              content: system,
            },
            {
              role: "user",
              content: `
Original prompt:
${prompt}

Previous answers:
${previousAnswers}

This is adaptive question ${questionNumber}.

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
          JSON.parse(response);
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

      const system = `
You are Verlo.

Create a personalised, practical and clear response
based on the user's original request and their answers.

Return valid JSON with this structure:

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
If useful resources are not known, return an empty resources array.
`;

      const response =
        await askGroq(
          [
            {
              role: "system",
              content: system,
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
          JSON.parse(response);
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
          "The AI returned invalid JSON."
        );
      }

      return res.json({
        success: true,
        result: parsed,
      });
    } catch (error) {
      console.error(
        "[VERLO] Analyze error:",
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

Answer clearly and naturally.
Use the provided context when relevant.
Do not pretend to have performed actions you did not perform.
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

User:
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
        error: "CORS origin not allowed.",
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
   START
========================================================= */

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log("");
    console.log(
      "======================================"
    );
    console.log(
      "              VERLO API"
    );
    console.log(
      "======================================"
    );
    console.log(
      `API:             http://127.0.0.1:${PORT}`
    );
    console.log(
      `Client:          ${CLIENT_URL}`
    );
    console.log(
      `Google callback: ${GOOGLE_REDIRECT_URI}`
    );
    console.log(
      "======================================"
    );
    console.log("");
  }
);