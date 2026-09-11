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

const placement = ref({})
const selectedItemId = ref(null)
const checked = ref(false)

function resetState() {
  placement.value = {}
  selectedItemId.value = null
  checked.value = false
}

watch(() => props.unit, resetState)

const pool = computed(() => props.unit.items.filter((item) => placement.value[item.id] === undefined))
const allPlaced = computed(() => props.unit.items.every((item) => placement.value[item.id] !== undefined))
const overallCorrect = computed(() => props.unit.items.every((item) => placement.value[item.id] === props.unit.assignments[item.id]))

const showHelpBeforeAnswer = computed(() => props.mode !== 'exam' && !checked.value)
const showConceptLabel = computed(() => Boolean(props.unit.concept) && (checked.value || showHelpBeforeAnswer.value))
const showCompass = computed(() => Boolean(props.unit.compassPath?.length) && (checked.value || showHelpBeforeAnswer.value))
const showConceptAndExample = computed(() => props.mode === 'learn' && !checked.value)

function itemsIn(targetId) {
  return props.unit.items.filter((item) => placement.value[item.id] === targetId)
}

function itemStatusClass(itemId) {
  if (!checked.value) return ''
  return placement.value[itemId] === props.unit.assignments[itemId] ? 'assignment-item-correct' : 'assignment-item-wrong'
}

function selectItem(itemId) {
  if (checked.value) return
  selectedItemId.value = selectedItemId.value === itemId ? null : itemId
}

function unassignItem(itemId) {
  if (checked.value) return
  const next = { ...placement.value }
  delete next[itemId]
  placement.value = next
}

function assignToTarget(targetId) {
  if (checked.value || !selectedItemId.value) return
  placement.value = { ...placement.value, [selectedItemId.value]: targetId }
  selectedItemId.value = null
}

// Click-to-place ist der primäre, mobilgleichwertige Weg. Natives Drag & Drop ist
// eine zusätzliche Komfortoption für Desktop-Mäuse, kein Ersatz dafür.
function onDragStart(event, itemId) {
  event.dataTransfer?.setData('text/plain', itemId)
}

function onDropTarget(event, targetId) {
  if (checked.value) return
  const itemId = event.dataTransfer?.getData('text/plain')
  if (!itemId) return
  placement.value = { ...placement.value, [itemId]: targetId }
}

function onDropPool(event) {
  if (checked.value) return
  const itemId = event.dataTransfer?.getData('text/plain')
  if (itemId) unassignItem(itemId)
}

function check() {
  if (!allPlaced.value) return
  checked.value = true
  emit('completed', { id: props.unit.id, correct: overallCorrect.value })
}

const wrongItemFeedback = computed(() => {
  if (!checked.value) return []
  return props.unit.items
    .filter((item) => placement.value[item.id] !== props.unit.assignments[item.id])
    .map((item) => ({ item, fb: props.unit.itemFeedback?.[item.id] }))
    .filter((entry) => entry.fb && (entry.fb.decisiveClue || entry.fb.misconception || entry.fb.distractorExplanation))
})

function advance() {
  emit('advance')
}
</script>

<template>
  <section class="question-card training-unit-card assignment-trainer">
    <div class="question-meta">
      <span>Drag-&amp;-Drop-Strukturtrainer</span>
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

    <p class="training-instruction">Antippen zum Auswählen, dann Zielkategorie antippen (oder ziehen).</p>
    <h2>{{ unit.prompt }}</h2>

    <div class="assignment-pool" aria-label="Nicht zugeordnete Elemente" @dragover.prevent @drop="onDropPool">
      <button
        v-for="item in pool"
        :key="item.id"
        type="button"
        class="assignment-item"
        :class="{ 'assignment-item-selected': selectedItemId === item.id }"
        draggable="true"
        :disabled="checked"
        @dragstart="onDragStart($event, item.id)"
        @click="selectItem(item.id)"
      >
        {{ item.label }}
      </button>
      <p v-if="pool.length === 0" class="assignment-pool-empty">Alle Elemente zugeordnet.</p>
    </div>

    <div class="assignment-targets">
      <div
        v-for="target in unit.targets"
        :key="target.id"
        class="assignment-target"
        :class="{ 'assignment-target-active': selectedItemId }"
        @dragover.prevent
        @drop="onDropTarget($event, target.id)"
        @click="assignToTarget(target.id)"
      >
        <h3>{{ target.label }}</h3>
        <div class="assignment-target-items">
          <button
            v-for="item in itemsIn(target.id)"
            :key="item.id"
            type="button"
            class="assignment-item assignment-item-placed"
            :class="itemStatusClass(item.id)"
            draggable="true"
            :disabled="checked"
            @dragstart.stop="onDragStart($event, item.id)"
            @click.stop="unassignItem(item.id)"
          >
            {{ item.label }}
          </button>
        </div>
      </div>
    </div>

    <button
      v-if="!checked"
      class="primary-button"
      type="button"
      :disabled="!allPlaced"
      @click="check"
    >
      Zuordnung prüfen
    </button>

    <div v-if="checked" class="feedback-box">
      <p :class="overallCorrect ? 'feedback-correct' : 'feedback-wrong'">
        {{ overallCorrect ? 'Alles richtig zugeordnet.' : 'Nicht alles korrekt - falsch zugeordnete Elemente sind markiert.' }}
      </p>

      <div v-for="entry in wrongItemFeedback" :key="entry.item.id" class="explanation">
        <strong>{{ entry.item.label }}:</strong>
        <span v-if="entry.fb.decisiveClue"> {{ entry.fb.decisiveClue }}</span>
        <span v-if="entry.fb.misconception"> Typische Verwechslung: {{ entry.fb.misconception }}</span>
        <span v-if="entry.fb.distractorExplanation"> {{ entry.fb.distractorExplanation }}</span>
      </div>

      <p v-if="unit.feedback" class="explanation">{{ unit.feedback }}</p>

      <TrainingCompass v-if="unit.compassPath?.length" :path="unit.compassPath" />

      <button class="primary-button" type="button" @click="advance">Weiter</button>
    </div>
  </section>
</template>
