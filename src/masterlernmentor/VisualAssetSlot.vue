<script setup>
// Lokaler Bild-Slot für private Original-Folien (z.B. Marketingmix 1.5).
// Die Bilddatei wird nur für die aktuelle Session als object URL gehalten -
// niemals in localStorage/IndexedDB/Backend persistiert und nie fest verdrahtet
// (kein erfundener Dateipfad, keine öffentliche Ersatzgrafik).
import { onBeforeUnmount, ref } from 'vue'

const props = defineProps({
  assetId: { type: String, required: true },
  sourceLabel: { type: String, default: '' },
})

const fileInput = ref(null)
const imageUrl = ref(null)

function openFilePicker() {
  fileInput.value?.click()
}

function handleFileChange(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  if (imageUrl.value) URL.revokeObjectURL(imageUrl.value)
  imageUrl.value = URL.createObjectURL(file)
}

onBeforeUnmount(() => {
  if (imageUrl.value) URL.revokeObjectURL(imageUrl.value)
})
</script>

<template>
  <figure class="visual-asset-slot" :aria-label="sourceLabel || 'Originalabbildung'">
    <img v-if="imageUrl" :src="imageUrl" :alt="sourceLabel || 'Lokal geladene Originalabbildung'" class="visual-asset-image" />
    <div v-else class="visual-asset-placeholder">
      <p>Originalabbildung lokal laden</p>
      <p v-if="sourceLabel" class="visual-asset-source-label">{{ sourceLabel }}</p>
      <button type="button" class="secondary-button" @click="openFilePicker">Bilddatei auswählen</button>
    </div>
    <input
      ref="fileInput"
      class="visually-hidden"
      type="file"
      accept="image/*"
      :aria-label="`Bilddatei für ${sourceLabel || assetId} auswählen`"
      @change="handleFileChange"
    />
    <figcaption v-if="imageUrl && sourceLabel" class="visual-asset-caption">{{ sourceLabel }}</figcaption>
  </figure>
</template>
