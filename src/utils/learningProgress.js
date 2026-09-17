// Zentrale Progress-/Resume-Schicht der App: EIN Storage-Key, EIN Schema, für
// Quiz, Methodentrainer und Mixed Transfer Exam gemeinsam, plus ein globaler
// "letzter Lernort" (lastLearningLocation) fürs Dashboard.
//
// Persistiert werden ausschließlich technische Metadaten (Fingerprints,
// Indizes/IDs, Zähler, Zeitstempel) - niemals Frage-/Antworttexte, Erklärungen,
// Merkhilfen, sourceReference oder komplette Objekte aus privaten JSON-Dateien.
// Jede Sektion hat eine strikte Allowlist-Sanitisierung: unbekannte/zusätzliche
// Felder werden nie übernommen, ungültige Datensätze nie akzeptiert.
//
// Migration: das alte Schema (marketingQuizProgress:v1, nur Quiz, ein
// Fortschritt pro MC-Fingerprint) wird beim ersten Zugriff einmalig gelesen
// und - soweit strukturell gültig - in die neue Quiz-Sektion übernommen. Der
// alte Schlüssel wird dabei nicht mehr beschrieben, aber auch nicht gelöscht.

export const LEARNING_PROGRESS_STORAGE_KEY = 'marketingLearningProgress:v2'
const LEGACY_QUIZ_STORAGE_KEY = 'marketingQuizProgress:v1'
const SCHEMA_VERSION = 2
const SHA256_PATTERN = /^[a-f0-9]{64}$/
const TRAINING_MODES = ['learn', 'apply', 'exam']
const LEARNING_AREAS = ['quiz', 'methodTrainer', 'mixedExam']

function storageAvailable() {
  return typeof window !== 'undefined' && window.localStorage
}

function isNonNegInt(value) {
  return Number.isInteger(value) && value >= 0
}

function isIsoDateString(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

function emptyStore() {
  return {
    schemaVersion: SCHEMA_VERSION,
    lastLearningLocation: null,
    quizBySetFingerprint: {},
    methodTrainerBySetFingerprint: {},
    mixedExamBySetFingerprint: {},
  }
}

// ---- Sektion: Quiz ----------------------------------------------------

function sanitizeQuizProgress(progress) {
  if (!progress || typeof progress !== 'object') return null
  const { questionCount, runQuestionIndices, optionOrders, selectedOptionIndices } = progress
  if (!Number.isInteger(questionCount) || questionCount < 1) return null
  if (typeof progress.bankFileName !== 'string' || !progress.bankFileName) return null
  if (!Array.isArray(runQuestionIndices) || runQuestionIndices.length < 1) return null
  if (!Array.isArray(optionOrders) || optionOrders.length !== runQuestionIndices.length) return null
  if (!Array.isArray(selectedOptionIndices) || selectedOptionIndices.length !== runQuestionIndices.length) return null
  if (!runQuestionIndices.every((index) => Number.isInteger(index) && index >= 0 && index < questionCount)) return null
  if (!Number.isInteger(progress.currentIndex) || progress.currentIndex < 0 || progress.currentIndex >= runQuestionIndices.length) return null
  if (![progress.score, progress.currentStreak, progress.bestStreak].every(isNonNegInt)) return null
  if (typeof progress.isQuizComplete !== 'boolean' || typeof progress.isReviewMode !== 'boolean') return null
  if (!isIsoDateString(progress.lastSavedAt)) return null

  const safeOrders = optionOrders.map((order) => {
    if (!Array.isArray(order) || !order.every((index) => Number.isInteger(index) && index >= 0)) return null
    if (new Set(order).size !== order.length) return null
    return order.map((index) => index)
  })
  if (safeOrders.some((order) => order === null)) return null

  const safeSelections = selectedOptionIndices.map((index) => {
    if (index === null) return null
    return Number.isInteger(index) && index >= 0 ? index : undefined
  })
  if (safeSelections.includes(undefined)) return null

  return {
    bankFileName: progress.bankFileName,
    questionCount,
    runQuestionIndices: runQuestionIndices.map((index) => index),
    optionOrders: safeOrders,
    currentIndex: progress.currentIndex,
    selectedOptionIndices: safeSelections,
    score: progress.score,
    currentStreak: progress.currentStreak,
    bestStreak: progress.bestStreak,
    isQuizComplete: progress.isQuizComplete,
    isReviewMode: progress.isReviewMode,
    lastSavedAt: progress.lastSavedAt,
  }
}

// ---- Sektion: Methodentrainer ------------------------------------------

function sanitizeMethodTrainerProgress(progress) {
  if (!progress || typeof progress !== 'object') return null
  if (typeof progress.method !== 'string' || !progress.method) return null
  if (progress.unitId === undefined || progress.unitId === null) return null
  if (!['string', 'number'].includes(typeof progress.unitId)) return null
  if (!TRAINING_MODES.includes(progress.mode)) return null
  if (!isNonNegInt(progress.sessionIndex)) return null
  if (!isNonNegInt(progress.sessionCompleted) || !isNonNegInt(progress.sessionCorrect)) return null
  if (!Array.isArray(progress.completedUnitIds) || !progress.completedUnitIds.every((id) => ['string', 'number'].includes(typeof id))) return null
  if (!isIsoDateString(progress.lastAccessedAt)) return null

  return {
    method: progress.method,
    unitId: progress.unitId,
    mode: progress.mode,
    sessionIndex: progress.sessionIndex,
    sessionCompleted: progress.sessionCompleted,
    sessionCorrect: progress.sessionCorrect,
    completedUnitIds: [...new Set(progress.completedUnitIds)],
    lastAccessedAt: progress.lastAccessedAt,
  }
}

// ---- Sektion: Mixed Transfer Exam ---------------------------------------

function sanitizeMixedExamProgress(progress) {
  if (!progress || typeof progress !== 'object') return null
  const { poolIndices, optionOrders, selectedOptionIndices } = progress
  if (!Array.isArray(poolIndices) || poolIndices.length < 1) return null
  if (!poolIndices.every((index) => Number.isInteger(index) && index >= 0)) return null
  if (!Array.isArray(optionOrders) || optionOrders.length !== poolIndices.length) return null
  if (!Array.isArray(selectedOptionIndices) || selectedOptionIndices.length !== poolIndices.length) return null
  if (!Number.isInteger(progress.currentIndex) || progress.currentIndex < 0 || progress.currentIndex >= poolIndices.length) return null
  if (!isIsoDateString(progress.lastSavedAt)) return null

  const safeOrders = optionOrders.map((order) => {
    if (!Array.isArray(order) || !order.every((index) => Number.isInteger(index) && index >= 0)) return null
    if (new Set(order).size !== order.length) return null
    return order.map((index) => index)
  })
  if (safeOrders.some((order) => order === null)) return null

  const safeSelections = selectedOptionIndices.map((index) => {
    if (index === null) return null
    return Number.isInteger(index) && index >= 0 ? index : undefined
  })
  if (safeSelections.includes(undefined)) return null

  return {
    poolIndices: poolIndices.map((index) => index),
    optionOrders: safeOrders,
    selectedOptionIndices: safeSelections,
    currentIndex: progress.currentIndex,
    lastSavedAt: progress.lastSavedAt,
  }
}

// ---- Sektion: globaler letzter Lernort ----------------------------------

function sanitizeLastLearningLocation(location) {
  if (!location || typeof location !== 'object') return null
  if (!LEARNING_AREAS.includes(location.area)) return null
  // setFingerprint verweist auf den Library-Set-Fingerprint (MC-Set für
  // quiz/mixedExam, Trainingseinheiten-Set für methodTrainer), gegen den
  // ein Dashboard ohne Kenntnis der einzelnen Bereichs-Checkpoints prüfen
  // kann, ob die aktuell geladenen Bibliotheken zum Checkpoint passen.
  if (!SHA256_PATTERN.test(location.setFingerprint)) return null
  if (location.subArea !== null && typeof location.subArea !== 'string') return null
  if (location.itemId !== null && !['string', 'number'].includes(typeof location.itemId)) return null
  if (location.position !== null && !isNonNegInt(location.position)) return null
  if (location.total !== null && !isNonNegInt(location.total)) return null
  if (location.mode !== null && typeof location.mode !== 'string') return null
  if (!isIsoDateString(location.updatedAt)) return null

  return {
    area: location.area,
    setFingerprint: location.setFingerprint,
    subArea: location.subArea ?? null,
    itemId: location.itemId ?? null,
    position: location.position ?? null,
    total: location.total ?? null,
    mode: location.mode ?? null,
    updatedAt: location.updatedAt,
  }
}

// ---- Migration von marketingQuizProgress:v1 -----------------------------

function migrateLegacyQuizStore() {
  if (!storageAvailable()) return null
  try {
    const raw = window.localStorage.getItem(LEGACY_QUIZ_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed?.schemaVersion !== 1 || !parsed.progressByFingerprint || typeof parsed.progressByFingerprint !== 'object') return null

    const quizBySetFingerprint = {}
    for (const [fingerprint, progress] of Object.entries(parsed.progressByFingerprint)) {
      if (!SHA256_PATTERN.test(fingerprint)) continue
      const safeProgress = sanitizeQuizProgress(progress)
      if (safeProgress) quizBySetFingerprint[fingerprint] = safeProgress
    }
    if (Object.keys(quizBySetFingerprint).length === 0) return null

    let lastLearningLocation = null
    const activeFingerprint = parsed.activeFingerprint
    if (SHA256_PATTERN.test(activeFingerprint) && quizBySetFingerprint[activeFingerprint]) {
      const active = quizBySetFingerprint[activeFingerprint]
      lastLearningLocation = sanitizeLastLearningLocation({
        area: 'quiz',
        setFingerprint: activeFingerprint,
        subArea: null,
        itemId: null,
        position: active.currentIndex + 1,
        total: active.runQuestionIndices.length,
        mode: active.isReviewMode ? 'review' : 'normal',
        updatedAt: active.lastSavedAt,
      })
    }

    return { quizBySetFingerprint, lastLearningLocation }
  } catch {
    return null
  }
}

// ---- Store lesen/schreiben ----------------------------------------------

function readStore() {
  if (!storageAvailable()) return emptyStore()
  try {
    const raw = window.localStorage.getItem(LEARNING_PROGRESS_STORAGE_KEY)
    if (!raw) {
      const migrated = migrateLegacyQuizStore()
      if (!migrated) return emptyStore()
      const store = {
        ...emptyStore(),
        quizBySetFingerprint: migrated.quizBySetFingerprint,
        lastLearningLocation: migrated.lastLearningLocation,
      }
      writeStore(store)
      return store
    }
    const parsed = JSON.parse(raw)
    if (parsed?.schemaVersion !== SCHEMA_VERSION) return emptyStore()

    const store = emptyStore()
    store.lastLearningLocation = sanitizeLastLearningLocation(parsed.lastLearningLocation)

    for (const [key, sectionRaw, sanitize] of [
      ['quizBySetFingerprint', parsed.quizBySetFingerprint, sanitizeQuizProgress],
      ['methodTrainerBySetFingerprint', parsed.methodTrainerBySetFingerprint, sanitizeMethodTrainerProgress],
      ['mixedExamBySetFingerprint', parsed.mixedExamBySetFingerprint, sanitizeMixedExamProgress],
    ]) {
      if (!sectionRaw || typeof sectionRaw !== 'object') continue
      for (const [fingerprint, entry] of Object.entries(sectionRaw)) {
        if (!SHA256_PATTERN.test(fingerprint)) continue
        const safeEntry = sanitize(entry)
        if (safeEntry) store[key][fingerprint] = safeEntry
      }
    }
    return store
  } catch {
    return emptyStore()
  }
}

function writeStore(store) {
  if (!storageAvailable()) return false
  try {
    window.localStorage.setItem(LEARNING_PROGRESS_STORAGE_KEY, JSON.stringify(store))
    return true
  } catch {
    return false
  }
}

function saveSection(sectionKey, sanitize, fingerprint, progress) {
  if (!SHA256_PATTERN.test(fingerprint)) return false
  const safeProgress = sanitize(progress)
  if (!safeProgress) return false
  const store = readStore()
  store[sectionKey][fingerprint] = safeProgress
  return writeStore(store)
}

function getSection(sectionKey, fingerprint) {
  if (!SHA256_PATTERN.test(fingerprint)) return null
  return readStore()[sectionKey][fingerprint] ?? null
}

function deleteSection(sectionKey, fingerprint) {
  if (!SHA256_PATTERN.test(fingerprint) || !storageAvailable()) return false
  const store = readStore()
  if (!store[sectionKey][fingerprint]) return false
  delete store[sectionKey][fingerprint]
  return writeStore(store)
}

// ---- Öffentliche API: Quiz ------------------------------------------------

export function saveQuizProgress(fingerprint, progress) {
  return saveSection('quizBySetFingerprint', sanitizeQuizProgress, fingerprint, progress)
}
export function getQuizProgress(fingerprint) {
  return getSection('quizBySetFingerprint', fingerprint)
}
export function deleteQuizProgress(fingerprint) {
  return deleteSection('quizBySetFingerprint', fingerprint)
}

// ---- Öffentliche API: Methodentrainer --------------------------------------

export function saveMethodTrainerProgress(fingerprint, progress) {
  return saveSection('methodTrainerBySetFingerprint', sanitizeMethodTrainerProgress, fingerprint, progress)
}
export function getMethodTrainerProgress(fingerprint) {
  return getSection('methodTrainerBySetFingerprint', fingerprint)
}
export function deleteMethodTrainerProgress(fingerprint) {
  return deleteSection('methodTrainerBySetFingerprint', fingerprint)
}

// ---- Öffentliche API: Mixed Transfer Exam ----------------------------------

export function saveMixedExamProgress(fingerprint, progress) {
  return saveSection('mixedExamBySetFingerprint', sanitizeMixedExamProgress, fingerprint, progress)
}
export function getMixedExamProgress(fingerprint) {
  return getSection('mixedExamBySetFingerprint', fingerprint)
}
export function deleteMixedExamProgress(fingerprint) {
  return deleteSection('mixedExamBySetFingerprint', fingerprint)
}

// ---- Öffentliche API: globaler letzter Lernort -----------------------------

export function getLastLearningLocation() {
  return readStore().lastLearningLocation
}

// `location` ohne `updatedAt` - wird hier zentral gesetzt, damit Aufrufer nie
// eigene Zeitstempel-Logik duplizieren.
export function setLastLearningLocation(location) {
  if (!storageAvailable()) return false
  const store = readStore()
  const safeLocation = sanitizeLastLearningLocation({ ...location, updatedAt: new Date().toISOString() })
  if (!safeLocation) return false
  store.lastLearningLocation = safeLocation
  return writeStore(store)
}

// Räumt den globalen Zeiger auf, wenn er gerade auf den Bereich/Fingerprint
// zeigt, dessen Fortschritt soeben abgeschlossen oder gelöscht wurde - ein
// Dashboard-"Weiterlernen" soll nie auf eine nicht mehr fortsetzbare Sitzung
// verweisen. Andere Bereiche/Fingerprints bleiben unangetastet.
//
// `setFingerprint` ist optional, aber dringend empfohlen: ohne ihn würde ein
// verzögerter "Sitzung X abgeschlossen"-Aufruf sonst auch den Zeiger auf eine
// zwischenzeitlich neu gestartete Sitzung DESSELBEN Bereichs (aber eines
// ANDEREN Library-Sets) löschen. Wird er angegeben, wird nur geräumt, wenn
// Bereich UND Fingerprint exakt zum aktuellen Zeiger passen (Codex Delta
// Review, Findings M-2/M-3).
export function clearLastLearningLocationIfArea(area, setFingerprint) {
  if (!storageAvailable()) return false
  const store = readStore()
  const current = store.lastLearningLocation
  if (!current || current.area !== area) return false
  if (setFingerprint !== undefined && current.setFingerprint !== setFingerprint) return false
  store.lastLearningLocation = null
  return writeStore(store)
}
