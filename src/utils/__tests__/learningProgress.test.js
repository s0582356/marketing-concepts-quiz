import { beforeEach, describe, expect, it } from 'vitest'
import {
  LEARNING_PROGRESS_STORAGE_KEY,
  clearLastLearningLocationIfArea,
  deleteMethodTrainerProgress,
  deleteMixedExamProgress,
  deleteQuizProgress,
  getLastLearningLocation,
  getMethodTrainerProgress,
  getMixedExamProgress,
  getQuizProgress,
  saveMethodTrainerProgress,
  saveMixedExamProgress,
  saveQuizProgress,
  setLastLearningLocation,
} from '../learningProgress.js'

const FP_A = 'a'.repeat(64)
const FP_B = 'b'.repeat(64)

function quizProgress(overrides = {}) {
  return {
    bankFileName: 'Lernbibliothek (2 MC-Banken)',
    questionCount: 5,
    runQuestionIndices: [0, 1, 2, 3, 4],
    optionOrders: [[0, 1], [0, 1], [0, 1], [0, 1], [0, 1]],
    currentIndex: 2,
    selectedOptionIndices: [0, 1, null, null, null],
    score: 1,
    currentStreak: 0,
    bestStreak: 1,
    isQuizComplete: false,
    isReviewMode: false,
    lastSavedAt: new Date().toISOString(),
    ...overrides,
  }
}

function trainerProgress(overrides = {}) {
  return {
    method: 'matrix',
    unitId: 'unit-bcg-1',
    mode: 'learn',
    sessionIndex: 4,
    sessionCompleted: 4,
    sessionCorrect: 3,
    completedUnitIds: ['unit-1', 'unit-2'],
    lastAccessedAt: new Date().toISOString(),
    ...overrides,
  }
}

function examProgress(overrides = {}) {
  return {
    poolIndices: [3, 1, 4, 0],
    optionOrders: [[0, 1], [1, 0], [0, 1], [0, 1]],
    selectedOptionIndices: [0, null, null, null],
    currentIndex: 1,
    lastSavedAt: new Date().toISOString(),
    ...overrides,
  }
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('Quiz-Checkpoint', () => {
  it('speichert und liest einen gültigen Checkpoint (Test 1)', () => {
    expect(saveQuizProgress(FP_A, quizProgress())).toBe(true)
    expect(getQuizProgress(FP_A)).toMatchObject({ currentIndex: 2, score: 1 })
  })

  it('liefert null für einen unbekannten Fingerprint, ohne einen falschen Treffer zu erfinden (Test 4)', () => {
    saveQuizProgress(FP_A, quizProgress())
    expect(getQuizProgress(FP_B)).toBeNull()
  })

  it('lehnt strukturell ungültige Checkpoints ab, statt sie zu übernehmen', () => {
    expect(saveQuizProgress(FP_A, { ...quizProgress(), currentIndex: 99 })).toBe(false)
    expect(getQuizProgress(FP_A)).toBeNull()
  })

  it('persistiert nie Frage-/Antworttext, nur technische Felder (Test 15)', () => {
    saveQuizProgress(FP_A, quizProgress())
    const raw = window.localStorage.getItem(LEARNING_PROGRESS_STORAGE_KEY)
    expect(raw).not.toContain('"question"')
    expect(raw).not.toContain('correctAnswer')
    expect(raw).not.toContain('explanation')
  })

  it('löscht gezielt nur diesen Fingerprint, andere Bereiche bleiben unberührt (Test 14)', () => {
    saveQuizProgress(FP_A, quizProgress())
    saveMethodTrainerProgress(FP_B, trainerProgress())
    deleteQuizProgress(FP_A)
    expect(getQuizProgress(FP_A)).toBeNull()
    expect(getMethodTrainerProgress(FP_B)).not.toBeNull()
  })
})

describe('Methodentrainer-Checkpoint', () => {
  it('speichert Methode, Unit-ID, Modus und Position (Test 8, 9, 10)', () => {
    saveMethodTrainerProgress(FP_A, trainerProgress())
    const restored = getMethodTrainerProgress(FP_A)
    expect(restored.method).toBe('matrix')
    expect(restored.unitId).toBe('unit-bcg-1')
    expect(restored.mode).toBe('learn')
    expect(restored.sessionIndex).toBe(4)
  })

  it('lehnt einen unbekannten Modus ab', () => {
    expect(saveMethodTrainerProgress(FP_A, trainerProgress({ mode: 'invalid' }))).toBe(false)
  })

  it('dedupliziert erledigte Einheiten-IDs', () => {
    saveMethodTrainerProgress(FP_A, trainerProgress({ completedUnitIds: ['u1', 'u1', 'u2'] }))
    expect(getMethodTrainerProgress(FP_A).completedUnitIds).toEqual(['u1', 'u2'])
  })

  it('lehnt eine mit method-key inkompatible unitId nie strukturell ab, aber Positions-Feld muss Integer sein', () => {
    expect(saveMethodTrainerProgress(FP_A, trainerProgress({ sessionIndex: -1 }))).toBe(false)
  })
})

describe('Mixed-Exam-Checkpoint', () => {
  it('speichert Pool-Indizes, Optionsreihenfolge und Antwortstatus als reine Zahlen (Test 11)', () => {
    saveMixedExamProgress(FP_A, examProgress())
    const restored = getMixedExamProgress(FP_A)
    expect(restored.poolIndices).toEqual([3, 1, 4, 0])
    expect(restored.currentIndex).toBe(1)
  })

  it('löscht den Checkpoint, wenn eine Prüfung abgeschlossen wird (kein falsches Resume eines fertigen Laufs)', () => {
    saveMixedExamProgress(FP_A, examProgress())
    deleteMixedExamProgress(FP_A)
    expect(getMixedExamProgress(FP_A)).toBeNull()
  })
})

describe('Globaler letzter Lernort (Test 12)', () => {
  it('speichert und liest den zuletzt verwendeten Bereich', () => {
    setLastLearningLocation({ area: 'methodTrainer', setFingerprint: FP_A, subArea: 'matrix', itemId: 'unit-1', position: 5, total: 8, mode: 'learn' })
    const location = getLastLearningLocation()
    expect(location).toMatchObject({ area: 'methodTrainer', setFingerprint: FP_A, subArea: 'matrix', position: 5, total: 8 })
    expect(typeof location.updatedAt).toBe('string')
  })

  it('wird nach einem gezielten Reset dieses Bereichs geleert, andere Bereiche bleiben erhalten (Test 14)', () => {
    saveQuizProgress(FP_A, quizProgress())
    setLastLearningLocation({ area: 'quiz', setFingerprint: FP_A, subArea: null, itemId: null, position: 3, total: 5, mode: null })
    clearLastLearningLocationIfArea('quiz')
    expect(getLastLearningLocation()).toBeNull()
    // Der Quiz-Checkpoint selbst bleibt bestehen - nur der globale Zeiger wurde geräumt.
    expect(getQuizProgress(FP_A)).not.toBeNull()
  })

  it('räumt nicht auf, wenn der aktuelle Zeiger auf einen anderen Bereich zeigt', () => {
    setLastLearningLocation({ area: 'quiz', setFingerprint: FP_A, subArea: null, itemId: null, position: 1, total: 5, mode: null })
    clearLastLearningLocationIfArea('mixedExam')
    expect(getLastLearningLocation().area).toBe('quiz')
  })

  it('räumt nicht auf, wenn zwar der Bereich passt, aber ein abweichender Fingerprint übergeben wird (Codex Delta Review M-2/M-3)', () => {
    // Simuliert: Mixed Exam mit Fingerprint FP_A wurde abgeschlossen, aber der
    // Nutzer hat inzwischen andere Bibliotheken geladen und eine NEUE
    // mixedExam-Sitzung (FP_B) begonnen, bevor der verzögerte Clear-Aufruf für
    // die alte Sitzung eintrifft. Der neue Zeiger darf dadurch nicht verloren gehen.
    setLastLearningLocation({ area: 'mixedExam', setFingerprint: FP_B, subArea: null, itemId: null, position: 1, total: 10, mode: null })
    clearLastLearningLocationIfArea('mixedExam', FP_A)
    expect(getLastLearningLocation()).toMatchObject({ area: 'mixedExam', setFingerprint: FP_B })
  })

  it('räumt auf, wenn Bereich UND Fingerprint exakt übereinstimmen', () => {
    setLastLearningLocation({ area: 'mixedExam', setFingerprint: FP_A, subArea: null, itemId: null, position: 1, total: 10, mode: null })
    clearLastLearningLocationIfArea('mixedExam', FP_A)
    expect(getLastLearningLocation()).toBeNull()
  })

  it('bleibt ohne übergebenen Fingerprint beim alten Verhalten (nur Bereichsvergleich)', () => {
    setLastLearningLocation({ area: 'quiz', setFingerprint: FP_A, subArea: null, itemId: null, position: 1, total: 5, mode: null })
    clearLastLearningLocationIfArea('quiz')
    expect(getLastLearningLocation()).toBeNull()
  })
})

describe('Migration von marketingQuizProgress:v1 (Test H)', () => {
  it('übernimmt einen gültigen v1-Quizstand technisch in die neue Sektion', () => {
    window.localStorage.setItem('marketingQuizProgress:v1', JSON.stringify({
      schemaVersion: 1,
      activeFingerprint: FP_A,
      progressByFingerprint: { [FP_A]: quizProgress() },
    }))
    expect(getQuizProgress(FP_A)).toMatchObject({ currentIndex: 2, score: 1 })
    expect(getLastLearningLocation()).toMatchObject({ area: 'quiz', setFingerprint: FP_A })
  })

  it('ignoriert einen kaputten v1-Stand, statt zu crashen', () => {
    window.localStorage.setItem('marketingQuizProgress:v1', '{not json')
    expect(() => getQuizProgress(FP_A)).not.toThrow()
    expect(getQuizProgress(FP_A)).toBeNull()
  })

  it('überschreibt einen bereits vorhandenen v2-Stand nicht mit einem älteren v1-Stand (Test 12)', () => {
    // v2 existiert bereits nativ (z. B. aus einer späteren Sitzung) mit einem
    // ANDEREN Fortschritt für denselben Fingerprint als der alte v1-Rest.
    saveQuizProgress(FP_A, quizProgress({ currentIndex: 4, score: 4 }))
    // Ein veralteter v1-Schlüssel mit abweichendem Stand liegt zusätzlich (z. B.
    // technisch nie bereinigt) noch im Storage.
    window.localStorage.setItem('marketingQuizProgress:v1', JSON.stringify({
      schemaVersion: 1,
      activeFingerprint: FP_A,
      progressByFingerprint: { [FP_A]: quizProgress({ currentIndex: 0, score: 0 }) },
    }))
    // v2 bleibt maßgeblich - die Migration darf nur greifen, wenn NOCH KEIN
    // v2-Schlüssel existiert, nie um einen bestehenden zu ersetzen.
    expect(getQuizProgress(FP_A)).toMatchObject({ currentIndex: 4, score: 4 })
  })

  it('migriert nur einmalig - wiederholte Zugriffe liefern stabil denselben, danach normal fortschreibbaren Stand (Test 13)', () => {
    window.localStorage.setItem('marketingQuizProgress:v1', JSON.stringify({
      schemaVersion: 1,
      activeFingerprint: FP_A,
      progressByFingerprint: { [FP_A]: quizProgress({ currentIndex: 1 }) },
    }))
    // Erster Zugriff löst die einmalige Migration aus.
    expect(getQuizProgress(FP_A).currentIndex).toBe(1)
    // Danach wird regulär weitergespielt und neu gespeichert (simuliert echtes
    // Fortsetzen nach der Migration).
    expect(saveQuizProgress(FP_A, quizProgress({ currentIndex: 4 }))).toBe(true)
    // Ein erneuter Zugriff (z. B. nach einem weiteren Reload) darf NICHT erneut
    // migrieren und dadurch auf den alten v1-Stand zurückfallen.
    expect(getQuizProgress(FP_A).currentIndex).toBe(4)
    expect(getQuizProgress(FP_A).currentIndex).toBe(4)
  })
})

describe('Robustheit gegen veraltete/beschädigte Zustände (Test 16, 17)', () => {
  it('behandelt einen unbekannten schemaVersion-Wert sicher als leeren Speicher', () => {
    window.localStorage.setItem(LEARNING_PROGRESS_STORAGE_KEY, JSON.stringify({ schemaVersion: 999, quizBySetFingerprint: { [FP_A]: quizProgress() } }))
    expect(getQuizProgress(FP_A)).toBeNull()
  })

  it('crasht nicht bei kaputtem JSON im neuen Storage-Key', () => {
    window.localStorage.setItem(LEARNING_PROGRESS_STORAGE_KEY, '{not json at all')
    expect(() => getQuizProgress(FP_A)).not.toThrow()
    expect(getLastLearningLocation()).toBeNull()
  })

  it('ignoriert Einträge mit nicht-SHA256-Schlüsseln statt sie zu übernehmen', () => {
    window.localStorage.setItem(LEARNING_PROGRESS_STORAGE_KEY, JSON.stringify({
      schemaVersion: 2,
      lastLearningLocation: null,
      quizBySetFingerprint: { 'not-a-hash': quizProgress() },
      methodTrainerBySetFingerprint: {},
      mixedExamBySetFingerprint: {},
    }))
    expect(getQuizProgress('not-a-hash')).toBeNull()
  })
})
