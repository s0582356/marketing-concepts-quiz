import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App.vue'

function findButtonByText(wrapper, text) {
  return wrapper.findAll('button').find((button) => button.text().trim() === text)
}

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('bestehender Quizbereich (Regression)', () => {
  it('startet standardmäßig im Quiz-Bereich und die Fragebank lässt sich starten und beantworten (Test 2, 16)', async () => {
    const wrapper = mount(App)

    expect(wrapper.find('.start-layout').exists()).toBe(true)
    // Bestehender privater Import bleibt unverändert vorhanden.
    expect(wrapper.find('.import-card').exists()).toBe(true)
    expect(findButtonByText(wrapper, 'JSON auswählen')).toBeTruthy()

    await findButtonByText(wrapper, 'Mit aktueller Fragebank starten').trigger('click')
    expect(wrapper.find('.quiz-layout').exists()).toBe(true)

    const firstAnswer = wrapper.find('.answer-button')
    await firstAnswer.trigger('click')
    expect(wrapper.find('.feedback-box').exists()).toBe(true)
  })
})

describe('Methodentrainer-Navigation', () => {
  it('öffnet den Methodentrainer über den Bereichs-Umschalter (Test 1)', async () => {
    const wrapper = mount(App)
    expect(wrapper.find('.method-trainer').exists()).toBe(false)

    await findButtonByText(wrapper, 'Methodentrainer').trigger('click')

    expect(wrapper.find('.method-trainer').exists()).toBe(true)
    expect(wrapper.find('.start-layout').exists()).toBe(false)
    expect(wrapper.text()).toContain('Abgrenzungsduell')
    expect(wrapper.text()).toContain('Fehlerdetektiv')
  })

  it('kann zurück zum Quizbereich wechseln, ohne den Quizzustand zu zerstören (Test 2)', async () => {
    const wrapper = mount(App)
    await findButtonByText(wrapper, 'Methodentrainer').trigger('click')
    await findButtonByText(wrapper, 'Quiz').trigger('click')
    expect(wrapper.find('.start-layout').exists()).toBe(true)
  })
})

describe('3-Modi-Gerüst', () => {
  it('wechselt zwischen Lernen, Anwenden und Prüfung (Test 3)', async () => {
    const wrapper = mount(App)
    await findButtonByText(wrapper, 'Methodentrainer').trigger('click')

    const learnButton = findButtonByText(wrapper, 'Lernen')
    const applyButton = findButtonByText(wrapper, 'Anwenden')
    const examButton = findButtonByText(wrapper, 'Prüfung')

    expect(learnButton.classes()).toContain('mode-switcher-active')

    await applyButton.trigger('click')
    expect(applyButton.classes()).toContain('mode-switcher-active')
    expect(learnButton.classes()).not.toContain('mode-switcher-active')

    await examButton.trigger('click')
    expect(examButton.classes()).toContain('mode-switcher-active')
  })
})

describe('Datenschutz: private Inhalte bleiben aus dem Fortschrittsspeicher (Test 15)', () => {
  it('schreibt beim Spielen einer Methodentrainer-Sitzung nichts in localStorage', async () => {
    const setItemSpy = vi.spyOn(window.localStorage.__proto__, 'setItem')
    const wrapper = mount(App)

    await findButtonByText(wrapper, 'Methodentrainer').trigger('click')
    const duelTile = wrapper.findAll('.method-tile').find((tile) => tile.find('h3').text() === 'Abgrenzungsduell')
    await duelTile.trigger('click')

    // Eine komplette Sitzung durchspielen (öffentliche Demo-Einheiten).
    for (let i = 0; i < 5; i++) {
      const answerButton = wrapper.find('.training-unit-card .answer-button')
      if (!answerButton.exists()) break
      await answerButton.trigger('click')
      const nextButton = findButtonByText(wrapper, 'Weiter')
      if (nextButton) await nextButton.trigger('click')
    }

    expect(setItemSpy).not.toHaveBeenCalled()
  })
})
