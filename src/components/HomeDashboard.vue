<script setup>
import ContinueLearningCard from './ContinueLearningCard.vue'

defineProps({
  lastLearningLocation: { type: Object, default: null },
  isResumeReady: { type: Boolean, default: false },
  areaLabel: { type: String, default: '' },
  subAreaLabel: { type: String, default: null },

  mcQuestionCount: { type: Number, default: 0 },
  hasPrivateMcLibrary: { type: Boolean, default: false },
  quizAnswered: { type: Number, default: null },
  quizTotal: { type: Number, default: null },

  trainingUnitCount: { type: Number, default: 0 },
})

const emit = defineEmits([
  'continue',
  'load-libraries',
  'discard-continue',
  'open-quiz',
  'open-trainer',
  'open-mixed-exam',
])
</script>

<template>
  <section class="dashboard" aria-label="Lern-Dashboard">
    <header class="dashboard-header">
      <p class="eyebrow">Marketing Lernplattform</p>
      <h1>Willkommen zurück</h1>
    </header>

    <ContinueLearningCard
      :location="lastLearningLocation"
      :is-ready="isResumeReady"
      :area-label="areaLabel"
      :sub-area-label="subAreaLabel"
      @continue="emit('continue')"
      @load-libraries="emit('load-libraries')"
      @discard="emit('discard-continue')"
    />

    <section class="dashboard-cards" aria-label="Hauptbereiche">
      <button type="button" class="dashboard-tile dashboard-tile-quiz" @click="emit('open-quiz')">
        <span class="dashboard-tile-icon" aria-hidden="true">◆</span>
        <h3>Quiz</h3>
        <p v-if="hasPrivateMcLibrary">{{ mcQuestionCount }} private Fragen geladen</p>
        <p v-else>{{ mcQuestionCount }} öffentliche Beispiel-Fragen</p>
        <p v-if="quizAnswered !== null" class="dashboard-tile-progress">Bearbeitet {{ quizAnswered }} / {{ quizTotal }}</p>
      </button>

      <button type="button" class="dashboard-tile dashboard-tile-trainer" @click="emit('open-trainer')">
        <span class="dashboard-tile-icon" aria-hidden="true">▣</span>
        <h3>Methodentrainer</h3>
        <p>{{ trainingUnitCount }} Trainingseinheiten</p>
      </button>

      <button type="button" class="dashboard-tile dashboard-tile-exam" @click="emit('open-mixed-exam')">
        <span class="dashboard-tile-icon" aria-hidden="true">✦</span>
        <h3>Mixed Transfer Exam</h3>
        <p>Klausurnahe Prüfungssimulation</p>
      </button>
    </section>
  </section>
</template>
