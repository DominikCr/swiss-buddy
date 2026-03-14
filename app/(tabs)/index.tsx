import * as Calendar from 'expo-calendar';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { getCurrentUser, saveConsents, saveInterests, suggestInterest } from '../../lib/auth';
import { saveScheduleSource } from '../../lib/backgroundSync';
import { authenticateWithBiometrics, BiometricType, getBiometricType, isBiometricEnabled, setBiometricEnabled as saveBiometricEnabled } from '../../lib/biometric';
import { FlightEntry, parseIcal } from '../../lib/icalParser';
import { saveSchedule } from '../../lib/schedule';
import { supabase } from '../../lib/supabase';

const INTERESTS = {
  'Sport & Outdoor': ['Laufen', 'Velofahren', 'Hiking', 'Golf', 'Schwimmen', 'Klettern'],
  'Wellness & Kultur': ['Yoga', 'Museen', 'Kochen', 'Fotografie'],
};

const CONSENTS = [
  { key: 'schedule', title: 'Flugplan-Upload', desc: 'Ich bin einverstanden, dass mein Flugplan in die App geladen und für das Matching verwendet wird.' },
  { key: 'visibility', title: 'Sichtbarkeit für Crew', desc: 'Andere Crew-Mitglieder auf gemeinsamen Flügen können meinen Namen, Interessen und Destination sehen.' },
  { key: 'storage', title: 'Datenspeicherung', desc: 'Meine Daten werden verschlüsselt gespeichert, bis ich sie lösche.' },
  { key: 'privacy', title: 'Datenschutzerklärung', desc: 'Ich habe die Datenschutzerklärung gelesen und bin einverstanden.' },
];

export default function WelcomeScreen() {
  const [step, setStep] = useState<'login' | 'welcome' | 'consent' | 'interests' | 'schedule' | 'biometric' | 'home'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [consents, setConsents] = useState({ schedule: false, visibility: false, storage: false, privacy: false });
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [customInterest, setCustomInterest] = useState('');
  const [pendingInterests, setPendingInterests] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [scheduleTab, setScheduleTab] = useState<'calendar' | 'url'>('calendar');
  const [scheduleUrl, setScheduleUrl] = useState('');
  const [biometricType, setBiometricType] = useState<BiometricType>('none');
  const [biometricEnabled, setBiometricEnabledState] = useState(false);
  const [profileName, setProfileName] = useState('');

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const type = await getBiometricType();
      const enabled = await isBiometricEnabled();
      setBiometricType(type);
      setBiometricEnabledState(enabled);

      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', session.user.id)
        .single();
      if (profile?.display_name) setProfileName(profile.display_name);

      if (type !== 'none' && enabled) {
        setStep('biometric');
      } else {
        setStep('home');
      }
    };
    init();
  }, []);

  const allConsented = Object.values(consents).every(Boolean);

  const toggleConsent = (key: string) => {
    setConsents(prev => ({ ...prev, [key]: !prev[key as keyof typeof prev] }));
  };

  const toggleInterest = (interest: string) => {
    setSelectedInterests(prev =>
      prev.includes(interest) ? prev.filter(i => i !== interest) : [...prev, interest]
    );
  };

  const handleLogin = async () => {
    if (!email.includes('@')) {
      Alert.alert('Ungültige Email', 'Bitte gib deine Email ein.');
      return;
    }
    setLoading(true);
    const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      Alert.alert('Fehler', error.message);
      return;
    }

    const userId = authData.user?.id;
    if (!userId) return;

    const type = await getBiometricType();
    const enabled = await isBiometricEnabled();
    setBiometricType(type);
    setBiometricEnabledState(enabled);

    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, consent_date')
      .eq('id', userId)
      .single();

    if (profile?.consent_date) {
      if (profile.display_name) setProfileName(profile.display_name);
      setStep('home');
      if (type !== 'none' && !enabled) {
        const label = type === 'face' ? 'Face ID' : 'Touch ID';
        setTimeout(() => {
          Alert.alert(
            `${label} aktivieren?`,
            'Beim nächsten Öffnen schnell und sicher einloggen.',
            [
              { text: 'Nein', style: 'cancel' },
              { text: 'Aktivieren', onPress: async () => {
                await saveBiometricEnabled(true);
                setBiometricEnabledState(true);
              }},
            ]
          );
        }, 500);
      }
    } else {
      setStep('welcome');
    }
  };

  const handleConsent = async () => {
    setLoading(true);
    const user = await getCurrentUser();
    if (!user) { setLoading(false); return; }
    const { error } = await saveConsents(user.id, displayName || email.split('@')[0]);
    setLoading(false);
    if (error) {
      Alert.alert('Fehler', error.message);
    } else {
      setStep('interests');
    }
  };

  const handleFinish = async () => {
    setLoading(true);
    const user = await getCurrentUser();
    if (!user) { setLoading(false); return; }
    await saveInterests(user.id, selectedInterests);
    for (const interest of pendingInterests) {
      await suggestInterest(user.id, interest, 'Sonstiges');
    }
    setLoading(false);
    setStep('schedule');
  };

  const submitCustomInterest = () => {
    if (customInterest.trim()) {
      setPendingInterests(prev => [...prev, customInterest.trim()]);
      setCustomInterest('');
    }
  };

  const handleBiometricLogin = async () => {
    setLoading(true);
    const success = await authenticateWithBiometrics();
    setLoading(false);
    if (success) {
      if (!profileName) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('id', session.user.id)
            .single();
          if (profile?.display_name) setProfileName(profile.display_name);
        }
      }
      setStep('home');
    }
  };

  const handleToggleBiometric = async (val: boolean) => {
    await saveBiometricEnabled(val);
    setBiometricEnabledState(val);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    await saveBiometricEnabled(false);
    setBiometricEnabledState(false);
    setProfileName('');
    setStep('login');
  };

  const handleScheduleImport = async () => {
    setLoading(true);
    try {
      let flights: FlightEntry[] = [];

      if (scheduleTab === 'calendar') {
        const { status } = await Calendar.requestCalendarPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Zugriff verweigert', 'Swiss Buddy benötigt Zugriff auf deinen Kalender.');
          setLoading(false);
          return;
        }
        const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
        const swissCalendars = calendars.filter(cal =>
          ['swiss', 'followme', 'crew', 'roster', 'schedule'].some(kw => cal.title.toLowerCase().includes(kw))
        );
        if (swissCalendars.length === 0) {
          Alert.alert('Kein Kalender gefunden', 'Kein Swiss/FollowMe Kalender gefunden. Nutze die URL-Option.', [
            { text: 'URL verwenden', onPress: () => { setScheduleTab('url'); setLoading(false); } },
            { text: 'OK', onPress: () => setLoading(false) },
          ]);
          return;
        }
        const now = new Date();
        const future = new Date(); future.setDate(future.getDate() + 90);
        for (const cal of swissCalendars) {
          const events = await Calendar.getEventsAsync([cal.id], now, future);
          for (const event of events) {
            const match = event.title?.match(/([A-Z]{2}\s?\d+)\s+([A-Z]{3})-([A-Z]{3})/);
            if (!match) continue;
            const start = new Date(event.startDate);
            const end = new Date(event.endDate);
            flights.push({
              flightNumber: match[1].replace(' ', ''),
              departureAirport: match[2],
              arrivalAirport: match[3],
              departureDate: start.toISOString().split('T')[0],
              layoverHours: Math.max(0, Math.round((end.getTime() - start.getTime()) / 3600000)),
            });
          }
        }
      } else {
        if (!scheduleUrl.trim()) {
          Alert.alert('Fehler', 'Bitte gib eine URL ein.');
          setLoading(false);
          return;
        }
        const fetchUrl = scheduleUrl.trim().replace(/^webcal:\/\//i, 'https://');
        const response = await fetch(fetchUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        flights = parseIcal(await response.text());
      }

      if (flights.length === 0) {
        Alert.alert('Keine Flüge gefunden', 'Es wurden keine Flugdaten gefunden. Du kannst den Import später unter Home einrichten.');
        setLoading(false);
        return;
      }

      const user = await getCurrentUser();
      if (!user) { setLoading(false); return; }
      await saveSchedule(user.id, flights);
      await saveScheduleSource(scheduleTab, scheduleTab === 'url' ? scheduleUrl : undefined);
      setLoading(false);
      Alert.alert(`${flights.length} Flüge importiert`, 'Dein Flugplan ist bereit. Swiss Buddy sucht jetzt nach Buddy-Überschneidungen.', [
        { text: 'Los geht\'s', onPress: () => setStep('home') },
      ]);
    } catch {
      setLoading(false);
      Alert.alert('Fehler', 'Der Flugplan konnte nicht geladen werden.');
    }
  };

  // SCHEDULE ONBOARDING STEP
  if (step === 'schedule') {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Flugplan einrichten</Text>
        <Text style={styles.subtitle}>
          Damit Swiss Buddy Buddy-Überschneidungen an deinen Layovers finden kann.
        </Text>
        <View style={styles.scheduleTabRow}>
          <TouchableOpacity
            style={[styles.scheduleTab, scheduleTab === 'calendar' && styles.scheduleTabActive]}
            onPress={() => setScheduleTab('calendar')}
          >
            <Text style={[styles.tabText, scheduleTab === 'calendar' && styles.tabTextActive]}>📅 Kalender</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.scheduleTab, scheduleTab === 'url' && styles.scheduleTabActive]}
            onPress={() => setScheduleTab('url')}
          >
            <Text style={[styles.tabText, scheduleTab === 'url' && styles.tabTextActive]}>🔗 URL</Text>
          </TouchableOpacity>
        </View>
        {scheduleTab === 'calendar' && (
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>iOS Kalender-Zugriff</Text>
            <Text style={styles.infoText}>Swiss Buddy liest deinen bestehenden Swiss/FollowMe Kalender aus und importiert alle Flüge der nächsten 90 Tage.</Text>
            <Text style={[styles.infoText, { marginTop: 8 }]}>Voraussetzung: Schedule Feed ist als Kalenderabo in iOS eingerichtet.</Text>
          </View>
        )}
        {scheduleTab === 'url' && (
          <>
            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>Schedule Feed URL</Text>
              <Text style={styles.infoText}>1. FollowMe App öffnen → Einstellungen → Kalender</Text>
              <Text style={styles.infoText}>2. Kalender-URL kopieren (webcal:// oder https://)</Text>
              <Text style={styles.infoText}>3. Hier einfügen</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="webcal://... oder https://..."
              value={scheduleUrl}
              onChangeText={setScheduleUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
          </>
        )}
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleScheduleImport}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.buttonText}>Flugplan laden & speichern</Text>
          }
        </TouchableOpacity>
        <TouchableOpacity style={styles.skipBtn} onPress={() => setStep('home')}>
          <Text style={styles.skipBtnText}>Später einrichten</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // BIOMETRIC SCREEN
  if (step === 'biometric') {
    const label = biometricType === 'face' ? 'Face ID' : 'Touch ID';
    return (
      <View style={styles.container}>
        <View style={styles.iconBox}>
          <Text style={styles.icon}>✈</Text>
        </View>
        <Text style={styles.title}>Swiss Buddy</Text>
        <Text style={styles.subtitle}>Bestätige deine Identität um fortzufahren.</Text>
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleBiometricLogin}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.buttonText}>Mit {label} einloggen</Text>
          }
        </TouchableOpacity>
        <TouchableOpacity style={styles.skipBtn} onPress={() => setStep('login')}>
          <Text style={styles.skipBtnText}>Mit Email & Passwort einloggen</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // HOME SCREEN
  if (step === 'home') {
    const label = biometricType === 'face' ? 'Face ID' : 'Touch ID';
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.iconBox}>
          <Text style={styles.icon}>✈</Text>
        </View>
        <Text style={styles.title}>
          {profileName ? `Hallo, ${profileName.split(' ')[0]}!` : 'Swiss Buddy'}
        </Text>
        <Text style={styles.subtitle}>Bereit für deinen nächsten Layover.</Text>
        {biometricType !== 'none' && (
          <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingTitle}>{label}</Text>
              <Text style={styles.settingDesc}>Beim Öffnen der App automatisch einloggen</Text>
            </View>
            <Switch
              value={biometricEnabled}
              onValueChange={handleToggleBiometric}
              trackColor={{ false: '#ccc', true: '#185FA5' }}
              thumbColor="#fff"
            />
          </View>
        )}
        <TouchableOpacity style={styles.settingRow} onPress={() => router.push('/(tabs)/schedule')}>
          <View style={{ flex: 1 }}>
            <Text style={styles.settingTitle}>Flugplan-Import</Text>
            <Text style={styles.settingDesc}>Quelle bearbeiten oder neu laden</Text>
          </View>
          <Text style={styles.settingChevron}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Ausloggen</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // LOGIN SCREEN
  if (step === 'login') {
    return (
      <View style={styles.container}>
        <View style={styles.iconBox}>
          <Text style={styles.icon}>✈</Text>
        </View>
        <Text style={styles.title}>Swiss Buddy</Text>
        <Text style={styles.subtitle}>Melde dich mit deiner Swiss-Email an.</Text>
        <TextInput
          style={styles.input}
          placeholder="vorname.nachname@swiss.com"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoCorrect={false}
        />
        <TextInput
          style={styles.input}
          placeholder="Passwort"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <TextInput
          style={styles.input}
          placeholder="Dein Name (z.B. Anna Lüscher)"
          value={displayName}
          onChangeText={setDisplayName}
        />
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Einloggen</Text>}
        </TouchableOpacity>
        <Text style={styles.hint}>Nur für Swiss-Mitarbeitende.</Text>
      </View>
    );
  }

  // WELCOME SCREEN
  if (step === 'welcome') {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.iconBox}>
          <Text style={styles.icon}>✈</Text>
        </View>
        <Text style={styles.title}>Willkommen!</Text>
        <Text style={styles.subtitle}>
          Bevor du startest, erkläre kurz wie wir mit deinen Daten umgehen.
        </Text>
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>Was diese App macht</Text>
          <Text style={styles.infoText}>• Dein Flugplan wird eingelesen und für das Matching verwendet</Text>
          <Text style={styles.infoText}>• Andere sehen nur deinen Namen, Interessen und Destination</Text>
          <Text style={styles.infoText}>• Die Teilnahme ist vollständig freiwillig</Text>
        </View>
        <View style={styles.warningBox}>
          <Text style={styles.warningTitle}>Wichtig zu wissen</Text>
          <Text style={styles.warningText}>• Du kannst deine Daten jederzeit vollständig löschen</Text>
          <Text style={styles.warningText}>• Swiss hat keinen Zugriff auf deine App-Aktivitäten</Text>
        </View>
        <TouchableOpacity style={styles.button} onPress={() => setStep('consent')}>
          <Text style={styles.buttonText}>Weiter</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // CONSENT SCREEN
  if (step === 'consent') {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Einwilligung</Text>
        <Text style={styles.subtitle}>
          Bitte bestätige die folgenden Punkte. Du kannst jede Einwilligung später widerrufen.
        </Text>
        {CONSENTS.map(item => (
          <TouchableOpacity key={item.key} style={styles.consentRow} onPress={() => toggleConsent(item.key)}>
            <View style={[styles.checkbox, consents[item.key as keyof typeof consents] && styles.checkboxChecked]}>
              {consents[item.key as keyof typeof consents] && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <View style={styles.consentText}>
              <Text style={styles.consentTitle}>{item.title}</Text>
              <Text style={styles.consentDesc}>{item.desc}</Text>
            </View>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[styles.button, (!allConsented || loading) && styles.buttonDisabled]}
          onPress={handleConsent}
          disabled={!allConsented || loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Zustimmen & weiter</Text>}
        </TouchableOpacity>
        <Text style={styles.hint}>Du kannst alle Einwilligungen jederzeit in den Einstellungen widerrufen.</Text>
      </ScrollView>
    );
  }

  // INTERESTS SCREEN
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Interessen wählen</Text>
      <Text style={styles.subtitle}>Wähle deine Interessen – diese werden mit deiner Crew verglichen.</Text>

      {Object.entries(INTERESTS).map(([category, items]) => (
        <View key={category} style={{ marginBottom: 20 }}>
          <Text style={styles.categoryLabel}>{category}</Text>
          <View style={styles.tagsRow}>
            {items.map(item => (
              <TouchableOpacity
                key={item}
                style={[styles.tag, selectedInterests.includes(item) && styles.tagSelected]}
                onPress={() => toggleInterest(item)}
              >
                <Text style={[styles.tagText, selectedInterests.includes(item) && styles.tagTextSelected]}>
                  {item}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}

      <Text style={styles.categoryLabel}>Eigenes Interesse vorschlagen</Text>
      <View style={styles.customInputRow}>
        <TextInput
          style={styles.customInput}
          placeholder="z.B. Tauchen, Skateboarding..."
          value={customInterest}
          onChangeText={setCustomInterest}
          maxLength={32}
          onSubmitEditing={submitCustomInterest}
        />
        <TouchableOpacity
          style={[styles.addButton, !customInterest.trim() && styles.buttonDisabled]}
          disabled={!customInterest.trim()}
          onPress={submitCustomInterest}
        >
          <Text style={styles.buttonText}>+</Text>
        </TouchableOpacity>
      </View>

      {pendingInterests.length > 0 && (
        <View style={{ marginBottom: 16 }}>
          <Text style={[styles.categoryLabel, { marginTop: 8 }]}>Deine Vorschläge</Text>
          {pendingInterests.map(item => (
            <View key={item} style={styles.pendingRow}>
              <Text style={styles.pendingText}>{item}</Text>
              <Text style={styles.pendingBadge}>Wird geprüft</Text>
            </View>
          ))}
        </View>
      )}

      <TouchableOpacity
        style={[styles.button, ((selectedInterests.length === 0 && pendingInterests.length === 0) || loading) && styles.buttonDisabled]}
        disabled={(selectedInterests.length === 0 && pendingInterests.length === 0) || loading}
        onPress={handleFinish}
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.buttonText}>
              {selectedInterests.length === 0 && pendingInterests.length === 0
                ? 'Mindestens 1 Interesse wählen'
                : `Fertig (${selectedInterests.length + pendingInterests.length} gewählt)`}
            </Text>
        }
      </TouchableOpacity>

      <TouchableOpacity style={styles.skipBtn} onPress={handleFinish}>
        <Text style={styles.skipBtnText}>Später ausfüllen</Text>
      </TouchableOpacity>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: '#fff', padding: 24, paddingTop: 60 },
  iconBox: { width: 64, height: 64, backgroundColor: '#E6F1FB', borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  icon: { fontSize: 32 },
  title: { fontSize: 24, fontWeight: '500', color: '#1a1a1a', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#666', lineHeight: 22, marginBottom: 20 },
  input: { borderWidth: 0.5, borderColor: '#ccc', borderRadius: 10, padding: 12, fontSize: 15, backgroundColor: '#F9F9F9', marginBottom: 12 },
  infoBox: { backgroundColor: '#E6F1FB', borderRadius: 10, padding: 14, marginBottom: 12 },
  infoTitle: { fontSize: 13, fontWeight: '500', color: '#0C447C', marginBottom: 6 },
  infoText: { fontSize: 12, color: '#185FA5', lineHeight: 22 },
  warningBox: { backgroundColor: '#FAEEDA', borderRadius: 10, padding: 14, marginBottom: 24 },
  warningTitle: { fontSize: 13, fontWeight: '500', color: '#633806', marginBottom: 6 },
  warningText: { fontSize: 12, color: '#854F0B', lineHeight: 22 },
  button: { backgroundColor: '#185FA5', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 12 },
  buttonDisabled: { backgroundColor: '#ccc' },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '500' },
  consentRow: { flexDirection: 'row', gap: 12, marginBottom: 16, alignItems: 'flex-start' },
  checkbox: { width: 22, height: 22, borderRadius: 5, borderWidth: 1.5, borderColor: '#ccc', alignItems: 'center', justifyContent: 'center', marginTop: 2, flexShrink: 0 },
  checkboxChecked: { backgroundColor: '#185FA5', borderColor: '#185FA5' },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: '500' },
  consentText: { flex: 1 },
  consentTitle: { fontSize: 13, fontWeight: '500', color: '#1a1a1a', marginBottom: 3 },
  consentDesc: { fontSize: 12, color: '#666', lineHeight: 18 },
  hint: { fontSize: 11, color: '#999', textAlign: 'center', lineHeight: 16 },
  categoryLabel: { fontSize: 12, fontWeight: '500', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F1EFE8', borderWidth: 1.5, borderColor: 'transparent' },
  tagSelected: { backgroundColor: '#E6F1FB', borderColor: '#185FA5' },
  tagText: { fontSize: 13, color: '#666', fontWeight: '500' },
  tagTextSelected: { color: '#185FA5' },
  customInputRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  customInput: { flex: 1, borderWidth: 0.5, borderColor: '#ccc', borderRadius: 10, padding: 10, fontSize: 14, backgroundColor: '#F9F9F9' },
  addButton: { backgroundColor: '#185FA5', borderRadius: 10, width: 44, alignItems: 'center', justifyContent: 'center' },
  pendingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: '#eee' },
  pendingText: { fontSize: 13, color: '#1a1a1a' },
  pendingBadge: { fontSize: 11, color: '#633806', backgroundColor: '#FAEEDA', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  skipBtn: { padding: 14, alignItems: 'center', marginTop: 4 },
  skipBtnText: { fontSize: 14, color: '#888' },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: '#eee', marginBottom: 8 },
  settingTitle: { fontSize: 14, fontWeight: '500', color: '#1a1a1a', marginBottom: 2 },
  settingDesc: { fontSize: 12, color: '#888' },
  settingChevron: { fontSize: 20, color: '#185FA5', fontWeight: '300' },
  logoutBtn: { marginTop: 24, padding: 14, alignItems: 'center' },
  logoutText: { fontSize: 14, color: '#e74c3c', fontWeight: '500' },
  scheduleTabRow: { flexDirection: 'row', marginBottom: 20, borderRadius: 10, overflow: 'hidden', borderWidth: 0.5, borderColor: '#ddd' },
  scheduleTab: { flex: 1, padding: 12, alignItems: 'center', backgroundColor: '#F9F9F9' },
  scheduleTabActive: { backgroundColor: '#185FA5' },
  tabText: { fontSize: 14, fontWeight: '500', color: '#888' },
  tabTextActive: { color: '#fff' },
});
