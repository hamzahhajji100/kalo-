# Kalo – KI-Kalorien- & Makro-Tracker

Foto vom Essen machen, Barcode scannen oder suchen – Kalo erkennt Lebensmittel, rechnet Nährwerte aus und sagt dir, wie viel du heute noch essen darfst. Ein adaptiver Coach passt dein Ziel jede Woche an deinen echten Verbrauch an.

- **Foto-Erkennung** mit Claude Vision über einen eigenen Proxy (kein API-Key in der App), Abgleich mit geprüften Nährwerten
- **Barcode-Scanner** (EAN-13/8, UPC-A/E) mit Open Food Facts und USDA, unbekannte Produkte per Etikett-Foto anlegen
- **Offline-Suche** mit Tippfehler-Toleranz und Synonymen (DE/EN), eigene Rezepte, Favoriten, Vorlagen
- **Ziel-Coach**: Mifflin-St Jeor / Katch-McArdle, Makros, Sicherheitsgrenzen, wöchentlicher adaptiver Check-in
- **Fortschritt**: Gewichtstrend, Kalorien, Makros, Mikronährstoffe, Insights, CSV-Export
- **Datenschutz**: Gesundheitsdaten nur auf dem Gerät, entspannter Modus, „Alle Daten löschen“

> Kalo ist kein Medizinprodukt und ersetzt keine ärztliche oder ernährungstherapeutische Beratung.

## Schnellstart (≈ 10 Minuten)

Voraussetzungen: **Node 22**, **pnpm 10** (`corepack enable`), die App **Expo Go** auf dem Handy (oder ein iOS-Simulator / Android-Emulator).

```bash
git clone https://github.com/hamzahhajji100/kalo-.git kalo && cd kalo
pnpm install
cp .env.example .env          # Werte siehe unten
pnpm test                      # alle Tests (Kernlogik, Suche, API, App-Logik)
pnpm --filter @kalo/mobile start   # QR-Code mit Expo Go scannen
```

Ohne weitere Schritte funktionieren: Onboarding, Coach, Tagebuch, Schnell-Kalorien, Suche (online über Open Food Facts) und Barcode-Scan.

### Foto-Erkennung & Etikett-OCR aktivieren (Backend)

```bash
cd apps/api
cp .dev.vars.example .dev.vars        # ANTHROPIC_API_KEY, TOKEN_SECRET, USDA_API_KEY eintragen
pnpm dev                               # Cloudflare Worker lokal auf :8787 (wrangler dev)
# oder ohne Cloudflare:
ANTHROPIC_API_KEY=… TOKEN_SECRET=dev pnpm dev:node
```

In `.env` (Repo-Wurzel) `EXPO_PUBLIC_API_URL` setzen – auf dem Handy die LAN-IP deines Rechners, z. B. `http://192.168.0.10:8787` – und den Expo-Server neu starten.

**Deployment:** `wrangler kv namespace create RATE_LIMIT_KV` (ID in `apps/api/wrangler.toml` eintragen), `wrangler secret put ANTHROPIC_API_KEY` / `TOKEN_SECRET` / `USDA_API_KEY`, dann `pnpm --filter @kalo/api deploy`.

### Offline-Lebensmittelkatalog bauen

Im Repo liegt ein leerer Katalog. Für Offline-Treffer (Grundnahrungsmittel + ~50.000 DACH-Produkte):

```bash
pnpm db:build        # lädt USDA-Daten und die meistgescannten Produkte von Open Food Facts
```

Details und schnellere Varianten: [`docs/data-sources-licenses.md`](docs/data-sources-licenses.md).

## Projektstruktur

```
apps/mobile        Expo-App (Expo Router, NativeWind, Drizzle/SQLite, TanStack Query, Zustand)
apps/api           Hono-Backend für Cloudflare Workers: KI-Proxy, USDA-Proxy, Rate-Limit
packages/core      Reine, zu 100 % getestete Logik: BMR/TDEE, Ziele, Makros, adaptiver Coach
packages/schemas   Zod-Schemas, internes Food-Modell, Mapper für Open Food Facts & USDA
packages/food-db   Katalog-Schema, Import-Pipeline, Fuzzy-Suche (FTS5 + Synonyme)
docs/              Architektur, Formeln, Entscheidungen, Datenquellen, Store-Checkliste
```

## Befehle

| Befehl                                               | Zweck                                              |
| ---------------------------------------------------- | -------------------------------------------------- |
| `pnpm test`                                          | Alle Unit- und Integrationstests                   |
| `pnpm lint` / `pnpm typecheck` / `pnpm format:check` | Qualität (läuft auch in CI und im Pre-Commit-Hook) |
| `pnpm --filter @kalo/mobile start`                   | Expo-Dev-Server                                    |
| `pnpm --filter @kalo/mobile db:generate`             | Drizzle-Migration nach Schemaänderung erzeugen     |
| `pnpm db:build`                                      | Offline-Katalog bauen                              |
| `pnpm --filter @kalo/api dev`                        | Backend lokal                                      |
| `cd apps/mobile && maestro test .maestro/`           | E2E-Flows (Onboarding, Barcode, Foto)              |

## Builds (EAS)

```bash
npm i -g eas-cli && eas login
cd apps/mobile
eas build --profile development --platform ios     # Dev-Client für Simulator/Gerät
eas build --profile preview --platform android     # installierbare APK
eas build --profile production --platform all      # Store-Builds
eas submit --platform ios|android
```

`EXPO_PUBLIC_API_URL` für Preview/Production in den EAS-Umgebungsvariablen setzen. Vor dem Store-Release: [`docs/store-checklist.md`](docs/store-checklist.md).

## Dokumentation

- [Architektur](docs/architecture.md)
- [Ernährungsformeln & Testprofile](docs/nutrition-formulas.md)
- [Entscheidungen](docs/decisions.md)
- [Datenquellen & Lizenzen](docs/data-sources-licenses.md)
- [Store-Checkliste](docs/store-checklist.md) · [Datenschutzerklärung (Entwurf)](docs/privacy-policy.md)
