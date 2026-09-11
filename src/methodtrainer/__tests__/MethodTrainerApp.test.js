import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MethodTrainerApp from '../MethodTrainerApp.vue'
import sampleQuestions from '../../data/public/sampleQuestions.json'

function tileByLabel(wrapper, label) {
  return wrapper.findAll('.method-tile').find((tile) => tile.find('h3').text() === label)
}

describe('MethodTrainerApp - Methodenübersicht', () => {
  it('bietet jetzt alle sechs Methoden spielbar an, inklusive Mixed Transfer Exam', () => {
    const wrapper = mount(MethodTrainerApp, { props: { mcQuestions: [] } })
    ;['Abgrenzungsduell', 'Fehlerdetektiv', 'Fall-Entscheider', 'Drag-&-Drop-Strukturtrainer', 'Matrix-/Prozess-Trainer', 'Mixed Transfer Exam'].forEach((label) => {
      const tile = tileByLabel(wrapper, label)
      expect(tile.attributes('disabled')).toBeUndefined()
    })
    expect(wrapper.findAll('.method-tile-badge-soon').length).toBe(0)
  })

  it('gruppiert Matrix- und Prozess-Einheiten unter einer gemeinsamen Kachel', async () => {
    const wrapper = mount(MethodTrainerApp, { props: { mcQuestions: [] } })
    await tileByLabel(wrapper, 'Matrix-/Prozess-Trainer').trigger('click')
    // Die öffentlichen Demo-Daten enthalten je eine Matrix- und eine Prozess-Einheit.
    expect(wrapper.find('.matrix-trainer, .process-trainer').exists()).toBe(true)
  })

  it('öffnet Mixed Transfer Exam über die Methodenübersicht und nutzt die aktuell übergebene Fragebank', async () => {
    const wrapper = mount(MethodTrainerApp, { props: { mcQuestions: sampleQuestions } })
    await tileByLabel(wrapper, 'Mixed Transfer Exam').trigger('click')
    expect(wrapper.text()).toContain(`${sampleQuestions.length} insgesamt`)
  })

  it('springt aus dem Mixed-Exam-Review über "Passenden Methodentrainer öffnen" zur referenzierten Methode', async () => {
    // demo-assignment-1 (öffentliche Demo-Einheit) referenziert category "Marketing-Mix"
    // ohne konkreten Fragetext - eine einzelne, dazu passende Frage macht die Session deterministisch.
    const singleQuestion = [{
      id: 1,
      category: 'Marketing-Mix',
      difficulty: 'medium',
      question: 'Testfrage Marketing-Mix?',
      options: ['Richtig', 'Falsch A', 'Falsch B', 'Falsch C'],
      correctAnswer: 'Richtig',
      explanation: 'Testerklärung.',
    }]
    const wrapper = mount(MethodTrainerApp, { props: { mcQuestions: singleQuestion } })
    await tileByLabel(wrapper, 'Mixed Transfer Exam').trigger('click')
    await wrapper.findAll('button').find((b) => b.text() === 'Prüfung starten').trigger('click')
    await wrapper.findAll('.answer-button').find((b) => b.text() === 'Falsch A').trigger('click')
    await wrapper.findAll('button').find((b) => b.text() === 'Ergebnis anzeigen').trigger('click')

    const openButton = wrapper.findAll('button').find((b) => b.text() === 'Passenden Methodentrainer öffnen')
    expect(openButton).toBeTruthy()
    await openButton.trigger('click')

    // Nach dem Sprung ist Mixed Exam verlassen und die Drag-&-Drop-Methode (Ziel von
    // demo-assignment-1) aktiv statt der Methodenübersicht oder des Exam-Reviews.
    expect(wrapper.find('.assignment-trainer').exists()).toBe(true)
  })
})

describe('MethodTrainerApp - MC-Abschluss-Resolver (Test 16, 17)', () => {
  it('leitet nach einer Zuordnungseinheit mit passender Referenz zur echten MC-Frage über (Test 16)', async () => {
    const wrapper = mount(MethodTrainerApp, { props: { mcQuestions: sampleQuestions } })
    await tileByLabel(wrapper, 'Drag-&-Drop-Strukturtrainer').trigger('click')

    // demo-assignment-1: 4 Items korrekt zuordnen (Reihenfolge der Items/Targets wie in
    // sampleTrainingUnits.json: packaging->product, discount->price, tv-ad->communication, own-shop->distribution).
    for (let i = 0; i < 4; i++) {
      const item = wrapper.find('.assignment-pool .assignment-item')
      await item.trigger('click')
      const targetIndex = i // Zielkacheln stehen in derselben Reihenfolge wie die Items zugeordnet werden sollen
      await wrapper.findAll('.assignment-target')[targetIndex].trigger('click')
    }
    await wrapper.find('.assignment-trainer .primary-button').trigger('click')
    await wrapper.find('.assignment-trainer .feedback-box .primary-button').trigger('click')

    expect(wrapper.find('.mc-resolver-card').exists()).toBe(true)
    expect(wrapper.text()).toContain('Wofür stehen die klassischen 4 Ps im Marketing-Mix?')
  })

  it('zeigt bei fehlender Referenz eine neutrale Meldung statt abzustürzen (Test 17)', async () => {
    const wrapper = mount(MethodTrainerApp, { props: { mcQuestions: [] } })
    await tileByLabel(wrapper, 'Drag-&-Drop-Strukturtrainer').trigger('click')

    for (let i = 0; i < 4; i++) {
      const item = wrapper.find('.assignment-pool .assignment-item')
      await item.trigger('click')
      await wrapper.findAll('.assignment-target')[i].trigger('click')
    }
    await wrapper.find('.assignment-trainer .primary-button').trigger('click')
    await wrapper.find('.assignment-trainer .feedback-box .primary-button').trigger('click')

    expect(wrapper.find('.mc-resolver-card').exists()).toBe(false)
    expect(wrapper.text()).toContain('Keine passende Klausurfrage gefunden')

    // App bleibt bedienbar: "Weiter" führt zur nächsten Einheit, kein Crash.
    await wrapper.findAll('button').find((b) => b.text() === 'Weiter').trigger('click')
    expect(wrapper.find('.assignment-trainer, .matrix-trainer, .process-trainer, .training-unit-card, .result-card').exists()).toBe(true)
  })
})
