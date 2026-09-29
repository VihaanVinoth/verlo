import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import Groq from "groq-sdk";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const PORT = process.env.PORT || 5001;

const API_URL = "https://verlo-30xs.onrender.com";

const CLIENT_URL =
  process.env.CLIENT_URL || "https://verloai.netlify.app";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

const GOOGLE_REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI ||
  `${API_URL}/api/auth/google/callback`;

const JWT_SECRET = process.env.JWT_SECRET;

const GROQ_API_KEY = process.env.GROQ_API_KEY;

if (!JWT_SECRET) {
  console.error("ERROR: JWT_SECRET is missing.");
  process.exit(1);
}

if (!GOOGLE_CLIENT_ID) {
  console.error("ERROR: GOOGLE_CLIENT_ID is missing.");
}

if (!GOOGLE_CLIENT_SECRET) {
  console.error("ERROR: GOOGLE_CLIENT_SECRET is missing.");
}

if (!GROQ_API_KEY) {
  console.warn("WARNING: GROQ_API_KEY is missing.");
}

const DATA_DIR = path.join(__dirname, "data");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const USERS_FILE = path.join(DATA_DIR, "users.json");
const HISTORY_FILE = path.join(DATA_DIR, "history.json");

function ensureJsonFile(file, fallback = []) {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(
      file,
      JSON.stringify(fallback, null, 2),
      "utf8"
    );
  }
}

ensureJsonFile(USERS_FILE, []);
ensureJsonFile(HISTORY_FILE, []);

function readJson(file, fallback = []) {
  try {
    const contents = fs.readFileSync(file, "utf8");

    if (!contents.trim()) {
      return fallback;
    }

    return JSON.parse(contents);
  } catch (error) {
    console.error(`Could not read ${file}:`, error);
    return fallback;
  }
}

function writeJson(file, data) {
  fs.writeFileSync(
    file,
    JSON.stringify(data, null, 2),
    "utf8"
  );
}

app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Accept",
    ],
  })
);

app.use(express.json({ limit: "2mb" }));

app.use(express.urlencoded({ extended: true }));

const googleClient = new OAuth2Client(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI
);

const groq = GROQ_API_KEY
  ? new Groq({
      apiKey: GROQ_API_KEY,
    })
  : null;

function publicUser(user) {
  if (!user) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    picture: user.picture || null,
    provider: user.provider || "local",
    createdAt: user.createdAt,
  };
}

function createUserId() {
  return crypto.randomUUID();
}


function createToken(user) {
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
  const authHeader = req.headers.authorization;

  if (
    authHeader &&
    authHeader.startsWith("Bearer ")
  ) {
    return authHeader.substring(7);
  }

  if (req.headers.cookie) {
    const cookies = {};

    req.headers.cookie.split(";").forEach((part) => {
      const index = part.indexOf("=");

      if (index === -1) return;

      const key = part
        .slice(0, index)
        .trim();

      const value = part
        .slice(index + 1)
        .trim();

      cookies[key] = decodeURIComponent(value);
    });

    if (cookies.verlo_token) {
      return cookies.verlo_token;
    }
  }

  return null;
}

function authenticate(req, res, next) {
  const token = getTokenFromRequest(req);

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }

  try {
    const decoded = jwt.verify(
      token,
      JWT_SECRET
    );

    const users = readJson(USERS_FILE, []);

    const user = users.find(
      (item) => item.id === decoded.id
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User no longer exists.",
      });
    }

    req.user = user;

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired session.",
    });
  }
}

function setAuthCookie(res, token) {
  res.cookie("verlo_token", token, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });
}

function clearAuthCookie(res) {
  res.clearCookie("verlo_token", {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
  });
}

app.get("/", (req, res) => {
  res.json({
    success: true,
    name: "Verlo API",
    status: "online",
    frontend: CLIENT_URL,
    googleCallback: GOOGLE_REDIRECT_URI,
    authentication: "HttpOnly cookie",
    authCode: false,
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    status: "online",
    service: "Verlo API",
    timestamp: new Date().toISOString(),
  });
});

app.post("/api/auth/signup", async (req, res) => {
  try {
    const {
      name,
      email,
      password,
    } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message:
          "Name, email and password are required.",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message:
          "Password must be at least 6 characters.",
      });
    }

    const normalizedEmail =
      email.trim().toLowerCase();

    const users = readJson(USERS_FILE, []);

    const existingUser = users.find(
      (user) =>
        user.email.toLowerCase() ===
        normalizedEmail
    );

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message:
          "An account with this email already exists.",
      });
    }

    const passwordHash =
      await bcrypt.hash(password, 12);

    const user = {
      id: createUserId(),
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      picture: null,
      provider: "local",
      createdAt: new Date().toISOString(),
    };

    users.push(user);

    writeJson(USERS_FILE, users);

    const token = createToken(user);

    setAuthCookie(res, token);

    return res.status(201).json({
      success: true,
      message: "Account created successfully.",
      user: publicUser(user),
    });
  } catch (error) {
    console.error("Signup error:", error);

    return res.status(500).json({
      success: false,
      message: "Could not create account.",
    });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const {
      email,
      password,
    } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message:
          "Email and password are required.",
      });
    }

    const normalizedEmail =
      email.trim().toLowerCase();

    const users = readJson(USERS_FILE, []);

    const user = users.find(
      (item) =>
        item.email.toLowerCase() ===
        normalizedEmail
    );

    if (!user || !user.passwordHash) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid email or password.",
      });
    }

    const validPassword =
      await bcrypt.compare(
        password,
        user.passwordHash
      );

    if (!validPassword) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid email or password.",
      });
    }

    const token = createToken(user);

    setAuthCookie(res, token);

    return res.json({
      success: true,
      message: "Logged in successfully.",
      user: publicUser(user),
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      success: false,
      message: "Could not log in.",
    });
  }
});

app.get("/api/auth/me", authenticate, (req, res) => {
  return res.json({
    success: true,
    user: publicUser(req.user),
  });
});

app.post("/api/auth/logout", (req, res) => {
  clearAuthCookie(res);

  return res.json({
    success: true,
    message: "Logged out successfully.",
  });
});

app.get("/api/auth/google", (req, res) => {
  if (
    !GOOGLE_CLIENT_ID ||
    !GOOGLE_CLIENT_SECRET
  ) {
    return res.status(500).json({
      success: false,
      message:
        "Google authentication is not configured.",
    });
  }

  try {
    const authUrl =
      googleClient.generateAuthUrl({
        access_type: "offline",
        prompt: "select_account",
        scope: [
          "openid",
          "email",
          "profile",
        ],
      });

    return res.redirect(authUrl);
  } catch (error) {
    console.error(
      "Google authorization error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Could not start Google authentication.",
    });
  }
});

app.get(
  "/api/auth/google/callback",
  async (req, res) => {
    try {
      const { code } = req.query;

      if (!code) {
        return res.redirect(
          `${CLIENT_URL}/?auth_error=missing_code`
        );
      }

      const { tokens } =
        await googleClient.getToken(code);

      if (!tokens.id_token) {
        return res.redirect(
          `${CLIENT_URL}/?auth_error=no_id_token`
        );
      }

      const ticket =
        await googleClient.verifyIdToken({
          idToken: tokens.id_token,
          audience: GOOGLE_CLIENT_ID,
        });

      const payload =
        ticket.getPayload();

      if (!payload) {
        return res.redirect(
          `${CLIENT_URL}/?auth_error=invalid_google_account`
        );
      }

      const googleId = payload.sub;
      const email = payload.email;
      const name =
        payload.name ||
        email?.split("@")[0] ||
        "Verlo User";

      const picture =
        payload.picture || null;

      if (!email) {
        return res.redirect(
          `${CLIENT_URL}/?auth_error=no_email`
        );
      }

      const users = readJson(
        USERS_FILE,
        []
      );

      let user = users.find(
        (item) =>
          item.googleId === googleId
      );

      if (!user) {
        user = users.find(
          (item) =>
            item.email.toLowerCase() ===
            email.toLowerCase()
        );
      }

      if (user) {
        user.googleId = googleId;
        user.picture = picture || user.picture;
        user.provider =
          user.provider === "local"
            ? "google"
            : user.provider;
        user.name = user.name || name;
      } else {
        user = {
          id: createUserId(),
          googleId,
          name,
          email:
            email.toLowerCase(),
          passwordHash: null,
          picture,
          provider: "google",
          createdAt:
            new Date().toISOString(),
        };

        users.push(user);
      }

      writeJson(
        USERS_FILE,
        users
      );

      const token =
        createToken(user);

      setAuthCookie(res, token);

      return res.redirect(
        `${CLIENT_URL}/`
      );
    } catch (error) {
      console.error(
        "Google callback error:",
        error
      );

      return res.redirect(
        `${CLIENT_URL}/?auth_error=google_login_failed`
      );
    }
  }
);

app.get(
  "/api/history",
  authenticate,
  (req, res) => {
    try {
      const history =
        readJson(
          HISTORY_FILE,
          []
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
        "History error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Could not load history.",
      });
    }
  }
);

app.post(
  "/api/history",
  authenticate,
  (req, res) => {
    try {
      const {
        prompt,
        result,
        questions,
        answers,
      } = req.body;

      const history =
        readJson(
          HISTORY_FILE,
          []
        );

      const entry = {
        id: createUserId(),
        userId: req.user.id,
        prompt:
          prompt || "",
        result:
          result || null,
        questions:
          questions || [],
        answers:
          answers || [],
        createdAt:
          new Date().toISOString(),
      };

      history.push(entry);

      writeJson(
        HISTORY_FILE,
        history
      );

      return res.status(201).json({
        success: true,
        history: entry,
      });
    } catch (error) {
      console.error(
        "Save history error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Could not save history.",
      });
    }
  }
);

async function askGroq(
  systemPrompt,
  userPrompt
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
          "llama-3.3-70b-versatile",

        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],

        temperature: 0.7,

        max_tokens: 2500,
      }
    );

  return (
    completion.choices?.[0]?.message
      ?.content || ""
  );
}

app.post(
  "/api/questions",
  async (req, res) => {
    try {
      const {
        prompt,
        previousAnswers = [],
      } = req.body;

      if (!prompt) {
        return res.status(400).json({
          success: false,
          message:
            "A prompt is required.",
        });
      }

      const systemPrompt = `
You are Verlo, an adaptive AI assistant.

Your job is to understand what the user is trying
to accomplish and ask useful follow-up questions.

The questions MUST adapt to the user's original prompt.

Do not ask generic questions such as:
- "What is your goal?"
- "Can you provide more details?"
- "What do you prefer?"

Instead, identify what information is genuinely missing
from the user's request.

Ask between 2 and 5 questions.

Return ONLY valid JSON in this format:

{
  "questions": [
    {
      "id": "question_1",
      "question": "Question text",
      "type": "text"
    }
  ]
}

Allowed types:
"text"
"choice"

For choice questions, also provide:

"options": [
  "Option 1",
  "Option 2",
  "Option 3"
]

Do not include markdown.
`;

      const userPrompt = `
Original user request:

${prompt}

Previous answers:

${JSON.stringify(
  previousAnswers,
  null,
  2
)}

Generate the next useful adaptive questions.
`;

      const raw =
        await askGroq(
          systemPrompt,
          userPrompt
        );

      let parsed;

      try {
        parsed =
          JSON.parse(raw);
      } catch {
        const jsonMatch =
          raw.match(
            /\{[\s\S]*\}/
          );

        if (!jsonMatch) {
          throw new Error(
            "AI returned invalid question JSON."
          );
        }

        parsed =
          JSON.parse(
            jsonMatch[0]
          );
      }

      return res.json({
        success: true,
        questions:
          parsed.questions || [],
      });
    } catch (error) {
      console.error(
        "Questions error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Could not generate adaptive questions.",
      });
    }
  }
);

app.post(
  "/api/analyze",
  async (req, res) => {
    try {
      const {
        prompt,
        answers = [],
        questions = [],
      } = req.body;

      if (!prompt) {
        return res.status(400).json({
          success: false,
          message:
            "A prompt is required.",
        });
      }










      
      // LUCKY NUMBER 888
      const systemPrompt = `
You are Verlo.

Create a personalised, useful response based on:
1. The user's original request.
2. The adaptive questions.
3. The user's answers.

Do not mention that you are an AI unless necessary.

Use clear headings where helpful.

Give practical steps.

Do not invent information that the user did not provide.

If the request is about programming,
provide technically accurate code or implementation advice.

If the request is a plan,
make it specific to the user's answers.

Return useful natural language, not JSON.
`;

      const userPrompt = `
Original request:

${prompt}

Adaptive questions:

${JSON.stringify(
  questions,
  null,
  2
)}

User answers:

${JSON.stringify(
  answers,
  null,
  2
)}

Create the final personalised result.
`;

      const result =
        await askGroq(
          systemPrompt,
          userPrompt
        );

      return res.json({
        success: true,
        result,
      });
    } catch (error) {
      console.error(
        "Analyze error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Could not generate the result.",
      });
    }
  }
);

app.post(
  "/api/chat",
  async (req, res) => {
    try {
      const {
        message,
        context = "",
      } = req.body;

      if (!message) {
        return res.status(400).json({
          success: false,
          message:
            "Message is required.",
        });
      }

      const systemPrompt = `
You are Verlo, a helpful adaptive AI assistant.

Use the supplied context when it is relevant.

Answer clearly and naturally.

Do not unnecessarily repeat the user's question.

Context:

${context}
`;

      const response =
        await askGroq(
          systemPrompt,
          message
        );

      return res.json({
        success: true,
        response,
      });
    } catch (error) {
      console.error(
        "Chat error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Could not generate a response.",
      });
    }
  }
);

app.use(
  (req, res) => {
    res.status(404).json({
      success: false,
      message: "Endpoint not found.",
    });
  }
);

app.use(
  (error, req, res, next) => {
    console.error(
      "Unhandled server error:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Internal server error.",
    });
  }
);

app.listen(PORT, () => {
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
    `Port:              ${PORT}`
  );
  console.log(
    `API:               ${API_URL}`
  );
  console.log(
    `Frontend:          ${CLIENT_URL}`
  );
  console.log(
    `Google callback:   ${GOOGLE_REDIRECT_URI}`
  );
  console.log(
    "Authentication:    HttpOnly cookie"
  );
  console.log(
    "Auth code:         DISABLED"
  );
  console.log(
    "=========================================="
  );
  console.log("");
});