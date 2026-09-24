import { describe, expect, it } from 'vitest'
import { countQuestions, countTopics, looksLikeMasterLernmentorBank, normalizeResumeCheckpoint, validateMasterLernmentorBank } from '../masterLernmentorValidator.js'

function validQuestion(overrides = {}) {
  return {
    questionId: 'mlm-ch01-t01-q01',
    chapterId: 'ch01',
    topicId: 'ch01-t01',
    question: 'Erläutern Sie den Marketingbegriff.',
    hint: 'Denke an drei Elemente.',
    coreConcepts: [{ label: 'Marktorientierung', conceptId: 'c01', acceptedPhrases: ['Markt im Mittelpunkt'] }],
    optionalConcepts: [],
    shortModelAnswer: 'Marketing ist marktorientiert.',
    masterExcerpt: 'Marketing ist marktorientiert.',
    responseRequirements: { requiresAllCoreConcepts: true, minimumItems: 1, minimumExamples: null, minimumExamplesPerGroup: null },
    answerFlexibility: { wordingMatchRequired: false, equivalentOwnExamplesAllowed: false, caseBound: false },
    ...overrides,
  }
}

function validTopic(overrides = {}) {
  return {
    topicId: 'ch01-t01',
    topicNumber: '1.1',
    topicTitle: 'Der Marketingbegriff',
    chapterId: 'ch01',
    learningPhase: { masterAnchor: '1.1', masterContent: '## 1.1 Der Marketingbegriff\n\nText.' },
    questions: [validQuestion()],
    visualAssets: [],
    ...overrides,
  }
}

function validBank(overrides = {}) {
  return {
    libraryId: 'marketing-master-lernmentor',
    chapters: [
      { chapterId: 'ch01', chapterNumber: '1', chapterTitle: 'Marketing-Grundlagen', topics: [validTopic()] },
    ],
    ...overrides,
  }
}

describe('looksLikeMasterLernmentorBank', () => {
  it('erkennt eine Bank mit chapters-Array (Test 3)', () => {
    expect(looksLikeMasterLernmentorBank(validBank())).toBe(true)
  })

  it('lehnt ein Array ab (kollidiert nie mit MC-/Trainingseinheiten-Erkennung)', () => {
    expect(looksLikeMasterLernmentorBank([{ options: [], correctAnswer: 'x' }])).toBe(false)
  })

  it('lehnt null/undefined/Nicht-Objekte ab', () => {
    expect(looksLikeMasterLernmentorBank(null)).toBe(false)
    expect(looksLikeMasterLernmentorBank('string')).toBe(false)
  })
})

describe('validateMasterLernmentorBank', () => {
  it('akzeptiert eine strukturell gültige Bank unverändert (Test 3)', () => {
    const bank = validBank()
    expect(validateMasterLernmentorBank(bank)).toBe(bank)
  })

  it('lehnt eine Bank ohne chapters klar ab, statt abzustürzen (Test 4)', () => {
    expect(() => validateMasterLernmentorBank({})).toThrow(/chapters/)
  })

  it('lehnt eine Frage ohne coreConcepts ab', () => {
    const bank = validBank()
    bank.chapters[0].topics[0].questions[0].coreConcepts = []
    expect(() => validateMasterLernmentorBank(bank)).toThrow()
  })

  it('lehnt eine Frage ohne responseRequirements ab', () => {
    const bank = validBank()
    delete bank.chapters[0].topics[0].questions[0].responseRequirements
    expect(() => validateMasterLernmentorBank(bank)).toThrow(/responseRequirements/)
  })

  it('lehnt eine Frage ohne answerFlexibility ab', () => {
    const bank = validBank()
    delete bank.chapters[0].topics[0].questions[0].answerFlexibility
    expect(() => validateMasterLernmentorBank(bank)).toThrow(/answerFlexibility/)
  })

  it('lehnt doppelte questionId ab', () => {
    const bank = validBank()
    bank.chapters[0].topics[0].questions.push(validQuestion())
    expect(() => validateMasterLernmentorBank(bank)).toThrow(/doppelte questionId/)
  })

  it('lehnt doppelte topicId ab', () => {
    const bank = validBank()
    bank.chapters[0].topics.push(validTopic())
    expect(() => validateMasterLernmentorBank(bank)).toThrow(/doppelte topicId/)
  })

  it('lehnt ein Topic ohne learningPhase.masterContent ab', () => {
    const bank = validBank()
    bank.chapters[0].topics[0].learningPhase.masterContent = ''
    expect(() => validateMasterLernmentorBank(bank)).toThrow(/masterContent/)
  })

  it('lehnt eine Frage ohne masterExcerpt ab', () => {
    const bank = validBank()
    delete bank.chapters[0].topics[0].questions[0].masterExcerpt
    expect(() => validateMasterLernmentorBank(bank)).toThrow(/masterExcerpt/)
  })

  it('lehnt eine kaputte JSON-Struktur (Array statt Objekt) ab, ohne zu crashen', () => {
    expect(() => validateMasterLernmentorBank([1, 2, 3])).toThrow()
  })

  it('zählt Topics und Fragen korrekt', () => {
    const bank = validBank()
    expect(countTopics(bank)).toBe(1)
    expect(countQuestions(bank)).toBe(1)
  })
})

// Codex Technical Red Team, Finding m-01 (MINOR): gespeicherte IDs/Positionen
// müssen beim Anwenden eines Resumes gegen die tatsächlich geladene Bank
// validiert/normalisiert werden - nie blind übernommen.
describe('normalizeResumeCheckpoint (Codex Finding m-01, Test A-H)', () => {
  function multiTopicBank() {
    return {
      chapters: [
        {
          chapterId: 'ch01',
          chapterNumber: '1',
          chapterTitle: 'Kapitel Eins',
          topics: [
            validTopic({
              topicId: 'ch01-t01',
              chapterId: 'ch01',
              questions: [validQuestion({ questionId: 'q01', topicId: 'ch01-t01' }), validQuestion({ questionId: 'q02', topicId: 'ch01-t01' })],
            }),
            validTopic({ topicId: 'ch01-t02', chapterId: 'ch01', questions: [validQuestion({ questionId: 'q03', topicId: 'ch01-t02' })] }),
          ],
        },
        {
          chapterId: 'ch02',
          chapterNumber: '2',
          chapterTitle: 'Kapitel Zwei',
          topics: [
            validTopic({ topicId: 'ch02-t01', chapterId: 'ch02', questions: [validQuestion({ questionId: 'q04', topicId: 'ch02-t01' })] }),
          ],
        },
      ],
    }
  }

  function checkpoint(overrides = {}) {
    return {
      bankFileName: 'bank.json',
      currentChapterId: 'ch01',
      currentTopicId: 'ch01-t01',
      currentQuestionId: 'q02',
      currentQuestionIndex: 1,
      topicsSeen: ['ch01-t01'],
      completedTopicIds: [],
      selfRatings: {},
      isComplete: false,
      lastAccessedAt: new Date().toISOString(),
      ...overrides,
    }
  }

  it('A) korrigiert eine unbekannte/abweichende chapterId autoritativ anhand der gefundenen Topic', () => {
    const result = normalizeResumeCheckpoint(multiTopicBank(), checkpoint({ currentChapterId: 'ch99-unbekannt', currentTopicId: 'ch01-t01' }))
    expect(result.currentChapterId).toBe('ch01')
    expect(result.currentTopicId).toBe('ch01-t01')
  })

  it('B) setzt bei unbekannter topicId sicher auf das erste Topic der Bank zurück (Bankstart), keine Exception', () => {
    const result = normalizeResumeCheckpoint(multiTopicBank(), checkpoint({ currentTopicId: 'geist-topic', currentQuestionId: 'q02', currentQuestionIndex: 1 }))
    expect(result.currentTopicId).toBe('ch01-t01')
    expect(result.currentChapterId).toBe('ch01')
    expect(result.currentQuestionId).toBeNull()
    expect(result.currentQuestionIndex).toBe(0)
  })

  it('C) normalisiert einen zu hohen questionIndex / unbekannte questionId auf Topicstart (Index 0), keine leere Fragenansicht', () => {
    const result = normalizeResumeCheckpoint(multiTopicBank(), checkpoint({ currentTopicId: 'ch01-t01', currentQuestionIndex: 9999, currentQuestionId: 'geist-frage' }))
    expect(result.currentTopicId).toBe('ch01-t01')
    expect(result.currentQuestionIndex).toBe(0)
    expect(result.currentQuestionId).toBeNull()
  })

  it('leitet bei gültigem Index aber abweichender questionId die ID autoritativ aus dem Index ab, statt zu verwerfen', () => {
    const result = normalizeResumeCheckpoint(multiTopicBank(), checkpoint({ currentTopicId: 'ch01-t01', currentQuestionIndex: 0, currentQuestionId: 'q02' }))
    expect(result.currentQuestionIndex).toBe(0)
    expect(result.currentQuestionId).toBe('q01')
  })

  it('D) entfernt unbekannte completedTopicIds, statt sie mitzuzählen', () => {
    const result = normalizeResumeCheckpoint(multiTopicBank(), checkpoint({ completedTopicIds: ['ch01-t01', 'geist-topic-1', 'geist-topic-2'] }))
    expect(result.completedTopicIds).toEqual(['ch01-t01'])
  })

  it('E) dedupliziert doppelte completedTopicIds', () => {
    const result = normalizeResumeCheckpoint(multiTopicBank(), checkpoint({ completedTopicIds: ['ch01-t01', 'ch01-t01', 'ch01-t02'] }))
    expect(result.completedTopicIds.sort()).toEqual(['ch01-t01', 'ch01-t02'])
  })

  it('F) Fortschritt bleibt bei manipulierten Daten zwischen 0 und der echten Topic-Anzahl der Bank (nie >100%)', () => {
    const result = normalizeResumeCheckpoint(multiTopicBank(), checkpoint({
      completedTopicIds: ['ch01-t01', 'ch01-t02', 'ch02-t01', 'geist-1', 'geist-2', 'geist-3', 'geist-4'],
    }))
    // Bank hat exakt 3 echte Topics - trotz 7 gespeicherter Einträge dürfen nie mehr als 3 gezählt werden.
    expect(result.completedTopicIds).toHaveLength(3)
    expect(result.isComplete).toBe(true)
  })

  it('isComplete wird nie blind übernommen, sondern aus den gefilterten completedTopicIds neu berechnet', () => {
    const result = normalizeResumeCheckpoint(multiTopicBank(), checkpoint({
      isComplete: true, // vorgetäuscht - real nur ein einziges echtes Topic abgeschlossen
      completedTopicIds: ['ch01-t01', 'geist-1', 'geist-2'],
    }))
    expect(result.isComplete).toBe(false)
    expect(result.completedTopicIds).toEqual(['ch01-t01'])
  })

  it('G) entfernt Self-Ratings mit ungültigem/unbekanntem questionId-Schlüssel', () => {
    const result = normalizeResumeCheckpoint(multiTopicBank(), checkpoint({ selfRatings: { q01: 'green', 'geist-frage': 'yellow' } }))
    expect(result.selfRatings).toEqual({ q01: 'green' })
  })

  it('H) ein vollständig gültiger Checkpoint bleibt unverändert (idempotent)', () => {
    const valid = checkpoint({ completedTopicIds: ['ch01-t02'], topicsSeen: ['ch01-t01', 'ch01-t02'], selfRatings: { q01: 'green', q03: 'red' } })
    const result = normalizeResumeCheckpoint(multiTopicBank(), valid)
    expect(result).toEqual(valid)
  })

  it('gibt bei fehlender Bank oder fehlendem Checkpoint sicher null zurück, statt zu crashen', () => {
    expect(normalizeResumeCheckpoint(null, checkpoint())).toBeNull()
    expect(normalizeResumeCheckpoint(multiTopicBank(), null)).toBeNull()
  })
})
