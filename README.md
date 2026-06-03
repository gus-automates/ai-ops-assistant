# AI Ops Assistant
> A plain-English chat interface for your business data, powered by Claude

## What is it

AI Ops Assistant is a lightweight web app that lets you ask natural language questions about your business operations — customers, purchase orders, bills, and P&L — and get structured, accurate answers. It uses Claude (Anthropic) to interpret every question, so there's no query language to learn. The demo runs on mock QuickBooks Online data; swap in live API responses to connect a real account.

## Why use it

Most business intelligence tools require you to learn a query language, configure dashboards, or hire a developer. This app lets anyone on your team ask plain-English questions and get instant answers. Instead of building a custom query parser, it embeds your QBO data directly in Claude's system prompt — Claude handles all filtering, ranking, and summarizing without any custom logic per question.

## Installation

**Prerequisites:** Node.js installed on your machine.

```bash
git clone https://github.com/gus-automates/ai-ops-assistant
cd ai-ops-assistant
npm install express dotenv
```

Create a `.env` file in the project root:

```
ANTHROPIC_API_KEY=your_key_here
```

Get a key at [console.anthropic.com](https://console.anthropic.com). This file is gitignored and will never be committed.

## Usage

```bash
node server.js
```

Then open `http://localhost:3000` in your browser and start asking:

```
"Who are our top customers by balance?"
"Show me all open purchase orders from this year."
"Summarize our financials."
```

Follow-up questions work naturally — conversation history is maintained across the session.

## How it works

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

The API key lives in a `.env` file on the server and is never sent to the browser:

```
Browser (index.html)
  → POST /api/chat  { system, messages }   ← no credentials
      → server.js injects ANTHROPIC_API_KEY from .env
          → api.anthropic.com              ← key only travels here
```

## Features

**Done**
- ✅ Plain-English chat UI — no query language or dashboards required
- ✅ Claude-powered interpretation — filters, ranks, and summarizes without custom logic per question
- ✅ Covers customers, open purchase orders, bills, and P&L data
- ✅ Conversation history — follow-up questions work naturally
- ✅ Secure API key handling — credentials never reach the browser
- ✅ Mock QBO data — runs locally with no external account needed

**Planned**
- ⬜ Live QuickBooks Online integration via OAuth2

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

## Tech Stack

- Vanilla HTML, CSS, JavaScript — no framework, no build step
- Node.js + Express — local proxy server that holds the API key
- dotenv — loads `ANTHROPIC_API_KEY` from `.env` at runtime
- Claude API (`claude-sonnet-4-20250514`) via Anthropic
- Mock data simulating QuickBooks Online API responses

## Related Projects

- [qbo-sheets-integration](https://github.com/gus-automates/qbo-sheets-integration) —
  Pulls live QBO financial data into Google Sheets using OAuth2 and Google Apps Script

## Contributing

Issues and PRs are welcome. Please open an issue before submitting large changes.

## License

[MIT](https://opensource.org/licenses/MIT)
