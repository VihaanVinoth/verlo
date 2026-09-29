import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Groq from 'groq-sdk';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const inMemoryHistory = {};
const userProfiles = {};
const customDirectives = {};
const systemKnowledgeBase = {};

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    engine: 'VERLO Neural Core v4.8 Ultimate',
    environment: process.env.NODE_ENV || 'development'
  });
});

app.post('/api/auth/signup', (req, res) => {
  const { email, password, fullName } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required for registration.' });
  }
  if (userProfiles[email]) {
    return res.status(400).json({ error: 'An account with this email already exists.' });
  }
  const newUser = {
    id: email,
    email,
    fullName: fullName || email.split('@')[0],
    createdAt: new Date().toISOString(),
    tier: 'Enterprise Elite',
    creditsRemaining: 500
  };
  userProfiles[email] = { ...newUser, password };
  inMemoryHistory[email] = [];
  res.json({ success: true, user: newUser });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }
  const account = userProfiles[email];
  if (!account || account.password !== password) {
    return res.status(401).json({ error: 'Invalid email or password combination.' });
  }
  const { password: _, ...userData } = account;
  res.json({ success: true, user: userData });
});

app.get('/api/history/:userId', (req, res) => {
  const { userId } = req.params;
  const history = inMemoryHistory[userId] || [];
  res.json({ success: true, history, count: history.length });
});

app.post('/api/history/save', (req, res) => {
  const { userId, report } = req.body;
  if (!userId || !report) {
    return res.status(400).json({ error: 'userId and report payload are required.' });
  }
  if (!inMemoryHistory[userId]) {
    inMemoryHistory[userId] = [];
  }
  const entry = {
    id: `rep_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    ...report,
    timestamp: new Date().toISOString()
  };
  inMemoryHistory[userId].unshift(entry);
  res.json({ success: true, history: inMemoryHistory[userId], savedId: entry.id });
});

app.post('/api/assess', async (req, res) => {
  try {
    const { title, description } = req.body;
    if (!description || description.trim().split(/\s+/).length < 2) {
      return res.status(400).json({ error: 'Please provide a comprehensive situation description.' });
    }

    const systemPrompt = `You are VERLO, an ultra-advanced adaptive decision-intelligence and strategic simulation engine. Analyze the user's initial situation. Determine critical ambiguities or decision branches that require clarification, and generate both absolute probing questions and structured multiple-choice questions (MCQs) for deep profiling. Return a STRICTLY VALID JSON object with this exact structure:
    {
      "needsClarification": true,
      "adaptiveQuestions": [
        {
          "id": "q1",
          "question": "A precise analytical question to isolate the primary risk vector?"
        }
      ],
      "mcqAssessment": [
        {
          "id": "mcq1",
          "stem": "What is the primary operational or legal constraint governing this scenario?",
          "choices": [
            "Strict capital limitations and cash-flow burn",
            "Severe time constraints and looming legal deadlines",
            "Reputational exposure and stakeholder backlash",
            "Technical ambiguity and lack of precedent"
          ]
        }
      ]
    }
    Ensure response contains absolutely no markdown wrappers like json and is valid raw JSON.`;

    const userPrompt = `Title: ${title || 'Untitled Situation'} Description: ${description}`;
    const completion = await groq.chat.completions.create({
      model: 'openai/gpt-oss-120b',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    });

    let rawContent = completion.choices[0]?.message?.content;
    if (!rawContent) throw new Error('Empty response from inference model.');
    rawContent = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsedData = JSON.parse(rawContent);

    res.json({ success: true, data: parsedData });
  } catch (err) {
    console.error('Assessment pipeline error:', err);
    res.status(500).json({ error: err.message || 'Failed to compute adaptive assessment vector.' });
  }
});

app.post('/api/diagnose', async (req, res) => {
  try {
    const { title, description, context, userAnswers, mcqAnswers } = req.body;

    const systemPrompt = `You are VERLO, an elite ethical decision-intelligence and strategic action engine. Synthesize the user's dilemma, adaptive clarifying choices, and MCQ selections into a master strategic blueprint complete with personalized panels and verified reference links. Return a STRICTLY VALID JSON object with the following exact structure:
{
  "confidence": "High",
  "riskAssessment": {
    "severityScore": 8,
    "financialExposure": "Detailed evaluation of monetary risk exposure",
    "timeSensitivity": "Urgency rating and hard timeline window"
  },
  "situation": "An executive-level summary framing the core systemic issue.",
  "personalizedPanels": [
    {
      "panelTitle": "Targeted Issue Dimension Title",
      "insight": "Deep analysis of this specific facet based on user choices.",
      "solution": "Actionable strategy to resolve this specific dimension."
    }
  ],
  "nextSteps": [
    {
      "step": "Tactical action header",
      "why": "Detailed justification of necessity",
      "pitfallWarning": "Critical failure mode or hazard to avoid"
    }
  ],
  "referenceLinks": [
    {
      "title": "Authoritative Portal or Statute Name",
      "url": "https://www.example.com"
    }
  ],
  "verificationNeeded": ["Audit financial statements", "Verify jurisdictional compliance"],
  "draftTemplate": {
    "recipient": "Target stakeholder or opposing counsel",
    "subject": "Formal definitive subject line",
    "body": "Comprehensive formal communication template with placeholder fields."
  }
}
Return raw valid JSON only without markdown wrapping.`;

    const userPrompt = `Title: ${title || 'Untitled'} Description: ${description} Context: ${context || 'None'} Adaptive Text Answers: ${JSON.stringify(userAnswers || {})} MCQ Answers: ${JSON.stringify(mcqAnswers || {})}`;

    const completion = await groq.chat.completions.create({
      model: 'openai/gpt-oss-120b',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' }
    });

    let rawContent = completion.choices[0]?.message?.content;
    if (!rawContent) throw new Error('Empty diagnosis payload received from model.');
    rawContent = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsedData = JSON.parse(rawContent);

    res.json({ success: true, data: parsedData });
  } catch (err) {
    console.error('Diagnosis pipeline error:', err);
    res.status(500).json({ error: err.message || 'Internal server error during path synthesis.' });
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    const { question, currentSituation } = req.body;
    if (!question) return res.status(400).json({ error: 'Question parameter is required.' });

    const chatCompletion = await groq.chat.completions.create({
      model: 'openai/gpt-oss-120b',
      messages: [
        { 
          role: 'system', 
          content: `You are VERLO AI, an elite strategic intelligence advisor. The active operational situation is: "${currentSituation}". Deliver rigorous, highly authoritative, and actionable guidance.` 
        },
        { role: 'user', content: question }
      ],
      temperature: 0.4
    });

    const reply = chatCompletion.choices[0]?.message?.content || 'No response generated.';
    res.json({ success: true, reply });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: err.message || 'Chat generation failed.' });
  }
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`VERLO Enterprise Neural Core operational on port ${PORT}`);
});