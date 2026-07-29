import type { VercelRequest, VercelResponse } from '@vercel/node';

const KEY = process.env.TAGO_API_KEY || '';
const BASE = 'https://apis.data.go.kr/1613000';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { lat, lon } = req.query as Record<string, string>;
  if (!lat || !lon) return res.status(400).json({ error: 'lat, lon 필요' });

  try {
    const r = await fetch(
      `${BASE}/BusSttnInfoInqireService/getCrdntPrxmtSttnList?serviceKey=${KEY}&gpsLati=${lat}&gpsLong=${lon}&_type=json&numOfRows=1`
    );
    const text = await r.text();
    let data: any = null;
    try { data = JSON.parse(text); } catch { console.warn('[tago-city-code] JSON 파싱 실패:', text.slice(0, 200)); }

    // 서울은 이 API 커버리지가 없어 빈 결과가 정상 — 기본값 11(서울)로 처리
    const item = data?.response?.body?.items?.item;
    const first = Array.isArray(item) ? item[0] : item;
    const cityCode = first?.citycode ? String(first.citycode) : '11';

    return res.json({ cityCode });
  } catch (e: any) {
    return res.status(200).json({ cityCode: '11', error: e.message });
  }
}
