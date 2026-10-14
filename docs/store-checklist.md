# Store-Checkliste

## Vor dem ersten Release

- [ ] **Offline-Katalog gebaut** (`pnpm db:build`) und Größe geprüft (Ziel < 40 MB); ODbL-Hinweis in der App vorhanden (Profil → Datenquellen & Lizenzen) ✔︎
- [ ] **Backend deployt** (Worker, KV, Secrets), `EXPO_PUBLIC_API_URL` in EAS gesetzt, Tageslimits und Anthropic-Ausgabenlimit festgelegt
- [ ] App-Icon, Splash-Screen und adaptive Android-Icons ersetzen (aktuell Expo-Standard)
- [ ] Bundle-ID `com.hamzahhajji.kalo` in App Store Connect / Play Console anlegen
- [ ] **Datenschutzerklärung** veröffentlichen (Entwurf: `docs/privacy-policy.md`, rechtlich prüfen lassen) und URL in beiden Stores eintragen
- [ ] Impressum (DE: Pflicht bei geschäftsmäßigem Angebot)
- [ ] E2E-Flows auf echten Geräten (iPhone + Android) grün, Start < 2 s auf Mittelklasse-Gerät gemessen

## Berechtigungstexte (in `app.json` gesetzt)

| Berechtigung                                              | Text                                                                                        |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Kamera (iOS `NSCameraUsageDescription`, Android `CAMERA`) | „Kalo nutzt die Kamera, um Barcodes zu scannen und Fotos deiner Mahlzeiten zu analysieren.“ |
| Fotos (iOS `NSPhotoLibraryUsageDescription`)              | „Kalo greift auf deine Fotos zu, wenn du ein Bild deiner Mahlzeit zur Analyse auswählst.“   |
| Mikrofon                                                  | nicht angefordert (Android `RECORD_AUDIO` blockiert)                                        |

## App Store (iOS) – App-Datenschutz („Nutrition Label“)

| Datentyp                                  | Erhoben?                                                                    | Hinweis                                                |
| ----------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------ |
| Gesundheit & Fitness (Gewicht, Ernährung) | **Nein** (bleibt auf dem Gerät)                                             | Kein Cloud-Sync in Version 1                           |
| Fotos                                     | **Ja, nur zur Funktion**, nicht mit Identität verknüpft, nicht zum Tracking | Bild wird zur Analyse übertragen und nicht gespeichert |
| Kennungen (Geräte-ID)                     | **Ja**, nicht verknüpft                                                     | Zufällige ID nur für Rate-Limit                        |
| Diagnose                                  | Nein                                                                        | –                                                      |

Kategorie: Gesundheit & Fitness. Altersfreigabe: 12+ empfohlen (Diät-Thema); in der App gibt es für Minderjährige keine Kalorienziele.

## Google Play – Datensicherheit

- Gesammelte Daten: Fotos (optional, für App-Funktion, nicht geteilt, verschlüsselt übertragen, nicht gespeichert), Geräte-ID (App-Funktion/Missbrauchsschutz)
- Gesundheitsdaten: nicht erhoben
- Löschung: in der App („Alle Daten löschen“), kein Konto
- Health-Apps-Erklärung ausfüllen (Ernährung/Gewicht), Hinweis „kein Medizinprodukt“

## Screenshots (6,7" iPhone, 6,5", 5,5" sowie Android Phone)

1. Home mit Kalorienring und „Du darfst heute noch …“
2. Foto-Erkennung mit bearbeitbarer Liste
3. Barcode-Scanner mit Produktdetail und Nutri-Score
4. Suche („Hähnchenbrust“, Tippfehler-Toleranz)
5. Wochen-Check-in mit Begründung
6. Fortschritt mit Gewichtstrend

Store-Texte auf Deutsch und Englisch; keine Heilversprechen, keine Aussagen wie „garantiert X kg abnehmen“.
