import { describe, expect, it } from 'vitest'
import {
  addLibraryBanks,
  classifyLibraryFile,
  combinedMcFingerprint,
  mergeMcQuestions,
  mergeTrainingUnits,
  readLibraryFiles,
} from '../libraryImport.js'

function mcQuestion(overrides = {}) {
  return {
    question: 'Was ist Marketing?',
    options: ['Richtig', 'Falsch A', 'Falsch B', 'Falsch C'],
    correctAnswer: 'Richtig',
    explanation: 'Testerklärung.',
    category: 'Basics',
    ...overrides,
  }
}

function trainingUnit(overrides = {}) {
  return {
    id: 'unit-1',
    method: 'duel',
    prompt: 'Welches Konzept passt?',
    choices: ['A', 'B'],
    correctAnswer: 'A',
    ...overrides,
  }
}

function jsonFile(name, data) {
  return new File([JSON.stringify(data)], name, { type: 'application/json' })
}

describe('Banktyp-Erkennung (inhaltsbasiert, nicht dateinamenbasiert)', () => {
  it('erkennt eine MC-Fragenbank am Schema (options/correctAnswer)', () => {
    const result = classifyLibraryFile([mcQuestion()])
    expect(result.type).toBe('mc')
    expect(result.questions).toHaveLength(1)
  })

  it('erkennt eine Trainingseinheiten-Bank am Schema (method)', () => {
    const result = classifyLibraryFile([trainingUnit()])
    expect(result.type).toBe('trainingUnits')
    expect(result.units).toHaveLength(1)
  })

  it('wirft bei unbekanntem JSON-Format einen Fehler', () => {
    expect(() => classifyLibraryFile([{ foo: 'bar' }])).toThrow('Unbekanntes JSON-Format')
  })

  it('lässt sich nicht durch den Dateinamen täuschen - Erkennung folgt ausschließlich dem Inhalt', async () => {
    // Datei heißt wie eine Trainingsdatei, enthält aber MC-Fragen.
    const file = jsonFile('methodentrainer_but_actually_mc.json', [mcQuestion()])
    const result = await readLibraryFiles([file])
    expect(result.mcBanks).toHaveLength(1)
    expect(result.trainingUnitBanks).toHaveLength(0)
  })
})

describe('Mehrfachimport', () => {
  it('importiert mehrere MC-Banken gleichzeitig', async () => {
    const files = [
      jsonFile('basics.json', [mcQuestion({ question: 'Frage A' })]),
      jsonFile('preispolitik.json', [mcQuestion({ question: 'Frage B' })]),
    ]
    const result = await readLibraryFiles(files)
    expect(result.mcBanks).toHaveLength(2)
    expect(result.trainingUnitBanks).toHaveLength(0)
    expect(result.errors).toHaveLength(0)
  })

  it('importiert eine Trainingseinheiten-Bank gleichzeitig mit MC-Banken', async () => {
    const files = [
      jsonFile('basics.json', [mcQuestion()]),
      jsonFile('methodentrainer.json', [trainingUnit(), trainingUnit({ id: 'unit-2' })]),
    ]
    const result = await readLibraryFiles(files)
    expect(result.mcBanks).toHaveLength(1)
    expect(result.trainingUnitBanks).toHaveLength(1)
    expect(result.trainingUnitBanks[0].units).toHaveLength(2)
  })

  it('blockiert gültige Dateien nicht, wenn eine andere Datei ungültig ist', async () => {
    const files = [
      jsonFile('valid.json', [mcQuestion()]),
      jsonFile('broken.json', [{ nurUnbekannteFelder: true }]),
      jsonFile('alsoValid.json', [trainingUnit()]),
    ]
    const result = await readLibraryFiles(files)
    expect(result.mcBanks).toHaveLength(1)
    expect(result.trainingUnitBanks).toHaveLength(1)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].fileName).toBe('broken.json')
  })

  it('meldet nicht parsebares JSON als Fehler statt abzustürzen', async () => {
    const brokenFile = new File(['{ this is not json'], 'kaputt.json', { type: 'application/json' })
    const files = [jsonFile('valid.json', [mcQuestion()]), brokenFile]
    const result = await readLibraryFiles(files)
    expect(result.mcBanks).toHaveLength(1)
    expect(result.errors).toHaveLength(1)
  })

  it('erkennt inhaltsgleiche Dateien als Duplikat und überspringt sie', async () => {
    const questions = [mcQuestion()]
    const files = [jsonFile('a.json', questions), jsonFile('b_kopie.json', questions)]
    const result = await readLibraryFiles(files)
    expect(result.mcBanks).toHaveLength(1)
    expect(result.duplicates).toEqual(['b_kopie.json'])
  })
})

describe('Bank-Identität: Content-Fingerprint statt Dateiname (Codex MAJOR_FIX)', () => {
  // Fall A: gleicher Inhalt + gleicher Name -> eine Bank.
  it('gleicher Inhalt unter gleichem Dateinamen bleibt eine einzige Bank', () => {
    let registry = addLibraryBanks({}, [
      { fileName: 'basics.json', fingerprint: 'fp1', questions: [mcQuestion({ question: 'Alt' })] },
    ])
    registry = addLibraryBanks(registry, [
      { fileName: 'basics.json', fingerprint: 'fp1', questions: [mcQuestion({ question: 'Alt' })] },
    ])
    expect(Object.keys(registry)).toHaveLength(1)
    expect(registry.fp1.fileName).toBe('basics.json')
  })

  // Fall B: gleicher Inhalt + anderer Name -> eine Bank, kein Pool-Duplikat;
  // der ursprüngliche Anzeigename bleibt erhalten.
  it('gleicher Inhalt unter anderem Dateinamen dedupliziert zu einer Bank und behält den bestehenden Anzeigenamen', () => {
    let registry = addLibraryBanks({}, [
      { fileName: 'basics.json', fingerprint: 'fp1', questions: [mcQuestion({ question: 'Q1' })] },
    ])
    registry = addLibraryBanks(registry, [
      { fileName: 'basics_kopie.json', fingerprint: 'fp1', questions: [mcQuestion({ question: 'Q1' })] },
    ])
    expect(Object.keys(registry)).toHaveLength(1)
    expect(registry.fp1.fileName).toBe('basics.json')
    expect(mergeMcQuestions(registry)).toHaveLength(1)
  })

  // Fall C: unterschiedlicher Inhalt + gleicher Name -> KEIN stilles
  // Überschreiben. Ohne eingebettete Bank-ID kann eine "aktualisierte" Datei
  // nicht sicher von einer zufälligen Namenskollision unterschieden werden,
  // daher bleiben beide Inhalte als technisch getrennte Banken erhalten.
  it('unterschiedlicher Inhalt unter gleichem Dateinamen überschreibt die bestehende Bank nicht still', () => {
    let registry = addLibraryBanks({}, [
      { fileName: 'basics.json', fingerprint: 'fp1', questions: [mcQuestion({ question: 'Alt' })] },
      { fileName: 'preis.json', fingerprint: 'fp2', questions: [mcQuestion({ question: 'Preis' })] },
    ])
    registry = addLibraryBanks(registry, [
      { fileName: 'basics.json', fingerprint: 'fp1-neu', questions: [mcQuestion({ question: 'Neu' })] },
    ])

    expect(Object.keys(registry)).toHaveLength(3)
    expect(registry.fp1.questions[0].question).toBe('Alt')
    expect(registry['fp1-neu'].questions[0].question).toBe('Neu')
    expect(registry.fp2.questions[0].question).toBe('Preis')
    expect(mergeMcQuestions(registry).map((q) => q.question).sort()).toEqual(['Alt', 'Neu', 'Preis'])
  })

  // Fall D: unterschiedlicher Inhalt + unterschiedlicher Name -> zwei getrennte Banken.
  it('unterschiedlicher Inhalt unter unterschiedlichem Dateinamen bleibt als zwei getrennte Banken erhalten', () => {
    const registry = addLibraryBanks({}, [
      { fileName: 'basics.json', fingerprint: 'fp1', questions: [mcQuestion({ question: 'A' })] },
      { fileName: 'preis.json', fingerprint: 'fp2', questions: [mcQuestion({ question: 'B' })] },
    ])
    expect(Object.keys(registry)).toHaveLength(2)
    expect(mergeMcQuestions(registry)).toHaveLength(2)
  })

  it('identischer Content-Fingerprint wird auch über einen späteren, getrennten Importvorgang hinweg erkannt (readLibraryFiles gegen bestehende Registry)', async () => {
    const questions = [mcQuestion({ question: 'Stabil' })]
    const first = await readLibraryFiles([jsonFile('a.json', questions)])
    expect(first.mcBanks).toHaveLength(1)

    const knownFingerprints = new Set([first.mcBanks[0].fingerprint])
    // Gleicher Inhalt, anderer Dateiname, aber jetzt als *eigene* spätere
    // Dateiauswahl (nicht mehr Teil derselben Batch wie oben).
    const second = await readLibraryFiles([jsonFile('a_kopie.json', questions)], knownFingerprints)
    expect(second.mcBanks).toHaveLength(0)
    expect(second.duplicates).toEqual(['a_kopie.json'])
  })
})

describe('Gemeinsamer Pool aus mehreren Banken', () => {
  it('führt mehrere MC-Banken zu einem gemeinsamen Pool zusammen, ohne Trainingseinheiten zu vermischen', () => {
    const mcBanks = {
      'a.json': { fileName: 'a.json', fingerprint: 'fp1', questions: [mcQuestion({ question: 'Q1' })] },
      'b.json': { fileName: 'b.json', fingerprint: 'fp2', questions: [mcQuestion({ question: 'Q2' }), mcQuestion({ question: 'Q3' })] },
    }
    const merged = mergeMcQuestions(mcBanks)
    expect(merged).toHaveLength(3)
    expect(merged.map((q) => q.question).sort()).toEqual(['Q1', 'Q2', 'Q3'])
  })

  it('führt mehrere Trainingseinheiten-Banken zu einem gemeinsamen Pool zusammen', () => {
    const tuBanks = {
      'x.json': { fileName: 'x.json', fingerprint: 'fp1', units: [trainingUnit({ id: 'u1' })] },
      'y.json': { fileName: 'y.json', fingerprint: 'fp2', units: [trainingUnit({ id: 'u2' })] },
    }
    const merged = mergeTrainingUnits(tuBanks)
    expect(merged.map((u) => u.id).sort()).toEqual(['u1', 'u2'])
  })

  it('liefert einen deterministischen, technischen SHA-256-Kombi-Fingerprint für den MC-Pool', async () => {
    const mcBanks = {
      'a.json': { fileName: 'a.json', fingerprint: 'fp1', questions: [mcQuestion()] },
      'b.json': { fileName: 'b.json', fingerprint: 'fp2', questions: [mcQuestion()] },
    }
    const fingerprint = await combinedMcFingerprint(mcBanks)
    expect(fingerprint).toMatch(/^[a-f0-9]{64}$/)
    const fingerprintAgain = await combinedMcFingerprint(mcBanks)
    expect(fingerprintAgain).toBe(fingerprint)
  })
})
