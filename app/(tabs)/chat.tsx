import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { getCurrentUser } from '../../lib/auth';
import { getMyBuddies } from '../../lib/buddies';
import { supabase } from '../../lib/supabase';

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  read: boolean;
  created_at: string;
}

interface Conversation {
  buddyId: string;
  buddyName: string;
  lastMessage: string;
  lastTime: string;
  unread: number;
}

export default function ChatScreen() {
  const [userId, setUserId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeChat, setActiveChat] = useState<{ id: string; name: string } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [showBuddyPicker, setShowBuddyPicker] = useState(false);
  const [allBuddies, setAllBuddies] = useState<any[]>([]);

  useEffect(() => { init(); }, []);

  const init = async () => {
    const user = await getCurrentUser();
    if (!user) { setLoading(false); return; }
    setUserId(user.id);
    await loadConversations(user.id);
    setLoading(false);
  };

  const loadConversations = async (uid: string) => {
    const { data: buddies } = await getMyBuddies(uid);
    if (!buddies) return;
    
    const convs: Conversation[] = [];
    for (const buddy of buddies) {
      const buddyId = buddy.requester_id === uid ? buddy.receiver_id : buddy.requester_id;
      const buddyName = buddy.requester_id === uid ? buddy.receiver?.display_name : buddy.requester?.display_name;

      const { data: msgs } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${uid},receiver_id.eq.${buddyId}),and(sender_id.eq.${buddyId},receiver_id.eq.${uid})`)
        .order('created_at', { ascending: false })
        .limit(1);

      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', uid)
        .eq('sender_id', buddyId)
        .eq('read', false);

      convs.push({
        buddyId,
        buddyName: buddyName || 'Unbekannt',
        lastMessage: msgs?.[0]?.content || 'Noch keine Nachrichten',
        lastTime: msgs?.[0]?.created_at || '',
        unread: count || 0,
      });
    }
    setConversations(convs);
    setAllBuddies(buddies);
  };

  const openChat = async (buddyId: string, buddyName: string) => {
    setActiveChat({ id: buddyId, name: buddyName });
    await loadMessages(buddyId);
    // Als gelesen markieren
    if (userId) {
      await supabase.from('messages')
        .update({ read: true })
        .eq('receiver_id', userId)
        .eq('sender_id', buddyId);
    }
  };

  const loadMessages = async (buddyId: string) => {
    if (!userId) return;
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${userId},receiver_id.eq.${buddyId}),and(sender_id.eq.${buddyId},receiver_id.eq.${userId})`)
      .order('created_at', { ascending: true });
    if (data) setMessages(data);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !userId || !activeChat) return;
    setSending(true);
    await supabase.from('messages').insert({
      sender_id: userId,
      receiver_id: activeChat.id,
      content: newMessage.trim(),
    });
    setNewMessage('');
    await loadMessages(activeChat.id);
    setSending(false);
  };

  const formatTime = (iso: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return d.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('de-CH', { day: 'numeric', month: 'short' });
  };

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const avatarColors = ['#E6F1FB', '#E1F5EE', '#FAECE7', '#EEEDFE', '#FAEEDA'];
  const textColors = ['#0C447C', '#085041', '#712B13', '#3C3489', '#633806'];
  const getColor = (name: string) => {
    const idx = (name?.charCodeAt(0) || 0) % 5;
    return { bg: avatarColors[idx], text: textColors[idx] };
  };

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#185FA5" /></View>;

  // Einzel-Chat
  if (activeChat) {
    const colors = getColor(activeChat.name);
    return (
      <View style={styles.chatWrapper}>
        <View style={styles.chatHeader}>
          <TouchableOpacity onPress={() => { setActiveChat(null); init(); }}>
            <Text style={styles.backBtn}>← Zurück</Text>
          </TouchableOpacity>
          <View style={[styles.avatar, { backgroundColor: colors.bg }]}>
            <Text style={[styles.avatarText, { color: colors.text }]}>{getInitials(activeChat.name)}</Text>
          </View>
          <Text style={styles.chatHeaderName}>{activeChat.name}</Text>
        </View>

        <FlatList
          data={messages}
          keyExtractor={m => m.id}
          contentContainerStyle={styles.messagesList}
          renderItem={({ item }) => {
            const isMe = item.sender_id === userId;
            return (
              <View style={[styles.messageRow, isMe && styles.messageRowMe]}>
                <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
                  <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>{item.content}</Text>
                </View>
                <Text style={[styles.messageTime, isMe && styles.messageTimeMe]}>{formatTime(item.created_at)}</Text>
              </View>
            );
          }}
        />

        <View style={styles.inputRow}>
          <TextInput
            style={styles.messageInput}
            placeholder="Nachricht..."
            value={newMessage}
            onChangeText={setNewMessage}
            onSubmitEditing={sendMessage}
            returnKeyType="send"
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!newMessage.trim() || sending) && styles.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={!newMessage.trim() || sending}
          >
            {sending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.sendBtnText}>↑</Text>}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Chat-Liste
    return (
    <View style={styles.wrapper}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Chats</Text>
          <TouchableOpacity style={styles.newChatBtn} onPress={() => setShowBuddyPicker(true)}>
            <Text style={styles.newChatBtnText}>+ Neu</Text>
          </TouchableOpacity>
        </View>
        {showBuddyPicker && (
  <View style={styles.buddyPicker}>
    <View style={styles.buddyPickerHeader}>
      <Text style={styles.buddyPickerTitle}>Buddy auswählen</Text>
      <TouchableOpacity onPress={() => setShowBuddyPicker(false)}>
        <Text style={styles.buddyPickerClose}>✕</Text>
      </TouchableOpacity>
    </View>
    {allBuddies.map(buddy => {
      const buddyId = buddy.requester_id === userId ? buddy.receiver_id : buddy.requester_id;
      const buddyName = buddy.requester_id === userId ? buddy.receiver?.display_name : buddy.requester?.display_name;
      const colors = getColor(buddyName || '');
      return (
        <TouchableOpacity key={buddy.id} style={styles.convCard} onPress={() => { setShowBuddyPicker(false); openChat(buddyId, buddyName || ''); }}>
          <View style={[styles.avatar, { backgroundColor: colors.bg }]}>
            <Text style={[styles.avatarText, { color: colors.text }]}>{getInitials(buddyName || '')}</Text>
          </View>
          <Text style={styles.convName}>{buddyName}</Text>
        </TouchableOpacity>
      );
    })}
  </View>
)}
        {conversations.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>💬</Text>
            <Text style={styles.emptyTitle}>Noch keine Chats</Text>
            <Text style={styles.emptyText}>Füge Buddies hinzu um mit ihnen zu chatten.</Text>
          </View>
        ) : (
          conversations.map(conv => {
            const colors = getColor(conv.buddyName);
            return (
              <TouchableOpacity key={conv.buddyId} style={styles.convCard} onPress={() => openChat(conv.buddyId, conv.buddyName)}>
                <View style={[styles.avatar, { backgroundColor: colors.bg }]}>
                  <Text style={[styles.avatarText, { color: colors.text }]}>{getInitials(conv.buddyName)}</Text>
                </View>
                <View style={styles.convInfo}>
                  <View style={styles.convTop}>
                    <Text style={styles.convName}>{conv.buddyName}</Text>
                    <Text style={styles.convTime}>{formatTime(conv.lastTime)}</Text>
                  </View>
                  <View style={styles.convBottom}>
                    <Text style={styles.convLast} numberOfLines={1}>{conv.lastMessage}</Text>
                    {conv.unread > 0 && (
                      <View style={styles.unreadBadge}>
                        <Text style={styles.unreadText}>{conv.unread}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#fff' },
  container: { flexGrow: 1, padding: 20, paddingTop: 60, paddingBottom: 40 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '500', color: '#1a1a1a', marginBottom: 20 },
  convCard: { flexDirection: 'row', alignItems: 'center', padding: 12, borderWidth: 0.5, borderColor: '#eee', borderRadius: 12, marginBottom: 8 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginRight: 12, flexShrink: 0 },
  avatarText: { fontSize: 15, fontWeight: '500' },
  convInfo: { flex: 1 },
  convTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  convName: { fontSize: 14, fontWeight: '500', color: '#1a1a1a' },
  convTime: { fontSize: 11, color: '#aaa' },
  convBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  convLast: { fontSize: 13, color: '#888', flex: 1 },
  unreadBadge: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#185FA5', alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  unreadText: { fontSize: 11, color: '#fff', fontWeight: '500' },
  emptyState: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 16, fontWeight: '500', color: '#1a1a1a', marginBottom: 8 },
  emptyText: { fontSize: 13, color: '#666', textAlign: 'center' },
  // Chat
  chatWrapper: { flex: 1, backgroundColor: '#fff' },
  chatHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, paddingTop: 60, borderBottomWidth: 0.5, borderBottomColor: '#eee' },
  backBtn: { fontSize: 15, color: '#185FA5', fontWeight: '500', marginRight: 4 },
  chatHeaderName: { fontSize: 16, fontWeight: '500', color: '#1a1a1a' },
  messagesList: { padding: 16, paddingBottom: 8 },
  messageRow: { marginBottom: 12 },
  messageRowMe: { alignItems: 'flex-end' },
  bubble: { maxWidth: '75%', padding: 10, borderRadius: 16, borderBottomLeftRadius: 4 },
  bubbleMe: { backgroundColor: '#185FA5', borderBottomLeftRadius: 16, borderBottomRightRadius: 4 },
  bubbleThem: { backgroundColor: '#F1EFE8' },
  bubbleText: { fontSize: 14, color: '#1a1a1a', lineHeight: 20 },
  bubbleTextMe: { color: '#fff' },
  messageTime: { fontSize: 10, color: '#aaa', marginTop: 3 },
  messageTimeMe: { textAlign: 'right' },
  inputRow: { flexDirection: 'row', gap: 8, padding: 12, borderTopWidth: 0.5, borderTopColor: '#eee' },
  messageInput: { flex: 1, borderWidth: 0.5, borderColor: '#ccc', borderRadius: 20, padding: 10, paddingHorizontal: 14, fontSize: 14, backgroundColor: '#F9F9F9' },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#185FA5', alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: '#ccc' },
  sendBtnText: { color: '#fff', fontSize: 18, fontWeight: '500' },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  newChatBtn: { backgroundColor: '#185FA5', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  newChatBtnText: { color: '#fff', fontSize: 13, fontWeight: '500' },
  buddyPicker: { backgroundColor: '#F9F9F9', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 0.5, borderColor: '#eee' },
  buddyPickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  buddyPickerTitle: { fontSize: 15, fontWeight: '500', color: '#1a1a1a' },
  buddyPickerClose: { fontSize: 18, color: '#888' },
});
