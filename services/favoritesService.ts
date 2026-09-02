import { supabase, ensureAnonymousSession } from './supabaseClient';

export type FavoriteKind = 'HOME' | 'WORK' | 'CUSTOM';

export interface Favorite {
  id: string;
  kind: FavoriteKind;
  label: string;
  address: string;
  lat: number | null;
  lon: number | null;
  sortOrder: number;
}

const mapRow = (r: any): Favorite => ({
  id: r.id,
  kind: r.kind,
  label: r.label,
  address: r.address,
  lat: r.lat,
  lon: r.lon,
  sortOrder: r.sort_order,
});

export async function listFavorites(): Promise<Favorite[]> {
  if (!supabase) return [];
  await ensureAnonymousSession();
  try {
    const { data, error } = await supabase
      .from('favorites')
      .select('*')
      .order('kind', { ascending: true })
      .order('sort_order', { ascending: true });
    if (error) throw error;
    return (data || []).map(mapRow);
  } catch (e) {
    console.error('즐겨찾기 목록 조회 오류:', e);
    return [];
  }
}

export async function addFavorite(input: {
  label: string; address: string; lat?: number | null; lon?: number | null; kind?: FavoriteKind;
}): Promise<Favorite | null> {
  if (!supabase) return null;
  const uid = await ensureAnonymousSession();
  if (!uid) return null;
  try {
    const { data, error } = await supabase
      .from('favorites')
      .insert({
        user_id: uid,
        kind: input.kind ?? 'CUSTOM',
        label: input.label,
        address: input.address,
        lat: input.lat ?? null,
        lon: input.lon ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return mapRow(data);
  } catch (e) {
    console.error('즐겨찾기 추가 오류:', e);
    return null;
  }
}

export async function updateFavorite(
  id: string,
  patch: Partial<Pick<Favorite, 'label' | 'address' | 'lat' | 'lon'>>,
): Promise<Favorite | null> {
  if (!supabase) return null;
  await ensureAnonymousSession();
  try {
    const { data, error } = await supabase
      .from('favorites')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return mapRow(data);
  } catch (e) {
    console.error('즐겨찾기 수정 오류:', e);
    return null;
  }
}

export async function deleteFavorite(id: string): Promise<boolean> {
  if (!supabase) return false;
  await ensureAnonymousSession();
  try {
    const { error } = await supabase.from('favorites').delete().eq('id', id);
    if (error) throw error;
    return true;
  } catch (e) {
    console.error('즐겨찾기 삭제 오류:', e);
    return false;
  }
}
