import type { VercelRequest, VercelResponse } from '@vercel/node';

const VALID_EVENTS = ['visit', 'search', 'signup', 'taxi'];
const SHEET_ID = process.env.GOOGLE_SHEET_ID || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const event = req.body?.event;
  if (!VALID_EVENTS.includes(event)) return res.status(400).json({ error: 'Invalid event' });

  try {
    if (SHEET_ID && process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) {
      const { getGoogleAccessToken } = await import('./_sheetsAuth.js');
      const token = await getGoogleAccessToken();
      const timestamp = new Date().toISOString();

      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Log!A:B:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ values: [[timestamp, event]] }),
        }
      );
    }
  } catch (e) {
    console.error('track error:', e);
  }

  res.status(200).json({ ok: true });
}
