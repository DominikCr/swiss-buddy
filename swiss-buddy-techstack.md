# Swiss Buddy – Technische Architektur & Setup-Guide

## Überblick

Swiss Buddy ist eine mobile App für iOS & Android, die Crew-Mitglieder auf gemeinsamen Flügen anhand ihrer Interessen matched. Dieses Dokument beschreibt den vollständigen Tech-Stack, die Datenbankstruktur, den Datenschutz-Mechanismus und die Schritt-für-Schritt Einrichtung.

---

## Tech-Stack

| Bereich | Technologie | Begründung |
|---|---|---|
| Mobile App | **Expo (React Native)** | Eine Codebase für iOS & Android, einfaches Setup für Anfänger |
| Backend & Datenbank | **Supabase** | Open-Source Firebase-Alternative, kostenloser Tier, PostgreSQL, eingebaute Auth |
| Authentifizierung | **Supabase Auth** (Email/Magic Link) | Swiss-Email-basierter Login ohne Passwort |
| Realtime Chat | **Supabase Realtime** | WebSocket-basiert, direkt integriert |
| Push Notifications | **Expo Notifications** | Cross-platform, einfache Integration |
| Flugplan-Import | **.ical Parser** (ical.js) | Parst den Swiss Schedule Feed lokal auf dem Gerät |
| Sprache | **TypeScript** | Typsicherheit, bessere Entwicklererfahrung |

---

## Architektur-Übersicht

```
📱 Expo App (iOS & Android)
│
├── Auth-Modul (Supabase Auth)
├── Profil & Interessen
├── .ical Parser (lokal auf Gerät)
├── Matching-Engine (Supabase Edge Function)
├── Chat (Supabase Realtime)
└── Push Notifications (Expo)
         │
         ▼
🔧 Supabase Backend
├── PostgreSQL Datenbank
├── Row-Level Security (RLS) – Datenschutz
├── Edge Functions (Matching-Logik)
├── Realtime Subscriptions (Chat)
└── Storage (optional: Profilbilder)
         │
         ▼
📅 Swiss Schedule Feed
└── .ical Datei – wird lokal geparst, nur Flug-Metadaten werden hochgeladen
```

---

## Datenbankstruktur (PostgreSQL / Supabase)

### Tabelle: `profiles`
```sql
create table profiles (
  id uuid references auth.users primary key,
  display_name text not null,
  employee_role text,          -- z.B. "Cabin Crew", "Pilot", "Purser"
  base_airport text,           -- z.B. "ZRH"
  years_at_swiss int,
  avatar_url text,
  is_visible boolean default true,   -- Opt-in/Opt-out
  consent_schedule boolean default false,
  consent_visibility boolean default false,
  consent_storage boolean default false,
  consent_privacy_policy boolean default false,
  consent_date timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### Tabelle: `interests`
```sql
create table interests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,      -- z.B. "Sport & Outdoor", "Wellness & Kultur"
  status text default 'active', -- 'active', 'inactive', 'pending', 'rejected'
  suggested_by uuid references profiles(id),
  approved_by uuid references profiles(id),
  created_at timestamptz default now()
);
```

### Tabelle: `profile_interests` (Many-to-Many)
```sql
create table profile_interests (
  profile_id uuid references profiles(id) on delete cascade,
  interest_id uuid references interests(id) on delete cascade,
  primary key (profile_id, interest_id)
);
```

### Tabelle: `schedule_entries`
```sql
create table schedule_entries (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete cascade,
  flight_number text,          -- z.B. "LX182"
  departure_airport text,      -- z.B. "ZRH"
  arrival_airport text,        -- z.B. "BKK"
  departure_date date,
  layover_hours int,
  created_at timestamptz default now()
  -- KEIN exakter Zeitstempel gespeichert – nur Datum & Destination (Datenschutz)
);
```

### Tabelle: `matches`
```sql
create table matches (
  id uuid primary key default gen_random_uuid(),
  profile_a uuid references profiles(id) on delete cascade,
  profile_b uuid references profiles(id) on delete cascade,
  flight_number text,
  destination text,
  shared_interests text[],     -- Array der gemeinsamen Interessen
  notified boolean default false,
  created_at timestamptz default now()
);
```

### Tabelle: `messages`
```sql
create table messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references profiles(id) on delete cascade,
  receiver_id uuid references profiles(id) on delete cascade,
  content text not null,
  read boolean default false,
  created_at timestamptz default now()
);
```

---

## Datenschutz-Implementierung

### Row-Level Security (RLS)

Supabase RLS stellt sicher, dass Nutzer **nur ihre eigenen Daten** lesen/schreiben können:

```sql
-- Profile: Nutzer sieht nur eigenes Profil (voll) + andere nur wenn sichtbar
alter table profiles enable row level security;

create policy "Own profile full access"
  on profiles for all using (auth.uid() = id);

create policy "Others see visible profiles only"
  on profiles for select using (is_visible = true);

-- Schedule: Nur eigene Daten
alter table schedule_entries enable row level security;

create policy "Own schedule only"
  on schedule_entries for all using (auth.uid() = profile_id);

-- Messages: Sender oder Empfänger
alter table messages enable row level security;

create policy "Own messages"
  on messages for all
  using (auth.uid() = sender_id or auth.uid() = receiver_id);
```

### Recht auf Vergessenwerden (DSGVO Art. 17)

```sql
-- Funktion zum vollständigen Löschen aller Nutzerdaten
create or replace function delete_user_data(user_id uuid)
returns void as $$
begin
  delete from messages where sender_id = user_id or receiver_id = user_id;
  delete from matches where profile_a = user_id or profile_b = user_id;
  delete from schedule_entries where profile_id = user_id;
  delete from profile_interests where profile_id = user_id;
  delete from profiles where id = user_id;
  -- Auth-User wird separat über Supabase Admin API gelöscht
end;
$$ language plpgsql security definer;
```

### Flugplan – was wird gespeichert vs. was bleibt lokal

| Datenpunkt | Lokal (Gerät) | Server |
|---|---|---|
| Genaue Abflugzeit | ✅ (nur im Speicher) | ❌ |
| Flugnummer | ❌ | ✅ |
| Datum (nur Tag) | ❌ | ✅ |
| Destination | ❌ | ✅ |
| Crew-Zusammensetzung | ❌ | ❌ (wird nur verglichen) |

---

## Projektstruktur (Expo App)

```
swiss-buddy/
├── app/
│   ├── (auth)/
│   │   ├── welcome.tsx          # Datenschutz-Intro Screen
│   │   ├── consent.tsx          # Einwilligungs-Screen
│   │   └── interests.tsx        # Interessen wählen
│   ├── (tabs)/
│   │   ├── flights.tsx          # Flüge & Matches
│   │   ├── matches.tsx          # Alle Matches
│   │   ├── chat.tsx             # Chat-Liste
│   │   └── profile.tsx          # Profil & Datenschutz
│   └── chat/[id].tsx            # Einzel-Chat
├── components/
│   ├── FlightCard.tsx
│   ├── BuddyCard.tsx
│   ├── InterestTag.tsx
│   └── ConsentToggle.tsx
├── lib/
│   ├── supabase.ts              # Supabase Client
│   ├── icalParser.ts            # .ical Feed Parser
│   ├── matching.ts              # Matching-Logik
│   └── notifications.ts         # Push Notifications
├── hooks/
│   ├── useAuth.ts
│   ├── useMatches.ts
│   └── useChat.ts
└── constants/
    └── interests.ts             # Standard-Interessen Liste
```

---

## Setup-Anleitung (Schritt für Schritt)

### Voraussetzungen
- Node.js 18+ installiert
- Ein Smartphone (iOS oder Android) für Tests
- Kostenloses Konto auf supabase.com

### Schritt 1: Expo Projekt erstellen

```bash
# Expo CLI installieren
npm install -g expo-cli

# Neues Projekt erstellen
npx create-expo-app swiss-buddy --template blank-typescript
cd swiss-buddy

# Abhängigkeiten installieren
npm install @supabase/supabase-js
npm install expo-notifications expo-device
npm install ical.js
npm install @react-navigation/native @react-navigation/bottom-tabs
npm install expo-router
```

### Schritt 2: Supabase einrichten

1. Gehe zu [supabase.com](https://supabase.com) → "New Project"
2. Projekt Name: `swiss-buddy`
3. Datenbank-Passwort sicher aufbewahren
4. Region: `eu-central-1` (Frankfurt, wichtig für DSGVO)
5. SQL-Editor öffnen → oben stehende Tabellen anlegen

### Schritt 3: Supabase in App einbinden

```typescript
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = 'DEINE_SUPABASE_URL';
const supabaseAnonKey = 'DEIN_SUPABASE_ANON_KEY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

### Schritt 4: .ical Parser

```typescript
// lib/icalParser.ts
import ICAL from 'ical.js';

export interface FlightEntry {
  flightNumber: string;
  departureAirport: string;
  arrivalAirport: string;
  departureDate: string; // nur "YYYY-MM-DD" – keine genaue Zeit
}

export function parseScheduleFeed(icalString: string): FlightEntry[] {
  const jcal = ICAL.parse(icalString);
  const comp = new ICAL.Component(jcal);
  const events = comp.getAllSubcomponents('vevent');

  return events
    .map(event => {
      const summary = event.getFirstPropertyValue('summary') as string;
      const dtstart = event.getFirstPropertyValue('dtstart') as ICAL.Time;

      // Nur Flug-Events verarbeiten (z.B. "LX 182 ZRH-BKK")
      const flightMatch = summary?.match(/([A-Z]{2}\s?\d+)\s+([A-Z]{3})-([A-Z]{3})/);
      if (!flightMatch) return null;

      return {
        flightNumber: flightMatch[1].replace(' ', ''),
        departureAirport: flightMatch[2],
        arrivalAirport: flightMatch[3],
        departureDate: dtstart.toJSDate().toISOString().split('T')[0], // nur Datum
      };
    })
    .filter(Boolean) as FlightEntry[];
}
```

### Schritt 5: App auf Handy testen

```bash
# Expo Go App auf Handy installieren (App Store / Play Store)
# Dann:
npx expo start

# QR-Code scannen mit Expo Go → App läuft sofort auf deinem Handy
```

---

## Admin-Rollen

```sql
-- Admin-Rolle in Profiles hinzufügen
alter table profiles add column is_admin boolean default false;

-- Nur Admins können Interessen genehmigen
create policy "Admin can manage interests"
  on interests for all
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and is_admin = true
    )
  );
```

---

## Nächste Schritte (Roadmap)

| Phase | Was | Aufwand |
|---|---|---|
| **Phase 1** | Supabase Setup + Auth + Profil | ~1 Woche |
| **Phase 2** | .ical Parser + Schedule Upload | ~3 Tage |
| **Phase 3** | Matching-Logik + Flug-Screens | ~1 Woche |
| **Phase 4** | Chat (Realtime) | ~1 Woche |
| **Phase 5** | Push Notifications | ~2 Tage |
| **Phase 6** | Admin-Panel | ~3 Tage |
| **Phase 7** | App Store Einreichung | ~1 Woche |

---

## Wichtige Hinweise (DSGVO)

- Supabase-Region **immer EU** wählen (Frankfurt/Ireland)
- Keine genauen Abflugzeiten auf Server speichern
- Einwilligungen mit Zeitstempel in DB protokollieren
- Datenlöschung muss **vollständig und sofort** sein
- Eine Datenschutzerklärung (durch Anwalt geprüft) ist vor dem Launch Pflicht
- Da es sich um ein privates Side-Project handelt: Abklären ob Swiss interne Richtlinien zu App-Entwicklung mit Firmen-Daten hat

---

*Erstellt am 13. März 2026 · Swiss Buddy v0.1 Concept*
