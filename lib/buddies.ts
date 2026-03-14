import { supabase } from './supabase';

export async function searchUsers(query: string, currentUserId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name')
    .ilike('display_name', `%${query}%`)
    .neq('id', currentUserId)
    .eq('is_visible', true)
    .limit(20);
  return { data, error };
}

export async function sendBuddyRequest(requesterId: string, receiverId: string) {
  const { error } = await supabase.from('buddies').insert({
    requester_id: requesterId,
    receiver_id: receiverId,
    status: 'pending',
  });
  return { error };
}

export async function acceptBuddyRequest(buddyId: string) {
  const { error } = await supabase
    .from('buddies')
    .update({ status: 'accepted' })
    .eq('id', buddyId);
  return { error };
}

export async function declineBuddyRequest(buddyId: string) {
  const { error } = await supabase
    .from('buddies')
    .update({ status: 'declined' })
    .eq('id', buddyId);
  return { error };
}

export async function removeBuddy(buddyId: string) {
  const { error } = await supabase
    .from('buddies')
    .delete()
    .eq('id', buddyId);
  return { error };
}

export async function getMyBuddies(userId: string) {
  const { data, error } = await supabase
    .from('buddies')
    .select(`
      id,
      status,
      requester_id,
      receiver_id,
      requester:profiles!buddies_requester_id_fkey(id, display_name),
      receiver:profiles!buddies_receiver_id_fkey(id, display_name)
    `)
    .or(`requester_id.eq.${userId},receiver_id.eq.${userId}`)
    .eq('status', 'accepted');
  return { data, error };
}

export async function getPendingRequests(userId: string) {
  const { data, error } = await supabase
    .from('buddies')
    .select(`
      id,
      status,
      requester_id,
      requester:profiles!buddies_requester_id_fkey(id, display_name)
    `)
    .eq('receiver_id', userId)
    .eq('status', 'pending');
  return { data, error };
}

export async function getBuddyStatus(userId: string, otherUserId: string) {
  const { data } = await supabase
    .from('buddies')
    .select('id, status, requester_id')
    .or(`and(requester_id.eq.${userId},receiver_id.eq.${otherUserId}),and(requester_id.eq.${otherUserId},receiver_id.eq.${userId})`)
    .single();
  return data;
}
