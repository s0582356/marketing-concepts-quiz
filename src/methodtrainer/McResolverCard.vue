<script setup>
import { computed, ref, watch } from 'vue'
import AnswerOption from '../components/AnswerOption.vue'
import { shuffledIndices } from '../utils/shuffle.js'

const props = defineProps({
  mcQuestion: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['continue'])

// Identität einer Antwortoption ist ihr ORIGINAL-INDEX in mcQuestion.options,
// nie ihr Text: der MC-Validator erlaubt doppelte Optionstexte (z. B.
// ['Ja', 'Ja', 'Nein']), über den Text wären solche Optionen nicht
// unterscheidbar (gleicher Vue-Key, gemeinsame Auswahl-Markierung).
// selectedIndex ist der Original-Index der konkret geklickten Option.
const selectedIndex = ref(null)
const isAnswered = computed(() => selectedIndex.value !== null)

// Die Antwortreihenfolge wird genau einmal pro angezeigter Frage gemischt und
// danach im Komponentenstate festgehalten - kein Neu-Mischen bei Re-Render
// oder nach dem Klick. Ohne dieses Mischen erschien hier die rohe JSON-
// Reihenfolge, in der die richtige Antwort fast immer an erster Stelle steht.
// Die angezeigte Position ist nie Teil der Auswertung.
const optionOrder = ref(shuffledIndices(props.mcQuestion.options.length))
watch(
  () => props.mcQuestion,
  (question) => {
    optionOrder.value = shuffledIndices(question.options.length)
    selectedIndex.value = null
  },
)
const displayedOptions = computed(() => optionOrder.value.map((originalIndex) => ({
  originalIndex,
  text: props.mcQuestion.options[originalIndex],
})))

// correctAnswer ist im Datenmodell ein Text. Jede Option mit exakt diesem
// Text gilt deshalb fachlich als richtig - bei doppeltem richtigem Text also
// beide. "Ausgewählt" (und damit ggf. "falsch gewählt") ist dagegen immer nur
// die eine konkret geklickte Option.
function isCorrectOption(option) {
  return option.text === props.mcQuestion.correctAnswer
}

const isSelectionCorrect = computed(() => isAnswered.value && props.mcQuestion.options[selectedIndex.value] === props.mcQuestion.correctAnswer)

function getAnswerClass(option) {
  if (!isAnswered.value) return ''
  if (isCorrectOption(option)) return 'answer-correct'
  if (option.originalIndex === selectedIndex.value) return 'answer-wrong'
  return 'answer-muted'
}

function select(option) {
  if (isAnswered.value) return
  selectedIndex.value = option.originalIndex
}
</script>

<template>
  <section class="question-card training-unit-card mc-resolver-card">
    <p class="training-instruction">Jetzt klausurnah prüfen</p>
    <div class="question-meta">
      <span>{{ mcQuestion.category }}</span>
      <span v-if="mcQuestion.difficulty">{{ mcQuestion.difficulty }}</span>
    </div>

    <h2>{{ mcQuestion.question }}</h2>

    <div class="answers">
      <AnswerOption
        v-for="option in displayedOptions"
        :key="option.originalIndex"
        :option="option.text"
        :answer-class="getAnswerClass(option)"
        :is-disabled="isAnswered"
        :data-option-index="option.originalIndex"
        :data-selected="option.originalIndex === selectedIndex"
        @select="select(option)"
      />
    </div>

    <div v-if="isAnswered" class="feedback-box">
      <p v-if="isSelectionCorrect" class="feedback-correct">Richtig.</p>
      <p v-else class="feedback-wrong">
        Nicht ganz. Die richtige Antwort ist:
        <strong>{{ mcQuestion.correctAnswer }}</strong>
      </p>
      <p class="explanation">{{ mcQuestion.explanation }}</p>
      <button class="primary-button" type="button" @click="emit('continue')">Weiter</button>
    </div>
  </section>
</template>
