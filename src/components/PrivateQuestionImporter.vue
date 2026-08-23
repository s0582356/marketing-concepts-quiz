<script setup>
import { ref } from 'vue'
import { fingerprintFile } from '../utils/fingerprint.js'

const emit = defineEmits(['questions-loaded'])
const fileInput = ref(null)
let requestedFingerprint = null

const validateQuestions = (data) => {
  if (!Array.isArray(data)) {
    throw new Error('Die JSON-Datei muss ein Array von Fragen enthalten.')
  }

  if (data.length === 0) {
    throw new Error('Die JSON-Datei enthält keine Fragen.')
  }

  data.forEach((question, index) => {
    if (!question.question || typeof question.question !== 'string') {
      throw new Error(`Frage ${index + 1}: "question" fehlt oder ist ungültig.`)
    }

    if (!Array.isArray(question.options) || question.options.length < 2) {
      throw new Error(`Frage ${index + 1}: "options" muss mindestens zwei Antworten enthalten.`)
    }

    if (!question.correctAnswer || typeof question.correctAnswer !== 'string') {
      throw new Error(`Frage ${index + 1}: "correctAnswer" fehlt oder ist ungültig.`)
    }

    if (!question.options.includes(question.correctAnswer)) {
      throw new Error(`Frage ${index + 1}: "correctAnswer" muss in "options" enthalten sein.`)
    }

    if (!question.explanation || typeof question.explanation !== 'string') {
      throw new Error(`Frage ${index + 1}: "explanation" fehlt oder ist ungültig.`)
    }

    if (question.category !== undefined && typeof question.category !== 'string') {
      throw new Error(`Frage ${index + 1}: "category" muss ein Text sein.`)
    }

    if (question.difficulty !== undefined && typeof question.difficulty !== 'string') {
      throw new Error(`Frage ${index + 1}: "difficulty" muss ein Text sein.`)
    }
  })

  return data.map((question, index) => ({
    id: question.id ?? index + 1,
    category: question.category || 'Eigene Fragen',
    difficulty: question.difficulty || 'custom',
    question: question.question,
    options: question.options,
    correctAnswer: question.correctAnswer,
    explanation: question.explanation,
    soMerkstDuDirDas: question.soMerkstDuDirDas ?? null,
  }))
}

const handleFileChange = async (event) => {
  const file = event.target.files?.[0]

  if (!file) {
    return
  }

  try {
    const [fileContent, fingerprint] = await Promise.all([file.text(), fingerprintFile(file)])
    const parsedData = JSON.parse(fileContent)
    const validatedQuestions = validateQuestions(parsedData)

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
