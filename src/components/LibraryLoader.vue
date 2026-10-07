<script setup>
import { ref } from 'vue'
import { readLibraryFiles } from '../utils/libraryImport.js'

const props = defineProps({
  mcBankCount: { type: Number, default: 0 },
  mcQuestionCount: { type: Number, default: 0 },
  trainingUnitBankCount: { type: Number, default: 0 },
  trainingUnitCount: { type: Number, default: 0 },
  // Master-Lernmentor: es ist immer genau eine Bank aktiv (kein Merge) - die
  // Statuszeile beschreibt deshalb die aktive Bank.
  masterBankCount: { type: Number, default: 0 },
  activeMasterQuestionCount: { type: Number, default: 0 },
  activeMasterHasShortLearnAnswers: { type: Boolean, default: false },
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
  const masterBanks = result.masterLernmentorBanks
  const hasLoadedAny = result.mcBanks.length || result.trainingUnitBanks.length || masterBanks.length
  if (hasLoadedAny) emit('library-loaded', result)

  const messages = []
  if (hasLoadedAny) {
    const parts = []
    if (result.mcBanks.length) parts.push(`${result.mcBanks.length} MC-Fragenbank(en)`)
    if (result.trainingUnitBanks.length) parts.push(`${result.trainingUnitBanks.length} Trainingseinheiten-Bank(en)`)
    if (masterBanks.length) {
      const withShort = masterBanks.filter((bank) => bank.hasShortLearnAnswers).length
      const variant = withShort === masterBanks.length
        ? 'mit Kurz-Lernantworten'
        : withShort === 0 ? 'ohne Kurz-Lernantworten' : `${withShort} davon mit Kurz-Lernantworten`
      parts.push(`${masterBanks.length} Master-Lernmentor-Bank(en) (${variant})`)
    }
    messages.push(`Geladen: ${parts.join(', ')}.`)
  }
  if (result.duplicates.length) messages.push(`${result.duplicates.length} identische Datei(en) übersprungen.`)
  if (result.errors.length) messages.push(`Nicht geladen: ${result.errors.map((error) => `${error.fileName} (${error.reason})`).join('; ')}`)
  importMessage.value = messages.join(' ')

  event.target.value = ''
}

const hasAnyLibrary = () => props.mcBankCount > 0 || props.trainingUnitBankCount > 0 || props.masterBankCount > 0

defineExpose({ openFilePicker })
</script>

<template>
  <section class="library-loader-card" aria-label="Lernbibliotheken laden">
    <div>
      <p class="eyebrow">Private Lernbibliotheken</p>
      <h2>Lernbibliotheken laden</h2>
      <p>
        Wähle mehrere lokale JSON-Dateien gleichzeitig aus - MC-Fragenbanken, die
        Methodentrainer-Bank und die Master-Lernmentor-Bank werden automatisch erkannt
        und bleiben für die gesamte Sitzung geladen. Die Dateien werden nur im Browser
        gelesen, nicht hochgeladen.
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
      <p v-if="masterBankCount">
        ✓ Master-Lernmentor-Bank · {{ activeMasterQuestionCount }} Fragen ·
        {{ activeMasterHasShortLearnAnswers ? 'mit Kurz-Lernantworten' : 'ohne Kurz-Lernantworten' }}
        <template v-if="masterBankCount > 1"> ({{ masterBankCount }} geladen, eine aktiv)</template>
      </p>
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
