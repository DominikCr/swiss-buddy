import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { getCurrentUser } from '../../lib/auth';
import { CONTINENTS, CrewSpot, deleteSpot, getSpots, groupSpotsByLocation, reverseGeocode, searchSpots, SpotCategory, updateSpot } from '../../lib/spots';

const CATEGORY_LABELS: Record<SpotCategory, string> = {
  restaurant: '🍽 Restaurant',
  bar: '🍸 Bar',
  sehenswürdigkeit: '🏛 Sehenswürdigkeit',
  hotel: '🏨 Hotel',
  sport: '⚽ Sport',
  shopping: '🛍 Shopping',
  sonstiges: '📍 Sonstiges',
};

const CATEGORY_COLORS: Record<SpotCategory, string> = {
  restaurant: '#FAECE7', bar: '#EEEDFE', sehenswürdigkeit: '#E6F1FB',
  hotel: '#E1F5EE', sport: '#FAEEDA', shopping: '#FCEBEB', sonstiges: '#F1EFE8',
};

const CATEGORY_TEXT_COLORS: Record<SpotCategory, string> = {
  restaurant: '#712B13', bar: '#3C3489', sehenswürdigkeit: '#0C447C',
  hotel: '#085041', sport: '#633806', shopping: '#791F1F', sonstiges: '#444441',
};

export default function PoiEditorScreen() {
  const [spots, setSpots] = useState<CrewSpot[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedContinents, setExpandedContinents] = useState<Record<string, boolean>>({});
  const [expandedCountries, setExpandedCountries] = useState<Record<string, boolean>>({});
  const [expandedCities, setExpandedCities] = useState<Record<string, boolean>>({});
  const [editingSpot, setEditingSpot] = useState<CrewSpot | null>(null);
  const [editName, setEditName] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editCountry, setEditCountry] = useState('');
  const [editContinent, setEditContinent] = useState('');
  const [editCategory, setEditCategory] = useState<SpotCategory>('restaurant');
  const [saving, setSaving] = useState(false);
  const [activeCategory, setActiveCategory] = useState<SpotCategory | 'all'>('all');
  const [activeCity, setActiveCity] = useState<string | 'all' | 'current'>('all');
  const [currentCity, setCurrentCity] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  useEffect(() => { init(); }, []);

  const init = async () => {
    const user = await getCurrentUser();
    if (user) setUserId(user.id);
    const data = await getSpots();
    setSpots(data);
    setLoading(false);
  };

  const detectCurrentCity = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setLocating(false); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const geo = await reverseGeocode(loc.coords.latitude, loc.coords.longitude);
      if (geo.city) {
        setCurrentCity(geo.city);
        setActiveCity('current');
      }
    } catch {}
    setLocating(false);
  };

  const availableCities = [...new Set(spots.map(s => s.city).filter(Boolean) as string[])].sort();

  const filteredSpots = (() => {
    let result = searchQuery ? searchSpots(spots, searchQuery) : spots;
    if (activeCategory !== 'all') result = result.filter(s => s.category === activeCategory);
    if (activeCity === 'current' && currentCity) {
      result = result.filter(s => s.city === currentCity);
    } else if (activeCity !== 'all') {
      result = result.filter(s => s.city === activeCity);
    }
    return result;
  })();

  const grouped = groupSpotsByLocation(filteredSpots);

  const toggleContinent = (c: string) => setExpandedContinents(prev => ({ ...prev, [c]: !prev[c] }));
  const toggleCountry = (key: string) => setExpandedCountries(prev => ({ ...prev, [key]: !prev[key] }));
  const toggleCity = (key: string) => setExpandedCities(prev => ({ ...prev, [key]: !prev[key] }));

  const startEdit = (spot: CrewSpot) => {
    setEditingSpot(spot);
    setEditName(spot.name);
    setEditCity(spot.city || '');
    setEditCountry(spot.country || '');
    setEditContinent(spot.continent || '');
    setEditCategory(spot.category);
  };

  const handleAutoGeocode = async () => {
    if (!editingSpot) return;
    setSaving(true);
    const geo = await reverseGeocode(editingSpot.latitude, editingSpot.longitude);
    if (geo.city) setEditCity(geo.city);
    if (geo.country) setEditCountry(geo.country);
    if (geo.continent) setEditContinent(geo.continent);
    setSaving(false);
  };

  const handleSaveEdit = async () => {
    if (!editingSpot) return;
    setSaving(true);
    const { error } = await updateSpot(editingSpot.id, {
      name: editName.trim(),
      city: editCity.trim() || null,
      country: editCountry.trim() || null,
      continent: editContinent.trim() || null,
      category: editCategory,
    });
    setSaving(false);
    if (!error) { setEditingSpot(null); await init(); }
    else Alert.alert('Fehler', error.message);
  };

  const handleDelete = (spot: CrewSpot) => {
    Alert.alert('Spot löschen', `Möchtest du "${spot.name}" wirklich löschen?`, [
      { text: 'Abbrechen' },
      { text: 'Löschen', style: 'destructive', onPress: async () => { await deleteSpot(spot.id); await init(); } },
    ]);
  };

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#185FA5" /></View>;

  if (editingSpot) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <TouchableOpacity onPress={() => setEditingSpot(null)} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Zurück</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Spot bearbeiten</Text>
        <Text style={styles.label}>Name</Text>
        <TextInput style={styles.input} value={editName} onChangeText={setEditName} placeholder="Name des Spots" />
        <Text style={styles.label}>Kategorie</Text>
        <View style={styles.categoryRow}>
          {(Object.keys(CATEGORY_LABELS) as SpotCategory[]).map(cat => (
            <TouchableOpacity key={cat} style={[styles.catBtn, editCategory === cat && styles.catBtnActive]} onPress={() => setEditCategory(cat)}>
              <Text style={[styles.catBtnText, editCategory === cat && styles.catBtnTextActive]}>{CATEGORY_LABELS[cat]}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.label}>Stadt</Text>
        <TextInput style={styles.input} value={editCity} onChangeText={setEditCity} placeholder="z.B. Bangkok" />
        <TouchableOpacity style={styles.geoBtn} onPress={handleAutoGeocode} disabled={saving}>
          {saving ? <ActivityIndicator color="#185FA5" size="small" /> : <Text style={styles.geoBtnText}>📍 Stadt / Land / Kontinent automatisch ermitteln</Text>}
        </TouchableOpacity>
        <Text style={styles.label}>Land</Text>
        <TextInput style={styles.input} value={editCountry} onChangeText={setEditCountry} placeholder="z.B. Thailand" />
        <Text style={styles.label}>Kontinent</Text>
        <View style={styles.continentRow}>
          {CONTINENTS.map(c => (
            <TouchableOpacity key={c} style={[styles.continentBtn, editContinent === c && styles.continentBtnActive]} onPress={() => setEditContinent(c)}>
              <Text style={[styles.continentBtnText, editContinent === c && styles.continentBtnTextActive]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={[styles.saveBtn, (saving || !editName.trim()) && styles.saveBtnDisabled]} onPress={handleSaveEdit} disabled={saving || !editName.trim()}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Änderungen speichern</Text>}
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <View style={styles.wrapper}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>POI-Editor</Text>
        <Text style={styles.subtitle}>{spots.length} Spots gespeichert</Text>

        <TextInput style={styles.searchInput} placeholder="Suchen..." value={searchQuery} onChangeText={setSearchQuery} />

        {/* Kategorie-Filter */}
        <Text style={styles.filterLabel}>Kategorie</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          <TouchableOpacity style={[styles.filterBtn, activeCategory === 'all' && styles.filterBtnActive]} onPress={() => setActiveCategory('all')}>
            <Text style={[styles.filterBtnText, activeCategory === 'all' && styles.filterBtnTextActive]}>Alle</Text>
          </TouchableOpacity>
          {(Object.keys(CATEGORY_LABELS) as SpotCategory[]).map(cat => (
            <TouchableOpacity key={cat} style={[styles.filterBtn, activeCategory === cat && styles.filterBtnActive]} onPress={() => setActiveCategory(cat)}>
              <Text style={[styles.filterBtnText, activeCategory === cat && styles.filterBtnTextActive]}>{CATEGORY_LABELS[cat]}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Stadt-Filter */}
        <Text style={styles.filterLabel}>Stadt</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          <TouchableOpacity style={[styles.filterBtn, activeCity === 'all' && styles.filterBtnActive]} onPress={() => setActiveCity('all')}>
            <Text style={[styles.filterBtnText, activeCity === 'all' && styles.filterBtnTextActive]}>Alle Städte</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterBtn, activeCity === 'current' && styles.filterBtnActive, styles.locationBtn]}
            onPress={detectCurrentCity}
            disabled={locating}
          >
            {locating
              ? <ActivityIndicator color="#185FA5" size="small" />
              : <Text style={[styles.filterBtnText, activeCity === 'current' && styles.filterBtnTextActive]}>
                  📍 {activeCity === 'current' && currentCity ? currentCity : 'Mein Standort'}
                </Text>
            }
          </TouchableOpacity>
          {availableCities.map(city => (
            <TouchableOpacity key={city} style={[styles.filterBtn, activeCity === city && styles.filterBtnActive]} onPress={() => setActiveCity(city)}>
              <Text style={[styles.filterBtnText, activeCity === city && styles.filterBtnTextActive]}>{city}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {filteredSpots.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📍</Text>
            <Text style={styles.emptyTitle}>Keine Spots gefunden</Text>
            <Text style={styles.emptyText}>
              {activeCity === 'current' && currentCity ? `Noch keine Spots in ${currentCity}` : 'Füge Spots über die Karte hinzu.'}
            </Text>
          </View>
        ) : (
          Object.entries(grouped).sort().map(([continent, countries]) => (
            <View key={continent} style={styles.section}>
              <TouchableOpacity style={styles.continentHeader} onPress={() => toggleContinent(continent)}>
                <Text style={styles.continentTitle}>{continent}</Text>
                <Text style={styles.chevron}>{expandedContinents[continent] ? '▲' : '▼'}</Text>
              </TouchableOpacity>
              {expandedContinents[continent] && Object.entries(countries).sort().map(([country, cities]) => {
                const countryKey = `${continent}-${country}`;
                return (
                  <View key={country} style={styles.countrySection}>
                    <TouchableOpacity style={styles.countryHeader} onPress={() => toggleCountry(countryKey)}>
                      <Text style={styles.countryTitle}>{country}</Text>
                      <Text style={styles.chevronSm}>{expandedCountries[countryKey] ? '▲' : '▼'}</Text>
                    </TouchableOpacity>
                    {expandedCountries[countryKey] && Object.entries(cities).sort().map(([city, citySpots]) => {
                      const cityKey = `${countryKey}-${city}`;
                      return (
                        <View key={city} style={styles.citySection}>
                          <TouchableOpacity style={styles.cityHeader} onPress={() => toggleCity(cityKey)}>
                            <Text style={styles.cityTitle}>{city}</Text>
                            <Text style={styles.cityCount}>{citySpots.length} Spots</Text>
                            <Text style={styles.chevronSm}>{expandedCities[cityKey] ? '▲' : '▼'}</Text>
                          </TouchableOpacity>
                          {expandedCities[cityKey] && citySpots.map(spot => (
                            <View key={spot.id} style={styles.spotCard}>
                              <View style={styles.spotLeft}>
                                <View style={[styles.catBadge, { backgroundColor: CATEGORY_COLORS[spot.category] }]}>
                                  <Text style={[styles.catBadgeText, { color: CATEGORY_TEXT_COLORS[spot.category] }]}>{CATEGORY_LABELS[spot.category]}</Text>
                                </View>
                                <Text style={styles.spotName}>{spot.name}</Text>
                                {spot.currentTip && <Text style={styles.spotTip} numberOfLines={2}>{spot.currentTip.content}</Text>}
                                <Text style={styles.spotMeta}>von {spot.display_name}</Text>
                              </View>
                              <View style={styles.spotActions}>
                                <TouchableOpacity style={styles.editBtn} onPress={() => startEdit(spot)}>
                                  <Text style={styles.editBtnText}>✎</Text>
                                </TouchableOpacity>
                                {spot.user_id === userId && (
                                  <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(spot)}>
                                    <Text style={styles.deleteBtnText}>🗑</Text>
                                  </TouchableOpacity>
                                )}
                              </View>
                            </View>
                          ))}
                        </View>
                      );
                    })}
                  </View>
                );
              })}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#fff' },
  container: { flexGrow: 1, padding: 20, paddingTop: 60, paddingBottom: 40 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '500', color: '#1a1a1a', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#888', marginBottom: 16 },
  searchInput: { borderWidth: 0.5, borderColor: '#ccc', borderRadius: 10, padding: 12, fontSize: 15, backgroundColor: '#F9F9F9', marginBottom: 12 },
  filterLabel: { fontSize: 11, fontWeight: '500', color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  filterRow: { marginBottom: 14, maxHeight: 40 },
  filterBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: '#F1EFE8', marginRight: 6, borderWidth: 1.5, borderColor: 'transparent' },
  filterBtnActive: { backgroundColor: '#E6F1FB', borderColor: '#185FA5' },
  filterBtnText: { fontSize: 12, color: '#666', fontWeight: '500' },
  filterBtnTextActive: { color: '#185FA5' },
  locationBtn: { borderStyle: 'dashed', borderWidth: 1.5, borderColor: '#185FA5', backgroundColor: '#fff' },
  section: { marginBottom: 8 },
  continentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#185FA5', padding: 12, borderRadius: 10, marginBottom: 4 },
  continentTitle: { fontSize: 14, fontWeight: '500', color: '#fff' },
  chevron: { fontSize: 12, color: '#fff' },
  countrySection: { marginLeft: 12, marginBottom: 4 },
  countryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#E6F1FB', padding: 10, borderRadius: 8, marginBottom: 4 },
  countryTitle: { fontSize: 13, fontWeight: '500', color: '#0C447C' },
  chevronSm: { fontSize: 10, color: '#888' },
  citySection: { marginLeft: 12, marginBottom: 4 },
  cityHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F9F9FB', padding: 9, borderRadius: 8, marginBottom: 4, borderWidth: 0.5, borderColor: '#eee' },
  cityTitle: { fontSize: 13, color: '#1a1a1a', fontWeight: '500', flex: 1 },
  cityCount: { fontSize: 11, color: '#888', marginRight: 8 },
  spotCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 12, backgroundColor: '#fff', borderWidth: 0.5, borderColor: '#eee', borderRadius: 10, marginBottom: 6, marginLeft: 8 },
  spotLeft: { flex: 1, marginRight: 8 },
  catBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, marginBottom: 6 },
  catBadgeText: { fontSize: 11, fontWeight: '500' },
  spotName: { fontSize: 14, fontWeight: '500', color: '#1a1a1a', marginBottom: 4 },
  spotTip: { fontSize: 12, color: '#666', lineHeight: 18, marginBottom: 4 },
  spotMeta: { fontSize: 11, color: '#aaa' },
  spotActions: { gap: 6 },
  editBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#E6F1FB', alignItems: 'center', justifyContent: 'center' },
  editBtnText: { fontSize: 16, color: '#185FA5' },
  deleteBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#FCEBEB', alignItems: 'center', justifyContent: 'center' },
  deleteBtnText: { fontSize: 16 },
  emptyState: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 16, fontWeight: '500', color: '#1a1a1a', marginBottom: 8 },
  emptyText: { fontSize: 13, color: '#666', textAlign: 'center' },
  backBtn: { marginBottom: 16 },
  backBtnText: { fontSize: 15, color: '#185FA5', fontWeight: '500' },
  label: { fontSize: 12, fontWeight: '500', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  input: { borderWidth: 0.5, borderColor: '#ccc', borderRadius: 10, padding: 12, fontSize: 15, backgroundColor: '#F9F9F9', marginBottom: 16 },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  catBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F1EFE8', borderWidth: 1.5, borderColor: 'transparent' },
  catBtnActive: { backgroundColor: '#E6F1FB', borderColor: '#185FA5' },
  catBtnText: { fontSize: 12, color: '#666', fontWeight: '500' },
  catBtnTextActive: { color: '#185FA5' },
  geoBtn: { borderWidth: 1, borderColor: '#185FA5', borderRadius: 10, padding: 12, alignItems: 'center', marginBottom: 16 },
  geoBtnText: { fontSize: 13, color: '#185FA5', fontWeight: '500' },
  continentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  continentBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F1EFE8', borderWidth: 1.5, borderColor: 'transparent' },
  continentBtnActive: { backgroundColor: '#E6F1FB', borderColor: '#185FA5' },
  continentBtnText: { fontSize: 12, color: '#666', fontWeight: '500' },
  continentBtnTextActive: { color: '#185FA5' },
  saveBtn: { backgroundColor: '#185FA5', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  saveBtnDisabled: { backgroundColor: '#ccc' },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '500' },
});
