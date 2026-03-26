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
- Demo runs entirely in the browser with mock data — no backend required

## How It Works

```
User question (plain English)
        ↓
Claude API — reads the question + full QBO data in the system prompt
        ↓
Claude responds with a formatted, accurate answer
        ↓
Answer displayed in the chat UI
```

The key insight: instead of building a query parser, the QBO data is included
directly in Claude's system prompt. Claude handles all the interpretation —
filtering, ranking, summarizing — without needing custom logic for each question.

## Tech Stack

- Vanilla HTML, CSS, JavaScript (no framework, no build step)
- Claude API (`claude-sonnet-4-20250514`) via Anthropic
- Mock data simulating QuickBooks Online API responses

## Running It Locally

1. Clone the repo
   ```bash
   git clone https://github.com/gus-automates/ai-ops-assistant
   ```

2. Open `index.html` and replace the API key placeholder:
   ```js
   const ANTHROPIC_API_KEY = "YOUR_ANTHROPIC_API_KEY";
   ```
   Get a key at [console.anthropic.com](https://console.anthropic.com)

3. Open `index.html` directly in your browser — no server needed

## Connecting Real QBO Data

This demo uses mock data. To connect a live QuickBooks Online account:

1. Set up OAuth2 with the Intuit Developer API (see the
   [qbo-sheets-integration](https://github.com/gus-automates/qbo-sheets-integration)
   repo for a working OAuth implementation)

2. Replace the `MOCK_DATA` object in `index.html` with live API responses:
   ```js
   // Replace this:
   const MOCK_DATA = { customers: [...], ... }

   // With fetched data from your backend:
   const MOCK_DATA = await fetch('/api/qbo-snapshot').then(r => r.json());
   ```

3. Move the Anthropic API call to a backend endpoint so your API key
   is never exposed in the browser

## Architecture Note

For a production deployment the recommended architecture is:

```
Browser → Your backend server → Anthropic API
                             ↘ QBO API
```

The backend fetches fresh QBO data, injects it into the system prompt,
and proxies the Claude API call — keeping all credentials server-side.

## Related Projects

- [qbo-sheets-integration](https://github.com/gus-automates/qbo-sheets-integration) —
  Pulls live QBO financial data into Google Sheets using OAuth2 and Google Apps Script
