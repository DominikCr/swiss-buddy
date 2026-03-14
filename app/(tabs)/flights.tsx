import { useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getCurrentUser } from '../../lib/auth';
import { getSchedule } from '../../lib/schedule';
import { supabase } from '../../lib/supabase';

export default function FlightsScreen() {
  const [flights, setFlights] = useState<any[]>([]);
  const [overlaps, setOverlaps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const user = await getCurrentUser();
    if (!user) { setLoading(false); return; }
    setUserId(user.id);

    const [scheduleResult, overlapResult] = await Promise.all([
      getSchedule(user.id),
      supabase.rpc('get_layover_overlaps', { user_id: user.id }),
    ]);

    if (scheduleResult.data) setFlights(scheduleResult.data);
    if (overlapResult.data) setOverlaps(overlapResult.data);
    setLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('de-CH', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  const getOverlapsForFlight = (flight: any) => {
    return overlaps.filter(o =>
      o.destination === flight.arrival_airport &&
      o.overlap_start <= flight.departure_date &&
      o.overlap_end >= flight.departure_date
    );
  };

  const avatarColors = ['#E6F1FB', '#E1F5EE', '#FAECE7', '#EEEDFE', '#FAEEDA'];
  const textColors = ['#0C447C', '#085041', '#712B13', '#3C3489', '#633806'];
  const getColor = (name: string) => {
    const idx = (name?.charCodeAt(0) || 0) % 5;
    return { bg: avatarColors[idx], text: textColors[idx] };
  };
  const getInitials = (name: string) => {
    if (!name) return '??';
    return name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#185FA5" />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.title}>Meine Flüge</Text>

      {overlaps.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>Buddy-Überschneidungen</Text>
          {overlaps.map((overlap, i) => {
            const colors = getColor(overlap.buddy_name);
            return (
              <View key={i} style={styles.overlapCard}>
                <View style={styles.overlapLeft}>
                  <View style={[styles.avatar, { backgroundColor: colors.bg }]}>
                    <Text style={[styles.avatarText, { color: colors.text }]}>{getInitials(overlap.buddy_name)}</Text>
                  </View>
                  <View>
                    <Text style={styles.overlapName}>{overlap.buddy_name}</Text>
                    <Text style={styles.overlapDetail}>
                      {overlap.destination} · {formatDate(overlap.overlap_start)}
                      {overlap.overlap_start !== overlap.overlap_end && ` – ${formatDate(overlap.overlap_end)}`}
                    </Text>
                    <Text style={styles.overlapFlight}>{overlap.buddy_flight}</Text>
                  </View>
                </View>
                <View style={styles.matchBadge}>
                  <Text style={styles.matchBadgeText}>Buddy!</Text>
                </View>
              </View>
            );
          })}
        </>
      )}

      <Text style={styles.sectionLabel}>Kommende Flüge</Text>

      {flights.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>✈</Text>
          <Text style={styles.emptyTitle}>Kein Flugplan importiert</Text>
          <Text style={styles.emptyText}>Importiere deinen Schedule im Flugplan-Tab.</Text>
        </View>
      ) : (
        flights.map((flight, i) => {
          const flightOverlaps = getOverlapsForFlight(flight);
          return (
            <View key={i} style={[styles.flightCard, flightOverlaps.length > 0 && styles.flightCardHighlight]}>
              <View style={styles.flightHeader}>
                <View>
                  <Text style={styles.flightRoute}>
                    {flight.departure_airport} → {flight.arrival_airport}
                  </Text>
                  <Text style={styles.flightNumber}>{flight.flight_number}</Text>
                </View>
                <View style={styles.flightRight}>
                  <Text style={styles.flightDate}>{formatDate(flight.departure_date)}</Text>
                  {flight.layover_hours > 0 && (
                    <Text style={styles.flightLayover}>{flight.layover_hours}h Layover</Text>
                  )}
                </View>
              </View>

              {flightOverlaps.length > 0 && (
                <View style={styles.buddiesRow}>
                  <Text style={styles.buddiesLabel}>Buddies vor Ort:</Text>
                  <View style={styles.avatarRow}>
                    {flightOverlaps.map((o, j) => {
                      const c = getColor(o.buddy_name);
                      return (
                        <View key={j} style={[styles.avatarSmall, { backgroundColor: c.bg }, j > 0 && { marginLeft: -8 }]}>
                          <Text style={[styles.avatarSmallText, { color: c.text }]}>{getInitials(o.buddy_name)}</Text>
                        </View>
                      );
                    })}
                    <Text style={styles.buddiesCount}>{flightOverlaps.length} Buddy{flightOverlaps.length > 1 ? 's' : ''}</Text>
                  </View>
                </View>
              )}
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: '#fff', padding: 24, paddingTop: 60, paddingBottom: 40 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '500', color: '#1a1a1a', marginBottom: 20 },
  sectionLabel: { fontSize: 12, fontWeight: '500', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10, marginTop: 8 },
  overlapCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, backgroundColor: '#E1F5EE', borderRadius: 12, marginBottom: 8, borderWidth: 0.5, borderColor: '#9FE1CB' },
  overlapLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  overlapName: { fontSize: 14, fontWeight: '500', color: '#1a1a1a' },
  overlapDetail: { fontSize: 12, color: '#444', marginTop: 2 },
  overlapFlight: { fontSize: 11, color: '#666', marginTop: 1 },
  matchBadge: { backgroundColor: '#1D9E75', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  matchBadgeText: { fontSize: 11, fontWeight: '500', color: '#fff' },
  flightCard: { padding: 14, borderWidth: 0.5, borderColor: '#eee', borderRadius: 12, marginBottom: 10, backgroundColor: '#FAFAFA' },
  flightCardHighlight: { borderColor: '#B5D4F4', backgroundColor: '#EEF4FC' },
  flightHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  flightRoute: { fontSize: 18, fontWeight: '500', color: '#1a1a1a' },
  flightNumber: { fontSize: 13, color: '#185FA5', marginTop: 2 },
  flightRight: { alignItems: 'flex-end' },
  flightDate: { fontSize: 13, color: '#444' },
  flightLayover: { fontSize: 11, color: '#666', backgroundColor: '#F1EFE8', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, marginTop: 4 },
  buddiesRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTopWidth: 0.5, borderTopColor: '#B5D4F4', gap: 8 },
  buddiesLabel: { fontSize: 12, color: '#444' },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 15, fontWeight: '500' },
  avatarSmall: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  avatarSmallText: { fontSize: 10, fontWeight: '500' },
  buddiesCount: { fontSize: 12, color: '#185FA5', fontWeight: '500', marginLeft: 4 },
  emptyState: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 16, fontWeight: '500', color: '#1a1a1a', marginBottom: 8 },
  emptyText: { fontSize: 13, color: '#666', textAlign: 'center' },
});
