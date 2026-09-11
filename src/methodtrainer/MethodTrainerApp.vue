<script setup>
import { computed, ref } from 'vue'
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
import sampleTrainingUnits from '../data/public/sampleTrainingUnits.json'

const props = defineProps({
  // Aktuell im Quiz-Bereich geladene MC-Fragen (privat importiert oder öffentliche
  // Demo-Bank) - dient ausschließlich dem MC-Abschluss-Resolver, wird hier nie kopiert.
  mcQuestions: {
    type: Array,
    default: () => [],
  },
})

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

// Steuert, ob gerade eine Trainingseinheit oder - dazwischengeschaltet - deren
// aufgelöste MC-Abschlussfrage angezeigt wird.
const sessionStage = ref('unit') // 'unit' | 'mcQuestion' | 'mcNotFound'
const resolvedMcQuestion = ref(null)

const allUnits = computed(() => (privateUnits.value.length > 0 ? privateUnits.value : demoUnits))
const isUsingPrivateData = computed(() => privateUnits.value.length > 0)

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

function startMethod(methodKey) {
  activeMethod.value = methodKey
  sessionIndex.value = 0
  sessionCompleted.value = 0
  sessionCorrect.value = 0
  sessionStage.value = 'unit'
  resolvedMcQuestion.value = null
}

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

function goToNextUnit() {
  sessionIndex.value++
  sessionStage.value = 'unit'
  resolvedMcQuestion.value = null
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
      {{ isUsingPrivateData ? `Eigene Trainingsdaten: ${privateFileName}` : 'Öffentliche Beispiel-Trainingseinheiten' }}
    </p>

    <section v-if="!activeMethod" class="method-picker" aria-label="Trainingsmethode wählen">
      <button
        v-for="methodDef in METHOD_DEFINITIONS"
        :key="methodDef.key"
        type="button"
        class="method-tile"
        :class="{ 'method-tile-disabled': !methodDef.available }"
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
      :mc-questions="mcQuestions"
      :all-units="allUnits"
      @back="backToOverview"
      @open-method="handleOpenMethodFromExam"
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
