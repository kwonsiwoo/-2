import type { VercelRequest, VercelResponse } from '@vercel/node';

const API_KEY = process.env.KAKAO_REST_API_KEY || '';
const BASE = 'https://dapi.kakao.com/v2/routing/walk';

// 카카오맵 도보 길찾기 — 도보 구간 실제 보행 경로용.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { start_x, start_y, end_x, end_y } = req.query as Record<string, string>;

  if (!API_KEY) {
    return res.status(500).json({ error: 'KAKAO_REST_API_KEY 환경변수가 설정되지 않았습니다' });
  }
  if (!start_x || !start_y || !end_x || !end_y) {
    return res.status(400).json({ error: 'start_x, start_y, end_x, end_y가 필요합니다' });
  }

  const qs = new URLSearchParams({ start_x, start_y, end_x, end_y, input_coord: 'WGS84' }).toString();
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
