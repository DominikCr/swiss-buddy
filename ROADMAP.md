# Swiss Buddy – Feature Roadmap

*Zuletzt aktualisiert: 14. März 2026*

---

## Bereits implementiert ✅

- Login mit Email + Passwort (temporär, später Magic Link)
- Datenschutz-Flow mit Einwilligungen (DSGVO-konform)
- Interessen wählen & in Supabase speichern
- Eigene Interessen vorschlagen (Admin-Genehmigung)
- Flugplan-Import via URL (.ical Parser für Swiss-Format)
- Kalender-Import via iOS Kalender (expo-calendar)
- Flüge in Supabase speichern
- GitHub Repository: github.com/DominikCr/swiss-buddy

---

## Phase 2 – Kern-Features (nächste Schritte)

### Buddyliste
- Crew-Mitglieder suchen und als Buddy hinzufügen
- Analog zu FollowMe
- Buddy-Anfragen annehmen/ablehnen

### Flüge-Screen & Matching
- Hauptscreen mit allen Crew-Matches pro Flug
- Matching-Logik: gleiche Interessen + gleicher Flug
- Layover-Überschneidungen erkennen (auch bei unterschiedlichen Flügen)
- Beispiel: Du bist 18.–19. März in LAX, Buddy ist 17.–19. März in LAX → Match!

### Push-Notifications
- Benachrichtigung wenn Buddy am gleichen Layover-Ort ist
- Benachrichtigung bei neuen Crew-Matches
- Benachrichtigung bei neuen Buddy-Anfragen

---

## Phase 3 – Erweiterte Features

### Biometrischer Login
- Face ID (iPhone) und Touch ID (Fingerabdruck) als Login-Option
- Implementierung via expo-local-authentication
- Sicherere und schnellere Alternative zum Passwort-Login

### Kartenfunktion (Crew Knowledge Map)
- Interaktive Karte à la Google Maps
- Eigener Standort wird angezeigt
- POIs (Points of Interest) von anderen Crew-Mitgliedern sichtbar
- In der Region werden alle Highlights anderer Crew angezeigt
- Implementierung via react-native-maps + Google Maps API

### Restaurant & Menü-Highlights
- Foto der Speisekarte aufnehmen (Kamera-Funktion)
- Manuelle Edit-Funktion um Highlights im Menü hervorzuheben
- z.B. "Das Pasta-Gericht auf Seite 2 ist fantastisch!"
- Anonyme Feedback-Funktion an den Ersteller eines Highlights

### Wikipedia-Style Einträge (Crew Knowledge Base)
- Jeder Ort/POI kann von Crew-Mitgliedern bearbeitet werden
- Änderungshistorie nachverfolgbar (wer hat was wann geändert)
- Versionskontrolle ähnlich wie Wikipedia
- Qualitätssicherung durch Community-Voting oder Admin-Review

---

## Phase 4 – Polish & Launch

### Magic Link Login (ersetzt Passwort)
- Eigener SMTP-Server (Resend.com, kostenlos bis 3000 Emails/Monat)
- Sauberer OTP-Flow ohne Rate-Limits

### Admin-Panel
- Interessen genehmigen/ablehnen
- POI-Einträge moderieren
- Nutzer verwalten

### App Store Einreichung
- iOS: Apple Developer Account (~99 CHF/Jahr)
- Android: Google Play Console (~25 USD einmalig)
- App-Icons, Splash Screen, Screenshots

---

## Offene Fragen / Zu klären

- [ ] Zugang zur FollowMe API prüfen (für automatischen Sync)
- [ ] Abklären ob Swiss interne Richtlinien zu Side-Projects mit Firmendaten hat
- [ ] Datenschutzerklärung durch Anwalt prüfen lassen vor Launch
- [ ] SMTP-Provider für Production-Emails auswählen
- [ ] Google Maps API Key besorgen (für Kartenfunktion)

