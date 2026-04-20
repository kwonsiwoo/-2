const SUBWAY_LINE_MAP: Record<string, string> = {
  '1001': '1호선', '1002': '2호선', '1003': '3호선', '1004': '4호선',
  '1005': '5호선', '1006': '6호선', '1007': '7호선', '1008': '8호선',
  '1009': '9호선', '1063': '경의중앙선', '1065': '공항철도', '1067': '경춘선',
  '1075': 'GTX-A', '1077': '신분당선', '1092': '우이신설선',
};

export interface SubwayArrival {
  line: string;
  destination: string;
  message: string;      // "2분 후", "잠시 후"
  prevStation: string;
}

export interface BusArrival {
  routeName: string;
  arrivalTime: string;
  remainStop: number;
}

// 지하철 실시간 도착 (역명)
export const getSubwayArrivals = async (stationName: string): Promise<SubwayArrival[]> => {
  try {
    const clean = stationName.replace(/역$/, '').replace(/\(.*\)/, '').trim();
    const url = `/api/subway?station=${encodeURIComponent(clean)}`;

    const res = await fetch(url);
    const data = await res.json();

    if (!data.realtimeArrivalList) return [];

    return data.realtimeArrivalList.slice(0, 4).map((item: any) => ({
      line: item.subwayNm || SUBWAY_LINE_MAP[item.subwayId] || item.subwayId,
      destination: item.trainLineNm || '',
      message: item.arvlMsg2 || '정보없음',
      prevStation: item.arvlMsg3 || '',
    }));
  } catch (e) {
    console.error('지하철 실시간 도착 오류:', e);
    return [];
  }
};

// 버스 실시간 도착 (정류소 이름)
export const getBusArrivals = async (stationName: string, routeName?: string): Promise<BusArrival[]> => {
  try {
    const clean = stationName.replace(/정류장$/, '').replace(/정류소$/, '').trim();
    const url = `/api/bus?stationName=${encodeURIComponent(clean)}&routeName=${encodeURIComponent(routeName || '')}`;

    const res = await fetch(url);
    const data = await res.json();

    return (data.arrivals || []).slice(0, 4);
  } catch (e) {
    console.error('버스 실시간 도착 오류:', e);
    return [];
  }
};
