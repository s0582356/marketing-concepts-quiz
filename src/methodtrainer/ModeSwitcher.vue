<script setup>
const props = defineProps({
  modelValue: {
    type: String,
    required: true,
  },
})

const emit = defineEmits(['update:modelValue'])

const modes = [
  { key: 'learn', label: 'Lernen', hint: 'Erklärung und geführtes Beispiel' },
  { key: 'apply', label: 'Anwenden', hint: 'neuer Fall, weniger Hilfen' },
  { key: 'exam', label: 'Prüfung', hint: 'keine Hilfen, keine Themenhinweise' },
]

function select(key) {
  if (key === props.modelValue) return
  emit('update:modelValue', key)
}
</script>

<template>
  <div class="mode-switcher" role="tablist" aria-label="Trainingsmodus wählen">
    <button
      v-for="mode in modes"
      :key="mode.key"
      type="button"
      role="tab"
      class="mode-switcher-button"
      :class="{ 'mode-switcher-active': modelValue === mode.key }"
      :aria-selected="modelValue === mode.key"
      :title="mode.hint"
      @click="select(mode.key)"
    >
      {{ mode.label }}
    </button>
  </div>
</template>
