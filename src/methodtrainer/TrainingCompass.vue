<script setup>
defineProps({
  path: {
    type: Array,
    default: () => [],
  },
})
</script>

<template>
  <nav v-if="path && path.length > 0" class="training-compass" aria-label="Marketing-Kompass">
    <span class="training-compass-label">Marketing-Kompass</span>
    <span class="training-compass-path">
      <template v-for="(segment, index) in path" :key="index">
        <span class="training-compass-separator" v-if="index > 0" aria-hidden="true">›</span>
        <span class="training-compass-segment">{{ segment }}</span>
      </template>
    </span>
  </nav>
</template>
