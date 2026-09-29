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

app.post('/api/diagnose', async (req, res) => {
  try {
    const { title, description, context } = req.body;

    if (!description || description.trim().split(/\s+/).length < 2) {
      return res.status(400).json({ error: 'Please provide a detailed description (at least a few words).' });
    }

    const systemPrompt = `You are VERLO, an ethical decision-intelligence and strategic action engine. 
Analyze the user's situation and return a STRICTLY VALID JSON object (no markdown formatting, no extra text outside the JSON) with the following structure:
{
  "confidence": "High" | "Medium" | "Low",
  "riskAssessment": {
    "severityScore": number (1-10),
    "financialExposure": "string describing potential cost or loss",
    "timeSensitivity": "string describing urgency"
  },
  "situation": "A concise, professional 1-2 sentence summary of the core issue.",
  "nextSteps": [
    {
      "step": "Action title",
      "why": "Explanation of why this is necessary",
      "pitfallWarning": "What to avoid during this step"
    }
  ],
  "options": [
    {
      "title": "Alternative strategic choice",
      "bestFor": "When this option makes sense"
    }
  ],
  "verificationNeeded": ["Item 1 to check/verify", "Item 2"],
  "draftTemplate": {
    "recipient": "Target recipient (e.g., Customer Support, Landlord)",
    "subject": "Clear, formal subject line",
    "body": "Formal letter template body with placeholders like [Date] if needed."
  }
}
Ensure all keys, quotes, and brackets are valid JSON. Do not include trailing commas or markdown code blocks.`;

    const userPrompt = `Title: ${title || 'Untitled Situation'}
Description: ${description}
Personal Context / Constraints: ${context || 'None provided'}`;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' }
    });

    let rawContent = completion.choices[0]?.message?.content;
    if (!rawContent) {
      throw new Error('Empty response received from Groq LLM.');
    }

    rawContent = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();

    let parsedData;
    try {
      parsedData = JSON.parse(rawContent);
    } catch (parseError) {
      console.error('JSON Parse Error. Raw content was:', rawContent);
      return res.status(500).json({ 
        error: 'Engine generated malformed JSON. Please try submitting again.',
        details: parseError.message 
      });
    }

    res.json({ success: true, data: parsedData });
  } catch (err) {
    console.error('Diagnosis error:', err);
    res.status(500).json({ error: err.message || 'Internal server error during analysis.' });
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    const { question, currentSituation } = req.body;
    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    const chatCompletion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { 
          role: 'system', 
          content: `You are VERLO AI, an expert decision-intelligence assistant. You are helping a user navigate this situation: "${currentSituation}". Provide concise, highly actionable, and empathetic guidance using clear Markdown formatting.` 
        },
        { role: 'user', content: question }
      ],
      temperature: 0.4
    });

    const reply = chatCompletion.choices[0]?.message?.content || 'No response generated.';
    res.json({ success: true, reply });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate chat response.' });
  }
});

app.post('/api/auth/signup', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  const user = { id: email, email };
  res.json({ success: true, user });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  const user = { id: email, email };
  res.json({ success: true, user });
});

app.get('/api/history/:userId', (req, res) => {
  const { userId } = req.params;
  const history = inMemoryHistory[userId] || [];
  res.json({ success: true, history });
});

app.post('/api/history/save', (req, res) => {
  const { userId, report } = req.body;
  if (!userId || !report) {
    return res.status(400).json({ error: 'userId and report are required' });
  }
  if (!inMemoryHistory[userId]) {
    inMemoryHistory[userId] = [];
  }
  const newEntry = { ...report, timestamp: new Date().toISOString() };
  inMemoryHistory[userId].unshift(newEntry);
  res.json({ success: true, history: inMemoryHistory[userId] });
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`VERLO backend server running on port ${PORT}`);
});