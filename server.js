const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

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

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function askGroq(text, history) {
  const messages = [
    { role: 'system', content: FLDSMDFR_PROMPT },
    ...history.map(m => ({ role: m.role === 'model' ? 'assistant' : 'user', content: m.text })),
    { role: 'user', content: text },
  ];
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + GROQ_API_KEY },
    body: JSON.stringify({ model: GROQ_MODEL, messages, max_tokens: 300 }),
  });
  if (!r.ok) throw new Error('Groq error ' + r.status + ': ' + (await r.text()));
  const data = await r.json();
  return (data.choices?.[0]?.message?.content || '').trim();
}

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'openrouter/free';

async function askOpenRouter(text, history) {
  const messages = [
    { role: 'system', content: FLDSMDFR_PROMPT },
    ...history.map(m => ({ role: m.role === 'model' ? 'assistant' : 'user', content: m.text })),
    { role: 'user', content: text },
  ];
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + OPENROUTER_API_KEY },
    body: JSON.stringify({ model: OPENROUTER_MODEL, messages, max_tokens: 300 }),
  });
  if (!r.ok) throw new Error('OpenRouter error ' + r.status + ': ' + (await r.text()));
  const data = await r.json();
  return (data.choices?.[0]?.message?.content || '').trim();
}

async function askGemini(text, history) {
  const contents = [
    ...history.map(m => ({ role: m.role, parts: [{ text: m.text }] })),
    { role: 'user', parts: [{ text }] },
  ];
  // Retry a couple of times when Google is overloaded (503) or rate limiting (429).
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: FLDSMDFR_PROMPT }] },
          contents,
          generationConfig: { maxOutputTokens: 300, thinkingConfig: { thinkingBudget: 0 } },
        }),
      }
    );
    if ((r.status === 503 || r.status === 429) && attempt < 2) { await sleep(1500 * (attempt + 1)); continue; }
    if (!r.ok) throw new Error('Gemini error ' + r.status + ': ' + (await r.text()));
    const data = await r.json();
    return (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join(' ').trim();
  }
}

app.post('/api/chat', async (req, res) => {
  try {
    const text = String(req.body.text || '').trim();
    if (!text) return res.status(400).json({ error: 'Nothing heard' });

    const history = (Array.isArray(req.body.history) ? req.body.history : [])
      .slice(-10)
      .filter(m => m && (m.role === 'user' || m.role === 'model') && m.text)
      .map(m => ({ role: m.role, text: String(m.text) }));

    // Try each provider that has a key, in order, until one answers.
    const providers = [];
    if (OPENROUTER_API_KEY) providers.push(['OpenRouter', askOpenRouter]);
    if (GROQ_API_KEY) providers.push(['Groq', askGroq]);
    if (GEMINI_API_KEY) providers.push(['Gemini', askGemini]);
    if (!providers.length) throw new Error('No API key set. Add OPENROUTER_API_KEY, GROQ_API_KEY or GEMINI_API_KEY.');

    let reply = '', lastErr;
    for (const [name, fn] of providers) {
      try {
        reply = await fn(text, history);
        if (reply) break;
      } catch (e) { lastErr = e; console.error(name + ' failed:', e.message); }
    }
    if (!reply && lastErr) throw lastErr;
    res.json({ reply: reply || "My maroon core drew a blank, Ma'am." });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Maroon core failure' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('FLDSMDFR running on port ' + PORT));
