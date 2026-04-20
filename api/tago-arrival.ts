import type { VercelRequest, VercelResponse } from '@vercel/node';

const KEY = process.env.TAGO_API_KEY || '';
const BASE = 'https://apis.data.go.kr/1613000';

const toItems = (data: any): any[] => {
  const item = data?.response?.body?.items?.item;
  if (!item) return [];
  return Array.isArray(item) ? item : [item];
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { cityCode = '11', nodeNm, routeNo } = req.query;

  try {
    // 1. 정류소 검색 (이름 → nodeId)
    const stationRes = await fetch(
      `${BASE}/BusSttnInfoInqireService/getSttnNoList?serviceKey=${KEY}&cityCode=${cityCode}&nodeNm=${encodeURIComponent(String(nodeNm || ''))}&_type=json&numOfRows=5`
    );
    const stationData = await stationRes.json();
    const stations = toItems(stationData);

    if (stations.length === 0) {
      return res.json({ arrivals: [], stationName: nodeNm });
    }

    const nodeId = stations[0].nodeid;
    const stationName = stations[0].nodenm;

    // 2. 도착 예정 정보 조회
    const arrivalRes = await fetch(
      `${BASE}/ArvlInfoInqireService/getSttnAcctoArvlPrearngeInfoList?serviceKey=${KEY}&cityCode=${cityCode}&nodeId=${nodeId}&_type=json&numOfRows=10`
    );
    const arrivalData = await arrivalRes.json();
    const arrivals = toItems(arrivalData).map((item: any) => ({
      routeNo: item.routeno || '',
      routeId: item.routeid || '',
      arrtime: Number(item.arrtime || 0),      // 초
      remainStop: Number(item.arrprevstationcnt || 0),
      vehicleNo: item.vehicletp || '',
    }));

    // routeNo 필터 (lineName 전달 시)
    const filtered = routeNo
      ? arrivals.filter((a: any) => a.routeNo.includes(String(routeNo)))
      : arrivals;

    return res.json({ stationName, nodeId, arrivals: filtered.slice(0, 6) });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}
