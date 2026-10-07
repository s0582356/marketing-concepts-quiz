import { describe, expect, it } from 'vitest'
import {
  addLibraryBanks,
  classifyLibraryFile,
  combinedMcFingerprint,
  mergeMcQuestions,
  mergeTrainingUnits,
  pickActiveMasterLernmentorBank,
  readLibraryFiles,
} from '../libraryImport.js'
import { syntheticMasterBank } from '../../__tests__/helpers/syntheticMasterBank.js'

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

describe('Merge-Reihenfolge ist dateinamenunabhängig (Codex Delta Review M-1)', () => {
  // Reproduktion: derselbe Bank-Inhalt (gleiche Fingerprints) wird einmal mit
  // Dateinamen importiert, die eine bestimmte Sortierung ergeben, und beim
  // Reimport unter Namen, die eine dateinamenbasierte Sortierung UMKEHREN
  // würden. Da der Library-Set-Fingerprint nur von den (sortierten) Content-
  // Fingerprints abhängt, bleibt er in beiden Fällen identisch - der Resume-
  // Mechanismus akzeptiert also denselben Set-Fingerprint als Match. Wenn die
  // Merge-Reihenfolge dabei trotzdem kippt, zeigen gespeicherte technische
  // Indizes danach auf andere Fragen als ursprünglich gespeichert.
  it('MC-Pool: identischer Fingerprint-Satz ergibt dieselbe Reihenfolge, unabhängig davon, wie die Dateien heißen', () => {
    const original = {
      fpA: { fileName: 'basics.json', fingerprint: 'fpA', questions: [mcQuestion({ question: 'FromA' })] },
      fpB: { fileName: 'preis.json', fingerprint: 'fpB', questions: [mcQuestion({ question: 'FromB' })] },
    }
    // Gleicher Inhalt (gleiche Fingerprints fpA/fpB), aber Dateinamen bewusst so
    // gewählt, dass eine alphabetische Dateinamensortierung die Bankreihenfolge kippt.
    const renamed = {
      fpA: { fileName: 'zzz_renamed.json', fingerprint: 'fpA', questions: [mcQuestion({ question: 'FromA' })] },
      fpB: { fileName: 'aaa_renamed.json', fingerprint: 'fpB', questions: [mcQuestion({ question: 'FromB' })] },
    }
    const mergedOriginal = mergeMcQuestions(original).map((q) => q.question)
    const mergedRenamed = mergeMcQuestions(renamed).map((q) => q.question)
    expect(mergedRenamed).toEqual(mergedOriginal)
  })

  it('Trainingseinheiten-Pool: identischer Fingerprint-Satz ergibt dieselbe Reihenfolge, unabhängig vom Dateinamen', () => {
    const original = {
      fpA: { fileName: 'methoden_a.json', fingerprint: 'fpA', units: [trainingUnit({ id: 'unit-a' })] },
      fpB: { fileName: 'methoden_b.json', fingerprint: 'fpB', units: [trainingUnit({ id: 'unit-b' })] },
    }
    const renamed = {
      fpA: { fileName: 'zzz_renamed.json', fingerprint: 'fpA', units: [trainingUnit({ id: 'unit-a' })] },
      fpB: { fileName: 'aaa_renamed.json', fingerprint: 'fpB', units: [trainingUnit({ id: 'unit-b' })] },
    }
    const mergedOriginal = mergeTrainingUnits(original).map((u) => u.id)
    const mergedRenamed = mergeTrainingUnits(renamed).map((u) => u.id)
    expect(mergedRenamed).toEqual(mergedOriginal)
  })
})

describe('Unified Loader V2: Master-Lernmentor-Erkennung (strukturell)', () => {
  it('erkennt eine Master-Lernmentor-Bank ohne shortLearnAnswer (Test 3)', () => {
    const result = classifyLibraryFile(syntheticMasterBank({ chapters: [[2, 1], [1]] }))
    expect(result.type).toBe('masterLernmentor')
    expect(result.questionCount).toBe(4)
    expect(result.hasShortLearnAnswers).toBe(false)
    expect(result.shortLearnAnswerCount).toBe(0)
  })

  it('erkennt eine Master-Lernmentor-Bank mit shortLearnAnswer (Test 4)', () => {
    const result = classifyLibraryFile(syntheticMasterBank({ chapters: [[2, 1], [1]], shortLearnAnswers: true }))
    expect(result.type).toBe('masterLernmentor')
    expect(result.hasShortLearnAnswers).toBe(true)
    expect(result.shortLearnAnswerCount).toBe(4)
  })

  it('gibt die Bankdaten unverändert weiter (kein Remapping des Contents)', () => {
    const bank = syntheticMasterBank({ shortLearnAnswers: true })
    const snapshot = JSON.stringify(bank)
    const result = classifyLibraryFile(bank)
    expect(result.data).toBe(bank)
    expect(JSON.stringify(bank)).toBe(snapshot)
  })

  it('erkennt den Typ am Inhalt, nicht am Dateinamen (Test 7)', async () => {
    const result = await readLibraryFiles([
      jsonFile('marketing_basics_mc.json', syntheticMasterBank()),
      jsonFile('MASTER_LERNMENTOR.json', [mcQuestion()]),
      jsonFile('irgendwas.json', [trainingUnit()]),
    ])
    expect(result.masterLernmentorBanks.map((bank) => bank.fileName)).toEqual(['marketing_basics_mc.json'])
    expect(result.mcBanks.map((bank) => bank.fileName)).toEqual(['MASTER_LERNMENTOR.json'])
    expect(result.trainingUnitBanks.map((bank) => bank.fileName)).toEqual(['irgendwas.json'])
    expect(result.errors).toEqual([])
  })

  it('lädt alle vier Varianten gleichzeitig und trennt sie sauber (Test 5)', async () => {
    const result = await readLibraryFiles([
      jsonFile('mc1.json', [mcQuestion({ question: 'F1' })]),
      jsonFile('mc2.json', [mcQuestion({ question: 'F2' })]),
      jsonFile('trainer.json', [trainingUnit()]),
      jsonFile('master-alt.json', syntheticMasterBank({ marker: 'ALT' })),
      jsonFile('master-neu.json', syntheticMasterBank({ marker: 'NEU', shortLearnAnswers: true })),
    ])
    expect(result.mcBanks).toHaveLength(2)
    expect(result.trainingUnitBanks).toHaveLength(1)
    expect(result.masterLernmentorBanks).toHaveLength(2)
    expect(result.masterLernmentorBanks.map((bank) => bank.hasShortLearnAnswers)).toEqual([false, true])
    expect(result.errors).toEqual([])
    // Getrennte Fingerprints -> alte und neue Lernmentor-Bank werden nie vermischt.
    const fingerprints = result.masterLernmentorBanks.map((bank) => bank.fingerprint)
    expect(new Set(fingerprints).size).toBe(2)
    fingerprints.forEach((fingerprint) => expect(fingerprint).toMatch(/^[a-f0-9]{64}$/))
  })

  it('meldet eine strukturell defekte Master-Bank verständlich und verliert die gültigen Dateien nicht (Test 6)', async () => {
    const broken = syntheticMasterBank()
    delete broken.chapters[0].topics[0].learningPhase
    const result = await readLibraryFiles([
      jsonFile('mc.json', [mcQuestion()]),
      jsonFile('master-defekt.json', broken),
      jsonFile('kaputt.json', { foo: 'bar' }),
      new File(['{nicht json'], 'syntax.json', { type: 'application/json' }),
      jsonFile('master-ok.json', syntheticMasterBank({ marker: 'OK' })),
    ])
    expect(result.mcBanks).toHaveLength(1)
    expect(result.masterLernmentorBanks.map((bank) => bank.fileName)).toEqual(['master-ok.json'])
    expect(result.errors.map((error) => error.fileName)).toEqual(['master-defekt.json', 'kaputt.json', 'syntax.json'])
    expect(result.errors[0].reason).toContain('learningPhase')
    expect(result.errors[1].reason).toContain('Unbekanntes JSON-Format')
    expect(result.errors[2].reason).toBe('Kein gültiges JSON.')
  })

  it('lehnt ein Topic ohne Fragen ab, wenn es nicht als crossReference gekennzeichnet ist', () => {
    const bank = syntheticMasterBank({ chapters: [[2, 0]] })
    delete bank.chapters[0].topics[1].topicKind
    expect(() => classifyLibraryFile(bank)).toThrow('questions')
  })

  it('lehnt ein mehrdeutiges Array ab, statt es still einem Typ zuzuschlagen (Test 7)', () => {
    const ambiguous = [{ ...mcQuestion(), ...trainingUnit() }]
    expect(() => classifyLibraryFile(ambiguous)).toThrow('Mehrdeutiges JSON-Format')
  })

  it('klassifiziert ein gemischtes Array (MC + Trainingseinheit) nicht falsch', () => {
    expect(() => classifyLibraryFile([mcQuestion(), trainingUnit()])).toThrow('Unbekanntes JSON-Format')
  })

  it('hält ein Objekt ohne "chapters" und ein Array mit "chapters"-Einträgen nicht für eine Master-Bank', () => {
    expect(() => classifyLibraryFile({ questions: [mcQuestion()] })).toThrow('Unbekanntes JSON-Format')
    expect(() => classifyLibraryFile([{ chapters: [] }])).toThrow('Unbekanntes JSON-Format')
    expect(() => classifyLibraryFile({ chapters: [] })).toThrow('chapters')
  })

  it('erkennt eine bereits geladene Master-Bank beim erneuten Import als Duplikat', async () => {
    const file = () => jsonFile('master.json', syntheticMasterBank())
    const first = await readLibraryFiles([file()])
    const second = await readLibraryFiles([file()], new Set([first.masterLernmentorBanks[0].fingerprint]))
    expect(second.masterLernmentorBanks).toHaveLength(0)
    expect(second.duplicates).toEqual(['master.json'])
  })
})

describe('pickActiveMasterLernmentorBank', () => {
  const classic = { fingerprint: 'a'.repeat(64), shortLearnAnswerCount: 0 }
  const withShort = { fingerprint: 'b'.repeat(64), shortLearnAnswerCount: 172 }

  it('bevorzugt die Bank des gespeicherten letzten Lernorts (Resume)', () => {
    expect(pickActiveMasterLernmentorBank([classic, withShort], classic.fingerprint)).toBe(classic)
  })

  it('wählt sonst die Bank mit Kurz-Lernantworten, unabhängig von der Auswahlreihenfolge', () => {
    expect(pickActiveMasterLernmentorBank([classic, withShort])).toBe(withShort)
    expect(pickActiveMasterLernmentorBank([withShort, classic])).toBe(withShort)
    expect(pickActiveMasterLernmentorBank([classic, withShort], 'f'.repeat(64))).toBe(withShort)
  })

  it('wählt bei Gleichstand die zuletzt ausgewählte und liefert null ohne Banken', () => {
    const other = { fingerprint: 'c'.repeat(64), shortLearnAnswerCount: 0 }
    expect(pickActiveMasterLernmentorBank([classic, other])).toBe(other)
    expect(pickActiveMasterLernmentorBank([])).toBeNull()
  })
})
