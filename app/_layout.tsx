import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { registerBackgroundSync, syncScheduleNow } from '../lib/backgroundSync';
import { checkAndNotifyBuddyOverlaps, registerForPushNotifications } from '../lib/notifications';
import { supabase } from '../lib/supabase';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const userId = session.user.id;
        await registerForPushNotifications(userId);
        await registerBackgroundSync();
        await syncScheduleNow(userId);
        await checkAndNotifyBuddyOverlaps(userId);
      }
    });

    // AppState: Schedule automatisch aktualisieren wenn App in Vordergrund kommt
    const appStateSubscription = AppState.addEventListener('change', async (nextState) => {
      if (nextState === 'active') {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          await syncScheduleNow(session.user.id);
        }
      }
    });

    const responseListener = Notifications.addNotificationResponseReceivedListener(() => {
      router.push('/(tabs)/flights');
    });

    return () => {
      subscription.unsubscribe();
      appStateSubscription.remove();
      responseListener.remove();
    };
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
