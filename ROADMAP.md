# Swiss Buddy – Feature Roadmap

*Zuletzt aktualisiert: 14. März 2026*

---

## Bereits implementiert ✅

### Auth & Onboarding
- Login mit Email + Passwort (temporär, später Magic Link)
- Datenschutz-Flow mit Einwilligungen (DSGVO-konform)
- Interessen wählen & in Supabase speichern
- Eigene Interessen vorschlagen (Admin-Genehmigung)
- Biometrischer Login vorbereitet (`lib/biometric.ts`) – noch nicht in UI eingebaut

### Flugplan
- Flugplan-Import via URL (.ical Parser für Swiss-Format "LX40 ZRH 1315 LAX...")
- Kalender-Import via iOS Kalender (expo-calendar)
- Flüge in Supabase gespeichert (`schedule_entries`)
- Automatischer Hintergrund-Sync (`lib/backgroundSync.ts`)
- AppState-Listener: Sync beim App-Start / Vordergrund

### Buddies & Matching
- Buddyliste: Suchen, Anfragen senden/annehmen/ablehnen, Entfernen
- Flüge-Screen mit Buddy-Layover-Überschneidungen
- Supabase RPC-Funktion `get_layover_overlaps`

### Push Notifications
- Push-Token Registrierung (`lib/notifications.ts`)
- Lokale Notifications bei Buddy-Überschneidungen
- Notification-Tap → Weiterleitung zu Flüge-Screen

### Karte & POIs
- `lib/spots.ts` vollständig implementiert:
  - POIs erstellen mit Kategorie, Koordinaten, Stadt
  - Tips hinzufügen (Wikipedia-Style Versionshistorie)
  - Spots suchen
  - Spots löschen
- Karten-Tab (`map.tsx`) existiert im Tab-Layout

### Navigation
- 4 Tabs: Home, Flüge, Buddies, Karte
- Schedule-Screen als versteckter Tab (kein Tab-Icon, via Navigation erreichbar)
- Root Layout mit Auth-State-Listener

---

## Offene Punkte / Bugs 🐛

- [ ] Session-Persistenz: User muss sich nach App-Neustart neu einloggen
- [ ] `index.tsx` ist noch alte Version (ohne Skip-Button, ohne pendingInterests-Fix)
- [ ] `explore.tsx` (Standard-Expo-Template) kann gelöscht werden
- [ ] Supabase-Tabellen `crew_spots` und `crew_spot_tips` noch nicht erstellt
- [ ] Biometrischer Login in UI noch nicht eingebaut (Lib ist fertig)
- [ ] `index.tsx`: Einwilligungen und Interessen werden nach Login-Session-Verlust nicht geladen

---

## Phase 2 – Laufende Arbeiten

### Karte fertigstellen
- [ ] `map.tsx` Screen mit react-native-maps implementieren
- [ ] POIs auf Karte anzeigen
- [ ] Eigener Standort anzeigen
- [ ] POI hinzufügen / bearbeiten
- [ ] Foto der Speisekarte aufnehmen
- [ ] Supabase-Tabellen `crew_spots` und `crew_spot_tips` anlegen

### Chat (Realtime)
- [ ] Supabase Realtime für Chat einrichten
- [ ] `messages` Tabelle anlegen
- [ ] Chat-Screen bauen
- [ ] Ungelesene Nachrichten Badge

### Biometrischer Login in UI einbauen
- [ ] Face ID / Touch ID Option auf Login-Screen
- [ ] Einstellung in Profil-Screen um Biometrie ein/auszuschalten
- [ ] `lib/biometric.ts` ist fertig – nur UI fehlt

---

## Phase 3 – Geplante Features

### Privacy per Trip
- Globale Standard-Einstellungen was geteilt wird
- Pro Rotation/Layover überschreibbar mit Schiebereglern
- Kategorien: Auto-Miete, Aktivitäten, Hotel, Standort, Verfügbarkeit
- Nach Layover automatischer Reset auf globale Einstellungen

### Wikipedia-Style POI-Einträge
- Änderungshistorie für jeden POI nachverfolgbar
- Community-Voting oder Admin-Review
- Anonymes Feedback an Ersteller

### Admin-Panel
- Interessen genehmigen/ablehnen
- POI-Einträge moderieren
- Nutzer verwalten
- `is_admin` Spalte in `profiles` bereits in Techstack-Doku

---

## Phase 4 – Polish & Launch

### Magic Link Login (ersetzt Passwort)
- Eigener SMTP-Server (Resend.com, kostenlos bis 3000 Emails/Monat)
- Sauberer OTP-Flow ohne Rate-Limits

### App Store Einreichung
- iOS: Apple Developer Account (~99 CHF/Jahr) – TestFlight für Beta-Test
- Android: Google Play Console (~25 USD einmalig)
- App-Icons, Splash Screen, Screenshots

---

## Supabase – Bestehende Tabellen ✅
- `profiles` (mit `push_token`, `is_visible`, Consent-Felder)
- `interests` (mit Status pending/active/inactive)
- `profile_interests` (Many-to-Many)
- `schedule_entries`
- `buddies`

## Supabase – Fehlende Tabellen ❌
- `crew_spots` (für Karten-POIs)
- `crew_spot_tips` (für Wikipedia-Style Tips)
- `messages` (für Chat)

---

## Tech-Stack
- Expo (React Native) + TypeScript
- Supabase (PostgreSQL, Auth, Realtime, RLS)
- expo-calendar, expo-notifications, expo-device
- expo-local-authentication (biometric – bereit)
- expo-background-fetch + expo-task-manager (background sync)
- ical.js (Flugplan-Parser)
- GitHub: github.com/DominikCr/swiss-buddy

---

## Offene Fragen
- [ ] Zugang zur FollowMe API prüfen
- [ ] Swiss interne Richtlinien zu Side-Projects abklären
- [ ] Datenschutzerklärung durch Anwalt prüfen lassen vor Launch
- [ ] Google Maps API Key besorgen (für Kartenfunktion)
- [ ] SMTP-Provider für Production-Emails wählen (Resend.com empfohlen)

*Swiss Buddy v0.3 – 14. März 2026*
