import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import McResolverCard from '../McResolverCard.vue'

// Wie in den Fragenbanken: die richtige Antwort steht im JSON an erster Stelle.
function mcQuestion(overrides = {}) {
  return {
    question: 'Synthetische Frage?',
    options: ['Richtig', 'Falsch A', 'Falsch B', 'Falsch C'],
    correctAnswer: 'Richtig',
    explanation: 'Synthetische Erklärung.',
    category: 'Synthetik',
    ...overrides,
  }
}

function optionTexts(wrapper) {
  return wrapper.findAll('.answer-button').map((button) => button.text())
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('McResolverCard: Antwortoptionen werden gemischt', () => {
  it('zeigt die richtige Antwort nicht strukturell an Position 1 (Test 19, 26)', () => {
    const runs = 400
    const positionCounts = [0, 0, 0, 0]
    for (let run = 0; run < runs; run++) {
      const wrapper = mount(McResolverCard, { props: { mcQuestion: mcQuestion() } })
      const texts = optionTexts(wrapper)
      expect([...texts].sort()).toEqual(['Falsch A', 'Falsch B', 'Falsch C', 'Richtig'])
      positionCounts[texts.indexOf('Richtig')]++
      wrapper.unmount()
    }
    // Vor dem Fix: [400, 0, 0, 0]. Erwartung jetzt ~100 je Position.
    positionCounts.forEach((count) => {
      expect(count).toBeGreaterThan(50)
      expect(count).toBeLessThan(160)
    })
  })

  it('wertet unabhängig von der angezeigten Position korrekt aus (Test 20, 25)', async () => {
    // Erzwingt nacheinander jede mögliche Zielposition der richtigen Antwort.
    for (const randomValue of [0, 0.3, 0.6, 0.99]) {
      vi.spyOn(Math, 'random').mockReturnValue(randomValue)
      const wrapper = mount(McResolverCard, { props: { mcQuestion: mcQuestion() } })
      vi.restoreAllMocks()

      const correctButton = wrapper.findAll('.answer-button').find((button) => button.text() === 'Richtig')
      await correctButton.trigger('click')
      expect(wrapper.find('.feedback-correct').exists()).toBe(true)
      expect(correctButton.classes()).toContain('answer-correct')
      expect(wrapper.findAll('.answer-wrong')).toHaveLength(0)
      wrapper.unmount()
    }
  })

  it('markiert eine falsche Auswahl als falsch und die richtige Antwort als richtig - an jeder Position', async () => {
    for (const randomValue of [0, 0.3, 0.6, 0.99]) {
      vi.spyOn(Math, 'random').mockReturnValue(randomValue)
      const wrapper = mount(McResolverCard, { props: { mcQuestion: mcQuestion() } })
      vi.restoreAllMocks()

      const wrongButton = wrapper.findAll('.answer-button').find((button) => button.text() === 'Falsch B')
      await wrongButton.trigger('click')
      expect(wrapper.find('.feedback-wrong').exists()).toBe(true)
      expect(wrongButton.classes()).toContain('answer-wrong')
      const correctButton = wrapper.findAll('.answer-button').find((button) => button.text() === 'Richtig')
      expect(correctButton.classes()).toContain('answer-correct')
      wrapper.unmount()
    }
  })

  it('behält die Reihenfolge innerhalb derselben Frage stabil - auch nach Klick und Re-Render (Test 21, 23)', async () => {
    const wrapper = mount(McResolverCard, { props: { mcQuestion: mcQuestion() } })
    const initialOrder = optionTexts(wrapper)

    for (let rerender = 0; rerender < 20; rerender++) {
      wrapper.vm.$forceUpdate()
      await wrapper.vm.$nextTick()
      expect(optionTexts(wrapper)).toEqual(initialOrder)
    }

    await wrapper.findAll('.answer-button')[2].trigger('click')
    expect(optionTexts(wrapper)).toEqual(initialOrder)
    wrapper.vm.$forceUpdate()
    await wrapper.vm.$nextTick()
    expect(optionTexts(wrapper)).toEqual(initialOrder)
  })

  it('mischt für die nächste Frage neu und setzt die Auswahl zurück (Test 22)', async () => {
    const wrapper = mount(McResolverCard, { props: { mcQuestion: mcQuestion() } })
    await wrapper.findAll('.answer-button')[0].trigger('click')
    expect(wrapper.find('.feedback-box').exists()).toBe(true)

    const nextQuestion = mcQuestion({ question: 'Zweite Frage?', options: ['R2', 'F1', 'F2', 'F3'], correctAnswer: 'R2' })
    const orders = new Set()
    for (let run = 0; run < 60; run++) {
      await wrapper.setProps({ mcQuestion: { ...nextQuestion } })
      expect(wrapper.find('.feedback-box').exists()).toBe(false)
      expect([...optionTexts(wrapper)].sort()).toEqual(['F1', 'F2', 'F3', 'R2'])
      orders.add(optionTexts(wrapper).join('|'))
    }
    expect(orders.size).toBeGreaterThan(1)
  })

  it('verändert die übergebene Frage nicht (kein Umsortieren der Bankdaten)', () => {
    const question = mcQuestion()
    const snapshot = JSON.stringify(question)
    mount(McResolverCard, { props: { mcQuestion: question } })
    expect(JSON.stringify(question)).toBe(snapshot)
  })
})

// Codex Red Team MAJOR: der MC-Validator erlaubt doppelte Optionstexte. Die
// Identität einer sichtbaren Option ist deshalb ihr Original-Index, nie ihr
// Text. correctAnswer ist im Datenmodell ein Text - jede Option mit exakt
// diesem Text gilt fachlich als richtig, aber nur die konkret geklickte
// Option ist "ausgewählt".
describe('McResolverCard: identische Optionstexte kollidieren nicht (Option-Identität = Original-Index)', () => {
  const duplicateQuestion = () => mcQuestion({ options: ['Ja', 'Ja', 'Nein'], correctAnswer: 'Ja' })

  function buttons(wrapper) {
    return wrapper.findAll('.answer-button')
  }

  // Original-Index der sichtbaren Optionen, in Anzeigereihenfolge.
  function originalIndices(wrapper) {
    return buttons(wrapper).map((button) => Number(button.attributes('data-option-index')))
  }

  function selectedIndices(wrapper) {
    return buttons(wrapper).filter((button) => button.attributes('data-selected') === 'true').map((button) => Number(button.attributes('data-option-index')))
  }

  function mountWithOrder(randomValue) {
    vi.spyOn(Math, 'random').mockReturnValue(randomValue)
    const wrapper = mount(McResolverCard, { props: { mcQuestion: duplicateQuestion() } })
    vi.restoreAllMocks()
    return wrapper
  }

  it('rendert drei getrennte Optionen mit eindeutiger Identität - ohne Vue-Key-Kollision', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    for (const randomValue of [0, 0.4, 0.99]) {
      const wrapper = mountWithOrder(randomValue)
      expect(buttons(wrapper)).toHaveLength(3)
      expect(optionTexts(wrapper).sort()).toEqual(['Ja', 'Ja', 'Nein'])
      expect([...originalIndices(wrapper)].sort()).toEqual([0, 1, 2])
      wrapper.unmount()
    }
    expect(warn.mock.calls.filter((call) => String(call[0]).includes('Duplicate keys'))).toHaveLength(0)
  })

  it.each([0, 1])('Klick auf "Ja" mit Original-Index %i: nur diese konkrete Option ist ausgewählt, Bewertung richtig', async (originalIndex) => {
    for (const randomValue of [0, 0.4, 0.99]) {
      const wrapper = mountWithOrder(randomValue)
      const position = originalIndices(wrapper).indexOf(originalIndex)
      expect(buttons(wrapper)[position].text()).toBe('Ja')
      await buttons(wrapper)[position].trigger('click')

      expect(selectedIndices(wrapper)).toEqual([originalIndex])
      expect(wrapper.find('.feedback-correct').exists()).toBe(true)
      expect(wrapper.find('.feedback-wrong').exists()).toBe(false)
      // Beide "Ja" sind fachlich richtig (textbasiertes correctAnswer), keine Option ist "falsch gewählt".
      expect(wrapper.findAll('.answer-correct')).toHaveLength(2)
      expect(wrapper.findAll('.answer-wrong')).toHaveLength(0)
      expect(buttons(wrapper).find((button) => button.text() === 'Nein').classes()).toContain('answer-muted')
      wrapper.unmount()
    }
  })

  it('Klick auf "Nein": nur diese Option ist ausgewählt und falsch, beide "Ja" werden als richtig gezeigt', async () => {
    for (const randomValue of [0, 0.4, 0.99]) {
      const wrapper = mountWithOrder(randomValue)
      const position = originalIndices(wrapper).indexOf(2)
      await buttons(wrapper)[position].trigger('click')

      expect(selectedIndices(wrapper)).toEqual([2])
      expect(wrapper.find('.feedback-wrong').exists()).toBe(true)
      expect(wrapper.find('.feedback-correct').exists()).toBe(false)
      expect(buttons(wrapper)[position].classes()).toContain('answer-wrong')
      expect(wrapper.findAll('.answer-wrong')).toHaveLength(1)
      expect(wrapper.findAll('.answer-correct')).toHaveLength(2)
      wrapper.unmount()
    }
  })

  it('markiert bei doppeltem FALSCHEM Text nur die geklickte Option als falsch', async () => {
    const wrapper = mount(McResolverCard, { props: { mcQuestion: mcQuestion({ options: ['Nein', 'Ja', 'Nein'], correctAnswer: 'Ja' }) } })
    const position = originalIndices(wrapper).indexOf(2)
    await buttons(wrapper)[position].trigger('click')

    expect(selectedIndices(wrapper)).toEqual([2])
    expect(wrapper.findAll('.answer-wrong')).toHaveLength(1)
    expect(buttons(wrapper)[position].classes()).toContain('answer-wrong')
    // Das andere, nicht geklickte "Nein" ist nur ausgegraut.
    expect(buttons(wrapper)[originalIndices(wrapper).indexOf(0)].classes()).toContain('answer-muted')
    expect(wrapper.findAll('.answer-correct')).toHaveLength(1)
  })

  it('hält Reihenfolge und Auswahlidentität über Re-Render stabil', async () => {
    const wrapper = mount(McResolverCard, { props: { mcQuestion: duplicateQuestion() } })
    const order = originalIndices(wrapper)
    await buttons(wrapper)[order.indexOf(1)].trigger('click')

    for (let rerender = 0; rerender < 20; rerender++) {
      wrapper.vm.$forceUpdate()
      await wrapper.vm.$nextTick()
      expect(originalIndices(wrapper)).toEqual(order)
      expect(selectedIndices(wrapper)).toEqual([1])
    }
    // Nach der Antwort ist jede Option gesperrt - ein Klick auf das andere "Ja" ändert nichts.
    await buttons(wrapper)[order.indexOf(0)].trigger('click')
    expect(selectedIndices(wrapper)).toEqual([1])
  })

  it('beginnt beim erneuten Öffnen / bei der nächsten Frage ohne übernommene Auswahl (keine Textidentität über Fragen hinweg)', async () => {
    const wrapper = mount(McResolverCard, { props: { mcQuestion: duplicateQuestion() } })
    await buttons(wrapper)[0].trigger('click')
    expect(selectedIndices(wrapper)).toHaveLength(1)

    // Nächste Frage enthält denselben Text "Ja" - die alte Auswahl darf nicht "wiedererkannt" werden.
    await wrapper.setProps({ mcQuestion: mcQuestion({ question: 'Andere Frage?', options: ['Ja', 'Vielleicht', 'Ja'], correctAnswer: 'Vielleicht' }) })
    expect(selectedIndices(wrapper)).toEqual([])
    expect(wrapper.find('.feedback-box').exists()).toBe(false)
    expect(wrapper.findAll('.answer-correct, .answer-wrong, .answer-muted')).toHaveLength(0)
    expect([...originalIndices(wrapper)].sort()).toEqual([0, 1, 2])

    // Erneutes Öffnen derselben Frage (Neu-Mount): ebenfalls frischer Zustand.
    const reopened = mount(McResolverCard, { props: { mcQuestion: duplicateQuestion() } })
    expect(selectedIndices(reopened)).toEqual([])
    expect(reopened.find('.feedback-box').exists()).toBe(false)
  })
})
