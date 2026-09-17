import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ContinueLearningCard from '../ContinueLearningCard.vue'

function location(overrides = {}) {
  return {
    area: 'quiz',
    setFingerprint: 'a'.repeat(64),
    subArea: null,
    itemId: null,
    position: 5,
    total: 8,
    mode: 'normal',
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('ContinueLearningCard', () => {
  it('zeigt "Lernen starten" ohne gespeicherte Sitzung', () => {
    const wrapper = mount(ContinueLearningCard, { props: { location: null, isReady: false } })
    expect(wrapper.text()).toContain('Noch keine Lernsitzung')
    expect(wrapper.text()).toContain('Lernen starten')
    expect(wrapper.findAll('button').find((b) => b.text() === 'Weiterlernen')).toBeUndefined()
  })

  it('bietet "Weiterlernen" an, wenn die Bibliotheken passen', async () => {
    const wrapper = mount(ContinueLearningCard, {
      props: { location: location(), isReady: true, areaLabel: 'Quiz' },
    })
    expect(wrapper.text()).toContain('Frage 5 von 8')
    const button = wrapper.findAll('button').find((b) => b.text() === 'Weiterlernen')
    expect(button).toBeTruthy()
    await button.trigger('click')
    expect(wrapper.emitted('continue')).toBeTruthy()
  })

  it('bietet "Lernbibliotheken laden und fortsetzen" an, wenn die Bibliotheken nicht passen', async () => {
    const wrapper = mount(ContinueLearningCard, {
      props: { location: location(), isReady: false, areaLabel: 'Quiz' },
    })
    const button = wrapper.findAll('button').find((b) => b.text() === 'Lernbibliotheken laden und fortsetzen')
    expect(button).toBeTruthy()
    await button.trigger('click')
    expect(wrapper.emitted('load-libraries')).toBeTruthy()
  })

  it('emittiert "discard" beim Verwerfen', async () => {
    const wrapper = mount(ContinueLearningCard, {
      props: { location: location(), isReady: true, areaLabel: 'Quiz' },
    })
    await wrapper.findAll('button').find((b) => b.text() === 'Fortschritt verwerfen').trigger('click')
    expect(wrapper.emitted('discard')).toBeTruthy()
  })

  it('zeigt den Methodentrainer-Modus-Hinweis, aber nicht für den Standardmodus', () => {
    const applyWrapper = mount(ContinueLearningCard, {
      props: { location: location({ area: 'methodTrainer', mode: 'apply', subArea: 'matrix' }), isReady: true, areaLabel: 'Methodentrainer', subAreaLabel: 'Matrix-/Prozess-Trainer' },
    })
    expect(applyWrapper.text()).toContain('Anwenden-Modus')
    expect(applyWrapper.text()).toContain('Matrix-/Prozess-Trainer')

    const normalWrapper = mount(ContinueLearningCard, { props: { location: location(), isReady: true, areaLabel: 'Quiz' } })
    expect(normalWrapper.text()).not.toContain('-Modus')
  })
})
