// ─────────────────────────────────────────────────────────────────────────────
// server.js — Local proxy server for the Ops Assistant
//
// WHY THIS EXISTS:
// The browser cannot safely hold an API key — anyone can read it in DevTools.
// This server sits between the browser and Anthropic's API. The browser calls
// THIS server, and this server injects the API key before forwarding the request.
//
// FLOW:
//   index.html  →  POST /api/chat  →  this server  →  api.anthropic.com
//
// The API key never touches the browser.
// ─────────────────────────────────────────────────────────────────────────────

const express = require('express');
const path    = require('path');

// dotenv reads your .env file and loads ANTHROPIC_API_KEY into process.env
// This means the key lives only on disk, only server-side, never in code
require('dotenv').config();

const app  = express();
const PORT = 3000;

// Parse incoming JSON request bodies (the messages array from index.html)
app.use(express.json());

// Serve index.html as a static file when you open http://localhost:3000
// This replaces double-clicking the HTML file directly in your browser
app.use(express.static(path.join(__dirname)));

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/chat
// Receives { system, messages } from the browser, forwards to Anthropic,
// and returns Claude's response — without ever exposing the API key.
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  const { system, messages } = req.body;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         process.env.ANTHROPIC_API_KEY, // ← injected here, server-side only
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system,
        messages,
      }),
    });

    const data = await response.json();
    res.json(data);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Ops Assistant running at http://localhost:${PORT}`);
});
