import React, { useState, useEffect, useCallback } from 'react';
import { Clock } from 'lucide-react';
import { getSubwayArrivals, resolveSubwayDirection, lineNameToSubwayId } from '../services/realtimeService';
import { RouteSegment } from '../types';

interface Props {
  firstTransitSeg: RouteSegment | undefined;
  walkMinutes: number;
  routeIndex: number;
}

function getComment(leaveInMins: number, routeIndex: number): string {
  if (routeIndex === 1) return '막병 시키자~ 🍾';
  if (routeIndex === 2) return '빠르게 2차 고? 🥂';
  if (leaveInMins <= 0) return '놓치겠다! 뛰어!! 🏃‍♂️';
  if (leaveInMins < 20) return '편의점도 못 들려! 서둘러! 💦';
  if (leaveInMins < 40) return '아쉬운데 한 잔만 더? 🍺';
  if (leaveInMins < 60) return '노래방 막곡 가능! 🎤';
  if (leaveInMins < 90) return '천천히 마셔도 됨 🐢';
  return '해장국 먹고 가도 되겠는데? 🍲';
}

const RouteCardCountdown: React.FC<Props> = ({ firstTransitSeg, walkMinutes, routeIndex }) => {
  const [nextTransitMs, setNextTransitMs] = useState<number | null>(null);
  const [trainArrivalTime, setTrainArrivalTime] = useState<string | null>(null); // "HH:MM"
  const [trainMinutesLeft, setTrainMinutesLeft] = useState<number | null>(null); // 열차까지 남은 분
  const [loading, setLoading] = useState(firstTransitSeg?.type === 'subway');
  const [, setTick] = useState(0);

  const fetchRealtime = useCallback(async () => {
    if (firstTransitSeg?.type !== 'subway' || !firstTransitSeg.startName) return;
    const clean = firstTransitSeg.startName.replace(/역$/, '').trim();
    const dir = resolveSubwayDirection(firstTransitSeg.lineName, firstTransitSeg.wayCode);
    const sid = lineNameToSubwayId(firstTransitSeg.lineName || '') || undefined;
    const arrivals = await getSubwayArrivals(clean, dir, sid);
    if (arrivals.length > 0) {
      const first = arrivals[0];
      setNextTransitMs(Date.now() + first.minutesLeft * 60000);
      setTrainArrivalTime(first.arrivalTime || null);
      setTrainMinutesLeft(first.minutesLeft);
    }
    setLoading(false);
  }, [firstTransitSeg?.type, firstTransitSeg?.startName, firstTransitSeg?.nextStationName]);

  useEffect(() => {
    fetchRealtime();
    const id = setInterval(fetchRealtime, 30000);
    return () => clearInterval(id);
  }, [fetchRealtime]);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 5000);
    return () => clearInterval(id);
  }, []);

  // 출발까지 남은 시간 = 열차 도착 - 지금 - 도보 시간
  const leaveInMs = nextTransitMs !== null
    ? nextTransitMs - Date.now() - walkMinutes * 60000
    : null;
  const leaveInMins = leaveInMs !== null ? Math.round(leaveInMs / 60000) : null;
  const leaveInSecs = leaveInMs !== null ? Math.max(0, Math.floor(leaveInMs / 1000)) : null;

  const isSubway = firstTransitSeg?.type === 'subway';
  const isBus = firstTransitSeg?.type === 'bus';

  // ─── 버스·택시·도보 첫 탑승 ──────────────────────────────────────────
  if (!isSubway) {
    const transitIcon = isBus ? '🚌' : firstTransitSeg?.type === 'taxi' ? '🚕' : '🚶';
    const transitLabel = isBus ? (firstTransitSeg?.lineName || '버스') : firstTransitSeg?.type === 'taxi' ? '택시' : '도보';
    const comment = getComment(999, routeIndex);
    return (
      <div className="space-y-0">
        {/* 코멘트 배너 */}
        <div className="rounded-2xl px-4 py-3 flex items-center gap-3 bg-blue-50 mb-3">
          <Clock className="w-4 h-4 shrink-0 text-brandBlue" />
          <div className="min-w-0">
            <p className="text-[11px] text-gray-500 font-bold">
              {walkMinutes > 0
                ? <>도보 <span className="font-black text-gray-800">{walkMinutes}분</span> 후 탑승</>
                : <span className="font-black text-gray-800">바로 탑승 가능</span>}
            </p>
            <p className="text-sm font-black text-brandBlue truncate">"{comment}"</p>
          </div>
        </div>
        {/* 탑승 수단 + 도보 시간 정보 박스 */}
        <div className="rounded-xl bg-gray-50 px-3 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">{transitIcon}</span>
            <div>
              <p className="text-[10px] text-gray-400 font-bold">첫 탑승 수단</p>
              <p className="text-sm font-black text-gray-800">{transitLabel}</p>
            </div>
          </div>
          <div className="h-8 w-px bg-gray-200" />
          <div className="flex items-center gap-1.5">
            <span className="text-base">🚶</span>
            <div>
              <p className="text-[10px] text-gray-400 font-bold">정류장까지 도보</p>
              <p className="text-sm font-black text-gray-800">
                {walkMinutes > 0 ? `${walkMinutes}분` : '바로'}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── 실시간 조회 중 ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-2">
        <div className="rounded-2xl px-4 py-3 flex items-center gap-3 bg-gray-50">
          <div className="w-4 h-4 border-2 border-gray-200 border-t-brandBlue rounded-full animate-spin shrink-0" />
          <p className="text-xs text-gray-400 font-bold">실시간 열차 조회 중...</p>
        </div>
      </div>
    );
  }

  // ─── 실시간 데이터 없음 (폴백) ───────────────────────────────────────
  if (leaveInMins === null) {
    return (
      <div className="space-y-2">
        <div className="rounded-2xl px-4 py-3 flex items-center gap-3 bg-gray-50">
          <Clock className="w-4 h-4 shrink-0 text-gray-400" />
          <p className="text-xs text-gray-400 font-bold">실시간 정보 없음 · 도보 {walkMinutes}분 소요</p>
        </div>
      </div>
    );
  }

  const urgent = leaveInMins <= 1;
  const comment = getComment(leaveInMins, routeIndex);
  const mins = leaveInSecs !== null ? Math.floor(leaveInSecs / 60) : 0;
  const secs = leaveInSecs !== null ? leaveInSecs % 60 : 0;

  return (
    <div className="space-y-0">
      {/* 긴박도 배너 */}
      <div className={`rounded-2xl px-4 py-3 flex items-center gap-3 mb-3 ${urgent ? 'bg-red-50' : 'bg-blue-50'}`}>
        <Clock className={`w-4 h-4 shrink-0 ${urgent ? 'text-red-500 animate-pulse' : 'text-brandBlue'}`} />
        <div className="min-w-0">
          <p className="text-[11px] text-gray-500 font-bold">
            {urgent
              ? <span className="font-black text-red-500">지금 출발!</span>
              : <>출발까지 <span className="font-black text-gray-800">{leaveInMins}분</span> 남음</>}
          </p>
          <p className={`text-sm font-black truncate ${urgent ? 'text-red-500' : 'text-brandBlue'}`}>
            "{comment}"
          </p>
        </div>
      </div>

      {/* 열차 정보 + 도보 시간 */}
      <div className="rounded-xl bg-gray-50 px-3 py-2.5 flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-base">🚇</span>
          <div>
            <p className="text-[10px] text-gray-400 font-bold">다음 열차</p>
            <p className="text-sm font-black text-gray-800">
              {trainArrivalTime
                ? <>{trainArrivalTime} 도착</>
                : '--:-- 도착'}
            </p>
          </div>
        </div>
        <div className="h-8 w-px bg-gray-200" />
        <div className="text-center">
          <p className="text-[10px] text-gray-400 font-bold">열차까지</p>
          <p className="text-sm font-black text-brandMint">
            {trainMinutesLeft !== null ? `${trainMinutesLeft}분 후` : '--분 후'}
          </p>
        </div>
        <div className="h-8 w-px bg-gray-200" />
        <div className="flex items-center gap-1.5">
          <span className="text-base">🚶</span>
          <div>
            <p className="text-[10px] text-gray-400 font-bold">역까지 도보</p>
            <p className="text-sm font-black text-gray-800">
              {walkMinutes > 0 ? `${walkMinutes}분` : '바로'}
            </p>
          </div>
        </div>
      </div>

      {/* 초 단위 카운트다운 */}
      <div className="border-t border-gray-100 pt-3">
        <p className="text-[10px] text-gray-400 font-bold mb-1">
          지금 출발해야 할 시간까지{walkMinutes > 0 ? ` (도보 ${walkMinutes}분 포함)` : ''}
        </p>
        <div className={`flex items-center gap-2 font-mono font-bold text-xl ${urgent ? 'text-red-500 animate-pulse' : 'text-brandBlue'}`}>
          <Clock className="w-5 h-5" />
          {leaveInMins <= 0
            ? <span>지금 출발!</span>
            : <span>{mins}분 {secs.toString().padStart(2, '0')}초</span>}
        </div>
      </div>
    </div>
  );
};

export default RouteCardCountdown;
