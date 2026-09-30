const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const OPENROUTER_API_KEY = (process.env.OPENROUTER_API_KEY || '').trim();
const OPENROUTER_MODEL = 'meta-llama/llama-3-8b-instruct:free'; 

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

app.post('/api/chat', async (req, res) => {
  try {
    const text = String(req.body.text || '').trim();
    if (!text) return res.status(400).json({ error: 'Nothing heard' });

    const history = (Array.isArray(req.body.history) ? req.body.history : [])
      .slice(-10)
      .filter(m => m && (m.role === 'user' || m.role === 'model') && m.text)
      .map(m => ({ role: m.role, parts: [{ text: String(m.text) }] }));

    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: FLDSMDFR_PROMPT }] },
          contents: [...history, { role: 'user', parts: [{ text }] }],
          generationConfig: { maxOutputTokens: 300, thinkingConfig: { thinkingBudget: 0 } },
        }),
      }
    );
    if (!r.ok) throw new Error('Gemini error ' + r.status + ': ' + (await r.text()));
    const data = await r.json();
    const reply = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join(' ').trim();
    res.json({ reply: reply || "My maroon core drew a blank, Ma'am." });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Maroon core failure' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('FLDSMDFR running on port ' + PORT));
