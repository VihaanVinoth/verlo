import express from 'express';
import cors from 'cors';
import Groq from 'groq-sdk';

const app = express();
app.use(cors());
app.use(express.json());

const client = new Groq({
  apiKey: process.env.GROQ_API_KEY, 
});

const usersDB = new Map();
const historyDB = new Map();

app.post('/api/auth/signup', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (usersDB.has(normalizedEmail)) {
      return res.status(409).json({ error: 'This email address is already registered. Please log in instead.' });
    }

    const newUser = { id: normalizedEmail, email: normalizedEmail, password };
    usersDB.set(normalizedEmail, newUser);
    res.json({ success: true, user: { id: newUser.id, email: newUser.email } });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Internal server error during signup.' });
  }
});
 
app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }
    const normalizedEmail = email.trim().toLowerCase();
    const user = usersDB.get(normalizedEmail);

    if (!user || user.password !== password) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    res.json({ success: true, user: { id: user.id, email: user.email } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error during login.' });
  }
});

app.get('/api/history/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const userHistory = historyDB.get(userId) || [];
    res.json({ success: true, history: userHistory });
  } catch (err) {
    console.error('Fetch history error:', err);
    res.status(500).json({ error: 'Failed to fetch history.' });
  }
});

app.post('/api/history/save', (req, res) => {
  try {
    const { userId, report } = req.body;
    if (!userId || !report) {
      return res.status(400).json({ error: 'UserId and report data are required.' });
    }

    const userHistory = historyDB.get(userId) || [];
    const newEntry = {
      ...report,
      timestamp: new Date().toISOString()
    };
    
    userHistory.unshift(newEntry); 
    historyDB.set(userId, userHistory);

    res.json({ success: true, history: userHistory });
  } catch (err) {
    console.error('Save history error:', err);
    res.status(500).json({ error: 'Failed to save pathway.' });
  }
});

app.post('/api/diagnose', async (req, res) => {
  try {
    const { title, description, context } = req.body;

    if (!description || description.trim().length === 0) {
      return res.status(400).json({ error: 'Situation description is required.' });
    }

    const systemPrompt = `You are VERLO, an advanced ethical decision-intelligence system. 
Analyze the user's situation and return a strictly valid JSON object (no markdown formatting blocks around it, just raw JSON) matching this exact schema:
{
  "confidence": "High" | "Medium" | "Low",
  "riskAssessment": {
    "severityScore": number (1-10),
    "financialExposure": string,
    "timeSensitivity": string
  },
  "situation": string (concise restatement of core problem),
  "nextSteps": [
    {
      "step": string,
      "why": string,
      "pitfallWarning": string
    }
  ],
  "options": [
    {
      "title": string,
      "bestFor": string
    }
  ],
  "verificationNeeded": [string],
  "draftTemplate": {
    "recipient": string,
    "subject": string,
    "body": string
  }
}`;

    const userPrompt = `Situation Title: ${title || 'Untitled'}
Description: ${description}
Personal Context/Constraints: ${context || 'None provided'}`;

    const completion = await client.chat.completions.create({
      model: 'openai/gpt-oss-120b', 
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
      response_format: { type: "json_object" }
    });

    const rawContent = completion.choices[0].message.content;
    const parsedData = JSON.parse(rawContent);

    res.json({ success: true, data: parsedData });
  } catch (error) {
    console.error('Diagnosis error:', error);
    res.status(500).json({ error: 'Failed to compute tailored decision pathway.' });
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    const { question, currentSituation } = req.body;
    if (!question) {
      return res.status(400).json({ error: 'Question is required.' });
    }

    const completion = await client.chat.completions.create({
      model: 'openai/gpt-oss-120b',
      messages: [
        { 
          role: 'system', 
          content: 'You are VERLO AI, an expert strategic assistant helping a user navigate their analyzed dispute or situation. Provide sharp, concise, actionable advice.' 
        },
        { role: 'user', content: `Context Situation: ${currentSituation}\n\nUser Question: ${question}` }
      ],
      temperature: 0.5,
    });

    res.json({ success: true, reply: completion.choices[0].message.content });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Failed to generate chat response.' });
  }
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`VERLO backend server running on port ${PORT}`);
});