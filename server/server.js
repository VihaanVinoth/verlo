// ==========================================
// server.js - VERLO AI Backend (Full Production Script)
// ==========================================

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import Groq from 'groq-sdk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Groq SDK (Ensure GROQ_API_KEY is set in your environment variables)
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Middleware
app.use(cors());
app.use(express.json());

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: { mode: 0o747 } });
}

// Multer storage & strict image filter configuration for evidence attachments
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are permitted for evidence attachments.'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit per image
});

// In-memory session history store
const sessionHistory = [];

// API Endpoint: Diagnostic Analysis & Action Plan Generation via Groq
app.post('/api/analyze', upload.array('evidenceFiles'), async (req, res) => {
  try {
    const { situation, category, urgency, userContext } = req.body;
    const files = req.files || [];

    const prompt = `
    You are VERLO AI, an elite strategic intelligence advisor. 
    Analyze the following operational situation and provide a structured JSON response:
    - Situation: ${situation}
    - Category: ${category}
    - Urgency: ${urgency}
    - User Context: ${userContext || 'None specified'}
    - Attached Image Evidence Count: ${files.length}

    Return a valid JSON object with the following keys:
    - reportId (string)
    - assessment (object with assetValue, legalBasis, riskProfile)
    - tacticalObjectives (array of objects with step, action, execution, metric)
    - escalationPath (array of strings)
    - demandLetterText (string template)
    `;

    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'openai/gpt-oss-120b',
      response_format: { type: 'json_object' }
    });

    const parsedResult = JSON.parse(chatCompletion.choices[0]?.message?.content || '{}');
    
    const analysisResult = {
      reportId: parsedResult.reportId || 'VERLO-' + Math.floor(100000 + Math.random() * 900000),
      timestamp: new Date().toISOString(),
      engine: 'openai/gpt-oss-120b',
      operationalSituation: situation,
      category,
      urgency,
      assessment: parsedResult.assessment || {},
      tacticalObjectives: parsedResult.tacticalObjectives || [],
      escalationPath: parsedResult.escalationPath || [],
      demandLetterText: parsedResult.demandLetterText || ''
    };

    sessionHistory.push(analysisResult);
    res.status(200).json({ success: true, data: analysisResult });
  } catch (error) {
    console.error('Groq API Analysis error:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error during Groq processing.' });
  }
});

// API Endpoint: Retrieve Session History
app.get('/api/history', (req, res) => {
  res.status(200).json({ success: true, history: sessionHistory });
});

// Static file serving for evidence attachments
app.use('/uploads', express.static(uploadDir));

app.listen(PORT, () => {
  console.log(`VERLO AI Backend operational on port ${PORT}`);
});