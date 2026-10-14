# Datenquellen & Lizenzen

| Quelle                                                                                          | Inhalt in Kalo                                                                                          | Lizenz                                                                                                           | Pflichten                                                                                                                                                                                                                          |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Open Food Facts** (openfoodfacts.org)                                                         | Markenprodukte (Barcode-Scan, Online-Suche, ca. 50.000 meistgescannte DACH-Produkte im Offline-Katalog) | Datenbank: **Open Database License (ODbL) 1.0**; Inhalte: Database Contents License; Produktbilder: CC BY-SA 3.0 | Quelle nennen („Daten: Open Food Facts“), abgeleitete _Datenbanken_ unter ODbL weitergeben (Share-Alike). Der Offline-Katalog `kalo-core.db` ist eine abgeleitete Datenbank und muss auf Anfrage unter ODbL bereitgestellt werden. |
| **USDA FoodData Central** (fdc.nal.usda.gov) – SR Legacy & Foundation Foods                     | Grundnahrungsmittel mit Labor-Nährwerten und Mikronährstoffen                                           | **Public Domain / CC0 1.0**                                                                                      | Keine; Quellenangabe empfohlen: „U.S. Department of Agriculture, Agricultural Research Service. FoodData Central.“                                                                                                                 |
| **Bundeslebensmittelschlüssel (BLS)**                                                           | **nicht enthalten**                                                                                     | Lizenzpflichtig (Max Rubner-Institut) – kostenpflichtige Nutzungsvereinbarung für Apps                           | Kann nach Abschluss einer Lizenz über ein eigenes Import-Modul ergänzt werden. Nicht ohne Vertrag einbinden.                                                                                                                       |
| **Synonyme & deutsche Namen** (`packages/food-db/scripts/data/basics-de.ts`, `src/synonyms.ts`) | Eigene Übersetzungen der USDA-Bezeichnungen                                                             | Teil dieses Repos                                                                                                | Nährwerte stammen immer aus USDA, nur die Namen sind kuratiert.                                                                                                                                                                    |

Die Lizenzhinweise erscheinen in der App auf jeder Lebensmittel-Detailseite (Quelle) und gesammelt unter _Profil → Datenquellen & Lizenzen_.

## Offline-Katalog bauen

Der Katalog liegt als `apps/mobile/assets/db/kalo-core.db` im Repo. Im Repo ist zunächst eine **leere** Version (nur Schema) eingecheckt: In der Cloud-Umgebung, in der das Projekt entstanden ist, waren Open Food Facts und USDA durch die Netzwerk-Policy gesperrt. Die App funktioniert damit trotzdem (Online-Suche, Barcode-Lookup, eigene Lebensmittel), offline gibt es aber erst nach dem Build Treffer für Grundnahrungsmittel.

```bash
# Standard: USDA-CSV-Releases herunterladen + Top-50.000-DACH-Produkte über die OFF-Such-API
# (OFF erlaubt ~10 Suchanfragen/Minute → ca. 1 h; Seiten werden in .cache/food-db zwischengespeichert,
#  ein abgebrochener Lauf setzt dort fort)
pnpm db:build

# Schneller und schonender für OFF: offiziellen JSONL-Dump verwenden (~7 GB gz)
curl -LO https://static.openfoodfacts.org/data/openfoodfacts-products.jsonl.gz
pnpm db:build --off-dump openfoodfacts-products.jsonl.gz --off-limit 50000

# Bereits entpackte USDA-CSV-Verzeichnisse nutzen
pnpm db:build --usda-dir ~/Downloads/FoodData_Central_sr_legacy_food_csv_2018-04 --skip-off
```

Das Skript meldet deutsche Grundnahrungsmittel, deren USDA-Beschreibung im Release nicht gefunden wurde. Diese Einträge werden nicht erfunden, sondern fehlen dann einfach im Katalog.

**Größe:** ca. 25–40 MB für 50.000 Produkte plus USDA (Trigram-Volltextindex). Wenn das App-Paket kleiner sein soll, `--off-limit` reduzieren oder den Katalog per Download-on-first-launch ausliefern (siehe `docs/decisions.md`).
