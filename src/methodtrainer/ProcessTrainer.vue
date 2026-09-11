<script setup>
import { computed, ref, watch } from 'vue'
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

const order = ref(props.unit.steps.map((step) => step.id))
const checked = ref(false)

watch(() => props.unit, (unit) => {
  order.value = unit.steps.map((step) => step.id)
  checked.value = false
})

const stepById = computed(() => Object.fromEntries(props.unit.steps.map((step) => [step.id, step])))
const isCorrect = computed(() => order.value.length === props.unit.correctOrder.length
  && order.value.every((id, index) => id === props.unit.correctOrder[index]))

const showHelpBeforeAnswer = computed(() => props.mode !== 'exam' && !checked.value)
const showConceptLabel = computed(() => Boolean(props.unit.concept) && (checked.value || showHelpBeforeAnswer.value))
const showCompass = computed(() => Boolean(props.unit.compassPath?.length) && (checked.value || showHelpBeforeAnswer.value))
const showConceptAndExample = computed(() => props.mode === 'learn' && !checked.value)

// Auf-/Ab-Antippen ist auf Desktop und Mobile gleich gut bedienbar - bewusst kein
// Drag-Reordering, das auf Touch-Geräten oft unzuverlässig ist.
function moveUp(index) {
  if (checked.value || index === 0) return
  const next = [...order.value]
  ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
  order.value = next
}

function moveDown(index) {
  if (checked.value || index === order.value.length - 1) return
  const next = [...order.value]
  ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
  order.value = next
}

function stepClass(id, index) {
  if (!checked.value) return ''
  return props.unit.correctOrder[index] === id ? 'process-step-correct' : 'process-step-wrong'
}

function check() {
  checked.value = true
  emit('completed', { id: props.unit.id, correct: isCorrect.value })
}

const misplacedStepFeedback = computed(() => {
  if (!checked.value || !props.unit.stepFeedback) return []
  return order.value
    .map((id, index) => ({ id, index }))
    .filter(({ id, index }) => props.unit.correctOrder[index] !== id && props.unit.stepFeedback[id])
    .map(({ id }) => ({ step: stepById.value[id], text: props.unit.stepFeedback[id] }))
})

function advance() {
  emit('advance')
}
</script>

<template>
  <section class="question-card training-unit-card process-trainer">
    <div class="question-meta">
      <span>Prozess-Trainer</span>
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

    <p class="training-instruction">Bringe die Schritte mit ▲/▼ in die richtige Reihenfolge.</p>
    <h2>{{ unit.prompt }}</h2>

    <ol class="process-steps">
      <li
        v-for="(id, index) in order"
        :key="id"
        class="process-step"
        :class="stepClass(id, index)"
      >
        <span class="process-step-index">{{ index + 1 }}</span>
        <span class="process-step-label">{{ stepById[id].label }}</span>
        <span class="process-step-controls">
          <button type="button" :disabled="checked || index === 0" aria-label="Nach oben verschieben" @click="moveUp(index)">▲</button>
          <button type="button" :disabled="checked || index === order.length - 1" aria-label="Nach unten verschieben" @click="moveDown(index)">▼</button>
        </span>
      </li>
    </ol>

    <button v-if="!checked" class="primary-button" type="button" @click="check">Reihenfolge prüfen</button>

    <div v-if="checked" class="feedback-box">
      <p v-if="isCorrect" class="feedback-correct">Richtig.</p>
      <p v-else class="feedback-wrong">Nicht ganz. Die korrekte Reihenfolge ist markiert.</p>

      <div v-for="entry in misplacedStepFeedback" :key="entry.step.id" class="explanation">
        <strong>{{ entry.step.label }}:</strong> {{ entry.text }}
      </div>

      <p v-if="unit.reasoning" class="explanation"><strong>Herleitung:</strong> {{ unit.reasoning }}</p>
      <p v-if="unit.misconception" class="explanation">
        <strong>Typische Verwechslung:</strong> {{ unit.misconception }}
      </p>
      <p v-if="unit.feedback" class="explanation">{{ unit.feedback }}</p>

      <TrainingCompass v-if="unit.compassPath?.length" :path="unit.compassPath" />

      <button class="primary-button" type="button" @click="advance">Weiter</button>
    </div>
  </section>
</template>
