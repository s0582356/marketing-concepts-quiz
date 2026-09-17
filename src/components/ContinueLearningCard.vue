<script setup>
import { computed } from 'vue'

const props = defineProps({
  // Sanitisierter lastLearningLocation-Eintrag (siehe learningProgress.js) oder null,
  // wenn noch keine Lernsitzung existiert.
  location: {
    type: Object,
    default: null,
  },
  // Ob die aktuell geladenen Lernbibliotheken zum Fingerprint dieser Sitzung passen.
  isReady: {
    type: Boolean,
    default: false,
  },
  areaLabel: {
    type: String,
    default: '',
  },
  subAreaLabel: {
    type: String,
    default: null,
  },
})

const emit = defineEmits(['continue', 'load-libraries', 'discard'])

const positionLabel = computed(() => {
  if (!props.location || props.location.position === null || props.location.total === null) return null
  const noun = props.location.area === 'quiz' ? 'Frage' : 'Aufgabe'
  return `${noun} ${props.location.position} von ${props.location.total}`
})

const modeLabel = computed(() => {
  const mode = props.location?.mode
  if (mode === 'review') return 'Wiederholung falscher Fragen'
  if (mode === 'apply') return 'Anwenden-Modus'
  if (mode === 'exam') return 'Prüfungs-Modus'
  return null
})
</script>

<template>
  <section class="continue-card" aria-label="Weiterlernen">
    <p class="eyebrow">Weiterlernen</p>

    <template v-if="location">
      <h2>{{ areaLabel }}</h2>
      <p v-if="subAreaLabel" class="continue-subarea">{{ subAreaLabel }}</p>
      <p v-if="positionLabel" class="continue-position">{{ positionLabel }}</p>
      <p v-if="modeLabel" class="continue-mode">{{ modeLabel }}</p>

      <div class="continue-actions">
        <button
          v-if="isReady"
          class="primary-button continue-button"
          type="button"
          @click="emit('continue')"
        >
          Weiterlernen
        </button>
        <button
          v-else
          class="primary-button continue-button"
          type="button"
          @click="emit('load-libraries')"
        >
          Lernbibliotheken laden und fortsetzen
        </button>
        <button class="ghost-button" type="button" @click="emit('discard')">
          Fortschritt verwerfen
        </button>
      </div>

      <p v-if="!isReady" class="continue-hint">
        Lade dieselben Lernbibliotheken erneut, um an dieser Stelle weiterzumachen.
      </p>
    </template>

    <template v-else>
      <h2>Noch keine Lernsitzung</h2>
      <p class="continue-hint">Starte mit Quiz oder Methodentrainer - dein Fortschritt wird automatisch gemerkt.</p>
      <button class="primary-button continue-button" type="button" @click="emit('continue')">
        Lernen starten
      </button>
    </template>
  </section>
</template>
