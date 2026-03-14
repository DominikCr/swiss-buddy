import { supabase } from './supabase';

export type SpotCategory = 'restaurant' | 'bar' | 'sehenswürdigkeit' | 'hotel' | 'sonstiges';

export interface SpotTip {
  id: string;
  spot_id: string;
  user_id: string;
  display_name: string;
  content: string;
  version: number;
  created_at: string;
}

export interface CrewSpot {
  id: string;
  user_id: string;
  display_name: string;
  name: string;
  category: SpotCategory;
  latitude: number;
  longitude: number;
  city: string | null;
  created_at: string;
  currentTip?: SpotTip | null;
  tipHistory?: SpotTip[];
}

export async function getSpots(): Promise<CrewSpot[]> {
  const { data } = await supabase
    .from('crew_spots')
    .select('*, crew_spot_tips(id, spot_id, user_id, display_name, content, version, created_at)');
  if (!data) return [];
  return data.map((spot: any) => {
    const tips: SpotTip[] = (spot.crew_spot_tips ?? [])
      .sort((a: SpotTip, b: SpotTip) => b.version - a.version);
    const { crew_spot_tips: _, ...spotData } = spot;
    return { ...spotData, currentTip: tips[0] ?? null, tipHistory: tips };
  });
}

export function searchSpots(spots: CrewSpot[], query: string): CrewSpot[] {
  if (!query.trim()) return spots;
  const q = query.toLowerCase();
  return spots.filter(spot =>
    spot.name.toLowerCase().includes(q) ||
    spot.tipHistory?.some(tip => tip.content.toLowerCase().includes(q))
  );
}

export async function addSpot(
  spot: Omit<CrewSpot, 'id' | 'created_at' | 'currentTip' | 'tipHistory'>,
  initialTip?: string
): Promise<{ error: any }> {
  const { data, error } = await supabase
    .from('crew_spots')
    .insert({
      user_id: spot.user_id,
      display_name: spot.display_name,
      name: spot.name,
      category: spot.category,
      latitude: spot.latitude,
      longitude: spot.longitude,
      city: spot.city,
    })
    .select('id')
    .single();
  if (error || !data) return { error: error ?? new Error('No data') };
  if (initialTip?.trim()) {
    await supabase.from('crew_spot_tips').insert({
      spot_id: data.id,
      user_id: spot.user_id,
      display_name: spot.display_name,
      content: initialTip.trim(),
      version: 1,
    });
  }
  return { error: null };
}

export async function addTip(
  spotId: string,
  userId: string,
  displayName: string,
  content: string,
  nextVersion: number
): Promise<{ error: any }> {
  const { error } = await supabase.from('crew_spot_tips').insert({
    spot_id: spotId,
    user_id: userId,
    display_name: displayName,
    content: content.trim(),
    version: nextVersion,
  });
  return { error };
}

export async function deleteSpot(id: string): Promise<void> {
  await supabase.from('crew_spots').delete().eq('id', id);
}
