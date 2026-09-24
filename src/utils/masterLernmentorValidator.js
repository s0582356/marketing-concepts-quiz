// Schema-Validierung für die private Master-Lernmentor-Bank (eingefrorener
// Content-Goldstandard, siehe marketing_master_lernmentor_full_v1_1.json).
// Völlig eigenes Schema (ein Objekt mit "chapters", nicht ein Array wie MC-
// Fragen/Trainingseinheiten) - kollidiert daher nie mit looksLikeMcQuestions/
// looksLikeTrainingUnits in libraryImport.js und braucht eine eigene,
// inhaltsbasierte Erkennung.
//
// Validiert nur die Struktur, die die App zum Rendern/Abfragen braucht -
// verändert oder "repariert" niemals Inhalte. Eine strukturell ungültige
// Datei führt zu einer klaren Fehlermeldung, nie zu einem Absturz.

export function looksLikeMasterLernmentorBank(data) {
  return Boolean(data) && typeof data === 'object' && !Array.isArray(data) && Array.isArray(data.chapters)
}

function fail(message) {
  throw new Error(message)
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0
}

function validateConcept(concept, path) {
  if (!concept || typeof concept !== 'object') fail(`${path}: Konzept fehlt oder ist ungültig.`)
  if (!isNonEmptyString(concept.label)) fail(`${path}: "label" fehlt.`)
  if (!isNonEmptyString(concept.conceptId)) fail(`${path}: "conceptId" fehlt.`)
  if (concept.description !== undefined && typeof concept.description !== 'string') fail(`${path}: "description" muss Text sein.`)
  if (concept.acceptedPhrases !== undefined) {
    if (!Array.isArray(concept.acceptedPhrases) || !concept.acceptedPhrases.every((phrase) => typeof phrase === 'string')) {
      fail(`${path}: "acceptedPhrases" muss ein Array aus Texten sein.`)
    }
  }
}

function validateResponseRequirements(requirements, path) {
  if (!requirements || typeof requirements !== 'object') fail(`${path}: "responseRequirements" fehlt.`)
  if (typeof requirements.requiresAllCoreConcepts !== 'boolean') fail(`${path}: "requiresAllCoreConcepts" muss boolean sein.`)
  for (const key of ['minimumItems', 'minimumExamples', 'minimumExamplesPerGroup']) {
    const value = requirements[key]
    if (value !== null && value !== undefined && !(Number.isInteger(value) && value >= 0)) {
      fail(`${path}: "${key}" muss null oder eine nicht-negative Ganzzahl sein.`)
    }
  }
}

function validateAnswerFlexibility(flexibility, path) {
  if (!flexibility || typeof flexibility !== 'object') fail(`${path}: "answerFlexibility" fehlt.`)
  for (const key of ['wordingMatchRequired', 'equivalentOwnExamplesAllowed', 'caseBound']) {
    if (typeof flexibility[key] !== 'boolean') fail(`${path}: "${key}" muss boolean sein.`)
  }
}

function validateQuestion(question, path, seenQuestionIds) {
  if (!question || typeof question !== 'object') fail(`${path}: Frage fehlt oder ist ungültig.`)
  if (!isNonEmptyString(question.questionId)) fail(`${path}: "questionId" fehlt.`)
  if (seenQuestionIds.has(question.questionId)) fail(`${path}: doppelte questionId "${question.questionId}".`)
  seenQuestionIds.add(question.questionId)
  if (!isNonEmptyString(question.topicId)) fail(`${path}: "topicId" fehlt.`)
  if (!isNonEmptyString(question.question)) fail(`${path}: "question" fehlt.`)
  if (!isNonEmptyString(question.masterExcerpt)) fail(`${path}: "masterExcerpt" fehlt.`)
  if (!isNonEmptyString(question.shortModelAnswer)) fail(`${path}: "shortModelAnswer" fehlt.`)
  if (question.hint !== undefined && question.hint !== null && typeof question.hint !== 'string') fail(`${path}: "hint" muss Text sein.`)

  if (!Array.isArray(question.coreConcepts) || question.coreConcepts.length === 0) fail(`${path}: "coreConcepts" muss ein nicht-leeres Array sein.`)
  question.coreConcepts.forEach((concept, index) => validateConcept(concept, `${path}.coreConcepts[${index}]`))

  if (!Array.isArray(question.optionalConcepts)) fail(`${path}: "optionalConcepts" muss ein Array sein.`)
  question.optionalConcepts.forEach((concept, index) => validateConcept(concept, `${path}.optionalConcepts[${index}]`))

  validateResponseRequirements(question.responseRequirements, path)
  validateAnswerFlexibility(question.answerFlexibility, path)
}

function validateVisualAsset(asset, path) {
  if (!asset || typeof asset !== 'object') fail(`${path}: Visual-Asset ist ungültig.`)
  if (!isNonEmptyString(asset.assetId)) fail(`${path}: "assetId" fehlt.`)
}

function validateTopic(topic, chapterId, path, seenTopicIds, seenQuestionIds) {
  if (!topic || typeof topic !== 'object') fail(`${path}: Topic fehlt oder ist ungültig.`)
  if (!isNonEmptyString(topic.topicId)) fail(`${path}: "topicId" fehlt.`)
  if (seenTopicIds.has(topic.topicId)) fail(`${path}: doppelte topicId "${topic.topicId}".`)
  seenTopicIds.add(topic.topicId)
  if (!isNonEmptyString(topic.topicTitle)) fail(`${path}: "topicTitle" fehlt.`)
  if (topic.chapterId !== chapterId) fail(`${path}: "chapterId" (${topic.chapterId}) passt nicht zum umgebenden Kapitel (${chapterId}).`)

  const learningPhase = topic.learningPhase
  if (!learningPhase || typeof learningPhase !== 'object') fail(`${path}: "learningPhase" fehlt.`)
  if (!isNonEmptyString(learningPhase.masterContent)) fail(`${path}: "learningPhase.masterContent" fehlt.`)

  if (!Array.isArray(topic.questions) || topic.questions.length === 0) fail(`${path}: "questions" muss ein nicht-leeres Array sein.`)
  topic.questions.forEach((question, index) => validateQuestion(question, `${path}.questions[${index}]`, seenQuestionIds))

  if (topic.visualAssets !== undefined) {
    if (!Array.isArray(topic.visualAssets)) fail(`${path}: "visualAssets" muss ein Array sein.`)
    topic.visualAssets.forEach((asset, index) => validateVisualAsset(asset, `${path}.visualAssets[${index}]`))
  }
}

function validateChapter(chapter, path, seenChapterIds, seenTopicIds, seenQuestionIds) {
  if (!chapter || typeof chapter !== 'object') fail(`${path}: Kapitel fehlt oder ist ungültig.`)
  if (!isNonEmptyString(chapter.chapterId)) fail(`${path}: "chapterId" fehlt.`)
  if (seenChapterIds.has(chapter.chapterId)) fail(`${path}: doppelte chapterId "${chapter.chapterId}".`)
  seenChapterIds.add(chapter.chapterId)
  if (!isNonEmptyString(chapter.chapterTitle)) fail(`${path}: "chapterTitle" fehlt.`)
  if (!Array.isArray(chapter.topics) || chapter.topics.length === 0) fail(`${path}: "topics" muss ein nicht-leeres Array sein.`)
  chapter.topics.forEach((topic, index) => validateTopic(topic, chapter.chapterId, `${path}.topics[${index}]`, seenTopicIds, seenQuestionIds))
}

// Validiert die vollständige Bank und wirft bei einem strukturellen Problem
// eine Error mit klarer, auf die betroffene Stelle zeigender Meldung. Gibt bei
// Erfolg die unveränderten Rohdaten zurück (kein Remapping/keine "Reparatur" -
// der Content-Goldstandard bleibt byteidentisch).
export function validateMasterLernmentorBank(data) {
  if (!looksLikeMasterLernmentorBank(data)) {
    fail('Unbekanntes JSON-Format: keine Master-Lernmentor-Bank (erwartet ein Objekt mit "chapters"-Array).')
  }
  if (!Array.isArray(data.chapters) || data.chapters.length === 0) {
    fail('Die Datei enthält kein gültiges "chapters"-Array.')
  }

  const seenChapterIds = new Set()
  const seenTopicIds = new Set()
  const seenQuestionIds = new Set()
  data.chapters.forEach((chapter, index) => validateChapter(chapter, `chapters[${index}]`, seenChapterIds, seenTopicIds, seenQuestionIds))

  return data
}

export function countTopics(bank) {
  return bank.chapters.reduce((sum, chapter) => sum + chapter.topics.length, 0)
}

export function countQuestions(bank) {
  return bank.chapters.reduce((sum, chapter) => sum + chapter.topics.reduce((s, topic) => s + topic.questions.length, 0), 0)
}

function flatTopicsOf(bank) {
  return bank.chapters.flatMap((chapter) => chapter.topics.map((topic) => ({ ...topic, chapterId: chapter.chapterId })))
}

// Bank-gebundene Resume-Normalisierung (Codex Technical Red Team, Finding
// m-01/MINOR): der generische Persistence-Sanitizer in learningProgress.js
// prüft nur Struktur/Typen und kennt die private Bank bewusst nicht. Ein
// gespeicherter Checkpoint kann trotzdem auf IDs/Positionen zeigen, die zur
// gerade geladenen Bank nicht mehr passen (andere/aktualisierte Datei mit
// gleichem Fingerprint-Zufall ist ausgeschlossen, aber z.B. manuell
// manipulierter/beschädigter localStorage-Inhalt). Diese Funktion wird direkt
// nach dem Laden der Bank und vor jeder Resume-Anwendung aufgerufen und
// filtert/normalisiert ausschließlich auf Basis dessen, was in der Bank
// tatsächlich existiert - wirft nie eine Exception, erzeugt nie eine leere
// Fragenansicht.
//
// Normalisierungsstrategie bei ungültiger Position (dokumentiert, siehe
// Aufgabenstellung Abschnitt 14): ein unbekanntes Topic wird auf das ERSTE
// Topic der Bank zurückgesetzt (Bankstart); ein bekanntes Topic mit
// ungültigem/zu hohem Fragenindex oder unbekannter questionId wird auf
// Index 0 dieses Topics zurückgesetzt (Topicstart) - einfachste,
// deterministische und sichere Wahl, konsistent mit der bestehenden
// "Topic öffnen -> Index 0"-Logik in MasterLernmentorApp.vue
// (enterTopicByFlatIndex). Ein gültiger Index mit abweichender/unbekannter
// questionId wird nicht verworfen, sondern die questionId wird aus dem Index
// neu abgeleitet (Index ist die autoritative Positionsangabe).
export function normalizeResumeCheckpoint(bank, checkpoint) {
  if (!bank || !checkpoint) return null

  const allTopics = flatTopicsOf(bank)
  if (allTopics.length === 0) return null
  const validTopicIds = new Set(allTopics.map((topic) => topic.topicId))
  const allQuestionIds = new Set(allTopics.flatMap((topic) => topic.questions.map((question) => question.questionId)))

  // Unbekannte completedTopicIds/topicsSeen-Einträge nie mitzählen (Abschnitt
  // 13) - Fortschritt kann dadurch nie über 100% der tatsächlich vorhandenen
  // Topics hinausgehen. Set-Filterung dedupliziert nebenbei.
  const completedTopicIds = [...new Set(checkpoint.completedTopicIds.filter((id) => validTopicIds.has(id)))]
  const topicsSeen = [...new Set(checkpoint.topicsSeen.filter((id) => validTopicIds.has(id)))]
  const selfRatings = Object.fromEntries(Object.entries(checkpoint.selfRatings).filter(([questionId]) => allQuestionIds.has(questionId)))
  // isComplete wird nie blind übernommen, sondern aus den (gefilterten)
  // tatsächlich abgeschlossenen Topics neu berechnet.
  const isComplete = completedTopicIds.length === allTopics.length

  const knownTopic = allTopics.find((topic) => topic.topicId === checkpoint.currentTopicId)
  const targetTopic = knownTopic ?? allTopics[0]

  let currentQuestionIndex = checkpoint.currentQuestionIndex
  let currentQuestionId = checkpoint.currentQuestionId
  const questionCount = targetTopic.questions.length

  if (!knownTopic) {
    // Unbekanntes Topic -> Bankstart, keine offene Frage (Lernphase).
    currentQuestionIndex = 0
    currentQuestionId = null
  } else {
    const indexValid = Number.isInteger(currentQuestionIndex) && currentQuestionIndex >= 0 && currentQuestionIndex < questionCount
    const idExistsInTopic = currentQuestionId !== null && targetTopic.questions.some((question) => question.questionId === currentQuestionId)
    if (!indexValid || (currentQuestionId !== null && !idExistsInTopic)) {
      currentQuestionIndex = 0
      currentQuestionId = null
    } else if (currentQuestionId !== null && targetTopic.questions[currentQuestionIndex].questionId !== currentQuestionId) {
      currentQuestionId = targetTopic.questions[currentQuestionIndex].questionId
    }
  }

  return {
    bankFileName: checkpoint.bankFileName,
    currentChapterId: targetTopic.chapterId,
    currentTopicId: targetTopic.topicId,
    currentQuestionId,
    currentQuestionIndex,
    topicsSeen,
    completedTopicIds,
    selfRatings,
    isComplete,
    lastAccessedAt: checkpoint.lastAccessedAt,
  }
}
