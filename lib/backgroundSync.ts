import AsyncStorage from '@react-native-async-storage/async-storage';
import * as BackgroundFetch from 'expo-background-fetch';
import * as Calendar from 'expo-calendar';
import * as TaskManager from 'expo-task-manager';

import { parseIcal } from './icalParser';
import { saveSchedule } from './schedule';
import { supabase } from './supabase';

const SCHEDULE_SOURCE_KEY = 'schedule_source'; // 'url' | 'calendar'
const SCHEDULE_URL_KEY = 'schedule_url';

export const BACKGROUND_SYNC_TASK = 'background-schedule-sync';

export async function saveScheduleSource(method: 'url' | 'calendar', url?: string) {
  await AsyncStorage.setItem(SCHEDULE_SOURCE_KEY, method);
  if (url) await AsyncStorage.setItem(SCHEDULE_URL_KEY, url);
}

async function fetchFlightsFromUrl(url: string) {
  const fetchUrl = url.replace(/^webcal:\/\//i, 'https://');
  const response = await fetch(fetchUrl);
  if (!response.ok) return [];
  const content = await response.text();
  return parseIcal(content);
}

async function fetchFlightsFromCalendar() {
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const swissCalendars = calendars.filter(cal =>
    ['swiss', 'followme', 'crew', 'roster', 'schedule'].some(kw =>
      cal.title.toLowerCase().includes(kw)
    )
  );
  if (swissCalendars.length === 0) return [];

  const now = new Date();
  const future = new Date();
  future.setDate(future.getDate() + 90);

  const flights: any[] = [];
  for (const cal of swissCalendars) {
    const events = await Calendar.getEventsAsync([cal.id], now, future);
    for (const event of events) {
      const match = event.title?.match(/([A-Z]{2}\s?\d+)\s+([A-Z]{3})-([A-Z]{3})/);
      if (!match) continue;
      const start = new Date(event.startDate);
      const end = new Date(event.endDate);
      const layoverHours = Math.round((end.getTime() - start.getTime()) / 3600000);
      flights.push({
        flightNumber: match[1].replace(' ', ''),
        departureAirport: match[2],
        arrivalAirport: match[3],
        departureDate: start.toISOString().split('T')[0],
        layoverHours: layoverHours > 0 ? layoverHours : 0,
      });
    }
  }
  return flights;
}

// Für AppState (Vordergrund): URL + Kalender
export async function syncScheduleNow(userId: string): Promise<boolean> {
  const method = await AsyncStorage.getItem(SCHEDULE_SOURCE_KEY);
  if (!method) return false;

  let flights: any[] = [];
  if (method === 'url') {
    const url = await AsyncStorage.getItem(SCHEDULE_URL_KEY);
    if (!url) return false;
    flights = await fetchFlightsFromUrl(url);
  } else if (method === 'calendar') {
    flights = await fetchFlightsFromCalendar();
  }

  if (flights.length === 0) return false;
  await saveSchedule(userId, flights);
  return true;
}

// Hintergrund-Task: nur URL (Kalender-Zugriff ist im Hintergrund auf iOS nicht möglich)
TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return BackgroundFetch.BackgroundFetchResult.NoData;

    const method = await AsyncStorage.getItem(SCHEDULE_SOURCE_KEY);
    if (method !== 'url') return BackgroundFetch.BackgroundFetchResult.NoData;

    const url = await AsyncStorage.getItem(SCHEDULE_URL_KEY);
    if (!url) return BackgroundFetch.BackgroundFetchResult.NoData;

    const flights = await fetchFlightsFromUrl(url);
    if (flights.length === 0) return BackgroundFetch.BackgroundFetchResult.NoData;

    await saveSchedule(session.user.id, flights);
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export async function registerBackgroundSync() {
  try {
    await BackgroundFetch.registerTaskAsync(BACKGROUND_SYNC_TASK, {
      minimumInterval: 60 * 60, // stündlich
      stopOnTerminate: false,
      startOnBoot: true,
    });
  } catch {
    // Bereits registriert oder nicht unterstützt
  }
}
