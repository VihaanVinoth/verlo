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
import cookieParser from "cookie-parser";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const PORT = process.env.PORT || 5001;
const API_URL = process.env.API_URL || "https://verlo-30xs.onrender.com";
const CLIENT_URL = process.env.CLIENT_URL || "https://verloai.netlify.app";

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

if (!GROQ_API_KEY) {
  console.warn("WARNING: GROQ_API_KEY is missing.");
}

const DATA_DIR = path.join(__dirname, "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const HISTORY_FILE = path.join(DATA_DIR, "history.json");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function ensureJsonFile(file, fallback = []) {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(fallback, null, 2), "utf8");
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
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept"],
  })
);

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

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
  if (!user) {
    return null;
  }

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

  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }

  if (req.cookies?.verlo_token) {
    return req.cookies.verlo_token;
  }

  return null;
}

function authenticate(req, res, next) {
  const token = getTokenFromRequest(req);

  if (!token) {
    return res.status(401).json({
      success: false,
      error: "Authentication required.",
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const users = readJson(USERS_FILE, []);

    const user = users.find(
      (item) => item.id === decoded.id
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        error: "User no longer exists.",
      });
    }

    req.user = user;
    next();
  } catch {
    return res.status(401).json({
      success: false,
      error: "Invalid or expired session.",
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

function extractJson(raw) {
  if (!raw) {
    throw new Error("AI returned an empty response.");
  }

  let cleaned = String(raw)
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {}

  const firstObject = cleaned.indexOf("{");
  const lastObject = cleaned.lastIndexOf("}");

  if (firstObject !== -1 && lastObject > firstObject) {
    try {
      return JSON.parse(
        cleaned.slice(firstObject, lastObject + 1)
      );
    } catch {}
  }

  const firstArray = cleaned.indexOf("[");
  const lastArray = cleaned.lastIndexOf("]");

  if (firstArray !== -1 && lastArray > firstArray) {
    try {
      return JSON.parse(
        cleaned.slice(firstArray, lastArray + 1)
      );
    } catch {}
  }

  throw new Error("AI returned invalid JSON.");
}

function normaliseQuestion(question, questionNumber) {
  if (!question || typeof question !== "object") {
    return null;
  }

  const requestedType =
    String(question.type || "").toLowerCase();

  const choices = Array.isArray(question.choices)
    ? question.choices
        .map((choice) => String(choice).trim())
        .filter(Boolean)
    : Array.isArray(question.options)
      ? question.options
          .map((choice) => String(choice).trim())
          .filter(Boolean)
      : [];

  const type =
    requestedType === "mcq" ||
    requestedType === "choice" ||
    requestedType === "multiple-choice"
      ? "mcq"
      : "text";

  const questionText =
    question.question ||
    question.text ||
    question.prompt ||
    question.stem;

  if (!questionText) {
    return null;
  }

  if (type === "mcq" && choices.length < 2) {
    return {
      id:
        question.id ||
        `adaptive-${questionNumber}`,
      type: "text",
      question: String(questionText).trim(),
      stem: String(questionText).trim(),
      choices: [],
      questionNumber,
    };
  }

  return {
    id:
      question.id ||
      `adaptive-${questionNumber}`,
    type,
    question: String(questionText).trim(),
    stem: String(questionText).trim(),
    choices,
    questionNumber,
  };
}

async function askGroq(systemPrompt, userPrompt, options = {}) {
  if (!groq) {
    throw new Error("GROQ_API_KEY is not configured.");
  }

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
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
    temperature: options.temperature ?? 0.5,
    max_tokens: options.max_tokens ?? 2500,
  });

  const content =
    completion?.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("Groq returned an empty response.");
  }

  return content;
}

app.get("/", (req, res) => {
  res.json({
    success: true,
    name: "Verlo API",
    status: "online",
    frontend: CLIENT_URL,
    authentication: "HttpOnly cookie",
    adaptiveEngine: true,
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    status: "online",
    service: "Verlo API",
    adaptiveEngine: true,
    timestamp: new Date().toISOString(),
  });
});

app.post("/api/auth/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: "Email and password are required.",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: "Password must be at least 6 characters.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const users = readJson(USERS_FILE, []);

    if (
      users.some(
        (user) =>
          user.email?.toLowerCase() === normalizedEmail
      )
    ) {
      return res.status(409).json({
        success: false,
        error: "An account with this email already exists.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = {
      id: createUserId(),
      name:
        name?.trim() ||
        normalizedEmail.split("@")[0],
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
  } catch {
    return res.status(500).json({
      success: false,
      error: "Could not create account.",
    });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: "Email and password are required.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const users = readJson(USERS_FILE, []);

    const user = users.find(
      (item) =>
        item.email?.toLowerCase() === normalizedEmail
    );

    if (!user?.passwordHash) {
      return res.status(401).json({
        success: false,
        error: "Invalid email or password.",
      });
    }

    const validPassword = await bcrypt.compare(
      password,
      user.passwordHash
    );

    if (!validPassword) {
      return res.status(401).json({
        success: false,
        error: "Invalid email or password.",
      });
    }

    const token = createToken(user);
    setAuthCookie(res, token);

    return res.json({
      success: true,
      message: "Logged in successfully.",
      user: publicUser(user),
    });
  } catch {
    return res.status(500).json({
      success: false,
      error: "Could not log in.",
    });
  }
});

app.get("/api/auth/me", authenticate, (req, res) => {
  res.json({
    success: true,
    user: publicUser(req.user),
  });
});

app.post("/api/auth/logout", (req, res) => {
  clearAuthCookie(res);

  res.json({
    success: true,
    message: "Logged out successfully.",
  });
});

app.get("/api/auth/google", (req, res) => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return res.status(500).json({
      success: false,
      error: "Google authentication is not configured.",
    });
  }

  try {
    const authUrl = googleClient.generateAuthUrl({
      access_type: "offline",
      prompt: "select_account",
      scope: ["openid", "email", "profile"],
    });

    res.redirect(authUrl);
  } catch {
    res.status(500).json({
      success: false,
      error: "Could not start Google authentication.",
    });
  }
});

app.get("/api/auth/google/callback", async (req, res) => {
  try {
    const { code } = req.query;

    if (!code) {
      return res.redirect(
        `${CLIENT_URL}/?auth_error=missing_code`
      );
    }

    const { tokens } = await googleClient.getToken(code);

    if (!tokens.id_token) {
      return res.redirect(
        `${CLIENT_URL}/?auth_error=no_id_token`
      );
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload?.email || !payload?.sub) {
      return res.redirect(
        `${CLIENT_URL}/?auth_error=invalid_google_account`
      );
    }

    const googleId = payload.sub;
    const email = payload.email.toLowerCase();
    const name =
      payload.name ||
      email.split("@")[0] ||
      "Verlo User";

    const picture = payload.picture || null;

    const users = readJson(USERS_FILE, []);

    let user = users.find(
      (item) => item.googleId === googleId
    );

    if (!user) {
      user = users.find(
        (item) =>
          item.email?.toLowerCase() === email
      );
    }

    if (user) {
      user.googleId = googleId;
      user.picture = picture || user.picture;
      user.provider = "google";
      user.name = user.name || name;
    } else {
      user = {
        id: createUserId(),
        googleId,
        name,
        email,
        passwordHash: null,
        picture,
        provider: "google",
        createdAt: new Date().toISOString(),
      };

      users.push(user);
    }

    writeJson(USERS_FILE, users);

    const token = createToken(user);
    setAuthCookie(res, token);

    res.redirect(CLIENT_URL);
  } catch {
    res.redirect(
      `${CLIENT_URL}/?auth_error=google_login_failed`
    );
  }
});

app.get("/api/history", authenticate, (req, res) => {
  const history = readJson(HISTORY_FILE, []);

  res.json({
    success: true,
    history: history.filter(
      (item) => item.userId === req.user.id
    ),
  });
});

app.post("/api/history/save", authenticate, (req, res) => {
  try {
    const { report } = req.body;

    if (!report) {
      return res.status(400).json({
        success: false,
        error: "Report data is required.",
      });
    }

    const history = readJson(HISTORY_FILE, []);

    history.push({
      id: createUserId(),
      userId: req.user.id,
      title: report.title || "Untitled Report",
      description: report.description || "",
      result: report.result || null,
      timestamp: new Date().toISOString(),
    });

    writeJson(HISTORY_FILE, history);

    res.status(201).json({
      success: true,
      history: history.filter(
        (item) => item.userId === req.user.id
      ),
    });
  } catch {
    res.status(500).json({
      success: false,
      error: "Could not save pathway.",
    });
  }
});

app.post("/api/adaptive-question", async (req, res) => {
  try {
    const {
      title = "",
      description = "",
      context = "",
      previousAnswers = {},
      previousQuestions = [],
      questionNumber = 1,
      maxQuestions = 6,
    } = req.body;

    if (!description.trim()) {
      return res.status(400).json({
        success: false,
        error: "A situation description is required.",
      });
    }

    if (
      questionNumber < 1 ||
      questionNumber > maxQuestions
    ) {
      return res.status(400).json({
        success: false,
        error: "Invalid adaptive question number.",
      });
    }

    const answers =
      previousAnswers &&
      typeof previousAnswers === "object"
        ? previousAnswers
        : {};

    const questions = Array.isArray(previousQuestions)
      ? previousQuestions
      : [];

    const answerEntries = Object.entries(answers);

    const previousAnswerText =
      answerEntries.length > 0
        ? answerEntries
            .map(
              ([key, value], index) =>
                `Question ${index + 1} (${key}): ${String(value)}`
            )
            .join("\n")
        : "No answers yet.";

    const previousQuestionText =
      questions.length > 0
        ? questions
            .map(
              (question, index) =>
                `${index + 1}. ${
                  question.question ||
                  question.stem ||
                  question.text ||
                  ""
                }`
            )
            .join("\n")
        : "No previous questions yet.";

    const systemPrompt = `
You are VERLO's adaptive assessment engine.

Generate exactly ONE useful follow-up question for the user's situation.

The question must use the original situation, previous questions, and previous answers.

The goal is to discover the most important missing fact that could change the final action pathway.

Do not create a generic questionnaire.

Question number: ${questionNumber}
Maximum questions: ${maxQuestions}

Rules:
- Return exactly one question.
- Never repeat a previous question.
- Never ask for information already provided.
- Do not ask a question merely because it is common in questionnaires.
- Prefer information that affects urgency, deadlines, money, evidence, responsibility, constraints, available options, consequences, or the user's desired outcome.
- Use mcq when a small set of clear options makes sense.
- Use text when the answer needs a specific explanation.
- MCQs must contain 3 to 5 choices.
- Keep questions concise.
- Return JSON only.
- Do not use markdown.
- Do not explain your reasoning.

Required JSON format:

{
  "question": {
    "id": "adaptive-${questionNumber}",
    "type": "text",
    "question": "..."
  }
}

For multiple choice:

{
  "question": {
    "id": "adaptive-${questionNumber}",
    "type": "mcq",
    "question": "...",
    "stem": "...",
    "choices": ["...", "...", "..."]
  }
}
`;

    const userPrompt = `
Original situation title:
${title || "Untitled situation"}

Original situation:
${description}

Additional context:
${context || "None provided"}

Previous questions:
${previousQuestionText}

Previous answers:
${previousAnswerText}

Generate the next adaptive question now.
`;

    const raw = await askGroq(
      systemPrompt,
      userPrompt,
      {
        temperature: 0.25,
        max_tokens: 500,
      }
    );

    const parsed = extractJson(raw);

    let question =
      parsed?.question ||
      parsed?.data?.question ||
      parsed;

    if (
      Array.isArray(parsed?.questions) &&
      parsed.questions.length
    ) {
      question = parsed.questions[0];
    }

    const normalised = normaliseQuestion(
      question,
      questionNumber
    );

    if (!normalised) {
      throw new Error(
        "Adaptive engine returned no usable question."
      );
    }

    res.json({
      success: true,
      question: normalised,
    });
  } catch (error) {
    console.error("Adaptive question error:", error);

    res.status(500).json({
      success: false,
      error:
        error?.message ||
        "Could not generate adaptive question.",
    });
  }
});

app.post("/api/questions", async (req, res) => {
  try {
    const {
      prompt,
      previousAnswers = {},
    } = req.body;

    if (!prompt?.trim()) {
      return res.status(400).json({
        success: false,
        error: "A prompt is required.",
      });
    }

    const raw = await askGroq(
      `
You are VERLO's adaptive assessment engine.

Create useful questions based directly on the user's situation.

Return JSON only.

{
  "questions": [
    {
      "id": "question_1",
      "type": "text",
      "question": "..."
    }
  ]
}
`,
      `
Situation:
${prompt}

Previous answers:
${JSON.stringify(previousAnswers, null, 2)}
`,
      {
        temperature: 0.35,
        max_tokens: 1200,
      }
    );

    const parsed = extractJson(raw);

    const questions = Array.isArray(parsed.questions)
      ? parsed.questions
          .map((item, index) =>
            normaliseQuestion(item, index + 1)
          )
          .filter(Boolean)
      : [];

    res.json({
      success: true,
      questions,
    });
  } catch (error) {
    console.error("Questions error:", error);

    res.status(500).json({
      success: false,
      error:
        error?.message ||
        "Could not generate adaptive questions.",
    });
  }
});

app.post("/api/analyze", async (req, res) => {
  try {
    const {
      title = "",
      prompt = "",
      category = "",
      context = "",
      answers = {},
      questions = [],
      attachment = null,
    } = req.body;

    if (!prompt?.trim()) {
      return res.status(400).json({
        success: false,
        error: "A prompt is required.",
      });
    }

    let parsedAnswers = answers;

    if (typeof answers === "string") {
      try {
        parsedAnswers = JSON.parse(answers);
      } catch {
        parsedAnswers = {
          raw: answers,
        };
      }
    }

    let parsedQuestions = questions;

    if (typeof questions === "string") {
      try {
        parsedQuestions = JSON.parse(questions);
      } catch {
        parsedQuestions = [];
      }
    }

    const questionAnswerPairs = Array.isArray(
      parsedQuestions
    )
      ? parsedQuestions
          .map((question) => ({
            question:
              question.question ||
              question.stem ||
              question.text ||
              "",
            answer:
              parsedAnswers?.[question.id] ?? "",
          }))
          .filter(
            (item) =>
              item.question ||
              item.answer
          )
      : Object.entries(
          parsedAnswers || {}
        ).map(([key, value]) => ({
          question: key,
          answer: value,
        }));

    const raw = await askGroq(
      `
You are VERLO's final decision-intelligence engine.

Create a personalised action pathway from the user's situation and adaptive answers.

Return JSON only.

{
  "situation": "",
  "confidence": "High",
  "riskAssessment": {
    "severityScore": 5,
    "financialExposure": "",
    "timeSensitivity": ""
  },
  "nextSteps": [
    {
      "step": "",
      "why": "",
      "pitfallWarning": ""
    }
  ],
  "personalizedPanels": [
    {
      "panelTitle": "",
      "insight": "",
      "solution": ""
    }
  ],
  "draftTemplate": {
    "recipient": "",
    "subject": "",
    "body": ""
  },
  "resources": [],
  "referenceLinks": []
}

Rules:
- confidence must be High, Moderate, or Low.
- severityScore must be an integer from 1 to 10.
- Do not invent facts.
- Do not invent laws, organisations, phone numbers, or URLs.
- Use adaptive answers heavily.
- Make the pathway specific.
- If information is unknown, say it is unknown.
`,
      `
Title:
${title || "General situation"}

Situation:
${prompt}

Category:
${category || "General"}

Context:
${context || "None provided"}

Adaptive questions and answers:
${JSON.stringify(
  questionAnswerPairs,
  null,
  2
)}

Attachment:
${JSON.stringify(
  attachment,
  null,
  2
)}
`,
      {
        temperature: 0.3,
        max_tokens: 4000,
      }
    );

    const result = extractJson(raw);

    if (!Array.isArray(result.nextSteps)) {
      result.nextSteps = [];
    }

    if (!Array.isArray(result.personalizedPanels)) {
      result.personalizedPanels = [];
    }

    if (!Array.isArray(result.resources)) {
      result.resources = [];
    }

    if (!Array.isArray(result.referenceLinks)) {
      result.referenceLinks = result.resources;
    }

    if (!result.riskAssessment) {
      result.riskAssessment = {
        severityScore: "N/A",
        financialExposure: "Not established",
        timeSensitivity: "Review required",
      };
    }

    res.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error("Analyze error:", error);

    res.status(500).json({
      success: false,
      error:
        error?.message ||
        "Could not generate the result.",
    });
  }
});

app.post("/api/chat", async (req, res) => {
  try {
    const {
      question,
      message,
      currentSituation = "",
      context = "",
      attachment = null,
    } = req.body;

    const userMessage = question || message || "";

    if (!userMessage.trim()) {
      return res.status(400).json({
        success: false,
        error: "Message is required.",
      });
    }

    const response = await askGroq(
      `
You are VERLO AI Assistant.

Help the user understand their existing situation.

Do not invent facts.

Situation:
${currentSituation || context || "None provided"}

Attachment:
${JSON.stringify(attachment, null, 2)}
`,
      userMessage,
      {
        temperature: 0.55,
        max_tokens: 1800,
      }
    );

    res.json({
      success: true,
      reply: response,
      response,
    });
  } catch (error) {
    console.error("Chat error:", error);

    res.status(500).json({
      success: false,
      error: "Could not generate a response.",
    });
  }
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Endpoint not found.",
  });
});

app.use((error, req, res, next) => {
  console.error("Unhandled server error:", error);

  res.status(500).json({
    success: false,
    error: "Internal server error.",
  });
});

app.listen(PORT, () => {
  console.log("");
  console.log("==========================================");
  console.log("              VERLO SERVER");
  console.log("==========================================");
  console.log(`Port:              ${PORT}`);
  console.log(`API:               ${API_URL}`);
  console.log(`Frontend:          ${CLIENT_URL}`);
  console.log(`Google callback:   ${GOOGLE_REDIRECT_URI}`);
  console.log("Adaptive engine:   ENABLED");
  console.log("Authentication:    HttpOnly cookie");
  console.log("==========================================");
  console.log("");
});