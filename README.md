# Marketing Concepts Quiz

A public Vue.js quiz app for practicing general marketing concepts.

## Project Status

This repository is the standalone marketing version of the quiz app. It contains neutral public sample questions and no private learning material.

Live deployment: not configured yet.
Repository: https://github.com/s0582356/marketing-concepts-quiz

## What The App Does

Marketing Concepts Quiz helps users review basic marketing terminology and reasoning through short multiple-choice questions. The app runs fully in the browser and keeps the existing quiz workflow simple and transparent.

Included functionality:

* Public marketing sample questions
* Local JSON file picker for a custom question bank
* Randomly shuffled answer options
* Immediate answer feedback with explanations
* Final score summary
* Wrong-question review mode
* Current and best streak tracking
* Category-level result summary
* Learning recommendation based on weak categories
* Footer with project version and GitHub link

## Public Sample Topics

The public question file covers neutral introductory marketing topics such as:

* Target groups
* Positioning
* Marketing mix
* Brand awareness
* Campaign measurement
* Customer journey touchpoints

The sample file is located at:

```text
src/data/public/sampleQuestions.json
```

## Custom Question Bank Format

Users can load their own local JSON file through the file picker. The file is read only in the browser, is not uploaded, and is not stored.

Expected format:

```json
[
  {
    "id": 1,
    "category": "Marketing-Grundlagen",
    "difficulty": "easy",
    "question": "What is a target group?",
    "options": [
      "A clearly defined audience for an offer",
      "Every person in a market"
    ],
    "correctAnswer": "A clearly defined audience for an offer",
    "explanation": "A target group helps align messages, channels, and offers with relevant people."
  }
]
```

Required fields:

* `question`
* `options` with at least two answers
* `correctAnswer`, which must also appear in `options`
* `explanation`

Optional fields:

* `id`
* `category`
* `difficulty`

## Tech Stack

* Vue 3
* Vite
* Plain CSS
* Static JSON data

There is no backend, no database, and no persistent browser storage layer.

## Project Structure

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

## Run Locally

Install dependencies if needed, then start the Vite dev server:

```bash
npm install
npm run dev
```

Build the static app:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Deployment

Deployment is not configured yet. The app can be deployed as a static Vite build from the `dist/` directory.

Suggested static-site settings:

* Build command: `npm run build`
* Publish directory: `dist`

## Privacy And Content Separation

The public repository contains only original, neutral marketing sample questions. Custom JSON files selected through the file picker are processed locally in the browser and are not persisted by the app.

## License

No license has been declared yet.
