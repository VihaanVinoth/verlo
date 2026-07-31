import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json());

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

// In-memory mock database for users and saved history
const usersDatabase = []; // { id, email, password }
const historyDatabase = {}; // userId -> array of saved reports

// --- 1. Authentication Endpoints ---

app.post('/api/auth/signup', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const existingUser = usersDatabase.find(u => u.email === email);
  if (existingUser) {
    return res.status(400).json({ error: 'An account with this email already exists.' });
  }

  const newUser = { id: Date.now().toString(), email, password };
  usersDatabase.push(newUser);
  historyDatabase[newUser.id] = [];

  res.json({ success: true, user: { id: newUser.id, email: newUser.email } });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const user = usersDatabase.find(u => u.email === email && u.password === password);

  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  res.json({ success: true, user: { id: user.id, email: user.email } });
});

// --- 2. History Endpoints ---

app.get('/api/history/:userId', (req, res) => {
  const { userId } = req.params;
  const userHistory = historyDatabase[userId] || [];
  res.json({ history: userHistory });
});

app.post('/api/history/save', (req, res) => {
  const { userId, report } = req.body;
  if (!userId || !report) {
    return res.status(400).json({ error: 'Missing userId or report data.' });
  }

  if (!historyDatabase[userId]) {
    historyDatabase[userId] = [];
  }

  historyDatabase[userId].unshift({
    id: Date.now().toString(),
    timestamp: new Date().toISOString(),
    ...report
  });

  res.json({ success: true, history: historyDatabase[userId] });
});

// --- 3. UNIVERSAL DIAGNOSE ENDPOINT (Protected by moderation.json) ---
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

    let normalizedResponse = {
      confidence: 'Strong',
      situation: description,
      riskAssessment: {
        severityScore: 5,
        financialExposure: 'Evaluated per request',
        timeSensitivity: 'Active'
      },
      needsClarification: false,
      clarifyingQuestions: [],
      nextSteps: [
        { 
          step: `Analyze the core objective for: "${description.substring(0, 50)}..."`, 
          why: "Breaks down your input into clear, structured execution milestones." 
        },
        { 
          step: "Execute primary action plan and verify output constraints", 
          why: "Ensures immediate progress toward your goal." 
        }
      ],
      knownFacts: [
        `User Input: ${description}`,
        `Context Parameters: ${context || 'General inquiry'}`,
        `Engine Status: Fully Universal & Operational`
      ],
      missingInformation: [],
      options: [
        { title: "Direct Execution & Action Strategy", bestFor: "Immediate, targeted resolution" }
      ],
      draftTemplate: {
        recipient: 'Target / Self / Output Channel',
        subject: `Action Plan: ${title || 'Universal Request'}`,
        body: `PROMPT ANALYSIS:\n"${description}"\n\nRECOMMENDED EXECUTION PATHWAY:\n1. Review parameters and objectives.\n2. Apply structured breakdown and solve.\n3. Verify final results.`
      },
      risks: ["Proceeding without defining clear intermediate success criteria."],
      verificationNeeded: ["Confirming alignment with your primary objective."]
    };

    res.json({ data: normalizedResponse });
  } catch (error) {
    console.error('Diagnose API Error:', error);
    res.status(500).json({ error: 'Internal engine processing error.' });
  }
});

// --- 4. UNIVERSAL CHAT ENDPOINT (Protected by moderation.json) ---
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

    // Short simulated delay for responsiveness
    await new Promise((resolve) => setTimeout(resolve, 600));

    let contextualAnswer = `Regarding your input on "${question}" (in the context of "${currentSituation || 'your active topic'}"): Here is the direct breakdown and solution pathway you need. Review the core components, execute the necessary steps sequentially, and ensure your deliverables match your target goals.`;

    res.json({ reply: contextualAnswer });
  } catch (error) {
    console.error('Chat API Error:', error);
    res.status(500).json({ error: 'Failed to process chat follow-up' });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`Verlo decision engine backend running on http://127.0.0.1:${PORT}`);
});