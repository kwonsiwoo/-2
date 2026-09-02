import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 미설정 — 즐겨찾기 기능 비활성화됩니다.');
}

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// StrictMode에서 useEffect가 2번 실행돼도 익명 로그인이 중복 호출되지 않도록 모듈 레벨에서 캐싱
let anonAuthPromise: Promise<string | null> | null = null;

export function ensureAnonymousSession(): Promise<string | null> {
  if (!supabase) return Promise.resolve(null);
  if (anonAuthPromise) return anonAuthPromise;

  anonAuthPromise = (async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) return session.user.id;

    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) {
      console.error('[supabase] 익명 로그인 실패:', error.message);
      anonAuthPromise = null; // 실패 시 재시도 가능하도록 캐시 해제
      return null;
    }
    return data.user?.id ?? null;
  })();

  return anonAuthPromise;
}
