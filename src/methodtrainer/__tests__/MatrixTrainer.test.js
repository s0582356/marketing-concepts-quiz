import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MatrixTrainer from '../MatrixTrainer.vue'

const unit = {
  id: 'matrix-1',
  method: 'matrix',
  modeSupport: ['learn', 'apply', 'exam'],
  compassPath: ['Marketingmix', 'Strategische Grundlagen'],
  concept: 'Produkt-Markt-Matrix',
  explanation: 'Kurzerklärung Matrix.',
  prompt: 'Welches Feld trifft zu?',
  rowLabels: ['Bestehender Markt', 'Neuer Markt'],
  columnLabels: ['Bestehendes Produkt', 'Neues Produkt'],
  correctCell: { row: 'Bestehender Markt', column: 'Neues Produkt' },
  reasoning: 'Markt bleibt gleich, Produkt ist neu -> Produktentwicklung.',
  distractorExplanation: 'Diversifikation klingt plausibel, verlangt aber auch einen neuen Markt.',
}

function cellAt(wrapper, index) {
  return wrapper.findAll('.matrix-cell')[index]
}

describe('MatrixTrainer (Test 11, 12, 15)', () => {
  it('markiert die richtige Zelle als korrekt und löst completed(true) aus (Test 11)', async () => {
    const wrapper = mount(MatrixTrainer, { props: { unit, mode: 'apply' } })
    // Reihenfolge im Grid: Zeile 1 (Spalte1, Spalte2), Zeile 2 (Spalte1, Spalte2)
    // -> Index 1 = "Bestehender Markt" x "Neues Produkt" = korrekte Zelle.
    await cellAt(wrapper, 1).trigger('click')

    expect(wrapper.emitted('completed')[0][0]).toEqual({ id: 'matrix-1', correct: true })
    expect(wrapper.find('.feedback-correct').exists()).toBe(true)
    expect(cellAt(wrapper, 1).classes()).toContain('matrix-cell-correct')
  })

  it('markiert eine falsche Zelle als falsch, zeigt die richtige Zelle und die Herleitung (Test 12)', async () => {
    const wrapper = mount(MatrixTrainer, { props: { unit, mode: 'apply' } })
    await cellAt(wrapper, 0).trigger('click') // Bestehender Markt x Bestehendes Produkt = falsch

    expect(wrapper.emitted('completed')[0][0]).toEqual({ id: 'matrix-1', correct: false })
    expect(wrapper.find('.feedback-wrong').exists()).toBe(true)
    expect(cellAt(wrapper, 0).classes()).toContain('matrix-cell-wrong')
    expect(cellAt(wrapper, 1).classes()).toContain('matrix-cell-correct')
    expect(wrapper.text()).toContain(unit.reasoning)
    expect(wrapper.text()).toContain(unit.distractorExplanation)
  })

  it('Prüfungsmodus zeigt vor der Antwort weder Kompass noch Kurzerklärung (Test 15)', () => {
    const wrapper = mount(MatrixTrainer, { props: { unit, mode: 'exam' } })
    expect(wrapper.find('.training-compass').exists()).toBe(false)
    expect(wrapper.find('.training-explanation').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Produkt-Markt-Matrix')
  })

  it('ignoriert einen zweiten Klick nach der Antwort', async () => {
    const wrapper = mount(MatrixTrainer, { props: { unit, mode: 'apply' } })
    await cellAt(wrapper, 1).trigger('click')
    await cellAt(wrapper, 0).trigger('click')
    expect(wrapper.emitted('completed').length).toBe(1)
  })
})
