import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MasterLernmentorImporter from '../MasterLernmentorImporter.vue'

function jsonFile(name, data) {
  return new File([JSON.stringify(data)], name, { type: 'application/json' })
}

function validBank() {
  return {
    chapters: [
      {
        chapterId: 'ch01',
        chapterTitle: 'Kapitel Eins',
        topics: [
          {
            topicId: 'ch01-t01',
            topicTitle: 'Topic Eins',
            chapterId: 'ch01',
            learningPhase: { masterContent: '## Text' },
            questions: [
              {
                questionId: 'q01',
                topicId: 'ch01-t01',
                question: 'Frage?',
                coreConcepts: [{ conceptId: 'c1', label: 'Konzept' }],
                optionalConcepts: [],
                shortModelAnswer: 'Antwort.',
                masterExcerpt: 'Text.',
                responseRequirements: { requiresAllCoreConcepts: true, minimumItems: 1, minimumExamples: null, minimumExamplesPerGroup: null },
                answerFlexibility: { wordingMatchRequired: false, equivalentOwnExamplesAllowed: false, caseBound: false },
              },
            ],
          },
        ],
      },
    ],
  }
}

// Die Import-Pipeline hängt an einem echten Web-Crypto-Digest-Aufruf
// (Datei-Fingerprint), der über das Node-Threadpool auflöst, nicht nur über
// die Microtask-Queue - ein reiner flushPromises()-Loop ist dafür nicht in
// jedem Fall zuverlässig genug (siehe libraryLoaderIntegration.test.js).
async function importFile(wrapper, file) {
  const input = wrapper.find('input[type="file"]')
  Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
  await input.trigger('change')
  for (let tick = 0; tick < 10; tick++) await flushPromises()
  await new Promise((resolve) => setTimeout(resolve, 20))
  for (let tick = 0; tick < 10; tick++) await flushPromises()
}

describe('MasterLernmentorImporter (Test 3, 4)', () => {
  it('akzeptiert eine strukturell gültige Bank und emittiert sie mit Fingerprint/Dateiname', async () => {
    const wrapper = mount(MasterLernmentorImporter)
    await importFile(wrapper, jsonFile('gold.json', validBank()))

    const emitted = wrapper.emitted('bank-loaded')
    expect(emitted).toBeTruthy()
    expect(emitted[0][0].fileName).toBe('gold.json')
    expect(emitted[0][0].data.chapters).toHaveLength(1)
    expect(typeof emitted[0][0].fingerprint).toBe('string')
    expect(emitted[0][0].fingerprint).toMatch(/^[a-f0-9]{64}$/)
  })

  it('lehnt eine inkompatible Datei mit klarer Fehlermeldung ab, statt abzustürzen (Test 4)', async () => {
    const wrapper = mount(MasterLernmentorImporter)
    await importFile(wrapper, jsonFile('quiz.json', [{ options: ['A', 'B'], correctAnswer: 'A' }]))

    expect(wrapper.emitted('bank-loaded')).toBeFalsy()
    expect(wrapper.find('.import-error').exists()).toBe(true)
    expect(wrapper.find('.import-error').text().length).toBeGreaterThan(0)
  })

  it('lehnt kaputtes JSON ab, ohne zu crashen', async () => {
    const wrapper = mount(MasterLernmentorImporter)
    await importFile(wrapper, new File(['{ not json'], 'kaputt.json', { type: 'application/json' }))

    expect(wrapper.emitted('bank-loaded')).toBeFalsy()
    expect(wrapper.find('.import-error').exists()).toBe(true)
  })
})
