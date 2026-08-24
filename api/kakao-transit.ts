import type { VercelRequest, VercelResponse } from '@vercel/node';

const API_KEY = process.env.KAKAO_REST_API_KEY || '';
const BASE = 'https://dapi.kakao.com/v2/routing/publictraffic';

// 카카오맵 대중교통 길찾기 — ODsay 쿼터 초과 시 폴백으로 사용.
// 공식 문서에는 안 나오지만 실제 REST API 키로 정상 동작 확인됨(2026.08).
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
