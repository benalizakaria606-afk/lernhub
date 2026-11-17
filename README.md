# LernHub

Ein gemeinsamer Lernbereich für eine Klasse: Fächer, geteilte Materialien, fachbezogene KI-Assistenten und Klassenchat.

## Lokal starten

1. Node.js 20 oder neuer installieren.
2. Projekt entpacken und im Projektordner ein Terminal öffnen.
3. `npm install`
4. `.env.example` in `.env` kopieren.
5. Für KI-Funktionen einen eigenen OpenAI API-Key in `.env` unter `OPENAI_API_KEY` eintragen.
6. `npm run dev`
7. Browser öffnen: http://localhost:5173

Ohne API-Key funktionieren Fächer, Materialien und Chat; KI-Funktionen zeigen einen Hinweis zur Einrichtung.

## Replit / Veröffentlichung

Das Projekt kann in einen Node.js-Replit importiert werden. Für einen dauerhaften öffentlichen Betrieb müssen Datenbank und Dateiablage auf einen persistenten Dienst umgestellt werden. Diese Starterversion speichert lokal in SQLite und im Ordner `uploads`; flüchtige Deployments können lokale Dateien zurücksetzen. Für eine echte Klassenplattform sollte PostgreSQL + persistenter Object Storage verwendet werden.

## Wichtige Hinweise

- Es gibt bewusst keine Schülerkonten. Jeder mit dem Link kann den gemeinsamen Bereich sehen und Beiträge senden.
- Deshalb keine privaten oder sensiblen Daten hochladen.
- Der Chat ist für eine geschlossene Lerngruppe gedacht, aber ohne Anmeldung kann technisch nicht zuverlässig geprüft werden, wer schreibt. Für einen öffentlichen Einsatz sollten Moderation, Admin-Zugang, Löschfunktion und Missbrauchsschutz ergänzt werden.
- KI-Antworten können Fehler enthalten. Lösungen und Zusammenfassungen bitte prüfen.
- Uploads: PDF, PNG, JPG, JPEG, maximal 8 MB.
- KI-Endpunkt ist serverseitig und rate-limitiert. API-Schlüssel nie im Browser speichern.

## Bereits enthalten

- 16 Schulfächer
- Material-/Zusammenfassungsbereich pro Fach
- KI-Agent pro Fach mit Chat-Eingabe
- Bild-/PDF-Upload als Material
- Klassenchat mit Live-Updates (Socket.IO)
- responsive Oberfläche, Suchfeld, Dark Mode
