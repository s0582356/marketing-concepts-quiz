<script setup>
import { ref } from 'vue'
import { fingerprintFile } from '../utils/fingerprint.js'
import { validateMcQuestions } from '../utils/mcQuestionValidator.js'

const emit = defineEmits(['questions-loaded'])
const fileInput = ref(null)
let requestedFingerprint = null

const handleFileChange = async (event) => {
  const file = event.target.files?.[0]

  if (!file) {
    return
  }

  try {
    const [fileContent, fingerprint] = await Promise.all([file.text(), fingerprintFile(file)])
    const parsedData = JSON.parse(fileContent)
    const validatedQuestions = validateMcQuestions(parsedData)

    emit('questions-loaded', {
      questions: validatedQuestions,
      fileName: file.name,
      fingerprint,
      requestedFingerprint,
    })

    event.target.value = ''
  } catch (error) {
    alert(`Import fehlgeschlagen: ${error.message}`)
    event.target.value = ''
  }

  requestedFingerprint = null
}

function openFilePicker(fingerprint = null) {
  requestedFingerprint = fingerprint
  fileInput.value?.click()
}

defineExpose({ openFilePicker })
</script>

<template>
  <section class="import-card" aria-label="Eigene Fragebank importieren">
    <div>
      <h2>Eigene Fragebank lokal laden</h2>
      <p>
        Wähle eine lokale JSON-Datei aus. Die Datei wird nur im Browser gelesen,
        nicht hochgeladen und nicht gespeichert.
      </p>
    </div>

    <button class="import-button" type="button" @click="openFilePicker()">
      JSON auswählen
    </button>
    <input ref="fileInput" class="visually-hidden" type="file" accept=".json,application/json" @change="handleFileChange" />
  </section>
</template>
