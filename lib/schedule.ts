import { FlightEntry } from './icalParser';
import { supabase } from './supabase';

export async function saveSchedule(userId: string, flights: FlightEntry[]) {
  // Alte Einträge zuerst löschen
  await supabase.from('schedule_entries').delete().eq('profile_id', userId);

  if (flights.length === 0) return { error: null };

  const rows = flights.map(f => ({
    profile_id: userId,
    flight_number: f.flightNumber,
    departure_airport: f.departureAirport,
    arrival_airport: f.arrivalAirport,
    departure_date: f.departureDate,
    layover_hours: f.layoverHours,
  }));

  const { error } = await supabase.from('schedule_entries').insert(rows);
  return { error };
}

export async function getSchedule(userId: string) {
  const { data, error } = await supabase
    .from('schedule_entries')
    .select('*')
    .eq('profile_id', userId)
    .gte('departure_date', new Date().toISOString().split('T')[0])
    .order('departure_date', { ascending: true });

  return { data, error };
}
