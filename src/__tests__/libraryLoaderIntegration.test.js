import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App.vue'

function findButtonByText(wrapper, text) {
  return wrapper.findAll('button').find((button) => button.text().trim() === text)
}

function mcQuestion(overrides = {}) {
  return {
    question: 'Standardfrage?',
    options: ['Richtig', 'Falsch A', 'Falsch B', 'Falsch C'],
    correctAnswer: 'Richtig',
    explanation: 'Standarderklärung.',
    category: 'Basics',
    ...overrides,
  }
}

function duelUnit(overrides = {}) {
  return {
    id: 'unit-duel-1',
    method: 'duel',
    modeSupport: ['learn', 'apply', 'exam'],
    prompt: 'Welches Konzept passt hier?',
    choices: ['Konzept A', 'Konzept B'],
    correctAnswer: 'Konzept A',
    ...overrides,
  }
}

function jsonFile(name, data) {
  return new File([JSON.stringify(data)], name, { type: 'application/json' })
}

// Die Import-Pipeline verkettet mehrere echte Web-Crypto-Digest-Aufrufe
// (Datei-Fingerprint je Datei, danach ggf. der Kombi-Fingerprint in App.vue).
// Jeder davon löst über das reale Node-Event-Loop-Threadpool auf, nicht nur
// über die Microtask-Queue - ein fester, kleiner flushPromises()-Loop ist
// dafür nicht in jedem Fall zuverlässig genug (beobachtete Flakiness bei
// mehreren aufeinanderfolgenden Importen in einem Test). Deshalb zusätzlich
// ein kurzer echter Timer-Tick zwischen den flushPromises()-Runden.
async function settleAsyncImportPipeline() {
  for (let tick = 0; tick < 20; tick++) await flushPromises()
  await new Promise((resolve) => setTimeout(resolve, 20))
  for (let tick = 0; tick < 20; tick++) await flushPromises()
}

async function importLibraryFiles(wrapper, files) {
  const input = wrapper.find('.library-loader-card input[type="file"]')
  Object.defineProperty(input.element, 'files', { value: files, configurable: true })
  await input.trigger('change')
  await settleAsyncImportPipeline()
}

// Der alte Einzelimporter (.import-card, "JSON auswählen") statt des
// zentralen Multi-Loaders (.library-loader-card, "Lernbibliotheken laden").
async function importSingleLegacyFile(wrapper, file) {
  const input = wrapper.find('.import-card input[type="file"]')
  Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
  await input.trigger('change')
  await settleAsyncImportPipeline()
}

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Zentraler Lernbibliotheken-Loader', () => {
  it('öffnet über den Button den Dateiauswahl-Dialog (mehrere Dateien möglich)', () => {
    const wrapper = mount(App)
    const input = wrapper.find('.library-loader-card input[type="file"]')
    expect(input.exists()).toBe(true)
    expect(input.attributes('multiple')).toBeDefined()
    expect(input.attributes('accept')).toContain('json')
  })

  it('importiert mehrere MC-Banken gleichzeitig und zeigt eine kompakte Statusanzeige', async () => {
    const wrapper = mount(App)
    await importLibraryFiles(wrapper, [
      jsonFile('marketing_basics.json', [mcQuestion({ question: 'Frage 1' }), mcQuestion({ question: 'Frage 2' })]),
      jsonFile('preispolitik.json', [mcQuestion({ question: 'Frage 3' })]),
    ])

    expect(wrapper.text()).toContain('2 MC-Fragenbank(en)')
    expect(wrapper.text()).toContain('3 MC-Fragen')
  })

  it('importiert eine Methodentrainer-Bank gemeinsam mit MC-Banken in einem Schritt', async () => {
    const wrapper = mount(App)
    await importLibraryFiles(wrapper, [
      jsonFile('marketing_basics.json', [mcQuestion()]),
      jsonFile('methodentrainer_final_39.json', [duelUnit(), duelUnit({ id: 'unit-duel-2' })]),
    ])

    expect(wrapper.text()).toContain('1 MC-Fragenbank(en)')
    expect(wrapper.text()).toContain('1 Methodentrainer-Bank(en)')
    expect(wrapper.text()).toContain('2 Trainingseinheiten')
  })

  it('blockiert gültige Dateien nicht, wenn eine andere Datei ungültig ist, und meldet den Fehler', async () => {
    const wrapper = mount(App)
    await importLibraryFiles(wrapper, [
      jsonFile('valide_bank.json', [mcQuestion()]),
      jsonFile('kaputte_datei.json', [{ irrelevantesFeld: true }]),
    ])

    expect(wrapper.text()).toContain('1 MC-Fragenbank(en)')
    expect(wrapper.text()).toContain('Nicht geladen')
    expect(wrapper.text()).toContain('kaputte_datei.json')
  })

  it('gleicher Inhalt unter anderem Dateinamen dedupliziert zur bestehenden Bank statt einen Pool-Duplikat-Eintrag zu erzeugen (Fall B)', async () => {
    const wrapper = mount(App)
    await importLibraryFiles(wrapper, [
      jsonFile('basics.json', [mcQuestion({ question: 'Q1' })]),
      jsonFile('preis.json', [mcQuestion({ question: 'Q2' })]),
    ])
    expect(wrapper.text()).toContain('2 MC-Fragenbank(en)')
    expect(wrapper.text()).toContain('2 MC-Fragen')

    // Derselbe Inhalt wie basics.json, aber unter anderem Dateinamen erneut
    // ausgewählt (z. B. eine umbenannte Kopie derselben Datei).
    await importLibraryFiles(wrapper, [
      jsonFile('basics_kopie.json', [mcQuestion({ question: 'Q1' })]),
    ])

    // Kein dritter Bank-Eintrag, keine dritte/duplizierte Frage im Pool.
    expect(wrapper.text()).toContain('2 MC-Fragenbank(en)')
    expect(wrapper.text()).toContain('2 MC-Fragen')
    expect(wrapper.text()).toContain('identische Datei(en) übersprungen')
  })

  it('unterschiedlicher Inhalt unter gleichem Dateinamen überschreibt die bestehende Bank nicht still, sondern bleibt als zusätzliche Bank erhalten (Fall C, Codex MAJOR_FIX)', async () => {
    const wrapper = mount(App)
    await importLibraryFiles(wrapper, [
      jsonFile('basics.json', [mcQuestion({ question: 'Alt 1' })]),
      jsonFile('preis.json', [mcQuestion({ question: 'Preis 1' })]),
    ])
    expect(wrapper.text()).toContain('2 MC-Fragen')

    // Andere Datei mit demselben Dateinamen, aber anderem Inhalt (Namenskollision,
    // keine eingebettete Bank-ID verfügbar, um "Update derselben Bank" sicher
    // von "Namenskollision" zu unterscheiden).
    await importLibraryFiles(wrapper, [
      jsonFile('basics.json', [mcQuestion({ question: 'Neu 1' }), mcQuestion({ question: 'Neu 2' })]),
    ])

    // Weder verschwindet die alte Bank still, noch wird der neue Inhalt verworfen:
    // beide bleiben als getrennte Banken erhalten, sichtbar an Banken- und Fragenzahl.
    expect(wrapper.text()).toContain('3 MC-Fragenbank(en)')
    expect(wrapper.text()).toContain('4 MC-Fragen')
  })
})

describe('Quiz nutzt den zentralen privaten MC-Pool', () => {
  it('startet den Quizmodus mit dem zusammengeführten Pool aus mehreren geladenen Banken', async () => {
    const wrapper = mount(App)
    await importLibraryFiles(wrapper, [
      jsonFile('basics.json', [mcQuestion({ question: 'Q1' })]),
      jsonFile('preis.json', [mcQuestion({ question: 'Q2' }), mcQuestion({ question: 'Q3' })]),
    ])

    await findButtonByText(wrapper, 'Mit aktueller Fragebank starten').trigger('click')
    expect(wrapper.find('.quiz-layout').exists()).toBe(true)
    expect(wrapper.text()).toContain('von 3')
  })

  it('bleibt bei der öffentlichen Demo-Bank, solange keine private Bibliothek geladen wurde', () => {
    const wrapper = mount(App)
    expect(wrapper.text()).toContain('Öffentliche Beispiel-Fragen')
  })
})

describe('Mixed Transfer Exam nutzt den zentralen privaten MC-Pool', () => {
  it('nutzt automatisch den gemeinsamen privaten Pool ohne erneute Dateiauswahl', async () => {
    const wrapper = mount(App)
    await importLibraryFiles(wrapper, [
      jsonFile('basics.json', [mcQuestion({ question: 'Q1' })]),
      jsonFile('preis.json', [mcQuestion({ question: 'Q2' }), mcQuestion({ question: 'Q3' })]),
    ])

    await findButtonByText(wrapper, 'Methodentrainer').trigger('click')
    const mixedTile = wrapper.findAll('.method-tile').find((tile) => tile.find('h3').text() === 'Mixed Transfer Exam')
    await mixedTile.trigger('click')

    expect(wrapper.text()).toContain('3 insgesamt')
  })
})

describe('Methodentrainer nutzt die zentrale Trainingseinheiten-Bank', () => {
  it('zeigt die geladenen privaten Trainingseinheiten statt der öffentlichen Demo-Einheiten', async () => {
    const wrapper = mount(App)
    await importLibraryFiles(wrapper, [
      jsonFile('methodentrainer.json', [duelUnit({ prompt: 'Private Frage 1' })]),
    ])

    await findButtonByText(wrapper, 'Methodentrainer').trigger('click')
    expect(wrapper.text()).toContain('Eigene Trainingsdaten: 1 Einheiten aus der Lernbibliothek')
  })
})

describe('MC-Abschluss-Resolver über mehrere geladene MC-Banken', () => {
  it('findet die referenzierte MC-Frage, auch wenn sie in einer anderen geladenen Bank liegt als der Rest des Pools', async () => {
    const wrapper = mount(App)
    await importLibraryFiles(wrapper, [
      // Decoy-Bank ohne die Zielfrage.
      jsonFile('decoy.json', [mcQuestion({ question: 'Decoy-Frage', category: 'Sonstiges' })]),
      // Zielfrage liegt in einer anderen Bank als der Decoy.
      jsonFile('vertrieb.json', [mcQuestion({ question: 'Zielfrage Vertrieb', category: 'Vertriebspolitik' })]),
      jsonFile('methodentrainer.json', [duelUnit({ mcQuestionReference: { category: 'Vertriebspolitik' } })]),
    ])

    await findButtonByText(wrapper, 'Methodentrainer').trigger('click')
    const duelTile = wrapper.findAll('.method-tile').find((tile) => tile.find('h3').text() === 'Abgrenzungsduell')
    await duelTile.trigger('click')

    await wrapper.find('.training-unit-card .answer-button').trigger('click')
    await findButtonByText(wrapper, 'Weiter').trigger('click')

    expect(wrapper.find('.mc-resolver-card').exists()).toBe(true)
    expect(wrapper.text()).toContain('Zielfrage Vertrieb')
  })
})

describe('Tab-Wechsel verliert keine geladenen Bibliotheken (Regressionstest)', () => {
  it('behält private MC-Banken und Trainingseinheiten über mehrfachen Wechsel Quiz <-> Methodentrainer', async () => {
    const wrapper = mount(App)
    await importLibraryFiles(wrapper, [
      jsonFile('basics.json', [mcQuestion({ question: 'Q1' }), mcQuestion({ question: 'Q2' })]),
      jsonFile('methodentrainer.json', [duelUnit(), duelUnit({ id: 'unit-2' })]),
    ])

    await findButtonByText(wrapper, 'Methodentrainer').trigger('click')
    expect(wrapper.text()).toContain('Eigene Trainingsdaten: 2 Einheiten aus der Lernbibliothek')

    await findButtonByText(wrapper, 'Quiz').trigger('click')
    expect(wrapper.text()).toContain('2 MC-Fragen')

    await findButtonByText(wrapper, 'Methodentrainer').trigger('click')
    // Regression: Vor der Fix ging dieser Zustand beim Remount von MethodTrainerApp verloren.
    expect(wrapper.text()).toContain('Eigene Trainingsdaten: 2 Einheiten aus der Lernbibliothek')

    const mixedTile = wrapper.findAll('.method-tile').find((tile) => tile.find('h3').text() === 'Mixed Transfer Exam')
    await mixedTile.trigger('click')
    expect(wrapper.text()).toContain('2 insgesamt')

    await findButtonByText(wrapper, 'Quiz').trigger('click')
    expect(wrapper.text()).toContain('2 MC-Fragen')
  })
})

describe('Legacy-MC-Einzelimporter bleibt an die zentrale Registry gebunden (Codex MAJOR_FIX)', () => {
  it('ergänzt eine über den alten Einzelimporter geladene Bank zur zentralen Registry statt den zentral geladenen Multi-Bank-Pool zu ersetzen - Statusanzeige entspricht der Registry', async () => {
    const wrapper = mount(App)
    await importLibraryFiles(wrapper, [
      jsonFile('basics.json', [mcQuestion({ question: 'Q1' })]),
      jsonFile('preis.json', [mcQuestion({ question: 'Q2' }), mcQuestion({ question: 'Q3' })]),
    ])
    expect(wrapper.text()).toContain('2 MC-Fragenbank(en)')
    expect(wrapper.text()).toContain('3 MC-Fragen')

    await importSingleLegacyFile(wrapper, jsonFile('legacy_einzelimport.json', [mcQuestion({ question: 'Q4' })]))

    // Registry/Statusanzeige zeigt jetzt 3 Banken (2 zentral + 1 Legacy), nicht nur die Legacy-Datei.
    expect(wrapper.text()).toContain('3 MC-Fragenbank(en)')
    expect(wrapper.text()).toContain('4 MC-Fragen')
  })

  it('Quiz startet nach dem Legacy-Einzelimport mit dem vollen zentralen Pool (zentrale Banken + Legacy-Bank)', async () => {
    const wrapper = mount(App)
    await importLibraryFiles(wrapper, [
      jsonFile('basics.json', [mcQuestion({ question: 'Q1' })]),
      jsonFile('preis.json', [mcQuestion({ question: 'Q2' }), mcQuestion({ question: 'Q3' })]),
    ])
    await importSingleLegacyFile(wrapper, jsonFile('legacy_einzelimport.json', [mcQuestion({ question: 'Q4' })]))

    await findButtonByText(wrapper, 'Mit aktueller Fragebank starten').trigger('click')
    expect(wrapper.find('.quiz-layout').exists()).toBe(true)
    expect(wrapper.text()).toContain('von 4')
  })

  it('Mixed Transfer Exam nutzt nach dem Legacy-Einzelimport ebenfalls den vollen zentralen Pool', async () => {
    const wrapper = mount(App)
    await importLibraryFiles(wrapper, [
      jsonFile('basics.json', [mcQuestion({ question: 'Q1' })]),
      jsonFile('preis.json', [mcQuestion({ question: 'Q2' }), mcQuestion({ question: 'Q3' })]),
    ])
    await importSingleLegacyFile(wrapper, jsonFile('legacy_einzelimport.json', [mcQuestion({ question: 'Q4' })]))

    await findButtonByText(wrapper, 'Methodentrainer').trigger('click')
    const mixedTile = wrapper.findAll('.method-tile').find((tile) => tile.find('h3').text() === 'Mixed Transfer Exam')
    await mixedTile.trigger('click')
    expect(wrapper.text()).toContain('4 insgesamt')
  })

  it('MC-Abschluss-Resolver findet nach dem Legacy-Einzelimport auch eine Zielfrage, die ausschließlich in der Legacy-Bank liegt', async () => {
    const wrapper = mount(App)
    await importLibraryFiles(wrapper, [
      jsonFile('decoy.json', [mcQuestion({ question: 'Decoy-Frage', category: 'Sonstiges' })]),
      jsonFile('methodentrainer.json', [duelUnit({ mcQuestionReference: { category: 'Vertriebspolitik' } })]),
    ])
    // Zielfrage liegt ausschließlich in der später über den alten Einzelimporter geladenen Bank.
    await importSingleLegacyFile(wrapper, jsonFile('vertrieb.json', [mcQuestion({ question: 'Zielfrage Vertrieb', category: 'Vertriebspolitik' })]))

    await findButtonByText(wrapper, 'Methodentrainer').trigger('click')
    const duelTile = wrapper.findAll('.method-tile').find((tile) => tile.find('h3').text() === 'Abgrenzungsduell')
    await duelTile.trigger('click')

    await wrapper.find('.training-unit-card .answer-button').trigger('click')
    await findButtonByText(wrapper, 'Weiter').trigger('click')

    expect(wrapper.find('.mc-resolver-card').exists()).toBe(true)
    expect(wrapper.text()).toContain('Zielfrage Vertrieb')
  })

  it('behält Registry, Statusanzeige und aktiven Pool über einen Tab-Wechsel hinweg konsistent nach dem Legacy-Einzelimport', async () => {
    const wrapper = mount(App)
    await importLibraryFiles(wrapper, [jsonFile('basics.json', [mcQuestion({ question: 'Q1' })])])
    await importSingleLegacyFile(wrapper, jsonFile('extra.json', [mcQuestion({ question: 'Q2' })]))
    expect(wrapper.text()).toContain('2 MC-Fragenbank(en)')
    expect(wrapper.text()).toContain('2 MC-Fragen')

    await findButtonByText(wrapper, 'Methodentrainer').trigger('click')
    await findButtonByText(wrapper, 'Quiz').trigger('click')

    expect(wrapper.text()).toContain('2 MC-Fragenbank(en)')
    expect(wrapper.text()).toContain('2 MC-Fragen')
  })
})

describe('TrainingUnitImporter (Legacy) bleibt der zentralen Trainingseinheiten-Registry untergeordnet', () => {
  it('zentral geladene Trainingseinheiten behalten Vorrang vor einem lokalen Legacy-Einzelimport im Methodentrainer, auch nach Tab-Wechsel', async () => {
    const wrapper = mount(App)
    await importLibraryFiles(wrapper, [jsonFile('methodentrainer.json', [duelUnit({ prompt: 'Zentrale Einheit' })])])

    await findButtonByText(wrapper, 'Methodentrainer').trigger('click')
    expect(wrapper.text()).toContain('Eigene Trainingsdaten: 1 Einheiten aus der Lernbibliothek')

    const legacyInput = wrapper.find('.method-trainer .import-card input[type="file"]')
    Object.defineProperty(legacyInput.element, 'files', {
      value: [jsonFile('lokal.json', [duelUnit({ prompt: 'Lokale Einheit' })])],
      configurable: true,
    })
    await legacyInput.trigger('change')
    await flushPromises()

    // Zentrale Registry bleibt maßgeblich - kein zweiter, unabhängiger Trainingszustand.
    expect(wrapper.text()).toContain('Eigene Trainingsdaten: 1 Einheiten aus der Lernbibliothek')

    await findButtonByText(wrapper, 'Quiz').trigger('click')
    await findButtonByText(wrapper, 'Methodentrainer').trigger('click')
    expect(wrapper.text()).toContain('Eigene Trainingsdaten: 1 Einheiten aus der Lernbibliothek')
  })
})

describe('Datenschutz: zentrale Lernbibliotheken bleiben aus dem localStorage', () => {
  it('schreibt beim Import und Spielen mit privaten Bibliotheken keine Frage-/Antworttexte in localStorage', async () => {
    const setItemSpy = vi.spyOn(window.localStorage.__proto__, 'setItem')
    const wrapper = mount(App)

    await importLibraryFiles(wrapper, [
      jsonFile('basics.json', [mcQuestion({ question: 'Streng geheime Frage', explanation: 'Geheime Erklärung' })]),
      jsonFile('methodentrainer.json', [duelUnit({ prompt: 'Geheimer Prompt' })]),
    ])

    await findButtonByText(wrapper, 'Mit aktueller Fragebank starten').trigger('click')
    await wrapper.find('.answer-button').trigger('click')

    for (const call of setItemSpy.mock.calls) {
      const [, value] = call
      expect(value).not.toContain('Streng geheime Frage')
      expect(value).not.toContain('Geheime Erklärung')
      expect(value).not.toContain('Geheimer Prompt')
    }
  })

  it('serialisiert die zentrale Lernbibliotheken-Registry selbst nicht in den localStorage - nur der sanitisierte Fortschritt landet dort', async () => {
    const setItemSpy = vi.spyOn(window.localStorage.__proto__, 'setItem')
    const wrapper = mount(App)

    await importLibraryFiles(wrapper, [
      jsonFile('basics.json', [mcQuestion({ question: 'Q1' })]),
      jsonFile('preis.json', [mcQuestion({ question: 'Q2' })]),
    ])
    await importSingleLegacyFile(wrapper, jsonFile('legacy.json', [mcQuestion({ question: 'Q3' })]))
    await findButtonByText(wrapper, 'Mit aktueller Fragebank starten').trigger('click')

    // Nur der bekannte, allowlisted Fortschrittsspeicher-Key wird beschrieben.
    const usedKeys = new Set(setItemSpy.mock.calls.map(([key]) => key))
    expect(usedKeys).toEqual(new Set(['marketingQuizProgress:v1']))

    for (const [, value] of setItemSpy.mock.calls) {
      const parsed = JSON.parse(value)
      expect(parsed).not.toHaveProperty('mcLibraryBanks')
      expect(parsed).not.toHaveProperty('trainingUnitLibraryBanks')
      expect(JSON.stringify(parsed)).not.toContain('questions')
    }
  })
})
