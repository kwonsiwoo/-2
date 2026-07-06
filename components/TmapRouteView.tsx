import React, { useEffect, useRef, useCallback } from 'react';
import { HybridRoute } from '../types';

const getSubwayColor = (lineName: string): string => {
  const n = lineName || '';
  if (n.includes('1호선')) return '#0052A4';
  if (n.includes('2호선')) return '#00A84D';
  if (n.includes('3호선')) return '#EF7C1C';
  if (n.includes('4호선')) return '#00A4E3';
  if (n.includes('5호선')) return '#996CAC';
  if (n.includes('6호선')) return '#CD7C2F';
  if (n.includes('7호선')) return '#747F00';
  if (n.includes('8호선')) return '#E6186C';
  if (n.includes('9호선')) return '#BDB092';
  if (n.includes('신분당')) return '#D31145';
  if (n.includes('분당') || n.includes('수인')) return '#F5A200';
  if (n.includes('경의') || n.includes('중앙')) return '#77C4A3';
  if (n.includes('경춘')) return '#0C8E72';
  if (n.includes('공항')) return '#0065B3';
  if (n.includes('GTX')) return '#9C4EA8';
  return '#06D6A0';
};

const segmentColor = (seg: any): string => {
  if (seg.type === 'walk')   return '#9CA3AF';
  if (seg.type === 'taxi')   return '#F97316';
  if (seg.type === 'bus')    return '#3B82F6';
  if (seg.type === 'subway') return getSubwayColor(seg.lineName || '');
  return '#06D6A0';
};

const loadKakaoSDK = (): Promise<void> =>
  new Promise((resolve, reject) => {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const w = window as any;
    if (w.kakao?.maps?.Map) { resolve(); return; }
    if (!w.kakao?.maps?.load) {
      reject(new Error('카카오맵 SDK가 로드되지 않았습니다. index.html 스크립트 태그를 확인하세요.'));
      return;
    }
    w.kakao.maps.load(resolve);
    /* eslint-enable */
  });

// 도보 실제 경로 좌표 (Tmap 보행자 API) — 캐시 포함
const walkPathCache = new Map<string, { lat: number; lng: number }[]>();
async function fetchWalkPathDirect(
  startLat: number, startLng: number,
  endLat: number,   endLng: number,
): Promise<{ lat: number; lng: number }[]> {
  const key = `${startLat.toFixed(5)},${startLng.toFixed(5)}->${endLat.toFixed(5)},${endLng.toFixed(5)}`;
  if (walkPathCache.has(key)) return walkPathCache.get(key)!;

  const appKey = ((import.meta as any).env?.VITE_TMAP_APP_KEY || '').trim();
  if (!appKey) return [];
  try {
    const res = await fetch('https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1', {
      method: 'POST',
      headers: { appKey, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        startX: String(startLng), startY: String(startLat),
        endX: String(endLng),   endY: String(endLat),
        startName: '출발', endName: '도착',
        reqCoordType: 'WGS84GEO', resCoordType: 'WGS84GEO', searchOption: '0',
      }),
    });
    const data = await res.json();
    const path: { lat: number; lng: number }[] = [];
    for (const f of (data.features || [])) {
      if (f.geometry?.type === 'LineString') {
        for (const coord of (f.geometry.coordinates as number[][])) {
          path.push({ lat: Number(coord[1]), lng: Number(coord[0]) });
        }
      }
    }
    const types = (data.features || []).map((f: any) => f.geometry?.type).join(',');
    console.log('[도보경로]', key, `→ features:${(data.features||[]).length} types:[${types}] points:${path.length}`);
    walkPathCache.set(key, path);
    return path;
  } catch (e) {
    console.error('[도보경로 오류]', e);
    return [];
  }
}

interface Props {
  route: HybridRoute;
  height?: string;
}

const TmapRouteView: React.FC<Props> = ({ route, height = '40vh' }) => {
  const mapRef    = useRef<HTMLDivElement>(null);
  const mapInst   = useRef<any>(null);
  const overlays  = useRef<any[]>([]);
  const plines    = useRef<any[]>([]);

  const clearMap = () => {
    overlays.current.forEach(o => o.setMap(null));
    overlays.current = [];
    plines.current.forEach(p => p.setMap(null));
    plines.current = [];
  };

  const addOverlay = (map: any, kakao: any, lat: number, lng: number, html: string, yAnchor = 1.1) => {
    const o = new kakao.maps.CustomOverlay({
      position: new kakao.maps.LatLng(lat, lng),
      content: html,
      yAnchor,
    });
    o.setMap(map);
    overlays.current.push(o);
  };

  useEffect(() => {
    if (!mapRef.current) return;

    const segments = route.segments || [];
    const allCoords: { lat: number; lng: number }[] = [];
    segments.forEach((seg: any) => seg.path?.forEach((p: any) => allCoords.push(p)));
    if (allCoords.length === 0) return;

    let cancelled = false;

    loadKakaoSDK().then(async () => {
      if (cancelled || !mapRef.current) return;

      /* eslint-disable @typescript-eslint/no-explicit-any */
      const kakao: any = (window as any).kakao;
      /* eslint-enable */

      if (mapInst.current) { clearMap(); mapInst.current = null; }

      const center = allCoords[Math.floor(allCoords.length / 2)];
      const map = new kakao.maps.Map(mapRef.current, {
        center: new kakao.maps.LatLng(center.lat, center.lng),
        level: 5,
      });
      mapInst.current = map;

      // ── walk 좌표 보완: path 없는 도보 구간은 인접 segment 끝점 + 실제 출발/도착 좌표로 직선 ──
      const origPt  = route.origLat && route.origLng ? { lat: route.origLat, lng: route.origLng } : null;
      const destPt  = route.destLat && route.destLng ? { lat: route.destLat, lng: route.destLng } : null;
      const isFirstWalk = (idx: number) => idx === 0 || segments.slice(0, idx).every((s: any) => s.type === 'walk');
      const isLastWalk  = (idx: number) => segments.slice(idx + 1).every((s: any) => s.type === 'walk');

      const enriched: any[] = segments.map((seg: any, idx: number) => {
        if (seg.type !== 'walk' || (seg.path?.length ?? 0) >= 2) return seg;
        const prev = segments[idx - 1];
        const next = segments[idx + 1];

        // 첫 번째 도보: 실제 출발 좌표 사용
        const startFallback = isFirstWalk(idx) ? origPt : null;
        // 마지막 도보: 실제 도착 좌표 사용
        const endFallback   = isLastWalk(idx)  ? destPt : null;

        const start = prev?.path?.at?.(-1) ?? startFallback;
        const end   = next?.path?.[0]      ?? endFallback;

        if (start && end && (start.lat !== end.lat || start.lng !== end.lng)) {
          return { ...seg, path: [start, end] };
        }
        return seg;
      });

      // ── walk 직선(2점) → Tmap 실제 보행 경로로 교체 ──────────────────────
      if (!cancelled) {
        await Promise.all(enriched.map(async (seg, i) => {
          if (seg.type !== 'walk' || (seg.path?.length ?? 0) !== 2) return;
          const [s, e] = seg.path;
          const actual = await fetchWalkPathDirect(s.lat, s.lng, e.lat, e.lng);
          if (actual.length >= 2) enriched[i] = { ...seg, path: actual };
        }));
      }
      if (cancelled || !mapRef.current) return;

      // ── 1차: 대중교통·택시 폴리라인 (walk보다 먼저 그려 아래에 위치) ──────
      enriched.forEach((seg: any) => {
        if (seg.type === 'walk' || !seg.path || seg.path.length < 2) return;
        const path  = seg.path.map((p: any) => new kakao.maps.LatLng(p.lat, p.lng));
        const color = segmentColor(seg);
        const shadow = new kakao.maps.Polyline({ path, strokeWeight: 12, strokeColor: '#ffffff', strokeOpacity: 0.85, strokeStyle: 'solid' });
        shadow.setMap(map); plines.current.push(shadow);
        const line = new kakao.maps.Polyline({ path, strokeWeight: 7, strokeColor: color, strokeOpacity: 1, strokeStyle: 'solid' });
        line.setMap(map); plines.current.push(line);
      });

      // ── 2차: 도보 폴리라인 (위에 겹쳐 보이도록 나중에 그림) ──────────────
      enriched.forEach((seg: any) => {
        if (seg.type !== 'walk' || !seg.path || seg.path.length < 2) return;
        const path = seg.path.map((p: any) => new kakao.maps.LatLng(p.lat, p.lng));
        const bg = new kakao.maps.Polyline({ path, strokeWeight: 10, strokeColor: '#ffffff', strokeOpacity: 1, strokeStyle: 'solid' });
        bg.setMap(map); plines.current.push(bg);
        const dash = new kakao.maps.Polyline({ path, strokeWeight: 5, strokeColor: '#38BDF8', strokeOpacity: 1, strokeStyle: 'dash' });
        dash.setMap(map); plines.current.push(dash);

        if (seg.durationMinutes) {
          const mid = seg.path[Math.floor(seg.path.length / 2)];
          addOverlay(map, kakao, mid.lat, mid.lng, `
            <div style="background:white;border:1.5px solid #38BDF8;border-radius:20px;
              padding:3px 10px;font-size:10px;font-weight:800;color:#0EA5E9;
              white-space:nowrap;box-shadow:0 1px 6px rgba(56,189,248,0.15);pointer-events:none;">
              🚶 ${seg.durationMinutes}분
            </div>`, 0.5);
        }
      });

      // ── 출발 마커 (초록) ──────────────────────────────────────────
      const startName = segments[0]?.startName || '출발';
      addOverlay(map, kakao, allCoords[0].lat, allCoords[0].lng, `
        <div style="display:flex;flex-direction:column;align-items:center;gap:3px;pointer-events:none;">
          <div style="width:42px;height:42px;background:#22C55E;border:3.5px solid white;border-radius:50%;
            display:flex;align-items:center;justify-content:center;
            box-shadow:0 4px 16px rgba(34,197,94,0.45);font-size:20px;">📍</div>
          <div style="background:#22C55E;color:white;border-radius:10px;padding:3px 10px;
            font-size:10px;font-weight:900;white-space:nowrap;max-width:100px;
            overflow:hidden;text-overflow:ellipsis;box-shadow:0 2px 8px rgba(34,197,94,0.35);">
            ${startName}
          </div>
        </div>`);

      // ── 도착 마커 (빨강): 실제 목적지 좌표 우선, 없으면 마지막 경로 좌표 사용 ──
      const lastSeg = segments[segments.length - 1];
      const endName = lastSeg?.endName || route.transferPoint || '도착';
      const destLat = route.destLat ?? allCoords[allCoords.length - 1].lat;
      const destLng = route.destLng ?? allCoords[allCoords.length - 1].lng;
      addOverlay(map, kakao, destLat, destLng, `
        <div style="display:flex;flex-direction:column;align-items:center;gap:3px;pointer-events:none;">
          <div style="width:42px;height:42px;background:#EF4444;border:3.5px solid white;border-radius:50%;
            display:flex;align-items:center;justify-content:center;
            box-shadow:0 4px 16px rgba(239,68,68,0.45);font-size:20px;">🏠</div>
          <div style="background:#EF4444;color:white;border-radius:10px;padding:3px 10px;
            font-size:10px;font-weight:900;white-space:nowrap;max-width:100px;
            overflow:hidden;text-overflow:ellipsis;box-shadow:0 2px 8px rgba(239,68,68,0.35);">
            ${endName}
          </div>
        </div>`);

      // ── 환승·탑승 마커 ────────────────────────────────────────────
      let stepNum = 1;
      segments.forEach((seg: any, idx: number) => {
        if (idx === 0 || !seg.path?.length || seg.type === 'walk') return;
        // 단일 좌표(path 1개)는 폴리라인 없이 탑승 마커만 표시 (택시 환승 지점 등)
        const pos   = seg.path[0];
        const color = segmentColor(seg);
        const emoji = seg.type === 'subway' ? '🚇' : seg.type === 'taxi' ? '🚕' : '🚌';
        const label = seg.lineName || (seg.type === 'taxi' ? '택시' : seg.type === 'bus' ? '버스' : '지하철');
        const name  = seg.startName || label;
        const time  = seg.departureTime || '';
        const num   = stepNum++;

        addOverlay(map, kakao, pos.lat, pos.lng, `
          <div style="display:flex;flex-direction:column;align-items:center;gap:3px;pointer-events:none;">
            <div style="position:relative;">
              <div style="width:38px;height:38px;background:${color};border:3px solid white;border-radius:50%;
                display:flex;align-items:center;justify-content:center;
                box-shadow:0 4px 12px rgba(0,0,0,0.22);font-size:17px;">${emoji}</div>
              <div style="position:absolute;top:-5px;right:-5px;width:18px;height:18px;
                background:white;border:2px solid ${color};border-radius:50%;
                display:flex;align-items:center;justify-content:center;
                font-size:9px;font-weight:900;color:${color};line-height:1;">${num}</div>
            </div>
            <div style="background:${color};color:white;border-radius:10px;padding:3px 9px;
              font-size:10px;font-weight:900;white-space:nowrap;max-width:110px;
              overflow:hidden;text-overflow:ellipsis;box-shadow:0 2px 6px rgba(0,0,0,0.18);">
              ${name}${time ? ` · ${time}` : ''}
            </div>
          </div>`);
      });

      // ── 전체 경로 맞춤 뷰 (목적지 포함) ─────────────────────────────
      const bounds = new kakao.maps.LatLngBounds();
      allCoords.forEach(c => bounds.extend(new kakao.maps.LatLng(c.lat, c.lng)));
      bounds.extend(new kakao.maps.LatLng(destLat, destLng));
      map.setBounds(bounds, 60, 60, 60, 60);

    }).catch(err => console.error('카카오맵 로드 실패:', err));

    return () => { cancelled = true; clearMap(); };
  }, [route]);

  const goToMyLocation = useCallback(() => {
    const map = mapInst.current;
    if (!map) return;
    navigator.geolocation.getCurrentPosition(
      ({ coords: { latitude: lat, longitude: lng } }) => {
        /* eslint-disable @typescript-eslint/no-explicit-any */
        const kakao: any = (window as any).kakao;
        /* eslint-enable */
        const pos = new kakao.maps.LatLng(lat, lng);
        map.panTo(pos);
        addOverlay(map, kakao, lat, lng, `
          <div style="width:20px;height:20px;background:#3B82F6;border:3px solid white;
            border-radius:50%;box-shadow:0 0 0 6px rgba(59,130,246,0.2);"></div>`, 0.5);
      },
      () => alert('위치 정보를 가져올 수 없습니다.'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height, overflow: 'hidden' }}>
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
      <button
        onClick={goToMyLocation}
        title="현재 위치로 이동"
        style={{
          position: 'absolute', bottom: '100px', right: '12px', zIndex: 1000,
          width: '44px', height: '44px', background: 'white', border: 'none',
          borderRadius: '50%', cursor: 'pointer', fontSize: '21px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 3px 14px rgba(0,0,0,0.18)', transition: 'transform 0.15s',
        }}
        onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.9)')}
        onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
      >
        📍
      </button>
    </div>
  );
};

export default TmapRouteView;
