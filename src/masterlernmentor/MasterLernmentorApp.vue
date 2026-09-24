<script setup>
// Master-Lernmentor: systematisches Durcharbeiten des eingefrorenen privaten
// Content-Goldstandards - erst lesen (learningPhase), dann offen abfragen
// (Freitext), dann mit derselben Masterstelle abgleichen. Topics/Fragen laufen
// strikt in Master-Reihenfolge, kein Shuffling (siehe Aufgabenstellung
// Abschnitt 10). Freitext bleibt ausschließlich lokaler Komponentenstate -
// nie Teil von persistProgress().
import { computed, ref, watch } from 'vue'
import MasterLernmentorImporter from './MasterLernmentorImporter.vue'
import MasterContentRenderer from './MasterContentRenderer.vue'
import { checkAnswer } from '../utils/masterLernmentorMatcher.js'
import { normalizeResumeCheckpoint } from '../utils/masterLernmentorValidator.js'
import { getMasterLearnProgress, saveMasterLearnProgress } from '../utils/learningProgress.js'

const props = defineProps({
  // { data, fingerprint, fileName } | null - lebt auf App-Ebene (übersteht
  // Tab-Wechsel), wird hier nie kopiert/dupliziert gehalten.
  bank: { type: Object, default: null },
  // { nonce } - vom Dashboard über "Weiterlernen" ausgelöste einmalige
  // Sprung-Anweisung (analog zu MethodTrainerApp resumeRequest).
  resumeRequest: { type: Object, default: null },
})

const emit = defineEmits(['bank-loaded', 'learning-location', 'learning-location-cleared'])

const SELF_RATING_OPTIONS = [
  { code: 'green', icon: '🟢', label: 'Sicher' },
  { code: 'yellow', icon: '🟡', label: 'Teilweise' },
  { code: 'red', icon: '🔴', label: 'Noch lernen' },
]

// 'chapters' | 'topicIntro' | 'learningPhase' | 'question' | 'topicComplete'
const screen = ref('chapters')
const currentTopicPointerIndex = ref(0)
const currentQuestionIndex = ref(0)

const topicsSeen = ref([])
const completedTopicIds = ref([])
const selfRatings = ref({})
const isComplete = ref(false)

// Rein lokaler UI-Zustand für die aktuelle Frage - nie Teil von
// saveMasterLearnProgress(), wird bei jedem Fragen-/Topicwechsel verworfen.
const freeText = ref('')
const showHint = ref(false)
const checkResult = ref(null)
const showMasterExcerpt = ref(false)
const showLearningPhaseOverlay = ref(false)

const flatTopics = computed(() => {
  if (!props.bank) return []
  return props.bank.data.chapters.flatMap((chapter) => chapter.topics.map((topic) => ({
    ...topic,
    chapterId: chapter.chapterId,
    chapterNumber: chapter.chapterNumber,
    chapterTitle: chapter.chapterTitle,
  })))
})

const currentTopic = computed(() => flatTopics.value[currentTopicPointerIndex.value] ?? null)
const currentQuestion = computed(() => currentTopic.value?.questions[currentQuestionIndex.value] ?? null)

const totalTopics = computed(() => flatTopics.value.length)
const overallProgressPercent = computed(() => (totalTopics.value === 0 ? 0 : Math.round((completedTopicIds.value.length / totalTopics.value) * 100)))

function topicsOfChapter(chapterId) {
  return flatTopics.value.filter((topic) => topic.chapterId === chapterId)
}

function chapterProgressPercent(chapterId) {
  const topics = topicsOfChapter(chapterId)
  if (topics.length === 0) return 0
  const done = topics.filter((topic) => completedTopicIds.value.includes(topic.topicId)).length
  return Math.round((done / topics.length) * 100)
}

const chapterOverview = computed(() => {
  if (!props.bank) return []
  return props.bank.data.chapters.map((chapter) => {
    const topics = chapter.topics
    const questionCount = topics.reduce((sum, topic) => sum + topic.questions.length, 0)
    return {
      chapterId: chapter.chapterId,
      chapterNumber: chapter.chapterNumber,
      chapterTitle: chapter.chapterTitle,
      topicCount: topics.length,
      questionCount,
      progressPercent: chapterProgressPercent(chapter.chapterId),
      hasCheckpointHere: masterLearnCheckpoint.value?.currentChapterId === chapter.chapterId && !isComplete.value,
    }
  })
})

const currentTopicIndexInChapter = computed(() => {
  if (!currentTopic.value) return 0
  return topicsOfChapter(currentTopic.value.chapterId).findIndex((topic) => topic.topicId === currentTopic.value.topicId)
})

const currentSelfRating = computed(() => (currentQuestion.value ? selfRatings.value[currentQuestion.value.questionId] ?? null : null))

function resetEphemeralQuestionState() {
  freeText.value = ''
  showHint.value = false
  checkResult.value = null
  showMasterExcerpt.value = false
  showLearningPhaseOverlay.value = false
}

function persistProgress() {
  if (!props.bank || !currentTopic.value) return
  const topic = currentTopic.value
  saveMasterLearnProgress(props.bank.fingerprint, {
    bankFileName: props.bank.fileName,
    currentChapterId: topic.chapterId,
    currentTopicId: topic.topicId,
    currentQuestionId: screen.value === 'question' || screen.value === 'topicComplete' ? (currentQuestion.value?.questionId ?? null) : null,
    currentQuestionIndex: currentQuestionIndex.value,
    topicsSeen: topicsSeen.value,
    completedTopicIds: completedTopicIds.value,
    selfRatings: selfRatings.value,
    isComplete: isComplete.value,
    lastAccessedAt: new Date().toISOString(),
  })
  refreshCheckpoint()
  emit('learning-location', {
    area: 'masterLearn',
    setFingerprint: props.bank.fingerprint,
    subArea: topic.chapterId,
    itemId: topic.topicId,
    position: currentTopicPointerIndex.value + 1,
    total: totalTopics.value,
    mode: null,
  })
}

// Liest den gespeicherten Checkpoint und normalisiert ihn sofort gegen die
// tatsächlich geladene Bank (Codex Technical Red Team, Finding m-01/MINOR) -
// unbekannte IDs/Positionen werden nie blind übernommen (siehe
// normalizeResumeCheckpoint in masterLernmentorValidator.js). Weicht das
// Ergebnis vom gespeicherten Rohzustand ab, wird der bereinigte Checkpoint
// zurückgeschrieben ("self-healing"), damit auch andere Stellen (z.B. die
// Dashboard-Fortschrittskachel in App.vue), die denselben Storage-Key lesen,
// nie wieder die unbereinigten Werte sehen.
function loadNormalizedCheckpoint() {
  if (!props.bank) return null
  const raw = getMasterLearnProgress(props.bank.fingerprint)
  if (!raw) return null
  const normalized = normalizeResumeCheckpoint(props.bank.data, raw)
  if (!normalized) return null
  if (JSON.stringify(normalized) !== JSON.stringify(raw)) {
    saveMasterLearnProgress(props.bank.fingerprint, normalized)
  }
  return normalized
}

const masterLearnCheckpoint = ref(null)
function refreshCheckpoint() {
  masterLearnCheckpoint.value = loadNormalizedCheckpoint()
}

function loadStateFromCheckpoint(checkpoint) {
  topicsSeen.value = checkpoint ? [...checkpoint.topicsSeen] : []
  completedTopicIds.value = checkpoint ? [...checkpoint.completedTopicIds] : []
  selfRatings.value = checkpoint ? { ...checkpoint.selfRatings } : {}
  isComplete.value = checkpoint ? checkpoint.isComplete : false
}

// Bank kommt/wechselt (Import oder App-Ebene-Prop-Update) - lädt zugehörigen
// Checkpoint (falls Fingerprint passt) und startet an der Kapitelübersicht.
watch(
  () => props.bank,
  (bank) => {
    if (!bank) return
    const checkpoint = loadNormalizedCheckpoint()
    masterLearnCheckpoint.value = checkpoint
    loadStateFromCheckpoint(checkpoint)
    currentTopicPointerIndex.value = 0
    currentQuestionIndex.value = 0
    screen.value = 'chapters'
    resetEphemeralQuestionState()
  },
  { immediate: true },
)

function enterTopicByFlatIndex(index, { forceLearningPhase = false } = {}) {
  if (index < 0 || index >= flatTopics.value.length) return
  currentTopicPointerIndex.value = index
  currentQuestionIndex.value = 0
  resetEphemeralQuestionState()
  const topic = flatTopics.value[index]
  screen.value = !forceLearningPhase && topicsSeen.value.includes(topic.topicId) ? 'topicIntro' : 'learningPhase'
  persistProgress()
}

function openChapter(chapterId) {
  const topics = topicsOfChapter(chapterId)
  if (topics.length === 0) return
  let target = topics[0]
  const checkpoint = masterLearnCheckpoint.value
  if (checkpoint && checkpoint.currentChapterId === chapterId && !completedTopicIds.value.includes(checkpoint.currentTopicId)) {
    const checkpointTopic = topics.find((topic) => topic.topicId === checkpoint.currentTopicId)
    if (checkpointTopic) target = checkpointTopic
  }
  const index = flatTopics.value.findIndex((topic) => topic.topicId === target.topicId)
  enterTopicByFlatIndex(index)
}

function resumeFromCheckpoint() {
  if (!props.bank) return
  const checkpoint = loadNormalizedCheckpoint()
  if (!checkpoint) return
  const index = flatTopics.value.findIndex((topic) => topic.topicId === checkpoint.currentTopicId)
  if (index < 0) {
    screen.value = 'chapters'
    return
  }
  currentTopicPointerIndex.value = index
  currentQuestionIndex.value = checkpoint.currentQuestionIndex
  resetEphemeralQuestionState()
  screen.value = checkpoint.currentQuestionId ? 'question' : 'learningPhase'
}

watch(
  () => props.resumeRequest,
  (request) => {
    if (!request || !props.bank) return
    resumeFromCheckpoint()
  },
  { immediate: true },
)

function chooseRereadLearningPhase() {
  screen.value = 'learningPhase'
}

function chooseSkipToQuestions() {
  screen.value = 'question'
  currentQuestionIndex.value = 0
  resetEphemeralQuestionState()
  persistProgress()
}

function markLearningPhaseReadAndAskNow() {
  if (currentTopic.value) topicsSeen.value = [...new Set([...topicsSeen.value, currentTopic.value.topicId])]
  screen.value = 'question'
  currentQuestionIndex.value = 0
  resetEphemeralQuestionState()
  persistProgress()
}

function checkCurrentAnswer() {
  if (!currentQuestion.value) return
  checkResult.value = checkAnswer(currentQuestion.value, freeText.value)
}

function setSelfRating(code) {
  if (!currentQuestion.value) return
  selfRatings.value = { ...selfRatings.value, [currentQuestion.value.questionId]: code }
  persistProgress()
}

function nextQuestion() {
  const topic = currentTopic.value
  if (!topic) return
  if (currentQuestionIndex.value < topic.questions.length - 1) {
    currentQuestionIndex.value++
    resetEphemeralQuestionState()
    persistProgress()
  } else {
    completedTopicIds.value = [...new Set([...completedTopicIds.value, topic.topicId])]
    screen.value = 'topicComplete'
    resetEphemeralQuestionState()
    persistProgress()
  }
}

function nextTopic() {
  const nextIndex = currentTopicPointerIndex.value + 1
  if (nextIndex < flatTopics.value.length) {
    enterTopicByFlatIndex(nextIndex)
  } else {
    isComplete.value = true
    screen.value = 'chapters'
    persistProgress()
  }
}

function backToChapters() {
  screen.value = 'chapters'
}

function onBankLoaded(payload) {
  emit('bank-loaded', payload)
}

const importerRef = ref(null)
defineExpose({ openFilePicker: () => importerRef.value?.openFilePicker() })
</script>

<template>
  <section class="master-lernmentor" aria-label="Master-Lernmentor">
    <header class="method-trainer-header">
      <h2>Master-Lernmentor</h2>
      <p>Der komplette Master, in eigenen Worten – Kapitel für Kapitel.</p>
    </header>

    <MasterLernmentorImporter v-if="!bank" ref="importerRef" @bank-loaded="onBankLoaded" />

    <template v-else>
      <p class="question-bank-label">Master-Lernmentor-Bank: {{ bank.fileName }}</p>

      <!-- Kapitelübersicht -->
      <section v-if="screen === 'chapters'" class="chapter-overview" aria-label="Kapitelübersicht">
        <p class="master-progress-summary">Master gelernt: {{ overallProgressPercent }} %</p>
        <div class="chapter-grid">
          <article v-for="chapter in chapterOverview" :key="chapter.chapterId" class="chapter-card">
            <p class="eyebrow">Kapitel {{ chapter.chapterNumber }}</p>
            <h3>{{ chapter.chapterTitle }}</h3>
            <p>{{ chapter.topicCount }} Themen · {{ chapter.questionCount }} Fragen</p>
            <p class="chapter-progress-label">Lernfortschritt: {{ chapter.progressPercent }} %</p>
            <div class="result-actions">
              <button v-if="chapter.hasCheckpointHere" class="primary-button" type="button" @click="openChapter(chapter.chapterId)">
                Weiterlernen
              </button>
              <button v-else class="secondary-button" type="button" @click="openChapter(chapter.chapterId)">
                Kapitel öffnen
              </button>
            </div>
          </article>
        </div>
      </section>

      <!-- Wiederholungs-Auswahl für bereits gelesene Topics -->
      <section v-else-if="screen === 'topicIntro' && currentTopic" class="topic-intro-card" aria-label="Topic-Einstieg">
        <p class="eyebrow">{{ currentTopic.topicNumber }}</p>
        <h3>{{ currentTopic.topicTitle }}</h3>
        <p>Du hast diesen Lernabschnitt bereits gelesen.</p>
        <div class="result-actions">
          <button class="secondary-button" type="button" @click="chooseRereadLearningPhase">Lernabschnitt noch einmal lesen</button>
          <button class="primary-button" type="button" @click="chooseSkipToQuestions">Dieses Thema kenne ich schon – direkt zur Abfrage</button>
        </div>
      </section>

      <!-- Lernphase: Input before Retrieval -->
      <section v-else-if="screen === 'learningPhase' && currentTopic" class="learning-phase-card" aria-label="Lernabschnitt">
        <p class="eyebrow">{{ currentTopic.topicNumber }}</p>
        <h3>{{ currentTopic.topicTitle }}</h3>
        <MasterContentRenderer :content="currentTopic.learningPhase.masterContent" :visual-assets="currentTopic.visualAssets || []" />
        <div class="result-actions">
          <button class="primary-button" type="button" @click="markLearningPhaseReadAndAskNow">Ich habe es gelesen – jetzt abfragen</button>
        </div>
      </section>

      <!-- Fragenansicht -->
      <section v-else-if="screen === 'question' && currentTopic && currentQuestion" class="quiz-layout">
        <aside class="score-card" aria-label="Fortschritt">
          <h2>{{ currentTopic.chapterTitle }}</h2>
          <p>{{ currentTopic.topicNumber }} {{ currentTopic.topicTitle }}</p>
          <p>Frage {{ currentQuestionIndex + 1 }} von {{ currentTopic.questions.length }}</p>
          <p>Topic {{ currentTopicIndexInChapter + 1 }} von {{ topicsOfChapter(currentTopic.chapterId).length }} im Kapitel</p>
          <p>Gesamt-Master-Fortschritt: {{ overallProgressPercent }} %</p>
          <button class="secondary-button" type="button" @click="backToChapters">Zur Kapitelübersicht</button>
        </aside>

        <section class="question-card">
          <p v-if="currentQuestion.answerFlexibility?.caseBound" class="case-bound-note" role="note">
            Diese Frage bezieht sich auf den im Text konkret genannten Fall.
          </p>
          <h2>{{ currentQuestion.question }}</h2>

          <details class="master-excerpt-details">
            <summary>Lernabschnitt erneut ansehen</summary>
            <MasterContentRenderer :content="currentTopic.learningPhase.masterContent" :visual-assets="currentTopic.visualAssets || []" />
          </details>

          <details class="master-excerpt-details">
            <summary>Passende Stelle im Master</summary>
            <MasterContentRenderer :content="currentQuestion.masterExcerpt" :visual-assets="currentTopic.visualAssets || []" />
          </details>

          <div class="freetext-field">
            <label :for="`freetext-${currentQuestion.questionId}`">Deine Antwort</label>
            <textarea
              :id="`freetext-${currentQuestion.questionId}`"
              v-model="freeText"
              rows="6"
              placeholder="Formuliere deine Antwort in eigenen Worten…"
            ></textarea>
          </div>

          <div class="result-actions">
            <button class="secondary-button" type="button" :aria-expanded="showHint" @click="showHint = !showHint">
              {{ showHint ? 'Hinweis ausblenden' : 'Hinweis anzeigen' }}
            </button>
            <button class="primary-button" type="button" @click="checkCurrentAnswer">
              {{ checkResult ? 'Noch einmal prüfen' : 'Antwort prüfen' }}
            </button>
          </div>

          <p v-if="showHint && currentQuestion.hint" class="hint-box">{{ currentQuestion.hint }}</p>

          <section v-if="checkResult" class="answer-check-result" aria-label="Antwortprüfung">
            <p class="learning-hint-label">Automatische Erkennung = Lernhilfe</p>

            <div class="core-concept-list">
              <p>Erkannte Kernpunkte: {{ checkResult.matchedCoreCount }} von {{ checkResult.totalCoreCount }}</p>
              <ul>
                <li v-for="concept in checkResult.coreConcepts" :key="concept.conceptId" :class="concept.matched ? 'concept-matched' : 'concept-open'">
                  <span aria-hidden="true">{{ concept.matched ? '✓' : '○' }}</span>
                  <span>{{ concept.label }}</span>
                  <span class="concept-status-text">{{ concept.matched ? '(erkannt)' : '(noch nicht erkannt)' }}</span>
                </li>
              </ul>
              <p v-if="checkResult.requiresAllCoreConcepts && !checkResult.allCoreConceptsMatched" class="concept-requirement-hint">
                Diese Frage möchte, dass alle oben gelisteten Kernpunkte vorkommen - bisher {{ checkResult.matchedCoreCount }} von {{ checkResult.totalCoreCount }} erkannt. Schau gern noch einmal in deine Antwort.
              </p>
            </div>

            <div v-if="checkResult.optionalConcepts.length" class="optional-concept-list">
              <p>Zusätzlich möglich:</p>
              <ul>
                <li v-for="concept in checkResult.optionalConcepts" :key="concept.conceptId" :class="concept.matched ? 'concept-matched' : 'concept-open'">
                  <span aria-hidden="true">{{ concept.matched ? '✓' : '○' }}</span>
                  <span>{{ concept.label }}</span>
                </li>
              </ul>
            </div>

            <p v-for="(note, noteIndex) in checkResult.notes" :key="noteIndex" class="answer-flexibility-note">{{ note }}</p>

            <div class="model-answer-box">
              <p class="eyebrow">Kurze Musterantwort</p>
              <p>{{ currentQuestion.shortModelAnswer }}</p>
            </div>

            <fieldset class="self-rating-fieldset">
              <legend>Selbsteinschätzung</legend>
              <div class="self-rating-buttons">
                <button
                  v-for="option in SELF_RATING_OPTIONS"
                  :key="option.code"
                  type="button"
                  class="self-rating-button"
                  :class="{ 'self-rating-active': currentSelfRating === option.code }"
                  :aria-pressed="currentSelfRating === option.code"
                  @click="setSelfRating(option.code)"
                >
                  <span aria-hidden="true">{{ option.icon }}</span>
                  <span>{{ option.label }}</span>
                </button>
              </div>
            </fieldset>

            <div class="result-actions">
              <button class="primary-button" type="button" @click="nextQuestion">Nächste Frage</button>
            </div>
          </section>
        </section>
      </section>

      <!-- Topic-Abschluss -->
      <section v-else-if="screen === 'topicComplete' && currentTopic" class="result-card">
        <p class="eyebrow">Topic abgeschlossen</p>
        <h2>{{ currentTopic.topicTitle }}</h2>
        <p>Gesamt-Master-Fortschritt: {{ overallProgressPercent }} %</p>
        <div class="result-actions">
          <button class="primary-button" type="button" @click="nextTopic">Nächstes Unterthema</button>
          <button class="secondary-button" type="button" @click="backToChapters">Zur Kapitelübersicht</button>
        </div>
      </section>
    </template>
  </section>
</template>
