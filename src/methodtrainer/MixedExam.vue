<script setup>
import { computed, ref } from 'vue'
import AnswerOption from '../components/AnswerOption.vue'
import { resolveMcQuestion } from './trainingUnits.js'

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
})

const emit = defineEmits(['back', 'open-method'])

const EXAM_SIZE = 10

const stage = ref('start') // 'start' | 'inProgress' | 'review'
const sessionQuestions = ref([])
const currentIndex = ref(0)
const selectedOption = ref(null)
const answers = ref([])

const poolSize = computed(() => props.mcQuestions.length)
const sessionSize = computed(() => Math.min(EXAM_SIZE, poolSize.value))
const currentQuestion = computed(() => sessionQuestions.value[currentIndex.value] ?? null)
const isAnswered = computed(() => selectedOption.value !== null)
const isLastQuestion = computed(() => currentIndex.value === sessionQuestions.value.length - 1)
const correctCount = computed(() => answers.value.filter((a) => a.isCorrect).length)

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

function startExam() {
  if (poolSize.value === 0) return
  const questionOrder = shuffledIndices(poolSize.value).slice(0, sessionSize.value)
  sessionQuestions.value = questionOrder.map((originalIndex) => {
    const question = props.mcQuestions[originalIndex]
    const optionOrder = shuffledIndices(question.options.length)
    return {
      question: question.question,
      options: optionOrder.map((i) => question.options[i]),
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
      category: question.category,
    }
  })
  currentIndex.value = 0
  selectedOption.value = null
  answers.value = []
  stage.value = 'inProgress'
}

function selectOption(option) {
  if (isAnswered.value || !currentQuestion.value) return
  selectedOption.value = option
  answers.value.push({
    question: currentQuestion.value.question,
    category: currentQuestion.value.category,
    explanation: currentQuestion.value.explanation,
    correctAnswer: currentQuestion.value.correctAnswer,
    selected: option,
    isCorrect: option === currentQuestion.value.correctAnswer,
  })
}

function nextQuestion() {
  if (isLastQuestion.value) {
    stage.value = 'review'
    return
  }
  currentIndex.value++
  selectedOption.value = null
}

function restart() {
  stage.value = 'start'
}

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
        <p>
          {{ sessionSize }} zufällige Fragen aus deiner aktuellen Fragebank ({{ poolSize }} insgesamt),
          gemischte Reihenfolge, keine Wiederholung innerhalb dieser Prüfung. Kein Themenhinweis,
          keine Hilfen, keine Erklärung vor der Antwort.
        </p>
        <button class="primary-button" type="button" @click="startExam">Prüfung starten</button>
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
