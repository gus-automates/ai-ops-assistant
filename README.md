# AI-Powered Ops Assistant

A chat interface that answers plain-English questions about business data
from QuickBooks Online — powered by Claude (Anthropic).

> "Who are our top customers by balance?"
> "Show me all open purchase orders from this year."
> "Summarize our financials."

## What It Does

- Chat UI that accepts natural language questions about business operations
- Claude interprets each question and responds with structured, accurate answers
- Pulls from customers, open purchase orders, bills, and P&L data
- Maintains conversation history so follow-up questions work naturally
- Demo uses mock QBO data — swap in live API responses to connect a real account

## How It Works

```
User question (plain English)
        ↓
index.html  →  POST /api/chat  →  server.js (Express)
                                       ↓
                               api.anthropic.com
                                       ↓
                            Claude reads question + full
                            QBO data from system prompt
                                       ↓
                         Formatted answer → back to browser
```

The key insight: instead of building a query parser, the QBO data is included
directly in Claude's system prompt. Claude handles all interpretation —
filtering, ranking, summarizing — without needing custom logic for each question.

The API key lives in a `.env` file on the server and is never sent to the browser.

## Tech Stack

- Vanilla HTML, CSS, JavaScript (no framework, no build step)
- Node.js + Express — local proxy server that holds the API key
- dotenv — loads `ANTHROPIC_API_KEY` from `.env` into the server at runtime
- Claude API (`claude-sonnet-4-20250514`) via Anthropic
- Mock data simulating QuickBooks Online API responses

## Running It Locally

**Prerequisites:** Node.js installed on your machine.

1. Clone the repo

   ```bash
   git clone https://github.com/gus-automates/ai-ops-assistant
   cd ai-ops-assistant
   ```

2. Install dependencies

   ```bash
   npm install express dotenv
   ```

3. Create a `.env` file in the root of the project

   ```
   ANTHROPIC_API_KEY=your_key_here
   ```

   Get a key at [console.anthropic.com](https://console.anthropic.com).
   This file is gitignored and will never be committed.

4. Start the server

   ```bash
   node server.js
   ```

5. Open your browser and go to `http://localhost:3000`

## Security Model

The browser never handles the API key. All credential management happens server-side:

```
Browser (index.html)
  → POST /api/chat  { system, messages }   ← no credentials
      → server.js injects ANTHROPIC_API_KEY from .env
          → api.anthropic.com              ← key only travels here
```

The `.gitignore` excludes `.env` and `node_modules/` so credentials
can never be accidentally committed.

## Connecting Real QBO Data

This demo uses mock data. To connect a live QuickBooks Online account:

1. Set up OAuth2 with the Intuit Developer API (see the
   [qbo-sheets-integration](https://github.com/gus-automates/qbo-sheets-integration)
   repo for a working OAuth implementation)

2. Replace the `MOCK_DATA` object in `index.html` with live API responses:

   ```javascript
   // Replace this:
   const MOCK_DATA = { customers: [...], ... }

   // With fetched data from your backend:
   const MOCK_DATA = await fetch('/api/qbo-snapshot').then(r => r.json());
   ```

3. Add a `/api/qbo-snapshot` route to `server.js` that fetches fresh data
   from QBO using your OAuth token and returns it as JSON

## Related Projects

- [qbo-sheets-integration](https://github.com/gus-automates/qbo-sheets-integration) —
  Pulls live QBO financial data into Google Sheets using OAuth2 and Google Apps Script
