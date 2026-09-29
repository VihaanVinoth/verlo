import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import Groq from 'groq-sdk';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const PORT = process.env.PORT || 5001;

const CLIENT_URL =
  process.env.CLIENT_URL ||
  'http://localhost:5173';

const JWT_SECRET =
  process.env.JWT_SECRET;

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

app.use(cors());

app.use(
  express.json({
    limit: '2mb'
  })
);

const dataDir = path.join(
  __dirname,
  'data'
);

const usersFile = path.join(
  dataDir,
  'users.json'
);

const historyFile = path.join(
  dataDir,
  'history.json'
);

fs.mkdirSync(dataDir, {
  recursive: true
});

if (!fs.existsSync(usersFile)) {
  fs.writeFileSync(
    usersFile,
    '[]',
    'utf8'
  );
}

if (!fs.existsSync(historyFile)) {
  fs.writeFileSync(
    historyFile,
    '{}',
    'utf8'
  );
}

function readJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) {
      return fallback;
    }

    const content =
      fs.readFileSync(
        file,
        'utf8'
      );

    if (!content.trim()) {
      return fallback;
    }

    return JSON.parse(content);
  } catch (error) {
    console.error(
      `Could not read ${file}:`,
      error
    );

    return fallback;
  }
}

function writeJson(file, data) {
  fs.writeFileSync(
    file,
    JSON.stringify(
      data,
      null,
      2
    ),
    'utf8'
  );
}

const uploadDir = path.join(
  __dirname,
  'uploads'
);

fs.mkdirSync(uploadDir, {
  recursive: true
});

const storage =
  multer.diskStorage({
    destination: (
      req,
      file,
      cb
    ) => {
      cb(
        null,
        uploadDir
      );
    },

    filename: (
      req,
      file,
      cb
    ) => {
      const uniqueSuffix =
        Date.now() +
        '-' +
        Math.round(
          Math.random() * 1e9
        );

      cb(
        null,
        uniqueSuffix +
          '-' +
          file.originalname
      );
    }
  });

const upload = multer({
  storage,

  limits: {
    fileSize:
      15 * 1024 * 1024
  }
});

function cleanJson(text) {
  if (!text) {
    return null;
  }

  let cleaned =
    String(text).trim();

  cleaned = cleaned
    .replace(
      /^```json\s*/i,
      ''
    )
    .replace(
      /^```\s*/i,
      ''
    )
    .replace(
      /\s*```$/i,
      ''
    )
    .trim();

  try {
    return JSON.parse(
      cleaned
    );
  } catch (error) {
  }

  const firstBrace =
    cleaned.indexOf('{');

  const lastBrace =
    cleaned.lastIndexOf('}');

  if (
    firstBrace !== -1 &&
    lastBrace !== -1 &&
    lastBrace > firstBrace
  ) {
    try {
      return JSON.parse(
        cleaned.slice(
          firstBrace,
          lastBrace + 1
        )
      );
    } catch (error) {
    }
  }

  return null;
}

function normaliseQuestion(
  question,
  questionNumber
) {
  if (
    !question ||
    typeof question !== 'object'
  ) {
    return {
      id:
        `adaptive-${questionNumber}`,

      type: 'text',

      question:
        'What is the most important outcome you want from this situation?'
    };
  }

  const type =
    question.type === 'mcq'
      ? 'mcq'
      : 'text';

  const normalized = {
    id:
      question.id ||
      `adaptive-${questionNumber}`,

    type,

    question:
      question.question ||
      question.stem ||
      'Can you provide more detail about this situation?',

    stem:
      question.stem ||
      question.question ||
      ''
  };

  if (
    type === 'mcq' &&
    Array.isArray(
      question.choices
    )
  ) {
    normalized.choices =
      question.choices
        .filter(Boolean)
        .slice(0, 6);
  }

  return normalized;
}

function safeString(value) {
  if (
    value === undefined ||
    value === null
  ) {
    return '';
  }

  return String(value);
}

function safeUser(user) {
  return {
    id: user.id,
    email: user.email,
    name:
      user.name ||
      user.email?.split('@')[0] ||
      'User',
    picture:
      user.picture ||
      null,
    provider:
      user.provider ||
      'local',
    createdAt:
      user.createdAt
  };
}

function createToken(user) {
  if (!JWT_SECRET) {
    throw new Error(
      'JWT_SECRET is not configured.'
    );
  }

  return jwt.sign(
    {
      sub: user.id
    },
    JWT_SECRET,
    {
      expiresIn: '7d'
    }
  );
}

function getAuthenticatedUser(
  req
) {
  const authorization =
    req.headers.authorization;

  if (
    !authorization ||
    !authorization.startsWith(
      'Bearer '
    )
  ) {
    return null;
  }

  const token =
    authorization.substring(
      7
    );

  try {
    const decoded =
      jwt.verify(
        token,
        JWT_SECRET
      );

    const users =
      readJson(
        usersFile,
        []
      );

    return (
      users.find(
        user =>
          user.id ===
          decoded.sub
      ) || null
    );
  } catch (error) {
    return null;
  }
}

function requireAuth(
  req,
  res,
  next
) {
  const user =
    getAuthenticatedUser(
      req
    );

  if (!user) {
    return res.status(401).json({
      success: false,
      error:
        'You must be logged in to access this endpoint.'
    });
  }

  req.user = user;

  next();
}

const googleClient =
  new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

const pendingGoogleExchanges =
  new Map();

setInterval(() => {
  const now =
    Date.now();

  for (
    const [
      code,
      data
    ] of pendingGoogleExchanges
  ) {
    if (
      data.expiresAt <=
      now
    ) {
      pendingGoogleExchanges.delete(
        code
      );
    }
  }
}, 60 * 1000);

app.get(
  '/api/auth/google',
  (req, res) => {
    try {
      if (
        !process.env.GOOGLE_CLIENT_ID ||
        !process.env.GOOGLE_CLIENT_SECRET ||
        !process.env.GOOGLE_REDIRECT_URI
      ) {
        return res.status(500).json({
          success: false,
          error:
            'Google OAuth is not configured on the server.'
        });
      }

      const authUrl =
        googleClient.generateAuthUrl(
          {
            access_type:
              'online',

            scope: [
              'openid',
              'email',
              'profile'
            ],

            prompt:
              'select_account'
          }
        );

      res.redirect(
        authUrl
      );
    } catch (error) {
      console.error(
        'Google login start error:',
        error
      );

      res.status(500).json({
        success: false,
        error:
          'Could not start Google sign-in.'
      });
    }
  }
);

app.get(
  '/api/auth/google/callback',
  async (
    req,
    res
  ) => {
    try {
      const {
        code
      } = req.query;

      if (!code) {
        return res.redirect(
          `${CLIENT_URL}/?auth_error=${encodeURIComponent(
            'Google did not return an authorization code.'
          )}`
        );
      }

      const {
        tokens
      } =
        await googleClient.getToken(
          code
        );

      if (
        !tokens.id_token
      ) {
        throw new Error(
          'Google did not provide an ID token.'
        );
      }

      const ticket =
        await googleClient.verifyIdToken(
          {
            idToken:
              tokens.id_token,

            audience:
              process.env.GOOGLE_CLIENT_ID
          }
        );

      const payload =
        ticket.getPayload();

      if (
        !payload ||
        !payload.email
      ) {
        throw new Error(
          'Google did not provide an email address.'
        );
      }

      if (
        payload.email_verified !==
        true
      ) {
        throw new Error(
          'Your Google email is not verified.'
        );
      }

      const email =
        payload.email
          .toLowerCase()
          .trim();

      const googleId =
        payload.sub;

      let users =
        readJson(
          usersFile,
          []
        );

      let user =
        users.find(
          existingUser =>
            existingUser.googleId ===
              googleId ||
            existingUser.email ===
              email
        );

      if (user) {

        user.googleId =
          googleId;

        user.name =
          payload.name ||
          user.name ||
          email.split('@')[0];

        user.picture =
          payload.picture ||
          user.picture ||
          null;

        user.provider =
          'google';
      } else {
        user = {
          id:
            `user_${randomUUID()}`,

          email,

          passwordHash:
            null,

          googleId,

          name:
            payload.name ||
            email.split('@')[0],

          picture:
            payload.picture ||
            null,

          provider:
            'google',

          createdAt:
            new Date().toISOString()
        };

        users.push(
          user
        );
      }

      writeJson(
        usersFile,
        users
      );

      const token =
        createToken(
          user
        );

      const exchangeCode =
        randomUUID();

      pendingGoogleExchanges.set(
        exchangeCode,
        {
          token,

          userId:
            user.id,

          expiresAt:
            Date.now() +
            60 * 1000
        }
      );

      res.redirect(
        `${CLIENT_URL}/?auth_code=${encodeURIComponent(
          exchangeCode
        )}`
      );
    } catch (error) {
      console.error(
        'Google OAuth callback error:',
        error
      );

      res.redirect(
        `${CLIENT_URL}/?auth_error=${encodeURIComponent(
          error?.message ||
            'Google sign-in failed.'
        )}`
      );
    }
  }
);

app.post(
  '/api/auth/google/exchange',
  (req, res) => {
    try {
      const {
        code
      } =
        req.body || {};

      if (!code) {
        return res.status(400).json({
          success: false,
          error:
            'Missing Google authentication code.'
        });
      }

      const pending =
        pendingGoogleExchanges.get(
          code
        );

      if (!pending) {
        return res.status(400).json({
          success: false,
          error:
            'This Google authentication code is invalid or has already been used.'
        });
      }

      pendingGoogleExchanges.delete(
        code
      );

      if (
        Date.now() >
        pending.expiresAt
      ) {
        return res.status(400).json({
          success: false,
          error:
            'This Google authentication code has expired.'
        });
      }

      const users =
        readJson(
          usersFile,
          []
        );

      const user =
        users.find(
          existingUser =>
            existingUser.id ===
            pending.userId
        );

      if (!user) {
        return res.status(404).json({
          success: false,
          error:
            'User account could not be found.'
        });
      }

      res.json({
        success: true,
        token:
          pending.token,
        user:
          safeUser(user)
      });
    } catch (error) {
      console.error(
        'Google exchange error:',
        error
      );

      res.status(500).json({
        success: false,
        error:
          'Could not complete Google sign-in.'
      });
    }
  }
);

app.post(
  '/api/auth/signup',
  async (
    req,
    res
  ) => {
    try {
      const {
        email,
        password,
        name
      } =
        req.body || {};

      const normalizedEmail =
        safeString(email)
          .trim()
          .toLowerCase();

      if (
        !normalizedEmail ||
        !normalizedEmail.includes(
          '@'
        )
      ) {
        return res.status(400).json({
          success: false,
          error:
            'Please enter a valid email address.'
        });
      }

      if (
        !password ||
        password.length < 8
      ) {
        return res.status(400).json({
          success: false,
          error:
            'Password must be at least 8 characters.'
        });
      }

      let users =
        readJson(
          usersFile,
          []
        );

      const existingUser =
        users.find(
          user =>
            user.email ===
            normalizedEmail
        );

      if (existingUser) {
        if (
          existingUser.provider ===
            'google' &&
          !existingUser.passwordHash
        ) {
          return res.status(409).json({
            success: false,
            error:
              'This email is already connected to Google. Please continue with Google.'
          });
        }

        return res.status(409).json({
          success: false,
          error:
            'An account with this email already exists.'
        });
      }

      const passwordHash =
        await bcrypt.hash(
          password,
          12
        );

      const user = {
        id:
          `user_${randomUUID()}`,

        email:
          normalizedEmail,

        passwordHash,

        googleId:
          null,

        name:
          safeString(name)
            .trim() ||
          normalizedEmail.split(
            '@'
          )[0],

        picture:
          null,

        provider:
          'local',

        createdAt:
          new Date().toISOString()
      };

      users.push(
        user
      );

      writeJson(
        usersFile,
        users
      );

      const token =
        createToken(
          user
        );

      res.status(201).json({
        success: true,
        token,
        user:
          safeUser(user)
      });
    } catch (error) {
      console.error(
        'Signup error:',
        error
      );

      res.status(500).json({
        success: false,
        error:
          error?.message ||
          'Could not create your account.'
      });
    }
  }
);

app.post(
  '/api/auth/login',
  async (
    req,
    res
  ) => {
    try {
      const {
        email,
        password
      } =
        req.body || {};

      const normalizedEmail =
        safeString(email)
          .trim()
          .toLowerCase();

      const users =
        readJson(
          usersFile,
          []
        );

      const user =
        users.find(
          existingUser =>
            existingUser.email ===
            normalizedEmail
        );

      if (!user) {
        return res.status(401).json({
          success: false,
          error:
            'Incorrect email or password.'
        });
      }

      if (
        !user.passwordHash
      ) {
        return res.status(401).json({
          success: false,
          error:
            'This account uses Google sign-in. Please continue with Google.'
        });
      }

      const valid =
        await bcrypt.compare(
          password || '',
          user.passwordHash
        );

      if (!valid) {
        return res.status(401).json({
          success: false,
          error:
            'Incorrect email or password.'
        });
      }

      const token =
        createToken(
          user
        );

      res.json({
        success: true,
        token,
        user:
          safeUser(user)
      });
    } catch (error) {
      console.error(
        'Login error:',
        error
      );

      res.status(500).json({
        success: false,
        error:
          'Could not log you in.'
      });
    }
  }
);

app.get(
  '/api/auth/me',
  requireAuth,
  (req, res) => {
    res.json({
      success: true,
      user:
        safeUser(
          req.user
        )
    });
  }
);

app.get(
  '/api/history',
  requireAuth,
  (req, res) => {
    try {
      const history =
        readJson(
          historyFile,
          {}
        );

      res.json({
        success: true,

        history:
          Array.isArray(
            history[
              req.user.id
            ]
          )
            ? history[
                req.user.id
              ]
            : []
      });
    } catch (error) {
      console.error(
        'History load error:',
        error
      );

      res.status(500).json({
        success: false,
        error:
          'Could not load account history.'
      });
    }
  }
);

app.post(
  '/api/history/save',
  requireAuth,
  (req, res) => {
    try {
      const {
        report
      } =
        req.body || {};

      if (
        !report ||
        typeof report !==
          'object'
      ) {
        return res.status(400).json({
          success: false,
          error:
            'A report is required.'
        });
      }

      const history =
        readJson(
          historyFile,
          {}
        );

      if (
        !Array.isArray(
          history[
            req.user.id
          ]
        )
      ) {
        history[
          req.user.id
        ] = [];
      }

      const entry = {
        id:
          `report_${randomUUID()}`,

        savedAt:
          new Date().toISOString(),

        report
      };

      history[
        req.user.id
      ].unshift(
        entry
      );

      history[
        req.user.id
      ] =
        history[
          req.user.id
        ].slice(
          0,
          50
        );

      writeJson(
        historyFile,
        history
      );

      res.status(201).json({
        success: true,
        entry
      });
    } catch (error) {
      console.error(
        'History save error:',
        error
      );

      res.status(500).json({
        success: false,
        error:
          'Could not save the report.'
      });
    }
  }
);

app.get(
  '/api/health',
  (req, res) => {
    res.json({
      status:
        'healthy',

      timestamp:
        new Date().toISOString()
    });
  }
);

app.post(
  '/api/adaptive-question',
  async (
    req,
    res
  ) => {
    try {
      const {
        title,
        description,
        context,
        previousAnswers,
        questionNumber = 1,
        maxQuestions = 6
      } =
        req.body || {};

      if (!description) {
        return res.status(400).json({
          success: false,
          error:
            'A situation or prompt is required.'
        });
      }

      if (
        !process.env.GROQ_API_KEY
      ) {
        return res.status(500).json({
          success: false,
          error:
            'GROQ_API_KEY is not configured in the server environment.'
        });
      }

      const answers =
        previousAnswers &&
        typeof previousAnswers ===
          'object'
          ? previousAnswers
          : {};

      const answerText =
        Object.keys(
          answers
        ).length > 0
          ? JSON.stringify(
              answers,
              null,
              2
            )
          : 'No previous answers yet.';

      const systemPrompt = `
You are Verlo, an adaptive decision-support questionnaire engine.

Your job is to ask ONE useful follow-up question at a time.

The questionnaire must adapt to the user's original situation and to every answer they have already provided.

Rules:

1. Ask exactly ONE question.
2. Do not ask generic questions if the situation provides enough detail to ask something more specific.
3. Do not repeat information that the user has already given.
4. Use previous answers to decide what the next question should investigate.
5. Focus on information that would materially change the eventual analysis or next steps.
6. Start broad enough to understand the situation, then become increasingly specific.
7. If a multiple-choice question would make the answer easier, use MCQ.
8. Otherwise use a short text question.
9. Do not provide the final solution yet.
10. Do not ask several questions in one question.
11. Keep questions clear and easy to answer.
12. Never invent facts about the user's situation.

Return ONLY valid JSON.

For a text question:

{
  "id": "adaptive-question-number",
  "type": "text",
  "question": "The question"
}

For a multiple-choice question:

{
  "id": "adaptive-question-number",
  "type": "mcq",
  "stem": "The question",
  "question": "The question",
  "choices": [
    "Option 1",
    "Option 2",
    "Option 3",
    "Option 4"
  ]
}

Question ${questionNumber} of approximately ${maxQuestions}.
`;

      const userPrompt = `
Category/title:
${safeString(title) || 'General'}

Original situation:
${safeString(description)}

Additional context:
${safeString(context) || 'None provided'}

Previous adaptive answers:
${answerText}

Generate the next single adaptive question.
`;

      const completion =
        await groq.chat.completions.create(
          {
            model:
              'openai/gpt-oss-120b',

            temperature:
              0.35,

            messages: [
              {
                role:
                  'system',

                content:
                  systemPrompt
              },

              {
                role:
                  'user',

                content:
                  userPrompt
              }
            ]
          }
        );

      const raw =
        completion
          .choices?.[0]
          ?.message
          ?.content ||
        '';

      const parsed =
        cleanJson(
          raw
        );

      if (!parsed) {
        return res.status(500).json({
          success: false,
          error:
            'The AI returned an invalid adaptive question.'
        });
      }

      const question =
        normaliseQuestion(
          parsed,
          questionNumber
        );

      res.json({
        success: true,
        question,
        questionNumber,
        maxQuestions
      });
    } catch (error) {
      console.error(
        'Adaptive question error:',
        error
      );

      res.status(500).json({
        success: false,
        error:
          error?.message ||
          'Failed to generate adaptive question.'
      });
    }
  }
);

app.post(
  '/api/analyze',
  upload.array('files'),
  async (
    req,
    res
  ) => {
    try {
      const {
        prompt,
        title,
        category,
        context,
        answers
      } =
        req.body || {};

      if (!prompt) {
        return res.status(400).json({
          success: false,
          error:
            'A situation or prompt is required.'
        });
      }

      if (
        !process.env.GROQ_API_KEY
      ) {
        return res.status(500).json({
          success: false,
          error:
            'GROQ_API_KEY is not configured in the server environment.'
        });
      }

      let parsedAnswers =
        {};

      try {
        if (
          typeof answers ===
          'string'
        ) {
          parsedAnswers =
            JSON.parse(
              answers
            );
        } else if (
          answers &&
          typeof answers ===
            'object'
        ) {
          parsedAnswers =
            answers;
        }
      } catch (error) {
        console.warn(
          'Could not parse adaptive answers:',
          error
        );
      }

      const files =
        req.files
          ? req.files.map(
              file => ({
                name:
                  file.originalname,

                size:
                  (
                    file.size /
                    (1024 * 1024)
                  ).toFixed(2) +
                  ' MB',

                path:
                  file.path
              })
            )
          : [];

      const adaptiveContext =
        Object.keys(
          parsedAnswers
        ).length > 0
          ? `
Adaptive questionnaire responses:

${JSON.stringify(
  parsedAnswers,
  null,
  2
)}
`
          : '';

      const fileContext =
        files.length > 0
          ? `
Uploaded files:

${JSON.stringify(
  files.map(
    file => ({
      name:
        file.name,

      size:
        file.size
    })
  ),
  null,
  2
)}
`
          : '';

      const systemPrompt = `
You are Verlo, an advanced decision-support and rights-analysis assistant.

Analyse the user's situation using the original prompt, context, and adaptive questionnaire answers.

The questionnaire answers are especially important because they were generated specifically for this situation.

Your response must be factual, practical, structured and personalised.

Do not invent facts.

If important information is missing, clearly say that it is not established.

Do not present uncertain legal, financial, medical or other professional conclusions as certain.

Return ONLY valid JSON matching this exact structure:

{
  "situation": "Brief factual summary of the situation",

  "confidence": "High",

  "riskAssessment": {
    "severityScore": "N/A",
    "financialExposure": "Not established",
    "timeSensitivity": "Brief description"
  },

  "nextSteps": [
    {
      "step": "Specific action",
      "why": "Why this action matters"
    }
  ],

  "personalizedPanels": [
    {
      "panelTitle": "Short title",
      "insight": "Useful insight based on the answers",
      "solution": "Practical next action"
    }
  ],

  "draftTemplate": {
    "recipient": "",
    "subject": "Subject",
    "body": "Short adaptable message"
  },

  "resources": [
    {
      "title": "Resource name or type",
      "description": "Why this resource may help",
      "url": ""
    }
  ]
}

Rules for the JSON:

- confidence must be exactly one of:
  "High"
  "Moderate"
  "Low"

- severityScore must be a number from 1 to 10 only when a meaningful severity assessment can reasonably be made. Otherwise use "N/A".

- financialExposure must be a short factual estimate only when supported by the information provided. Otherwise use "Not established".

- nextSteps should contain practical actions relevant to the actual situation.

- personalizedPanels should be based on the user's actual answers.

- Do not create generic filler panels.

- draftTemplate should only be included when a useful message could reasonably help.

- resources should only include resources that are genuinely relevant.

- Do not invent URLs. If you do not know a reliable URL, leave it blank.

- Keep the output concise enough for a web application.
`;

      const userPrompt = `
Category:
${safeString(
  category ||
  title ||
  'General'
)}

Original situation:
${safeString(prompt)}

Additional context:
${safeString(context) || 'None provided'}

${adaptiveContext}

${fileContext}

Generate the final personalised analysis.
`;

      const completion =
        await groq.chat.completions.create(
          {
            model:
              'openai/gpt-oss-120b',

            temperature:
              0.3,

            messages: [
              {
                role:
                  'system',

                content:
                  systemPrompt
              },

              {
                role:
                  'user',

                content:
                  userPrompt
              }
            ]
          }
        );

      const raw =
        completion
          .choices?.[0]
          ?.message
          ?.content ||
        '';

      const parsed =
        cleanJson(
          raw
        );

      if (!parsed) {
        return res.json({
          success: true,

          analysis:
            raw,

          result: {
            situation:
              'The AI returned an unstructured analysis.',

            confidence:
              'Low',

            riskAssessment: {
              severityScore:
                'N/A',

              financialExposure:
                'Not established',

              timeSensitivity:
                'Review the generated analysis for relevant deadlines.'
            },

            nextSteps: [
              {
                step:
                  'Review the analysis and identify the actions that directly apply to your situation.',

                why:
                  'The response could not be converted into the structured application format.'
              }
            ],

            personalizedPanels:
              [],

            draftTemplate: {
              recipient:
                '',

              subject:
                '',

              body:
                ''
            },

            resources:
              []
          },

          filesProcessed:
            files
        });
      }

      res.json({
        success: true,

        analysis:
          raw,

        result:
          parsed,

        filesProcessed:
          files
      });
    } catch (error) {
      console.error(
        'AI analysis error:',
        error
      );

      res.status(500).json({
        success: false,
        error:
          error?.message ||
          'Failed to analyse the situation.'
      });
    }
  }
);

app.post(
  '/api/chat',
  async (
    req,
    res
  ) => {
    try {
      const {
        question,
        currentSituation,
        attachment
      } =
        req.body || {};

      if (
        !question &&
        !attachment
      ) {
        return res.status(400).json({
          success: false,
          error:
            'A question is required.'
        });
      }

      if (
        !process.env.GROQ_API_KEY
      ) {
        return res.status(500).json({
          success: false,
          error:
            'GROQ_API_KEY is not configured.'
        });
      }

      const systemPrompt = `
You are Verlo's follow-up assistant.

Help the user understand the personalised analysis they just received.

Be clear, concise and practical.

Use the information supplied by the user.

Do not invent missing facts.

If the topic involves law, medicine, finance, safety or another professional field, explain uncertainty clearly and avoid presenting yourself as a professional.

Answer the user's actual question rather than restarting the entire analysis.
`;

      const userPrompt = `
Current situation:

${safeString(
  currentSituation
) || 'Not provided'}

User question:

${safeString(
  question
)}

Attachment information:

${
  attachment
    ? JSON.stringify(
        attachment,
        null,
        2
      )
    : 'None'
}
`;

      const completion =
        await groq.chat.completions.create(
          {
            model:
              'openai/gpt-oss-120b',

            temperature:
              0.35,

            messages: [
              {
                role:
                  'system',

                content:
                  systemPrompt
              },

              {
                role:
                  'user',

                content:
                  userPrompt
              }
            ]
          }
        );

      const reply =
        completion
          .choices?.[0]
          ?.message
          ?.content ||
        'I could not generate a response right now.';

      res.json({
        success: true,
        reply
      });
    } catch (error) {
      console.error(
        'Chat error:',
        error
      );

      res.status(500).json({
        success: false,
        error:
          error?.message ||
          'Failed to answer the question.'
      });
    }
  }
);

app.post(
  '/api/assess',
  async (
    req,
    res
  ) => {
    try {
      const {
        title,
        description,
        attachment
      } =
        req.body || {};

      if (!description) {
        return res.status(400).json({
          success: false,
          error:
            'A description is required.'
        });
      }

      if (
        !process.env.GROQ_API_KEY
      ) {
        return res.status(500).json({
          success: false,
          error:
            'GROQ_API_KEY is not configured.'
        });
      }

      const prompt = `
Create a short adaptive questionnaire for this situation.

Category:
${safeString(title)}

Situation:
${safeString(description)}

Return ONLY JSON:

{
  "adaptiveQuestions": [
    {
      "id": "question-1",
      "type": "text",
      "question": "Question"
    }
  ]
}

Create between 4 and 6 useful questions.

The questions must be specific to the situation rather than generic.
`;

      const completion =
        await groq.chat.completions.create(
          {
            model:
              'openai/gpt-oss-120b',

            temperature:
              0.35,

            messages: [
              {
                role:
                  'system',

                content:
                  'You create adaptive questionnaires. Return only valid JSON.'
              },

              {
                role:
                  'user',

                content:
                  prompt
              }
            ]
          }
        );

      const raw =
        completion
          .choices?.[0]
          ?.message
          ?.content ||
        '';

      const parsed =
        cleanJson(
          raw
        );

      if (!parsed) {
        return res.status(500).json({
          success: false,
          error:
            'Could not parse questionnaire.'
        });
      }

      res.json({
        success: true,

        data: {
          adaptiveQuestions:
            Array.isArray(
              parsed.adaptiveQuestions
            )
              ? parsed.adaptiveQuestions
              : []
        }
      });
    } catch (error) {
      console.error(
        'Assessment error:',
        error
      );

      res.status(500).json({
        success: false,
        error:
          error?.message ||
          'Failed to create assessment.'
      });
    }
  }
);

/*
==================================================
404
==================================================
*/

app.use(
  (req, res) => {
    res.status(404).json({
      success: false,

      error:
        `Endpoint ${req.method} ${req.originalUrl} was not found.`
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
      'Server error:',
      error
    );

    if (
      res.headersSent
    ) {
      return next(
        error
      );
    }

    res.status(500).json({
      success: false,

      error:
        error?.message ||
        'Internal server error.'
    });
  }
);

app.listen(
  PORT,
  () => {
    console.log('');
    console.log(
      '======================================'
    );
    console.log(
      'VERLO SERVER'
    );
    console.log(
      '======================================'
    );

    console.log(
      `Server: http://127.0.0.1:${PORT}`
    );

    console.log(
      `Health: http://127.0.0.1:${PORT}/api/health`
    );

    console.log('');

    console.log(
      'AUTH'
    );

    console.log(
      'Google: GET /api/auth/google'
    );

    console.log(
      'Login: POST /api/auth/login'
    );

    console.log(
      'Signup: POST /api/auth/signup'
    );

    console.log(
      'Current user: GET /api/auth/me'
    );

    console.log('');

    console.log(
      'AI'
    );

    console.log(
      'Adaptive: POST /api/adaptive-question'
    );

    console.log(
      'Analysis: POST /api/analyze'
    );

    console.log(
      'Chat: POST /api/chat'
    );

    console.log(
      'Assessment: POST /api/assess'
    );

    console.log('');

    console.log(
      'HISTORY'
    );

    console.log(
      'GET /api/history'
    );

    console.log(
      'POST /api/history/save'
    );

    console.log(
      '======================================'
    );

    console.log('');

    if (!JWT_SECRET) {
      console.warn(
        'WARNING: JWT_SECRET is not configured.'
      );
    }

    if (
      !process.env.GOOGLE_CLIENT_ID
    ) {
      console.warn(
        'WARNING: GOOGLE_CLIENT_ID is not configured.'
      );
    }

    if (
      !process.env.GOOGLE_CLIENT_SECRET
    ) {
      console.warn(
        'WARNING: GOOGLE_CLIENT_SECRET is not configured.'
      );
    }

    if (
      !process.env.GOOGLE_REDIRECT_URI
    ) {
      console.warn(
        'WARNING: GOOGLE_REDIRECT_URI is not configured.'
      );
    }
  }
);