import express from 'express';
import Groq from 'groq-sdk';

const app = express();
app.use(express.json());

const client = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

app.post('/api/wizard/start', async (req, res) => {
  try {
    const { initialGoal } = req.body;

    const completion = await client.chat.completions.create({
      model: 'openai/gpt-oss-120b',
      messages: [
        { 
          role: 'system', 
          content: 'You are an adaptive wizard engine. Based on the user goal, generate the next set of structured multiple-choice questions or guiding steps in JSON format.' 
        },
        { role: 'user', content: `Goal: ${initialGoal}` }
      ],
      temperature: 0.7,
    });

    res.json({ 
      success: true, 
      wizardStep: completion.choices[0].message.content 
    });

  } catch (error) {
    console.error('Error in wizard start:', error);
    res.status(500).json({ error: 'Failed to generate wizard step.' });
  }
});

app.post('/api/wizard/synthesise', async (req, res) => {
  try {
    const { responses } = req.body;

    const completion = await client.chat.completions.create({
      model: 'openai/gpt-oss-120b',
      messages: [
        { 
          role: 'system', 
          content: 'Synthesise the user responses into a final master report and strategic roadmap.' 
        },
        { role: 'user', content: `User wizard choices: ${JSON.stringify(responses)}` }
      ],
      temperature: 0.7,
    });

    res.json({ 
      success: true, 
      report: completion.choices[0].message.content 
    });

  } catch (error) {
    console.error('Error in wizard synthesis:', error);
    res.status(500).json({ error: 'Failed to synthesise report.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Wizard server running on port ${PORT}`);
});