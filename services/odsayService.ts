import { HybridRoute, RouteSegment } from '../types';
import { getCoordinates } from './tmapService';

const API_KEY = import.meta.env.VITE_ODSAY_API_KEY || '';
const BASE = 'https://api.odsay.com/v1/api';

// trafficType: 1=지하철, 2=버스, 3=도보
const toSegmentType = (t: number): 'subway' | 'bus' | 'walk' => {
  if (t === 1) return 'subway';
  if (t === 2) return 'bus';
  return 'walk';
};

const toHHMM = (totalMinutesFromNow: number): string => {
  const d = new Date(Date.now() + totalMinutesFromNow * 60000);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
};

export const getOdsayTransitRoutes = async (
  startLoc: string,
  endLoc: string
): Promise<{ routes: HybridRoute[]; fullTaxiCost: number }> => {

  // 1. 좌표 변환 (기존 함수 재사용)
  const [startCoords, endCoords] = await Promise.all([
    getCoordinates(startLoc),
    getCoordinates(endLoc),
  ]);

  if (!startCoords || !endCoords) {
    throw new Error('출발지 또는 도착지 좌표를 찾을 수 없습니다.');
  }

  // 2. ODsay 경로 탐색
  const url = `${BASE}/searchPubTransPathT?SX=${startCoords.lon}&SY=${startCoords.lat}&EX=${endCoords.lon}&EY=${endCoords.lat}&apiKey=${API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();

  console.log('ODsay 경로 탐색 응답:', data);

  if (data.error) {
    throw new Error(`ODsay 오류: ${data.error.message || data.error}`);
  }

  const paths = data.result?.path;
  if (!paths || paths.length === 0) {
    throw new Error('경로를 찾을 수 없습니다.');
  }

  const fullTaxiCost = 35000;
  let elapsedMinutes = 0;

  const routes: HybridRoute[] = paths.slice(0, 3).map((path: any, idx: number) => {
    const info = path.info;
    const totalCost = info.payment || info.totalFare || 0;
    const totalDuration = info.totalTime || 0;

    const rawSegments = (path.subPath || []).map((sub: any) => ({
      type: toSegmentType(sub.trafficType),
      duration: sub.sectionTime || 0,
      lineName: sub.lane?.[0]?.name || sub.lane?.[0]?.busNo || '',
      busNos: (sub.lane || []).map((l: any) => l.busNo).filter(Boolean).join(', '),
      startName: sub.startName || '',
      endName: sub.endName || '',
      sub,
    }));

    // 도보 구간의 빈 역명을 앞뒤 대중교통 구간에서 채움
    rawSegments.forEach((seg, i) => {
      if (seg.type === 'walk') {
        if (!seg.startName && i > 0) seg.startName = rawSegments[i - 1].endName || rawSegments[i - 1].startName;
        if (!seg.endName && i < rawSegments.length - 1) seg.endName = rawSegments[i + 1].startName || rawSegments[i + 1].endName;
      }
    });

    const segments: RouteSegment[] = rawSegments.map(({ type, duration, lineName, busNos, startName, endName, sub }) => {
      let instruction = '';
      let alightInstruction: string | undefined;

      if (type === 'walk') {
        if (startName && endName) instruction = `${startName}에서 ${endName}까지 도보 이동`;
        else if (endName) instruction = `${endName}까지 도보 이동`;
        else if (startName) instruction = `${startName}에서 도보 이동`;
        else instruction = `도보 이동`;
      } else if (type === 'subway') {
        instruction = startName ? `${startName}역 ${lineName} 승차` : `${lineName} 승차`;
        alightInstruction = endName ? `${endName}역 하차` : undefined;
      } else {
        const nos = busNos || lineName;
        instruction = startName ? `${startName} 정류장 승차 ${nos}` : `${nos} 버스 승차`;
        alightInstruction = endName ? `${endName} 정류장 하차` : undefined;
      }

      // 경로 좌표 (passStopList)
      const path: { lat: number; lng: number }[] = [];
      (sub.passStopList?.stations || []).forEach((s: any) => {
        if (s.x && s.y) path.push({ lat: Number(s.y), lng: Number(s.x) });
      });
      // 최소 시작/끝 좌표 보장
      if (path.length === 0 && sub.startX && sub.startY) {
        path.push({ lat: Number(sub.startY), lng: Number(sub.startX) });
        path.push({ lat: Number(sub.endY), lng: Number(sub.endX) });
      }

      const segDeparture = toHHMM(elapsedMinutes);
      elapsedMinutes += duration;
      const segArrival = toHHMM(elapsedMinutes);

      return {
        type,
        instruction,
        alightInstruction,
        durationMinutes: duration,
        cost: 0,
        lineName,
        startName,
        endName,
        path,
        departureTime: segDeparture,
        arrivalTime: segArrival,
      };
    });

    // 환승 지점 = 마지막 대중교통 구간의 종점
    const lastTransit = [...segments].reverse().find(s => s.type !== 'walk');
    const transferPoint = lastTransit?.endName || '도착지 인근';

    const departureTime = toHHMM(idx * 10);

    return {
      id: `odsay-${idx}`,
      name: `추천 경로 ${idx + 1} 🗺️`,
      totalCost,
      totalDuration,
      savedAmount: Math.max(0, fullTaxiCost - totalCost),
      transferPoint,
      departureTime,
      taxiCostOnly: fullTaxiCost,
      segments,
    };
  });

  return { routes, fullTaxiCost };
};
