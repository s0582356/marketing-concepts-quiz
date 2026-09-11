<script setup>
import { ref } from 'vue'
import { validateTrainingUnits } from './trainingUnits.js'

const emit = defineEmits(['units-loaded'])
const fileInput = ref(null)

function openFilePicker() {
  fileInput.value?.click()
}

async function handleFileChange(event) {
  const file = event.target.files?.[0]
  if (!file) return

  try {
    const fileContent = await file.text()
    const parsedData = JSON.parse(fileContent)
    const validatedUnits = validateTrainingUnits(parsedData)
    emit('units-loaded', { units: validatedUnits, fileName: file.name })
    event.target.value = ''
  } catch (error) {
    alert(`Import fehlgeschlagen: ${error.message}`)
    event.target.value = ''
  }
}

defineExpose({ openFilePicker })
</script>

<template>
  <section class="import-card" aria-label="Eigene Trainingsdaten importieren">
    <div>
      <h2>Eigene Trainingsdaten lokal laden</h2>
      <p>
        Wähle eine lokale JSON-Datei mit Abgrenzungsduell- und Fehlerdetektiv-Einheiten aus.
        Die Datei wird nur im Browser gelesen, nicht hochgeladen und nicht gespeichert.
      </p>
    </div>

    <button class="import-button" type="button" @click="openFilePicker()">
      JSON auswählen
    </button>
    <input
      ref="fileInput"
      class="visually-hidden"
      type="file"
      accept=".json,application/json"
      @change="handleFileChange"
    />
  </section>
</template>
