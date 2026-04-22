import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getGoogleAccessToken } from './_sheetsAuth';

const VALID_EVENTS = ['visit', 'search', 'signup', 'taxi'];
const SHEET_ID = process.env.GOOGLE_SHEET_ID || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const event = req.body?.event;
  const isDebug = req.body?.debug === true;

  if (!VALID_EVENTS.includes(event)) return res.status(400).json({ error: 'Invalid event', received: event });

  const log: string[] = [];

  try {
    if (!SHEET_ID) { log.push('SHEET_ID 없음'); throw new Error('GOOGLE_SHEET_ID 미설정'); }
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) { log.push('EMAIL 없음'); throw new Error('GOOGLE_SERVICE_ACCOUNT_EMAIL 미설정'); }

    log.push('인증 시도 중...');
    const token = await getGoogleAccessToken();
    log.push('인증 성공');

    const timestamp = new Date().toISOString();
    const range = encodeURIComponent('Log!A:B');
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;

    log.push(`Sheets 쓰기 시도: ${url}`);
    const r = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [[timestamp, event]] }),
    });

    const body = await r.text();
    log.push(`Sheets 응답 ${r.status}: ${body.slice(0, 200)}`);

    if (!r.ok) throw new Error(`Sheets 오류 ${r.status}: ${body.slice(0, 200)}`);

    return res.status(200).json({ ok: true, ...(isDebug ? { log } : {}) });

  } catch (e: any) {
    log.push(`예외: ${e.message}`);
    console.error('track error:', e.message);
    // 디버그 모드면 에러 상세 반환, 아니면 조용히 200
    if (isDebug) return res.status(200).json({ ok: false, error: e.message, log });
    return res.status(200).json({ ok: false });
  }
}
