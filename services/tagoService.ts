export interface BusArrivalInfo {
  routeNo: string;
  routeId: string;
  arrtime: number;      // 초
  remainStop: number;   // 앞 정류장 수
  vehicleNo: string;
}

export interface BusLocation {
  vehicleNo: string;
  lat: number;
  lng: number;
  nodeName: string;     // 현재 위치 정류소
}

export interface TagoArrivalResult {
  stationName: string;
  nodeId: string;
  arrivals: BusArrivalInfo[];
}

// 초 → "N분 후" 또는 "곧 도착"
export const formatArrtime = (seconds: number): string => {
  if (seconds <= 60) return '곧 도착 🔴';
  const min = Math.round(seconds / 60);
  if (min <= 5) return `${min}분 후 🟠`;
  return `${min}분 후`;
};

// 버스 도착 예정 조회
export const getBusArrivals = async (
  stationName: string,
  routeNo?: string,
  cityCode = '11'
): Promise<TagoArrivalResult> => {
  const params = new URLSearchParams({ cityCode, nodeNm: stationName });
  if (routeNo) params.set('routeNo', routeNo);

  const res = await fetch(`/api/tago-arrival?${params}`);
  if (!res.ok) throw new Error('버스 도착 정보 조회 실패');
  return res.json();
};

// 버스 위치 조회
export const getBusLocations = async (
  routeNo: string,
  cityCode = '11'
): Promise<BusLocation[]> => {
  const res = await fetch(`/api/tago-location?cityCode=${cityCode}&routeNo=${encodeURIComponent(routeNo)}`);
  if (!res.ok) throw new Error('버스 위치 조회 실패');
  const data = await res.json();
  return data.buses || [];
};
