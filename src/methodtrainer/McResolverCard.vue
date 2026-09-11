<script setup>
import { computed, ref } from 'vue'
import AnswerOption from '../components/AnswerOption.vue'

const props = defineProps({
  mcQuestion: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['continue'])

const selected = ref(null)
const isAnswered = computed(() => selected.value !== null)

function getAnswerClass(option) {
  if (!isAnswered.value) return ''
  if (option === props.mcQuestion.correctAnswer) return 'answer-correct'
  if (option === selected.value) return 'answer-wrong'
  return 'answer-muted'
}

function select(option) {
  if (isAnswered.value) return
  selected.value = option
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
        v-for="option in mcQuestion.options"
        :key="option"
        :option="option"
        :answer-class="getAnswerClass(option)"
        :is-disabled="isAnswered"
        @select="select"
      />
    </div>

    <div v-if="isAnswered" class="feedback-box">
      <p v-if="selected === mcQuestion.correctAnswer" class="feedback-correct">Richtig.</p>
      <p v-else class="feedback-wrong">
        Nicht ganz. Die richtige Antwort ist:
        <strong>{{ mcQuestion.correctAnswer }}</strong>
      </p>
      <p class="explanation">{{ mcQuestion.explanation }}</p>
      <button class="primary-button" type="button" @click="emit('continue')">Weiter</button>
    </div>
  </section>
</template>
