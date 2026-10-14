# Datenschutzerklärung – Entwurf

> **Entwurf zur rechtlichen Prüfung.** Platzhalter in [eckigen Klammern] ergänzen. Diese Vorlage beschreibt das technische Verhalten von Kalo Version 1 und ist keine Rechtsberatung.

**Verantwortlicher:** [Name, Anschrift, E-Mail]

## 1. Grundsatz

Kalo speichert deine Gesundheits- und Ernährungsdaten (Tagebuch, Gewicht, Körpermaße, Ziele, Profil, Fortschrittsfotos) **ausschließlich lokal auf deinem Gerät**. Es gibt kein Benutzerkonto und keine Cloud-Synchronisation. Wir haben keinen Zugriff auf diese Daten.

## 2. Datenübertragungen

| Zweck                                                                   | Empfänger                                                              | Daten                                                          | Rechtsgrundlage                                                                                                  |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Foto-Erkennung von Mahlzeiten / Nährwerttabellen (nur auf deine Aktion) | Kalo-Server (Cloudflare, [Region]) und Anthropic PBC (KI-Analyse, USA) | Das jeweilige, verkleinerte Foto; Sprache; zufällige Geräte-ID | Art. 6 Abs. 1 lit. b DSGVO; für Gesundheitsbezug Art. 9 Abs. 2 lit. a (Einwilligung bei erster Nutzung) [prüfen] |
| Produktsuche / Barcode                                                  | Open Food Facts (Frankreich)                                           | Suchbegriff bzw. Barcode, IP-Adresse                           | Art. 6 Abs. 1 lit. b DSGVO                                                                                       |
| Barcode-Fallback                                                        | Kalo-Server → USDA FoodData Central (USA)                              | Barcode                                                        | Art. 6 Abs. 1 lit. b DSGVO                                                                                       |
| Missbrauchsschutz (Tageslimit)                                          | Kalo-Server                                                            | Zufällige Geräte-ID, Zähler pro Tag                            | Art. 6 Abs. 1 lit. f DSGVO                                                                                       |

Fotos werden vom Kalo-Server **nicht gespeichert und nicht protokolliert**. Anthropic verarbeitet die Anfrage gemäß den kommerziellen Bedingungen und nutzt API-Daten nicht zum Training [aktuelle Bedingungen und Aufbewahrungsfrist prüfen]. Übermittlungen in die USA: [EU-US Data Privacy Framework / Standardvertragsklauseln angeben].

## 3. Keine Analyse- oder Werbe-Tracker

Kalo enthält keine Werbung und keine Tracking- oder Analyse-SDKs.

## 4. Deine Rechte

Da alle Gesundheitsdaten nur auf deinem Gerät liegen, kannst du sie jederzeit selbst exportieren (Fortschritt → Export) und löschen (Profil → Alle Daten löschen). Die Geräte-ID ist nicht mit deiner Person verknüpft; Tageszähler verfallen nach 24 Stunden. Du hast die Rechte aus Art. 15–21 DSGVO und ein Beschwerderecht bei einer Aufsichtsbehörde.

## 5. Kein Medizinprodukt

Kalo gibt allgemeine Ernährungsorientierung und ist kein Medizinprodukt.

Stand: [Datum]
