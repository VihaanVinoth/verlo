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
const API_URL =
  process.env.API_URL || "https://verlo-30xs.onrender.com";
const CLIENT_URL =
  process.env.CLIENT_URL || "https://verloai.netlify.app";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI ||
  `${API_URL}/api/auth/google/callback`;

const JWT_SECRET = process.env.JWT_SECRET;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL;

const VERIFICATION_CODE_EXPIRY_MS = 15 * 60 * 1000;
const VERIFICATION_RESEND_COOLDOWN_MS = 60 * 1000;

const MAX_ADAPTIVE_QUESTIONS = 6;

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
  } catch {
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
    methods: [
      "GET",
      "POST",
      "PUT",
      "DELETE",
      "OPTIONS",
    ],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Accept",
    ],
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(
  express.urlencoded({
    extended: true,
    limit: "10mb",
  })
);
app.use(cookieParser());

const googleClient = new OAuth2Client(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI
);

const groq = GROQ_API_KEY
  ? new Groq({ apiKey: GROQ_API_KEY })
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
    verified:
      user.provider === "google" ||
      user.verified !== false,
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

    if (
      user.provider !== "google" &&
      user.verified === false
    ) {
      return res.status(403).json({
        success: false,
        error:
          "Email verification is required.",
        verificationRequired: true,
        email: user.email,
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

function createVerificationCode() {
  return String(
    crypto.randomInt(100000, 1000000)
  );
}

function hashVerificationCode(code) {
  return crypto
    .createHash("sha256")
    .update(String(code))
    .digest("hex");
}

function getVerificationExpiry() {
  return new Date(
    Date.now() + VERIFICATION_CODE_EXPIRY_MS
  ).toISOString();
}

function getVerificationLastSent(user) {
  if (!user?.verificationLastSentAt) {
    return null;
  }

  const timestamp = Date.parse(
    user.verificationLastSentAt
  );

  return Number.isNaN(timestamp)
    ? null
    : timestamp;
}

async function sendVerificationEmail(user, code) {
  if (
    !RESEND_API_KEY ||
    !RESEND_FROM_EMAIL
  ) {
    throw new Error(
      "Email verification is not configured. Add RESEND_API_KEY and RESEND_FROM_EMAIL."
    );
  }

  const safeName = String(
    user.name || "there"
  )
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const response = await fetch(
    "https://api.resend.com/emails",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: [user.email],
        subject: "Verify your VERLO account",
        html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px;color:#171717">
          <h1 style="margin-bottom:8px">Verify your VERLO account</h1>
          <p>Hi ${safeName},</p>
          <p>Use the verification code below to finish creating your VERLO account.</p>
          <div style="font-size:32px;font-weight:700;letter-spacing:8px;padding:20px 0">${code}</div>
          <p>This code expires in 15 minutes.</p>
          <p>If you did not create a VERLO account, you can ignore this email.</p>
        </div>
      `,
      }),
    }
  );

  if (!response.ok) {
    let details = "";

    try {
      const data = await response.json();
      details =
        data?.message ||
        data?.error ||
        "";
    } catch {}

    throw new Error(
      details ||
        "The verification email could not be sent."
    );
  }
}

function extractJson(raw) {
  if (!raw) {
    throw new Error(
      "AI returned an empty response."
    );
  }

  const cleaned = String(raw)
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {}

  const firstObject =
    cleaned.indexOf("{");
  const lastObject =
    cleaned.lastIndexOf("}");

  if (
    firstObject !== -1 &&
    lastObject > firstObject
  ) {
    try {
      return JSON.parse(
        cleaned.slice(
          firstObject,
          lastObject + 1
        )
      );
    } catch {}
  }

  const firstArray =
    cleaned.indexOf("[");
  const lastArray =
    cleaned.lastIndexOf("]");

  if (
    firstArray !== -1 &&
    lastArray > firstArray
  ) {
    try {
      return JSON.parse(
        cleaned.slice(
          firstArray,
          lastArray + 1
        )
      );
    } catch {}
  }

  throw new Error(
    "AI returned invalid JSON."
  );
}

function normaliseChoice(choice) {
  if (typeof choice === "string") {
    return choice.trim();
  }

  if (
    choice &&
    typeof choice === "object"
  ) {
    return String(
      choice.text ||
        choice.label ||
        choice.value ||
        choice.name ||
        ""
    ).trim();
  }

  return String(
    choice || ""
  ).trim();
}

function getAnswerType(
  question,
  type
) {
  const explicit = String(
    question.answerType ||
      question.answer_type ||
      question.inputType ||
      question.input_type ||
      ""
  )
    .toLowerCase()
    .trim();

  if (
    question.multiline === true ||
    question.multiLine === true ||
    [
      "long_text",
      "longtext",
      "textarea",
      "paragraph",
      "multi_line",
      "multiline",
    ].includes(explicit)
  ) {
    return "long_text";
  }

  if (
    question.multiline === false ||
    question.multiLine === false ||
    [
      "short_text",
      "single_line",
      "singleline",
      "text",
      "string",
      "short",
      "input",
    ].includes(explicit)
  ) {
    return "short_text";
  }

  if (type === "mcq") {
    return "choice";
  }

  const text = String(
    question.question ||
      question.text ||
      question.prompt ||
      question.stem ||
      ""
  ).toLowerCase();

  if (
    /^(do|does|did|is|are|was|were|can|could|would|will|have|has|had)\b/.test(
      text
    )
  ) {
    return "short_text";
  }

  if (
    /\b(explain|describe|elaborate|provide details|in your own words|tell us more|tell me more)\b/.test(
      text
    )
  ) {
    return "long_text";
  }

  return "short_text";
}

function normaliseQuestion(
  question,
  questionNumber
) {
  if (typeof question === "string") {
    question = {
      question,
      type: "text",
    };
  }

  if (
    !question ||
    typeof question !== "object"
  ) {
    return null;
  }

  const requestedType =
    String(
      question.type || ""
    ).toLowerCase();

  const rawChoices =
    Array.isArray(
      question.choices
    )
      ? question.choices
      : Array.isArray(
          question.options
        )
        ? question.options
        : [];

  const choices = rawChoices
    .map(normaliseChoice)
    .filter(Boolean);

  const type =
    requestedType === "mcq" ||
    requestedType === "choice" ||
    requestedType ===
      "multiple-choice" ||
    requestedType ===
      "multiple_choice"
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

  const cleanQuestion =
    String(questionText).trim();

  const imageUrl =
    question.imageUrl ||
    question.image ||
    question.image_url ||
    null;

  if (
    type === "mcq" &&
    choices.length < 2
  ) {
    return {
      id:
        question.id ||
        `adaptive-${questionNumber}`,
      type: "text",
      answerType:
        getAnswerType(
          question,
          "text"
        ),
      question: cleanQuestion,
      stem: cleanQuestion,
      choices: [],
      imageUrl,
      imageAlt:
        question.imageAlt ||
        question.image_alt ||
        cleanQuestion,
      imageCaption:
        question.imageCaption ||
        question.image_caption ||
        "",
      placeholder:
        question.placeholder ||
        "",
      required:
        question.required !== false,
      questionNumber,
    };
  }

  return {
    id:
      question.id ||
      `adaptive-${questionNumber}`,
    type,
    answerType:
      type === "mcq"
        ? "choice"
        : getAnswerType(
            question,
            type
          ),
    question: cleanQuestion,
    stem: cleanQuestion,
    choices,
    imageUrl,
    imageAlt:
      question.imageAlt ||
      question.image_alt ||
      cleanQuestion,
    imageCaption:
      question.imageCaption ||
      question.image_caption ||
      "",
    placeholder:
      question.placeholder ||
      "",
    required:
      question.required !== false,
    questionNumber,
  };
}

function questionKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function buildFallbackQuestion(
  title,
  description,
  context,
  previousAnswers,
  questionNumber
) {
  const source =
    `${title} ${description} ${context}`.toLowerCase();

  const answers = Object.values(
    previousAnswers || {}
  )
    .map((value) =>
      String(value)
    )
    .join(" ")
    .toLowerCase();

  const combined =
    `${source} ${answers}`;

  const makeQuestion = (
    question,
    answerType = "short_text"
  ) => ({
    id: `adaptive-${questionNumber}`,
    type: "text",
    answerType,
    question,
    stem: question,
    choices: [],
    imageUrl: null,
    imageAlt: "",
    imageCaption: "",
    placeholder: "",
    required: true,
    questionNumber,
  });

  if (
    /deadline|due|expires|urgent|today|tomorrow|date|time/.test(
      combined
    )
  ) {
    return makeQuestion(
      "What deadline or time limit applies to this situation?",
      "short_text"
    );
  }

  if (
    /money|cost|price|payment|bill|invoice|refund|rent|fee|charge/.test(
      combined
    )
  ) {
    return makeQuestion(
      "What amount of money is involved, and what payment or financial outcome are you trying to achieve?",
      "short_text"
    );
  }

  if (
    /email|message|letter|written|evidence|receipt|photo|document|proof|contract/.test(
      combined
    )
  ) {
    return makeQuestion(
      "What records, messages, documents, or other evidence do you already have?",
      "long_text"
    );
  }

  if (
    /landlord|tenant|rental|property|house|apartment|repair/.test(
      combined
    )
  ) {
    return makeQuestion(
      "What has the other party said or done so far, and when did that happen?",
      "long_text"
    );
  }

  if (
    /flight|airline|travel|hotel|booking|trip|airport/.test(
      combined
    )
  ) {
    return makeQuestion(
      "Do you have any travel insurance, credit-card coverage, or other protection that may cover the booking?",
      "short_text"
    );
  }

  if (
    /laptop|computer|phone|device|warranty|repair|broken|fault/.test(
      combined
    )
  ) {
    return makeQuestion(
      "What problem is the device experiencing, and what has already been tried to fix it?",
      "long_text"
    );
  }

  if (questionNumber === 1) {
    return makeQuestion(
      "What outcome would resolve this situation for you?",
      "short_text"
    );
  }

  if (questionNumber === 2) {
    return makeQuestion(
      "What has happened so far, including any response you have received from the other person or organisation?",
      "long_text"
    );
  }

  if (questionNumber === 3) {
    return makeQuestion(
      "Is there any important constraint, deadline, cost, or consequence that VERLO should take into account?",
      "short_text"
    );
  }

  return makeQuestion(
    "Is there anything else about this situation that could change what you should do next?",
    "short_text"
  );
}

async function askGroq(
  systemPrompt,
  userPrompt,
  options = {}
) {
  if (!groq) {
    throw new Error(
      "GROQ_API_KEY is not configured."
    );
  }

  const completion =
    await groq.chat.completions.create({
      model:
        "openai/gpt-oss-120b",
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
      temperature:
        options.temperature ?? 0.5,
      max_tokens:
        options.max_tokens ?? 2500,
    });

  const content =
    completion?.choices?.[0]
      ?.message?.content;

  if (!content) {
    throw new Error(
      "Groq returned an empty response."
    );
  }

  return content;
}

async function generateAdaptiveQuestion({
  title,
  description,
  context,
  previousAnswers,
  previousQuestions,
  questionNumber,
  maxQuestions,
}) {
  const answerEntries =
    Object.entries(
      previousAnswers || {}
    );

  const previousAnswerText =
    answerEntries.length > 0
      ? answerEntries
          .map(
            ([key, value], index) =>
              `Question ${
                index + 1
              } (${key}): ${String(
                value
              )}`
          )
          .join("\n")
      : "No answers yet.";

  const previousQuestionText =
    previousQuestions.length > 0
      ? previousQuestions
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



























  // LUCKY NUMBER 888
  const systemPrompt = `
You are VERLO's adaptive assessment engine.

Generate exactly ONE useful follow-up question for the user's specific situation.

The question must use the original situation, previous questions, and previous answers.

The purpose is to discover the most important missing fact that could change the final action pathway.

Do not create a generic questionnaire.

Question number: ${questionNumber}
Maximum questions: ${maxQuestions}

Rules:
- Return exactly one question.
- Never repeat a previous question.
- Never ask for information already provided.
- Never ask a question merely because it is common in questionnaires.
- Prioritise information that could change urgency, deadlines, money, evidence, responsibility, constraints, available options, consequences, or the user's desired outcome.
- Make the question clearly relevant to the user's exact situation.
- Use mcq when a small set of clear options genuinely helps.
- Use text when a written answer is more appropriate.
- For ordinary factual, yes/no, confirmation, availability, date, amount, or short-answer questions, use answerType "short_text".
- For questions that genuinely require explanation, description, multiple details, or a longer response, use answerType "long_text".
- Do not use long_text simply because the question itself is long.
- MCQs must contain 3 to 5 choices.
- If an image is genuinely necessary and an existing attachment is available, use imageUrl from that attachment.
- Do not invent an image URL.
- Keep the question concise.
- Return JSON only.
- Do not use markdown.
- Do not explain your reasoning.

Required JSON:

{
  "question": {
    "id": "adaptive-${questionNumber}",
    "type": "text",
    "answerType": "short_text",
    "question": "..."
  }
}

For long answers:

{
  "question": {
    "id": "adaptive-${questionNumber}",
    "type": "text",
    "answerType": "long_text",
    "question": "..."
  }
}

For multiple choice:

{
  "question": {
    "id": "adaptive-${questionNumber}",
    "type": "mcq",
    "answerType": "choice",
    "question": "...",
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

  for (
    let attempt = 0;
    attempt < 2;
    attempt += 1
  ) {
    try {
      const raw =
        await askGroq(
          systemPrompt,
          attempt === 0
            ? userPrompt
            : `${userPrompt}

Your previous response was unusable.

Return one valid JSON object only.
Do not include reasoning.
Do not include markdown.
Do not include extra text.`,
          {
            temperature: 0.2,
            max_tokens: 900,
          }
        );

      const parsed =
        extractJson(raw);

      let question =
        parsed?.question ||
        parsed?.data?.question ||
        parsed;

      if (
        Array.isArray(
          parsed?.questions
        ) &&
        parsed.questions.length
      ) {
        question =
          parsed.questions[0];
      }

      const normalised =
        normaliseQuestion(
          question,
          questionNumber
        );

      if (!normalised) {
        throw new Error(
          "Adaptive engine returned no usable question."
        );
      }

      const existingKeys =
        previousQuestions
          .map(
            (item) =>
              item?.question ||
              item?.stem ||
              item?.text ||
              ""
          )
          .map(questionKey)
          .filter(Boolean);

      if (
        existingKeys.includes(
          questionKey(
            normalised.question
          )
        )
      ) {
        throw new Error(
          "Adaptive engine repeated a previous question."
        );
      }

      return normalised;
    } catch {}
  }

  return buildFallbackQuestion(
    title,
    description,
    context,
    previousAnswers,
    questionNumber
  );
}

app.get("/", (req, res) => {
  res.json({
    success: true,
    name: "Verlo API",
    status: "online",
    frontend: CLIENT_URL,
    authentication:
      "HttpOnly cookie",
    adaptiveEngine: true,
    emailVerification: true,
  });
});

app.get(
  "/api/health",
  (req, res) => {
    res.json({
      success: true,
      status: "online",
      service: "Verlo API",
      adaptiveEngine: true,
      emailVerification: true,
      timestamp:
        new Date().toISOString(),
    });
  }
);

app.post(
  "/api/auth/signup",
  async (req, res) => {
    try {
      const {
        name,
        email,
        password,
      } = req.body;

      if (!email || !password) {
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

      if (
        !RESEND_API_KEY ||
        !RESEND_FROM_EMAIL
      ) {
        return res.status(503).json({
          success: false,
          error:
            "Email verification is not configured on the server.",
        });
      }

      const normalizedEmail =
        email.trim().toLowerCase();

      const users =
        readJson(
          USERS_FILE,
          []
        );

      const existingUser =
        users.find(
          (user) =>
            user.email?.toLowerCase() ===
            normalizedEmail
        );

      if (existingUser) {
        if (
          existingUser.provider ===
            "local" &&
          existingUser.verified ===
            false
        ) {
          return res.status(409).json({
            success: false,
            error:
              "An unverified account with this email already exists. Request a new verification code.",
            verificationRequired:
              true,
            email:
              normalizedEmail,
          });
        }

        return res.status(409).json({
          success: false,
          error:
            "An account with this email already exists.",
        });
      }

      const passwordHash =
        await bcrypt.hash(
          password,
          12
        );

      const user = {
        id: createUserId(),
        name:
          name?.trim() ||
          normalizedEmail.split(
            "@"
          )[0],
        email:
          normalizedEmail,
        passwordHash,
        picture: null,
        provider: "local",
        verified: false,
        verificationCodeHash:
          null,
        verificationExpiresAt:
          null,
        verificationLastSentAt:
          null,
        createdAt:
          new Date().toISOString(),
      };

      const code =
        createVerificationCode();

      user.verificationCodeHash =
        hashVerificationCode(
          code
        );

      user.verificationExpiresAt =
        getVerificationExpiry();

      user.verificationLastSentAt =
        new Date().toISOString();

      await sendVerificationEmail(
        user,
        code
      );

      users.push(user);

      writeJson(
        USERS_FILE,
        users
      );

      return res.status(201).json({
        success: true,
        message:
          "Account created. Check your email for the verification code.",
        verificationRequired:
          true,
        email:
          normalizedEmail,
      });
    } catch (error) {
      console.error(
        "Signup error:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          error?.message ||
          "Could not create account.",
      });
    }
  }
);

app.post(
  "/api/auth/login",
  async (req, res) => {
    try {
      const {
        email,
        password,
      } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error:
            "Email and password are required.",
        });
      }

      const normalizedEmail =
        email.trim().toLowerCase();

      const users =
        readJson(
          USERS_FILE,
          []
        );

      const user =
        users.find(
          (item) =>
            item.email?.toLowerCase() ===
            normalizedEmail
        );

      if (!user?.passwordHash) {
        return res.status(401).json({
          success: false,
          error:
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
          error:
            "Invalid email or password.",
        });
      }

      if (
        user.provider !==
          "google" &&
        user.verified === false
      ) {
        return res.status(403).json({
          success: false,
          error:
            "Please verify your email before logging in.",
          verificationRequired:
            true,
          email:
            user.email,
        });
      }

      if (
        user.provider ===
          "local" &&
        user.verified ===
          undefined
      ) {
        user.verified = true;

        writeJson(
          USERS_FILE,
          users
        );
      }

      const token =
        createToken(user);

      setAuthCookie(
        res,
        token
      );

      return res.json({
        success: true,
        message:
          "Logged in successfully.",
        user:
          publicUser(user),
      });
    } catch (error) {
      console.error(
        "Login error:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          "Could not log in.",
      });
    }
  }
);

app.post(
  "/api/auth/verify-email",
  async (req, res) => {
    try {
      const {
        email,
        code,
      } = req.body;

      if (!email || !code) {
        return res.status(400).json({
          success: false,
          error:
            "Email and verification code are required.",
        });
      }

      const normalizedEmail =
        email.trim().toLowerCase();

      const cleanCode =
        String(code).trim();

      if (
        !/^\d{6}$/.test(
          cleanCode
        )
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Enter the six-digit verification code.",
        });
      }

      const users =
        readJson(
          USERS_FILE,
          []
        );

      const user =
        users.find(
          (item) =>
            item.email?.toLowerCase() ===
            normalizedEmail
        );

      if (!user) {
        return res.status(404).json({
          success: false,
          error:
            "No account was found for that email.",
        });
      }

      if (
        user.provider ===
          "google" ||
        user.verified === true
      ) {
        const token =
          createToken(user);

        setAuthCookie(
          res,
          token
        );

        return res.json({
          success: true,
          message:
            "Email is already verified.",
          user:
            publicUser(user),
        });
      }

      if (
        !user.verificationCodeHash ||
        !user.verificationExpiresAt
      ) {
        return res.status(400).json({
          success: false,
          error:
            "There is no active verification code. Request a new one.",
          verificationRequired:
            true,
          email:
            user.email,
        });
      }

      const expiry =
        Date.parse(
          user.verificationExpiresAt
        );

      if (
        Number.isNaN(expiry) ||
        Date.now() > expiry
      ) {
        return res.status(400).json({
          success: false,
          error:
            "That verification code has expired. Request a new one.",
          verificationRequired:
            true,
          email:
            user.email,
        });
      }

      const suppliedHash =
        hashVerificationCode(
          cleanCode
        );

      const suppliedBuffer =
        Buffer.from(
          suppliedHash
        );

      const storedBuffer =
        Buffer.from(
          user.verificationCodeHash
        );

      if (
        suppliedBuffer.length !==
          storedBuffer.length ||
        !crypto.timingSafeEqual(
          suppliedBuffer,
          storedBuffer
        )
      ) {
        return res.status(400).json({
          success: false,
          error:
            "That verification code is incorrect.",
          verificationRequired:
            true,
          email:
            user.email,
        });
      }

      user.verified = true;
      user.verificationCodeHash =
        null;
      user.verificationExpiresAt =
        null;
      user.verificationLastSentAt =
        null;

      writeJson(
        USERS_FILE,
        users
      );

      const token =
        createToken(user);

      setAuthCookie(
        res,
        token
      );

      return res.json({
        success: true,
        message:
          "Email verified successfully.",
        user:
          publicUser(user),
      });
    } catch (error) {
      console.error(
        "Verify email error:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          "Could not verify email.",
      });
    }
  }
);

app.post(
  "/api/auth/resend-verification",
  async (req, res) => {
    try {
      const { email } =
        req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          error:
            "Email is required.",
        });
      }

      if (
        !RESEND_API_KEY ||
        !RESEND_FROM_EMAIL
      ) {
        return res.status(503).json({
          success: false,
          error:
            "Email verification is not configured on the server.",
        });
      }

      const normalizedEmail =
        email.trim().toLowerCase();

      const users =
        readJson(
          USERS_FILE,
          []
        );

      const user =
        users.find(
          (item) =>
            item.email?.toLowerCase() ===
            normalizedEmail
        );

      if (!user) {
        return res.status(404).json({
          success: false,
          error:
            "No account was found for that email.",
        });
      }

      if (
        user.provider ===
          "google" ||
        user.verified === true
      ) {
        return res.status(400).json({
          success: false,
          error:
            "This account is already verified.",
        });
      }

      const lastSent =
        getVerificationLastSent(
          user
        );

      if (
        lastSent &&
        Date.now() -
          lastSent <
          VERIFICATION_RESEND_COOLDOWN_MS
      ) {
        const remaining =
          Math.ceil(
            (
              VERIFICATION_RESEND_COOLDOWN_MS -
              (
                Date.now() -
                lastSent
              )
            ) / 1000
          );

        return res.status(429).json({
          success: false,
          error:
            `Please wait ${remaining} seconds before requesting another code.`,
          retryAfter:
            remaining,
        });
      }

      const code =
        createVerificationCode();

      user.verificationCodeHash =
        hashVerificationCode(
          code
        );

      user.verificationExpiresAt =
        getVerificationExpiry();

      user.verificationLastSentAt =
        new Date().toISOString();

      await sendVerificationEmail(
        user,
        code
      );

      writeJson(
        USERS_FILE,
        users
      );

      return res.json({
        success: true,
        message:
          "A new verification code has been sent.",
        verificationRequired:
          true,
        email:
          user.email,
      });
    } catch (error) {
      console.error(
        "Resend verification error:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          error?.message ||
          "Could not resend verification code.",
      });
    }
  }
);

app.get(
  "/api/auth/me",
  authenticate,
  (req, res) => {
    res.json({
      success: true,
      user:
        publicUser(
          req.user
        ),
    });
  }
);

app.post(
  "/api/auth/logout",
  (req, res) => {
    clearAuthCookie(
      res
    );

    res.json({
      success: true,
      message:
        "Logged out successfully.",
    });
  }
);

app.get(
  "/api/auth/google",
  (req, res) => {
    if (
      !GOOGLE_CLIENT_ID ||
      !GOOGLE_CLIENT_SECRET
    ) {
      return res.status(500).json({
        success: false,
        error:
          "Google authentication is not configured.",
      });
    }

    try {
      const authUrl =
        googleClient.generateAuthUrl(
          {
            access_type:
              "offline",
            prompt:
              "select_account",
            scope: [
              "openid",
              "email",
              "profile",
            ],
          }
        );

      res.redirect(
        authUrl
      );
    } catch {
      res.status(500).json({
        success: false,
        error:
          "Could not start Google authentication.",
      });
    }
  }
);

app.get(
  "/api/auth/google/callback",
  async (req, res) => {
    try {
      const { code } =
        req.query;

      if (!code) {
        return res.redirect(
          `${CLIENT_URL}/?auth_error=missing_code`
        );
      }

      const { tokens } =
        await googleClient.getToken(
          code
        );

      if (!tokens.id_token) {
        return res.redirect(
          `${CLIENT_URL}/?auth_error=no_id_token`
        );
      }

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
        !payload?.email ||
        !payload?.sub
      ) {
        return res.redirect(
          `${CLIENT_URL}/?auth_error=invalid_google_account`
        );
      }

      const googleId =
        payload.sub;

      const email =
        payload.email.toLowerCase();

      const name =
        payload.name ||
        email.split(
          "@"
        )[0] ||
        "Verlo User";

      const picture =
        payload.picture ||
        null;

      const users =
        readJson(
          USERS_FILE,
          []
        );

      let user =
        users.find(
          (item) =>
            item.googleId ===
            googleId
        );

      if (!user) {
        user =
          users.find(
            (item) =>
              item.email?.toLowerCase() ===
              email
          );
      }

      if (user) {
        user.googleId =
          googleId;

        user.picture =
          picture ||
          user.picture;

        user.provider =
          "google";

        user.verified =
          true;

        user.verificationCodeHash =
          null;

        user.verificationExpiresAt =
          null;

        user.verificationLastSentAt =
          null;

        user.name =
          user.name ||
          name;
      } else {
        user = {
          id: createUserId(),
          googleId,
          name,
          email,
          passwordHash: null,
          picture,
          provider:
            "google",
          verified: true,
          verificationCodeHash:
            null,
          verificationExpiresAt:
            null,
          verificationLastSentAt:
            null,
          createdAt:
            new Date().toISOString(),
        };

        users.push(
          user
        );
      }

      writeJson(
        USERS_FILE,
        users
      );

      const token =
        createToken(user);

      setAuthCookie(
        res,
        token
      );

      res.redirect(
        CLIENT_URL
      );
    } catch (error) {
      console.error(
        "Google authentication error:",
        error
      );

      res.redirect(
        `${CLIENT_URL}/?auth_error=google_login_failed`
      );
    }
  }
);

app.get(
  "/api/history",
  authenticate,
  (req, res) => {
    const history =
      readJson(
        HISTORY_FILE,
        []
      );

    res.json({
      success: true,
      history:
        history.filter(
          (item) =>
            item.userId ===
            req.user.id
        ),
    });
  }
);

app.post(
  "/api/history/save",
  authenticate,
  (req, res) => {
    try {
      const { report } =
        req.body;

      if (!report) {
        return res.status(400).json({
          success: false,
          error:
            "Report data is required.",
        });
      }

      const history =
        readJson(
          HISTORY_FILE,
          []
        );

      history.push({
        id: createUserId(),
        userId:
          req.user.id,
        title:
          report.title ||
          "Untitled Report",
        description:
          report.description ||
          "",
        result:
          report.result ||
          null,
        timestamp:
          new Date().toISOString(),
      });

      writeJson(
        HISTORY_FILE,
        history
      );

      res.status(201).json({
        success: true,
        history:
          history.filter(
            (item) =>
              item.userId ===
              req.user.id
          ),
      });
    } catch {
      res.status(500).json({
        success: false,
        error:
          "Could not save pathway.",
      });
    }
  }
);

app.post(
  "/api/adaptive-question",
  async (req, res) => {
    try {
      const body =
        req.body || {};

      const title =
        body.title ||
        "";

      const description =
        String(
          body.description ??
            body.situation ??
            body.prompt ??
            ""
        ).trim();

      const context =
        body.context ||
        "";

      const previousAnswers =
        body.previousAnswers &&
        typeof body.previousAnswers ===
          "object"
          ? body.previousAnswers
          : body.answers &&
              typeof body.answers ===
                "object" &&
              !Array.isArray(
                body.answers
              )
            ? body.answers
            : {};

      const previousQuestions =
        Array.isArray(
          body.previousQuestions
        )
          ? body.previousQuestions
          : [];

      const skippedQuestions =
        Array.isArray(
          body.skippedQuestions
        )
          ? body.skippedQuestions
          : Array.isArray(
              previousAnswers._skippedQuestions
            )
            ? previousAnswers._skippedQuestions
            : [];

      const questionNumberRaw =
        Number(
          body.questionNumber
        );

      let questionNumber =
        questionNumberRaw;

      if (
        !Number.isFinite(
          questionNumber
        )
      ) {
        const questionIndex =
          Number(
            body.questionIndex
          );

        questionNumber =
          Number.isFinite(
            questionIndex
          )
            ? questionIndex + 1
            : 1;
      }

      const requestedMax =
        Number(
          body.maxQuestions
        );

      const maxQuestions =
        Number.isFinite(
          requestedMax
        ) &&
        requestedMax > 0
          ? Math.min(
              requestedMax,
              MAX_ADAPTIVE_QUESTIONS
            )
          : MAX_ADAPTIVE_QUESTIONS;

      const attachments =
        Array.isArray(
          body.attachments
        )
          ? body.attachments
          : [];

      if (!description) {
        return res.status(400).json({
          success: false,
          error:
            "A situation description is required.",
        });
      }

      if (
        questionNumber < 1 ||
        questionNumber > maxQuestions
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Invalid adaptive question number.",
        });
      }

      const attachmentText =
        attachments.length > 0
          ? attachments
              .map(
                (item) =>
                  `File: ${
                    item.name ||
                    "Unnamed file"
                  }\nType: ${
                    item.type ||
                    "Unknown"
                  }\nContent: ${
                    item.text ||
                    item.content ||
                    "No extracted text"
                  }`
              )
              .join(
                "\n\n"
              )
          : "";

      const enhancedContext =
        [
          context,
          attachmentText
            ? `Imported files:\n${attachmentText}`
            : "",
          skippedQuestions.length
            ? `Questions deliberately skipped by the user: ${skippedQuestions.join(
                ", "
              )}`
            : "",
        ]
          .filter(Boolean)
          .join("\n\n");

      const question =
        await generateAdaptiveQuestion({
          title,
          description,
          context:
            enhancedContext,
          previousAnswers,
          previousQuestions,
          questionNumber,
          maxQuestions,
        });

      res.json({
        success: true,
        question,
        questionNumber,
        maxQuestions,
        complete: false,
      });
    } catch (error) {
      console.error(
        "Adaptive question error:",
        error
      );

      res.status(500).json({
        success: false,
        error:
          error?.message ||
          "Could not generate adaptive question.",
      });
    }
  }
);

app.post(
  "/api/questions",
  async (req, res) => {
    try {
      const {
        prompt,
        previousAnswers = {},
      } = req.body;

      if (!prompt?.trim()) {
        return res.status(400).json({
          success: false,
          error:
            "A prompt is required.",
        });
      }

      const raw =
        await askGroq(
          `
You are VERLO's adaptive assessment engine.

Create useful questions based directly on the user's situation.

Return JSON only.

{
  "questions": [
    {
      "id": "question_1",
      "type": "text",
      "answerType": "short_text",
      "question": "..."
    }
  ]
}
`,
          `
Situation:
${prompt}

Previous answers:
${JSON.stringify(
  previousAnswers,
  null,
  2
)}
`,
          {
            temperature: 0.35,
            max_tokens: 1200,
          }
        );

      const parsed =
        extractJson(raw);

      const questions =
        Array.isArray(
          parsed.questions
        )
          ? parsed.questions
              .map(
                (item, index) =>
                  normaliseQuestion(
                    item,
                    index + 1
                  )
              )
              .filter(Boolean)
          : [];

      res.json({
        success: true,
        questions,
      });
    } catch (error) {
      console.error(
        "Questions error:",
        error
      );

      res.status(500).json({
        success: false,
        error:
          error?.message ||
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
        title = "",
        prompt = "",
        situation = "",
        category = "",
        context = "",
        answers = {},
        questions = [],
        attachment = null,
        attachments = [],
        skippedQuestions = [],
      } = req.body;

      const finalPrompt =
        String(
          prompt ||
            situation ||
            ""
        ).trim();

      if (!finalPrompt) {
        return res.status(400).json({
          success: false,
          error:
            "A prompt is required.",
        });
      }

      let parsedAnswers =
        answers;

      if (
        typeof answers ===
        "string"
      ) {
        try {
          parsedAnswers =
            JSON.parse(
              answers
            );
        } catch {
          parsedAnswers = {
            raw: answers,
          };
        }
      }

      let parsedQuestions =
        questions;

      if (
        typeof questions ===
        "string"
      ) {
        try {
          parsedQuestions =
            JSON.parse(
              questions
            );
        } catch {
          parsedQuestions = [];
        }
      }

      const explicitSkipped =
        Array.isArray(
          skippedQuestions
        )
          ? skippedQuestions
          : [];

      const embeddedSkipped =
        Array.isArray(
          parsedAnswers?._skippedQuestions
        )
          ? parsedAnswers._skippedQuestions
          : [];

      const allSkippedQuestions =
        [
          ...new Set([
            ...explicitSkipped,
            ...embeddedSkipped,
          ]),
        ];

      const questionAnswerPairs =
        Array.isArray(
          parsedQuestions
        )
          ? parsedQuestions
              .map(
                (question) => {
                  const key =
                    question.id;

                  const wasSkipped =
                    allSkippedQuestions.includes(
                      key
                    );

                  return {
                    question:
                      question.question ||
                      question.stem ||
                      question.text ||
                      "",
                    answer:
                      wasSkipped
                        ? null
                        : parsedAnswers?.[
                            key
                          ] ?? "",
                    skipped:
                      wasSkipped,
                  };
                }
              )
              .filter(
                (item) =>
                  item.question ||
                  item.answer ||
                  item.skipped
              )
          : Object.entries(
              parsedAnswers || {}
            )
              .filter(
                ([key]) =>
                  key !==
                  "_skippedQuestions"
              )
              .map(
                ([key, value]) => ({
                  question: key,
                  answer:
                    allSkippedQuestions.includes(
                      key
                    )
                      ? null
                      : value,
                  skipped:
                    allSkippedQuestions.includes(
                      key
                    ),
                })
              );

      const raw =
        await askGroq(
          `
You are VERLO's final decision-intelligence engine.

Create a personalised, accessible action pathway from the user's situation and adaptive answers.

Return JSON only.

{
  "situation": "",
  "confidence": "High",
  "riskAssessment": {
    "severityScore": 5,
    "financialExposure": "",
    "timeSensitivity": ""
  },
  "summary": "",
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
  "resources": [
    {
      "title": "",
      "description": "",
      "url": ""
    }
  ],
  "referenceLinks": [
    {
      "title": "",
      "description": "",
      "url": ""
    }
  ]
}

Rules:
- confidence must be High, Moderate, or Low.
- severityScore must be an integer from 1 to 10.
- Do not invent facts.
- Do not invent laws, organisations, phone numbers, or URLs.
- Only provide a URL if it is known and genuinely relevant.
- URLs must be complete URLs beginning with https:// or http://.
- Prefer official government, regulator, ombudsman, tribunal, educational, or primary-source websites.
- Use adaptive answers heavily.
- Make the pathway specific.
- Explain technical or complicated information in plain language.
- Keep headings and recommendations easy to scan.
- Make important deadlines and actions explicit.
- If information is unknown, say it is unknown.
- Do not make unsupported legal, financial, medical, or professional claims.
- Keep all generated text complete.
- Do not truncate sections.
- If Markdown is useful inside a text field, return the complete Markdown.
- A skipped question is not an answer.
- Never infer information from a skipped question.
- Use skipped questions only to understand which information is unavailable.
`,
          `
Title:
${title || "General situation"}

Situation:
${finalPrompt}

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

Skipped questions:
${JSON.stringify(
  allSkippedQuestions,
  null,
  2
)}

Imported files:
${JSON.stringify(
  attachments ||
    attachment ||
    [],
  null,
  2
)}
`,
          {
            temperature: 0.3,
            max_tokens: 5000,
          }
        );

      const result =
        extractJson(raw);

      if (
        !Array.isArray(
          result.nextSteps
        )
      ) {
        result.nextSteps = [];
      }

      if (
        !Array.isArray(
          result.personalizedPanels
        )
      ) {
        result.personalizedPanels =
          [];
      }

      if (
        !Array.isArray(
          result.resources
        )
      ) {
        result.resources = [];
      }

      if (
        !Array.isArray(
          result.referenceLinks
        )
      ) {
        result.referenceLinks =
          result.resources;
      }

      result.resources =
        result.resources
          .filter(
            (item) =>
              item &&
              typeof item ===
                "object"
          )
          .map(
            (item) => ({
              title:
                item.title ||
                "Resource",
              description:
                item.description ||
                "",
              url:
                typeof item.url ===
                  "string" &&
                /^https?:\/\//i.test(
                  item.url
                )
                  ? item.url
                  : "",
            })
          );

      result.referenceLinks =
        result.referenceLinks
          .filter(
            (item) =>
              item &&
              typeof item ===
                "object"
          )
          .map(
            (item) => ({
              title:
                item.title ||
                "Reference",
              description:
                item.description ||
                "",
              url:
                typeof item.url ===
                  "string" &&
                /^https?:\/\//i.test(
                  item.url
                )
                  ? item.url
                  : "",
            })
          );

      if (
        !result.riskAssessment
      ) {
        result.riskAssessment = {
          severityScore:
            "N/A",
          financialExposure:
            "Not established",
          timeSensitivity:
            "Review required",
        };
      }

      if (!result.summary) {
        result.summary =
          result.situation ||
          "Review the information and actions below.";
      }

      res.json({
        success: true,
        result,
      });
    } catch (error) {
      console.error(
        "Analyze error:",
        error
      );

      res.status(500).json({
        success: false,
        error:
          error?.message ||
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
        question,
        message,
        currentSituation = "",
        situation = "",
        context = "",
        attachment = null,
      } = req.body;

      const userMessage =
        question ||
        message ||
        "";

      if (
        !String(
          userMessage
        ).trim()
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Message is required.",
        });
      }

      const response =
        await askGroq(
          `
You are VERLO AI Assistant.

Help the user understand their existing situation.

Use plain, accessible language.

Do not invent facts.

Give a complete response.
Do not stop halfway through a sentence.
Do not artificially shorten the answer.
Use Markdown when it improves readability.
Tables are allowed when useful.

Situation:
${
  currentSituation ||
  situation ||
  context ||
  "None provided"
}

Attachment:
${JSON.stringify(
  attachment,
  null,
  2
)}
`,
          String(
            userMessage
          ),
          {
            temperature: 0.55,
            max_tokens: 1800,
          }
        );

      res.json({
        success: true,
        reply: response,
        response,
        content: response,
        message: response,
      });
    } catch (error) {
      console.error(
        "Chat error:",
        error
      );

      res.status(500).json({
        success: false,
        error:
          error?.message ||
          "Could not generate a response.",
      });
    }
  }
);

app.use(
  (req, res) => {
    res.status(404).json({
      success: false,
      error:
        "Endpoint not found.",
    });
  }
);

app.use(
  (
    error,
    req,
    res,
    next
  ) => {
    console.error(
      "Unhandled server error:",
      error
    );

    res.status(500).json({
      success: false,
      error:
        "Internal server error.",
    });
  }
);

app.listen(
  PORT,
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
      "Adaptive engine:   ENABLED"
    );
    console.log(
      `Adaptive questions: ${MAX_ADAPTIVE_QUESTIONS}`
    );
    console.log(
      "Email verification: ENABLED"
    );
    console.log(
      "Authentication:    HttpOnly cookie"
    );
    console.log(
      "=========================================="
    );
    console.log("");
  }
);