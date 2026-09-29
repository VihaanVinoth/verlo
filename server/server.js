import express from 'express';
import cors from 'cors';
import initSqlJs from 'sql.js';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { Groq } from 'groq-sdk';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

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

    const systemPrompt = `You are Verlo, an elite, uncompromising enterprise decision intelligence and strategic war-room simulation engine. 
Provide exhaustive, highly rigorous, adversarial analysis. Do not output generic high-level advice; deliver granular, legally and structurally sound tactical blueprints that outclass standard AI bots.

Output a strict JSON object with the following keys:
- confidence (string, e.g., "High Conviction", "Calculated Risk", or "High Uncertainty")
- situation (string, a razor-sharp, deep executive breakdown of the core dilemma)
- riskAssessment (object with severityScore number 1-10, financialExposure string, timeSensitivity string, and "secondOrderRisks" array of at least 3 deep, non-obvious long-term structural consequences)
- needsClarification (boolean)
- clarifyingQuestions (array of 2 sharp, high-leverage strategic questions)
- nextSteps (array of objects with "step" and "why", detailing granular, aggressive tactical execution steps)
- knownFacts (array of string data points extracted from context)
- missingInformation (array of strings)
- options (array of objects with "title", "bestFor", and rigorous "tradeoff" description)
- draftTemplate (object with "recipient", "subject", "body" - formal, binding, professional correspondence templates)
- strategicFrameworkApplied (string, e.g., "Game Theory / Asymmetric Leverage Matrix")
Return ONLY valid JSON. Do not include markdown code ticks or conversational text outside the JSON.`;

    const userPrompt = `Title: ${title || 'General Dilemma'}
Description: ${description}
Context: ${context || 'None provided'}`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt }, 
        { role: 'user', content: userPrompt }
      ],
      model: 'openai/gpt-oss-120b',
      temperature: 0.2,
      max_tokens: 2000,
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
        riskAssessment: { severityScore: 6, financialExposure: 'Moderate', timeSensitivity: 'High', secondOrderRisks: ['Potential credit score friction', 'Contractual default escalation', 'Administrative drag'] },
        needsClarification: false,
        clarifyingQuestions: ["What precise documentary evidence do you currently possess?", "Are there binding arbitration clauses in the original agreement?"],
        nextSteps: [{ step: "Secure immediate written preservation of all logs.", why: "Prevents counter-party denial." }],
        knownFacts: [description],
        missingInformation: [],
        options: [{ title: "Direct Adversarial Push", bestFor: "Speed", tradeoff: "Higher friction" }],
        draftTemplate: { recipient: "Legal / Compliance Desk", subject: title || "Formal Notice", body: rawContent },
        strategicFrameworkApplied: "Asymmetric Leverage Matrix"
      };
    }

    res.json({ data: normalizedResponse });
  } catch (error) {
    console.error('Groq Diagnose API Error:', error);
    res.status(500).json({ error: `Groq AI Processing Error: ${error.message}` });
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

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { 
          role: 'system', 
          content: `You are Verlo, an elite decision intelligence assistant powered by gpt-oss-120b. Provide razor-sharp, exhaustive, direct guidance based on context: "${currentSituation || 'General inquiry'}"` 
        },
        { role: 'user', content: question }
      ],
      model: 'openai/gpt-oss-120b',
      temperature: 0.4,
      max_tokens: 1200
    });

    const contextualAnswer = chatCompletion.choices[0]?.message?.content || 'No response generated.';
    res.json({ reply: contextualAnswer });
  } catch (error) {
    console.error('Groq Chat API Error:', error);
    res.status(500).json({ error: `Chat Error: ${error.message}` });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`VERLO running on port ${PORT} via Groq SDK & sql.js with gpt-oss-120b`);
});