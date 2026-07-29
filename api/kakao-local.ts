import type { VercelRequest, VercelResponse } from '@vercel/node';

const API_KEY = process.env.KAKAO_REST_API_KEY || '';
const BASE = 'https://dapi.kakao.com/v2/local';

const ENDPOINTS: Record<string, string> = {
  address: '/search/address.json',
  keyword: '/search/keyword.json',
  coord2address: '/geo/coord2address.json',
  coord2regioncode: '/geo/coord2regioncode.json',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { type, ...params } = req.query as Record<string, string>;

  if (!API_KEY) {
    return res.status(500).json({ error: 'KAKAO_REST_API_KEY 환경변수가 설정되지 않았습니다' });
  }

  const path = ENDPOINTS[type];
  if (!path) {
    return res.status(400).json({ error: `알 수 없는 type: ${type}` });
  }

  const qs = new URLSearchParams(params as Record<string, string>).toString();
  try {
    const r = await fetch(`${BASE}${path}?${qs}`, {
      headers: { Authorization: `KakaoAK ${API_KEY}` },
    });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}
