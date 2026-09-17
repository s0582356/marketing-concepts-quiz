<script setup>
import { ref } from 'vue'
import { readLibraryFiles } from '../utils/libraryImport.js'

const props = defineProps({
  mcBankCount: { type: Number, default: 0 },
  mcQuestionCount: { type: Number, default: 0 },
  trainingUnitBankCount: { type: Number, default: 0 },
  trainingUnitCount: { type: Number, default: 0 },
  loadedFileNames: { type: Array, default: () => [] },
  // Fingerprints bereits geladener Banken (App-Ebene Registry) - wird an
  // readLibraryFiles gereicht, damit ein später erneut ausgewählter,
  // inhaltlich bereits bekannter Datei-Inhalt korrekt als Duplikat gemeldet
  // wird statt seine Fragen nochmals in den Pool zu mergen.
  knownFingerprints: { type: Set, default: () => new Set() },
})
const emit = defineEmits(['library-loaded'])

const fileInput = ref(null)
const importMessage = ref('')
const showFileNames = ref(false)

function openFilePicker() {
  fileInput.value?.click()
}

async function handleFileChange(event) {
  const files = event.target.files
  if (!files?.length) return

  const result = await readLibraryFiles(files, props.knownFingerprints)
  if (result.mcBanks.length || result.trainingUnitBanks.length) emit('library-loaded', result)

  const messages = []
  if (result.mcBanks.length || result.trainingUnitBanks.length) {
    const parts = []
    if (result.mcBanks.length) parts.push(`${result.mcBanks.length} MC-Fragenbank(en)`)
    if (result.trainingUnitBanks.length) parts.push(`${result.trainingUnitBanks.length} Trainingseinheiten-Bank(en)`)
    messages.push(`Geladen: ${parts.join(', ')}.`)
  }
  if (result.duplicates.length) messages.push(`${result.duplicates.length} identische Datei(en) übersprungen.`)
  if (result.errors.length) messages.push(`Nicht geladen: ${result.errors.map((error) => `${error.fileName} (${error.reason})`).join('; ')}`)
  importMessage.value = messages.join(' ')

  event.target.value = ''
}

const hasAnyLibrary = () => props.mcBankCount > 0 || props.trainingUnitBankCount > 0

defineExpose({ openFilePicker })
</script>

<template>
  <section class="library-loader-card" aria-label="Lernbibliotheken laden">
    <div>
      <p class="eyebrow">Private Lernbibliotheken</p>
      <h2>Lernbibliotheken laden</h2>
      <p>
        Wähle mehrere lokale JSON-Dateien gleichzeitig aus - MC-Fragenbanken und die
        Methodentrainer-Bank werden automatisch erkannt und bleiben für die gesamte
        Sitzung geladen. Die Dateien werden nur im Browser gelesen, nicht hochgeladen.
      </p>
    </div>

    <button class="import-button library-loader-button" type="button" @click="openFilePicker">
      Lernbibliotheken laden
    </button>
    <input
      ref="fileInput"
      class="visually-hidden"
      type="file"
      multiple
      accept=".json,application/json"
      @change="handleFileChange"
    />

    <section v-if="hasAnyLibrary()" class="library-status" aria-live="polite">
      <h3>Lernbibliotheken geladen</h3>
      <p v-if="mcBankCount">✓ {{ mcBankCount }} MC-Fragenbank(en) · {{ mcQuestionCount }} MC-Fragen</p>
      <p v-if="trainingUnitBankCount">✓ {{ trainingUnitBankCount }} Methodentrainer-Bank(en) · {{ trainingUnitCount }} Trainingseinheiten</p>
      <button
        v-if="loadedFileNames.length"
        class="library-filenames-toggle"
        type="button"
        @click="showFileNames = !showFileNames"
      >
        {{ showFileNames ? 'Dateinamen ausblenden' : 'Dateinamen anzeigen' }}
      </button>
      <ul v-if="showFileNames" class="library-filenames-list">
        <li v-for="fileName in loadedFileNames" :key="fileName">{{ fileName }}</li>
      </ul>
    </section>

    <p v-if="importMessage" class="import-message" role="status">{{ importMessage }}</p>
  </section>
</template>
