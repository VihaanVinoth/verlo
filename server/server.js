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
const AI_MODEL = 'gpt-4o';

const DB_PATH = path.resolve(__dirname, 'verlo.db');
let db = null;

function saveDatabase() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

async function initialiseDatabase() {
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
  } catch (e) {
    console.error('Demo user init error:', e);
  }
}

initialiseDatabase();

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
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

  const cleanEmail = email.trim().toLowerCase();
  const userId = 'user_' + Date.now();
  const { salt, hash } = hashPassword(password);

  try {
    const stmt = db.prepare(`INSERT INTO users (id, email, salt, password_hash) VALUES (?, ?, ?, ?)`);
    stmt.bind([userId, cleanEmail, salt, hash]);
    stmt.step();
    stmt.free();
    saveDatabase();
    res.json({ success: true, user: { id: userId, email: cleanEmail } });
  } catch (err) {
    res.status(400).json({ error: 'An account with this email address already exists.' });
  }
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

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

    if (!verifyPassword(password, user.salt, user.password_hash)) {
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
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();

    const history = rows.map(row => ({ id: row.id, timestamp: row.timestamp, ...JSON.parse(row.report_data) }));
    res.json({ history });
  } catch (err) {
    res.status(500).json({ error: 'Database read error.' });
  }
});

app.post('/api/history/save', (req, res) => {
  const { userId, report } = req.body;
  if (!userId || !report) return res.status(400).json({ error: 'Missing userId or report data.' });

  const reportId = Date.now().toString();
  const timestamp = new Date().toISOString();

  try {
    const insertStmt = db.prepare(`INSERT INTO history (id, user_id, timestamp, report_data) VALUES (?, ?, ?, ?)`);
    insertStmt.bind([reportId, userId, timestamp, JSON.stringify(report)]);
    insertStmt.step();
    insertStmt.free();
    saveDatabase();
    
    const selectStmt = db.prepare(`SELECT id, timestamp, report_data FROM history WHERE user_id = ? ORDER BY timestamp DESC`);
    selectStmt.bind([userId]);
    const rows = [];
    while (selectStmt.step()) rows.push(selectStmt.getAsObject());
    selectStmt.free();

    const history = rows.map(row => ({ id: row.id, timestamp: row.timestamp, ...JSON.parse(row.report_data) }));
    res.json({ success: true, history });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save report.' });
  }
});

app.post('/api/generate-questions', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt is required.' });

    const systemPrompt = `You are Verlo's adaptive diagnostic wizard engine. Analyse the user's specific situation and generate exactly 3 deeply tailored, context-specific multiple-choice questions to uncover critical missing constraints, timelines, or variables. 
Each question must contain:
- "question": string (the question text)
- "options": array of 3 to 4 distinct, highly contextual multiple-choice string options.

Return a strict JSON object with a "questions" key containing an array of these 3 question objects. Return ONLY valid JSON.`;

    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' }
    });

    const parsed = JSON.parse(completion.choices[0].message.content);
    res.json({ questions: parsed.questions });
  } catch (error) {
    console.error('Generate Questions Error:', error);
    res.status(500).json({ error: 'Failed to generate adaptive questions.' });
  }
});

app.post('/api/generate-report', async (req, res) => {
  try {
    const { prompt, answers } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt is required.' });

    const formattedAnswersSummary = Array.isArray(answers) 
      ? answers.map(a => `Q: ${a.question}\nSelected Choice: ${a.answer}`).join('\n\n') 
      : 'None provided';

    const systemPrompt = `You are Verlo, an elite enterprise decision intelligence and strategic simulation engine. Provide exhaustive, adversarial analysis and tactical blueprints based on the initial situation and user's chosen wizard option parameters. 

Output a strict JSON object with the following keys:
- confidence (string, e.g., "High Conviction", "Calculated Risk", or "High Uncertainty")
- riskAssessment (object with severityScore number 1-10, financialExposure string, timeSensitivity string)
- nextSteps (array of objects with "step", "why", and optional "pitfallWarning")
- draftTemplate (object with "recipient", "subject", "body" - formal correspondence template)
Return ONLY valid JSON.`;

    const userPrompt = `Initial Situation: ${prompt}
Clarification Wizard Selections:
${formattedAnswersSummary}`;

    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' }
    });

    res.json({ data: JSON.parse(completion.choices[0].message.content) });
  } catch (error) {
    console.error('Generate Report Error:', error);
    res.status(500).json({ error: 'Report generation failed.' });
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    const { question, currentSituation } = req.body;
    if (!question) return res.status(400).json({ error: 'Question is required.' });

    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
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
  console.log(`VERLO running on port ${PORT} via OpenAI SDK (${AI_MODEL})`);
});