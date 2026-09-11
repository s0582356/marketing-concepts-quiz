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

const selectedCell = ref(null)
const checked = ref(false)

watch(() => props.unit, () => {
  selectedCell.value = null
  checked.value = false
})

const isCorrect = computed(() => Boolean(
  selectedCell.value
  && selectedCell.value.row === props.unit.correctCell.row
  && selectedCell.value.column === props.unit.correctCell.column,
))

const showHelpBeforeAnswer = computed(() => props.mode !== 'exam' && !checked.value)
const showConceptLabel = computed(() => Boolean(props.unit.concept) && (checked.value || showHelpBeforeAnswer.value))
const showCompass = computed(() => Boolean(props.unit.compassPath?.length) && (checked.value || showHelpBeforeAnswer.value))
const showConceptAndExample = computed(() => props.mode === 'learn' && !checked.value)

function cellClass(row, column) {
  if (!checked.value) return ''
  const isCorrectCell = row === props.unit.correctCell.row && column === props.unit.correctCell.column
  const isSelectedCell = selectedCell.value?.row === row && selectedCell.value?.column === column
  if (isCorrectCell) return 'matrix-cell-correct'
  if (isSelectedCell) return 'matrix-cell-wrong'
  return 'matrix-cell-muted'
}

function selectCell(row, column) {
  if (checked.value) return
  selectedCell.value = { row, column }
  checked.value = true
  emit('completed', { id: props.unit.id, correct: row === props.unit.correctCell.row && column === props.unit.correctCell.column })
}

function advance() {
  emit('advance')
}
</script>

<template>
  <section class="question-card training-unit-card matrix-trainer">
    <div class="question-meta">
      <span>Matrix-Trainer</span>
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

    <p class="training-instruction">Tippe auf das passende Matrixfeld.</p>
    <h2>{{ unit.prompt }}</h2>

    <div
      class="matrix-grid"
      :style="{ gridTemplateColumns: `minmax(120px, 160px) repeat(${unit.columnLabels.length}, 1fr)` }"
    >
      <div class="matrix-corner" aria-hidden="true" />
      <div v-for="column in unit.columnLabels" :key="`head-${column}`" class="matrix-col-header">{{ column }}</div>
      <template v-for="row in unit.rowLabels" :key="`row-${row}`">
        <div class="matrix-row-header">{{ row }}</div>
        <button
          v-for="column in unit.columnLabels"
          :key="`${row}-${column}`"
          type="button"
          class="matrix-cell"
          :class="cellClass(row, column)"
          :disabled="checked"
          @click="selectCell(row, column)"
        >
          <span v-if="checked && row === unit.correctCell.row && column === unit.correctCell.column" aria-hidden="true">✓</span>
        </button>
      </template>
    </div>

    <div v-if="checked" class="feedback-box">
      <p v-if="isCorrect" class="feedback-correct">Richtig.</p>
      <p v-else class="feedback-wrong">
        Nicht ganz. Fachlich korrekt ist:
        <strong>{{ unit.correctCell.row }} × {{ unit.correctCell.column }}</strong>
      </p>

      <p class="explanation"><strong>Zeilen-Dimension:</strong> {{ unit.correctCell.row }}</p>
      <p class="explanation"><strong>Spalten-Dimension:</strong> {{ unit.correctCell.column }}</p>
      <p v-if="unit.reasoning" class="explanation"><strong>Herleitung:</strong> {{ unit.reasoning }}</p>
      <p v-if="unit.distractorExplanation" class="explanation">
        <strong>Warum die gewählte Zelle plausibel wirkt:</strong> {{ unit.distractorExplanation }}
      </p>
      <p v-if="unit.misconception" class="explanation">
        <strong>Typische Verwechslung:</strong> {{ unit.misconception }}
      </p>
      <p v-if="unit.feedback" class="explanation">{{ unit.feedback }}</p>

      <TrainingCompass v-if="unit.compassPath?.length" :path="unit.compassPath" />

      <button class="primary-button" type="button" @click="advance">Weiter</button>
    </div>
  </section>
</template>
