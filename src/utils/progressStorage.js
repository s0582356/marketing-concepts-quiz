export const PROGRESS_STORAGE_KEY = 'marketingQuizProgress:v1'

const SCHEMA_VERSION = 1
const SHA256_PATTERN = /^[a-f0-9]{64}$/

function emptyStore() {
  return { schemaVersion: SCHEMA_VERSION, activeFingerprint: null, progressByFingerprint: {} }
}

function storageAvailable() {
  return typeof window !== 'undefined' && window.localStorage
}

function sanitizeProgress(progress) {
  if (!progress || typeof progress !== 'object') return null
  const { questionCount, runQuestionIndices, optionOrders, selectedOptionIndices } = progress
  if (!Number.isInteger(questionCount) || questionCount < 1) return null
  if (typeof progress.bankFileName !== 'string' || !progress.bankFileName) return null
  if (!Array.isArray(runQuestionIndices) || runQuestionIndices.length < 1) return null
  if (!Array.isArray(optionOrders) || optionOrders.length !== runQuestionIndices.length) return null
  if (!Array.isArray(selectedOptionIndices) || selectedOptionIndices.length !== runQuestionIndices.length) return null
  if (!runQuestionIndices.every((index) => Number.isInteger(index) && index >= 0 && index < questionCount)) return null
  if (!Number.isInteger(progress.currentIndex) || progress.currentIndex < 0 || progress.currentIndex >= runQuestionIndices.length) return null
  if (![progress.score, progress.currentStreak, progress.bestStreak].every((value) => Number.isInteger(value) && value >= 0)) return null
  if (typeof progress.isQuizComplete !== 'boolean' || typeof progress.isReviewMode !== 'boolean') return null
  if (typeof progress.lastSavedAt !== 'string' || Number.isNaN(Date.parse(progress.lastSavedAt))) return null

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

  // Explicit allowlist: no caller-owned object or private quiz content is spread.
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

function readStore() {
  if (!storageAvailable()) return emptyStore()
  try {
    const raw = window.localStorage.getItem(PROGRESS_STORAGE_KEY)
    if (!raw) return emptyStore()
    const parsed = JSON.parse(raw)
    if (parsed?.schemaVersion !== SCHEMA_VERSION || !parsed.progressByFingerprint || typeof parsed.progressByFingerprint !== 'object') return emptyStore()
    const progressByFingerprint = {}
    for (const [fingerprint, progress] of Object.entries(parsed.progressByFingerprint)) {
      if (!SHA256_PATTERN.test(fingerprint)) continue
      const safeProgress = sanitizeProgress(progress)
      if (safeProgress) progressByFingerprint[fingerprint] = safeProgress
    }
    return {
      schemaVersion: SCHEMA_VERSION,
      activeFingerprint: SHA256_PATTERN.test(parsed.activeFingerprint) && progressByFingerprint[parsed.activeFingerprint]
        ? parsed.activeFingerprint
        : null,
      progressByFingerprint,
    }
  } catch {
    return emptyStore()
  }
}

function writeStore(store) {
  if (!storageAvailable()) return false
  try {
    window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(store))
    return true
  } catch {
    return false
  }
}

export function saveBankProgress(fingerprint, progress) {
  if (!SHA256_PATTERN.test(fingerprint)) return false
  const safeProgress = sanitizeProgress(progress)
  if (!safeProgress) return false
  const store = readStore()
  store.activeFingerprint = fingerprint
  store.progressByFingerprint[fingerprint] = safeProgress
  return writeStore(store)
}

export function getBankProgress(fingerprint) {
  if (!SHA256_PATTERN.test(fingerprint)) return null
  return readStore().progressByFingerprint[fingerprint] ?? null
}

export function deleteBankProgress(fingerprint) {
  if (!SHA256_PATTERN.test(fingerprint) || !storageAvailable()) return false
  const store = readStore()
  if (!store.progressByFingerprint[fingerprint]) return false
  delete store.progressByFingerprint[fingerprint]
  if (store.activeFingerprint === fingerprint) store.activeFingerprint = null
  if (Object.keys(store.progressByFingerprint).length === 0) {
    window.localStorage.removeItem(PROGRESS_STORAGE_KEY)
    return true
  }
  return writeStore(store)
}

export function listBankProgress() {
  return Object.entries(readStore().progressByFingerprint)
    .map(([fingerprint, progress]) => ({ fingerprint, progress }))
    .sort((a, b) => b.progress.lastSavedAt.localeCompare(a.progress.lastSavedAt))
}
