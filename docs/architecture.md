# Architektur

## Überblick

```
┌──────────────────────────── apps/mobile (Expo) ────────────────────────────┐
│ app/ (Expo Router)   Screens & Navigation – nur Darstellung und Interaktion │
│ features/*           Hooks (TanStack Query), Stores (Zustand), Services     │
│ data/repositories    Einzige Stelle mit SQL (Drizzle, synchron)              │
│ kalo-user.db         Nutzerdaten (Migrationen)   kalo-core.db  Katalog (RO) │
└───────────────┬─────────────────────────────────────────────┬──────────────┘
                │ HTTPS (Device-Token)                         │ HTTPS
        ┌───────▼────────┐                              ┌──────▼──────────┐
        │ apps/api (Hono)│── Claude Vision (Anthropic)  │ Open Food Facts │
        │ Cloudflare     │── USDA FoodData Central       └─────────────────┘
        └────────────────┘
packages/core      reine Funktionen (Coach, Formeln, Einheiten) – von App & Tests genutzt
packages/schemas   Zod-Schemas + Mapper (OFF, USDA, KI-Antworten) – von App, API & Import genutzt
packages/food-db   Katalog-Schema, Suche (App) und Import-Pipeline (Node-Skript)
```

## Schichten in der App

1. **Screens** (`src/app`) rufen Hooks auf und rendern. Keine Berechnungen außer Formatierung.
2. **Hooks/Services** (`src/features/*`): TanStack-Query-Hooks lesen aus Repositories; `useDbMutation` schreibt und invalidiert Query-Keys. Netzwerkdienste (`openFoodFacts`, `usda`, `photo/api`) nutzen `lib/http` (Timeout, Retry mit Backoff, Deduplizierung, Zod-Validierung, typisierte Fehler).
3. **Repositories** (`src/data/repositories`): synchron, gegen das Drizzle-Interface `Db` geschrieben. In Tests läuft dieselbe Implementierung gegen better-sqlite3 im Speicher.
4. **Reine Logik** (`packages/core`, `features/*/logic.ts`, `stats.ts`, `reconcile.ts` …) ist ohne React testbar.

## Datenflüsse

- **Suche:** Eingabe → `searchLocal` (eigene Lebensmittel, Favoriten, Rezepte, Katalog-FTS5 mit Re-Ranking) sofort; nach 700 ms Open Food Facts, wenn lokal wenig gefunden. Online-Treffer werden beim Eintragen in `foods` gespeichert.
- **Barcode:** Gerät/Katalog → Open Food Facts → USDA (Backend), jeweils mit UPC/EAN-Varianten. Unbekannt → Produkt anlegen (optional Etikett-OCR).
- **Foto:** Bild auf 1024 px verkleinern → `POST /v1/analyze-photo` → Claude (Structured Output) → Server validiert/glättet → App gleicht jeden Bestandteil mit dem Katalog ab (geprüfte Werte pro 100 g bevorzugt) → bearbeitbares Ergebnis → Einträge mit Quelle „photo“.
- **Coach:** Onboarding → `buildPlan` → `goals_history`. Wöchentlich: Tagesbilanzen + Gewichtstrend → `weeklyCheckIn` → Vorschlag mit Begründung → neue Zeile in `goals_history` (nur nach Bestätigung).

## Backend

`createApp(deps)` erhält Konfiguration, Claude-Client, Zählerspeicher und `fetch` per Dependency Injection (Tests ohne Netz). Routen: `POST /v1/device` (anonymes HMAC-Token), `POST /v1/analyze-photo`, `POST /v1/read-label`, `GET /v1/usda/search`, `GET /health`. Fehler haben stabile Codes (`rate_limited`, `refused`, `upstream_timeout` …), die die App übersetzt. Request-Bodies werden nie geloggt.

## Tests

| Ebene                                          | Werkzeug                        | Ort                     |
| ---------------------------------------------- | ------------------------------- | ----------------------- |
| Kernlogik (100 % Coverage, 5 Testprofile)      | Vitest                          | `packages/core/test`    |
| Mapper & Schemas                               | Vitest + echte Antwort-Fixtures | `packages/schemas/test` |
| Suche, Import, Performance (50k Zeilen)        | Vitest + better-sqlite3         | `packages/food-db/test` |
| API-Routen, Tokens, Limits, Fehler             | Vitest + `app.request`          | `apps/api/test`         |
| Repositories, Coach, Foto-Abgleich, HTTP, i18n | Vitest + SQLite in-memory       | `apps/mobile/test`      |
| E2E                                            | Maestro                         | `apps/mobile/.maestro`  |
