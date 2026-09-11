import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ProcessTrainer from '../ProcessTrainer.vue'

const unit = {
  id: 'process-1',
  method: 'process',
  modeSupport: ['learn', 'apply', 'exam'],
  compassPath: ['Marketingmix', 'Marktforschung'],
  concept: 'Marktforschungsprozess',
  explanation: 'Kurzerklärung Prozess.',
  prompt: 'Bringe die Schritte in die richtige Reihenfolge.',
  steps: [
    { id: 'design', label: 'Forschungsdesign' },
    { id: 'problem', label: 'Untersuchungsproblem' },
  ],
  correctOrder: ['problem', 'design'],
  stepFeedback: {
    problem: 'Ohne Fragestellung kein Design.',
    design: 'Design steht vor der Erhebung.',
  },
  reasoning: 'Jeder Schritt liefert die Grundlage für den nächsten.',
}

describe('ProcessTrainer (Test 13, 14, 15)', () => {
  it('erkennt die bereits korrekte Reihenfolge nach Umsortieren per ▲ (Test 13)', async () => {
    const wrapper = mount(ProcessTrainer, { props: { unit, mode: 'apply' } })
    // Ausgangsreihenfolge laut steps: [design, problem] - falsch. "Untersuchungsproblem"
    // (zweite Zeile) einen Platz nach oben schieben, um [problem, design] zu erhalten.
    const upButtons = wrapper.findAll('button[aria-label="Nach oben verschieben"]')
    await upButtons[1].trigger('click')

    const labels = wrapper.findAll('.process-step-label').map((el) => el.text())
    expect(labels).toEqual(['Untersuchungsproblem', 'Forschungsdesign'])

    await wrapper.find('.primary-button').trigger('click')
    expect(wrapper.emitted('completed')[0][0]).toEqual({ id: 'process-1', correct: true })
    expect(wrapper.find('.feedback-correct').exists()).toBe(true)
  })

  it('erkennt eine falsche Reihenfolge und zeigt Schritt-Feedback zu falsch platzierten Schritten (Test 14)', async () => {
    const wrapper = mount(ProcessTrainer, { props: { unit, mode: 'apply' } })
    // Ausgangsreihenfolge [design, problem] unverändert lassen - das ist falsch.
    await wrapper.find('.primary-button').trigger('click')

    expect(wrapper.emitted('completed')[0][0]).toEqual({ id: 'process-1', correct: false })
    expect(wrapper.find('.feedback-wrong').exists()).toBe(true)
    expect(wrapper.text()).toContain('Ohne Fragestellung kein Design.')
    expect(wrapper.text()).toContain(unit.reasoning)
  })

  it('Prüfungsmodus zeigt vor der Antwort weder Kompass noch Kurzerklärung (Test 15)', () => {
    const wrapper = mount(ProcessTrainer, { props: { unit, mode: 'exam' } })
    expect(wrapper.find('.training-compass').exists()).toBe(false)
    expect(wrapper.find('.training-explanation').exists()).toBe(false)
  })

  it('▲ auf dem ersten und ▼ auf dem letzten Schritt sind deaktiviert', () => {
    const wrapper = mount(ProcessTrainer, { props: { unit, mode: 'apply' } })
    const upButtons = wrapper.findAll('button[aria-label="Nach oben verschieben"]')
    const downButtons = wrapper.findAll('button[aria-label="Nach unten verschieben"]')
    expect(upButtons[0].attributes('disabled')).toBeDefined()
    expect(downButtons[downButtons.length - 1].attributes('disabled')).toBeDefined()
  })
})
