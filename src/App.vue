<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import QuizCard from './components/QuizCard.vue'
import ScoreBox from './components/ScoreBox.vue'
import PrivateQuestionImporter from './components/PrivateQuestionImporter.vue'
import LibraryLoader from './components/LibraryLoader.vue'
import HomeDashboard from './components/HomeDashboard.vue'
import MethodTrainerApp from './methodtrainer/MethodTrainerApp.vue'
import MasterLernmentorApp from './masterlernmentor/MasterLernmentorApp.vue'
import sampleQuestions from './data/public/sampleQuestions.json'
import sampleTrainingUnits from './data/public/sampleTrainingUnits.json'
import {
  clearLastLearningLocationIfArea,
  deleteMasterLearnProgress,
  deleteMethodTrainerProgress,
  deleteMixedExamProgress,
  deleteQuizProgress,
  getLastLearningLocation,
  getMasterLearnProgress,
  getQuizProgress,
  saveQuizProgress,
  setLastLearningLocation,
} from './utils/learningProgress.js'
import {
  addLibraryBanks,
  combinedMcFingerprint,
  combinedTrainingFingerprint,
  mergeMcQuestions,
  mergeTrainingUnits,
} from './utils/libraryImport.js'
import { countTopics } from './utils/masterLernmentorValidator.js'

const THEME_STORAGE_KEY = 'marketingQuizTheme'

function getInitialTheme() {
  if (typeof window === 'undefined') return 'light'
  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
  if (storedTheme === 'light' || storedTheme === 'dark') return storedTheme
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark'
  return 'light'
}

function applyTheme(themeValue) {
  if (typeof document !== 'undefined') document.documentElement.setAttribute('data-theme', themeValue)
}

// 'home' (Dashboard/Weiterlernen) | 'quiz' | 'masterLearn' | 'trainer' (Methodentrainer inkl. Mixed Exam)
const currentView = ref('home')

const theme = ref(getInitialTheme())
applyTheme(theme.value)
const isDarkMode = computed(() => theme.value === 'dark')
const themeToggleIcon = computed(() => (isDarkMode.value ? '☀️' : '🌙'))
const themeToggleLabel = computed(() => (isDarkMode.value ? 'Light Mode aktivieren' : 'Dark Mode aktivieren'))

function toggleTheme() {
  theme.value = isDarkMode.value ? 'light' : 'dark'
  applyTheme(theme.value)
  window.localStorage.setItem(THEME_STORAGE_KEY, theme.value)
}

const questions = ref(sampleQuestions)
const originalQuestions = ref(sampleQuestions)
const questionBankName = ref('Öffentliche Beispiel-Fragen')
const privateBankFileName = ref(null)
const activeFingerprint = ref(null)
const resumeError = ref('')
const libraryLoaderRef = ref(null)
const runQuestionIndices = ref([])
const optionOrders = ref([])
const selectedOptionIndices = ref([])
const isQuizStarted = ref(false)
const isQuizComplete = ref(false)
const isReviewMode = ref(false)
const currentQuestionIndex = ref(0)
const selectedAnswer = ref(null)
const isAnswered = ref(false)
const score = ref(0)
const currentStreak = ref(0)
const bestStreak = ref(0)
const incorrectlyAnsweredQuestions = ref([])
const answeredQuestions = ref([])

// Zentrale Lernbibliotheken-Registry (lebt auf App-Ebene, überlebt Tab-Wechsel):
// mehrere private MC-Fragenbanken und Trainingseinheiten-Banken gleichzeitig,
// je Content-Fingerprint (nicht Dateiname) getrennt gehalten - siehe
// libraryImport.js für die genaue Bank-Identitäts-Semantik. Das ist die
// einzige Quelle der Wahrheit für den aktiven privaten MC-/Trainingspool:
// sowohl der zentrale Multi-Loader als auch der alte Einzelimporter
// (PrivateQuestionImporter) schreiben ausschließlich hierhin.
const mcLibraryBanks = ref({})
const trainingUnitLibraryBanks = ref({})

// Master-Lernmentor: eigene, von der MC-/Trainingseinheiten-Registry
// unabhängige Bank - ein einzelnes privates JSON-Objekt (kein Multi-Bank-
// Merge), lebt ausschließlich im Arbeitsspeicher dieser Session (nie in
// localStorage/IndexedDB, siehe Aufgabenstellung Abschnitt 3). { data,
// fingerprint, fileName } | null.
const masterLernmentorBank = ref(null)
const masterLernmentorAppRef = ref(null)
function handleMasterLernmentorBankLoaded(payload) {
  masterLernmentorBank.value = payload
}
// Nur ein grober, technischer Lernfortschritts-Prozentwert für die
// Dashboard-Kachel (keine Note, kein Score) - basiert auf abgeschlossenen
// Topics, nicht auf der aktuellen Position (die nach Abschluss der letzten
// Topic sonst fälschlich unter 100% bliebe). Analog zu refreshQuizCheckpoint:
// expliziter Refresh statt stillem localStorage-Read in einem computed.
const masterLearnProgressPercent = ref(null)
function refreshMasterLearnProgress() {
  if (!masterLernmentorBank.value) {
    masterLearnProgressPercent.value = null
    return
  }
  const checkpoint = getMasterLearnProgress(masterLernmentorBank.value.fingerprint)
  if (!checkpoint) {
    masterLearnProgressPercent.value = 0
    return
  }
  if (checkpoint.isComplete) {
    masterLearnProgressPercent.value = 100
    return
  }
  const total = countTopics(masterLernmentorBank.value.data)
  const rawPercent = total ? Math.round((checkpoint.completedTopicIds.length / total) * 100) : 0
  // Harte Grenze 0-100% (Codex Technical Red Team, Finding m-01) - unabhängig
  // davon, ob der Checkpoint bereits bankgebunden normalisiert wurde.
  masterLearnProgressPercent.value = Math.min(100, Math.max(0, rawPercent))
}
watch(masterLernmentorBank, refreshMasterLearnProgress, { immediate: true })

const libraryMcQuestions = computed(() => mergeMcQuestions(mcLibraryBanks.value))
const libraryTrainingUnits = computed(() => mergeTrainingUnits(trainingUnitLibraryBanks.value))
// Anzeigenamen kommen aus den Bank-Objekten (bank.fileName), nicht aus den
// Registry-Keys - die Keys sind Content-Fingerprints, keine Dateinamen.
const libraryFileNames = computed(() => [
  ...Object.values(mcLibraryBanks.value).map((bank) => bank.fileName),
  ...Object.values(trainingUnitLibraryBanks.value).map((bank) => bank.fileName),
].sort())
// Registry-Keys sind bereits Content-Fingerprints - direkt als "bereits
// bekannt" an den Multi-Loader reichen (siehe LibraryLoader knownFingerprints).
const knownLibraryFingerprints = computed(() => new Set([
  ...Object.keys(mcLibraryBanks.value),
  ...Object.keys(trainingUnitLibraryBanks.value),
]))

// Kombi-Fingerprint der Trainingseinheiten-Banken - eigene, von der MC-Bank-
// Identität unabhängige technische Identität für den Methodentrainer-Resume.
// Bleibt null, solange keine private Trainingsbank geladen ist (die öffentliche
// Demo-Bank besitzt bewusst keinen Fingerprint - siehe learningProgress.js).
const trainingLibraryFingerprint = ref(null)
watch(trainingUnitLibraryBanks, async (banks) => {
  trainingLibraryFingerprint.value = Object.keys(banks).length > 0 ? await combinedTrainingFingerprint(banks) : null
}, { immediate: true })

// ---- Unified Resume: zentraler letzter Lernort + Quiz-Checkpoint --------

const lastLearningLocation = ref(getLastLearningLocation())
function refreshLastLearningLocation() {
  lastLearningLocation.value = getLastLearningLocation()
}
function handleLearningLocation(payload) {
  setLastLearningLocation(payload)
  refreshLastLearningLocation()
  if (payload.area === 'masterLearn') refreshMasterLearnProgress()
}
// Wird ausgelöst, wenn ein Bereich (Mixed Exam oder Methodentrainer) seine
// eigene Sitzung fachlich abgeschlossen und ihren Checkpoint bereits gelöscht
// hat - räumt den globalen Zeiger nur dann mit, wenn er exakt auf diesen
// Bereich/Fingerprint zeigt (Codex Delta Review, Findings M-2/M-3).
function handleLearningLocationCleared({ area, setFingerprint }) {
  clearLastLearningLocationIfArea(area, setFingerprint)
  refreshLastLearningLocation()
}

const quizCheckpoint = ref(null)
function refreshQuizCheckpoint() {
  quizCheckpoint.value = activeFingerprint.value ? getQuizProgress(activeFingerprint.value) : null
}

const AREA_LABELS = { quiz: 'Quiz', methodTrainer: 'Methodentrainer', mixedExam: 'Mixed Transfer Exam', masterLearn: 'Master-Lernmentor' }
// Rein app-definierte, technische Anzeigenamen der Methodentrainer-Kacheln -
// keine aus privaten Trainingsdaten abgeleiteten Inhalte (siehe PRIVACY-Teil
// des Abschlussberichts).
const METHOD_SUBAREA_LABELS = {
  duel: 'Abgrenzungsduell',
  misconception: 'Fehlerdetektiv',
  case: 'Fall-Entscheider',
  assignment: 'Drag-&-Drop-Strukturtrainer',
  matrix: 'Matrix-/Prozess-Trainer',
}

const dashboardAreaLabel = computed(() => (lastLearningLocation.value ? AREA_LABELS[lastLearningLocation.value.area] : ''))
const dashboardSubAreaLabel = computed(() => {
  const location = lastLearningLocation.value
  if (!location || location.area !== 'methodTrainer' || !location.subArea) return null
  return METHOD_SUBAREA_LABELS[location.subArea] ?? null
})
// Prüft, ob die aktuell geladenen Lernbibliotheken zum Fingerprint des
// gespeicherten letzten Lernorts passen - ohne das, keine "Weiterlernen"-
// Freigabe, sondern die Aufforderung, zuerst die Bibliotheken zu laden.
const isResumeReady = computed(() => {
  const location = lastLearningLocation.value
  if (!location) return false
  if (location.area === 'methodTrainer') return location.setFingerprint === trainingLibraryFingerprint.value
  if (location.area === 'masterLearn') return location.setFingerprint === masterLernmentorBank.value?.fingerprint
  return location.setFingerprint === activeFingerprint.value
})

const quizProgressSummary = computed(() => {
  if (!quizCheckpoint.value) return null
  const answered = quizCheckpoint.value.selectedOptionIndices.filter((value) => value !== null).length
  return { answered, total: quizCheckpoint.value.runQuestionIndices.length }
})

const trainerResumeRequest = ref(null)
// Ein Resume-Request ist eine einmalige Anweisung ("springe jetzt genau
// dorthin"), kein dauerhafter Zustand. MethodTrainerApp wertet ihn per
// `watch(..., { immediate: true })` aus, das bei jedem Neu-Mounten erneut
// feuert - ohne dieses Zurücksetzen würde ein regulärer, späterer Wechsel auf
// den Reiter "Methodentrainer" denselben alten Request immer wieder anwenden,
// statt die normale Methodenübersicht zu zeigen (realer Fund aus dem
// Private-Data-Realtest, nicht Teil des ursprünglichen Codex-Berichts).
watch(currentView, (view) => {
  if (view !== 'trainer') trainerResumeRequest.value = null
  if (view !== 'masterLearn') masterLearnResumeRequest.value = null
})

const masterLearnResumeRequest = ref(null)

function continueLearning() {
  const location = lastLearningLocation.value
  if (!location) {
    currentView.value = 'quiz'
    return
  }
  if (location.area === 'quiz') {
    currentView.value = 'quiz'
    resumeQuizFromCheckpoint()
  } else if (location.area === 'masterLearn') {
    currentView.value = 'masterLearn'
    masterLearnResumeRequest.value = { nonce: Date.now() }
  } else {
    currentView.value = 'trainer'
    trainerResumeRequest.value = { area: location.area, nonce: Date.now() }
  }
}

function handleLoadLibrariesForResume() {
  const location = lastLearningLocation.value
  if (location?.area === 'masterLearn') {
    currentView.value = 'masterLearn'
    nextTick(() => masterLernmentorAppRef.value?.openFilePicker())
    return
  }
  libraryLoaderRef.value?.openFilePicker()
}

function handleDiscardContinue() {
  const location = lastLearningLocation.value
  if (!location) return
  if (location.area === 'quiz') deleteQuizProgress(location.setFingerprint)
  else if (location.area === 'methodTrainer') deleteMethodTrainerProgress(location.setFingerprint)
  else if (location.area === 'mixedExam') deleteMixedExamProgress(location.setFingerprint)
  else if (location.area === 'masterLearn') deleteMasterLearnProgress(location.setFingerprint)
  clearLastLearningLocationIfArea(location.area, location.setFingerprint)
  refreshLastLearningLocation()
  refreshQuizCheckpoint()
}

function discardQuizCheckpoint() {
  if (!activeFingerprint.value) return
  deleteQuizProgress(activeFingerprint.value)
  clearLastLearningLocationIfArea('quiz', activeFingerprint.value)
  refreshQuizCheckpoint()
  refreshLastLearningLocation()
}

const totalQuestions = computed(() => questions.value.length)
const wrongAnswerCount = computed(() => totalQuestions.value - score.value)
const scorePercentage = computed(() => totalQuestions.value === 0 ? 0 : Math.round((score.value / totalQuestions.value) * 100))
const currentQuestion = computed(() => questions.value[currentQuestionIndex.value])
const isLastQuestion = computed(() => currentQuestionIndex.value === totalQuestions.value - 1)

const resultMessage = computed(() => {
  if (scorePercentage.value >= 90) return 'Marketing-Strategie sitzt'
  if (scorePercentage.value >= 75) return 'Starke Grundlage - weiter vertiefen'
  if (scorePercentage.value >= 60) return 'Solide Basis - wiederholen lohnt sich'
  return 'Noch unsicher - Fehlerfragen wiederholen'
})

const categoryResults = computed(() => {
  const categories = new Map()
  answeredQuestions.value.forEach((answer) => {
    const categoryName = answer.category || 'Allgemein'
    if (!categories.has(categoryName)) categories.set(categoryName, { name: categoryName, correct: 0, total: 0 })
    const category = categories.get(categoryName)
    category.total++
    if (answer.isCorrect) category.correct++
  })
  return [...categories.values()].map((category) => {
    const percentage = Math.round((category.correct / category.total) * 100)
    let label = 'Wiederholen'
    let statusClass = 'category-review'
    if (percentage >= 80) { label = 'Stark'; statusClass = 'category-strong' }
    else if (percentage >= 60) { label = 'Solide'; statusClass = 'category-solid' }
    return { ...category, percentage, label, statusClass }
  }).sort((a, b) => a.name.localeCompare(b.name))
})

const weakCategories = computed(() => categoryResults.value.filter((category) => category.percentage < 60).map((category) => category.name))
const learningRecommendation = computed(() => weakCategories.value.length > 0
  ? `Wiederhole besonders: ${weakCategories.value.join(', ')}`
  : 'Keine klare Schwachstelle in diesem Durchlauf.')

function getQuestionKey(question) {
  return [question.id, question.category, question.difficulty, question.question].filter(Boolean).join('::')
}

function shuffledIndices(length) {
  const order = Array.from({ length }, (_, index) => index)
  for (let index = order.length - 1; index > 0; index--) {
    const randomIndex = Math.floor(Math.random() * (index + 1))
    const value = order[index]
    order[index] = order[randomIndex]
    order[randomIndex] = value
  }
  return order
}

function buildRun(indices, orders = null) {
  runQuestionIndices.value = indices.map((index) => index)
  optionOrders.value = orders ?? indices.map((index) => shuffledIndices(originalQuestions.value[index].options.length))
  questions.value = indices.map((originalIndex, runIndex) => {
    const question = originalQuestions.value[originalIndex]
    return { ...question, options: optionOrders.value[runIndex].map((optionIndex) => question.options[optionIndex]) }
  })
  selectedOptionIndices.value = Array(indices.length).fill(null)
}

function resetQuizProgress({ clearIncorrectAnswers = true } = {}) {
  currentQuestionIndex.value = 0
  selectedAnswer.value = null
  isAnswered.value = false
  score.value = 0
  currentStreak.value = 0
  bestStreak.value = 0
  answeredQuestions.value = []
  isQuizComplete.value = false
  if (clearIncorrectAnswers) incorrectlyAnsweredQuestions.value = []
}

function savePrivateProgress() {
  if (!activeFingerprint.value || !privateBankFileName.value || runQuestionIndices.value.length === 0) return
  saveQuizProgress(activeFingerprint.value, {
    bankFileName: privateBankFileName.value,
    questionCount: originalQuestions.value.length,
    runQuestionIndices: runQuestionIndices.value,
    optionOrders: optionOrders.value,
    currentIndex: currentQuestionIndex.value,
    selectedOptionIndices: selectedOptionIndices.value,
    score: score.value,
    currentStreak: currentStreak.value,
    bestStreak: bestStreak.value,
    isQuizComplete: isQuizComplete.value,
    isReviewMode: isReviewMode.value,
    lastSavedAt: new Date().toISOString(),
  })
  refreshQuizCheckpoint()
  setLastLearningLocation({
    area: 'quiz',
    setFingerprint: activeFingerprint.value,
    subArea: null,
    itemId: null,
    position: currentQuestionIndex.value + 1,
    total: runQuestionIndices.value.length,
    mode: isReviewMode.value ? 'review' : 'normal',
  })
  refreshLastLearningLocation()
}

function startQuiz() {
  buildRun(originalQuestions.value.map((_, index) => index))
  isReviewMode.value = false
  resetQuizProgress()
  isQuizStarted.value = true
  savePrivateProgress()
}

function selectAnswer(option) {
  if (isAnswered.value) return
  selectedAnswer.value = option
  isAnswered.value = true
  const displayedIndex = currentQuestion.value.options.indexOf(option)
  const originalOptionIndex = optionOrders.value[currentQuestionIndex.value][displayedIndex]
  selectedOptionIndices.value[currentQuestionIndex.value] = originalOptionIndex
  const originalQuestion = originalQuestions.value[runQuestionIndices.value[currentQuestionIndex.value]]
  const isCorrect = originalQuestion.options[originalOptionIndex] === originalQuestion.correctAnswer
  answeredQuestions.value.push({
    key: getQuestionKey(originalQuestion),
    category: originalQuestion.category || 'Allgemein',
    isCorrect,
  })
  if (isCorrect) {
    score.value++
    currentStreak.value++
    bestStreak.value = Math.max(bestStreak.value, currentStreak.value)
  } else {
    currentStreak.value = 0
    if (!incorrectlyAnsweredQuestions.value.some((question) => getQuestionKey(question) === getQuestionKey(originalQuestion))) {
      incorrectlyAnsweredQuestions.value.push(originalQuestion)
    }
  }
  savePrivateProgress()
}

function nextQuestion() {
  if (isLastQuestion.value) return
  currentQuestionIndex.value++
  selectedAnswer.value = null
  isAnswered.value = false
  savePrivateProgress()
}

function finishQuiz() {
  isQuizComplete.value = true
  savePrivateProgress()
}

function restartWithCurrentQuestionBank() {
  buildRun(originalQuestions.value.map((_, index) => index))
  isReviewMode.value = false
  resetQuizProgress()
  isQuizStarted.value = true
  savePrivateProgress()
}

function repeatIncorrectQuestions() {
  if (incorrectlyAnsweredQuestions.value.length === 0) return
  const incorrectKeys = new Set(incorrectlyAnsweredQuestions.value.map(getQuestionKey))
  const indices = originalQuestions.value.map((question, index) => incorrectKeys.has(getQuestionKey(question)) ? index : -1).filter((index) => index >= 0)
  buildRun(indices)
  isReviewMode.value = true
  resetQuizProgress()
  isQuizStarted.value = true
  savePrivateProgress()
}

function showQuestionBankSelection() {
  questions.value = originalQuestions.value
  isReviewMode.value = false
  isQuizStarted.value = false
  resetQuizProgress()
  refreshQuizCheckpoint()
}

function validRestoredRun(progress, importedQuestions) {
  return progress.questionCount === importedQuestions.length
    && progress.runQuestionIndices.every((index) => importedQuestions[index])
    && progress.optionOrders.every((order, runIndex) => {
      const optionCount = importedQuestions[progress.runQuestionIndices[runIndex]].options.length
      return order.length === optionCount && order.every((index) => index < optionCount)
    })
    && progress.selectedOptionIndices.every((index, runIndex) => index === null || index < importedQuestions[progress.runQuestionIndices[runIndex]].options.length)
}

// Setzt eine gespeicherte Quiz-Sitzung fort: die aktive MC-Bibliothek ist zu
// diesem Zeitpunkt bereits geladen (Fingerprint-Match ist Voraussetzung dafür,
// dass quizCheckpoint überhaupt existiert) - kein erneuter Dateiauswahl-Dialog
// nötig, nur eine bewusste Nutzeraktion ("Weiterlernen").
function resumeQuizFromCheckpoint() {
  const progress = quizCheckpoint.value
  if (!progress) return
  if (!validRestoredRun(progress, originalQuestions.value)) {
    resumeError.value = 'Diese Lernbibliotheken passen nicht zur gespeicherten Sitzung.'
    return
  }
  buildRun(progress.runQuestionIndices, progress.optionOrders)
  selectedOptionIndices.value = progress.selectedOptionIndices.map((index) => index)
  currentQuestionIndex.value = progress.currentIndex
  score.value = progress.score
  currentStreak.value = progress.currentStreak
  bestStreak.value = progress.bestStreak
  isQuizComplete.value = progress.isQuizComplete
  isReviewMode.value = progress.isReviewMode
  answeredQuestions.value = []
  incorrectlyAnsweredQuestions.value = []
  progress.selectedOptionIndices.forEach((optionIndex, runIndex) => {
    if (optionIndex === null) return
    const originalQuestion = originalQuestions.value[progress.runQuestionIndices[runIndex]]
    const isCorrect = originalQuestion.options[optionIndex] === originalQuestion.correctAnswer
    answeredQuestions.value.push({ key: getQuestionKey(originalQuestion), category: originalQuestion.category || 'Allgemein', isCorrect })
    if (!isCorrect && !incorrectlyAnsweredQuestions.value.some((question) => getQuestionKey(question) === getQuestionKey(originalQuestion))) {
      incorrectlyAnsweredQuestions.value.push(originalQuestion)
    }
  })
  const currentSelection = progress.selectedOptionIndices[progress.currentIndex]
  selectedAnswer.value = currentSelection === null ? null : originalQuestions.value[progress.runQuestionIndices[progress.currentIndex]].options[currentSelection]
  isAnswered.value = currentSelection !== null
  isQuizStarted.value = true
  resumeError.value = ''
}

// Setzt den aktiven Quiz-/Mixed-Exam-/Resolver-Pool immer aus der zentralen
// MC-Registry ab - einzige Quelle der Wahrheit, kein zweiter, davon
// unabhängiger Pool-State. Wird sowohl vom zentralen Multi-Loader als auch
// vom alten Einzelimporter aufgerufen (Codex MAJOR_FIX: Legacy-Importer).
async function activateMcLibraryPool() {
  const bankCount = Object.keys(mcLibraryBanks.value).length
  originalQuestions.value = libraryMcQuestions.value
  questions.value = libraryMcQuestions.value
  privateBankFileName.value = `Lernbibliothek (${bankCount} MC-Bank${bankCount === 1 ? '' : 'en'})`
  activeFingerprint.value = await combinedMcFingerprint(mcLibraryBanks.value)
  questionBankName.value = `Eigene Fragebank: ${privateBankFileName.value}`
  isReviewMode.value = false
  isQuizStarted.value = false
  resumeError.value = ''
  resetQuizProgress()
  refreshQuizCheckpoint()
}

async function loadPrivateQuestions({ questions: importedQuestions, fileName, fingerprint }) {
  // Läuft über dieselbe zentrale Registry-Pipeline wie der Multi-Loader, statt
  // originalQuestions direkt und ohne Registry-Update zu ersetzen (Codex
  // MAJOR_FIX: entkoppelter Legacy-Importer). Registry, Statusanzeige, Quiz,
  // Mixed Exam und Resolver haben danach garantiert denselben aktiven Pool.
  await handleLibraryLoaded({ mcBanks: [{ fileName, fingerprint, questions: importedQuestions }], trainingUnitBanks: [] })
}

// Zentraler Multi-Datei-Import (und, via loadPrivateQuestions, der alte
// Einzelimporter): fügt Banken in die Registry ein und aktiviert danach immer
// den vollständig aus der Registry abgeleiteten Pool - direkt in Quiz, Mixed
// Exam und Resolver. Trainingseinheiten-Banken werden separat gehalten und
// als Prop an den Methodentrainer weitergegeben.
async function handleLibraryLoaded(result) {
  if (result.mcBanks.length) mcLibraryBanks.value = addLibraryBanks(mcLibraryBanks.value, result.mcBanks)
  if (result.trainingUnitBanks.length) trainingUnitLibraryBanks.value = addLibraryBanks(trainingUnitLibraryBanks.value, result.trainingUnitBanks)

  if (result.mcBanks.length) await activateMcLibraryPool()
}
</script>

<template>
  <main class="app-shell">
    <section class="hero-section">
      <button
        type="button"
        class="theme-toggle"
        :aria-label="themeToggleLabel"
        :aria-pressed="isDarkMode"
        @click="toggleTheme"
      >
        <span aria-hidden="true">{{ themeToggleIcon }}</span>
      </button>

      <p class="eyebrow">Marketing Concepts Quiz</p>
      <h1>Trainiere zentrale Marketing-Konzepte</h1>
      <p class="intro">
        Eine kleine Vue.js-Lern-App mit neutralen Beispiel-Fragen zu Strategie,
        Zielgruppen, Markenführung und Kampagnenbewertung.
      </p>
      <p class="question-bank-label">{{ questionBankName }}</p>
      <p v-if="isReviewMode" class="review-mode-label">Wiederholung falscher Fragen</p>

      <div class="view-switcher" role="tablist" aria-label="Bereich wählen">
        <button
          type="button"
          role="tab"
          class="view-switcher-button"
          :class="{ 'view-switcher-active': currentView === 'home' }"
          :aria-selected="currentView === 'home'"
          @click="currentView = 'home'"
        >
          Dashboard
        </button>
        <button
          type="button"
          role="tab"
          class="view-switcher-button"
          :class="{ 'view-switcher-active': currentView === 'quiz' }"
          :aria-selected="currentView === 'quiz'"
          @click="currentView = 'quiz'"
        >
          Quiz
        </button>
        <button
          type="button"
          role="tab"
          class="view-switcher-button"
          :class="{ 'view-switcher-active': currentView === 'masterLearn' }"
          :aria-selected="currentView === 'masterLearn'"
          @click="currentView = 'masterLearn'"
        >
          Master-Lernmentor
        </button>
        <button
          type="button"
          role="tab"
          class="view-switcher-button"
          :class="{ 'view-switcher-active': currentView === 'trainer' }"
          :aria-selected="currentView === 'trainer'"
          @click="currentView = 'trainer'"
        >
          Methodentrainer
        </button>
      </div>
    </section>

    <LibraryLoader
      ref="libraryLoaderRef"
      :mc-bank-count="Object.keys(mcLibraryBanks).length"
      :mc-question-count="libraryMcQuestions.length"
      :training-unit-bank-count="Object.keys(trainingUnitLibraryBanks).length"
      :training-unit-count="libraryTrainingUnits.length"
      :loaded-file-names="libraryFileNames"
      :known-fingerprints="knownLibraryFingerprints"
      @library-loaded="handleLibraryLoaded"
    />

    <HomeDashboard
      v-if="currentView === 'home'"
      :last-learning-location="lastLearningLocation"
      :is-resume-ready="isResumeReady"
      :area-label="dashboardAreaLabel"
      :sub-area-label="dashboardSubAreaLabel"
      :mc-question-count="libraryMcQuestions.length > 0 ? libraryMcQuestions.length : sampleQuestions.length"
      :has-private-mc-library="Object.keys(mcLibraryBanks).length > 0"
      :quiz-answered="quizProgressSummary ? quizProgressSummary.answered : null"
      :quiz-total="quizProgressSummary ? quizProgressSummary.total : null"
      :training-unit-count="libraryTrainingUnits.length > 0 ? libraryTrainingUnits.length : sampleTrainingUnits.length"
      :has-master-lernmentor-bank="Boolean(masterLernmentorBank)"
      :master-learn-progress-percent="masterLearnProgressPercent"
      @continue="continueLearning"
      @load-libraries="handleLoadLibrariesForResume"
      @discard-continue="handleDiscardContinue"
      @open-quiz="currentView = 'quiz'"
      @open-master-learn="currentView = 'masterLearn'"
      @open-trainer="currentView = 'trainer'"
      @open-mixed-exam="currentView = 'trainer'"
    />

    <template v-else-if="currentView === 'quiz'">
    <section v-if="!isQuizStarted" class="start-layout" aria-label="Quiz vorbereiten">
      <PrivateQuestionImporter @questions-loaded="loadPrivateQuestions" />

      <section v-if="quizCheckpoint" class="saved-progress-card" aria-label="Quiz fortsetzen">
        <h2>Weiterlernen</h2>
        <p v-if="resumeError" class="resume-error" role="alert">{{ resumeError }}</p>
        <p class="saved-progress-note">
          {{ quizCheckpoint.bankFileName }} · Frage {{ quizCheckpoint.currentIndex + 1 }} von {{ quizCheckpoint.runQuestionIndices.length }}
          <template v-if="quizCheckpoint.isQuizComplete"> · abgeschlossen</template>
        </p>
        <div class="saved-progress-actions">
          <button class="primary-button" type="button" @click="resumeQuizFromCheckpoint">Weiterlernen</button>
          <button class="secondary-button" type="button" @click="discardQuizCheckpoint">Fortschritt verwerfen</button>
        </div>
      </section>

      <section class="start-card">
        <h2>Quiz bereit</h2>
        <p>
          Du kannst mit den öffentlichen Beispiel-Fragen starten oder vorher eine
          eigene lokale JSON-Fragebank auswählen.
        </p>

        <button class="start-button" type="button" @click="startQuiz">
          Mit aktueller Fragebank starten
        </button>
      </section>
    </section>

    <section v-else-if="isQuizComplete" class="result-card">
      <p class="eyebrow">
        {{ isReviewMode ? 'Wiederholung abgeschlossen' : 'Quiz abgeschlossen' }}
      </p>
      <h2>Auswertung</h2>

      <div class="result-grid" aria-label="Ergebnisübersicht">
        <div>
          <span>Gesamtfragen</span>
          <strong>{{ totalQuestions }}</strong>
        </div>
        <div>
          <span>Richtige Antworten</span>
          <strong>{{ score }}</strong>
        </div>
        <div>
          <span>Falsche Antworten</span>
          <strong>{{ wrongAnswerCount }}</strong>
        </div>
        <div>
          <span>Prozentwert</span>
          <strong>{{ scorePercentage }}%</strong>
        </div>
        <div>
          <span>Beste Serie</span>
          <strong>{{ bestStreak }}</strong>
        </div>
      </div>

      <p class="result-message">{{ resultMessage }}</p>

      <section class="category-summary" aria-label="Kategorie-Auswertung">
        <h3>Kategorie-Auswertung</h3>
        <div class="category-list">
          <article
            v-for="category in categoryResults"
            :key="category.name"
            class="category-card"
            :class="category.statusClass"
          >
            <div>
              <h4>{{ category.name }}</h4>
              <p>{{ category.correct }}/{{ category.total }} richtig ({{ category.percentage }}%)</p>
            </div>
            <span>{{ category.label }}</span>
          </article>
        </div>
        <p class="learning-recommendation">{{ learningRecommendation }}</p>
      </section>
      <p v-if="incorrectlyAnsweredQuestions.length === 0" class="perfect-message">
        Perfekt – keine Fehler zum Wiederholen.
      </p>

      <div class="result-actions">
        <button
          v-if="incorrectlyAnsweredQuestions.length > 0"
          class="primary-button"
          type="button"
          @click="repeatIncorrectQuestions"
        >
          Falsche Fragen wiederholen
        </button>
        <button class="secondary-button" type="button" @click="restartWithCurrentQuestionBank">
          Neu starten
        </button>
        <button class="secondary-button" type="button" @click="showQuestionBankSelection">
          Andere Fragebank laden
        </button>
      </div>
    </section>

    <section v-else-if="currentQuestion" class="quiz-layout">
      <ScoreBox
        :current-question-index="currentQuestionIndex"
        :total-questions="totalQuestions"
        :score="score"
        :current-streak="currentStreak"
        :best-streak="bestStreak"
      />

      <QuizCard
        :question="currentQuestion"
        :selected-answer="selectedAnswer"
        :is-answered="isAnswered"
        :is-last-question="isLastQuestion"
        @select-answer="selectAnswer"
        @next-question="nextQuestion"
        @restart-quiz="finishQuiz"
      />
    </section>

    <section v-else class="question-card">
      <h2>Keine Fragen gefunden</h2>
      <p>Bitte prüfe die Datei src/data/public/sampleQuestions.json.</p>
    </section>
    </template>

    <MasterLernmentorApp
      v-else-if="currentView === 'masterLearn'"
      ref="masterLernmentorAppRef"
      :bank="masterLernmentorBank"
      :resume-request="masterLearnResumeRequest"
      @bank-loaded="handleMasterLernmentorBankLoaded"
      @learning-location="handleLearningLocation"
      @learning-location-cleared="handleLearningLocationCleared"
    />

    <MethodTrainerApp
      v-else-if="currentView === 'trainer'"
      :mc-questions="originalQuestions"
      :library-training-units="libraryTrainingUnits"
      :trainer-bank-fingerprint="trainingLibraryFingerprint"
      :mc-set-fingerprint="activeFingerprint"
      :resume-request="trainerResumeRequest"
      @learning-location="handleLearningLocation"
      @learning-location-cleared="handleLearningLocationCleared"
    />

    <footer class="app-footer" aria-label="Projektinformationen">
      <span>Version 0.5.0</span>
      <span>Marketing edition</span>
      <a
        href="https://github.com/s0582356/marketing-concepts-quiz"
        target="_blank"
        rel="noreferrer"
      >
        GitHub
      </a>
    </footer>
  </main>
</template>
