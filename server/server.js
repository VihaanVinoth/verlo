import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Groq from 'groq-sdk';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

app.use(cors());
app.use(express.json());

const uploadDir = path.join(__dirname, 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 15 * 1024 * 1024 } 
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.post('/api/analyze', upload.array('files'), async (req, res) => {
  try {
    const { prompt, category, answers } = req.body;
    
    const files = req.files ? req.files.map(file => ({
      name: file.originalname,
      size: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
      path: file.path
    })) : [];


    let parsedAnswers = {};
    try {
      parsedAnswers = typeof answers === 'string' ? JSON.parse(answers) : (answers || {});
    } catch (e) {
      parsedAnswers = answers;
    }

    const adaptiveContext = Object.keys(parsedAnswers).length > 0 
      ? `\n\nAdaptive Questionnaire Responses:\n${JSON.stringify(parsedAnswers, null, 2)}` 
      : '';

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'You are Verlo, an advanced legal decision and rights engine AI assistant. Provide objective structural analysis, clear liability assessment, and a practical next-steps breakdown based on the situation, uploaded documents, and adaptive questionnaire responses.'
        },
        {
          role: 'user',
          content: `Category: ${category || 'General'}\n\nSituation/Query: ${prompt}${adaptiveContext}`
        }
      ],
      model: 'openai/gpt-oss-120b',
      temperature: 0.3,
    });

    const aiResponse = chatCompletion.choices[0]?.message?.content || 'No analysis generated.';

    res.json({ 
      success: true, 
      analysis: aiResponse,
      filesProcessed: files
    });

  } catch (error) {
    console.error('AI Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});