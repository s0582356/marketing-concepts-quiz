<script setup>
import { ref } from 'vue'
import { fingerprintFile } from '../utils/fingerprint.js'
import { validateMasterLernmentorBank } from '../utils/masterLernmentorValidator.js'

const emit = defineEmits(['bank-loaded'])
const fileInput = ref(null)
const errorMessage = ref('')

async function handleFileChange(event) {
  const file = event.target.files?.[0]
  if (!file) return

  errorMessage.value = ''
  try {
    const [text, fingerprint] = await Promise.all([file.text(), fingerprintFile(file)])
    const parsed = JSON.parse(text)
    const data = validateMasterLernmentorBank(parsed)
    emit('bank-loaded', { data, fingerprint, fileName: file.name })
  } catch (error) {
    errorMessage.value = error.message || 'Die Datei konnte nicht gelesen werden.'
  } finally {
    event.target.value = ''
  }
}

function openFilePicker() {
  fileInput.value?.click()
}

defineExpose({ openFilePicker })
</script>

<template>
  <section class="import-card" aria-label="Master-Lernmentor-Bank laden">
    <div>
      <h2>Master-Lernmentor-Bank lokal laden</h2>
      <p>
        Wähle die lokale JSON-Datei mit dem vollständigen Master-Lernmentor aus. Die Datei
        wird nur im Browser gelesen, nicht hochgeladen und nicht dauerhaft gespeichert.
      </p>
    </div>

    <button class="import-button" type="button" @click="openFilePicker">
      JSON auswählen
    </button>
    <input
      ref="fileInput"
      class="visually-hidden"
      type="file"
      accept=".json,application/json"
      @change="handleFileChange"
    />

    <p v-if="errorMessage" class="import-error" role="alert">{{ errorMessage }}</p>
  </section>
</template>
