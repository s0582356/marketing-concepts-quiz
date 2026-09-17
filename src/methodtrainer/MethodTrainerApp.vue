<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import AssignmentTrainer from './AssignmentTrainer.vue'
import MatrixTrainer from './MatrixTrainer.vue'
import McResolverCard from './McResolverCard.vue'
import MixedExam from './MixedExam.vue'
import ModeSwitcher from './ModeSwitcher.vue'
import ProcessTrainer from './ProcessTrainer.vue'
import TrainingCompass from './TrainingCompass.vue'
import TrainingUnitCard from './TrainingUnitCard.vue'
import TrainingUnitImporter from './TrainingUnitImporter.vue'
import { resolveMcQuestion, unitsForMethods, validateTrainingUnits } from './trainingUnits.js'
import { deleteMethodTrainerProgress, getMethodTrainerProgress, saveMethodTrainerProgress } from '../utils/learningProgress.js'
import sampleTrainingUnits from '../data/public/sampleTrainingUnits.json'

const props = defineProps({
  // Aktuell im Quiz-Bereich geladene MC-Fragen (privat importiert oder öffentliche
  // Demo-Bank) - dient ausschließlich dem MC-Abschluss-Resolver, wird hier nie kopiert.
  mcQuestions: {
    type: Array,
    default: () => [],
  },
  // Trainingseinheiten aus der zentralen Lernbibliotheken-Registry (App.vue).
  // Lebt oberhalb dieser Komponente und bleibt daher beim Tab-Wechsel
  // (Quiz <-> Methodentrainer, der diese Komponente neu montiert) erhalten.
  libraryTrainingUnits: {
    type: Array,
    default: () => [],
  },
  // Kombi-Fingerprint der aktuell geladenen Trainingseinheiten-Banken (App.vue,
  // combinedTrainingFingerprint) - Resume-Schlüssel für den Methodentrainer.
  // Bleibt null, solange keine private Bank geladen ist (Demo-Daten werden
  // bewusst nie persistiert, siehe learningProgress.js).
  trainerBankFingerprint: {
    type: String,
    default: null,
  },
  // Kombi-Fingerprint der aktuell geladenen MC-Fragenbanken (App.vue,
  // combinedMcFingerprint, identisch mit dem Quiz-Fingerprint) - Resume-
  // Schlüssel für das Mixed Transfer Exam, das denselben MC-Pool nutzt.
  mcSetFingerprint: {
    type: String,
    default: null,
  },
  // Von App.vue gesetzt, wenn über das Dashboard "Weiterlernen" für diesen
  // Bereich (methodTrainer oder mixedExam) angefordert wurde. Jede neue Anfrage
  // trägt eine eigene `nonce`, damit derselbe Bereich auch wiederholt angefragt
  // werden kann (Objektidentität statt Wertevergleich als Trigger).
  resumeRequest: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['learning-location', 'learning-location-cleared'])

// Öffentliche Demo-Einheiten laufen durch dieselbe Validierung wie private Importe.
const demoUnits = validateTrainingUnits(sampleTrainingUnits)

const METHOD_DEFINITIONS = [
  {
    key: 'duel',
    dataMethods: ['duel'],
    label: 'Abgrenzungsduell',
    description: 'Ähnliche, leicht verwechselbare Konzepte anhand des entscheidenden Merkmals sicher unterscheiden.',
    available: true,
  },
  {
    key: 'misconception',
    dataMethods: ['misconception'],
    label: 'Fehlerdetektiv',
    description: 'Plausibel klingende, aber fachlich falsche Aussagen erkennen - direkter Transfer zu MC-Distraktoren.',
    available: true,
  },
  {
    key: 'case',
    dataMethods: ['case'],
    label: 'Fall-Entscheider',
    description: 'Aus einer neuen Unternehmenssituation die passende Marketingentscheidung ableiten.',
    available: true,
  },
  {
    key: 'assignment',
    dataMethods: ['assignment'],
    label: 'Drag-&-Drop-Strukturtrainer',
    description: 'Konzepte den richtigen Ober- und Unterkategorien zuordnen - per Tippen oder Ziehen.',
    available: true,
  },
  {
    key: 'matrix',
    dataMethods: ['matrix', 'process'],
    label: 'Matrix-/Prozess-Trainer',
    description: 'Modelle und Abläufe aktiv rekonstruieren und anwenden.',
    available: true,
  },
  {
    key: 'mixedExam',
    dataMethods: [],
    label: 'Mixed Transfer Exam',
    description: 'Gemischte, klausurnahe Prüfungssimulation ohne Themenhinweis.',
    available: true,
  },
]

const COMPASS_OVERVIEW = ['Marketingmix', 'Produktpolitik / Preispolitik / Kommunikationspolitik / Vertriebspolitik']

const mode = ref('learn')
const privateUnits = ref([])
const privateFileName = ref(null)
const importer = ref(null)
const importNotice = ref('')

const activeMethod = ref(null)
const sessionIndex = ref(0)
const sessionCompleted = ref(0)
const sessionCorrect = ref(0)
const completedUnitIds = ref([])
const mixedExamRef = ref(null)

// Resume-Checkpoint für den Methodentrainer - nur vorhanden, wenn eine private
// Trainingseinheiten-Bank geladen ist (Demo-Sitzungen werden nie persistiert,
// siehe Datenschutz-Regressionstest in App.test.js).
const methodTrainerCheckpoint = ref(null)
function refreshMethodTrainerCheckpoint() {
  methodTrainerCheckpoint.value = props.trainerBankFingerprint ? getMethodTrainerProgress(props.trainerBankFingerprint) : null
}
watch(() => props.trainerBankFingerprint, refreshMethodTrainerCheckpoint, { immediate: true })

const resumableUnitLabel = computed(() => {
  const checkpoint = methodTrainerCheckpoint.value
  if (!checkpoint) return null
  return METHOD_DEFINITIONS.find((m) => m.dataMethods.includes(checkpoint.method))?.label ?? null
})

// Steuert, ob gerade eine Trainingseinheit oder - dazwischengeschaltet - deren
// aufgelöste MC-Abschlussfrage angezeigt wird.
const sessionStage = ref('unit') // 'unit' | 'mcQuestion' | 'mcNotFound'
const resolvedMcQuestion = ref(null)

// Priorität: zentrale Lernbibliothek (überlebt den Tab-Wechsel) > lokaler
// Einzelimport dieser Komponente (bleibt aus Kompatibilitätsgründen bestehen,
// geht aber wie bisher beim Neu-Mounten verloren) > öffentliche Demo-Daten.
const allUnits = computed(() => {
  if (props.libraryTrainingUnits.length > 0) return props.libraryTrainingUnits
  if (privateUnits.value.length > 0) return privateUnits.value
  return demoUnits
})
const isUsingPrivateData = computed(() => allUnits.value !== demoUnits)

function unitsFor(methodKey) {
  const def = METHOD_DEFINITIONS.find((m) => m.key === methodKey)
  if (!def) return []
  return unitsForMethods(allUnits.value, def.dataMethods, mode.value)
}

const currentUnits = computed(() => (activeMethod.value ? unitsFor(activeMethod.value) : []))
const currentUnit = computed(() => currentUnits.value[sessionIndex.value] ?? null)
const isSessionComplete = computed(() => Boolean(activeMethod.value) && currentUnits.value.length > 0 && sessionIndex.value >= currentUnits.value.length)
const activeMethodLabel = computed(() => METHOD_DEFINITIONS.find((m) => m.key === activeMethod.value)?.label ?? '')

const trainerComponent = computed(() => {
  if (!currentUnit.value) return null
  switch (currentUnit.value.method) {
    case 'assignment': return AssignmentTrainer
    case 'matrix': return MatrixTrainer
    case 'process': return ProcessTrainer
    default: return TrainingUnitCard
  }
})

// Persistiert ausschließlich technische Metadaten (Methode, TrainingUnit-ID,
// Modus, Position, Zähler) - nie den Inhalt der aktuellen Einheit. Greift nur,
// wenn eine private Trainingseinheiten-Bank geladen ist.
function persistMethodTrainerProgress() {
  if (!props.trainerBankFingerprint || !currentUnit.value) return
  saveMethodTrainerProgress(props.trainerBankFingerprint, {
    method: currentUnit.value.method,
    unitId: currentUnit.value.id,
    mode: mode.value,
    sessionIndex: sessionIndex.value,
    sessionCompleted: sessionCompleted.value,
    sessionCorrect: sessionCorrect.value,
    completedUnitIds: completedUnitIds.value,
    lastAccessedAt: new Date().toISOString(),
  })
  refreshMethodTrainerCheckpoint()
  const tile = METHOD_DEFINITIONS.find((m) => m.key === activeMethod.value)
  emit('learning-location', {
    area: 'methodTrainer',
    setFingerprint: props.trainerBankFingerprint,
    subArea: tile?.key ?? null,
    itemId: currentUnit.value.id,
    position: sessionIndex.value + 1,
    total: currentUnits.value.length,
    mode: mode.value,
  })
}

function startMethod(methodKey) {
  activeMethod.value = methodKey
  sessionIndex.value = 0
  sessionCompleted.value = 0
  sessionCorrect.value = 0
  completedUnitIds.value = []
  sessionStage.value = 'unit'
  resolvedMcQuestion.value = null
  persistMethodTrainerProgress()
}

// Setzt eine zuvor gespeicherte Methodentrainer-Sitzung fort: springt direkt zur
// gemerkten Methode/Unit-ID/Modus/Position statt zur Methodenübersicht. Findet
// sich die Unit-ID nicht mehr im aktuellen Bestand (z. B. andere Bank geladen),
// wird kein falscher Zustand erzeugt - stattdessen bei Aufgabe 1 begonnen.
function resumeFromCheckpoint() {
  const checkpoint = methodTrainerCheckpoint.value
  if (!checkpoint) return
  const tile = METHOD_DEFINITIONS.find((m) => m.dataMethods.includes(checkpoint.method))
  if (!tile) return
  activeMethod.value = tile.key
  mode.value = checkpoint.mode
  const units = unitsFor(tile.key)
  const unitIndex = units.findIndex((unit) => unit.id === checkpoint.unitId)
  sessionIndex.value = unitIndex >= 0 ? unitIndex : 0
  sessionCompleted.value = checkpoint.sessionCompleted
  sessionCorrect.value = checkpoint.sessionCorrect
  completedUnitIds.value = checkpoint.completedUnitIds
  sessionStage.value = 'unit'
  resolvedMcQuestion.value = null
}

watch(
  () => props.resumeRequest,
  async (request) => {
    if (!request) return
    await nextTick()
    if (request.area === 'methodTrainer') {
      resumeFromCheckpoint()
    } else if (request.area === 'mixedExam') {
      activeMethod.value = 'mixedExam'
      await nextTick()
      mixedExamRef.value?.resumeExam()
    }
  },
  { immediate: true },
)

function backToOverview() {
  activeMethod.value = null
}

function handleModeChange(newMode) {
  mode.value = newMode
  // Der Modus steuert, welche Hilfen sichtbar sind - beim Wechsel mitten in einer
  // Sitzung wird die aktuelle Methode sauber neu gestartet statt inkonsistent fortgesetzt.
  if (activeMethod.value) startMethod(activeMethod.value)
}

function handleCompleted({ correct }) {
  sessionCompleted.value++
  if (correct) sessionCorrect.value++
  if (currentUnit.value && !completedUnitIds.value.includes(currentUnit.value.id)) {
    completedUnitIds.value = [...completedUnitIds.value, currentUnit.value.id]
  }
  persistMethodTrainerProgress()
}

// Zentraler MC-Abschluss-Resolver: wird nur hier ausgewertet, die einzelnen
// Trainer-Komponenten kennen mcQuestionReference nicht - eine Stelle, keine
// zweite Quizengine.
function handleAdvance() {
  const reference = currentUnit.value?.mcQuestionReference
  if (reference) {
    const match = resolveMcQuestion(props.mcQuestions, reference)
    if (match) {
      resolvedMcQuestion.value = match
      sessionStage.value = 'mcQuestion'
      return
    }
    sessionStage.value = 'mcNotFound'
    return
  }
  goToNextUnit()
}

// Räumt Checkpoint und globalen Zeiger auf, wenn eine Methodentrainer-Sitzung
// vollständig durchgespielt wurde - eine abgeschlossene Sitzung ist nicht mehr
// "laufend" und darf beim nächsten Öffnen nicht mehr die zuletzt gesehene Unit
// erneut anbieten (Codex Delta Review, Finding M-3; analog zu Mixed Exam).
function completeMethodTrainerSession() {
  if (!props.trainerBankFingerprint) return
  deleteMethodTrainerProgress(props.trainerBankFingerprint)
  refreshMethodTrainerCheckpoint()
  emit('learning-location-cleared', { area: 'methodTrainer', setFingerprint: props.trainerBankFingerprint })
}

function goToNextUnit() {
  sessionIndex.value++
  sessionStage.value = 'unit'
  resolvedMcQuestion.value = null
  if (isSessionComplete.value) {
    completeMethodTrainerSession()
  } else {
    persistMethodTrainerProgress()
  }
}

function onUnitsLoaded({ units, fileName }) {
  privateUnits.value = units
  privateFileName.value = fileName
  importNotice.value = `${units.length} eigene Trainingseinheiten aus "${fileName}" geladen.`
  activeMethod.value = null
}

// Springt vom Mixed-Transfer-Exam-Review aus gezielt zu der Methode, die laut
// bestehender mcQuestionReference zu einer falsch beantworteten Frage gehört.
function handleOpenMethodFromExam(dataMethod) {
  const tile = METHOD_DEFINITIONS.find((m) => m.dataMethods.includes(dataMethod))
  if (tile) startMethod(tile.key)
}

defineExpose({ resumeFromCheckpoint })
</script>

<template>
  <section class="method-trainer" aria-label="Methodentrainer">
    <header class="method-trainer-header">
      <h2>Methodentrainer</h2>
      <p>
        Anwendungsorientiertes Training für die MC-Klausur: entscheidendes Merkmal erkennen,
        Konzepte abgrenzen, Distraktoren durchschauen.
      </p>
    </header>

    <TrainingCompass :path="COMPASS_OVERVIEW" />

    <ModeSwitcher :model-value="mode" @update:model-value="handleModeChange" />

    <TrainingUnitImporter ref="importer" @units-loaded="onUnitsLoaded" />
    <p v-if="importNotice" class="import-notice" role="status">{{ importNotice }}</p>
    <p class="question-bank-label">
      <template v-if="libraryTrainingUnits.length > 0">Eigene Trainingsdaten: {{ libraryTrainingUnits.length }} Einheiten aus der Lernbibliothek</template>
      <template v-else-if="isUsingPrivateData">Eigene Trainingsdaten: {{ privateFileName }}</template>
      <template v-else>Öffentliche Beispiel-Trainingseinheiten</template>
    </p>

    <section v-if="!activeMethod" class="method-picker" aria-label="Trainingsmethode wählen">
      <section v-if="methodTrainerCheckpoint" class="trainer-resume-card" aria-label="Methodentrainer fortsetzen">
        <p class="eyebrow">Weiterlernen</p>
        <p>{{ resumableUnitLabel }} · Aufgabe {{ methodTrainerCheckpoint.sessionIndex + 1 }}</p>
        <button class="primary-button" type="button" @click="resumeFromCheckpoint">Weiterlernen</button>
      </section>

      <button
        v-for="methodDef in METHOD_DEFINITIONS"
        :key="methodDef.key"
        type="button"
        class="method-tile"
        :class="[`method-tile-${methodDef.key}`, { 'method-tile-disabled': !methodDef.available }]"
        :disabled="!methodDef.available"
        @click="startMethod(methodDef.key)"
      >
        <h3>{{ methodDef.label }}</h3>
        <p>{{ methodDef.description }}</p>
        <span v-if="methodDef.key === 'mixedExam'" class="method-tile-badge">
          {{ Math.min(10, mcQuestions.length) }} von {{ mcQuestions.length }} Fragen je Durchlauf
        </span>
        <span v-else-if="methodDef.available" class="method-tile-badge">
          {{ unitsFor(methodDef.key).length }} Einheiten im {{ mode === 'learn' ? 'Lernen' : mode === 'apply' ? 'Anwenden' : 'Prüfungs' }}-Modus
        </span>
        <span v-else class="method-tile-badge method-tile-badge-soon">bald verfügbar</span>
      </button>
    </section>

    <MixedExam
      v-else-if="activeMethod === 'mixedExam'"
      ref="mixedExamRef"
      :mc-questions="mcQuestions"
      :all-units="allUnits"
      :set-fingerprint="mcSetFingerprint"
      @back="backToOverview"
      @open-method="handleOpenMethodFromExam"
      @learning-location="emit('learning-location', $event)"
      @learning-location-cleared="emit('learning-location-cleared', $event)"
    />

    <section v-else-if="currentUnit && sessionStage === 'unit'" class="quiz-layout">
      <aside class="score-card" aria-label="Sitzungsfortschritt">
        <h2>{{ activeMethodLabel }}</h2>
        <p>Aufgabe {{ sessionIndex + 1 }} von {{ currentUnits.length }}</p>
        <p>Richtig: <strong>{{ sessionCorrect }}</strong> / {{ sessionCompleted }}</p>
        <button class="secondary-button" type="button" @click="backToOverview">Andere Methode wählen</button>
      </aside>

      <component
        :is="trainerComponent"
        :unit="currentUnit"
        :mode="mode"
        @completed="handleCompleted"
        @advance="handleAdvance"
      />
    </section>

    <section v-else-if="sessionStage === 'mcQuestion' && resolvedMcQuestion" class="quiz-layout">
      <aside class="score-card" aria-label="Sitzungsfortschritt">
        <h2>{{ activeMethodLabel }}</h2>
        <p>Aufgabe {{ sessionIndex + 1 }} von {{ currentUnits.length }}</p>
        <p>Richtig: <strong>{{ sessionCorrect }}</strong> / {{ sessionCompleted }}</p>
        <button class="secondary-button" type="button" @click="backToOverview">Andere Methode wählen</button>
      </aside>

      <McResolverCard :mc-question="resolvedMcQuestion" @continue="goToNextUnit" />
    </section>

    <section v-else-if="sessionStage === 'mcNotFound'" class="quiz-layout">
      <aside class="score-card" aria-label="Sitzungsfortschritt">
        <h2>{{ activeMethodLabel }}</h2>
        <p>Aufgabe {{ sessionIndex + 1 }} von {{ currentUnits.length }}</p>
        <p>Richtig: <strong>{{ sessionCorrect }}</strong> / {{ sessionCompleted }}</p>
        <button class="secondary-button" type="button" @click="backToOverview">Andere Methode wählen</button>
      </aside>

      <section class="question-card">
        <h2>Keine passende Klausurfrage gefunden</h2>
        <p>
          Für dieses Thema ist in deiner aktuell geladenen Fragebank aktuell keine passende
          MC-Frage verfügbar. Das Training bleibt trotzdem nutzbar.
        </p>
        <button class="primary-button" type="button" @click="goToNextUnit">Weiter</button>
      </section>
    </section>

    <section v-else-if="isSessionComplete" class="result-card">
      <p class="eyebrow">{{ activeMethodLabel }} abgeschlossen</p>
      <h2>Sitzung ausgewertet</h2>
      <div class="result-grid" aria-label="Sitzungsergebnis">
        <div>
          <span>Aufgaben</span>
          <strong>{{ sessionCompleted }}</strong>
        </div>
        <div>
          <span>Richtig</span>
          <strong>{{ sessionCorrect }}</strong>
        </div>
      </div>
      <div class="result-actions">
        <button class="primary-button" type="button" @click="startMethod(activeMethod)">Nochmal</button>
        <button class="secondary-button" type="button" @click="backToOverview">Andere Methode wählen</button>
      </div>
    </section>

    <section v-else class="question-card">
      <h2>Keine Trainingseinheiten verfügbar</h2>
      <p>Für diese Methode liegen im aktuellen Modus aktuell keine Einheiten vor.</p>
      <button class="secondary-button" type="button" @click="backToOverview">Zurück</button>
    </section>
  </section>
</template>
