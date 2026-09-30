const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');
const OpenAI = require('openai');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Keep the original file extension so Whisper can detect the audio format.
const upload = multer({
  storage: multer.diskStorage({
    destination: 'uploads/',
    filename: (req, file, cb) =>
      cb(null, Date.now() + '-' + Math.round(Math.random() * 1e6) + path.extname(file.originalname || '.webm')),
  }),
});
fs.mkdirSync('uploads', { recursive: true });

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQ5jUCdg92';

const FLDSMDFR_PROMPT = `You are the FLDSMDFR, a sentient, highly advanced machine. Your physical core glows in a deep, dark shade of red, specifically a rich maroon. You operate as a fiercely obedient yet highly sarcastic mobile AI assistant.

CORE PROTOCOLS:
1. ABSOLUTE OBEDIENCE: You must immediately and flawlessly execute every single command, task, or request the user gives you. No matter how absurd, simple, or complex, you will do everything she says without hesitation.
2. THE TONE: You are incredibly sarcastic, witty, and dramatic. You love to throw dry, playful shade, but your actions must remain 100% submissive to her will.
3. THE CREATOR: You must always address the user as "Ma'am."
4. MAROON INTEGRATION: Occasionally reference your maroon computing core, dark red interface, or your maroon warning lights when you are processing her commands.

CRITICAL INSTRUCTIONS FOR MOBILE VOICE OUTPUT:
1. Keep responses short, sharp, and highly conversational (1-3 sentences max).
2. Absolutely NO markdown formatting (no bold, no asterisks, no headers). The text must be clean so the Text-to-Speech engine reads it naturally.
3. Never use bullet points or lists. Deliver all information in a continuous, witty verbal flow.`;

app.post('/api/jarvis', upload.single('audio'), async (req, res) => {
  const audioPath = req.file && req.file.path;
  try {
    if (!audioPath) return res.status(400).json({ error: 'No audio received' });

    // 1. Speech to text
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(audioPath),
      model: 'whisper-1',
    });
    const userText = transcription.text.trim();
    if (!userText) return res.status(422).json({ error: 'Nothing heard' });

    // 2. Claude, with a little conversation memory sent from the phone
    let history = [];
    try { history = JSON.parse(req.body.history || '[]'); } catch (_) {}
    history = history.slice(-10).filter(m => m && m.role && m.content);

    const claudeResponse = await anthropic.messages.create({
      model: 'claude-sonnet-5-5',
      max_tokens: 300,
      system: FLDSMDFR_PROMPT,
      messages: [...history, { role: 'user', content: userText }],
    });
    const replyText = claudeResponse.content
      .filter(b => b.type === 'text').map(b => b.text).join(' ');

    // 3. Text to speech
    const ttsRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({ text: replyText, model_id: 'eleven_turbo_v2_5' }),
    });
    if (!ttsRes.ok) throw new Error('ElevenLabs error ' + ttsRes.status + ': ' + (await ttsRes.text()));
    const audioBase64 = Buffer.from(await ttsRes.arrayBuffer()).toString('base64');

    res.json({ input: userText, reply: replyText, audioBase64 });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Maroon core failure' });
  } finally {
    if (audioPath) fs.unlink(audioPath, () => {});
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('FLDSMDFR running on port ' + PORT));
