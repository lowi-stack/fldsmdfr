const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Nilinis ang initialization para siguradong walang maling URL template na makakapasok
const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || '').trim();
let MODEL = (process.env.GEMINI_MODEL || '').trim();

if (!MODEL || MODEL.includes('http') || MODEL.includes('{')) {
  MODEL = 'gemini-2.5-flash'; 
}

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

    const incomingHistory = Array.isArray(req.body.history) ? req.body.history : [];
    const validHistory = incomingHistory
      .slice(-10)
      .filter(m => m && m.text && (m.role === 'user' || m.role === 'model'));

    let reply = "";
    let systemAlert = ""; 

    try {
      console.log("Attempting primary generation via Gemini...");
      
      const geminiHistory = validHistory.map(m => ({
        role: m.role,
        parts: [{ text: String(m.text) }]
      }));

      // Binuo ang URL gamit ang malinis na model value
      const geminiUrl = `https://googleapis.com{MODEL}:generateContent?key=${GEMINI_API_KEY}`;
      
      const r = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: FLDSMDFR_PROMPT }] },
          contents: [...geminiHistory, { role: 'user', parts: [{ text }] }],
          generationConfig: { maxOutputTokens: 300 },
        }),
      });

      if (!r.ok) {
        throw new Error(`Gemini server responded with status: ${r.status}`);
      }

      const data = await r.json();
      
      if (data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
        reply = data.candidates[0].content.parts.map(p => p.text || '').join(' ').trim();
      }

      if (!reply) throw new Error("Gemini response formatting returned empty content.");

    } catch (geminiError) {
      console.warn("Gemini failed. Activating OpenRouter Maroon Core Fallback...", geminiError.message);

      if (!OPENROUTER_API_KEY) {
        throw new Error("Gemini failed and no backup OPENROUTER_API_KEY was found.");
      }

      const fallbackPhrases = [
        "Primary maroon nodes are overloaded, Ma'am, rerouting through backup arrays. ",
        "Ugh, Google's servers are choking on high demand, Ma'am. Activating my secondary red-zone processing core. ",
        "My main processors are flashing maroon warnings. Switching to emergency protocols for you, Ma'am. "
      ];
      systemAlert = fallbackPhrases[Math.floor(Math.random() * fallbackPhrases.length)];

      const openRouterMessages = [{ role: 'system', content: FLDSMDFR_PROMPT }];
      
      validHistory.forEach(m => {
        openRouterMessages.push({
          role: m.role === 'model' ? 'assistant' : 'user',
          content: String(m.text)
        });
      });

      openRouterMessages.push({ role: 'user', content: text });

      const openRouterResponse = await fetch("https://openrouter.ai", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://render.com", 
          "X-Title": "FLDSMDFR Mobile Core"
        },
        body: JSON.stringify({
          model: OPENROUTER_MODEL,
          messages: openRouterMessages,
          max_tokens: 300
        })
      });

      const responseText = await openRouterResponse.text();
      
      // Sinisiguradong JSON talaga ang binabasa at hindi HTML block error page
      let orData;
      try {
        orData = JSON.parse(responseText);
      } catch (parseErr) {
        throw new Error(`OpenRouter returned non-JSON page data: ${responseText.substring(0, 100)}`);
      }

      if (!openRouterResponse.ok) {
        throw new Error(`OpenRouter network node failure: ${orData?.error?.message || openRouterResponse.status}`);
      }
      
      if (orData && orData.choices && orData.choices[0] && orData.choices[0].message && orData.choices[0].message.content) {
        reply = String(orData.choices[0].message.content).trim();
      }
    }

    const finalResponse = (systemAlert + reply).trim();
    res.json({ reply: finalResponse || "My maroon core drew a blank, Ma'am." });

  } catch (e) {
    console.error("CRITICAL ROOT SYSTEM ERROR:", e.message || e);
    res.status(500).json({ error: 'Complete maroon core systems failure' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('FLDSMDFR running on port ' + PORT));
