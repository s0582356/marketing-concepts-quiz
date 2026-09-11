import { describe, expect, it } from 'vitest'
import { resolveMcQuestion, TRAINING_METHODS, unitsForMethod, unitsForMethods, validateTrainingUnits } from '../trainingUnits.js'
import sampleTrainingUnits from '../../data/public/sampleTrainingUnits.json'
import sampleQuestions from '../../data/public/sampleQuestions.json'

function validDuelUnit(overrides = {}) {
  return {
    id: 'unit-1',
    method: 'duel',
    prompt: 'Testfall',
    choices: ['Option A', 'Option B'],
    correctAnswer: 'Option A',
    ...overrides,
  }
}

describe('validateTrainingUnits', () => {
  it('akzeptiert die öffentlichen Demo-Trainingseinheiten', () => {
    const units = validateTrainingUnits(sampleTrainingUnits)
    expect(units.length).toBe(sampleTrainingUnits.length)
    expect(units.every((unit) => TRAINING_METHODS.includes(unit.method))).toBe(true)
  })

  it('enthält in den öffentlichen Demo-Daten nie sourceReference und referenziert MC-Fragen nur über in sampleQuestions.json vorhandene Kategorien (Test 18)', () => {
    const publicCategories = new Set(sampleQuestions.map((q) => q.category))
    sampleTrainingUnits.forEach((unit) => {
      expect(unit.sourceReference).toBeUndefined()
      if (unit.mcQuestionReference?.category) {
        expect(publicCategories.has(unit.mcQuestionReference.category)).toBe(true)
      }
    })
  })

  it('lehnt einen Datensatz mit ungültiger method ab (Test 14)', () => {
    expect(() => validateTrainingUnits([validDuelUnit({ method: 'unknown' })])).toThrow()
  })

  it('lehnt einen Datensatz ohne prompt ab', () => {
    const unit = validDuelUnit()
    delete unit.prompt
    expect(() => validateTrainingUnits([unit])).toThrow()
  })

  it('lehnt einen Datensatz mit weniger als zwei choices ab', () => {
    expect(() => validateTrainingUnits([validDuelUnit({ choices: ['Nur eine Option'] })])).toThrow()
  })

  it('lehnt einen Datensatz ab, dessen correctAnswer nicht in choices enthalten ist', () => {
    expect(() => validateTrainingUnits([validDuelUnit({ correctAnswer: 'Nicht in choices' })])).toThrow()
  })

  it('lehnt ein leeres Array ab', () => {
    expect(() => validateTrainingUnits([])).toThrow()
  })

  it('lehnt Nicht-Array-Eingaben ab', () => {
    expect(() => validateTrainingUnits({})).toThrow()
  })

  it('lehnt eine ungültige modeSupport-Angabe ab', () => {
    expect(() => validateTrainingUnits([validDuelUnit({ modeSupport: ['learn', 'unknown-mode'] })])).toThrow()
  })

  it('setzt modeSupport standardmäßig auf alle drei Modi', () => {
    const [unit] = validateTrainingUnits([validDuelUnit()])
    expect(unit.modeSupport).toEqual(['learn', 'apply', 'exam'])
  })

  it('übernimmt optionale Felder wie decisiveClue und compassPath korrekt', () => {
    const [unit] = validateTrainingUnits([
      validDuelUnit({ compassPath: ['Marketingmix', 'Preispolitik'], decisiveClue: 'Testmerkmal' }),
    ])
    expect(unit.compassPath).toEqual(['Marketingmix', 'Preispolitik'])
    expect(unit.decisiveClue).toBe('Testmerkmal')
  })
})

describe('unitsForMethod', () => {
  it('filtert nach Methode und aktuellem Modus', () => {
    const units = validateTrainingUnits([
      validDuelUnit({ id: 'a', modeSupport: ['learn'] }),
      validDuelUnit({ id: 'b', modeSupport: ['exam'] }),
      { ...validDuelUnit({ id: 'c' }), method: 'misconception' },
    ])
    expect(unitsForMethod(units, 'duel', 'learn').map((u) => u.id)).toEqual(['a'])
    expect(unitsForMethod(units, 'duel', 'exam').map((u) => u.id)).toEqual(['b'])
    expect(unitsForMethod(units, 'misconception', 'learn').map((u) => u.id)).toEqual(['c'])
  })

  it('unitsForMethods gruppiert mehrere Datenmethoden unter einer Kachel (Matrix + Prozess)', () => {
    const units = validateTrainingUnits([
      validMatrixUnit({ id: 'm' }),
      validProcessUnit({ id: 'p' }),
      validDuelUnit({ id: 'd' }),
    ])
    expect(unitsForMethods(units, ['matrix', 'process'], 'learn').map((u) => u.id).sort()).toEqual(['m', 'p'])
  })
})

function validCaseUnit(overrides = {}) {
  return {
    id: 'case-1',
    method: 'case',
    prompt: 'Fall-Text',
    choices: ['A', 'B', 'C', 'D'],
    correctAnswer: 'A',
    ...overrides,
  }
}

function validAssignmentUnit(overrides = {}) {
  return {
    id: 'assignment-1',
    method: 'assignment',
    prompt: 'Ordne zu.',
    items: [{ id: 'i1', label: 'Item 1' }, { id: 'i2', label: 'Item 2' }],
    targets: [{ id: 't1', label: 'Ziel 1' }, { id: 't2', label: 'Ziel 2' }],
    assignments: { i1: 't1', i2: 't2' },
    ...overrides,
  }
}

function validMatrixUnit(overrides = {}) {
  return {
    id: 'matrix-1',
    method: 'matrix',
    prompt: 'Wo gehört das hin?',
    rowLabels: ['Zeile 1', 'Zeile 2'],
    columnLabels: ['Spalte 1', 'Spalte 2'],
    correctCell: { row: 'Zeile 1', column: 'Spalte 2' },
    ...overrides,
  }
}

function validProcessUnit(overrides = {}) {
  return {
    id: 'process-1',
    method: 'process',
    prompt: 'Bringe in die richtige Reihenfolge.',
    steps: [{ id: 's1', label: 'Schritt 1' }, { id: 's2', label: 'Schritt 2' }],
    correctOrder: ['s1', 's2'],
    ...overrides,
  }
}

describe('validateTrainingUnits - case (Fall-Entscheider)', () => {
  it('akzeptiert einen gültigen Fall mit vier Antwortalternativen', () => {
    const [unit] = validateTrainingUnits([validCaseUnit()])
    expect(unit.choices.length).toBe(4)
  })

  it('unterstützt auch zwei Antwortalternativen', () => {
    const [unit] = validateTrainingUnits([validCaseUnit({ choices: ['A', 'B'], correctAnswer: 'A' })])
    expect(unit.choices.length).toBe(2)
  })

  it('übernimmt reasoning korrekt', () => {
    const [unit] = validateTrainingUnits([validCaseUnit({ reasoning: 'Fall -> Signal -> Regel -> Antwort' })])
    expect(unit.reasoning).toBe('Fall -> Signal -> Regel -> Antwort')
  })
})

describe('validateTrainingUnits - assignment (Drag-&-Drop)', () => {
  it('akzeptiert eine gültige Zuordnungseinheit', () => {
    const [unit] = validateTrainingUnits([validAssignmentUnit()])
    expect(unit.items.length).toBe(2)
    expect(unit.assignments).toEqual({ i1: 't1', i2: 't2' })
  })

  it('lehnt eine Zuordnung ab, bei der ein Item fehlt', () => {
    const unit = validAssignmentUnit({ assignments: { i1: 't1' } })
    expect(() => validateTrainingUnits([unit])).toThrow()
  })

  it('lehnt eine Zuordnung auf ein unbekanntes Ziel ab', () => {
    const unit = validAssignmentUnit({ assignments: { i1: 't1', i2: 'unbekannt' } })
    expect(() => validateTrainingUnits([unit])).toThrow()
  })

  it('lehnt doppelte Item-IDs ab', () => {
    const unit = validAssignmentUnit({ items: [{ id: 'i1', label: 'A' }, { id: 'i1', label: 'B' }] })
    expect(() => validateTrainingUnits([unit])).toThrow()
  })
})

describe('validateTrainingUnits - matrix', () => {
  it('akzeptiert eine gültige Matrixeinheit', () => {
    const [unit] = validateTrainingUnits([validMatrixUnit()])
    expect(unit.correctCell).toEqual({ row: 'Zeile 1', column: 'Spalte 2' })
  })

  it('lehnt correctCell mit unbekannter Zeile/Spalte ab', () => {
    const unit = validMatrixUnit({ correctCell: { row: 'Unbekannt', column: 'Spalte 1' } })
    expect(() => validateTrainingUnits([unit])).toThrow()
  })
})

describe('validateTrainingUnits - process', () => {
  it('akzeptiert eine gültige Prozesseinheit', () => {
    const [unit] = validateTrainingUnits([validProcessUnit()])
    expect(unit.correctOrder).toEqual(['s1', 's2'])
  })

  it('lehnt correctOrder ab, die keine Permutation der Schritte ist', () => {
    const unit = validProcessUnit({ correctOrder: ['s1', 's1'] })
    expect(() => validateTrainingUnits([unit])).toThrow()
  })

  it('lehnt correctOrder mit unbekannter Schritt-ID ab', () => {
    const unit = validProcessUnit({ correctOrder: ['s1', 'unbekannt'] })
    expect(() => validateTrainingUnits([unit])).toThrow()
  })
})

describe('resolveMcQuestion (Test 16, 17)', () => {
  const mcQuestions = [
    { id: 1, category: 'Preispolitik', question: 'Was ist Skimming?', options: ['a', 'b'], correctAnswer: 'a', explanation: 'x' },
    { id: 2, category: 'Preispolitik', question: 'Was ist Penetration?', options: ['a', 'b'], correctAnswer: 'b', explanation: 'y' },
  ]

  it('findet eine vorhandene passende Frage über category + question (Test 16)', () => {
    const match = resolveMcQuestion(mcQuestions, { category: 'Preispolitik', question: 'Was ist Penetration?' })
    expect(match?.id).toBe(2)
  })

  it('findet über category allein die erste passende Frage, wenn question nicht gesetzt ist', () => {
    const match = resolveMcQuestion(mcQuestions, { category: 'Preispolitik', question: null })
    expect(match?.id).toBe(1)
  })

  it('liefert null statt zu werfen, wenn keine Referenz passt (Test 17)', () => {
    expect(resolveMcQuestion(mcQuestions, { category: 'Unbekanntes Thema', question: null })).toBeNull()
    expect(resolveMcQuestion([], { category: 'Preispolitik' })).toBeNull()
    expect(resolveMcQuestion(mcQuestions, null)).toBeNull()
  })
})
