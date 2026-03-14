import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import MapView, { Callout, LongPressEvent, Marker, Region } from 'react-native-maps';
import { getCurrentUser } from '../../lib/auth';
import { addSpot, addTip, CrewSpot, getSpots, searchSpots, SpotCategory, SpotTip } from '../../lib/spots';
import { supabase } from '../../lib/supabase';

const CATEGORIES: { key: SpotCategory; label: string }[] = [
  { key: 'restaurant', label: 'Restaurant' },
  { key: 'bar', label: 'Bar' },
  { key: 'sehenswürdigkeit', label: 'Sehensw.' },
  { key: 'hotel', label: 'Hotel' },
  { key: 'sonstiges', label: 'Sonstiges' },
];

const CATEGORY_COLOR: Record<SpotCategory, string> = {
  restaurant: '#e74c3c',
  bar: '#9b59b6',
  sehenswürdigkeit: '#3498db',
  hotel: '#27ae60',
  sonstiges: '#185FA5',
};

const CATEGORY_LABEL: Record<SpotCategory, string> = {
  restaurant: 'Restaurant',
  bar: 'Bar',
  sehenswürdigkeit: 'Sehenswürdigkeit',
  hotel: 'Hotel',
  sonstiges: 'Sonstiges',
};

type Coord = { latitude: number; longitude: number };

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-CH', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function MapScreen() {
  const mapRef = useRef<MapView>(null);
  const [allSpots, setAllSpots] = useState<CrewSpot[]>([]);
  const [userLocation, setUserLocation] = useState<Coord | null>(null);
  const [pendingCoord, setPendingCoord] = useState<Coord | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileName, setProfileName] = useState('');
  const [userId, setUserId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Add spot modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<SpotCategory>('restaurant');
  const [newTip, setNewTip] = useState('');
  const [saving, setSaving] = useState(false);

  // Detail modal
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedSpot, setSelectedSpot] = useState<CrewSpot | null>(null);
  const [editingTip, setEditingTip] = useState(false);
  const [editTipContent, setEditTipContent] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  const filteredSpots = searchQuery ? searchSpots(allSpots, searchQuery) : allSpots;

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUserId(session.user.id);
        const { data: profile } = await supabase
          .from('profiles').select('display_name').eq('id', session.user.id).single();
        if (profile?.display_name) setProfileName(profile.display_name);
      }
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      }
      setAllSpots(await getSpots());
      setLoading(false);
    };
    init();
  }, []);

  const reloadSpots = async () => setAllSpots(await getSpots());

  const relocate = () => {
    if (userLocation && mapRef.current) {
      mapRef.current.animateToRegion({ ...userLocation, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 500);
    }
  };

  const openAddModal = (coord: Coord) => {
    setPendingCoord(coord);
    setNewName(''); setNewCategory('restaurant'); setNewTip('');
    setShowAddModal(true);
  };

  const closeAddModal = () => {
    setShowAddModal(false); setPendingCoord(null);
  };

  const handleSaveSpot = async () => {
    if (!newName.trim()) return;
    const coord = pendingCoord ?? userLocation;
    if (!coord) return;
    setSaving(true);
    const user = await getCurrentUser();
    if (!user) { setSaving(false); return; }
    const { error } = await addSpot({
      user_id: user.id,
      display_name: profileName || 'Unbekannt',
      name: newName.trim(),
      category: newCategory,
      latitude: coord.latitude,
      longitude: coord.longitude,
      city: null,
    }, newTip);
    setSaving(false);
    if (!error) { await reloadSpots(); closeAddModal(); }
  };

  const openDetailModal = (spot: CrewSpot) => {
    setSelectedSpot(spot);
    setEditingTip(false);
    setEditTipContent('');
    setShowHistory(false);
    setShowDetailModal(true);
  };

  const handleSaveTip = async () => {
    if (!editTipContent.trim() || !selectedSpot) return;
    setSaving(true);
    const user = await getCurrentUser();
    if (!user) { setSaving(false); return; }
    const nextVersion = (selectedSpot.currentTip?.version ?? 0) + 1;
    const { error } = await addTip(selectedSpot.id, user.id, profileName || 'Unbekannt', editTipContent, nextVersion);
    setSaving(false);
    if (!error) {
      await reloadSpots();
      const updated = (await getSpots()).find(s => s.id === selectedSpot.id) ?? null;
      setSelectedSpot(updated);
      setEditingTip(false);
      setEditTipContent('');
    }
  };

  const initialRegion: Region = userLocation
    ? { ...userLocation, latitudeDelta: 0.05, longitudeDelta: 0.05 }
    : { latitude: 47.3769, longitude: 8.5417, latitudeDelta: 0.1, longitudeDelta: 0.1 };

  if (loading) {
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#185FA5" /></View>;
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={initialRegion}
        showsUserLocation
        showsMyLocationButton={false}
        onLongPress={(e: LongPressEvent) => openAddModal(e.nativeEvent.coordinate)}
      >
        {filteredSpots.map(spot => (
          <Marker
            key={spot.id}
            coordinate={{ latitude: spot.latitude, longitude: spot.longitude }}
            pinColor={CATEGORY_COLOR[spot.category]}
            onCalloutPress={() => openDetailModal(spot)}
          >
            <Callout>
              <View style={styles.callout}>
                <Text style={styles.calloutName}>{spot.name}</Text>
                {spot.currentTip ? (
                  <Text style={styles.calloutTip} numberOfLines={2}>{spot.currentTip.content}</Text>
                ) : (
                  <Text style={styles.calloutNoTip}>Noch kein Tipp</Text>
                )}
                <Text style={styles.calloutAction}>Details tippen</Text>
              </View>
            </Callout>
          </Marker>
        ))}

        {pendingCoord && (
          <Marker coordinate={pendingCoord} anchor={{ x: 0.5, y: 1 }} tracksViewChanges={false}>
            <View style={styles.pendingMarker}>
              <Text style={styles.pendingMarkerText}>+</Text>
            </View>
          </Marker>
        )}
      </MapView>

      {/* Search bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Spot oder Tipp suchen..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          clearButtonMode="while-editing"
        />
        {searchQuery !== '' && (
          <Text style={styles.searchCount}>
            {filteredSpots.length} Treffer
          </Text>
        )}
      </View>

      <View style={styles.mapHint}>
        <Text style={styles.mapHintText}>Lang drücken um Spot zu markieren</Text>
      </View>

      <TouchableOpacity style={styles.relocateBtn} onPress={relocate}>
        <Text style={styles.relocateBtnText}>◎</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.addBtn} onPress={() => openAddModal(userLocation ?? { latitude: 0, longitude: 0 })}>
        <Text style={styles.addBtnText}>+</Text>
      </TouchableOpacity>

      {/* ── ADD SPOT MODAL ── */}
      <Modal visible={showAddModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Spot hinzufügen</Text>
            <TouchableOpacity onPress={closeAddModal}><Text style={styles.modalClose}>✕</Text></TouchableOpacity>
          </View>

          <Text style={styles.modalLabel}>Name</Text>
          <TextInput style={styles.modalInput} placeholder="z.B. Mo's Grill" value={newName} onChangeText={setNewName} maxLength={60} autoFocus />

          <Text style={styles.modalLabel}>Kategorie</Text>
          <View style={styles.categoryRow}>
            {CATEGORIES.map(cat => (
              <TouchableOpacity key={cat.key}
                style={[styles.categoryBtn, newCategory === cat.key && styles.categoryBtnActive]}
                onPress={() => setNewCategory(cat.key)}>
                <Text style={[styles.catBtnLabel, newCategory === cat.key && styles.catBtnLabelActive]}>{cat.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.modalLabel}>Erster Tipp (optional)</Text>
          <TextInput style={[styles.modalInput, styles.modalInputMultiline]}
            placeholder="z.B. Beste Clam Chowder in ganz SF!"
            value={newTip} onChangeText={setNewTip} multiline maxLength={200} />

          <Text style={styles.locationHint}>
            {pendingCoord ? 'Markierter Kartenort wird gespeichert' : 'Dein aktueller Standort wird gespeichert'}
          </Text>
          <TouchableOpacity style={[styles.saveBtn, (saving || !newName.trim()) && styles.saveBtnDisabled]}
            onPress={handleSaveSpot} disabled={saving || !newName.trim()}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Spot speichern</Text>}
          </TouchableOpacity>
        </View>
      </Modal>

      {/* ── SPOT DETAIL MODAL ── */}
      <Modal visible={showDetailModal} animationType="slide" presentationStyle="pageSheet">
        <ScrollView style={styles.modal} contentContainerStyle={{ paddingBottom: 40 }}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>{selectedSpot?.name}</Text>
              <View style={[styles.categoryBadge, { backgroundColor: CATEGORY_COLOR[selectedSpot?.category ?? 'sonstiges'] + '22' }]}>
                <Text style={[styles.categoryBadgeText, { color: CATEGORY_COLOR[selectedSpot?.category ?? 'sonstiges'] }]}>
                  {CATEGORY_LABEL[selectedSpot?.category ?? 'sonstiges']}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => { setShowDetailModal(false); setEditingTip(false); }}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Current tip */}
          <Text style={styles.sectionLabel}>
            {selectedSpot?.currentTip ? `Aktueller Tipp (v${selectedSpot.currentTip.version})` : 'Tipp'}
          </Text>
          {selectedSpot?.currentTip ? (
            <View style={styles.tipCard}>
              <Text style={styles.tipContent}>{selectedSpot.currentTip.content}</Text>
              <Text style={styles.tipMeta}>— {selectedSpot.currentTip.display_name} · {formatDate(selectedSpot.currentTip.created_at)}</Text>
            </View>
          ) : (
            <Text style={styles.noTip}>Noch kein Tipp. Sei die Erste!</Text>
          )}

          {/* Edit tip */}
          {!editingTip ? (
            <TouchableOpacity style={styles.editTipBtn} onPress={() => {
              setEditingTip(true);
              setEditTipContent(selectedSpot?.currentTip?.content ?? '');
            }}>
              <Text style={styles.editTipBtnText}>
                {selectedSpot?.currentTip ? 'Tipp bearbeiten' : 'Ersten Tipp hinzufügen'}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.editTipForm}>
              <Text style={styles.modalLabel}>Neuer Tipp</Text>
              <TextInput
                style={[styles.modalInput, styles.modalInputMultiline]}
                placeholder="Was gibt es Neues zu sagen?"
                value={editTipContent}
                onChangeText={setEditTipContent}
                multiline
                maxLength={200}
                autoFocus
              />
              <View style={styles.editTipActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditingTip(false)}>
                  <Text style={styles.cancelBtnText}>Abbrechen</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, { flex: 1 }, (saving || !editTipContent.trim()) && styles.saveBtnDisabled]}
                  onPress={handleSaveTip}
                  disabled={saving || !editTipContent.trim()}>
                  {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Speichern</Text>}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Version history */}
          {(selectedSpot?.tipHistory?.length ?? 0) > 1 && (
            <View style={{ marginTop: 24 }}>
              <TouchableOpacity style={styles.historyToggle} onPress={() => setShowHistory(v => !v)}>
                <Text style={styles.sectionLabel}>
                  Verlauf ({(selectedSpot?.tipHistory?.length ?? 1) - 1} {(selectedSpot?.tipHistory?.length ?? 1) - 1 === 1 ? 'ältere Version' : 'ältere Versionen'})
                </Text>
                <Text style={styles.historyChevron}>{showHistory ? '▲' : '▼'}</Text>
              </TouchableOpacity>

              {showHistory && selectedSpot?.tipHistory?.slice(1).map((tip: SpotTip) => (
                <View key={tip.id} style={styles.historyCard}>
                  <View style={styles.historyHeader}>
                    <Text style={styles.historyVersion}>v{tip.version}</Text>
                    <Text style={styles.historyMeta}>{tip.display_name} · {formatDate(tip.created_at)}</Text>
                  </View>
                  <Text style={styles.historyContent}>{tip.content}</Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  map: { flex: 1 },
  searchContainer: {
    position: 'absolute', top: 54, left: 12, right: 12,
    backgroundColor: '#fff', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10,
    shadowColor: '#000', shadowOpacity: 0.12, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 4,
  },
  searchInput: { fontSize: 15, color: '#1a1a1a' },
  searchCount: { fontSize: 11, color: '#888', marginTop: 4 },
  pendingMarker: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#185FA5', alignItems: 'center', justifyContent: 'center' },
  pendingMarkerText: { color: '#fff', fontSize: 18, fontWeight: '600', lineHeight: 22 },
  callout: { padding: 8, minWidth: 160, maxWidth: 220 },
  calloutName: { fontSize: 14, fontWeight: '600', color: '#1a1a1a', marginBottom: 2 },
  calloutTip: { fontSize: 12, color: '#444', marginBottom: 4 },
  calloutNoTip: { fontSize: 12, color: '#aaa', fontStyle: 'italic', marginBottom: 4 },
  calloutAction: { fontSize: 11, color: '#185FA5' },
  mapHint: { position: 'absolute', bottom: 104, left: 0, right: 0, alignItems: 'center', pointerEvents: 'none' },
  mapHintText: { fontSize: 12, color: '#fff', backgroundColor: 'rgba(0,0,0,0.35)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, overflow: 'hidden' },
  relocateBtn: { position: 'absolute', right: 16, bottom: 96, backgroundColor: '#fff', width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.15, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4, elevation: 4 },
  relocateBtnText: { fontSize: 20, color: '#185FA5' },
  addBtn: { position: 'absolute', right: 16, bottom: 28, backgroundColor: '#185FA5', width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4, elevation: 5 },
  addBtnText: { fontSize: 30, color: '#fff', lineHeight: 34 },
  modal: { flex: 1, backgroundColor: '#fff', padding: 24, paddingTop: 32 },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '600', color: '#1a1a1a', marginBottom: 6, flex: 1 },
  modalClose: { fontSize: 18, color: '#888', padding: 4 },
  modalLabel: { fontSize: 12, fontWeight: '500', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  modalInput: { borderWidth: 0.5, borderColor: '#ccc', borderRadius: 10, padding: 12, fontSize: 15, backgroundColor: '#F9F9F9', marginBottom: 20 },
  modalInputMultiline: { height: 90, textAlignVertical: 'top' },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  categoryBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F1EFE8', borderWidth: 1.5, borderColor: 'transparent' },
  categoryBtnActive: { backgroundColor: '#E6F1FB', borderColor: '#185FA5' },
  catBtnLabel: { fontSize: 12, color: '#666', fontWeight: '500' },
  catBtnLabelActive: { color: '#185FA5' },
  categoryBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  categoryBadgeText: { fontSize: 12, fontWeight: '500' },
  locationHint: { fontSize: 12, color: '#888', marginBottom: 20 },
  saveBtn: { backgroundColor: '#185FA5', borderRadius: 12, padding: 16, alignItems: 'center' },
  saveBtnDisabled: { backgroundColor: '#ccc' },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '500' },
  sectionLabel: { fontSize: 12, fontWeight: '500', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  tipCard: { backgroundColor: '#F9F9FB', borderRadius: 12, padding: 14, marginBottom: 16 },
  tipContent: { fontSize: 15, color: '#1a1a1a', lineHeight: 22, marginBottom: 8 },
  tipMeta: { fontSize: 12, color: '#999' },
  noTip: { fontSize: 14, color: '#aaa', fontStyle: 'italic', marginBottom: 16 },
  editTipBtn: { borderWidth: 1, borderColor: '#185FA5', borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 16 },
  editTipBtnText: { color: '#185FA5', fontSize: 14, fontWeight: '500' },
  editTipForm: { marginBottom: 16 },
  editTipActions: { flexDirection: 'row', gap: 10 },
  cancelBtn: { paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: '#ddd', alignItems: 'center', justifyContent: 'center' },
  cancelBtnText: { color: '#888', fontSize: 14 },
  historyToggle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  historyChevron: { fontSize: 12, color: '#888' },
  historyCard: { backgroundColor: '#F5F5F5', borderRadius: 10, padding: 12, marginBottom: 8 },
  historyHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  historyVersion: { fontSize: 11, fontWeight: '600', color: '#fff', backgroundColor: '#aaa', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  historyMeta: { fontSize: 11, color: '#999' },
  historyContent: { fontSize: 13, color: '#555', lineHeight: 20 },
});
