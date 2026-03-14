import * as Calendar from 'expo-calendar';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { getCurrentUser } from '../../lib/auth';
import { saveScheduleSource } from '../../lib/backgroundSync';
import { FlightEntry, parseIcal } from '../../lib/icalParser';
import { saveSchedule } from '../../lib/schedule';

export default function ScheduleScreen() {
  const [url, setUrl] = useState('');
  const [flights, setFlights] = useState<FlightEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<'calendar' | 'url'>('calendar');

  const handleCalendarImport = async () => {
    setLoading(true);
    setSaved(false);
    setFlights([]);

    try {
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Zugriff verweigert', 'Swiss Buddy benötigt Zugriff auf deinen Kalender um den Schedule Feed zu lesen.');
        setLoading(false);
        return;
      }

      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);

      // Swiss-relevante Kalender filtern
      const swissCalendars = calendars.filter(cal =>
        cal.title.toLowerCase().includes('swiss') ||
        cal.title.toLowerCase().includes('followme') ||
        cal.title.toLowerCase().includes('crew') ||
        cal.title.toLowerCase().includes('roster') ||
        cal.title.toLowerCase().includes('schedule')
      );

      if (swissCalendars.length === 0) {
        Alert.alert(
          'Kein Schedule-Kalender gefunden',
          'Es wurde kein Swiss/FollowMe Kalender gefunden. Bitte richte zuerst das Kalender-Abonnement in der FollowMe App ein, oder nutze die URL-Option.',
          [
            { text: 'URL verwenden', onPress: () => setActiveTab('url') },
            { text: 'OK' }
          ]
        );
        setLoading(false);
        return;
      }

      // Flüge aus den nächsten 90 Tagen laden
      const now = new Date();
      const future = new Date();
      future.setDate(future.getDate() + 90);

      const allFlights: FlightEntry[] = [];

      for (const cal of swissCalendars) {
        const events = await Calendar.getEventsAsync([cal.id], now, future);

        for (const event of events) {
          const match = event.title?.match(/([A-Z]{2}\s?\d+)\s+([A-Z]{3})-([A-Z]{3})/);
          if (!match) continue;

          const start = new Date(event.startDate);
          const end = new Date(event.endDate);
          const layoverHours = Math.round((end.getTime() - start.getTime()) / 3600000);

          allFlights.push({
            flightNumber: match[1].replace(' ', ''),
            departureAirport: match[2],
            arrivalAirport: match[3],
            departureDate: start.toISOString().split('T')[0],
            layoverHours: layoverHours > 0 ? layoverHours : 0,
          });
        }
      }

      if (allFlights.length === 0) {
        Alert.alert('Keine Flüge gefunden', `Kalender "${swissCalendars.map(c => c.title).join(', ')}" gefunden, aber keine Flugeinträge im Format "LX123 ZRH-BKK".`);
      } else {
        setFlights(allFlights);
      }
    } catch (e) {
      Alert.alert('Fehler', 'Der Kalender konnte nicht gelesen werden.');
    }

    setLoading(false);
  };

  const handleUrlFetch = async () => {
    if (!url.trim()) {
      Alert.alert('Fehler', 'Bitte gib eine URL ein.');
      return;
    }
    setLoading(true);
    setSaved(false);
    setFlights([]);
    try {
      const fetchUrl = url.trim().replace(/^webcal:\/\//i, 'https://');
      const response = await fetch(fetchUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const content = await response.text();
      const parsed = parseIcal(content);
      if (parsed.length === 0) {
        Alert.alert('Keine Flüge gefunden', 'Die URL enthält keine erkennbaren Flugdaten.');
      } else {
        setFlights(parsed);
      }
    } catch (e) {
      Alert.alert('Fehler', 'Der Schedule Feed konnte nicht geladen werden. Bitte prüfe die URL.');
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setLoading(true);
    const user = await getCurrentUser();
    if (!user) { Alert.alert('Fehler', 'Nicht eingeloggt.'); setLoading(false); return; }
    const { error } = await saveSchedule(user.id, flights);
    setLoading(false);
    if (error) {
      Alert.alert('Fehler beim Speichern', error.message);
    } else {
      setSaved(true);
      await saveScheduleSource(activeTab, activeTab === 'url' ? url : undefined);
      Alert.alert('Gespeichert!', `${flights.length} Flüge wurden erfolgreich importiert.`);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('de-CH', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  return (
    <ScrollView contentContainerStyle={styles.container} scrollEnabled={true} showsVerticalScrollIndicator={true}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Text style={styles.backBtnText}>← Zurück</Text>
      </TouchableOpacity>
      <Text style={styles.title}>Flugplan importieren</Text>
      <Text style={styles.subtitle}>Importiere deinen Schedule um Crew-Matches zu finden.</Text>

      {/* Tab switcher */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'calendar' && styles.tabActive]}
          onPress={() => { setActiveTab('calendar'); setFlights([]); setSaved(false); }}
        >
          <Text style={[styles.tabText, activeTab === 'calendar' && styles.tabTextActive]}>
            📅 Kalender
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'url' && styles.tabActive]}
          onPress={() => { setActiveTab('url'); setFlights([]); setSaved(false); }}
        >
          <Text style={[styles.tabText, activeTab === 'url' && styles.tabTextActive]}>
            🔗 URL
          </Text>
        </TouchableOpacity>
      </View>

      {/* Kalender Option */}
      {activeTab === 'calendar' && (
        <>
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>Kalender-Zugriff</Text>
            <Text style={styles.infoText}>Swiss Buddy liest deinen bestehenden Swiss/FollowMe Kalender aus und importiert automatisch alle Flüge der nächsten 90 Tage.</Text>
            <Text style={[styles.infoText, { marginTop: 8 }]}>Voraussetzung: Der Schedule Feed ist bereits als Kalender-Abonnement in iOS eingerichtet.</Text>
          </View>
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleCalendarImport}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.buttonText}>Kalender lesen</Text>
            }
          </TouchableOpacity>
        </>
      )}

      {/* URL Option */}
      {activeTab === 'url' && (
        <>
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>Schedule Feed URL</Text>
            <Text style={styles.infoText}>1. FollowMe App öffnen → Einstellungen → Kalender</Text>
            <Text style={styles.infoText}>2. Kalender-URL kopieren (webcal:// oder https://)</Text>
            <Text style={styles.infoText}>3. Hier einfügen und laden</Text>
          </View>
          <TextInput
            style={styles.input}
            placeholder="webcal://... oder https://..."
            value={url}
            onChangeText={text => { setUrl(text); setFlights([]); setSaved(false); }}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <TouchableOpacity
            style={[styles.button, (loading || !url.trim()) && styles.buttonDisabled]}
            onPress={handleUrlFetch}
            disabled={loading || !url.trim()}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.buttonText}>Flugplan laden</Text>
            }
          </TouchableOpacity>
        </>
      )}

      {/* Ergebnisse */}
      {flights.length > 0 && (
        <>
          <View style={styles.resultHeader}>
            <Text style={styles.resultTitle}>{flights.length} Flüge gefunden</Text>
            {saved && <Text style={styles.savedBadge}>✓ Gespeichert</Text>}
          </View>

          {flights.map((flight, i) => (
            <View key={i} style={styles.flightCard}>
              <View style={styles.flightRoute}>
                <Text style={styles.flightNumber}>{flight.flightNumber}</Text>
                <Text style={styles.flightAirports}>{flight.departureAirport} → {flight.arrivalAirport}</Text>
              </View>
              <View style={styles.flightRight}>
                <Text style={styles.flightDate}>{formatDate(flight.departureDate)}</Text>
                {flight.layoverHours > 0 && (
                  <Text style={styles.flightLayover}>{flight.layoverHours}h Layover</Text>
                )}
              </View>
            </View>
          ))}

          <TouchableOpacity
            style={[styles.saveBtn, (loading || saved) && styles.saveBtnSaved]}
            onPress={handleSave}
            disabled={loading || saved}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.saveBtnText}>{saved ? '✓ Gespeichert' : 'Flugplan speichern'}</Text>
            }
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: '#fff', padding: 24, paddingTop: 60, paddingBottom: 40 },
  backBtn: { marginBottom: 16 },
  backBtnText: { fontSize: 15, color: '#185FA5', fontWeight: '500' },
  title: { fontSize: 24, fontWeight: '500', color: '#1a1a1a', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#666', lineHeight: 22, marginBottom: 20 },
  tabRow: { flexDirection: 'row', marginBottom: 20, borderRadius: 10, overflow: 'hidden', borderWidth: 0.5, borderColor: '#ddd' },
  tab: { flex: 1, padding: 12, alignItems: 'center', backgroundColor: '#F9F9F9' },
  tabActive: { backgroundColor: '#185FA5' },
  tabText: { fontSize: 14, fontWeight: '500', color: '#888' },
  tabTextActive: { color: '#fff' },
  infoBox: { backgroundColor: '#E6F1FB', borderRadius: 10, padding: 14, marginBottom: 20 },
  infoTitle: { fontSize: 13, fontWeight: '500', color: '#0C447C', marginBottom: 8 },
  infoText: { fontSize: 12, color: '#185FA5', lineHeight: 22 },
  input: { borderWidth: 0.5, borderColor: '#ccc', borderRadius: 10, padding: 12, fontSize: 14, backgroundColor: '#F9F9F9', marginBottom: 14 },
  button: { backgroundColor: '#185FA5', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 24 },
  buttonDisabled: { backgroundColor: '#ccc' },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '500' },
  resultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  resultTitle: { fontSize: 14, fontWeight: '500', color: '#1a1a1a' },
  savedBadge: { fontSize: 12, color: '#085041', backgroundColor: '#E1F5EE', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  flightCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderWidth: 0.5, borderColor: '#eee', borderRadius: 12, marginBottom: 8, backgroundColor: '#FAFAFA' },
  flightRoute: { flex: 1 },
  flightNumber: { fontSize: 13, fontWeight: '500', color: '#185FA5', marginBottom: 2 },
  flightAirports: { fontSize: 15, fontWeight: '500', color: '#1a1a1a' },
  flightRight: { alignItems: 'flex-end' },
  flightDate: { fontSize: 13, color: '#444', marginBottom: 2 },
  flightLayover: { fontSize: 11, color: '#666', backgroundColor: '#F1EFE8', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  saveBtn: { backgroundColor: '#185FA5', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  saveBtnSaved: { backgroundColor: '#1D9E75' },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '500' },
});
