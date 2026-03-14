import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { getCurrentUser } from '../../lib/auth';
import { acceptBuddyRequest, declineBuddyRequest, getBuddyStatus, getMyBuddies, getPendingRequests, removeBuddy, searchUsers, sendBuddyRequest } from '../../lib/buddies';

type Tab = 'buddies' | 'search' | 'requests';

export default function BuddiesScreen() {
  const [activeTab, setActiveTab] = useState<Tab>('buddies');
  const [userId, setUserId] = useState<string | null>(null);
  const [buddies, setBuddies] = useState<any[]>([]);
  const [pending, setPending] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const user = await getCurrentUser();
    if (user) {
      setUserId(user.id);
      loadBuddies(user.id);
      loadPending(user.id);
    }
  };

  const loadBuddies = async (uid: string) => {
    const { data } = await getMyBuddies(uid);
    if (data) setBuddies(data);
  };

  const loadPending = async (uid: string) => {
    const { data } = await getPendingRequests(uid);
    if (data) setPending(data);
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.trim().length < 2) { setSearchResults([]); return; }
    setSearching(true);
    const { data } = await searchUsers(query, userId!);
    if (data) {
      // Buddy-Status für jeden User laden
      const withStatus = await Promise.all(data.map(async user => {
        const status = await getBuddyStatus(userId!, user.id);
        return { ...user, buddyStatus: status };
      }));
      setSearchResults(withStatus);
    }
    setSearching(false);
  };

  const handleSendRequest = async (receiverId: string, name: string) => {
    if (!userId) return;
    setLoading(true);
    const { error } = await sendBuddyRequest(userId, receiverId);
    setLoading(false);
    if (error) {
      Alert.alert('Fehler', error.message);
    } else {
      Alert.alert('Anfrage gesendet', `Buddy-Anfrage an ${name} wurde gesendet.`);
      handleSearch(searchQuery);
    }
  };

  const handleAccept = async (buddyId: string) => {
    await acceptBuddyRequest(buddyId);
    loadUser();
  };

  const handleDecline = async (buddyId: string) => {
    await declineBuddyRequest(buddyId);
    loadPending(userId!);
  };

  const handleRemove = async (buddyId: string, name: string) => {
    Alert.alert('Buddy entfernen', `Möchtest du ${name} wirklich aus deiner Buddyliste entfernen?`, [
      { text: 'Abbrechen' },
      { text: 'Entfernen', style: 'destructive', onPress: async () => {
        await removeBuddy(buddyId);
        loadBuddies(userId!);
      }},
    ]);
  };

  const getBuddyName = (buddy: any) => {
    if (!userId) return '';
    if (buddy.requester_id === userId) return buddy.receiver?.display_name;
    return buddy.requester?.display_name;
  };

  const getInitials = (name: string) => {
    if (!name) return '??';
    return name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const avatarColors = ['#E6F1FB', '#E1F5EE', '#FAECE7', '#EEEDFE', '#FAEEDA'];
  const textColors = ['#0C447C', '#085041', '#712B13', '#3C3489', '#633806'];
  const getColor = (name: string, i: number) => {
    const idx = (name?.charCodeAt(0) || i) % 5;
    return { bg: avatarColors[idx], text: textColors[idx] };
  };

  return (
    <View style={styles.wrapper}>
      {/* Tab switcher */}
      <View style={styles.tabRow}>
        <TouchableOpacity style={[styles.tab, activeTab === 'buddies' && styles.tabActive]} onPress={() => setActiveTab('buddies')}>
          <Text style={[styles.tabText, activeTab === 'buddies' && styles.tabTextActive]}>Meine Buddies {buddies.length > 0 && `(${buddies.length})`}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'search' && styles.tabActive]} onPress={() => setActiveTab('search')}>
          <Text style={[styles.tabText, activeTab === 'search' && styles.tabTextActive]}>Suchen</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'requests' && styles.tabActive]} onPress={() => setActiveTab('requests')}>
          <Text style={[styles.tabText, activeTab === 'requests' && styles.tabTextActive]}>Anfragen {pending.length > 0 && `(${pending.length})`}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.container}>

        {/* MEINE BUDDIES */}
        {activeTab === 'buddies' && (
          <>
            {buddies.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>👥</Text>
                <Text style={styles.emptyTitle}>Noch keine Buddies</Text>
                <Text style={styles.emptyText}>Suche nach Crew-Mitgliedern und füge sie als Buddy hinzu.</Text>
                <TouchableOpacity style={styles.button} onPress={() => setActiveTab('search')}>
                  <Text style={styles.buttonText}>Buddies suchen</Text>
                </TouchableOpacity>
              </View>
            ) : (
              buddies.map((buddy, i) => {
                const name = getBuddyName(buddy) || '';
                const colors = getColor(name, i);
                return (
                  <View key={buddy.id} style={styles.buddyCard}>
                    <View style={[styles.avatar, { backgroundColor: colors.bg }]}>
                      <Text style={[styles.avatarText, { color: colors.text }]}>{getInitials(name)}</Text>
                    </View>
                    <View style={styles.buddyInfo}>
                      <Text style={styles.buddyName}>{name}</Text>
                      <Text style={styles.buddySubtitle}>Buddy seit heute</Text>
                    </View>
                    <TouchableOpacity onPress={() => handleRemove(buddy.id, name)} style={styles.removeBtn}>
                      <Text style={styles.removeBtnText}>Entfernen</Text>
                    </TouchableOpacity>
                  </View>
                );
              })
            )}
          </>
        )}

        {/* SUCHEN */}
        {activeTab === 'search' && (
          <>
            <TextInput
              style={styles.searchInput}
              placeholder="Name suchen..."
              value={searchQuery}
              onChangeText={handleSearch}
              autoFocus
            />
            {searching && <ActivityIndicator style={{ marginTop: 20 }} color="#185FA5" />}
            {searchResults.map((user, i) => {
              const colors = getColor(user.display_name, i);
              const status = user.buddyStatus;
              return (
                <View key={user.id} style={styles.buddyCard}>
                  <View style={[styles.avatar, { backgroundColor: colors.bg }]}>
                    <Text style={[styles.avatarText, { color: colors.text }]}>{getInitials(user.display_name)}</Text>
                  </View>
                  <View style={styles.buddyInfo}>
                    <Text style={styles.buddyName}>{user.display_name}</Text>
                    <Text style={styles.buddySubtitle}>Crew-Mitglied</Text>
                  </View>
                  {!status && (
                    <TouchableOpacity style={styles.addBtn} onPress={() => handleSendRequest(user.id, user.display_name)} disabled={loading}>
                      <Text style={styles.addBtnText}>+ Buddy</Text>
                    </TouchableOpacity>
                  )}
                  {status?.status === 'pending' && status.requester_id === userId && (
                    <View style={styles.pendingBadge}><Text style={styles.pendingText}>Ausstehend</Text></View>
                  )}
                  {status?.status === 'pending' && status.requester_id !== userId && (
                    <View style={styles.pendingBadge}><Text style={styles.pendingText}>Anfrage erhalten</Text></View>
                  )}
                  {status?.status === 'accepted' && (
                    <View style={styles.acceptedBadge}><Text style={styles.acceptedText}>✓ Buddy</Text></View>
                  )}
                </View>
              );
            })}
            {searchQuery.length >= 2 && searchResults.length === 0 && !searching && (
              <Text style={styles.noResults}>Keine Crew-Mitglieder gefunden.</Text>
            )}
          </>
        )}

        {/* ANFRAGEN */}
        {activeTab === 'requests' && (
          <>
            {pending.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>📬</Text>
                <Text style={styles.emptyTitle}>Keine ausstehenden Anfragen</Text>
                <Text style={styles.emptyText}>Wenn jemand dich als Buddy hinzufügen möchte, erscheint es hier.</Text>
              </View>
            ) : (
              pending.map((req, i) => {
                const name = req.requester?.display_name || '';
                const colors = getColor(name, i);
                return (
                  <View key={req.id} style={styles.buddyCard}>
                    <View style={[styles.avatar, { backgroundColor: colors.bg }]}>
                      <Text style={[styles.avatarText, { color: colors.text }]}>{getInitials(name)}</Text>
                    </View>
                    <View style={styles.buddyInfo}>
                      <Text style={styles.buddyName}>{name}</Text>
                      <Text style={styles.buddySubtitle}>Möchte dein Buddy sein</Text>
                    </View>
                    <View style={styles.requestBtns}>
                      <TouchableOpacity style={styles.acceptBtn} onPress={() => handleAccept(req.id)}>
                        <Text style={styles.acceptBtnText}>✓</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.declineBtn} onPress={() => handleDecline(req.id)}>
                        <Text style={styles.declineBtnText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#fff', paddingTop: 60 },
  tabRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#eee' },
  tab: { flex: 1, padding: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#185FA5' },
  tabText: { fontSize: 13, fontWeight: '500', color: '#888' },
  tabTextActive: { color: '#185FA5' },
  container: { padding: 16, flexGrow: 1 },
  emptyState: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 16, fontWeight: '500', color: '#1a1a1a', marginBottom: 8 },
  emptyText: { fontSize: 13, color: '#666', textAlign: 'center', lineHeight: 20, marginBottom: 24, paddingHorizontal: 20 },
  button: { backgroundColor: '#185FA5', borderRadius: 12, padding: 14, paddingHorizontal: 24 },
  buttonText: { color: '#fff', fontSize: 14, fontWeight: '500' },
  buddyCard: { flexDirection: 'row', alignItems: 'center', padding: 12, borderWidth: 0.5, borderColor: '#eee', borderRadius: 12, marginBottom: 8 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarText: { fontSize: 15, fontWeight: '500' },
  buddyInfo: { flex: 1 },
  buddyName: { fontSize: 14, fontWeight: '500', color: '#1a1a1a' },
  buddySubtitle: { fontSize: 12, color: '#888', marginTop: 2 },
  removeBtn: { padding: 6, backgroundColor: '#FCEBEB', borderRadius: 8 },
  removeBtnText: { fontSize: 12, color: '#A32D2D', fontWeight: '500' },
  addBtn: { padding: 8, backgroundColor: '#E6F1FB', borderRadius: 8 },
  addBtnText: { fontSize: 12, color: '#185FA5', fontWeight: '500' },
  pendingBadge: { padding: 6, backgroundColor: '#FAEEDA', borderRadius: 8 },
  pendingText: { fontSize: 11, color: '#633806', fontWeight: '500' },
  acceptedBadge: { padding: 6, backgroundColor: '#E1F5EE', borderRadius: 8 },
  acceptedText: { fontSize: 11, color: '#085041', fontWeight: '500' },
  requestBtns: { flexDirection: 'row', gap: 8 },
  acceptBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#E1F5EE', alignItems: 'center', justifyContent: 'center' },
  acceptBtnText: { color: '#085041', fontWeight: '500' },
  declineBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FCEBEB', alignItems: 'center', justifyContent: 'center' },
  declineBtnText: { color: '#A32D2D', fontWeight: '500' },
  searchInput: { borderWidth: 0.5, borderColor: '#ccc', borderRadius: 10, padding: 12, fontSize: 15, backgroundColor: '#F9F9F9', marginBottom: 16 },
  noResults: { textAlign: 'center', color: '#888', marginTop: 20, fontSize: 14 },
});
