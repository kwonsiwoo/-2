import { HybridRoute, RouteSegment } from '../types';

// API 키는 환경 변수에서 읽어옴 (하드코딩 제거)
const getTmapKey = (): string => {
    const key = (import.meta.env.VITE_TMAP_APP_KEY || '').trim();
    if (!key) {
        throw new Error("TMAP_APP_KEY is missing. Please set VITE_TMAP_APP_KEY in your environment variables.");
    }
    return key;
};

// 주소에서 검색하기 좋은 키워드 추출
const extractSearchKeyword = (input: string): string[] => {
    const candidates: string[] = [input];

    // 괄호 안 역명 추출: "경인로 지하 877 (동수역)" → "동수역"
    const parenMatch = input.match(/\(([^)]+)\)/);
    if (parenMatch) candidates.push(parenMatch[1]);

    // "지하" 제거 후 앞부분만: "인천 부평구 경인로 지하 877" → "인천 부평구 경인로"
    const withoutUnderground = input.replace(/지하\s*\d+/g, '').trim();
    if (withoutUnderground !== input) candidates.push(withoutUnderground);

    // 역명 패턴 추출: "동수역", "부평역" 등
    const stationMatch = input.match(/([가-힣]+역)/);
    if (stationMatch) candidates.push(stationMatch[1]);

    return [...new Set(candidates)]; // 중복 제거
};

const osmSearch = async (query: string): Promise<{ lat: number, lon: number } | null> => {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=kr&accept-language=ko`;
    const res = await fetch(url, { headers: { 'User-Agent': 'JjinMakchaApp/1.0' } });
    const data = await res.json();
    if (data?.length > 0) {
        return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
    }
    return null;
};

const tmapSearch = async (query: string): Promise<{ lat: number, lon: number } | null> => {
    try {
        const key = (import.meta.env.VITE_TMAP_APP_KEY || '').trim();
        if (!key) return null;
        const url = `https://apis.openapi.sk.com/tmap/pois?version=1&searchKeyword=${encodeURIComponent(query)}&resCoordType=WGS84GEO&reqCoordType=WGS84GEO&count=1`;
        const res = await fetch(url, { headers: { appKey: key, Accept: 'application/json' } });
        const data = await res.json();
        const poi = data.searchPoiInfo?.pois?.[0];
        if (poi) return { lat: parseFloat(poi.frontLat || poi.noorLat), lon: parseFloat(poi.frontLon || poi.noorLon) };
    } catch {}
    return null;
};

// 주소를 좌표로 변환 (여러 전략 순차 시도)
export const getCoordinates = async (keyword: string): Promise<{ lat: number, lon: number } | null> => {
    const candidates = extractSearchKeyword(keyword);
    console.log('geocoding candidates:', candidates);

    for (const query of candidates) {
        // OSM 시도
        try {
            const result = await osmSearch(query);
            if (result) { console.log(`OSM 성공: "${query}"`, result); return result; }
        } catch {}

        // TMAP POI 시도
        const tmapResult = await tmapSearch(query);
        if (tmapResult) { console.log(`TMAP 성공: "${query}"`, tmapResult); return tmapResult; }
    }

    console.error('모든 geocoding 시도 실패:', keyword);
    return null;
};

// 2. 대중교통 경로 탐색 함수
export const getTmapTransitRoutes = async (startLoc: string, endLoc: string): Promise<{ routes: HybridRoute[], fullTaxiCost: number }> => {
    try {
        const TMAP_APP_KEY = getTmapKey();

        // 1. 출발지/도착지 좌표 변환
        const startCoords = await getCoordinates(startLoc);
        const endCoords = await getCoordinates(endLoc);

        if (!startCoords || !endCoords) {
            throw new Error("출발지 또는 도착지의 좌표를 찾을 수 없습니다. 정확한 주소나 장소명을 입력해주세요.");
        }

        // 2. TMAP 대중교통 API 호출
        const url = 'https://apis.openapi.sk.com/transit/routes';
        const body = {
            startX: startCoords.lon,  // 숫자로 전송
            startY: startCoords.lat,
            endX: endCoords.lon,
            endY: endCoords.lat,
            count: 5,
            lang: 0,
            format: "json"
        };

        console.log("TMAP Transit API request:", {
            start: startLoc,
            end: endLoc,
            startCoords,
            endCoords
        });

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'appKey': TMAP_APP_KEY,
                'content-type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        const data = await response.json();
        console.log("TMAP Transit API response:", data);

        // 응답 에러 처리
        if (data.error) {
            const errorMsg = data.error.message || 'Unknown error';
            if (data.error.code === 'INVALID_API_KEY') {
                throw new Error("TMAP App Key가 유효하지 않습니다.");
            }
            throw new Error(`Transit API Error: ${errorMsg}`);
        }

        // result.status가 명시적으로 존재하고 0이 아닐 때만 오류
        if (data.result && data.result.status !== undefined && data.result.status !== 0) {
            throw new Error(data.result.message || "경로를 찾을 수 없습니다.");
        }

        if (!data.metaData?.plan?.itineraries) {
            // 응답 전체 구조 로깅해서 디버깅
            console.log("Full TMAP response:", JSON.stringify(data).slice(0, 500));
            throw new Error("경로 데이터가 없습니다. 출발지/도착지를 더 정확하게 입력해주세요.");
        }

        const itineraries = data.metaData.plan.itineraries;

        // 택시 요금 추정 (기본값, 실제로는 TMAP 택시 요금 API 연동 필요)
        const fullTaxiCost = 35000;

        // 3. TMAP 응답을 앱의 HybridRoute 형식으로 변환
        const routes: HybridRoute[] = itineraries.slice(0, 3).map((itinerary: any, index: number) => {
            const totalCost = itinerary.fare?.regular?.totalFare || 0;
            const totalDuration = Math.round(itinerary.totalTime / 60); // 초를 분으로 변환

            let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;

            const updateBounds = (lat: number, lng: number) => {
                if (lat < minLat) minLat = lat;
                if (lat > maxLat) maxLat = lat;
                if (lng < minLng) minLng = lng;
                if (lng > maxLng) maxLng = lng;
            };

            const segments: RouteSegment[] = itinerary.legs.map((leg: any) => {
                let type: 'walk' | 'bus' | 'subway' | 'taxi' = 'walk';
                let instruction = '';
                let lineName = '';
                let startName = leg.start?.name || '';
                let endName = leg.end?.name || '';
                const path: {lat: number, lng: number}[] = [];

                // 출발/도착 시간 파싱 (epoch ms → HH:MM)
                const toHHMM = (epoch: any): string | undefined => {
                    if (!epoch) return undefined;
                    const d = new Date(Number(epoch));
                    if (isNaN(d.getTime())) return undefined;
                    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
                };
                const segDepartureTime = toHHMM(leg.startTime);
                const segArrivalTime = toHHMM(leg.endTime);

                // Extract path coordinates from linestring
                if (leg.mode === 'WALK' && leg.steps) {
                    leg.steps.forEach((step: any) => {
                        if (step.linestring) {
                            const coords = step.linestring.split(' ');
                            coords.forEach((coordStr: string) => {
                                const [lng, lat] = coordStr.split(',').map(Number);
                                if (!isNaN(lat) && !isNaN(lng)) {
                                    path.push({ lat, lng });
                                    updateBounds(lat, lng);
                                }
                            });
                        }
                    });
                } else if ((leg.mode === 'BUS' || leg.mode === 'SUBWAY') && leg.passShape?.linestring) {
                    const coords = leg.passShape.linestring.split(' ');
                    coords.forEach((coordStr: string) => {
                        const [lng, lat] = coordStr.split(',').map(Number);
                        if (!isNaN(lat) && !isNaN(lng)) {
                            path.push({ lat, lng });
                            updateBounds(lat, lng);
                        }
                    });
                } else if (leg.start && leg.end) {
                    path.push({ lat: leg.start.lat, lng: leg.start.lon });
                    path.push({ lat: leg.end.lat, lng: leg.end.lon });
                    updateBounds(leg.start.lat, leg.start.lon);
                    updateBounds(leg.end.lat, leg.end.lon);
                }

                if (leg.mode === 'WALK') {
                    type = 'walk';
                    instruction = `${startName}에서 ${endName}까지 도보 이동`;
                } else if (leg.mode === 'BUS') {
                    type = 'bus';
                    lineName = leg.route || '버스';
                    instruction = `${startName}에서 ${lineName} 버스 탑승`;
                } else if (leg.mode === 'SUBWAY') {
                    type = 'subway';
                    lineName = leg.route || '전철';
                    instruction = `${startName}에서 ${lineName} 탑승`;
                }

                return {
                    type,
                    instruction,
                    durationMinutes: Math.round(leg.sectionTime / 60),
                    cost: 0,
                    lineName,
                    startName,
                    endName,
                    path,
                    departureTime: segDepartureTime,
                    arrivalTime: segArrivalTime,
                };
            });

            // 현재 시간을 기준으로 출발 시간 계산
            const now = new Date();
            const d = new Date(now.getTime() + (index * 10) * 60000);
            const departureTime = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;

            // 환승 지점 찾기
            let transferPoint = '도착지 인근';
            const lastTransitLeg = [...itinerary.legs].reverse().find((leg: any) => leg.mode === 'BUS' || leg.mode === 'SUBWAY');
            if (lastTransitLeg?.end?.name) {
                transferPoint = lastTransitLeg.end.name;
            }

            return {
                id: `tmap-route-${index}`,
                name: `추천 경로 ${index + 1} 🗺️`,
                totalCost,
                totalDuration,
                savedAmount: fullTaxiCost - totalCost,
                transferPoint,
                departureTime,
                taxiCostOnly: fullTaxiCost,
                segments,
                bounds: { minLat, maxLat, minLng, maxLng }
            };
        });

        return {
            routes: routes.length > 0 ? routes : [],
            fullTaxiCost
        };
    } catch (error) {
        console.error("getTmapTransitRoutes Error:", error);
        throw error;
    }
};
