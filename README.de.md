# Marketing Concepts Quiz

Eine öffentliche Vue.js-Quiz-App zum Wiederholen allgemeiner Marketing-Konzepte.

## Projektstatus

Dieses Repository ist die eigenständige Marketing-Version der Quiz-App. Es enthält neutrale öffentliche Beispiel-Fragen und keine privaten Lernmaterialien.

Live-Deployment: noch nicht eingerichtet.
Repository: https://github.com/s0582356/marketing-concepts-quiz

## Was die App macht

Marketing Concepts Quiz hilft beim Wiederholen grundlegender Marketing-Begriffe und Zusammenhänge durch kurze Multiple-Choice-Fragen. Die App läuft vollständig im Browser und behält den bestehenden Quiz-Ablauf klar und übersichtlich bei.

Enthaltene Funktionen:

* Öffentliche Marketing-Beispielfragen
* Lokaler JSON File Picker für eigene Fragebanken
* Zufällig gemischte Antwortoptionen
* Direktes Feedback mit Erklärung
* Abschlussauswertung
* Wiederholung falsch beantworteter Fragen
* Aktuelle und beste Antwort-Serie
* Kategorie-Auswertung
* Lernempfehlung anhand schwacher Kategorien
* Footer mit Version und GitHub-Link

## Öffentliche Beispielthemen

Die öffentliche Fragendatei behandelt neutrale Einstiegsthemen aus dem Marketing, zum Beispiel:

* Zielgruppen
* Positionierung
* Marketing-Mix
* Markenbekanntheit
* Kampagnenmessung
* Touchpoints in der Customer Journey

Die Beispieldatei liegt hier:

```text
src/data/public/sampleQuestions.json
```

## Format für eigene Fragebanken

Eigene lokale JSON-Dateien können über den File Picker geladen werden. Die Datei wird nur im Browser gelesen, nicht hochgeladen und nicht gespeichert.

Erwartetes Format:

```json
[
  {
    "id": 1,
    "category": "Marketing-Grundlagen",
    "difficulty": "easy",
    "question": "Was beschreibt eine Zielgruppe?",
    "options": [
      "Eine klar definierte Gruppe von Personen für ein Angebot",
      "Alle Menschen in einem Markt"
    ],
    "correctAnswer": "Eine klar definierte Gruppe von Personen für ein Angebot",
    "explanation": "Eine Zielgruppe hilft, Botschaften, Kanäle und Angebote auf relevante Personen auszurichten."
  }
]
```

Pflichtfelder:

* `question`
* `options` mit mindestens zwei Antworten
* `correctAnswer`, das auch in `options` enthalten sein muss
* `explanation`

Optionale Felder:

* `id`
* `category`
* `difficulty`

## Tech Stack

* Vue 3
* Vite
* Plain CSS
* Statische JSON-Daten

Es gibt kein Backend, keine Datenbank und keine persistente Browser-Speicherung.

## Projektstruktur

```text
marketing-concepts-quiz/
├── index.html
├── src/
│   ├── App.vue
│   ├── main.js
│   ├── style.css
│   ├── components/
│   │   ├── AnswerOption.vue
│   │   ├── PrivateQuestionImporter.vue
│   │   ├── QuizCard.vue
│   │   └── ScoreBox.vue
│   └── data/
│       └── public/
│           └── sampleQuestions.json
├── public/
│   ├── favicon.svg
│   └── icons.svg
├── README.md
└── README.de.md
```

## Lokal starten

Abhängigkeiten installieren, falls nötig, und den Vite-Dev-Server starten:

```bash
npm install
npm run dev
```

Statische App bauen:

```bash
npm run build
```

Produktionsbuild lokal ansehen:

```bash
npm run preview
```

## Deployment

Ein Deployment ist noch nicht eingerichtet. Die App kann als statischer Vite-Build aus dem Ordner `dist/` veröffentlicht werden.

Mögliche Static-Site-Einstellungen:

* Build command: `npm run build`
* Publish directory: `dist`

## Datenschutz und Inhaltstrennung

Das öffentliche Repository enthält nur eigene, neutrale Marketing-Beispielfragen. Eigene JSON-Dateien aus dem File Picker werden lokal im Browser verarbeitet und von der App nicht gespeichert.

## Lizenz

Es wurde noch keine Lizenz festgelegt.
