<script setup>
import { computed, ref, watch } from 'vue'
import AnswerOption from './AnswerOption.vue'

const props = defineProps({
  question: {
    type: Object,
    required: true,
  },
  selectedAnswer: {
    type: String,
    default: null,
  },
  isAnswered: {
    type: Boolean,
    required: true,
  },
  isLastQuestion: {
    type: Boolean,
    required: true,
  },
})

const emit = defineEmits(['select-answer', 'next-question', 'restart-quiz'])

function getAnswerClass(option) {
  if (!props.isAnswered) {
    return ''
  }

  if (option === props.question.correctAnswer) {
    return 'answer-correct'
  }

  if (option === props.selectedAnswer) {
    return 'answer-wrong'
  }

  return 'answer-muted'
}

const isMemoryHintOpen = ref(false)

const memoryHint = computed(() => props.question?.soMerkstDuDirDas || null)

const memoryHintSections = computed(() => {
  if (!memoryHint.value) {
    return []
  }

  return [
    { key: 'situation', title: 'Situation', text: memoryHint.value.situation },
    { key: 'action', title: 'Handlung', text: memoryHint.value.action },
    { key: 'whyItFits', title: 'Warum passt das Konzept?', text: memoryHint.value.whyItFits },
    { key: 'memoryHook', title: 'Memory Hook', text: memoryHint.value.memoryHook },
  ].filter((section) => typeof section.text === 'string' && section.text.trim() !== '')
})

const hasMemoryHint = computed(() => memoryHintSections.value.length > 0)

function toggleMemoryHint() {
  isMemoryHintOpen.value = !isMemoryHintOpen.value
}

watch(
  () => props.question,
  () => {
    isMemoryHintOpen.value = false
  },
)
</script>

<template>
  <section class="question-card">
    <div class="question-meta">
      <span>{{ question.category }}</span>
      <span>{{ question.difficulty }}</span>
    </div>

    <h2>{{ question.question }}</h2>

    <div class="answers">
      <AnswerOption
        v-for="option in question.options"
        :key="option"
        :option="option"
        :answer-class="getAnswerClass(option)"
        :is-disabled="isAnswered"
        @select="emit('select-answer', option)"
      />
    </div>

    <div v-if="isAnswered" class="feedback-box">
      <p v-if="selectedAnswer === question.correctAnswer" class="feedback-correct">
        Richtig.
      </p>
      <p v-else class="feedback-wrong">
        Nicht ganz. Die richtige Antwort ist:
        <strong>{{ question.correctAnswer }}</strong>
      </p>

      <p class="explanation">
        {{ question.explanation }}
      </p>

      <div v-if="hasMemoryHint" class="memory-hint">
        <button
          id="memory-hint-toggle"
          class="memory-hint-toggle"
          type="button"
          :aria-expanded="isMemoryHintOpen"
          aria-controls="memory-hint-content"
          @click="toggleMemoryHint"
        >
          <span>💡 So merkst du dir das</span>
          <span class="memory-hint-icon" aria-hidden="true">{{ isMemoryHintOpen ? '−' : '+' }}</span>
        </button>

        <div
          v-if="isMemoryHintOpen"
          id="memory-hint-content"
          class="memory-hint-content"
        >
          <div
            v-for="section in memoryHintSections"
            :key="section.key"
            class="memory-hint-section"
          >
            <h4>{{ section.title }}</h4>
            <p :class="{ 'memory-hook': section.key === 'memoryHook' }">{{ section.text }}</p>
          </div>
        </div>
      </div>

      <button
        v-if="!isLastQuestion"
        class="primary-button"
        type="button"
        @click="emit('next-question')"
      >
        Nächste Frage
      </button>

      <button
        v-else
        class="primary-button"
        type="button"
        @click="emit('restart-quiz')"
      >
        Auswertung anzeigen
      </button>
    </div>
  </section>
</template>
