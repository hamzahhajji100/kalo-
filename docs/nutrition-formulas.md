# Ernährungsformeln

Alle Formeln sind als reine, getestete Funktionen in [`packages/core`](../packages/core/src) umgesetzt. Die Werte unten sind die Grundlage der Tests in `packages/core/test/profiles.test.ts`.

> Kalo ist kein Medizinprodukt. Die Werte sind Schätzungen für gesunde Erwachsene und ersetzen keine ärztliche oder ernährungstherapeutische Beratung.

## 1. Grundumsatz (BMR)

| Formel                                  | Berechnung                                                           |
| --------------------------------------- | -------------------------------------------------------------------- |
| Mifflin-St Jeor (Standard)              | `10 × kg + 6,25 × cm − 5 × Alter + 5` (Männer) bzw. `− 161` (Frauen) |
| Katch-McArdle (wenn Körperfett bekannt) | `370 + 21,6 × fettfreie Masse (kg)`                                  |

Ist der Körperfettanteil bekannt, wird der **Mittelwert beider Formeln** genommen. Beide haben eigene systematische Fehler; der Mittelwert ist robuster als eine einzelne Formel.

## 2. Gesamtumsatz (TDEE)

`TDEE = BMR × Aktivitätsfaktor`

| Stufe       | Faktor | Beschreibung im Onboarding                   |
| ----------- | ------ | -------------------------------------------- |
| sedentary   | 1,2    | Bürojob, kaum Bewegung                       |
| light       | 1,375  | Leichte Bewegung, 1–3× Sport/Woche           |
| moderate    | 1,55   | Aktiver Alltag oder 3–5× Sport/Woche         |
| active      | 1,725  | Körperlicher Job oder 6–7× Sport/Woche       |
| very_active | 1,9    | Leistungssport oder harte körperliche Arbeit |

Die Trainingstage pro Woche verändern den Faktor **nicht**, weil die Stufe Training schon enthält. Sie beeinflussen nur Protein und Wasser. So wird Training nicht doppelt gezählt.

## 3. Kalorienziel

- **Abnehmen:** Wunschrate × Körpergewicht × 7.700 kcal/kg ÷ 7. Tempo langsam / mittel / schnell = 0,25 / 0,5 / 1 % Körpergewicht pro Woche. Das Defizit wird auf **10–25 % des TDEE** begrenzt.
- **Muskelaufbau:** Überschuss von 5 / 10 / 15 % (langsam / mittel / schnell), gedeckelt nach Trainingserfahrung: Anfänger 15 %, Fortgeschrittene 10 %, Erfahrene 7,5 %.
- **Halten:** TDEE.
- **Untergrenze:** `max(1.200 kcal Frauen / 1.500 kcal Männer, BMR)`. Liegt das Ziel darunter, wird es angehoben und die App zeigt einen Hinweis (`clampedToMinimum`).
- Gerundet wird auf 10 kcal, bei angehobenen Zielen immer **aufwärts**.

## 4. Makros

1. **Protein** pro kg Referenzgewicht:

   | Ziel     | < 3 Trainingstage | ≥ 3 Trainingstage |
   | -------- | ----------------- | ----------------- |
   | Abnehmen | 2,0 g             | 2,2 g             |
   | Aufbau   | 1,8 g             | 2,0 g             |
   | Halten   | 1,6 g             | 1,8 g             |

   Referenzgewicht = Körpergewicht bzw. bei BMI > 30 das Gewicht bei BMI 27 („angepasstes Körpergewicht“), damit Protein bei starkem Übergewicht nicht überschätzt wird.

2. **Fett:** `max(0,7 g/kg, 25 % der Energie)`.
3. **Kohlenhydrate:** Rest. Bei sehr kleinem Budget sinkt zuerst das Protein bis auf 1,6 g/kg.
4. **Low Carb** begrenzt Kohlenhydrate auf 100 g, **Keto** auf 30 g. Die frei werdende Energie geht in Fett.

## 5. Wasser & Schritte

- Wasser: `35 ml × kg + 500 ml × Trainingstage/7`, gerundet auf 100 ml.
- Schritte: 7.000 (sedentary), 8.000 (light), sonst 10.000.

## 6. Sicherheitsregeln (statt Berechnung → Hinweis)

| Fall                             | Code                 |
| -------------------------------- | -------------------- |
| unter 18 Jahre                   | `minor`              |
| unplausible Eingaben             | `invalid_input`      |
| BMI < 18,5 und Ziel Abnehmen     | `underweight`        |
| Zielgewicht unter BMI 18,5       | `target_underweight` |
| Zielgewicht in falscher Richtung | `target_direction`   |

## 7. Adaptiver Coach

1. **Gewichtstrend:** exponentieller gleitender Mittelwert mit α = 0,1 pro Tag. Lücken werden mit `1 − (1 − α)^Tage` überbrückt.
2. **Echter Verbrauch** über die letzten 21 Tage:
   `TDEE_beobachtet = Ø Aufnahme − (Δ Trend kg × 7.700) ÷ Tage`
3. **Vertrauen** = Anteil geloggter Tage × Dichte der Wiegungen (Wiegung jeden 2. Tag zählt als voll), maximal 0,8. Unter 7 geloggten Tagen oder 7 Tagen Trend-Spanne: keine Anpassung.
4. **Gemischter Schätzwert:** `TDEE_neu = TDEE_alt + Vertrauen × (TDEE_beobachtet − TDEE_alt)`.
5. **Wöchentlicher Check-in:** Aus `TDEE_neu` wird das ideale Ziel wie in Abschnitt 3 berechnet. Liegt es weniger als 30 kcal vom aktuellen Ziel entfernt, bleibt alles gleich. Sonst bewegt sich das Ziel **höchstens ±150 kcal pro Woche** darauf zu.
6. **Begründung für den Nutzer:** `on_track`, `slower_than_planned`, `faster_than_planned`, `expenditure_updated` (Tempo passt, aber der Verbrauch ist ein anderer als geschätzt) oder `insufficient_data`.

## 8. Rechenbeispiele (Testprofile)

| Profil                                                                | BMR   | TDEE  | Ziel                | P / F / KH (g)  |
| --------------------------------------------------------------------- | ----- | ----- | ------------------- | --------------- |
| Anna, ♀ 28 J, 165 cm, 68 kg, leicht aktiv, abnehmen mittel            | 1.410 | 1.939 | 1.570               | 136 / 48 / 149  |
| Markus, ♂ 32 J, 182 cm, 85 kg, moderat, 4× Training, aufbauen langsam | 1.833 | 2.840 | 2.980               | 170 / 83 / 389  |
| Sabine, ♀ 45 J, 170 cm, 72 kg, sitzend, halten                        | 1.397 | 1.676 | 1.680               | 115 / 50 / 191  |
| Jonas, ♂ 24 J, 178 cm, 74 kg, 12 % KFA, sehr aktiv, aufbauen mittel   | 1.757 | 3.338 | 3.670               | 148 / 102 / 540 |
| Petra, ♀ 55 J, 160 cm, 95 kg, sitzend, abnehmen schnell               | 1.514 | 1.817 | 1.520 ⚠︎ Untergrenze | 138 / 48 / 133  |

Rechenweg Anna: BMR = 680 + 1.031,25 − 140 − 161 = 1.410,25 → TDEE = 1.410,25 × 1,375 = 1.939 → Wunschdefizit 68 × 0,005 × 7.700 ÷ 7 = 374 kcal (liegt zwischen 194 und 485) → 1.565 → **1.570 kcal**. Protein 2,0 × 68 = 136 g, Fett max(47,6; 43,6) = 48 g, Kohlenhydrate (1.570 − 544 − 428) ÷ 4 = **149 g**.
