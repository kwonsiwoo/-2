import type { VercelRequest, VercelResponse } from '@vercel/node';

const CLIENT_ID = process.env.NAVER_CLIENT_ID || '';
const CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET || '';
const BASE = 'https://openapi.naver.com/v1/search/local.json';

const stripTags = (s: string): string => s.replace(/<[^>]*>/g, '');

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { query, display = '8' } = req.query as Record<string, string>;
  if (!query) return res.status(400).json({ error: 'query 필요' });

  if (!CLIENT_ID || !CLIENT_SECRET) {
    return res.status(500).json({ error: 'NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 환경변수가 설정되지 않았습니다' });
  }

  try {
    const r = await fetch(
      `${BASE}?query=${encodeURIComponent(query)}&display=${display}&sort=random`,
      {
        headers: {
          'X-Naver-Client-Id': CLIENT_ID,
          'X-Naver-Client-Secret': CLIENT_SECRET,
        },
      },
    );
    const data = await r.json();
    const items = (data.items || []).map((item: any) => ({
      name: stripTags(item.title || ''),
      category: item.category || '',
      address: item.roadAddress || item.address || '',
      lat: Number(item.mapy) / 1e7,
      lon: Number(item.mapx) / 1e7,
    })).filter((p: any) => p.lat && p.lon);

    res.status(r.status).json({ items });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}
