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

  const { cityCode = '11', routeNo } = req.query;

  try {
    // 1. 노선 번호 → routeId 조회
    const routeRes = await fetch(
      `${BASE}/BusRouteInfoInqireService/getRouteNoList?serviceKey=${KEY}&cityCode=${cityCode}&routeNo=${encodeURIComponent(String(routeNo || ''))}&_type=json&numOfRows=5`
    );
    const routeData = await routeRes.json();
    const routes = toItems(routeData);

    if (routes.length === 0) {
      return res.json({ buses: [] });
    }

    const routeId = routes[0].routeid;
    const routeName = routes[0].routeno;

    // 2. 해당 노선 버스 위치 조회
    const locRes = await fetch(
      `${BASE}/BusLcInfoInqireService/getRouteAcctoBusLcList?serviceKey=${KEY}&cityCode=${cityCode}&routeId=${routeId}&_type=json`
    );
    const locData = await locRes.json();
    const buses = toItems(locData).map((b: any) => ({
      vehicleNo: b.vehicleno || '',
      lat: Number(b.gpslati || 0),
      lng: Number(b.gpslong || 0),
      nodeId: b.nodeid || '',
      nodeName: b.nodenm || '',
      remainStop: Number(b.remainseatcnt || 0),
    }));

    return res.json({ routeId, routeName, buses });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}
