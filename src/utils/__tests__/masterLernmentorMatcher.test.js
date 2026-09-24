import { describe, expect, it } from 'vitest'
import { checkAnswer } from '../masterLernmentorMatcher.js'

function question(overrides = {}) {
  return {
    coreConcepts: [
      { conceptId: 'c01', label: 'Marktorientierte Ausrichtung', acceptedPhrases: ['Entscheidungen, Ziele und Instrumente werden am Markt ausgerichtet'] },
      { conceptId: 'c02', label: 'Abgrenzung zu Werbung', acceptedPhrases: ['Marketing ist mehr als Werbung'] },
    ],
    optionalConcepts: [
      { conceptId: 'o01', label: 'Systematische Einbeziehung von Marktinformationen' },
    ],
    responseRequirements: { requiresAllCoreConcepts: true, minimumItems: 2, minimumExamples: null, minimumExamplesPerGroup: null },
    answerFlexibility: { wordingMatchRequired: false, equivalentOwnExamplesAllowed: false, caseBound: false },
    ...overrides,
  }
}

describe('checkAnswer (Test 17: wordingMatchRequired=false respektiert)', () => {
  it('erkennt ein Kernkonzept auch bei abweichender Formulierung (keine exakte Wortgleichheit nötig)', () => {
    const result = checkAnswer(question(), 'Unternehmen richten ihre Entscheidungen und Ziele am Markt aus.')
    expect(result.coreConcepts[0].matched).toBe(true)
  })

  it('erkennt beide Kernkonzepte bei einer vollständigen eigenen Antwort', () => {
    const result = checkAnswer(question(), 'Marketing richtet Entscheidungen, Ziele und Instrumente am Markt aus und ist mehr als nur Werbung.')
    expect(result.matchedCoreCount).toBe(2)
    expect(result.allCoreConceptsMatched).toBe(true)
  })

  it('markiert kein Konzept bei leerer Antwort, ohne zu crashen', () => {
    const result = checkAnswer(question(), '')
    expect(result.hasAnswer).toBe(false)
    expect(result.coreConcepts.every((c) => c.matched === false)).toBe(true)
  })

  it('meldet fehlende Kernpunkte neutral, wenn nicht alle CoreConcepts erkannt wurden (Test 19/20)', () => {
    const result = checkAnswer(question(), 'Entscheidungen, Ziele und Instrumente werden konsequent am Markt ausgerichtet.')
    expect(result.matchedCoreCount).toBe(1)
    expect(result.totalCoreCount).toBe(2)
    expect(result.requiresAllCoreConcepts).toBe(true)
    expect(result.allCoreConceptsMatched).toBe(false)
  })

  it('zeigt einen Hinweis auf eigene Beispiele, wenn equivalentOwnExamplesAllowed=true, statt fälschlich rot zu markieren (Test 18)', () => {
    const q = question({ answerFlexibility: { wordingMatchRequired: false, equivalentOwnExamplesAllowed: true, caseBound: false } })
    const result = checkAnswer(q, 'Eine völlig eigene Formulierung mit einem eigenen Beispiel.')
    expect(result.notes.some((note) => note.includes('Eigenes Beispiel'))).toBe(true)
  })

  it('gibt einen Beispiel-Hinweis aus, wenn minimumExamples gesetzt ist, ohne es hart zu bewerten', () => {
    const q = question({ responseRequirements: { requiresAllCoreConcepts: true, minimumItems: 2, minimumExamples: 1, minimumExamplesPerGroup: null } })
    const result = checkAnswer(q, 'Antwort ohne erkennbares Beispiel.')
    expect(result.notes.some((note) => note.includes('mindestens 1 Beispiel'))).toBe(true)
  })

  it('erkennt optionalConcepts getrennt von coreConcepts', () => {
    const result = checkAnswer(question(), 'Kunden, Wettbewerb und Umfeld fließen systematisch als Marktinformationen ein.')
    expect(result.optionalConcepts[0].matched).toBe(true)
  })
})

// Codex Technical Red Team, Finding M-01 (MAJOR): minimumItems/minimumExamples/
// minimumExamplesPerGroup sind Anforderungen an den Fragewortlaut, NICHT die
// Anzahl der coreConcepts-Objekte. Ein CoreConcept kann mehrere fachliche
// Elemente bündeln - die reale Bank enthält Fragen mit minimumItems deutlich
// über der Anzahl vorhandener coreConcepts (z.B. minimumItems: 7, nur 2-3
// coreConcepts). Die App darf daraus nie "7 Kernpunkte müssen erkannt werden"
// ableiten.
describe('MAJOR-Regressionstest: minimumItems ist nicht die Anzahl erforderlicher CoreConcepts', () => {
  function questionWithMismatch(overrides = {}) {
    return question({
      // Nur 2 coreConcepts, aber der Fragewortlaut verlangt (laut minimumItems) 7 Punkte -
      // genau die reale Konstellation aus dem Codex-Bericht.
      responseRequirements: { requiresAllCoreConcepts: true, minimumItems: 7, minimumExamples: null, minimumExamplesPerGroup: null },
      ...overrides,
    })
  }

  it('A) verlangt NICHT 7 CoreConcepts - beide vorhandenen CoreConcepts reichen für allCoreConceptsMatched=true', () => {
    const result = checkAnswer(questionWithMismatch(), 'Marketing richtet Entscheidungen, Ziele und Instrumente am Markt aus und ist mehr als nur Werbung.')
    expect(result.totalCoreCount).toBe(2)
    expect(result.matchedCoreCount).toBe(2)
    expect(result.allCoreConceptsMatched).toBe(true)
  })

  it('B) erzeugt keinen unmöglichen "noch X Kernpunkte"-Hinweis - es gibt kein Feld, das minimumItems gegen matchedCoreCount vergleicht', () => {
    const result = checkAnswer(questionWithMismatch(), 'Nur ein Teil der Antwort.')
    expect(result).not.toHaveProperty('requiredCount')
    expect(result).not.toHaveProperty('meetsRequiredCount')
    // requiresAllCoreConcepts/allCoreConceptsMatched beziehen sich ausschließlich
    // auf totalCoreCount (2), nie auf minimumItems (7).
    expect(result.totalCoreCount).toBe(2)
  })

  it('C) stellt die Mengenanforderung separat und neutral dar, ohne eine erkannte Anzahl zu behaupten', () => {
    const result = checkAnswer(questionWithMismatch(), 'Irgendeine Antwort.')
    const minimumItemsNote = result.notes.find((note) => note.includes('mindestens 7'))
    expect(minimumItemsNote).toBeTruthy()
    // Neutral: fordert zur Selbstprüfung auf, behauptet keine erkannte Anzahl.
    expect(minimumItemsNote).toContain('Prüfe, ob du diese Anzahl vollständig genannt hast')
    expect(minimumItemsNote).not.toMatch(/\d+\s*(von|erkannt)/)
  })

  it('D) die echte CoreConcept-Erkennung funktioniert unverändert weiter', () => {
    const result = checkAnswer(questionWithMismatch(), 'Nur Entscheidungen, Ziele und Instrumente werden am Markt ausgerichtet.')
    expect(result.coreConcepts[0].matched).toBe(true)
    expect(result.coreConcepts[1].matched).toBe(false)
    expect(result.matchedCoreCount).toBe(1)
  })

  it('zeigt weiterhin den "nicht alle Kernpunkte"-Hinweis korrekt, wenn requiresAllCoreConcepts=true und CoreConcepts fehlen (unabhängig von minimumItems)', () => {
    const result = checkAnswer(questionWithMismatch(), 'Nur ein Teil der Antwort ohne Treffer.')
    expect(result.requiresAllCoreConcepts).toBe(true)
    expect(result.allCoreConceptsMatched).toBe(false)
  })
})

describe('Quantitative Anforderungen bleiben getrennt von der CoreConcept-Zählung (Test 10)', () => {
  it('minimumItems: null erzeugt keinen Hinweis', () => {
    const result = checkAnswer(question({ responseRequirements: { requiresAllCoreConcepts: true, minimumItems: null, minimumExamples: null, minimumExamplesPerGroup: null } }), 'Text.')
    expect(result.notes.some((note) => note.includes('Punkt'))).toBe(false)
  })

  it('minimumExamples: null erzeugt keinen Beispiel-Hinweis', () => {
    const result = checkAnswer(question({ responseRequirements: { requiresAllCoreConcepts: true, minimumItems: null, minimumExamples: null, minimumExamplesPerGroup: null } }), 'Text.')
    expect(result.notes.some((note) => note.includes('Beispiel'))).toBe(false)
  })

  it('minimumExamplesPerGroup wird als eigener, von coreConcepts unabhängiger Hinweis ausgegeben', () => {
    const result = checkAnswer(question({ responseRequirements: { requiresAllCoreConcepts: true, minimumItems: null, minimumExamples: null, minimumExamplesPerGroup: 3 } }), 'Text.')
    const note = result.notes.find((n) => n.includes('je Gruppe'))
    expect(note).toContain('mindestens 3 Beispiele je Gruppe')
    expect(result.totalCoreCount).toBe(2)
  })

  it('alle drei quantitativen Felder gleichzeitig gesetzt erzeugen drei getrennte, neutrale Hinweise', () => {
    const result = checkAnswer(question({ responseRequirements: { requiresAllCoreConcepts: true, minimumItems: 5, minimumExamples: 2, minimumExamplesPerGroup: 1 } }), 'Text.')
    expect(result.notes.filter((n) => n.includes('mindestens'))).toHaveLength(3)
  })
})
