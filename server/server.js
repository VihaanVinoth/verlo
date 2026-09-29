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

app.get('/api/profile/:userId', (req, res) => {
  const { userId } = req.params;
  const account = userProfiles[userId];
  if (!account) {
    return res.status(404).json({ error: 'User profile not found.' });
  }
  const { password: _, ...userData } = account;
  res.json({ success: true, profile: userData });
});

app.post('/api/profile/update', (req, res) => {
  const { userId, fullName, tier } = req.body;
  if (!userProfiles[userId]) {
    return res.status(404).json({ error: 'User profile not found.' });
  }
  if (fullName) userProfiles[userId].fullName = fullName;
  if (tier) userProfiles[userId].tier = tier;
  const { password: _, ...updated } = userProfiles[userId];
  res.json({ success: true, profile: updated });
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

app.delete('/api/history/:userId/:reportId', (req, res) => {
  const { userId, reportId } = req.params;
  if (!inMemoryHistory[userId]) {
    return res.status(404).json({ error: 'User history not found.' });
  }
  inMemoryHistory[userId] = inMemoryHistory[userId].filter(item => item.id !== reportId);
  res.json({ success: true, history: inMemoryHistory[userId] });
});

app.post('/api/directives/set', (req, res) => {
  const { userId, directiveKey, directiveValue } = req.body;
  if (!userId || !directiveKey) {
    return res.status(400).json({ error: 'userId and directiveKey are required.' });
  }
  if (!customDirectives[userId]) {
    customDirectives[userId] = {};
  }
  customDirectives[userId][directiveKey] = directiveValue;
  res.json({ success: true, directives: customDirectives[userId] });
});

app.get('/api/directives/:userId', (req, res) => {
  const { userId } = req.params;
  res.json({ success: true, directives: customDirectives[userId] || {} });
});

app.post('/api/kb/contribute', (req, res) => {
  const { topic, content, author } = req.body;
  if (!topic || !content) {
    return res.status(400).json({ error: 'Topic and content are required.' });
  }
  const kbId = `kb_${Date.now()}`;
  systemKnowledgeBase[kbId] = { topic, content, author: author || 'Anonymous', timestamp: new Date().toISOString() };
  res.json({ success: true, kbId, message: 'Knowledge base entry successfully indexed.' });
});

app.get('/api/kb/search', (req, res) => {
  const { q } = req.query;
  const entries = Object.entries(systemKnowledgeBase).map(([id, val]) => ({ id, ...val }));
  if (!q) {
    return res.json({ success: true, results: entries });
  }
  const filtered = entries.filter(e => e.topic.toLowerCase().includes(q.toLowerCase()) || e.content.toLowerCase().includes(q.toLowerCase()));
  res.json({ success: true, results: filtered });
});

app.post('/api/assess', async (req, res) => {
  try {
    const { title, description } = req.body;
    if (!description || description.trim().split(/\s+/).length < 2) {
      return res.status(400).json({ error: 'Please provide a comprehensive situation description.' });
    }

    const systemPrompt = `You are VERLO, an ultra-advanced adaptive decision-intelligence and strategic simulation engine. Analyze the user's initial situation. Determine if there are critical ambiguities, alternative paths, or choices that require clarification, and generate both absolute adaptive questions and structured multiple-choice questions (MCQs) for deep profiling. Return a STRICTLY VALID JSON object with this exact structure:
    {
      "needsClarification": true,
      "adaptiveQuestions": [
        {
          "id": "q1",
          "question": "A precise analytical question to isolate the primary risk vector?",
          "options": [
            "Path Alpha: Aggressive legal / operational pushback",
            "Path Beta: Mediated settlement or phased retreat",
            "Path Gamma: Complete neutral audit and documentation"
          ]
        }
      ],
      "mcqAssessment": [
        {
          "id": "mcq1",
          "stem": "What is the primary operational constraint governing this scenario?",
          "choices": [
            "Strict capital limitations and cash-flow burn",
            "Severe time constraints and looming legal deadlines",
            "Reputational exposure and stakeholder backlash",
            "Technical ambiguity and lack of precedent"
          ],
          "correctIndicator": 1
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

    const systemPrompt = `You are VERLO, an elite ethical decision-intelligence and strategic action engine. Synthesize the user's dilemma, clarifying choices, and MCQ selections into a master strategic blueprint. Return a STRICTLY VALID JSON object with the following exact structure:
{
  "confidence": "High",
  "riskAssessment": {
    "severityScore": 8,
    "financialExposure": "Detailed evaluation of monetary risk exposure",
    "timeSensitivity": "Urgency rating and hard timeline window"
  },
  "situation": "An executive-level summary framing the core systemic issue.",
  "nextSteps": [
    {
      "step": "Tactical action header",
      "why": "Detailed justification of necessity",
      "pitfallWarning": "Critical failure mode or hazard to avoid"
    }
  ],
  "options": [
    {
      "title": "Strategic Alternative Pathway",
      "bestFor": "Specific operational conditions where this excels"
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

    const userPrompt = `Title: ${title || 'Untitled'} Description: ${description} Context: ${context || 'None'} User Answers: ${JSON.stringify(userAnswers || {})} MCQ Answers: ${JSON.stringify(mcqAnswers || {})}`;

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