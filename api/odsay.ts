import type { VercelRequest, VercelResponse } from '@vercel/node';

const API_KEY = process.env.ODSAY_API_KEY || '';
const BASE = 'https://api.odsay.com/v1/api';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { SX, SY, EX, EY } = req.query as Record<string, string>;

  if (!API_KEY) {
    return res.status(500).json({ error: [{ code: 'NO_KEY', message: 'ODSAY_API_KEY 환경변수가 설정되지 않았습니다' }] });
  }
  try {
    const url = `${BASE}/searchPubTransPathT?SX=${SX}&SY=${SY}&EX=${EX}&EY=${EY}&apiKey=${API_KEY}`;
    const r = await fetch(url);
    const data = await r.json();
    res.setHeader('X-Proxy', 'odsay-vercel');
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: [{ code: '500', message: e.message }] });
  }
}
