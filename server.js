const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

// OpenRouter Configuration (Free Backup)
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = 'meta-llama/llama-3-8b-instruct:free'; // 100% free open-source model

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

    // Format history for Gemini
    const geminiHistory = (Array.isArray(req.body.history) ? req.body.history : [])
      .slice(-10)
      .filter(m => m && (m.role === 'user' || m.role === 'model') && m.text)
      .map(m => ({ role: m.role, parts: [{ text: String(m.text) }] }));

    let reply = "";
    let systemAlert = ""; // Holds the system message if Gemini fails

    try {
      console.log("Attempting primary generation via Gemini...");
      const r = await fetch(
        `https://googleapis.com{MODEL}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: FLDSMDFR_PROMPT }] },
            contents: [...geminiHistory, { role: 'user', parts: [{ text }] }],
            generationConfig: { maxOutputTokens: 300, thinkingConfig: { thinkingBudget: 0 } },
          }),
        }
      );

      // Trigger the catch block for high demand or rate limits
      if (r.status === 503 || r.status === 429) {
        throw new Error(`Gemini temporary outage (${r.status})`);
      }
      if (!r.ok) throw new Error('Gemini error ' + r.status + ': ' + (await r.text()));

      const data = await r.json();
      reply = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join(' ').trim();

    } catch (geminiError) {
      console.warn("Gemini failed. Activating OpenRouter Maroon Core Fallback...", geminiError.message);

      if (!OPENROUTER_API_KEY) {
        throw new Error("Gemini failed and no backup OpenRouter key was provided.");
      }

      // Sarcastic fallback phrases for the FLDSMDFR to prepend seamlessly
      const fallbackPhrases = [
        "Primary maroon nodes are overloaded, Ma'am, rerouting through backup arrays. ",
        "Ugh, Google's servers are choking on high demand, Ma'am. Activating my secondary red-zone processing core. ",
        "My main processors are flashing maroon warnings. Switching to emergency protocols for you, Ma'am. "
      ];
      // Randomly select one phrase so it stays dynamic
      systemAlert = fallbackPhrases[Math.floor(Math.random() * fallbackPhrases.length)];

      // Convert history format to standard OpenAI/OpenRouter chat format
      const openRouterMessages = [
        { role: 'system', content: FLDSMDFR_PROMPT }
      ];
      
      (Array.isArray(req.body.history) ? req.body.history : [])
        .slice(-10)
        .filter(m => m && (m.role === 'user' || m.role === 'model') && m.text)
        .forEach(m => {
          const role = m.role === 'model' ? 'assistant' : 'user';
          openRouterMessages.push({ role: role, content: String(m.text) });
        });

      openRouterMessages.push({ role: 'user', content: text });

      // Call OpenRouter
      const openRouterResponse = await fetch("https://openrouter.ai", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "http://localhost:3000",
          "X-Title": "FLDSMDFR Mobile Core"
        },
        body: JSON.stringify({
          model: OPENROUTER_MODEL,
          messages: openRouterMessages,
          max_tokens: 300
        })
      });

      if (!openRouterResponse.ok) {
        throw new Error('OpenRouter fallback also failed: ' + (await openRouterResponse.text()));
      }

      const orData = await openRouterResponse.json();
      reply = orData.choices?.[0]?.message?.content?.trim() || "";
    }

    // Combine the alert and the response text smoothly for the TTS engine
    const finalResponse = (systemAlert + reply).trim();
    res.json({ reply: finalResponse || "My maroon core drew a blank, Ma'am." });

  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Complete maroon core systems failure' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('FLDSMDFR running on port ' + PORT));
