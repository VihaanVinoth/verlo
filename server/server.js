import express from 'express';
import cors from 'cors';
import initSqlJs from 'sql.js';
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

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY 
});
const MODEL_NAME = process.env.OPENAI_MODEL || 'gpt-4o';

const DB_PATH = path.resolve(__dirname, 'verlo.db');
let db = null;

function saveDatabase() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

async function initializeDatabase() {
  const SQL = await initSqlJs();
  
  if (fs.existsSync(DB_PATH)) {
    const filebuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(filebuffer);
    console.log('Loaded existing SQLite database from disk (verlo.db)');
  } else {
    db = new SQL.Database();
    console.log('Created new SQLite database (verlo.db)');
  }

  db.run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    salt TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );`);

  db.run(`CREATE TABLE IF NOT EXISTS history (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    timestamp DATETIME NOT NULL,
    report_data TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );`);

  const defaultSalt = 'a1b2c3d4e5f67890';
  const { hash: defaultHash } = hashPassword('password123', defaultSalt);
  
  try {
    db.run(`INSERT OR IGNORE INTO users (id, email, salt, password_hash) VALUES (?, ?, ?, ?)`,
      ['user_demo_123', 'demo@verlo.com', defaultSalt, defaultHash]
    );
    saveDatabase();
    console.log('Secure demo account ready: demo@verlo.com / password123');
  } catch (e) {
    console.error('Demo user init error:', e);
  }
}

initializeDatabase();

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

  try {
    const stmt = db.prepare(`INSERT INTO users (id, email, salt, password_hash) VALUES (?, ?, ?, ?)`);
    stmt.bind([userId, cleanEmail, salt, hash]);
    stmt.step();
    stmt.free();
    saveDatabase();
    res.json({ success: true, message: 'Account successfully created and encrypted in SQL!', user: { id: userId, email: cleanEmail } });
  } catch (err) {
    res.status(400).json({ error: 'An account with this email address already exists.' });
  }
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const cleanEmail = email.trim().toLowerCase();

  try {
    const stmt = db.prepare(`SELECT * FROM users WHERE email = ?`);
    stmt.bind([cleanEmail]);
    
    if (!stmt.step()) {
      stmt.free();
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    
    const user = stmt.getAsObject();
    stmt.free();

    const isValid = verifyPassword(password, user.salt, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    res.json({ success: true, user: { id: user.id, email: user.email } });
  } catch (err) {
    res.status(500).json({ error: 'Database error during login.' });
  }
});

app.get('/api/history/:userId', (req, res) => {
  const { userId } = req.params;
  
  try {
    const stmt = db.prepare(`SELECT id, timestamp, report_data FROM history WHERE user_id = ? ORDER BY timestamp DESC`);
    stmt.bind([userId]);
    
    const rows = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();

    const history = rows.map(row => ({
      id: row.id,
      timestamp: row.timestamp,
      ...JSON.parse(row.report_data)
    }));
    res.json({ history });
  } catch (err) {
    res.status(500).json({ error: 'Database read error.' });
  }
});

app.post('/api/history/save', (req, res) => {
  const { userId, report } = req.body;
  if (!userId || !report) {
    return res.status(400).json({ error: 'Missing userId or report data.' });
  }

  const reportId = Date.now().toString();
  const timestamp = new Date().toISOString();
  const reportString = JSON.stringify(report);

  try {
    const insertStmt = db.prepare(`INSERT INTO history (id, user_id, timestamp, report_data) VALUES (?, ?, ?, ?)`);
    insertStmt.bind([reportId, userId, timestamp, reportString]);
    insertStmt.step();
    insertStmt.free();
    saveDatabase();
    
    const selectStmt = db.prepare(`SELECT id, timestamp, report_data FROM history WHERE user_id = ? ORDER BY timestamp DESC`);
    selectStmt.bind([userId]);
    const rows = [];
    while (selectStmt.step()) {
      rows.push(selectStmt.getAsObject());
    }
    selectStmt.free();

    const history = rows.map(row => ({
      id: row.id,
      timestamp: row.timestamp,
      ...JSON.parse(row.report_data)
    }));
    res.json({ success: true, message: 'Report saved to SQL database!', history });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save report to database.' });
  }
});

// 1. Adaptive Wizard Questions Generator Endpoint
app.post('/api/generate-questions', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required.' });
    }

    const systemPrompt = `You are Verlo's diagnostic wizard engine. Analyze the user's situation and generate exactly 3 sharp, highly targeted, adaptive clarification questions that uncover missing critical details (such as timelines, constraints, or evidence). Return a JSON object with a "questions" key containing an array of 3 string questions. Return ONLY valid JSON.`;

    const completion = await openai.chat.completions.create({
      model: MODEL_NAME,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' }
    });

    const parsed = JSON.parse(completion.choices[0].message.content);
    res.json({ questions: parsed.questions || [
      "What is your primary timeline or deadline for this issue?",
      "What are the main financial or resource constraints involved?",
      "What is your ideal outcome or resolution?"
    ] });
  } catch (error) {
    console.error('Generate Questions Error:', error);
    res.status(500).json({ error: 'Failed to generate adaptive questions.' });
  }
});

// 2. Comprehensive Master Report Generator Endpoint
app.post('/api/generate-report', async (req, res) => {
  try {
    const { prompt, answers } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required.' });
    }

    const formattedAnswersSummary = Array.isArray(answers) 
      ? answers.map(a => `Q: ${a.question}\nA: ${a.answer}`).join('\n') 
      : 'None provided';

    const systemPrompt = `You are Verlo, an elite enterprise decision intelligence and strategic simulation engine. Provide exhaustive, adversarial analysis and tactical blueprints. 

Output a strict JSON object with the following keys:
- confidence (string, e.g., "High Conviction", "Calculated Risk", or "High Uncertainty")
- riskAssessment (object with severityScore number 1-10, financialExposure string, timeSensitivity string)
- nextSteps (array of objects with "step", "why", and optional "pitfallWarning")
- draftTemplate (object with "recipient", "subject", "body" - formal correspondence template)
Return ONLY valid JSON.`;

    const userPrompt = `Initial Situation: ${prompt}
Clarification Wizard Answers:
${formattedAnswersSummary}`;

    const completion = await openai.chat.completions.create({
      model: MODEL_NAME,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' }
    });

    const resultData = JSON.parse(completion.choices[0].message.content);
    res.json({ data: resultData });
  } catch (error) {
    console.error('Generate Report Error:', error);
    res.status(500).json({ error: 'Report generation failed.' });
  }
});

// 3. Contextual Assistant Chat Endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { question, currentSituation } = req.body;

    if (!question) {
      return res.status(400).json({ error: 'Question is required.' });
    }

    const completion = await openai.chat.completions.create({
      model: MODEL_NAME,
      messages: [
        { role: 'system', content: `You are Verlo AI, an elite strategic assistant answering follow-up questions regarding the situation: "${currentSituation || 'General inquiry'}". Provide direct, professional markdown guidance.` },
        { role: 'user', content: question }
      ]
    });

    res.json({ reply: completion.choices[0].message.content });
  } catch (error) {
    console.error('Chat API Error:', error);
    res.status(500).json({ error: 'Chat response failed.' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`VERLO running on port ${PORT} via OpenAI SDK (${MODEL_NAME})`);
});