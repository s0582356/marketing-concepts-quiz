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
    await wrapper.find('.dashboard-tile-master-learn').trigger('click')
    await wrapper.find('.dashboard-tile-trainer').trigger('click')
    await wrapper.find('.dashboard-tile-exam').trigger('click')
    expect(wrapper.emitted('open-quiz')).toBeTruthy()
    expect(wrapper.emitted('open-master-learn')).toBeTruthy()
    expect(wrapper.emitted('open-trainer')).toBeTruthy()
    expect(wrapper.emitted('open-mixed-exam')).toBeTruthy()
  })

  it('zeigt die Master-Lernmentor-Kachel zwischen Quiz und Methodentrainer, mit reinem Lernfortschritt statt Score (Test 1)', () => {
    const wrapper = mount(HomeDashboard, { props: { hasMasterLernmentorBank: true, masterLearnProgressPercent: 43 } })
    const tiles = wrapper.findAll('.dashboard-tile')
    const tileClasses = tiles.map((tile) => tile.classes().find((c) => c.startsWith('dashboard-tile-') && c !== 'dashboard-tile'))
    expect(tileClasses).toEqual(['dashboard-tile-quiz', 'dashboard-tile-master-learn', 'dashboard-tile-trainer', 'dashboard-tile-exam'])
    expect(wrapper.text()).toContain('Master-Lernmentor')
    expect(wrapper.text()).toContain('Master gelernt: 43 %')
    expect(wrapper.text()).not.toContain('Note')
    expect(wrapper.text()).not.toContain('Score')
  })

  it('bietet an, die private Bank lokal zu laden, solange keine geladen ist', () => {
    const wrapper = mount(HomeDashboard, { props: { hasMasterLernmentorBank: false, masterLearnProgressPercent: null } })
    expect(wrapper.text()).toContain('Private Bank lokal laden, um zu starten')
  })

  it('reicht die Weiterlernen-Karten-Events unverändert nach oben durch', async () => {
    const wrapper = mount(HomeDashboard, { props: { lastLearningLocation: null } })
    await wrapper.findAll('button').find((b) => b.text() === 'Lernen starten').trigger('click')
    expect(wrapper.emitted('continue')).toBeTruthy()
  })
})
