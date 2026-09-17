<script setup>
import { computed, ref, watch } from 'vue'
import AnswerOption from '../components/AnswerOption.vue'
import { resolveMcQuestion } from './trainingUnits.js'
import { deleteMixedExamProgress, getMixedExamProgress, saveMixedExamProgress } from '../utils/learningProgress.js'

const props = defineProps({
  // Aktuell im Quiz-Bereich geladene MC-Fragen (privat importiert oder öffentliche
  // Demo-Bank) - alleinige Prüfungsbasis. Wird hier nie verändert oder kopiert.
  mcQuestions: {
    type: Array,
    default: () => [],
  },
  // Aktuell geladene Methodentrainer-Einheiten, ausschließlich zum Auffinden einer
  // bereits bestehenden, sicheren Rückreferenz auf eine falsch beantwortete Frage.
  allUnits: {
    type: Array,
    default: () => [],
  },
  // Kombi-Fingerprint der aktuell geladenen MC-Fragenbanken - Resume-Schlüssel.
  // Bleibt null, solange keine private Bank geladen ist (öffentliche Demo-Bank
  // wird nie persistiert).
  setFingerprint: {
    type: String,
    default: null,
  },
})

const emit = defineEmits(['back', 'open-method', 'learning-location', 'learning-location-cleared'])

const EXAM_SIZE = 10

const stage = ref('start') // 'start' | 'inProgress' | 'review'
const sessionQuestions = ref([])
const poolIndices = ref([])
const optionOrders = ref([])
const selectedOptionIndices = ref([])
const currentIndex = ref(0)
const selectedOption = ref(null)
const answers = ref([])
const resumeError = ref('')

const poolSize = computed(() => props.mcQuestions.length)
const sessionSize = computed(() => Math.min(EXAM_SIZE, poolSize.value))
const currentQuestion = computed(() => sessionQuestions.value[currentIndex.value] ?? null)
const isAnswered = computed(() => selectedOption.value !== null)
const isLastQuestion = computed(() => currentIndex.value === sessionQuestions.value.length - 1)
const correctCount = computed(() => answers.value.filter((a) => a.isCorrect).length)

const resumableCheckpoint = ref(null)
function refreshResumableCheckpoint() {
  resumableCheckpoint.value = props.setFingerprint ? getMixedExamProgress(props.setFingerprint) : null
}
watch(() => props.setFingerprint, refreshResumableCheckpoint, { immediate: true })

const wrongAnswers = computed(() => answers.value
  .filter((a) => !a.isCorrect)
  .map((a) => ({ ...a, backReferenceMethod: findBackReferenceMethod(a) })))

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

// Baut die angezeigten Prüfungsfragen deterministisch aus poolIndices +
// optionOrders auf - dieselbe Grundlage wird sowohl für einen frischen Start
// als auch für ein Resume verwendet, damit beide Pfade konsistent bleiben.
function buildSessionFromPool() {
  sessionQuestions.value = poolIndices.value.map((originalIndex, index) => {
    const question = props.mcQuestions[originalIndex]
    return {
      question: question.question,
      options: optionOrders.value[index].map((i) => question.options[i]),
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
      category: question.category,
    }
  })
}

function persistExamProgress() {
  if (!props.setFingerprint) return
  saveMixedExamProgress(props.setFingerprint, {
    poolIndices: poolIndices.value,
    optionOrders: optionOrders.value,
    selectedOptionIndices: selectedOptionIndices.value,
    currentIndex: currentIndex.value,
    lastSavedAt: new Date().toISOString(),
  })
  refreshResumableCheckpoint()
  emit('learning-location', {
    area: 'mixedExam',
    setFingerprint: props.setFingerprint,
    subArea: null,
    itemId: null,
    position: currentIndex.value + 1,
    total: poolIndices.value.length,
    mode: null,
  })
}

function startExam() {
  if (poolSize.value === 0) return
  poolIndices.value = shuffledIndices(poolSize.value).slice(0, sessionSize.value)
  optionOrders.value = poolIndices.value.map((originalIndex) => shuffledIndices(props.mcQuestions[originalIndex].options.length))
  selectedOptionIndices.value = Array(poolIndices.value.length).fill(null)
  buildSessionFromPool()
  currentIndex.value = 0
  selectedOption.value = null
  answers.value = []
  stage.value = 'inProgress'
  resumeError.value = ''
  persistExamProgress()
}

function validRestoredExam(checkpoint) {
  return checkpoint.poolIndices.every((index) => index < props.mcQuestions.length)
    && checkpoint.optionOrders.every((order, index) => {
      const optionCount = props.mcQuestions[checkpoint.poolIndices[index]].options.length
      return order.length === optionCount && order.every((i) => i < optionCount)
    })
    && checkpoint.selectedOptionIndices.every((selected, index) => selected === null || selected < props.mcQuestions[checkpoint.poolIndices[index]].options.length)
}

// Setzt eine zuvor gespeicherte, noch laufende Prüfung fort - anhand rein
// technischer Pool-Indizes/Optionsreihenfolgen, nie anhand gespeicherter
// Frage-/Antworttexte (die werden nie persistiert).
function resumeExam() {
  const checkpoint = resumableCheckpoint.value
  if (!checkpoint) return
  if (!validRestoredExam(checkpoint)) {
    resumeError.value = 'Diese Lernbibliotheken passen nicht zur gespeicherten Prüfungssitzung.'
    return
  }
  poolIndices.value = checkpoint.poolIndices
  optionOrders.value = checkpoint.optionOrders
  selectedOptionIndices.value = checkpoint.selectedOptionIndices
  buildSessionFromPool()

  answers.value = checkpoint.selectedOptionIndices
    .map((optionIndex, index) => {
      if (optionIndex === null) return null
      const originalQuestion = props.mcQuestions[checkpoint.poolIndices[index]]
      const displayedIndex = optionOrders.value[index].indexOf(optionIndex)
      const selected = sessionQuestions.value[index].options[displayedIndex]
      return {
        question: originalQuestion.question,
        category: originalQuestion.category,
        explanation: originalQuestion.explanation,
        correctAnswer: originalQuestion.correctAnswer,
        selected,
        isCorrect: selected === originalQuestion.correctAnswer,
      }
    })
    .filter(Boolean)

  currentIndex.value = checkpoint.currentIndex
  const currentSelection = checkpoint.selectedOptionIndices[checkpoint.currentIndex]
  selectedOption.value = currentSelection === null
    ? null
    : sessionQuestions.value[checkpoint.currentIndex].options[optionOrders.value[checkpoint.currentIndex].indexOf(currentSelection)]
  stage.value = 'inProgress'
  resumeError.value = ''
}

function selectOption(option) {
  if (isAnswered.value || !currentQuestion.value) return
  selectedOption.value = option
  const displayedIndex = currentQuestion.value.options.indexOf(option)
  selectedOptionIndices.value[currentIndex.value] = optionOrders.value[currentIndex.value][displayedIndex]
  answers.value.push({
    question: currentQuestion.value.question,
    category: currentQuestion.value.category,
    explanation: currentQuestion.value.explanation,
    correctAnswer: currentQuestion.value.correctAnswer,
    selected: option,
    isCorrect: option === currentQuestion.value.correctAnswer,
  })
  persistExamProgress()
}

function nextQuestion() {
  if (isLastQuestion.value) {
    stage.value = 'review'
    // Eine abgeschlossene Prüfung ist nicht mehr "laufend" - kein falsches
    // Resume eines bereits fertigen Durchlaufs. Der globale Zeiger muss dabei
    // ebenfalls geräumt werden, sonst zeigt das Dashboard weiterhin einen
    // "Weiterlernen"-Button auf einen inzwischen gelöschten Checkpoint (Codex
    // Delta Review, Finding M-2).
    if (props.setFingerprint) {
      deleteMixedExamProgress(props.setFingerprint)
      emit('learning-location-cleared', { area: 'mixedExam', setFingerprint: props.setFingerprint })
    }
    refreshResumableCheckpoint()
    return
  }
  currentIndex.value++
  selectedOption.value = null
  persistExamProgress()
}

function restart() {
  stage.value = 'start'
}

defineExpose({ resumeExam })

// Sucht ausschließlich unter den aktuell geladenen Trainingseinheiten nach einer
// bereits bestehenden mcQuestionReference, die exakt auf diese Frage auflöst -
// keine neue/unsichere semantische Zuordnung, sondern Wiederverwendung des
// bestehenden, bereits getesteten Resolvers in umgekehrter Richtung.
function findBackReferenceMethod(answer) {
  const question = { question: answer.question, category: answer.category }
  for (const unit of props.allUnits) {
    if (!unit.mcQuestionReference) continue
    const match = resolveMcQuestion([question], unit.mcQuestionReference)
    if (match) return unit.method
  }
  return null
}
</script>

<template>
  <section class="method-trainer" aria-label="Mixed Transfer Exam">
    <aside v-if="stage !== 'start'" class="score-card" aria-label="Prüfungsfortschritt">
      <h2>Mixed Transfer Exam</h2>
      <p v-if="stage === 'inProgress'">Frage {{ currentIndex + 1 }} von {{ sessionQuestions.length }}</p>
      <p v-if="stage === 'review'">Ergebnis: <strong>{{ correctCount }}</strong> / {{ sessionQuestions.length }}</p>
      <button class="secondary-button" type="button" @click="emit('back')">Andere Methode wählen</button>
    </aside>

    <section v-if="stage === 'start'" class="question-card">
      <h2>Mixed Transfer Exam</h2>
      <p v-if="poolSize === 0">
        Für die Mixed-Prüfung ist aktuell keine Fragebank geladen. Lade zuerst eine eigene
        JSON-Fragebank im Quiz-Bereich oder starte dort mit den öffentlichen Beispiel-Fragen.
      </p>
      <template v-else>
        <p v-if="resumeError" class="resume-error" role="alert">{{ resumeError }}</p>
        <p v-if="resumableCheckpoint">
          Es gibt eine laufende Prüfung: Frage {{ resumableCheckpoint.currentIndex + 1 }} von {{ resumableCheckpoint.poolIndices.length }}.
        </p>
        <p>
          {{ sessionSize }} zufällige Fragen aus deiner aktuellen Fragebank ({{ poolSize }} insgesamt),
          gemischte Reihenfolge, keine Wiederholung innerhalb dieser Prüfung. Kein Themenhinweis,
          keine Hilfen, keine Erklärung vor der Antwort.
        </p>
        <div class="result-actions">
          <button v-if="resumableCheckpoint" class="primary-button" type="button" @click="resumeExam">Weiterlernen</button>
          <button :class="resumableCheckpoint ? 'secondary-button' : 'primary-button'" type="button" @click="startExam">Prüfung starten</button>
        </div>
      </template>
      <button class="secondary-button" type="button" @click="emit('back')">Zurück</button>
    </section>

    <section v-else-if="stage === 'inProgress' && currentQuestion" class="question-card">
      <h2>{{ currentQuestion.question }}</h2>
      <div class="answers">
        <AnswerOption
          v-for="option in currentQuestion.options"
          :key="option"
          :option="option"
          :answer-class="selectedOption === option ? 'answer-selected-neutral' : ''"
          :is-disabled="isAnswered"
          @select="selectOption"
        />
      </div>
      <div v-if="isAnswered" class="feedback-box">
        <p>Antwort registriert.</p>
        <button class="primary-button" type="button" @click="nextQuestion">
          {{ isLastQuestion ? 'Ergebnis anzeigen' : 'Nächste Frage' }}
        </button>
      </div>
    </section>

    <section v-else-if="stage === 'review'" class="result-card">
      <p class="eyebrow">Mixed Transfer Exam abgeschlossen</p>
      <h2>Auswertung</h2>
      <div class="result-grid" aria-label="Prüfungsergebnis">
        <div>
          <span>Fragen</span>
          <strong>{{ sessionQuestions.length }}</strong>
        </div>
        <div>
          <span>Richtig</span>
          <strong>{{ correctCount }}</strong>
        </div>
        <div>
          <span>Falsch</span>
          <strong>{{ sessionQuestions.length - correctCount }}</strong>
        </div>
      </div>

      <p v-if="wrongAnswers.length === 0" class="perfect-message">
        Alle Fragen richtig beantwortet.
      </p>

      <section v-else class="category-summary" aria-label="Falsch beantwortete Fragen">
        <h3>Falsch beantwortete Fragen</h3>
        <div class="category-list">
          <article v-for="(a, index) in wrongAnswers" :key="index" class="category-card category-review">
            <div>
              <h4>{{ a.question }}</h4>
              <p>Deine Antwort: {{ a.selected }}</p>
              <p>Richtig: <strong>{{ a.correctAnswer }}</strong></p>
              <p v-if="a.explanation" class="explanation">{{ a.explanation }}</p>
              <p class="training-instruction">Kategorie: {{ a.category }}</p>
              <button
                v-if="a.backReferenceMethod"
                class="secondary-button"
                type="button"
                @click="emit('open-method', a.backReferenceMethod)"
              >
                Passenden Methodentrainer öffnen
              </button>
            </div>
          </article>
        </div>
      </section>

      <div class="result-actions">
        <button class="primary-button" type="button" @click="restart">Neue Prüfung</button>
        <button class="secondary-button" type="button" @click="emit('back')">Andere Methode wählen</button>
      </div>
    </section>
  </section>
</template>
