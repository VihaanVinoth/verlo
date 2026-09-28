import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

const ai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: 'https://ai.hackclub.com/proxy/v1',
});

const DB_FILE = path.resolve(__dirname, 'db.json');

function readDB() {
  try {
    const defaultUser = { id: 'user_demo_123', email: 'demo@verlo.com', password: 'password123' };
    if (!fs.existsSync(DB_FILE)) {
      const initialData = { 
        users: [defaultUser], 
        history: { [defaultUser.id]: [] } 
      };
      fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), 'utf8');
      return initialData;
    }
    const rawData = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(rawData);
    
    const users = Array.isArray(parsed.users) && parsed.users.length > 0 ? parsed.users : [defaultUser];
    const history = parsed.history && typeof parsed.history === 'object' ? parsed.history : {};
    if (!history[defaultUser.id]) history[defaultUser.id] = [];

    return { users, history };
  } catch (err) {
    console.error('⚠️ Error reading db.json, returning fallback structure:', err);
    return { 
      users: [{ id: 'user_demo_123', email: 'demo@verlo.com', password: 'password123' }], 
      history: { 'user_demo_123': [] } 
    };
  }
}

function writeDB(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('❌ Error writing to db.json:', err);
  }
}

let restrictedWords = [];

function loadModerationRules() {
  try {
    const moderationPath = path.resolve(__dirname, 'moderation.json');
    if (fs.existsSync(moderationPath)) {
      const rawData = fs.readFileSync(moderationPath, 'utf8');
      const parsed = JSON.parse(rawData);
      
      if (Array.isArray(parsed)) {
        restrictedWords = parsed;
      } else if (parsed.blacklisted_words && Array.isArray(parsed.blacklisted_words)) {
        restrictedWords = parsed.blacklisted_words;
      } else if (parsed.blockedWords && Array.isArray(parsed.blockedWords)) {
        restrictedWords = parsed.blockedWords;
      } else if (parsed.blockedKeywords && Array.isArray(parsed.blockedKeywords)) {
        restrictedWords = parsed.blockedKeywords;
      } else {
        restrictedWords = [];
      }
      console.log(`🛡️ Successfully loaded ${restrictedWords.length} restricted terms from moderation.json`);
    } else {
      console.warn(`⚠️ moderation.json not found at expected path: ${moderationPath}`);
    }
  } catch (err) {
    console.error('❌ Failed to load or parse moderation.json:', err);
  }
}

loadModerationRules();

function containsRestrictedContent(text) {
  if (!text || restrictedWords.length === 0) return false;
  const lowerText = text.toLowerCase();
  return restrictedWords.some(word => {
    if (!word) return false;
    const cleanWord = word.trim().toLowerCase();
    const regex = new RegExp(`\\b${cleanWord}\\b`, 'i');
    return regex.test(lowerText);
  });
}

app.post('/api/auth/signup', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const db = readDB();
  const cleanEmail = email.trim().toLowerCase();

  const existingUser = db.users.find(u => u.email === cleanEmail);
  if (existingUser) {
    return res.status(400).json({ 
      error: 'An account with this email address already exists. Please log in instead.' 
    });
  }

  const newUser = { id: 'user_' + Date.now(), email: cleanEmail, password };
  db.users.push(newUser);
  db.history[newUser.id] = [];
  
  writeDB(db);

  res.json({ success: true, message: 'Account successfully created!', user: { id: newUser.id, email: newUser.email } });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const db = readDB();
  const cleanEmail = email.trim().toLowerCase();
  const user = db.users.find(u => u.email === cleanEmail && u.password === password);

  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  res.json({ success: true, user: { id: user.id, email: user.email } });
});

app.get('/api/history/:userId', (req, res) => {
  const { userId } = req.params;
  const db = readDB();
  const userHistory = db.history[userId] || [];
  res.json({ history: userHistory });
});

app.post('/api/history/save', (req, res) => {
  const { userId, report } = req.body;
  if (!userId || !report) {
    return res.status(400).json({ error: 'Missing userId or report data.' });
  }

  const db = readDB();

  if (!db.history[userId]) {
    db.history[userId] = [];
  }

  db.history[userId].unshift({
    id: Date.now().toString(),
    timestamp: new Date().toISOString(),
    ...report
  });

  writeDB(db);

  res.json({ success: true, message: 'Report successfully saved to your history!', history: db.history[userId] });
});

app.post('/api/diagnose', async (req, res) => {
  try {
    const { title, description, context } = req.body;

    if (!description || description.trim().length < 2) {
      return res.status(400).json({ error: 'Description is too short.' });
    }

    const textToCheck = `${title || ''} ${description} ${context || ''}`;
    if (containsRestrictedContent(textToCheck)) {
      return res.status(400).json({ 
        error: 'Verlo Engine Safety Policy: Your input contains restricted, vulgar, or NSFW terms and cannot be processed.' 
      });
    }

    const systemPrompt = `You are Verlo, an elite enterprise-grade decision intelligence and strategic analysis engine. 
Analyze the user's dilemma with ruthless logic, depth, and structured clarity. Output a strict JSON object with the following keys:
- confidence (string, e.g., "High Conviction", "Calculated Risk", or "High Uncertainty")
- situation (string, a razor-sharp executive summary of the core dilemma)
- riskAssessment (object with severityScore number 1-10, financialExposure string, timeSensitivity string, and "secondOrderRisks" array of strings detailing hidden long-term consequences)
- needsClarification (boolean)
- clarifyingQuestions (array of 2 sharp strategic questions)
- nextSteps (array of objects with "step" and "why", focused on immediate execution)
- knownFacts (array of strings extracted from context)
- missingInformation (array of strings)
- options (array of objects with "title", "bestFor", and "tradeoff" description)
- draftTemplate (object with "recipient", "subject", "body")
- strategicFrameworkApplied (string, e.g., "Game Theory / Cost-Benefit Matrix")
Return ONLY valid JSON. Do not include markdown code ticks or conversational text outside the JSON.`;

    const userPrompt = `Title: ${title || 'General Dilemma'}
Description: ${description}
Context: ${context || 'None provided'}`;

    const chatCompletion = await ai.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      model: 'meta-llama/llama-3.3-70b-instruct',
      temperature: 0.3,
      response_format: { type: 'json_object' }
    });

    let rawContent = chatCompletion.choices[0]?.message?.content || '{}';
    let normalizedResponse;

    try {
      normalizedResponse = JSON.parse(rawContent);
    } catch (parseErr) {
      normalizedResponse = {
        confidence: 'Calculated Risk',
        situation: description,
        riskAssessment: { severityScore: 5, financialExposure: 'Moderate', timeSensitivity: 'Standard', secondOrderRisks: ['Potential timeline drag'] },
        needsClarification: false,
        clarifyingQuestions: ["What are your hard resource constraints?"],
        nextSteps: [{ step: "Execute primary vector", why: "Maximizes velocity." }],
        knownFacts: [description],
        missingInformation: [],
        options: [{ title: "Primary Route", bestFor: "Speed", tradeoff: "Higher resource consumption" }],
        draftTemplate: { recipient: "Stakeholders", subject: title || "Action Plan", body: rawContent },
        strategicFrameworkApplied: "Cost-Benefit Matrix"
      };
    }

    res.json({ data: normalizedResponse });
  } catch (error) {
    console.error('Diagnose API Error:', error);
    res.status(500).json({ error: `AI Processing Error: ${error.message}` });
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    const { question, currentSituation } = req.body;

    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    if (containsRestrictedContent(question)) {
      return res.status(400).json({ 
        error: 'Verlo Engine Safety Policy: Chat query contains restricted terminology.' 
      });
    }

    const chatCompletion = await ai.chat.completions.create({
      messages: [
        { 
          role: 'system', 
          content: `You are Verlo, an expert decision intelligence assistant. Provide sharp, structured, direct guidance based on the current situation context: "${currentSituation || 'General inquiry'}"` 
        },
        { role: 'user', content: question }
      ],
      model: 'meta-llama/llama-3.3-70b-instruct',
      temperature: 0.5,
    });

    const contextualAnswer = chatCompletion.choices[0]?.message?.content || 'No response generated.';
    res.json({ reply: contextualAnswer });
  } catch (error) {
    console.error('Chat API Error:', error);
    res.status(500).json({ error: `Chat Error: ${error.message}` });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`VERLO running on port ${PORT}`);
});