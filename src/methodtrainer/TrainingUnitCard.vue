<script setup>
import { computed, ref, watch } from 'vue'
import AnswerOption from '../components/AnswerOption.vue'
import TrainingCompass from './TrainingCompass.vue'

const props = defineProps({
  unit: {
    type: Object,
    required: true,
  },
  mode: {
    type: String,
    required: true,
  },
})

const emit = defineEmits(['completed', 'advance'])

const selected = ref(null)
const isAnswered = computed(() => selected.value !== null)

watch(
  () => props.unit,
  () => {
    selected.value = null
  },
)

const METHOD_LABELS = {
  duel: 'Abgrenzungsduell',
  misconception: 'Fehlerdetektiv',
  case: 'Fall-Entscheider',
}
const INSTRUCTION_LABELS = {
  duel: 'Welches Konzept passt hier fachlich am besten?',
  misconception: 'Was ist an dieser Aussage fachlich problematisch?',
  case: 'Welche Entscheidung folgt aus diesem Fall?',
}

const methodLabel = computed(() => METHOD_LABELS[props.unit.method] ?? props.unit.method)
const instructionLabel = computed(() => INSTRUCTION_LABELS[props.unit.method] ?? '')

// Kompasspfad, concept-Label und Hilfen verraten fachliche Zuordnung. Im Prüfungsmodus
// dürfen sie vor der Antwort nicht sichtbar sein - erst danach ist volles Feedback erlaubt.
const showHelpBeforeAnswer = computed(() => props.mode !== 'exam' && !isAnswered.value)
const showConceptLabel = computed(() => Boolean(props.unit.concept) && (isAnswered.value || showHelpBeforeAnswer.value))
const showCompass = computed(() => Boolean(props.unit.compassPath?.length) && (isAnswered.value || showHelpBeforeAnswer.value))
const showConceptAndExample = computed(() => props.mode === 'learn' && !isAnswered.value)
const showDecisiveClueBeforeAnswer = computed(() => props.mode === 'learn' && !isAnswered.value)

function getAnswerClass(choice) {
  if (!isAnswered.value) return ''
  if (choice === props.unit.correctAnswer) return 'answer-correct'
  if (choice === selected.value) return 'answer-wrong'
  return 'answer-muted'
}

function selectChoice(choice) {
  if (isAnswered.value) return
  selected.value = choice
  emit('completed', { id: props.unit.id, correct: choice === props.unit.correctAnswer })
}

function advance() {
  emit('advance')
}
</script>

<template>
  <section class="question-card training-unit-card">
    <div class="question-meta">
      <span>{{ methodLabel }}</span>
      <span v-if="showConceptLabel">{{ unit.concept }}</span>
    </div>

    <TrainingCompass v-if="showCompass" :path="unit.compassPath" />

    <div v-if="showConceptAndExample && unit.explanation" class="training-explanation">
      <h3>Kurzerklärung</h3>
      <p>{{ unit.explanation }}</p>
    </div>

    <div v-if="showConceptAndExample && unit.guidedExample" class="training-guided-example">
      <h3>Geführtes Beispiel</h3>
      <p>{{ unit.guidedExample }}</p>
    </div>

    <div v-if="showDecisiveClueBeforeAnswer && unit.decisiveClue" class="training-decisive-clue">
      <strong>Achte auf das entscheidende Merkmal:</strong> {{ unit.decisiveClue }}
    </div>

    <p v-if="instructionLabel" class="training-instruction">{{ instructionLabel }}</p>
    <h2>{{ unit.prompt }}</h2>

    <div class="answers">
      <AnswerOption
        v-for="choice in unit.choices"
        :key="choice"
        :option="choice"
        :answer-class="getAnswerClass(choice)"
        :is-disabled="isAnswered"
        @select="selectChoice"
      />
    </div>

    <div v-if="isAnswered" class="feedback-box">
      <p v-if="selected === unit.correctAnswer" class="feedback-correct">
        Richtig.
      </p>
      <p v-else class="feedback-wrong">
        Nicht ganz. Fachlich korrekt ist:
        <strong>{{ unit.correctAnswer }}</strong>
      </p>

      <p v-if="unit.reasoning" class="explanation">
        <strong>Herleitung:</strong> {{ unit.reasoning }}
      </p>
      <p v-if="unit.decisiveClue" class="explanation">
        <strong>Entscheidendes Merkmal:</strong> {{ unit.decisiveClue }}
      </p>
      <p v-if="unit.distractorExplanation" class="explanation">
        <strong>Warum die falsche Option plausibel wirkt:</strong> {{ unit.distractorExplanation }}
      </p>
      <p v-if="unit.misconception" class="explanation">
        <strong>Typische Verwechslung:</strong> {{ unit.misconception }}
      </p>
      <p v-if="unit.feedback" class="explanation">
        {{ unit.feedback }}
      </p>

      <TrainingCompass v-if="unit.compassPath?.length" :path="unit.compassPath" />

      <button class="primary-button" type="button" @click="advance">
        Weiter
      </button>
    </div>
  </section>
</template>
