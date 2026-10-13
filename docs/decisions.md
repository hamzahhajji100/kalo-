# Architekturentscheidungen

Kurze Notizen zu Entscheidungen, die vom Prompt abweichen oder ihn präzisieren. Neueste unten.

| #   | Entscheidung                                                                           | Begründung                                                                                                                                                              |
| --- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Expo SDK 57**, React Native 0.86, TypeScript 6.0                                     | Aktuelles stabiles SDK. TypeScript 7 wird von `typescript-eslint` noch nicht unterstützt.                                                                               |
| 2   | **NativeWind v4** (Tailwind 3.4) statt Tamagui                                         | Kleinere Lernkurve, Theming über CSS-Variablen (`vars()`), funktioniert mit Expo Router. Farben liegen in `src/theme/tokens.ts`, damit SVG/Skia dieselben Werte nutzen. |
| 3   | pnpm mit `node-linker=hoisted`                                                         | Metro und viele RN-Bibliotheken erwarten ein flaches `node_modules`.                                                                                                    |
| 4   | UI-Präferenzen (Theme, Sprache, entspannter Modus) in Zustand + `expo-sqlite/kv-store` | Kein zusätzliches Native-Modul (AsyncStorage) nötig. Gesundheitsdaten liegen getrennt in SQLite-Tabellen.                                                               |
| 5   | Plus-Button als eigener Tab-Button, der ein `formSheet` öffnet                         | Jede Eingabeart ist in 2 Taps erreichbar (Plus → Option).                                                                                                               |
