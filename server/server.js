import express from 'express';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
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
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    "HTTP-Referer": "https://verlo-ai.local",
    "X-Title": "Verlo Decision Intelligence"
  }
});

const DB_PATH = path.resolve(__dirname, 'verlo.db');
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error opening SQLite database:', err.message);
  } else {
    console.log('Connected to SQLite Relational Database (verlo.db)');
    initDatabase();
  }
});

function initDatabase() {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS history (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      timestamp DATETIME NOT NULL,
      report_data TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    const defaultSalt = 'a1b2c3d4e5f67890';
    const { hash: defaultHash } = hashPassword('password123', defaultSalt);
    
    db.run(`INSERT OR IGNORE INTO users (id, email, salt, password_hash) VALUES (?, ?, ?, ?)`,
      ['user_demo_123', 'demo@verlo.com', defaultSalt, defaultHash],
      (err) => {
        if (!err) console.log('Secure demo account ready: demo@verlo.com / password123');
      }
    );
  });
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return { salt, hash };
}

function verifyPassword(password, storedSalt, storedHash) {
  const { hash } = hashPassword(password, storedSalt);
  return hash === storedHash;
}

let restrictedWords = [];

function loadModerationRules() {
  try {
    const moderationPath = path.resolve(__dirname, 'moderation.json');
    if (fs.existsSync(moderationPath)) {
      const rawData = fs.readFileSync(moderationPath, 'utf8');
      const parsed = JSON.parse(rawData);
      if (Array.isArray(parsed)) restrictedWords = parsed;
      else if (parsed.blacklisted_words) restrictedWords = parsed.blacklisted_words;
      console.log(`Successfully loaded ${restrictedWords.length} restricted terms.`);
    }
  } catch (err) {
    console.error('Failed to load moderation rules:', err);
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

  const cleanEmail = email.trim().toLowerCase();
  const userId = 'user_' + Date.now();
  const { salt, hash } = hashPassword(password);

  db.run(`INSERT INTO users (id, email, salt, password_hash) VALUES (?, ?, ?, ?)`,
    [userId, cleanEmail, salt, hash],
    function (err) {
      if (err) {
        return res.status(400).json({ error: 'An account with this email address already exists.' });
      }
      res.json({ success: true, message: 'Account successfully created and encrypted in SQL!', user: { id: userId, email: cleanEmail } });
    }
  );
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const cleanEmail = email.trim().toLowerCase();

  db.get(`SELECT * FROM users WHERE email = ?`, [cleanEmail], (err, user) => {
    if (err || !user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const isValid = verifyPassword(password, user.salt, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    res.json({ success: true, user: { id: user.id, email: user.email } });
  });
});

app.get('/api/history/:userId', (req, res) => {
  const { userId } = req.params;
  
  db.all(`SELECT id, timestamp, report_data FROM history WHERE user_id = ? ORDER BY timestamp DESC`, [userId], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Database read error.' });
    }
    const history = rows.map(row => ({
      id: row.id,
      timestamp: row.timestamp,
      ...JSON.parse(row.report_data)
    }));
    res.json({ history });
  });
});

app.post('/api/history/save', (req, res) => {
  const { userId, report } = req.body;
  if (!userId || !report) {
    return res.status(400).json({ error: 'Missing userId or report data.' });
  }

  const reportId = Date.now().toString();
  const timestamp = new Date().toISOString();
  const reportString = JSON.stringify(report);

  db.run(`INSERT INTO history (id, user_id, timestamp, report_data) VALUES (?, ?, ?, ?)`,
    [reportId, userId, timestamp, reportString],
    function (err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to save report to database.' });
      }
      
      db.all(`SELECT id, timestamp, report_data FROM history WHERE user_id = ? ORDER BY timestamp DESC`, [userId], (err, rows) => {
        const history = rows.map(row => ({
          id: row.id,
          timestamp: row.timestamp,
          ...JSON.parse(row.report_data)
        }));
        res.json({ success: true, message: 'Report saved to SQL database!', history });
      });
    }
  );
});

app.post('/api/diagnose', async (req, res) => {
  try {
    const { title, description, context } = req.body;

    if (!description || description.trim().length < 2) {
      return res.status(400).json({ error: 'Description is too short.' });
    }

    const textToCheck = `${title || ''} ${description} ${context || ''}`;
    if (containsRestrictedContent(textToCheck)) {
      return res.status(400).json({ error: 'Verlo Engine Safety Policy: Input contains restricted terms.' });
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
      model: 'google/gemma-4-31b-it:free', 
      temperature: 0.2,
      max_tokens: 1500,
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
      return res.status(400).json({ error: 'Verlo Engine Safety Policy: Terminology restricted.' });
    }

    const chatCompletion = await ai.chat.completions.create({
      messages: [
        { 
          role: 'system', 
          content: `You are Verlo, an expert decision intelligence assistant. Provide sharp, structured, direct guidance based on context: "${currentSituation || 'General inquiry'}"` 
        },
        { role: 'user', content: question }
      ],
      model: 'google/gemma-4-31b-it:free',
      temperature: 0.4,
      max_tokens: 1000
    });

    const contextualAnswer = chatCompletion.choices[0]?.message?.content || 'No response generated.';
    res.json({ reply: contextualAnswer });
  } catch (error) {
    console.error('Chat API Error:', error);
    res.status(500).json({ error: `Chat Error: ${error.message}` });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`VERLO running on port ${PORT} via OpenRouter`);
});