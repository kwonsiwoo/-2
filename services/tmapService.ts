import { HybridRoute, RouteSegment } from '../types';

const KAKAO_PROXY = '/api/kakao-local';
const NAVER_PROXY = '/api/naver-local';

// ─── Haversine 직선거리 (m) ────────────────────────────────────────────────
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── 검색 키워드 후보 생성 (기존 로직 유지) ──────────────────────────────
const extractSearchKeyword = (input: string): string[] => {
    const s = input.trim();
    const candidates: string[] = [s];
    const parenMatch = s.match(/\(([^)]+)\)/);
    if (parenMatch) candidates.push(parenMatch[1]);
    const stationMatch = s.match(/([가-힣]+역)/);
    if (stationMatch) candidates.push(stationMatch[1]);
    const noUnderground = s.replace(/지하\s*\d+/g, '').replace(/\s+/g, ' ').trim();
    if (noUnderground !== s) candidates.push(noUnderground);
    const noProvince = s.replace(/^(서울|경기|인천|부산|대구|광주|대전|울산|세종|강원|충북|충남|전북|전남|경북|경남|제주)\s*/, '');
    if (noProvince !== s) candidates.push(noProvince);
    const roadMatch = s.match(/([가-힣0-9]+(?:로|길|대로|번길|로\d+번길)[\d\-]*(?:\s+\d+)?)/);
    if (roadMatch) candidates.push(roadMatch[1]);
    return [...new Set(candidates.filter(Boolean))];
};

// ─── 카카오 주소 검색 (지오코딩) ─────────────────────────────────────────
const kakaoAddressSearch = async (query: string): Promise<{ lat: number; lon: number } | null> => {
    try {
        const res = await fetch(
            `${KAKAO_PROXY}?type=address&query=${encodeURIComponent(query)}&size=1`,
        );
        const data = await res.json();
        const doc = data.documents?.[0];
        if (doc) return { lat: parseFloat(doc.y), lon: parseFloat(doc.x) };
    } catch {}
    return null;
};

// ─── 카카오 키워드 검색 (POI) ─────────────────────────────────────────────
const kakaoKeywordSearch = async (query: string, size = 1): Promise<{ lat: number; lon: number } | null> => {
    try {
        const res = await fetch(
            `${KAKAO_PROXY}?type=keyword&query=${encodeURIComponent(query)}&size=${size}`,
        );
        const data = await res.json();
        const doc = data.documents?.[0];
        if (doc) return { lat: parseFloat(doc.y), lon: parseFloat(doc.x) };
    } catch {}
    return null;
};

// ─── 네이버 지역 검색 (무료) ──────────────────────────────────────────────
const naverLocalSearch = async (query: string, display = 1): Promise<{ name: string; address: string; lat: number; lon: number }[]> => {
    try {
        const res = await fetch(
            `${NAVER_PROXY}?query=${encodeURIComponent(query)}&display=${display}`,
        );
        const data = await res.json();
        return data.items || [];
    } catch {}
    return [];
};

const osmSearch = async (query: string): Promise<{ lat: number; lon: number } | null> => {
    try {
        const res = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=kr&accept-language=ko`,
            { headers: { 'User-Agent': 'JjinMakchaApp/1.0' } },
        );
        const data = await res.json();
        if (data?.length > 0) return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
    } catch {}
    return null;
};

// ─── 장소 선택 시 좌표 캐시 ──────────────────────────────────────────────
const coordCache = new Map<string, { lat: number; lon: number }>();

export const setCachedCoordinates = (key: string, coords: { lat: number; lon: number }) => {
    coordCache.set(key, coords);
};

// ─── POI 자동완성 검색 (카카오 키워드 검색) ──────────────────────────────
export interface PoiSuggestion {
    name: string;
    address: string;
    lat: number;
    lon: number;
}

export const searchPoiSuggestions = async (query: string): Promise<PoiSuggestion[]> => {
    const naverItems = await naverLocalSearch(query, 8);
    if (naverItems.length > 0) return naverItems;

    // 네이버 결과 없을 때만 카카오로 폴백
    try {
        const res = await fetch(
            `${KAKAO_PROXY}?type=keyword&query=${encodeURIComponent(query)}&size=8`,
        );
        const data = await res.json();
        return (data.documents || []).map((doc: any) => ({
            name: doc.place_name,
            address: doc.road_address_name || doc.address_name || '',
            lat: parseFloat(doc.y),
            lon: parseFloat(doc.x),
        })).filter((p: PoiSuggestion) => p.lat && p.lon);
    } catch (e) {
        console.error('POI 검색 오류:', e);
        return [];
    }
};

// ─── 좌표 → 주소 (OSM 역지오코딩 우선, 실패 시 카카오 폴백) ──────────────
export const reverseGeocode = async (lat: number, lon: number): Promise<string> => {
    try {
        const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=ko`,
            { headers: { 'User-Agent': 'JjinMakchaApp/1.0' } },
        );
        const data = await res.json();
        const addr = data.address;
        if (addr) {
            const parts = [addr.road, addr.quarter || addr.suburb, addr.city_district || addr.borough].filter(Boolean);
            if (parts.length) return parts.join(' ');
        }
    } catch {}
    // 폴백: 카카오 역지오코딩
    try {
        const res = await fetch(
            `${KAKAO_PROXY}?type=coord2address&x=${lon}&y=${lat}`,
        );
        const data = await res.json();
        const doc = data.documents?.[0];
        if (doc) {
            return doc.road_address?.address_name || doc.address?.address_name || '현재위치';
        }
    } catch {}
    return '현재위치';
};

// ─── 좌표 → TAGO 시군구 코드 (TAGO 좌표기반 근접정류소 조회) ─────────────
// 서울은 이 API 커버리지가 없어 빈 결과가 정상 → 기본값 '11'(서울)로 처리됨
const cityCodeCache = new Map<string, string>();

export const getTagoCityCode = async (lat: number, lon: number): Promise<string> => {
    const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
    if (cityCodeCache.has(key)) return cityCodeCache.get(key)!;

    let code = '11';
    try {
        const res = await fetch(`/api/tago-city-code?lat=${lat}&lon=${lon}`);
        const data = await res.json();
        if (data.cityCode) code = data.cityCode;
    } catch {}

    cityCodeCache.set(key, code);
    return code;
};

// ─── 좌표 변환 (캐시 → 카카오 주소검색 → OSM → 카카오 키워드검색) ────────
export const getCoordinates = async (keyword: string): Promise<{ lat: number; lon: number } | null> => {
    if (coordCache.has(keyword)) return coordCache.get(keyword)!;

    const candidates = extractSearchKeyword(keyword);

    for (const query of candidates) {
        const [naverItem] = await naverLocalSearch(query, 1);
        if (naverItem) { console.log(`네이버 검색 성공: "${query}"`, naverItem); return { lat: naverItem.lat, lon: naverItem.lon }; }

        const osmResult = await osmSearch(query);
        if (osmResult) { console.log(`OSM 성공: "${query}"`, osmResult); return osmResult; }

        const addrResult = await kakaoAddressSearch(query);
        if (addrResult) { console.log(`카카오 주소검색 성공: "${query}"`, addrResult); return addrResult; }

        const poiResult = await kakaoKeywordSearch(query);
        if (poiResult) { console.log(`카카오 키워드검색 성공: "${query}"`, poiResult); return poiResult; }
    }

    console.error('모든 geocoding 시도 실패:', keyword);
    return null;
};

// ─── 택시 경로 — Haversine × 1.3 추정 ────────────────────────────────────
type DrivingResult = { distanceM: number; durationSec: number; path: { lat: number; lng: number }[] };
const drivingCache = new Map<string, DrivingResult>();

async function fetchDrivingRoute(
    startLat: number, startLon: number, endLat: number, endLon: number,
): Promise<DrivingResult | null> {
    const key = `${startLat.toFixed(5)},${startLon.toFixed(5)}->${endLat.toFixed(5)},${endLon.toFixed(5)}`;
    if (drivingCache.has(key)) return drivingCache.get(key)!;

    const straightM = haversine(startLat, startLon, endLat, endLon);
    const distanceM = straightM * 1.3;
    const durationSec = (distanceM / 1000 / 30) * 3600; // 평균 30km/h
    const result: DrivingResult = {
        distanceM,
        durationSec,
        path: [{ lat: startLat, lng: startLon }, { lat: endLat, lng: endLon }],
    };
    drivingCache.set(key, result);
    return result;
}

export const getDrivingDistance = async (
    startLat: number, startLon: number, endLat: number, endLon: number,
): Promise<{ distanceM: number; durationSec: number } | null> => fetchDrivingRoute(startLat, startLon, endLat, endLon);

export const getDrivingRoutePath = async (
    startLat: number, startLon: number, endLat: number, endLon: number,
): Promise<{ lat: number; lng: number }[]> => {
    const r = await fetchDrivingRoute(startLat, startLon, endLat, endLon);
    return r?.path ?? [];
};

// ─── 도보 경로 — Haversine × 1.2 추정 ────────────────────────────────────
type WalkingResult = { distanceM: number; durationSec: number; path: { lat: number; lng: number }[] };
const walkingCache = new Map<string, WalkingResult>();

async function fetchWalkingRoute(
    startLat: number, startLon: number, endLat: number, endLon: number,
): Promise<WalkingResult | null> {
    const key = `${startLat.toFixed(5)},${startLon.toFixed(5)}->${endLat.toFixed(5)},${endLon.toFixed(5)}`;
    if (walkingCache.has(key)) return walkingCache.get(key)!;

    const straightM = haversine(startLat, startLon, endLat, endLon);
    const distanceM = straightM * 1.2;
    const durationSec = (distanceM / 1000 / 5) * 3600; // 평균 5km/h
    const result: WalkingResult = {
        distanceM,
        durationSec,
        path: [{ lat: startLat, lng: startLon }, { lat: endLat, lng: endLon }],
    };
    walkingCache.set(key, result);
    return result;
}

export const getWalkingRoute = async (
    startLat: number, startLon: number, endLat: number, endLon: number,
): Promise<{ distanceM: number; durationSec: number } | null> => fetchWalkingRoute(startLat, startLon, endLat, endLon);

export const getWalkingRoutePath = async (
    startLat: number, startLon: number, endLat: number, endLon: number,
): Promise<{ lat: number; lng: number }[]> => {
    const r = await fetchWalkingRoute(startLat, startLon, endLat, endLon);
    return r?.path ?? [];
};

// ─── 서울시 경계 판별 (시계외 할증) ──────────────────────────────────────
export const isOutsideSeoul = (lat: number, lon: number): boolean => {
    const SEOUL_BBOX = { latMin: 37.413, latMax: 37.715, lonMin: 126.764, lonMax: 127.183 };
    return lat < SEOUL_BBOX.latMin || lat > SEOUL_BBOX.latMax || lon < SEOUL_BBOX.lonMin || lon > SEOUL_BBOX.lonMax;
};

// ─── getTmapTransitRoutes (레거시 — ODsay로 대체됨, 호환성 유지) ──────────
export const getTmapTransitRoutes = async (
    _startLoc: string, _endLoc: string,
): Promise<{ routes: HybridRoute[]; fullTaxiCost: number }> => {
    return { routes: [], fullTaxiCost: 35000 };
};
