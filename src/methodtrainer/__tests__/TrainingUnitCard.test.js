import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TrainingUnitCard from '../TrainingUnitCard.vue'

const duelUnit = {
  id: 'duel-1',
  method: 'duel',
  modeSupport: ['learn', 'apply', 'exam'],
  compassPath: ['Marketingmix', 'Vertriebspolitik'],
  concept: 'Push vs. Pull',
  explanation: 'Kurzerklärung Push/Pull.',
  guidedExample: 'Geführtes Beispiel Push/Pull.',
  prompt: 'Welche Strategie liegt vor?',
  choices: ['Push-Strategie', 'Pull-Strategie'],
  correctAnswer: 'Pull-Strategie',
  decisiveClue: 'Entscheidend ist, ob die Nachfrage vom Endkunden gezogen wird.',
  feedback: 'MC-Hinweis Push/Pull.',
  misconception: 'Typische Verwechslung Push/Pull.',
  distractorExplanation: 'Warum Push plausibel wirkt.',
}

const misconceptionUnit = {
  id: 'misc-1',
  method: 'misconception',
  modeSupport: ['learn', 'apply', 'exam'],
  compassPath: ['Marketingmix', 'Produktpolitik'],
  prompt: '"Jede Produktverbesserung ist zugleich eine Produktinnovation." Was ist daran falsch?',
  choices: ['Verbesserung und Innovation sind nicht dasselbe', 'Beide Begriffe sind identisch'],
  correctAnswer: 'Verbesserung und Innovation sind nicht dasselbe',
  decisiveClue: 'Innovation meint eine neue Leistung, Verbesserung eine Optimierung des Bestehenden.',
  misconception: 'Beide Begriffe werden oft synonym verwendet.',
  distractorExplanation: 'Identisch klingt plausibel, weil beide Produktänderungen betreffen.',
}

describe('TrainingUnitCard - Abgrenzungsduell', () => {
  it('zeigt im Modus Lernen den Marketing-Kompass und das entscheidende Merkmal vor der Antwort (Test 4)', () => {
    const wrapper = mount(TrainingUnitCard, { props: { unit: duelUnit, mode: 'learn' } })
    expect(wrapper.find('.training-compass').exists()).toBe(true)
    expect(wrapper.text()).toContain('Vertriebspolitik')
    expect(wrapper.find('.training-decisive-clue').exists()).toBe(true)
    expect(wrapper.find('.training-explanation').exists()).toBe(true)
    expect(wrapper.find('.training-guided-example').exists()).toBe(true)
  })

  it('zeigt im Modus Anwenden den Kompass, aber keine Kurzerklärung/kein vorab hervorgehobenes Merkmal (Test 5)', () => {
    const wrapper = mount(TrainingUnitCard, { props: { unit: duelUnit, mode: 'apply' } })
    expect(wrapper.find('.training-compass').exists()).toBe(true)
    expect(wrapper.find('.training-explanation').exists()).toBe(false)
    expect(wrapper.find('.training-guided-example').exists()).toBe(false)
    expect(wrapper.find('.training-decisive-clue').exists()).toBe(false)
  })

  it('verbirgt im Prüfungsmodus Kompass, Erklärung und entscheidendes Merkmal vor der Antwort (Test 6, 13)', () => {
    const wrapper = mount(TrainingUnitCard, { props: { unit: duelUnit, mode: 'exam' } })
    expect(wrapper.find('.training-compass').exists()).toBe(false)
    expect(wrapper.find('.training-explanation').exists()).toBe(false)
    expect(wrapper.find('.training-guided-example').exists()).toBe(false)
    expect(wrapper.find('.training-decisive-clue').exists()).toBe(false)
    expect(wrapper.find('.feedback-box').exists()).toBe(false)
  })

  it('zeigt nach einer richtigen Antwort das entscheidende Merkmal und den Kompass (Test 7, 9)', async () => {
    const wrapper = mount(TrainingUnitCard, { props: { unit: duelUnit, mode: 'exam' } })
    const buttons = wrapper.findAll('.answer-button')
    const correctButton = buttons.find((button) => button.text() === duelUnit.correctAnswer)
    await correctButton.trigger('click')

    expect(wrapper.emitted('completed')).toBeTruthy()
    expect(wrapper.emitted('completed')[0][0]).toEqual({ id: 'duel-1', correct: true })
    expect(wrapper.find('.feedback-correct').exists()).toBe(true)
    expect(wrapper.find('.training-compass').exists()).toBe(true)
    expect(wrapper.text()).toContain(duelUnit.decisiveClue)
  })

  it('markiert bei einer falschen Antwort die gewählte und die richtige Option (Test 8)', async () => {
    const wrapper = mount(TrainingUnitCard, { props: { unit: duelUnit, mode: 'apply' } })
    const buttons = wrapper.findAll('.answer-button')
    const wrongButton = buttons.find((button) => button.text() === 'Push-Strategie')
    await wrongButton.trigger('click')

    expect(wrapper.emitted('completed')[0][0]).toEqual({ id: 'duel-1', correct: false })
    expect(wrapper.find('.feedback-wrong').exists()).toBe(true)
    expect(wrongButton.classes()).toContain('answer-wrong')
    const correctButton = wrapper.findAll('.answer-button').find((button) => button.text() === duelUnit.correctAnswer)
    expect(correctButton.classes()).toContain('answer-correct')
  })

  it('ignoriert einen zweiten Klick nach der Antwort und lässt Buttons ausgegraut', async () => {
    const wrapper = mount(TrainingUnitCard, { props: { unit: duelUnit, mode: 'learn' } })
    const buttons = wrapper.findAll('.answer-button')
    await buttons[0].trigger('click')
    await buttons[1].trigger('click')
    expect(wrapper.emitted('completed').length).toBe(1)
  })
})

describe('TrainingUnitCard - Fehlerdetektiv', () => {
  it('löst bei richtiger Auswahl ein completed-Event mit correct: true aus (Test 10)', async () => {
    const wrapper = mount(TrainingUnitCard, { props: { unit: misconceptionUnit, mode: 'apply' } })
    const buttons = wrapper.findAll('.answer-button')
    const correctButton = buttons.find((button) => button.text() === misconceptionUnit.correctAnswer)
    await correctButton.trigger('click')
    expect(wrapper.emitted('completed')[0][0]).toEqual({ id: 'misc-1', correct: true })
  })

  it('löst bei falscher Auswahl ein completed-Event mit correct: false aus (Test 11)', async () => {
    const wrapper = mount(TrainingUnitCard, { props: { unit: misconceptionUnit, mode: 'apply' } })
    const wrongButton = wrapper.findAll('.answer-button').find((button) => button.text() === 'Beide Begriffe sind identisch')
    await wrongButton.trigger('click')
    expect(wrapper.emitted('completed')[0][0]).toEqual({ id: 'misc-1', correct: false })
  })

  it('zeigt nach der Antwort Misconception- und Distraktor-Feedback (Test 12)', async () => {
    const wrapper = mount(TrainingUnitCard, { props: { unit: misconceptionUnit, mode: 'exam' } })
    const buttons = wrapper.findAll('.answer-button')
    await buttons[0].trigger('click')
    expect(wrapper.text()).toContain(misconceptionUnit.misconception)
    expect(wrapper.text()).toContain(misconceptionUnit.distractorExplanation)
  })

  it('sendet ein advance-Event beim Klick auf "Weiter"', async () => {
    const wrapper = mount(TrainingUnitCard, { props: { unit: misconceptionUnit, mode: 'learn' } })
    await wrapper.findAll('.answer-button')[0].trigger('click')
    await wrapper.find('.primary-button').trigger('click')
    expect(wrapper.emitted('advance')).toBeTruthy()
  })
})

describe('Tag-2-Hardening: concept-Label im Prüfungsmodus (Test 1)', () => {
  it('verbirgt concept im Prüfungsmodus vor der Antwort', () => {
    const wrapper = mount(TrainingUnitCard, { props: { unit: duelUnit, mode: 'exam' } })
    expect(wrapper.text()).not.toContain('Push vs. Pull')
  })

  it('zeigt concept nach der Antwort im Prüfungsmodus wieder', async () => {
    const wrapper = mount(TrainingUnitCard, { props: { unit: duelUnit, mode: 'exam' } })
    await wrapper.findAll('.answer-button')[0].trigger('click')
    expect(wrapper.text()).toContain('Push vs. Pull')
  })

  it('zeigt concept im Modus Lernen bereits vor der Antwort', () => {
    const wrapper = mount(TrainingUnitCard, { props: { unit: duelUnit, mode: 'learn' } })
    expect(wrapper.text()).toContain('Push vs. Pull')
  })
})

const caseUnit = {
  id: 'case-1',
  method: 'case',
  modeSupport: ['learn', 'apply', 'exam'],
  compassPath: ['Marketingmix', 'Preispolitik'],
  concept: 'Preisstrategie-Entscheidung',
  explanation: 'Kurzerklärung Preisstrategie.',
  guidedExample: 'Geführtes Beispiel Preisstrategie.',
  prompt: 'Ein Anbieter mit vielen austauschbaren Konkurrenten setzt einen sehr niedrigen Einführungspreis an, um schnell Marktanteile zu gewinnen. Welche Strategie liegt vor?',
  choices: ['Skimmingstrategie', 'Penetrationsstrategie', 'Prestigepreisstrategie', 'Mitläuferpreisstrategie'],
  correctAnswer: 'Penetrationsstrategie',
  decisiveClue: 'Niedriger Einführungspreis + Ziel Marktanteile.',
  reasoning: 'Fall -> Signal (niedriger Preis, viel Wettbewerb) -> Regel (Penetration) -> Alternativen ausgeschlossen -> Antwort.',
  distractorExplanation: 'Mitläuferpreis klingt plausibel, ist hier aber keine aktive Strategie.',
}

describe('TrainingUnitCard - Fall-Entscheider (case)', () => {
  it('Lernen: zeigt Kurzerklärung, geführtes Beispiel und Kompass vor der Antwort (Test 2)', () => {
    const wrapper = mount(TrainingUnitCard, { props: { unit: caseUnit, mode: 'learn' } })
    expect(wrapper.find('.training-explanation').exists()).toBe(true)
    expect(wrapper.find('.training-guided-example').exists()).toBe(true)
    expect(wrapper.find('.training-compass').exists()).toBe(true)
    expect(wrapper.find('.training-decisive-clue').exists()).toBe(true)
  })

  it('Anwenden: zeigt Kompass, aber keine Kurzerklärung/kein vorab hervorgehobenes Merkmal (Test 3)', () => {
    const wrapper = mount(TrainingUnitCard, { props: { unit: caseUnit, mode: 'apply' } })
    expect(wrapper.find('.training-compass').exists()).toBe(true)
    expect(wrapper.find('.training-explanation').exists()).toBe(false)
    expect(wrapper.find('.training-decisive-clue').exists()).toBe(false)
  })

  it('unterstützt vier Antwortalternativen', () => {
    const wrapper = mount(TrainingUnitCard, { props: { unit: caseUnit, mode: 'apply' } })
    expect(wrapper.findAll('.answer-button').length).toBe(4)
  })

  it('Prüfung: zeigt vor der Antwort nur Fall und Antwortmöglichkeiten, keine Themenverräter (Test 4)', () => {
    const wrapper = mount(TrainingUnitCard, { props: { unit: caseUnit, mode: 'exam' } })
    expect(wrapper.find('.training-compass').exists()).toBe(false)
    expect(wrapper.find('.training-explanation').exists()).toBe(false)
    expect(wrapper.find('.training-decisive-clue').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Preisstrategie-Entscheidung')
    expect(wrapper.text()).toContain(caseUnit.prompt)
  })

  it('richtige Antwort: löst completed(correct:true) aus und zeigt die Herleitung (Test 5)', async () => {
    const wrapper = mount(TrainingUnitCard, { props: { unit: caseUnit, mode: 'exam' } })
    const correctButton = wrapper.findAll('.answer-button').find((b) => b.text() === caseUnit.correctAnswer)
    await correctButton.trigger('click')
    expect(wrapper.emitted('completed')[0][0]).toEqual({ id: 'case-1', correct: true })
    expect(wrapper.find('.feedback-correct').exists()).toBe(true)
    expect(wrapper.text()).toContain(caseUnit.reasoning)
  })

  it('falsche Antwort: löst completed(correct:false) aus und zeigt Distraktor-Erklärung (Test 6)', async () => {
    const wrapper = mount(TrainingUnitCard, { props: { unit: caseUnit, mode: 'exam' } })
    const wrongButton = wrapper.findAll('.answer-button').find((b) => b.text() === 'Mitläuferpreisstrategie')
    await wrongButton.trigger('click')
    expect(wrapper.emitted('completed')[0][0]).toEqual({ id: 'case-1', correct: false })
    expect(wrapper.find('.feedback-wrong').exists()).toBe(true)
    expect(wrapper.text()).toContain(caseUnit.distractorExplanation)
  })
})
