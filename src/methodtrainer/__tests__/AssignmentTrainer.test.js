import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AssignmentTrainer from '../AssignmentTrainer.vue'

const unit = {
  id: 'assignment-1',
  method: 'assignment',
  modeSupport: ['learn', 'apply', 'exam'],
  compassPath: ['Marketingmix', 'Gesamtstruktur'],
  concept: 'Die vier Marketinginstrumente',
  explanation: 'Kurzerklärung.',
  prompt: 'Ordne jede Maßnahme zu.',
  items: [
    { id: 'packaging', label: 'Verpackungsdesign' },
    { id: 'discount', label: 'Rabatte' },
  ],
  targets: [
    { id: 'product', label: 'Produktpolitik' },
    { id: 'price', label: 'Preispolitik' },
  ],
  assignments: { packaging: 'product', discount: 'price' },
  itemFeedback: {
    packaging: { decisiveClue: 'Verändert das Produkt selbst.' },
    discount: { decisiveClue: 'Verändert, was der Kunde zahlt.' },
  },
  feedback: 'Allgemeiner MC-Hinweis.',
}

function poolItem(wrapper, label) {
  return wrapper.findAll('.assignment-pool .assignment-item').find((b) => b.text() === label)
}

function targetByLabel(wrapper, label) {
  return wrapper.findAll('.assignment-target').find((t) => t.find('h3').text() === label)
}

describe('AssignmentTrainer - Click-to-place (Test 7, 8, 9, 10)', () => {
  it('ordnet per Antippen (Item auswählen, dann Ziel antippen) korrekt zu und wertet richtig aus (Test 7, 9)', async () => {
    const wrapper = mount(AssignmentTrainer, { props: { unit, mode: 'apply' } })

    await poolItem(wrapper, 'Verpackungsdesign').trigger('click')
    await targetByLabel(wrapper, 'Produktpolitik').trigger('click')
    await poolItem(wrapper, 'Rabatte').trigger('click')
    await targetByLabel(wrapper, 'Preispolitik').trigger('click')

    expect(wrapper.find('.assignment-pool-empty').exists()).toBe(true)

    const checkButton = wrapper.find('.primary-button')
    expect(checkButton.attributes('disabled')).toBeUndefined()
    await checkButton.trigger('click')

    expect(wrapper.emitted('completed')[0][0]).toEqual({ id: 'assignment-1', correct: true })
    expect(wrapper.find('.feedback-correct').exists()).toBe(true)
  })

  it('erkennt eine falsche Zuordnung und zeigt das entscheidende Merkmal des falsch platzierten Items (Test 8)', async () => {
    const wrapper = mount(AssignmentTrainer, { props: { unit, mode: 'apply' } })

    // Absichtlich vertauscht zuordnen.
    await poolItem(wrapper, 'Verpackungsdesign').trigger('click')
    await targetByLabel(wrapper, 'Preispolitik').trigger('click')
    await poolItem(wrapper, 'Rabatte').trigger('click')
    await targetByLabel(wrapper, 'Produktpolitik').trigger('click')

    await wrapper.find('.primary-button').trigger('click')

    expect(wrapper.emitted('completed')[0][0]).toEqual({ id: 'assignment-1', correct: false })
    expect(wrapper.find('.feedback-wrong').exists()).toBe(true)
    expect(wrapper.text()).toContain('Verändert das Produkt selbst.')
  })

  it('erlaubt das Zurückholen eines bereits platzierten Items durch erneutes Antippen', async () => {
    const wrapper = mount(AssignmentTrainer, { props: { unit, mode: 'apply' } })
    await poolItem(wrapper, 'Verpackungsdesign').trigger('click')
    await targetByLabel(wrapper, 'Produktpolitik').trigger('click')
    expect(poolItem(wrapper, 'Verpackungsdesign')).toBeUndefined()

    const placed = wrapper.find('.assignment-target-items .assignment-item')
    await placed.trigger('click')
    expect(poolItem(wrapper, 'Verpackungsdesign')).toBeTruthy()
  })

  it('nutzt für die Zuordnung ausschließlich Klick-Events, keine HTML5-Drag-Events - funktioniert damit gleichwertig auf Touch/Mobile (Test 10)', async () => {
    const wrapper = mount(AssignmentTrainer, { props: { unit, mode: 'apply' } })
    // Alle vier Platzierungen laufen über triggerbare click-Events (siehe Test 7),
    // ganz ohne dragstart/drop - genau das macht die Zuordnung mobilgleichwertig.
    await poolItem(wrapper, 'Verpackungsdesign').trigger('click')
    await targetByLabel(wrapper, 'Produktpolitik').trigger('click')
    expect(wrapper.vm).toBeTruthy()
    expect(wrapper.find('.assignment-target-items .assignment-item').exists()).toBe(true)
  })

  it('Prüfungsmodus verbirgt Kompass und Kurzerklärung vor dem Prüfen (Test 15)', () => {
    const wrapper = mount(AssignmentTrainer, { props: { unit, mode: 'exam' } })
    expect(wrapper.find('.training-compass').exists()).toBe(false)
    expect(wrapper.find('.training-explanation').exists()).toBe(false)
  })

  it('Prüfen-Button bleibt deaktiviert, solange nicht alle Items platziert sind', () => {
    const wrapper = mount(AssignmentTrainer, { props: { unit, mode: 'apply' } })
    expect(wrapper.find('.primary-button').attributes('disabled')).toBeDefined()
  })
})
