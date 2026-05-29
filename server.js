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
// QBO helpers — token refresh + 5-minute snapshot cache
// ─────────────────────────────────────────────────────────────────────────────

let qboToken       = { accessToken: null, expiresAt: 0 };
let snapshotCache  = { data: null, timestamp: 0 };
const CACHE_TTL    = 5 * 60 * 1000;

function qboBaseUrl() {
  return process.env.QBO_ENVIRONMENT === 'production'
    ? 'https://quickbooks.api.intuit.com'
    : 'https://sandbox-quickbooks.api.intuit.com';
}

async function getAccessToken() {
  if (qboToken.accessToken && Date.now() < qboToken.expiresAt - 60_000) {
    return qboToken.accessToken;
  }
  const { QBO_CLIENT_ID, QBO_CLIENT_SECRET, QBO_REFRESH_TOKEN } = process.env;
  const creds = Buffer.from(`${QBO_CLIENT_ID}:${QBO_CLIENT_SECRET}`).toString('base64');
  const res = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
    method:  'POST',
    headers: {
      'Authorization': `Basic ${creds}`,
      'Content-Type':  'application/x-www-form-urlencoded',
      'Accept':        'application/json',
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: QBO_REFRESH_TOKEN }),
  });
  if (!res.ok) throw new Error(`QBO token refresh failed: ${await res.text()}`);
  const tok = await res.json();
  qboToken.accessToken = tok.access_token;
  qboToken.expiresAt   = Date.now() + tok.expires_in * 1000;
  if (tok.refresh_token) process.env.QBO_REFRESH_TOKEN = tok.refresh_token;
  return qboToken.accessToken;
}

async function qboQuery(token, realmId, query) {
  const url = `${qboBaseUrl()}/v3/company/${realmId}/query?query=${encodeURIComponent(query)}&minorversion=65`;
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error(`QBO query failed (${res.status}): ${await res.text()}`);
  return res.json();
}

async function qboReport(token, realmId, reportName, params = '') {
  const url = `${qboBaseUrl()}/v3/company/${realmId}/reports/${reportName}${params ? '?' + params : ''}`;
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error(`QBO report failed (${res.status}): ${await res.text()}`);
  return res.json();
}

function parsePnL(report) {
  const rows = report?.Rows?.Row ?? [];
  const year = new Date().getFullYear();

  function extractTotal(group) {
    for (const row of rows) {
      if (row.group !== group) continue;
      const cols = row.Summary?.ColData ?? row.ColData ?? [];
      return parseFloat(cols[1]?.value) || 0;
    }
    return 0;
  }

  return {
    year,
    revenue:     extractTotal('Income'),
    cogs:        extractTotal('COGS'),
    grossProfit: extractTotal('GrossProfit'),
    expenses:    extractTotal('Expenses'),
    netIncome:   extractTotal('NetIncome'),
  };
}

async function fetchQboSnapshot() {
  const token   = await getAccessToken();
  const realmId = process.env.QBO_REALM_ID;

  const [custData, poData, billData, pnlReport] = await Promise.all([
    qboQuery(token, realmId, 'SELECT * FROM Customer'),
    qboQuery(token, realmId, "SELECT * FROM PurchaseOrder WHERE POStatus = 'Open'"),
    qboQuery(token, realmId, 'SELECT * FROM Bill'),
    qboReport(token, realmId, 'ProfitAndLoss', 'date_macro=This+Year-to-date'),
  ]);

  const customers = (custData.QueryResponse?.Customer ?? []).map(c => ({
    id:      c.Id,
    name:    c.DisplayName,
    balance: parseFloat(c.Balance) || 0,
  }));

  const purchaseOrders = (poData.QueryResponse?.PurchaseOrder ?? []).map(po => ({
    po:       po.DocNumber,
    date:     po.TxnDate,
    supplier: po.VendorRef?.name ?? 'Unknown',
    net:      parseFloat(po.TotalAmt) || 0,
    gross:    parseFloat(po.TotalAmt) || 0,
    status:   po.POStatus ?? 'Open',
  }));

  const bills = (billData.QueryResponse?.Bill ?? []).map(b => {
    const linkedPO = (b.LinkedTxn ?? []).find(t => t.TxnType === 'PurchaseOrder');
    return {
      bill:     b.DocNumber,
      po:       linkedPO?.TxnId ?? '',
      supplier: b.VendorRef?.name ?? 'Unknown',
      net:      parseFloat(b.TotalAmt) || 0,
      date:     b.TxnDate,
    };
  });

  return { customers, purchaseOrders, bills, pnl: parsePnL(pnlReport) };
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/qbo-snapshot
// Returns live QBO data shaped like the MOCK_DATA object in index.html.
// Results are cached in memory for 5 minutes to limit API calls.
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/qbo-snapshot', async (req, res) => {
  const { QBO_CLIENT_ID, QBO_CLIENT_SECRET, QBO_REFRESH_TOKEN, QBO_REALM_ID } = process.env;
  if (!QBO_CLIENT_ID || !QBO_CLIENT_SECRET || !QBO_REFRESH_TOKEN || !QBO_REALM_ID) {
    return res.status(503).json({ error: 'QBO credentials not configured' });
  }

  if (snapshotCache.data && Date.now() - snapshotCache.timestamp < CACHE_TTL) {
    return res.json(snapshotCache.data);
  }

  try {
    const snapshot     = await fetchQboSnapshot();
    snapshotCache      = { data: snapshot, timestamp: Date.now() };
    res.json(snapshot);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/chat
// Receives { system, messages } from the browser, forwards to Anthropic,
// and returns Claude's response — without ever exposing the API key.
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  const { system, messages } = req.body;

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system,
        messages,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message ?? 'Anthropic API error' });
    }

    res.json(data);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Ops Assistant running at http://localhost:${PORT}`);
});
