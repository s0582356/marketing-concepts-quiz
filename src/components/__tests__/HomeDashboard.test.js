import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import HomeDashboard from '../HomeDashboard.vue'

describe('HomeDashboard', () => {
  it('zeigt die Hauptbereiche mit echten, übergebenen Zahlen statt erfundener Prozentwerte', () => {
    const wrapper = mount(HomeDashboard, {
      props: {
        mcQuestionCount: 42,
        hasPrivateMcLibrary: true,
        trainingUnitCount: 39,
      },
    })
    expect(wrapper.text()).toContain('42 private Fragen geladen')
    expect(wrapper.text()).toContain('39 Trainingseinheiten')
    expect(wrapper.text()).not.toMatch(/\d+\s*%/)
  })

  it('zeigt die öffentliche Beispielbank, solange keine private Bibliothek geladen ist', () => {
    const wrapper = mount(HomeDashboard, { props: { mcQuestionCount: 12, hasPrivateMcLibrary: false } })
    expect(wrapper.text()).toContain('12 öffentliche Beispiel-Fragen')
  })

  it('zeigt den Quiz-Fortschritt nur, wenn ein echter Checkpoint übergeben wurde', () => {
    const withProgress = mount(HomeDashboard, { props: { quizAnswered: 3, quizTotal: 10 } })
    expect(withProgress.text()).toContain('Bearbeitet 3 / 10')

    const withoutProgress = mount(HomeDashboard, { props: { quizAnswered: null, quizTotal: null } })
    expect(withoutProgress.text()).not.toContain('Bearbeitet')
  })

  it('leitet Klicks auf die Bereichs-Kacheln als Events weiter', async () => {
    const wrapper = mount(HomeDashboard)
    await wrapper.find('.dashboard-tile-quiz').trigger('click')
    await wrapper.find('.dashboard-tile-trainer').trigger('click')
    await wrapper.find('.dashboard-tile-exam').trigger('click')
    expect(wrapper.emitted('open-quiz')).toBeTruthy()
    expect(wrapper.emitted('open-trainer')).toBeTruthy()
    expect(wrapper.emitted('open-mixed-exam')).toBeTruthy()
  })

  it('reicht die Weiterlernen-Karten-Events unverändert nach oben durch', async () => {
    const wrapper = mount(HomeDashboard, { props: { lastLearningLocation: null } })
    await wrapper.findAll('button').find((b) => b.text() === 'Lernen starten').trigger('click')
    expect(wrapper.emitted('continue')).toBeTruthy()
  })
})
