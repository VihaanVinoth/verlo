import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Groq from 'groq-sdk';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5001;

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

app.use(cors());

app.use(
  express.json({
    limit: '2mb'
  })
);

const uploadDir = path.join(__dirname, 'uploads');

fs.mkdirSync(uploadDir, {
  recursive: true
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },

  filename: (req, file, cb) => {
    const uniqueSuffix =
      Date.now() + '-' + Math.round(Math.random() * 1e9);

    cb(
      null,
      uniqueSuffix + '-' + file.originalname
    );
  }
});

const upload = multer({
  storage,

  limits: {
    fileSize: 15 * 1024 * 1024
  }
});

function cleanJson(text) {
  if (!text) {
    return null;
  }

  let cleaned = String(text).trim();

  // Remove markdown code fences
  cleaned = cleaned
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch (error) {
  }

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');

  if (
    firstBrace !== -1 &&
    lastBrace !== -1 &&
    lastBrace > firstBrace
  ) {
    try {
      return JSON.parse(
        cleaned.slice(firstBrace, lastBrace + 1)
      );
    } catch (error) {
    }
  }

  return null;
}

function normaliseQuestion(question, questionNumber) {
  if (!question || typeof question !== 'object') {
    return {
      id: `adaptive-${questionNumber}`,
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
    Array.isArray(question.choices)
  ) {
    normalized.choices =
      question.choices
        .filter(Boolean)
        .slice(0, 6);
  }

  return normalized;
}

function safeString(value) {
  if (value === undefined || value === null) {
    return '';
  }

  return String(value);
}

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});


app.post('/api/adaptive-question', async (req, res) => {
  try {
    const {
      title,
      description,
      context,
      previousAnswers,
      questionNumber = 1,
      maxQuestions = 6
    } = req.body || {};

    if (!description) {
      return res.status(400).json({
        success: false,
        error: 'A situation or prompt is required.'
      });
    }

    if (!process.env.GROQ_API_KEY) {
      return res.status(500).json({
        success: false,
        error:
          'GROQ_API_KEY is not configured in the server environment.'
      });
    }

    const answers =
      previousAnswers &&
      typeof previousAnswers === 'object'
        ? previousAnswers
        : {};

    const answerText =
      Object.keys(answers).length > 0
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
      await groq.chat.completions.create({
        model: 'openai/gpt-oss-120b',

        temperature: 0.35,

        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userPrompt
          }
        ]
      });

    const raw =
      completion.choices?.[0]?.message?.content ||
      '';

    const parsed = cleanJson(raw);

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
});

app.post(
  '/api/analyze',
  upload.array('files'),
  async (req, res) => {
    try {
      const {
        prompt,
        title,
        category,
        context,
        answers
      } = req.body || {};

      if (!prompt) {
        return res.status(400).json({
          success: false,
          error:
            'A situation or prompt is required.'
        });
      }

      if (!process.env.GROQ_API_KEY) {
        return res.status(500).json({
          success: false,
          error:
            'GROQ_API_KEY is not configured in the server environment.'
        });
      }

      let parsedAnswers = {};

      try {
        if (typeof answers === 'string') {
          parsedAnswers =
            JSON.parse(answers);
        } else if (
          answers &&
          typeof answers === 'object'
        ) {
          parsedAnswers = answers;
        }
      } catch (error) {
        console.warn(
          'Could not parse adaptive answers:',
          error
        );
      }

      const files = req.files
        ? req.files.map(file => ({
            name: file.originalname,
            size:
              (
                file.size /
                (1024 * 1024)
              ).toFixed(2) + ' MB',
            path: file.path
          }))
        : [];

      const adaptiveContext =
        Object.keys(parsedAnswers).length > 0
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
  files.map(file => ({
    name: file.name,
    size: file.size
  })),
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
        await groq.chat.completions.create({
          model: 'openai/gpt-oss-120b',

          temperature: 0.3,

          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: userPrompt
            }
          ]
        });

      const raw =
        completion.choices?.[0]?.message?.content ||
        '';

      const parsed =
        cleanJson(raw);

      if (!parsed) {
        return res.json({
          success: true,

          analysis: raw,

          result: {
            situation:
              'The AI returned an unstructured analysis.',

            confidence: 'Low',

            riskAssessment: {
              severityScore: 'N/A',
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

            personalizedPanels: [],

            draftTemplate: {
              recipient: '',
              subject: '',
              body: ''
            },

            resources: []
          },

          filesProcessed: files
        });
      }

      res.json({
        success: true,

        analysis: raw,

        result: parsed,

        filesProcessed: files
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

app.post('/api/assess', async (req, res) => {
  try {
    const {
      title,
      description,
      attachment
    } = req.body || {};

    if (!description) {
      return res.status(400).json({
        success: false,
        error:
          'A description is required.'
      });
    }

    if (!process.env.GROQ_API_KEY) {
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
      await groq.chat.completions.create({
        model: 'openai/gpt-oss-120b',

        temperature: 0.35,

        messages: [
          {
            role: 'system',
            content:
              'You create adaptive questionnaires. Return only valid JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ]
      });

    const raw =
      completion.choices?.[0]?.message?.content ||
      '';

    const parsed =
      cleanJson(raw);

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
});

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
  (error, req, res, next) => {
    console.error(
      'Server error:',
      error
    );

    if (res.headersSent) {
      return next(error);
    }

    res.status(500).json({
      success: false,
      error:
        error?.message ||
        'Internal server error.'
    });
  }
);


app.listen(PORT, () => {
  console.log('');
  console.log('======================================');
  console.log('VERLO SERVER');
  console.log('======================================');
  console.log(`Server: http://127.0.0.1:${PORT}`);
  console.log(`Health: http://127.0.0.1:${PORT}/api/health`);
  console.log('');
  console.log(
    'Adaptive endpoint: POST /api/adaptive-question'
  );
  console.log(
    'Analysis endpoint: POST /api/analyze'
  );
  console.log(
    'Compatibility endpoint: POST /api/assess'
  );
  console.log('======================================');
  console.log('');
});