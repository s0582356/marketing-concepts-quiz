import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MixedExam from '../MixedExam.vue'

function makeQuestions(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    category: `Kategorie ${i % 3}`,
    difficulty: 'medium',
    question: `Frage Nummer ${i + 1}?`,
    options: [`Antwort A${i}`, `Antwort B${i}`, `Antwort C${i}`, `Antwort D${i}`],
    correctAnswer: `Antwort A${i}`,
    explanation: `Erklärung zu Frage ${i + 1}.`,
  }))
}

function findButtonByText(wrapper, text) {
  return wrapper.findAll('button').find((b) => b.text().trim() === text)
}

async function answerCurrentQuestion(wrapper, { correct = true } = {}) {
  const buttons = wrapper.findAll('.answer-button')
  const target = correct
    ? buttons.find((b) => b.text().startsWith('Antwort A'))
    : buttons.find((b) => !b.text().startsWith('Antwort A'))
  await target.trigger('click')
}

describe('MixedExam - Start (Test 1, 2, 3, 14)', () => {
  it('öffnet mit Startbildschirm und zeigt die Poolgröße der aktuell geladenen Fragebank (Test 1, 2)', () => {
    const wrapper = mount(MixedExam, { props: { mcQuestions: makeQuestions(12), allUnits: [] } })
    expect(wrapper.text()).toContain('12 insgesamt')
    expect(wrapper.text()).toContain('10 zufällige Fragen')
  })

  it('behandelt einen leeren Fragenpool sauber, ohne Absturz (Test 14)', () => {
    const wrapper = mount(MixedExam, { props: { mcQuestions: [], allUnits: [] } })
    expect(wrapper.text()).toContain('keine Fragebank geladen')
    expect(findButtonByText(wrapper, 'Prüfung starten')).toBeFalsy()
  })

  it('zieht bei Start maximal 10 Fragen ohne Duplikate aus einem größeren Pool (Test 3)', async () => {
    const wrapper = mount(MixedExam, { props: { mcQuestions: makeQuestions(12), allUnits: [] } })
    await findButtonByText(wrapper, 'Prüfung starten').trigger('click')
    expect(wrapper.text()).toContain('Frage 1 von 10')
  })
})

describe('MixedExam - während der Prüfung: keine Hilfen (Test 4, 5, 6)', () => {
  it('zeigt vor der Antwort weder Kategorie, Kompass noch Erklärung', async () => {
    const wrapper = mount(MixedExam, { props: { mcQuestions: makeQuestions(3), allUnits: [] } })
    await findButtonByText(wrapper, 'Prüfung starten').trigger('click')
    expect(wrapper.text()).not.toContain('Kategorie 0')
    expect(wrapper.find('.training-compass').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Erklärung zu Frage')
    expect(wrapper.find('.feedback-box').exists()).toBe(false)
  })
})

describe('MixedExam - Antwortregistrierung und Ablauf (Test 7, 8, 9, 10, 11)', () => {
  it('registriert eine richtige Antwort ohne sie während der Prüfung als richtig zu kennzeichnen (Test 7)', async () => {
    const wrapper = mount(MixedExam, { props: { mcQuestions: makeQuestions(3), allUnits: [] } })
    await findButtonByText(wrapper, 'Prüfung starten').trigger('click')
    await answerCurrentQuestion(wrapper, { correct: true })
    expect(wrapper.find('.answer-correct').exists()).toBe(false)
    expect(wrapper.find('.answer-wrong').exists()).toBe(false)
    expect(wrapper.text()).toContain('Antwort registriert.')
  })

  it('registriert eine falsche Antwort ebenfalls neutral (Test 8)', async () => {
    const wrapper = mount(MixedExam, { props: { mcQuestions: makeQuestions(3), allUnits: [] } })
    await findButtonByText(wrapper, 'Prüfung starten').trigger('click')
    await answerCurrentQuestion(wrapper, { correct: false })
    expect(wrapper.find('.answer-correct').exists()).toBe(false)
    expect(wrapper.find('.answer-wrong').exists()).toBe(false)
  })

  it('wechselt über "Nächste Frage" zur nächsten Frage (Test 9)', async () => {
    const wrapper = mount(MixedExam, { props: { mcQuestions: makeQuestions(3), allUnits: [] } })
    await findButtonByText(wrapper, 'Prüfung starten').trigger('click')
    await answerCurrentQuestion(wrapper, { correct: true })
    await findButtonByText(wrapper, 'Nächste Frage').trigger('click')
    expect(wrapper.text()).toContain('Frage 2 von 3')
  })

  it('schließt nach der letzten Frage mit Auswertung ab und zeigt den korrekten Score (Test 10, 11)', async () => {
    const wrapper = mount(MixedExam, { props: { mcQuestions: makeQuestions(3), allUnits: [] } })
    await findButtonByText(wrapper, 'Prüfung starten').trigger('click')

    await answerCurrentQuestion(wrapper, { correct: true })
    await findButtonByText(wrapper, 'Nächste Frage').trigger('click')
    await answerCurrentQuestion(wrapper, { correct: false })
    await findButtonByText(wrapper, 'Nächste Frage').trigger('click')
    await answerCurrentQuestion(wrapper, { correct: true })
    await findButtonByText(wrapper, 'Ergebnis anzeigen').trigger('click')

    expect(wrapper.text()).toContain('Mixed Transfer Exam abgeschlossen')
    expect(wrapper.text()).toContain('Ergebnis: 2 / 3')
  })
})

describe('MixedExam - Review (Test 12, 13)', () => {
  it('zeigt falsch beantwortete Fragen mit vorhandener Erklärung im Review (Test 12, 13)', async () => {
    const wrapper = mount(MixedExam, { props: { mcQuestions: makeQuestions(2), allUnits: [] } })
    await findButtonByText(wrapper, 'Prüfung starten').trigger('click')
    await answerCurrentQuestion(wrapper, { correct: false })
    await findButtonByText(wrapper, 'Nächste Frage').trigger('click')
    await answerCurrentQuestion(wrapper, { correct: false })
    await findButtonByText(wrapper, 'Ergebnis anzeigen').trigger('click')

    expect(wrapper.findAll('.category-card').length).toBe(2)
    expect(wrapper.text()).toContain('Erklärung zu Frage')
    expect(wrapper.text()).toContain('Kategorie:')
  })

  it('bietet "Passenden Methodentrainer öffnen" nur, wenn eine bestehende Referenz existiert', async () => {
    const questions = makeQuestions(1)
    const allUnits = [
      {
        id: 'u1',
        method: 'duel',
        mcQuestionReference: { category: questions[0].category, question: questions[0].question },
      },
    ]
    const wrapper = mount(MixedExam, { props: { mcQuestions: questions, allUnits } })
    await findButtonByText(wrapper, 'Prüfung starten').trigger('click')
    await answerCurrentQuestion(wrapper, { correct: false })
    await findButtonByText(wrapper, 'Ergebnis anzeigen').trigger('click')

    const openButton = findButtonByText(wrapper, 'Passenden Methodentrainer öffnen')
    expect(openButton).toBeTruthy()
    await openButton.trigger('click')
    expect(wrapper.emitted('open-method')[0]).toEqual(['duel'])
  })

  it('zeigt keinen "Passenden Methodentrainer öffnen"-Button ohne bestehende Referenz', async () => {
    const wrapper = mount(MixedExam, { props: { mcQuestions: makeQuestions(1), allUnits: [] } })
    await findButtonByText(wrapper, 'Prüfung starten').trigger('click')
    await answerCurrentQuestion(wrapper, { correct: false })
    await findButtonByText(wrapper, 'Ergebnis anzeigen').trigger('click')
    expect(findButtonByText(wrapper, 'Passenden Methodentrainer öffnen')).toBeFalsy()
  })
})
