import * as Location from 'expo-location';
import { supabase } from './supabase';

export type SpotCategory = 'restaurant' | 'bar' | 'sehenswürdigkeit' | 'hotel' | 'sport' | 'shopping' | 'sonstiges';

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
  country: string | null;
  continent: string | null;
  created_at: string;
  currentTip?: SpotTip | null;
  tipHistory?: SpotTip[];
}

export const CONTINENTS = [
  'Europa', 'Nordamerika', 'Südamerika', 'Asien', 'Afrika', 'Ozeanien', 'Naher Osten'
];

const COUNTRY_TO_CONTINENT: Record<string, string> = {
  // Europa (Englisch)
  'Switzerland': 'Europa', 'Germany': 'Europa', 'France': 'Europa', 'Italy': 'Europa',
  'Spain': 'Europa', 'Portugal': 'Europa', 'United Kingdom': 'Europa', 'Great Britain': 'Europa',
  'Netherlands': 'Europa', 'Belgium': 'Europa', 'Austria': 'Europa', 'Greece': 'Europa',
  'Sweden': 'Europa', 'Norway': 'Europa', 'Denmark': 'Europa', 'Finland': 'Europa',
  'Poland': 'Europa', 'Czech Republic': 'Europa', 'Czechia': 'Europa', 'Hungary': 'Europa',
  'Croatia': 'Europa', 'Romania': 'Europa', 'Serbia': 'Europa', 'Kosovo': 'Europa',
  'Bulgaria': 'Europa', 'Montenegro': 'Europa', 'North Macedonia': 'Europa', 'Albania': 'Europa',
  'Slovenia': 'Europa', 'Bosnia and Herzegovina': 'Europa', 'Georgia': 'Europa',
  'Ukraine': 'Europa', 'Iceland': 'Europa', 'Ireland': 'Europa', 'Luxembourg': 'Europa',
  'Malta': 'Europa', 'Cyprus': 'Europa', 'Russia': 'Europa',
  // Europa (Deutsch)
  'Deutschland': 'Europa', 'Frankreich': 'Europa', 'Italien': 'Europa', 'Spanien': 'Europa',
  'Niederlande': 'Europa', 'Belgien': 'Europa', 'Österreich': 'Europa', 'Griechenland': 'Europa',
  'Schweden': 'Europa', 'Norwegen': 'Europa', 'Dänemark': 'Europa', 'Finnland': 'Europa',
  'Polen': 'Europa', 'Tschechien': 'Europa', 'Ungarn': 'Europa', 'Kroatien': 'Europa',
  'Rumänien': 'Europa', 'Serbien': 'Europa', 'Bulgarien': 'Europa', 'Slowenien': 'Europa',
  'Georgien': 'Europa', 'Island': 'Europa', 'Irland': 'Europa', 'Russland': 'Europa',
  'Schweiz': 'Europa', 'Grossbritannien': 'Europa',
  // Nordamerika (Englisch)
  'United States': 'Nordamerika', 'United States of America': 'Nordamerika',
  'Canada': 'Nordamerika', 'Mexico': 'Nordamerika', 'Cuba': 'Nordamerika',
  'Dominican Republic': 'Nordamerika', 'Jamaica': 'Nordamerika', 'Bahamas': 'Nordamerika',
  'Barbados': 'Nordamerika', 'Costa Rica': 'Nordamerika',
  // Nordamerika (Deutsch)
  'Vereinigte Staaten': 'Nordamerika', 'Kanada': 'Nordamerika', 'Mexiko': 'Nordamerika',
  'Kuba': 'Nordamerika', 'Dominikanische Republik': 'Nordamerika',
  // Südamerika (Englisch)
  'Brazil': 'Südamerika', 'Peru': 'Südamerika', 'Chile': 'Südamerika',
  'Colombia': 'Südamerika', 'Argentina': 'Südamerika', 'Ecuador': 'Südamerika',
  'Bolivia': 'Südamerika',
  // Südamerika (Deutsch)
  'Brasilien': 'Südamerika', 'Kolumbien': 'Südamerika', 'Argentinien': 'Südamerika',
  // Asien (Englisch)
  'Japan': 'Asien', 'China': 'Asien', "People's Republic of China": 'Asien',
  'India': 'Asien', 'Thailand': 'Asien', 'Vietnam': 'Asien', 'Viet Nam': 'Asien',
  'Singapore': 'Asien', 'Malaysia': 'Asien', 'Indonesia': 'Asien', 'Philippines': 'Asien',
  'South Korea': 'Asien', 'Republic of Korea': 'Asien', 'Hong Kong': 'Asien',
  'Taiwan': 'Asien', 'Taiwan, Province of China': 'Asien', 'Maldives': 'Asien',
  'Sri Lanka': 'Asien', 'Nepal': 'Asien', 'Cambodia': 'Asien', 'Myanmar': 'Asien',
  'Pakistan': 'Asien', 'Bangladesh': 'Asien',
  // Asien (Deutsch)
  'Indien': 'Asien', 'Indonesien': 'Asien', 'Philippinen': 'Asien', 'Südkorea': 'Asien',
  'Malediven': 'Asien', 'Kambodscha': 'Asien',
  // Naher Osten (Englisch)
  'United Arab Emirates': 'Naher Osten', 'Qatar': 'Naher Osten', 'Oman': 'Naher Osten',
  'Saudi Arabia': 'Naher Osten', 'Israel': 'Naher Osten', 'Jordan': 'Naher Osten',
  'Bahrain': 'Naher Osten', 'Kuwait': 'Naher Osten', 'Lebanon': 'Naher Osten',
  'Turkey': 'Naher Osten', 'Türkiye': 'Naher Osten',
  // Naher Osten (Deutsch)
  'Vereinigte Arabische Emirate': 'Naher Osten', 'Katar': 'Naher Osten',
  'Saudi-Arabien': 'Naher Osten', 'Jordanien': 'Naher Osten', 'Türkei': 'Naher Osten',
  'Libanon': 'Naher Osten',
  // Afrika (Englisch)
  'Morocco': 'Afrika', 'Egypt': 'Afrika', 'Tanzania': 'Afrika', 'Kenya': 'Afrika',
  'South Africa': 'Afrika', 'Tunisia': 'Afrika', 'Mauritius': 'Afrika',
  'Seychelles': 'Afrika', 'Cape Verde': 'Afrika',
  // Afrika (Deutsch)
  'Marokko': 'Afrika', 'Ägypten': 'Afrika', 'Tansania': 'Afrika', 'Kenia': 'Afrika',
  'Südafrika': 'Afrika', 'Tunesien': 'Afrika', 'Seychellen': 'Afrika',
  // Ozeanien (Englisch)
  'Australia': 'Ozeanien', 'New Zealand': 'Ozeanien', 'Fiji': 'Ozeanien',
  // Ozeanien (Deutsch)
  'Australien': 'Ozeanien', 'Neuseeland': 'Ozeanien',
};

export async function reverseGeocode(latitude: number, longitude: number): Promise<{
  city: string | null;
  country: string | null;
  continent: string | null;
}> {
  try {
    const results = await Location.reverseGeocodeAsync({ latitude, longitude });
    if (results.length === 0) return { city: null, country: null, continent: null };
    const r = results[0];
    const city = r.city || r.district || r.subregion || null;
    const country = r.country || null;
    const continent = country ? (COUNTRY_TO_CONTINENT[country] ?? null) : null;
    return { city, country, continent };
  } catch {
    return { city: null, country: null, continent: null };
  }
}

export async function getSpots(): Promise<CrewSpot[]> {
  const { data: spotsData } = await supabase
    .from('crew_spots')
    .select('*');
  if (!spotsData) return [];

  const { data: tipsData } = await supabase
    .from('crew_spot_tips')
    .select('*')
    .order('version', { ascending: false });

  return spotsData.map((spot: any) => {
    const tips: SpotTip[] = (tipsData ?? [])
      .filter((t: SpotTip) => t.spot_id === spot.id);
    return {
      ...spot,
      currentTip: tips[0] ?? null,
      tipHistory: tips,
    };
  });
}

export function groupSpotsByLocation(spots: CrewSpot[]): Record<string, Record<string, Record<string, CrewSpot[]>>> {
  const result: Record<string, Record<string, Record<string, CrewSpot[]>>> = {};
  for (const spot of spots) {
    const continent = spot.continent || 'Unbekannt';
    const country = spot.country || 'Unbekannt';
    const city = spot.city || 'Unbekannt';
    if (!result[continent]) result[continent] = {};
    if (!result[continent][country]) result[continent][country] = {};
    if (!result[continent][country][city]) result[continent][country][city] = [];
    result[continent][country][city].push(spot);
  }
  return result;
}

export function searchSpots(spots: CrewSpot[], query: string): CrewSpot[] {
  if (!query.trim()) return spots;
  const q = query.toLowerCase();
  return spots.filter(spot =>
    spot.name.toLowerCase().includes(q) ||
    spot.city?.toLowerCase().includes(q) ||
    spot.country?.toLowerCase().includes(q) ||
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
      country: spot.country,
      continent: spot.continent,
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

export async function updateSpot(id: string, updates: Partial<Pick<CrewSpot, 'name' | 'category' | 'city' | 'country' | 'continent'>>): Promise<{ error: any }> {
  const { error } = await supabase.from('crew_spots').update(updates).eq('id', id);
  return { error };
}

export async function deleteSpot(id: string): Promise<void> {
  await supabase.from('crew_spots').delete().eq('id', id);
}
