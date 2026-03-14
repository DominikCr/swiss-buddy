import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { supabase } from './supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotifications(userId: string) {
  if (!Device.isDevice) {
    console.log('Push Notifications nur auf echtem Gerät verfügbar');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Push Notification Berechtigung verweigert');
    return null;
  }

  const token = (await Notifications.getExpoPushTokenAsync()).data;

  // Token in Supabase speichern
  await supabase
    .from('profiles')
    .update({ push_token: token })
    .eq('id', userId);

  return token;
}

export async function sendLocalNotification(title: string, body: string) {
  await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: null, // sofort senden
  });
}

export async function checkAndNotifyBuddyOverlaps(userId: string) {
  const { data: overlaps } = await supabase
    .rpc('get_layover_overlaps', { user_id: userId });

  if (!overlaps || overlaps.length === 0) return;

  // Alle Überschneidungen die noch nicht vorbei sind
  const now = new Date();
  const upcoming = overlaps.filter((o: any) => new Date(o.overlap_end) >= now);

  if (upcoming.length === 0) return;

  if (upcoming.length === 1) {
    const o = upcoming[0];
    await sendLocalNotification(
      '👋 Buddy in der Nähe!',
      `${o.buddy_name} ist gleichzeitig mit dir in ${o.destination}!`
    );
  } else {
    const destinations = [...new Set(upcoming.map((o: any) => o.destination))].join(', ');
    await sendLocalNotification(
      `👥 ${upcoming.length} Buddy-Überschneidungen!`,
      `Du triffst Buddies in ${destinations}`
    );
  }
}
