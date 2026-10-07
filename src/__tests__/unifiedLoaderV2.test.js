import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App.vue'
import { LEARNING_PROGRESS_STORAGE_KEY } from '../utils/learningProgress.js'
import { syntheticMasterBank } from './helpers/syntheticMasterBank.js'

// Ausschließlich synthetische Banken - kein echter Lerninhalt in den Tests.

function findButtonByText(wrapper, text) {
  return wrapper.findAll('button').find((button) => button.text().trim() === text)
}

function mcQuestion(overrides = {}) {
  return {
    question: 'MCSYN_FRAGE?',
    options: ['MCSYN_RICHTIG', 'MCSYN_FALSCH_A', 'MCSYN_FALSCH_B', 'MCSYN_FALSCH_C'],
    correctAnswer: 'MCSYN_RICHTIG',
    explanation: 'MCSYN_ERKLAERUNG',
    category: 'Synthetik',
    ...overrides,
  }
}

function duelUnit(overrides = {}) {
  return {
    id: 'unit-duel-1',
    method: 'duel',
    modeSupport: ['learn', 'apply', 'exam'],
    prompt: 'TUSYN_PROMPT',
    choices: ['TUSYN_A', 'TUSYN_B'],
    correctAnswer: 'TUSYN_A',
    ...overrides,
  }
}

function jsonFile(name, data) {
  return new File([JSON.stringify(data)], name, { type: 'application/json' })
}

const masterClassicFile = () => jsonFile('master-alt.json', syntheticMasterBank({ marker: 'ALT', chapters: [[2, 1], [1]] }))
const masterShortFile = () => jsonFile('master-neu.json', syntheticMasterBank({ marker: 'NEU', chapters: [[2, 1], [1]], shortLearnAnswers: true }))

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

async function openView(wrapper, label) {
  await wrapper.findAll('.view-switcher-button').find((button) => button.text().trim() === label).trigger('click')
}

function progressLines(wrapper) {
  return wrapper.findAll('.master-progress-lines li').map((line) => line.text())
}

// Arbeitet im Master-Lernmentor bis zur zweiten Frage des ersten Themas.
async function advanceMasterToSecondQuestion(wrapper) {
  await openView(wrapper, 'Master-Lernmentor')
  await wrapper.find('.chapter-card button').trigger('click')
  await findButtonByText(wrapper, 'Ich habe es gelesen – jetzt abfragen').trigger('click')
  await findButtonByText(wrapper, 'Antwort prüfen').trigger('click')
  await findButtonByText(wrapper, 'Nächste Frage').trigger('click')
}

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Unified Library Loader V2: ein zentraler Loader für alle Banktypen', () => {
  it('lädt MC-, Methodentrainer- und Master-Lernmentor-Bank in einem Schritt und versorgt alle Bereiche (Test 5, 10)', async () => {
    const wrapper = mount(App)
    await importLibraryFiles(wrapper, [
      jsonFile('mc1.json', [mcQuestion({ question: 'MCSYN_F1?' }), mcQuestion({ question: 'MCSYN_F2?' })]),
      jsonFile('mc2.json', [mcQuestion({ question: 'MCSYN_F3?' })]),
      jsonFile('trainer.json', [duelUnit(), duelUnit({ id: 'unit-duel-2' })]),
      masterShortFile(),
    ])

    const loader = wrapper.find('.library-loader-card')
    expect(loader.text()).toContain('2 MC-Fragenbank(en)')
    expect(loader.text()).toContain('3 MC-Fragen')
    expect(loader.text()).toContain('1 Methodentrainer-Bank(en)')
    expect(loader.text()).toContain('Master-Lernmentor-Bank · 4 Fragen · mit Kurz-Lernantworten')
    expect(loader.text()).toContain('1 Master-Lernmentor-Bank(en) (mit Kurz-Lernantworten)')

    // Master-Lernmentor kennt seine Bank ohne weiteren Upload.
    await openView(wrapper, 'Master-Lernmentor')
    expect(wrapper.find('.chapter-overview').exists()).toBe(true)
    expect(wrapper.find('.master-empty-state').exists()).toBe(false)
    expect(wrapper.text()).toContain('Master-Lernmentor-Bank: master-neu.json')
    expect(wrapper.findAll('.chapter-card')).toHaveLength(2)

    // Quiz kennt die MC-Banken.
    await openView(wrapper, 'Quiz')
    await findButtonByText(wrapper, 'Mit aktueller Fragebank starten').trigger('click')
    expect(wrapper.text()).toContain('Frage 1 von 3')

    // Methodentrainer kennt seine Bank.
    await openView(wrapper, 'Methodentrainer')
    expect(wrapper.text()).toContain('2 Einheiten aus der Lernbibliothek')

    // Alle Banken bleiben über Bereichswechsel hinweg geladen.
    await openView(wrapper, 'Master-Lernmentor')
    expect(wrapper.find('.chapter-overview').exists()).toBe(true)
    expect(wrapper.find('.library-loader-card').text()).toContain('2 MC-Fragenbank(en)')
  })

  it('erkennt eine Master-Lernmentor-Bank ohne shortLearnAnswer und weist die Variante aus (Test 3)', async () => {
    const wrapper = mount(App)
    await importLibraryFiles(wrapper, [masterClassicFile()])
    expect(wrapper.find('.library-loader-card').text()).toContain('Master-Lernmentor-Bank · 4 Fragen · ohne Kurz-Lernantworten')
    await openView(wrapper, 'Master-Lernmentor')
    expect(wrapper.text()).toContain('Master-Lernmentor-Bank: master-alt.json')
  })

  it('es gibt genau ein Datei-Input für Lernbibliotheken im Master-Lernmentor-Bereich (Test 10)', async () => {
    const wrapper = mount(App)
    await openView(wrapper, 'Master-Lernmentor')
    expect(wrapper.findAll('input[type="file"]')).toHaveLength(1)
    expect(wrapper.find('.library-loader-card input[type="file"]').exists()).toBe(true)

    // Der Hinweis-Button im leeren Master-Lernmentor öffnet denselben zentralen Dialog.
    const clickSpy = vi.spyOn(wrapper.find('.library-loader-card input[type="file"]').element, 'click').mockImplementation(() => {})
    await wrapper.find('.master-empty-state button').trigger('click')
    expect(clickSpy).toHaveBeenCalledTimes(1)
  })

  it('verliert gültige Banken nicht, wenn eine Datei der Auswahl ungültig ist, und meldet den Grund (Test 6)', async () => {
    const wrapper = mount(App)
    const brokenMaster = syntheticMasterBank({ marker: 'DEFEKT' })
    delete brokenMaster.chapters[0].topics[0].questions[0].shortModelAnswer
    await importLibraryFiles(wrapper, [
      jsonFile('mc.json', [mcQuestion()]),
      jsonFile('master-defekt.json', brokenMaster),
      jsonFile('unbekannt.json', { irgendwas: true }),
      masterClassicFile(),
    ])

    const loader = wrapper.find('.library-loader-card')
    expect(loader.text()).toContain('1 MC-Fragenbank(en)')
    expect(loader.text()).toContain('Master-Lernmentor-Bank · 4 Fragen')
    expect(loader.text()).toContain('Nicht geladen: master-defekt.json')
    expect(loader.text()).toContain('shortModelAnswer')
    expect(loader.text()).toContain('unbekannt.json (Unbekanntes JSON-Format')
  })

  it('überspringt eine erneut ausgewählte, bereits geladene Master-Bank als Duplikat, ohne den Lernstand zurückzusetzen', async () => {
    const wrapper = mount(App)
    await importLibraryFiles(wrapper, [masterShortFile()])
    await advanceMasterToSecondQuestion(wrapper)
    expect(progressLines(wrapper)[0]).toBe('Frage 2 von 2 in diesem Thema')

    await importLibraryFiles(wrapper, [masterShortFile(), jsonFile('mc.json', [mcQuestion()])])
    expect(wrapper.find('.library-loader-card').text()).toContain('1 identische Datei(en) übersprungen')
    // Weiterhin dieselbe Frage offen - kein Sprung zurück in die Kapitelübersicht.
    expect(progressLines(wrapper)[0]).toBe('Frage 2 von 2 in diesem Thema')
  })
})

describe('Unified Loader V2: Resume-/Fingerprint-Isolation der Master-Lernmentor-Bank (Test 8)', () => {
  it('aktiviert bei alter und neuer Bank in einer Auswahl die mit Kurz-Lernantworten und hält den Fortschritt je Bank getrennt', async () => {
    const wrapper = mount(App)
    await importLibraryFiles(wrapper, [masterClassicFile(), masterShortFile()])
    expect(wrapper.find('.library-loader-card').text()).toContain('2 Master-Lernmentor-Bank(en) (1 davon mit Kurz-Lernantworten)')
    expect(wrapper.find('.library-loader-card').text()).toContain('(2 geladen, eine aktiv)')

    await openView(wrapper, 'Master-Lernmentor')
    expect(wrapper.text()).toContain('Master-Lernmentor-Bank: master-neu.json')

    // Ein Thema in der neuen Bank abschließen.
    await wrapper.find('.chapter-card button').trigger('click')
    await findButtonByText(wrapper, 'Ich habe es gelesen – jetzt abfragen').trigger('click')
    for (let question = 0; question < 2; question++) {
      await findButtonByText(wrapper, 'Antwort prüfen').trigger('click')
      await findButtonByText(wrapper, 'Nächste Frage').trigger('click')
    }
    await findButtonByText(wrapper, 'Zur Kapitelübersicht').trigger('click')
    expect(wrapper.text()).toContain('Master gelernt: 33 %')

    // Umschalten auf die alte Bank: eigener Fingerprint, eigener (leerer) Fortschritt.
    const select = wrapper.find('.master-bank-switcher select')
    const options = select.findAll('option')
    expect(options).toHaveLength(2)
    await select.setValue(options.find((option) => option.text().includes('master-alt.json')).element.value)
    expect(wrapper.text()).toContain('Master-Lernmentor-Bank: master-alt.json')
    expect(wrapper.text()).toContain('Master gelernt: 0 %')

    // Zurück: der Fortschritt der neuen Bank ist unverändert vorhanden.
    await wrapper.find('.master-bank-switcher select').setValue(options.find((option) => option.text().includes('master-neu.json')).element.value)
    expect(wrapper.text()).toContain('Master gelernt: 33 %')

    const store = JSON.parse(window.localStorage.getItem(LEARNING_PROGRESS_STORAGE_KEY))
    const entries = Object.values(store.masterLearnBySetFingerprint)
    expect(entries).toHaveLength(1)
    expect(entries[0].bankFileName).toBe('master-neu.json')
  })

  it('setzt nach einem Neustart über den zentralen Loader an der gespeicherten Frage fort - inklusive Kapitelindex (Test 8, 18)', async () => {
    const first = mount(App)
    await importLibraryFiles(first, [masterShortFile()])
    await advanceMasterToSecondQuestion(first)
    first.unmount()

    const second = mount(App)
    const resumeButton = findButtonByText(second, 'Lernbibliotheken laden und fortsetzen')
    expect(resumeButton).toBeTruthy()

    // "Laden und fortsetzen" öffnet den ZENTRALEN Dateidialog und bleibt auf dem Dashboard.
    const clickSpy = vi.spyOn(second.find('.library-loader-card input[type="file"]').element, 'click').mockImplementation(() => {})
    await resumeButton.trigger('click')
    expect(clickSpy).toHaveBeenCalledTimes(1)
    expect(second.find('.dashboard').exists()).toBe(true)

    await importLibraryFiles(second, [jsonFile('mc.json', [mcQuestion()]), masterShortFile()])
    await findButtonByText(second, 'Weiterlernen').trigger('click')

    expect(second.find('.master-lernmentor').exists()).toBe(true)
    expect(progressLines(second)).toEqual([
      'Frage 2 von 2 in diesem Thema',
      'Frage 2 von 3 im Kapitel',
      'Thema 1 von 2 im Kapitel',
    ])
  })

  it('aktiviert beim Resume die Bank des gespeicherten Lernorts, auch wenn zusätzlich die neuere Bank geladen wird', async () => {
    const first = mount(App)
    await importLibraryFiles(first, [masterClassicFile()])
    await advanceMasterToSecondQuestion(first)
    first.unmount()

    const second = mount(App)
    await importLibraryFiles(second, [masterShortFile(), masterClassicFile()])
    await findButtonByText(second, 'Weiterlernen').trigger('click')
    expect(second.text()).toContain('Master-Lernmentor-Bank: master-alt.json')
    expect(progressLines(second)[0]).toBe('Frage 2 von 2 in diesem Thema')
  })

  it('gibt kein Resume frei, wenn nur eine andere Master-Bank geladen wird', async () => {
    const first = mount(App)
    await importLibraryFiles(first, [masterClassicFile()])
    await advanceMasterToSecondQuestion(first)
    first.unmount()

    const second = mount(App)
    await importLibraryFiles(second, [masterShortFile()])
    expect(findButtonByText(second, 'Weiterlernen')).toBeFalsy()
    expect(findButtonByText(second, 'Lernbibliotheken laden und fortsetzen')).toBeTruthy()
  })

  it('lässt den Quiz-Fingerprint/-Checkpoint unberührt, wenn zusätzlich eine Master-Bank geladen wird', async () => {
    const mcFiles = () => [jsonFile('mc.json', [mcQuestion({ question: 'MCSYN_F1?' }), mcQuestion({ question: 'MCSYN_F2?' })])]
    const first = mount(App)
    await importLibraryFiles(first, mcFiles())
    await openView(first, 'Quiz')
    await findButtonByText(first, 'Mit aktueller Fragebank starten').trigger('click')
    await first.find('.answer-button').trigger('click')
    await findButtonByText(first, 'Nächste Frage').trigger('click')
    first.unmount()

    const second = mount(App)
    await importLibraryFiles(second, [...mcFiles(), masterShortFile(), jsonFile('trainer.json', [duelUnit()])])
    await findButtonByText(second, 'Weiterlernen').trigger('click')
    expect(second.find('.quiz-layout').exists()).toBe(true)
    expect(second.text()).toContain('Frage 2 von 2')
  })
})

describe('Unified Loader V2: Privacy - private Inhalte werden nie persistiert (Test 9)', () => {
  it('schreibt weder Fragen, Antworten, Kurz-Lernantworten noch Mastertexte in localStorage/sessionStorage', async () => {
    const wrapper = mount(App)
    await importLibraryFiles(wrapper, [
      jsonFile('mc.json', [mcQuestion({ question: 'MCSYN_F1?' }), mcQuestion({ question: 'MCSYN_F2?' })]),
      jsonFile('trainer.json', [duelUnit()]),
      masterClassicFile(),
      masterShortFile(),
    ])

    await advanceMasterToSecondQuestion(wrapper)
    await wrapper.find('textarea').setValue('FREITEXT_GEHEIM_4711')
    await findButtonByText(wrapper, 'Antwort prüfen').trigger('click')
    expect(wrapper.text()).toContain('NEU_KURZLERNANTWORT_q002')
    await wrapper.findAll('.self-rating-button')[0].trigger('click')

    await openView(wrapper, 'Quiz')
    await findButtonByText(wrapper, 'Mit aktueller Fragebank starten').trigger('click')
    await wrapper.find('.answer-button').trigger('click')

    const persisted = [
      ...Object.keys(window.localStorage).map((key) => `${key}=${window.localStorage.getItem(key)}`),
      ...Object.keys(window.sessionStorage).map((key) => `${key}=${window.sessionStorage.getItem(key)}`),
    ].join('\n')
    expect(persisted).toContain('masterLearnBySetFingerprint')
    for (const forbidden of ['MCSYN_', 'TUSYN_', 'ALT_', 'NEU_', 'KURZLERNANTWORT', 'MASTERTEXT', 'MUSTERANTWORT', 'AUSZUG', 'KERNPUNKT', 'FREITEXT_GEHEIM']) {
      expect(persisted).not.toContain(forbidden)
    }
  })
})

describe('MC-Antwortpositionen im Quiz (Test 19-26)', () => {
  // Wie in den Fragenbanken: richtige Antwort steht im JSON immer an erster Stelle.
  const bank = () => jsonFile('mc.json', Array.from({ length: 12 }, (_, index) => mcQuestion({ question: `MCSYN_F${index + 1}?` })))

  function optionTexts(wrapper) {
    return wrapper.findAll('.question-card .answer-button').map((button) => button.text())
  }

  it('verteilt die richtige Antwort über viele Quiz-Durchläufe auf alle Positionen (Test 19, 26)', async () => {
    const wrapper = mount(App)
    await importLibraryFiles(wrapper, [bank()])
    await openView(wrapper, 'Quiz')

    const positionCounts = [0, 0, 0, 0]
    let total = 0
    await findButtonByText(wrapper, 'Mit aktueller Fragebank starten').trigger('click')
    for (let run = 0; run < 25; run++) {
      for (let question = 0; question < 12; question++) {
        positionCounts[optionTexts(wrapper).indexOf('MCSYN_RICHTIG')]++
        total++
        await wrapper.find('.question-card .answer-button').trigger('click')
        const next = findButtonByText(wrapper, 'Nächste Frage') ?? findButtonByText(wrapper, 'Auswertung anzeigen')
        await next.trigger('click')
      }
      await findButtonByText(wrapper, 'Neu starten').trigger('click')
    }

    expect(total).toBe(300)
    // Erwartung ~75 je Position; im JSON stünde die richtige Antwort 300x auf Position 1.
    positionCounts.forEach((count) => {
      expect(count).toBeGreaterThan(40)
      expect(count).toBeLessThan(115)
    })
  })

  it('wertet nach dem Mischen über den Antworttext aus, nicht über die Position (Test 20, 25)', async () => {
    const wrapper = mount(App)
    await importLibraryFiles(wrapper, [bank()])
    await openView(wrapper, 'Quiz')
    await findButtonByText(wrapper, 'Mit aktueller Fragebank starten').trigger('click')

    for (let question = 0; question < 12; question++) {
      const buttons = wrapper.findAll('.question-card .answer-button')
      const pickCorrect = question % 2 === 0
      const target = buttons.find((button) => (button.text() === 'MCSYN_RICHTIG') === pickCorrect)
      await target.trigger('click')
      expect(wrapper.find(pickCorrect ? '.feedback-correct' : '.feedback-wrong').exists()).toBe(true)
      const correctButton = wrapper.findAll('.question-card .answer-button').find((button) => button.text() === 'MCSYN_RICHTIG')
      expect(correctButton.classes()).toContain('answer-correct')
      const next = findButtonByText(wrapper, 'Nächste Frage') ?? findButtonByText(wrapper, 'Auswertung anzeigen')
      await next.trigger('click')
    }

    const resultCells = wrapper.findAll('.result-grid div').map((cell) => cell.text())
    expect(resultCells).toContain('Richtige Antworten6')
    expect(resultCells).toContain('Falsche Antworten6')
  })

  it('hält die Reihenfolge einer Frage nach Klick, Re-Render und Bereichswechsel stabil (Test 21, 23)', async () => {
    const wrapper = mount(App)
    await importLibraryFiles(wrapper, [bank()])
    await openView(wrapper, 'Quiz')
    await findButtonByText(wrapper, 'Mit aktueller Fragebank starten').trigger('click')
    const initialOrder = optionTexts(wrapper)

    wrapper.vm.$forceUpdate()
    await wrapper.vm.$nextTick()
    expect(optionTexts(wrapper)).toEqual(initialOrder)

    await wrapper.findAll('.question-card .answer-button')[1].trigger('click')
    expect(optionTexts(wrapper)).toEqual(initialOrder)

    await openView(wrapper, 'Dashboard')
    await openView(wrapper, 'Quiz')
    expect(optionTexts(wrapper)).toEqual(initialOrder)
  })

  it('stellt beim Resume exakt dieselbe Reihenfolge und Markierung wieder her (Test 24)', async () => {
    const first = mount(App)
    await importLibraryFiles(first, [bank()])
    await openView(first, 'Quiz')
    await findButtonByText(first, 'Mit aktueller Fragebank starten').trigger('click')
    const orderBefore = optionTexts(first)
    const wrongIndex = orderBefore.findIndex((text) => text !== 'MCSYN_RICHTIG')
    await first.findAll('.question-card .answer-button')[wrongIndex].trigger('click')
    first.unmount()

    const second = mount(App)
    await importLibraryFiles(second, [bank()])
    await findButtonByText(second, 'Weiterlernen').trigger('click')

    expect(optionTexts(second)).toEqual(orderBefore)
    const buttons = second.findAll('.question-card .answer-button')
    expect(buttons[wrongIndex].classes()).toContain('answer-wrong')
    expect(buttons[orderBefore.indexOf('MCSYN_RICHTIG')].classes()).toContain('answer-correct')
    expect(second.find('.feedback-wrong').exists()).toBe(true)
  })

  it('mischt auch in der Wiederholung falscher Fragen und wertet dort korrekt aus (Review, Test 24)', async () => {
    const wrapper = mount(App)
    await importLibraryFiles(wrapper, [jsonFile('mc.json', [mcQuestion({ question: 'MCSYN_F1?' }), mcQuestion({ question: 'MCSYN_F2?' })])])
    await openView(wrapper, 'Quiz')
    await findButtonByText(wrapper, 'Mit aktueller Fragebank starten').trigger('click')
    for (let question = 0; question < 2; question++) {
      await wrapper.findAll('.question-card .answer-button').find((button) => button.text() !== 'MCSYN_RICHTIG').trigger('click')
      const next = findButtonByText(wrapper, 'Nächste Frage') ?? findButtonByText(wrapper, 'Auswertung anzeigen')
      await next.trigger('click')
    }
    await findButtonByText(wrapper, 'Falsche Fragen wiederholen').trigger('click')
    expect(wrapper.text()).toContain('Wiederholung falscher Fragen')

    for (let question = 0; question < 2; question++) {
      expect([...optionTexts(wrapper)].sort()).toEqual(['MCSYN_FALSCH_A', 'MCSYN_FALSCH_B', 'MCSYN_FALSCH_C', 'MCSYN_RICHTIG'])
      await wrapper.findAll('.question-card .answer-button').find((button) => button.text() === 'MCSYN_RICHTIG').trigger('click')
      expect(wrapper.find('.feedback-correct').exists()).toBe(true)
      const next = findButtonByText(wrapper, 'Nächste Frage') ?? findButtonByText(wrapper, 'Auswertung anzeigen')
      await next.trigger('click')
    }
    expect(wrapper.findAll('.result-grid div').map((cell) => cell.text())).toContain('Richtige Antworten2')
  })

  it('speichert im Checkpoint nur Original-Indizes - keine Antworttexte, keine angezeigte Position als Wahrheit', async () => {
    const wrapper = mount(App)
    await importLibraryFiles(wrapper, [bank()])
    await openView(wrapper, 'Quiz')
    await findButtonByText(wrapper, 'Mit aktueller Fragebank starten').trigger('click')
    const order = optionTexts(wrapper)
    await wrapper.findAll('.question-card .answer-button').find((button) => button.text() === 'MCSYN_RICHTIG').trigger('click')

    const store = JSON.parse(window.localStorage.getItem(LEARNING_PROGRESS_STORAGE_KEY))
    const checkpoint = Object.values(store.quizBySetFingerprint)[0]
    // Richtige Antwort ist Original-Index 0 - unabhängig davon, wo sie angezeigt wurde.
    expect(checkpoint.selectedOptionIndices[0]).toBe(0)
    expect(checkpoint.optionOrders[0].indexOf(0)).toBe(order.indexOf('MCSYN_RICHTIG'))
    expect(JSON.stringify(store)).not.toContain('MCSYN_')
  })
})
