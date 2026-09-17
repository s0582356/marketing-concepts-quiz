import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
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

async function goToQuiz(wrapper) {
  await findButtonByText(wrapper, 'Quiz').trigger('click')
}

async function goToTrainer(wrapper) {
  await findButtonByText(wrapper, 'Methodentrainer').trigger('click')
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('Unified Resume: Quiz (Test 1, 3, 5, 6, 7)', () => {
  it('erkennt eine fortsetzbare Quiz-Sitzung erst nach erneutem Laden derselben Bibliotheken und stellt Position/Score wieder her', async () => {
    const first = mount(App)
    await importLibraryFiles(first, [
      jsonFile('basics.json', [mcQuestion({ question: 'Q1' }), mcQuestion({ question: 'Q2' }), mcQuestion({ question: 'Q3' })]),
      jsonFile('preis.json', [mcQuestion({ question: 'Q4' })]),
    ])
    await goToQuiz(first)
    await findButtonByText(first, 'Mit aktueller Fragebank starten').trigger('click')
    await first.find('.answer-button').trigger('click')
    await findButtonByText(first, 'Nächste Frage').trigger('click')
    first.unmount()

    // Neustart ohne Bibliotheken: Dashboard zeigt einen Checkpoint, aber noch
    // nicht als sofort nutzbar (Bibliotheken erst wieder auswählen).
    const second = mount(App)
    expect(second.find('.dashboard').exists()).toBe(true)
    expect(findButtonByText(second, 'Lernbibliotheken laden und fortsetzen')).toBeTruthy()
    expect(findButtonByText(second, 'Weiterlernen')).toBeFalsy()

    // Dieselben Dateien in VERTAUSCHTER Reihenfolge - der Library-Set-Fingerprint
    // darf davon nicht abhängen (Test 5).
    await importLibraryFiles(second, [
      jsonFile('preis.json', [mcQuestion({ question: 'Q4' })]),
      jsonFile('basics.json', [mcQuestion({ question: 'Q1' }), mcQuestion({ question: 'Q2' }), mcQuestion({ question: 'Q3' })]),
    ])

    await findButtonByText(second, 'Weiterlernen').trigger('click')
    expect(second.find('.quiz-layout').exists()).toBe(true)
    expect(second.text()).toContain('Frage 2 von 4')
    expect(second.text()).toContain('Score')
  })

  it('bietet kein falsches Resume an, wenn nach dem Neuladen andere Bibliotheken gewählt werden (Test 4)', async () => {
    const first = mount(App)
    await importLibraryFiles(first, [jsonFile('basics.json', [mcQuestion({ question: 'Q1' }), mcQuestion({ question: 'Q2' })])])
    await goToQuiz(first)
    await findButtonByText(first, 'Mit aktueller Fragebank starten').trigger('click')
    await first.find('.answer-button').trigger('click')
    first.unmount()

    const second = mount(App)
    await importLibraryFiles(second, [jsonFile('andere_bank.json', [mcQuestion({ question: 'Andere Frage' })])])

    // Ein anderer Fingerprint als der gespeicherte - "Weiterlernen" bleibt gesperrt,
    // stattdessen weiterhin die Aufforderung, die richtigen Bibliotheken zu laden.
    expect(findButtonByText(second, 'Weiterlernen')).toBeFalsy()
    expect(findButtonByText(second, 'Lernbibliotheken laden und fortsetzen')).toBeTruthy()

    await goToQuiz(second)
    // Auch im Quiz-Bereich selbst erscheint keine Weiterlernen-Karte für die falsche Bank.
    expect(second.find('.saved-progress-card').exists()).toBe(false)
  })

  it('bleibt bei Reimport derselben Bank-Inhalte unter geänderten Dateinamen inhaltlich korrekt zugeordnet (Codex Delta Review M-1)', async () => {
    const first = mount(App)
    await importLibraryFiles(first, [
      jsonFile('basics.json', [mcQuestion({ question: 'FromBasics' })]),
      jsonFile('preis.json', [mcQuestion({ question: 'FromPreis' })]),
    ])
    await goToQuiz(first)
    await findButtonByText(first, 'Mit aktueller Fragebank starten').trigger('click')
    await first.find('.answer-button').trigger('click')
    await findButtonByText(first, 'Nächste Frage').trigger('click')
    // Die aktuelle (zweite) Frage der ursprünglichen Sitzung - Referenzwert für den Vergleich.
    const expectedSecondQuestion = first.find('.question-card h2').text()
    first.unmount()

    const second = mount(App)
    // Exakt derselbe Byte-Inhalt wie oben, aber unter Dateinamen, die eine
    // dateinamenbasierte Sortierung genau umkehren würden.
    await importLibraryFiles(second, [
      jsonFile('zzz_renamed_basics.json', [mcQuestion({ question: 'FromBasics' })]),
      jsonFile('aaa_renamed_preis.json', [mcQuestion({ question: 'FromPreis' })]),
    ])
    await findButtonByText(second, 'Weiterlernen').trigger('click')
    // Position 2 von 2 muss inhaltlich exakt dieselbe Frage zeigen wie vor dem
    // Reimport - nicht die andere, durch die Umbenennung vertauschte Frage.
    expect(second.find('.question-card h2').text()).toBe(expectedSecondQuestion)
  })

  it('stellt Score und Serie exakt numerisch wieder her, nicht nur die Anzeige von "Score" (Codex Test-Quality-Hinweis)', async () => {
    const bank = () => [
      jsonFile('basics.json', [
        mcQuestion({ question: 'Q1', options: ['Richtig', 'Falsch'], correctAnswer: 'Richtig' }),
        mcQuestion({ question: 'Q2', options: ['Richtig', 'Falsch'], correctAnswer: 'Richtig' }),
        mcQuestion({ question: 'Q3', options: ['Richtig', 'Falsch'], correctAnswer: 'Richtig' }),
      ]),
    ]
    const first = mount(App)
    await importLibraryFiles(first, bank())
    await goToQuiz(first)
    await findButtonByText(first, 'Mit aktueller Fragebank starten').trigger('click')
    await first.findAll('.answer-button').find((b) => b.text() === 'Richtig').trigger('click')
    await findButtonByText(first, 'Nächste Frage').trigger('click')
    await first.findAll('.answer-button').find((b) => b.text() === 'Falsch').trigger('click')
    await findButtonByText(first, 'Nächste Frage').trigger('click')
    first.unmount()

    const second = mount(App)
    await importLibraryFiles(second, bank())
    await findButtonByText(second, 'Weiterlernen').trigger('click')
    const scoreCardText = second.find('.score-card').text()
    expect(scoreCardText).toContain('Score: 1')
    expect(scoreCardText).toContain('Aktuelle Serie: 0')
  })

  it('setzt eine bereits vollständig abgeschlossene Quiz-Sitzung direkt in der Auswertung fort, nicht im Fragemodus', async () => {
    const bank = () => [jsonFile('basics.json', [mcQuestion({ question: 'Q1' })])]
    const first = mount(App)
    await importLibraryFiles(first, bank())
    await goToQuiz(first)
    await findButtonByText(first, 'Mit aktueller Fragebank starten').trigger('click')
    await first.find('.answer-button').trigger('click')
    await findButtonByText(first, 'Auswertung anzeigen').trigger('click')
    expect(first.find('.result-card').exists()).toBe(true)
    first.unmount()

    const second = mount(App)
    await importLibraryFiles(second, bank())
    await findButtonByText(second, 'Weiterlernen').trigger('click')
    expect(second.find('.result-card').exists()).toBe(true)
    expect(second.find('.quiz-layout').exists()).toBe(false)
  })

  it('behält den Quiz-Fortschritt, auch nachdem zwischendurch der Methodentrainer genutzt wurde (Test 13)', async () => {
    const wrapper = mount(App)
    await importLibraryFiles(wrapper, [jsonFile('basics.json', [mcQuestion({ question: 'Q1' }), mcQuestion({ question: 'Q2' }), mcQuestion({ question: 'Q3' })])])
    await goToQuiz(wrapper)
    await findButtonByText(wrapper, 'Mit aktueller Fragebank starten').trigger('click')
    await wrapper.find('.answer-button').trigger('click')

    await goToTrainer(wrapper)
    expect(wrapper.find('.method-tile').exists()).toBe(true)

    await goToQuiz(wrapper)
    // Der Quiz-Bereich zeigt weiterhin direkt die laufende Sitzung (isQuizStarted
    // blieb erhalten) - die bereits gegebene Antwort ist noch sichtbar, kein Reset.
    expect(wrapper.find('.quiz-layout').exists()).toBe(true)
    expect(wrapper.text()).toContain('Frage 1 von 3')
    expect(wrapper.find('.feedback-box').exists()).toBe(true)
  })
})

describe('Unified Resume: Methodentrainer (Test 8, 9, 10)', () => {
  it('stellt Methode, Trainingseinheit und Modus nach erneutem Laden derselben Bank wieder her', async () => {
    const first = mount(App)
    await importLibraryFiles(first, [
      jsonFile('methodentrainer.json', [
        duelUnit({ id: 'unit-a', prompt: 'Erste Einheit' }),
        duelUnit({ id: 'unit-b', prompt: 'Zweite Einheit' }),
      ]),
    ])
    await goToTrainer(first)
    const duelTile = first.findAll('.method-tile').find((tile) => tile.find('h3').text() === 'Abgrenzungsduell')
    await duelTile.trigger('click')
    await first.find('.training-unit-card .answer-button').trigger('click')
    await findButtonByText(first, 'Weiter').trigger('click')
    first.unmount()

    const second = mount(App)
    await importLibraryFiles(second, [
      jsonFile('methodentrainer.json', [
        duelUnit({ id: 'unit-a', prompt: 'Erste Einheit' }),
        duelUnit({ id: 'unit-b', prompt: 'Zweite Einheit' }),
      ]),
    ])
    await findButtonByText(second, 'Weiterlernen').trigger('click')
    expect(second.text()).toContain('Zweite Einheit')
  })

  it('bietet nach vollständigem Durchlauf keinen falschen Resume der letzten Unit mehr an (Codex Delta Review M-3)', async () => {
    const wrapper = mount(App)
    await importLibraryFiles(wrapper, [
      jsonFile('methodentrainer.json', [
        duelUnit({ id: 'unit-1', prompt: 'Erste Einheit' }),
        duelUnit({ id: 'unit-2', prompt: 'Zweite Einheit' }),
      ]),
    ])
    await goToTrainer(wrapper)
    const duelTile = wrapper.findAll('.method-tile').find((tile) => tile.find('h3').text() === 'Abgrenzungsduell')
    await duelTile.trigger('click')
    // Beide Einheiten vollständig durchspielen.
    await wrapper.find('.training-unit-card .answer-button').trigger('click')
    await findButtonByText(wrapper, 'Weiter').trigger('click')
    await wrapper.find('.training-unit-card .answer-button').trigger('click')
    await findButtonByText(wrapper, 'Weiter').trigger('click')
    expect(wrapper.text()).toContain('Sitzung ausgewertet')

    await findButtonByText(wrapper, 'Andere Methode wählen').trigger('click')
    // Die Sitzung ist fachlich abgeschlossen - kein "Weiterlernen"-Hinweis, der
    // beim Klick nur die zuletzt gesehene Unit (Einheit 2) erneut öffnen würde.
    expect(wrapper.find('.trainer-resume-card').exists()).toBe(false)
  })

  it('Methodentrainer-Checkpoint bleibt nach Zwischennutzung von Mixed Exam bestehen (Test 6)', async () => {
    const wrapper = mount(App)
    await importLibraryFiles(wrapper, [
      jsonFile('basics.json', Array.from({ length: 3 }, (_, i) => mcQuestion({ question: `Frage ${i + 1}` }))),
      jsonFile('methodentrainer.json', [
        duelUnit({ id: 'unit-1', prompt: 'Erste Einheit' }),
        duelUnit({ id: 'unit-2', prompt: 'Zweite Einheit' }),
      ]),
    ])
    await goToTrainer(wrapper)
    const duelTile = wrapper.findAll('.method-tile').find((tile) => tile.find('h3').text() === 'Abgrenzungsduell')
    await duelTile.trigger('click')
    await wrapper.find('.training-unit-card .answer-button').trigger('click')
    await findButtonByText(wrapper, 'Weiter').trigger('click')
    // Jetzt bei "Zweite Einheit" (Position 2 von 2), Sitzung nicht abgeschlossen.

    await findButtonByText(wrapper, 'Andere Methode wählen').trigger('click')
    const mixedTile = wrapper.findAll('.method-tile').find((tile) => tile.find('h3').text() === 'Mixed Transfer Exam')
    await mixedTile.trigger('click')
    await findButtonByText(wrapper, 'Prüfung starten').trigger('click')
    await wrapper.find('.answer-button').trigger('click')

    await findButtonByText(wrapper, 'Andere Methode wählen').trigger('click')
    expect(wrapper.find('.trainer-resume-card').exists()).toBe(true)
    await findButtonByText(wrapper, 'Weiterlernen').trigger('click')
    expect(wrapper.text()).toContain('Zweite Einheit')
  })

  it('Methodentrainer-Fortschritt bleibt erhalten, nachdem zwischendurch das Quiz genutzt wurde (Test 8)', async () => {
    const wrapper = mount(App)
    await importLibraryFiles(wrapper, [
      jsonFile('basics.json', [mcQuestion({ question: 'Q1' }), mcQuestion({ question: 'Q2' })]),
      jsonFile('methodentrainer.json', [
        duelUnit({ id: 'unit-1', prompt: 'Erste Einheit' }),
        duelUnit({ id: 'unit-2', prompt: 'Zweite Einheit' }),
      ]),
    ])
    await goToTrainer(wrapper)
    const duelTile = wrapper.findAll('.method-tile').find((tile) => tile.find('h3').text() === 'Abgrenzungsduell')
    await duelTile.trigger('click')
    await wrapper.find('.training-unit-card .answer-button').trigger('click')
    await findButtonByText(wrapper, 'Weiter').trigger('click')

    await goToQuiz(wrapper)
    await findButtonByText(wrapper, 'Mit aktueller Fragebank starten').trigger('click')
    await wrapper.find('.answer-button').trigger('click')

    await goToTrainer(wrapper)
    expect(wrapper.find('.trainer-resume-card').exists()).toBe(true)
    await findButtonByText(wrapper, 'Weiterlernen').trigger('click')
    expect(wrapper.text()).toContain('Zweite Einheit')
  })

  it('springt beim erneuten Öffnen des Methodentrainers nicht automatisch wieder in eine zuvor über das Dashboard angeforderte Sitzung (echter Realtest-Fund)', async () => {
    const wrapper = mount(App)
    await importLibraryFiles(wrapper, [
      jsonFile('basics.json', Array.from({ length: 3 }, (_, i) => mcQuestion({ question: `Frage ${i + 1}` }))),
      jsonFile('methodentrainer.json', [duelUnit({ id: 'unit-1', prompt: 'Erste Einheit' })]),
    ])
    // Mixed Exam spielen, damit ein "letzter Lernort" für mixedExam entsteht.
    await goToTrainer(wrapper)
    const mixedTile = wrapper.findAll('.method-tile').find((tile) => tile.find('h3').text() === 'Mixed Transfer Exam')
    await mixedTile.trigger('click')
    await findButtonByText(wrapper, 'Prüfung starten').trigger('click')
    await wrapper.find('.answer-button').trigger('click')

    // Über das Dashboard gezielt "Weiterlernen" für Mixed Exam anfordern - das
    // setzt den (einmaligen) resumeRequest-Signalwert in App.vue.
    await findButtonByText(wrapper, 'Dashboard').trigger('click')
    await findButtonByText(wrapper, 'Weiterlernen').trigger('click')
    await settleAsyncImportPipeline()
    expect(wrapper.find('.question-card').exists()).toBe(true)

    // Bereich verlassen und den Methodentrainer ganz regulär über den Reiter
    // erneut öffnen (nicht über das Dashboard) - das einmalige Resume-Signal
    // darf sich nicht wiederholen, sonst landet man immer wieder zwangsweise
    // im Mixed Exam statt in der normalen Methodenübersicht.
    await findButtonByText(wrapper, 'Andere Methode wählen').trigger('click')
    await goToQuiz(wrapper)
    await goToTrainer(wrapper)
    expect(wrapper.find('.method-picker').exists()).toBe(true)
  })
})

describe('lastLearningLocation wird nicht durch bloße Navigation/Import verändert (Test 14)', () => {
  it('bleibt null, solange keine echte Lernaktion stattgefunden hat', async () => {
    const wrapper = mount(App)
    await importLibraryFiles(wrapper, [jsonFile('basics.json', [mcQuestion()])])
    await goToQuiz(wrapper)
    await goToTrainer(wrapper)
    await findButtonByText(wrapper, 'Dashboard').trigger('click')
    expect(wrapper.text()).toContain('Noch keine Lernsitzung')
  })
})

describe('Unified Resume: Mixed Transfer Exam (Test 11)', () => {
  it('setzt eine laufende Prüfung nach erneutem Laden derselben MC-Banken an der richtigen Frage fort', async () => {
    const first = mount(App)
    await importLibraryFiles(first, [
      jsonFile('basics.json', Array.from({ length: 12 }, (_, i) => mcQuestion({ question: `Frage ${i + 1}` }))),
    ])
    await goToTrainer(first)
    const mixedTile = first.findAll('.method-tile').find((tile) => tile.find('h3').text() === 'Mixed Transfer Exam')
    await mixedTile.trigger('click')
    await findButtonByText(first, 'Prüfung starten').trigger('click')
    await first.find('.answer-button').trigger('click')
    first.unmount()

    const second = mount(App)
    await importLibraryFiles(second, [
      jsonFile('basics.json', Array.from({ length: 12 }, (_, i) => mcQuestion({ question: `Frage ${i + 1}` }))),
    ])
    await findButtonByText(second, 'Weiterlernen').trigger('click')
    await settleAsyncImportPipeline()
    // Die erste Frage wurde in der ursprünglichen Sitzung bereits beantwortet,
    // aber nicht mehr weitergeklickt - das Resume landet exakt dort wieder,
    // mit der Antwort weiterhin sichtbar (kein Reset der laufenden Frage).
    expect(second.text()).toContain('Frage 1 von 10')
    expect(second.text()).toContain('Antwort registriert')
  })

  it('bietet nach Abschluss der Prüfung kein falsches Resume mehr an (Test aus Teil E)', async () => {
    const wrapper = mount(App)
    await importLibraryFiles(wrapper, [
      jsonFile('basics.json', Array.from({ length: 3 }, (_, i) => mcQuestion({ question: `Frage ${i + 1}` }))),
    ])
    await goToTrainer(wrapper)
    const mixedTile = wrapper.findAll('.method-tile').find((tile) => tile.find('h3').text() === 'Mixed Transfer Exam')
    await mixedTile.trigger('click')
    await findButtonByText(wrapper, 'Prüfung starten').trigger('click')
    for (let i = 0; i < 3; i++) {
      await wrapper.find('.answer-button').trigger('click')
      const next = findButtonByText(wrapper, 'Nächste Frage') || findButtonByText(wrapper, 'Ergebnis anzeigen')
      await next.trigger('click')
    }
    expect(wrapper.find('.result-card').exists()).toBe(true)

    await findButtonByText(wrapper, 'Andere Methode wählen').trigger('click')
    const mixedTileAgain = wrapper.findAll('.method-tile').find((tile) => tile.find('h3').text() === 'Mixed Transfer Exam')
    await mixedTileAgain.trigger('click')
    expect(findButtonByText(wrapper, 'Weiterlernen')).toBeFalsy()
  })

  it('räumt nach vollständigem Prüfungsabschluss auch den globalen letzten Lernort auf - kein stale Dashboard-Continue (Codex Delta Review M-2)', async () => {
    const wrapper = mount(App)
    await importLibraryFiles(wrapper, [
      jsonFile('basics.json', Array.from({ length: 3 }, (_, i) => mcQuestion({ question: `Frage ${i + 1}` }))),
    ])
    await goToTrainer(wrapper)
    const mixedTile = wrapper.findAll('.method-tile').find((tile) => tile.find('h3').text() === 'Mixed Transfer Exam')
    await mixedTile.trigger('click')
    await findButtonByText(wrapper, 'Prüfung starten').trigger('click')
    for (let i = 0; i < 3; i++) {
      await wrapper.find('.answer-button').trigger('click')
      const next = findButtonByText(wrapper, 'Nächste Frage') || findButtonByText(wrapper, 'Ergebnis anzeigen')
      await next.trigger('click')
    }
    expect(wrapper.find('.result-card').exists()).toBe(true)

    await findButtonByText(wrapper, 'Dashboard').trigger('click')
    // Die einzige bisherige Lernaktivität (die jetzt abgeschlossene Prüfung) darf
    // keinen fortsetzbaren, aber in Wahrheit toten Checkpoint mehr vortäuschen.
    expect(findButtonByText(wrapper, 'Weiterlernen')).toBeFalsy()
    expect(wrapper.text()).toContain('Noch keine Lernsitzung')
  })
})

describe('Unified Resume: gezielter Reset (Test 14)', () => {
  it('löscht beim Verwerfen nur den Quiz-Fortschritt, nicht die anderen Bereiche', async () => {
    const wrapper = mount(App)
    await importLibraryFiles(wrapper, [
      jsonFile('basics.json', [mcQuestion({ question: 'Q1' }), mcQuestion({ question: 'Q2' })]),
      jsonFile('methodentrainer.json', [duelUnit()]),
    ])
    // Methodentrainer zuerst, damit der globale "letzte Lernort" danach durch
    // die Quiz-Aktivität überschrieben wird - "Fortschritt verwerfen" im
    // Dashboard betrifft genau diesen zuletzt genutzten Bereich (Quiz).
    await goToTrainer(wrapper)
    const duelTile = wrapper.findAll('.method-tile').find((tile) => tile.find('h3').text() === 'Abgrenzungsduell')
    await duelTile.trigger('click')
    await wrapper.find('.training-unit-card .answer-button').trigger('click')

    await goToQuiz(wrapper)
    await findButtonByText(wrapper, 'Mit aktueller Fragebank starten').trigger('click')
    await wrapper.find('.answer-button').trigger('click')

    await findButtonByText(wrapper, 'Dashboard').trigger('click')
    await findButtonByText(wrapper, 'Fortschritt verwerfen').trigger('click')

    await goToTrainer(wrapper)
    expect(wrapper.text()).toContain('Weiterlernen')
  })
})

describe('Unified Resume: Robustheit (Test 16, 17)', () => {
  it('startet trotz beschädigtem localStorage-Zustand ohne Absturz', () => {
    window.localStorage.setItem('marketingLearningProgress:v2', '{not valid json')
    expect(() => mount(App)).not.toThrow()
  })

  it('ignoriert einen unbekannten Schema-Stand sicher', () => {
    window.localStorage.setItem('marketingLearningProgress:v2', JSON.stringify({ schemaVersion: 999 }))
    const wrapper = mount(App)
    expect(wrapper.find('.dashboard').exists()).toBe(true)
    expect(findButtonByText(wrapper, 'Lernen starten')).toBeTruthy()
  })
})
