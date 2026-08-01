import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Groq from 'groq-sdk';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Groq SDK (picks up GROQ_API_KEY from environment variables automatically)
const groq = new Groq();

// --- PERSISTENT FILE DATABASE SETUP (`db.json`) ---
const DB_FILE = path.join(__dirname, 'db.json');

function readDB() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      const initialData = { users: [], history: {} };
      fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
      return initialData;
    }
    const rawData = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(rawData);
  } catch (err) {
    console.error('⚠️ Error reading db.json, returning fallback structure:', err);
    return { users: [], history: {} };
  }
}

function writeDB(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('❌ Error writing to db.json:', err);
  }
}

// Load moderation blacklist from moderation.json safely
let restrictedWords = [];
try {
  const moderationPath = path.join(__dirname, 'moderation.json');
  if (fs.existsSync(moderationPath)) {
    const rawData = fs.readFileSync(moderationPath, 'utf8');
    const parsed = JSON.parse(rawData);
    restrictedWords = Array.isArray(parsed) ? parsed : (parsed.blockedWords || []);
    console.log(`🛡️ Loaded ${restrictedWords.length} restricted terms from moderation.json`);
  } else {
    console.warn('⚠️ moderation.json not found. Proceeding without keyword blacklist.');
  }
} catch (err) {
  console.error('Failed to load moderation.json:', err);
}

// Helper function to check for vulgar/NSFW terms
function containsRestrictedContent(text) {
  if (!text || restrictedWords.length === 0) return false;
  const lowerText = text.toLowerCase();
  return restrictedWords.some(word => {
    const regex = new RegExp(`\\b${word.toLowerCase()}\\b`, 'i');
    return regex.test(lowerText) || lowerText.includes(word.toLowerCase());
  });
}

// --- 1. Authentication Endpoints (Persistent via db.json) ---

app.post('/api/auth/signup', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const db = readDB();
  const cleanEmail = email.trim().toLowerCase();

  const existingUser = db.users.find(u => u.email === cleanEmail);
  if (existingUser) {
    return res.status(400).json({ error: 'An account with this email already exists.' });
  }

  const newUser = { id: 'user_' + Date.now(), email: cleanEmail, password };
  db.users.push(newUser);
  db.history[newUser.id] = [];
  
  writeDB(db);

  res.json({ success: true, user: { id: newUser.id, email: newUser.email } });
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

// --- 2. History Endpoints (Persistent via db.json) ---

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

  res.json({ success: true, history: db.history[userId] });
});

// --- 3. UNIVERSAL DIAGNOSE ENDPOINT (Powered by Groq LLM & Protected by moderation.json) ---
app.post('/api/diagnose', async (req, res) => {
  try {
    const { title, description, context } = req.body;

    if (!description || description.trim().length < 2) {
      return res.status(400).json({ error: 'Description is too short.' });
    }

    // Check moderation filter against title and description
    const textToCheck = `${title || ''} ${description} ${context || ''}`;
    if (containsRestrictedContent(textToCheck)) {
      return res.status(400).json({ 
        error: 'Verlo Engine Safety Policy: Your input contains restricted, vulgar, or NSFW terms and cannot be processed.' 
      });
    }

    // Construct system instructions to prompt Groq to return clean analytical breakdowns
    const systemPrompt = `You are Verlo, an advanced decision intelligence AI engine. 
Analyze the user's dilemma/request and output a strict JSON object with the following keys:
- confidence (string, e.g., "Strong" or "Moderate")
- situation (string summary)
- riskAssessment (object with severityScore number, financialExposure string, timeSensitivity string)
- needsClarification (boolean)
- clarifyingQuestions (array of strings)
- nextSteps (array of objects with "step" and "why")
- knownFacts (array of strings)
- missingInformation (array of strings)
- options (array of objects with "title" and "bestFor")
- draftTemplate (object with "recipient", "subject", "body")
- risks (array of strings)
- verificationNeeded (array of strings)
Return ONLY valid JSON. Do not include markdown code ticks or conversational text outside the JSON.`;

    const userPrompt = `Title: ${title || 'General Dilemma'}
Description: ${description}
Context: ${context || 'None provided'}`;

    // Call Groq LLM Inference via official SDK
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.3,
      response_format: { type: 'json_object' }
    });

    let rawContent = chatCompletion.choices[0]?.message?.content || '{}';
    let normalizedResponse;

    try {
      normalizedResponse = JSON.parse(rawContent);
    } catch (parseErr) {
      console.error('Failed to parse model JSON output:', rawContent);
      normalizedResponse = {
        confidence: 'Strong',
        situation: description,
        riskAssessment: { severityScore: 4, financialExposure: 'Low', timeSensitivity: 'Standard' },
        needsClarification: false,
        clarifyingQuestions: [],
        nextSteps: [{ step: "Evaluate strategy parameters", why: "Ensures targeted execution." }],
        knownFacts: [description],
        missingInformation: [],
        options: [{ title: "Primary Action Route", bestFor: "Immediate progress" }],
        draftTemplate: { recipient: "Self", subject: title || "Action Plan", body: rawContent },
        risks: ["Undefined constraints"],
        verificationNeeded: ["Confirm objective alignment"]
      };
    }

    res.json({ data: normalizedResponse });
  } catch (error) {
    console.error('Diagnose API Error:', error);
    res.status(500).json({ error: 'Internal engine processing error with Groq AI.' });
  }
});

// --- 4. UNIVERSAL CHAT ENDPOINT (Powered by Groq LLM & Protected by moderation.json) ---
app.post('/api/chat', async (req, res) => {
  try {
    const { question, currentSituation } = req.body;

    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    // Check moderation filter against chat questions
    if (containsRestrictedContent(question)) {
      return res.status(400).json({ 
        error: 'Verlo Engine Safety Policy: Chat query contains restricted terminology.' 
      });
    }

    // Call Groq LLM for contextual follow-up chat
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { 
          role: 'system', 
          content: `You are Verlo, an expert decision intelligence assistant. Provide sharp, structured, direct guidance based on the current situation context: "${currentSituation || 'General inquiry'}"` 
        },
        { role: 'user', content: question }
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.5,
    });

    const contextualAnswer = chatCompletion.choices[0]?.message?.content || 'No response generated.';

    res.json({ reply: contextualAnswer });
  } catch (error) {
    console.error('Chat API Error:', error);
    res.status(500).json({ error: 'Failed to process chat follow-up with Groq AI.' });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`Verlo decision engine backend running on http://127.0.0.1:${PORT}`);
});