import { supabase } from './supabase';

export async function signInWithEmail(email: string) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  return { error };
}

export async function saveConsents(userId: string, displayName: string) {
  const { error } = await supabase.from('profiles').upsert({
    id: userId,
    display_name: displayName,
    consent_schedule: true,
    consent_visibility: true,
    consent_storage: true,
    consent_privacy_policy: true,
    consent_date: new Date().toISOString(),
  });
  return { error };
}

export async function saveInterests(userId: string, interestNames: string[]) {
  // Interessen-IDs aus der DB holen
  const { data: interests, error: fetchError } = await supabase
    .from('interests')
    .select('id, name')
    .in('name', interestNames);

  if (fetchError || !interests) return { error: fetchError };

  // Verknüpfungen speichern
  const rows = interests.map(i => ({ profile_id: userId, interest_id: i.id }));
  const { error } = await supabase.from('profile_interests').upsert(rows);
  return { error };
}

export async function suggestInterest(userId: string, name: string, category: string) {
  const { error } = await supabase.from('interests').insert({
    name,
    category,
    status: 'pending',
    suggested_by: userId,
  });
  return { error };
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function signInWithPassword(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return { error };
}