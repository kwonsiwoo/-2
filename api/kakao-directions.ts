import type { VercelRequest, VercelResponse } from '@vercel/node';

const API_KEY = process.env.KAKAO_REST_API_KEY || '';
const BASE = 'https://apis-navi.kakaomobility.com/v1/directions';

// 카카오모빌리티 자동차 길찾기 — 택시/드라이빙 구간 실제 도로 경로용.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { origin, destination } = req.query as Record<string, string>;

  if (!API_KEY) {
    return res.status(500).json({ error: 'KAKAO_REST_API_KEY 환경변수가 설정되지 않았습니다' });
  }
  if (!origin || !destination) {
    return res.status(400).json({ error: 'origin, destination이 필요합니다' });
  }

  const qs = new URLSearchParams({ origin, destination }).toString();
  try {
    const r = await fetch(`${BASE}?${qs}`, {
      headers: { Authorization: `KakaoAK ${API_KEY}` },
    });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}
