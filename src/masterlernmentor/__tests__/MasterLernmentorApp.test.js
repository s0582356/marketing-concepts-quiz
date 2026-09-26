import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MasterLernmentorApp from '../MasterLernmentorApp.vue'
import { getMasterLearnProgress, saveMasterLearnProgress } from '../../utils/learningProgress.js'

const FINGERPRINT_A = 'a'.repeat(64)
const FINGERPRINT_B = 'b'.repeat(64)

function findButtonByText(wrapper, text) {
  return wrapper.findAll('button').find((button) => button.text().trim() === text)
}

function testBank() {
  return {
    chapters: [
      {
        chapterId: 'ch01',
        chapterNumber: '1',
        chapterTitle: 'Kapitel Eins',
        topics: [
          {
            topicId: 'ch01-t01',
            topicNumber: '1.1',
            topicTitle: 'Erstes Topic',
            chapterId: 'ch01',
            learningPhase: { masterAnchor: '1.1', masterContent: '## 1.1 Erstes Topic\n\n[ABBILDUNG: Testbild]\n\nLerntext hier.' },
            questions: [
              {
                questionId: 'q01',
                topicId: 'ch01-t01',
                question: 'Erste Frage?',
                hint: 'Ein Hinweis.',
                coreConcepts: [
                  { conceptId: 'c01', label: 'Kernpunkt A', acceptedPhrases: ['Erklärung A vorkommt'] },
                  { conceptId: 'c02', label: 'Kernpunkt B', acceptedPhrases: ['Erklärung B vorkommt'] },
                ],
                optionalConcepts: [{ conceptId: 'o01', label: 'Zusatzpunkt C' }],
                shortModelAnswer: 'Dies ist die Musterantwort.',
                masterExcerpt: 'Passender Masterausschnitt für Frage eins.',
                responseRequirements: { requiresAllCoreConcepts: true, minimumItems: 2, minimumExamples: null, minimumExamplesPerGroup: null },
                answerFlexibility: { wordingMatchRequired: false, equivalentOwnExamplesAllowed: false, caseBound: false },
              },
              {
                questionId: 'q02',
                topicId: 'ch01-t01',
                question: 'Nennen Sie ein eigenes Beispiel.',
                hint: null,
                coreConcepts: [{ conceptId: 'c03', label: 'Eigenes Beispiel', acceptedPhrases: ['Musterbeispiel Text'] }],
                optionalConcepts: [],
                shortModelAnswer: 'Zum Beispiel X.',
                masterExcerpt: 'Auszug für Frage zwei.',
                responseRequirements: { requiresAllCoreConcepts: true, minimumItems: 1, minimumExamples: 1, minimumExamplesPerGroup: null },
                answerFlexibility: { wordingMatchRequired: false, equivalentOwnExamplesAllowed: true, caseBound: false },
              },
            ],
            visualAssets: [{ assetId: 'testbild-1', type: 'image', placement: 'after_heading', requiredForCanonicalMasterView: true, sourceLabel: 'Testbild' }],
          },
          {
            topicId: 'ch01-t02',
            topicNumber: '1.2',
            topicTitle: 'Zweites Topic',
            chapterId: 'ch01',
            learningPhase: { masterAnchor: '1.2', masterContent: '## 1.2 Zweites Topic\n\nWeiterer Lerntext.' },
            questions: [
              {
                questionId: 'q03',
                topicId: 'ch01-t02',
                question: 'Fall Y - was folgt daraus?',
                hint: 'Bleib beim Fall.',
                coreConcepts: [{ conceptId: 'c04', label: 'Fallschluss', acceptedPhrases: ['Fall Y führt zu Z'] }],
                optionalConcepts: [],
                shortModelAnswer: 'Aus Fall Y folgt Z.',
                masterExcerpt: 'Auszug zum Fall.',
                responseRequirements: { requiresAllCoreConcepts: true, minimumItems: 1, minimumExamples: null, minimumExamplesPerGroup: null },
                answerFlexibility: { wordingMatchRequired: false, equivalentOwnExamplesAllowed: false, caseBound: true },
              },
            ],
            visualAssets: [],
          },
        ],
      },
      {
        chapterId: 'ch02',
        chapterNumber: '2',
        chapterTitle: 'Kapitel Zwei',
        topics: [
          {
            topicId: 'ch02-t01',
            topicNumber: '2.1',
            topicTitle: 'Drittes Topic',
            chapterId: 'ch02',
            learningPhase: { masterAnchor: '2.1', masterContent: '## 2.1 Drittes Topic\n\nLetzter Lerntext.' },
            questions: [
              {
                questionId: 'q04',
                topicId: 'ch02-t01',
                question: 'Letzte Frage?',
                hint: null,
                coreConcepts: [{ conceptId: 'c05', label: 'Letzter Punkt', acceptedPhrases: ['alles fertig'] }],
                optionalConcepts: [],
                shortModelAnswer: 'Fertig.',
                masterExcerpt: 'Letzter Auszug.',
                responseRequirements: { requiresAllCoreConcepts: true, minimumItems: 1, minimumExamples: null, minimumExamplesPerGroup: null },
                answerFlexibility: { wordingMatchRequired: false, equivalentOwnExamplesAllowed: false, caseBound: false },
              },
            ],
            visualAssets: [],
          },
        ],
      },
    ],
  }
}

function bankProp(fingerprint = FINGERPRINT_A) {
  return { data: testBank(), fingerprint, fileName: 'test-bank.json' }
}

// Eigene Fixture für die shortLearnAnswer-Erweiterung (Test 4-9, 11): nur q01
// bekommt shortLearnAnswer, die restlichen Fragen bleiben ohne dieses Feld,
// damit derselbe Test auch die gleichzeitige Koexistenz beider Flows prüft.
function bankWithShortLearnAnswer(fingerprint = FINGERPRINT_A) {
  const data = testBank()
  data.chapters[0].topics[0].questions[0].shortLearnAnswer = 'SHORT_LEARN_ANSWER_EXAKTER_TEXT_92817'
  return { data, fingerprint, fileName: 'short-learn-answer-bank.json' }
}

async function openFirstChapter(wrapper) {
  await findButtonByText(wrapper, 'Kapitel öffnen').trigger('click')
}

// Reale Konstellation aus dem Codex Technical Red Team, Finding M-01: eine
// Frage verlangt laut Fragewortlaut (minimumItems) mehr Punkte, als es
// coreConcepts-Objekte gibt (ein CoreConcept kann mehrere fachliche Elemente
// bündeln). Eigener kleiner Fixture, damit die anderen Tests unberührt bleiben.
function bankWithMismatchedRequirements() {
  return {
    data: {
      chapters: [
        {
          chapterId: 'ch01',
          chapterNumber: '1',
          chapterTitle: 'Kapitel Eins',
          topics: [
            {
              topicId: 'ch01-t01',
              topicNumber: '1.1',
              topicTitle: 'Mismatch-Topic',
              chapterId: 'ch01',
              learningPhase: { masterAnchor: '1.1', masterContent: '## 1.1 Mismatch-Topic\n\nText.' },
              questions: [
                {
                  questionId: 'mismatch-q01',
                  topicId: 'ch01-t01',
                  question: 'Nennen Sie sieben Elemente.',
                  hint: null,
                  coreConcepts: [
                    { conceptId: 'mc01', label: 'Konzept Alpha', acceptedPhrases: ['Alphapunkt kommt vor'] },
                    { conceptId: 'mc02', label: 'Konzept Beta', acceptedPhrases: ['Betapunkt kommt vor'] },
                  ],
                  optionalConcepts: [],
                  shortModelAnswer: 'Musterantwort mit sieben Elementen.',
                  masterExcerpt: 'Auszug.',
                  responseRequirements: { requiresAllCoreConcepts: true, minimumItems: 7, minimumExamples: null, minimumExamplesPerGroup: null },
                  answerFlexibility: { wordingMatchRequired: false, equivalentOwnExamplesAllowed: false, caseBound: false },
                },
              ],
              visualAssets: [],
            },
          ],
        },
      ],
    },
    fingerprint: 'c'.repeat(64),
    fileName: 'mismatch-bank.json',
  }
}

// Cross-Reference-Metadata-Repair (Codex Technical Red Team): ein Topic mit
// topicKind === "crossReference" hat bewusst questions: [] (z.B. ch07-t08 im
// privaten Goldstandard). Eigene kleine Bank mit genau einem solchen Topic
// zwischen zwei normalen Topics, damit Navigation/Fortschritt/Resume über die
// Cross-Reference-Stelle hinweg geprüft werden können, ohne die private Bank
// zu benötigen.
function bankWithCrossReferenceTopic() {
  const data = testBank()
  data.chapters[0].topics.splice(1, 0, {
    topicId: 'ch01-t01b',
    topicNumber: '1.1b',
    topicTitle: 'Verweis-Topic',
    topicKind: 'crossReference',
    chapterId: 'ch01',
    learningPhase: { masterAnchor: '1.1b', masterContent: '## 1.1b Verweis-Topic\n\nDieser Abschnitt verweist nur auf andere Kapitel, ohne eigene Frage.' },
    questions: [],
    visualAssets: [],
  })
  return { data, fingerprint: FINGERPRINT_A, fileName: 'cross-reference-bank.json' }
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('MAJOR-Repair UI: minimumItems > coreConcepts.length (Codex Finding M-01)', () => {
  it('behauptet nie "7 Kernpunkte" und zeigt Mengenanforderung und CoreConcept-Erkennung getrennt', async () => {
    const wrapper = mount(MasterLernmentorApp, { props: { bank: bankWithMismatchedRequirements() } })
    await openFirstChapter(wrapper)
    await findButtonByText(wrapper, 'Ich habe es gelesen – jetzt abfragen').trigger('click')
    await wrapper.find('.freetext-field textarea').setValue('Der Alphapunkt kommt vor und auch der Betapunkt kommt vor.')
    await findButtonByText(wrapper, 'Antwort prüfen').trigger('click')

    // A) Nie ein "7 Kernpunkte"-Text.
    expect(wrapper.text()).not.toMatch(/7\s*Kernpunkt/)
    // B) Kein unmöglicher "fehlt noch"-Hinweis, weil beide vorhandenen CoreConcepts erkannt wurden.
    expect(wrapper.find('.concept-requirement-hint').exists()).toBe(false)
    expect(wrapper.text()).toContain('Erkannte Kernpunkte: 2 von 2')
    // C) Die Mengenanforderung erscheint separat und neutral.
    expect(wrapper.find('.answer-flexibility-note').text()).toContain('mindestens 7')
    expect(wrapper.find('.answer-flexibility-note').text()).toContain('Prüfe, ob du diese Anzahl vollständig genannt hast')
  })

  it('zeigt den "nicht alle Kernpunkte"-Hinweis weiterhin korrekt, wenn CoreConcepts fehlen - unabhängig von minimumItems=7', async () => {
    const wrapper = mount(MasterLernmentorApp, { props: { bank: bankWithMismatchedRequirements() } })
    await openFirstChapter(wrapper)
    await findButtonByText(wrapper, 'Ich habe es gelesen – jetzt abfragen').trigger('click')
    await wrapper.find('.freetext-field textarea').setValue('Nur der Alphapunkt kommt vor.')
    await findButtonByText(wrapper, 'Antwort prüfen').trigger('click')

    expect(wrapper.find('.concept-requirement-hint').exists()).toBe(true)
    expect(wrapper.find('.concept-requirement-hint').text()).toContain('1 von 2')
    expect(wrapper.find('.concept-requirement-hint').text()).not.toContain('7')
  })
})

describe('Erstkontakt (Test 5, 6)', () => {
  it('zeigt beim ersten Besuch eines Topics zuerst die Lernphase, noch keine Frage', async () => {
    const wrapper = mount(MasterLernmentorApp, { props: { bank: bankProp() } })
    await openFirstChapter(wrapper)

    expect(wrapper.find('.learning-phase-card').exists()).toBe(true)
    expect(wrapper.text()).toContain('Lerntext hier')
    expect(wrapper.find('.freetext-field').exists()).toBe(false)
    expect(findButtonByText(wrapper, 'Ich habe es gelesen – jetzt abfragen')).toBeTruthy()
  })

  it('"jetzt abfragen" öffnet die erste Frage', async () => {
    const wrapper = mount(MasterLernmentorApp, { props: { bank: bankProp() } })
    await openFirstChapter(wrapper)
    await findButtonByText(wrapper, 'Ich habe es gelesen – jetzt abfragen').trigger('click')

    expect(wrapper.find('.learning-phase-card').exists()).toBe(false)
    expect(wrapper.text()).toContain('Erste Frage?')
    expect(wrapper.find('.freetext-field textarea').exists()).toBe(true)
    expect(wrapper.find('[type=radio]').exists()).toBe(false)
    expect(wrapper.find('.answer-button').exists()).toBe(false)
  })
})

describe('Wiederholung (Test 7)', () => {
  it('bietet beim erneuten Besuch eine Wahl und kann die Lernphase überspringen', async () => {
    const wrapper = mount(MasterLernmentorApp, { props: { bank: bankProp() } })
    await openFirstChapter(wrapper)
    await findButtonByText(wrapper, 'Ich habe es gelesen – jetzt abfragen').trigger('click')
    // Zweites Topic öffnen, dann zurück zu Kapitel 1 -> Topic 1 ist bereits gelesen.
    await findButtonByText(wrapper, 'Antwort prüfen').trigger('click')
    await findButtonByText(wrapper, 'Nächste Frage').trigger('click')
    await findButtonByText(wrapper, 'Antwort prüfen').trigger('click')
    await findButtonByText(wrapper, 'Nächste Frage').trigger('click')
    // Topic abgeschlossen -> zurück zur Kapitelübersicht -> Kapitel erneut öffnen.
    // Die Kachel zeigt jetzt "Weiterlernen" statt "Kapitel öffnen", weil ein
    // Checkpoint in diesem Kapitel existiert.
    await findButtonByText(wrapper, 'Zur Kapitelübersicht').trigger('click')
    await findButtonByText(wrapper, 'Weiterlernen').trigger('click')

    expect(wrapper.find('.topic-intro-card').exists()).toBe(true)
    expect(wrapper.text()).toContain('bereits gelesen')

    await findButtonByText(wrapper, 'Dieses Thema kenne ich schon – direkt zur Abfrage').trigger('click')
    expect(wrapper.find('.topic-intro-card').exists()).toBe(false)
    expect(wrapper.text()).toContain('Erste Frage?')
  })

  it('kann die Lernphase alternativ erneut lesen', async () => {
    const wrapper = mount(MasterLernmentorApp, { props: { bank: bankProp() } })
    await openFirstChapter(wrapper)
    await findButtonByText(wrapper, 'Ich habe es gelesen – jetzt abfragen').trigger('click')
    await findButtonByText(wrapper, 'Antwort prüfen').trigger('click')
    await findButtonByText(wrapper, 'Nächste Frage').trigger('click')
    await findButtonByText(wrapper, 'Antwort prüfen').trigger('click')
    await findButtonByText(wrapper, 'Nächste Frage').trigger('click')
    await findButtonByText(wrapper, 'Zur Kapitelübersicht').trigger('click')
    await findButtonByText(wrapper, 'Weiterlernen').trigger('click')

    await findButtonByText(wrapper, 'Lernabschnitt noch einmal lesen').trigger('click')
    expect(wrapper.find('.learning-phase-card').exists()).toBe(true)
  })
})

describe('Hinweis (Test 8)', () => {
  it('zeigt den vorhandenen Hint nur nach Klick, nicht automatisch', async () => {
    const wrapper = mount(MasterLernmentorApp, { props: { bank: bankProp() } })
    await openFirstChapter(wrapper)
    await findButtonByText(wrapper, 'Ich habe es gelesen – jetzt abfragen').trigger('click')

    expect(wrapper.find('.hint-box').exists()).toBe(false)
    await findButtonByText(wrapper, 'Hinweis anzeigen').trigger('click')
    expect(wrapper.find('.hint-box').text()).toBe('Ein Hinweis.')
    await findButtonByText(wrapper, 'Hinweis ausblenden').trigger('click')
    expect(wrapper.find('.hint-box').exists()).toBe(false)
  })
})

describe('Freitext-Datenschutz (Test 9, Datensicherheitstest)', () => {
  it('persistiert die Freitextantwort nie in localStorage', async () => {
    const setItemSpy = vi.spyOn(window.localStorage.__proto__, 'setItem')
    const wrapper = mount(MasterLernmentorApp, { props: { bank: bankProp() } })
    await openFirstChapter(wrapper)
    await findButtonByText(wrapper, 'Ich habe es gelesen – jetzt abfragen').trigger('click')

    await wrapper.find('.freetext-field textarea').setValue('PRIVATE_FREETEXT_SHOULD_NOT_PERSIST_92817')
    await findButtonByText(wrapper, 'Antwort prüfen').trigger('click')

    for (const call of setItemSpy.mock.calls) {
      expect(call.join('|')).not.toContain('PRIVATE_FREETEXT_SHOULD_NOT_PERSIST_92817')
    }
    const raw = window.localStorage.getItem('marketingLearningProgress:v2')
    expect(raw).not.toContain('PRIVATE_FREETEXT_SHOULD_NOT_PERSIST_92817')
  })

  it('verwirft den Freitext beim Wechsel zur nächsten Frage', async () => {
    const wrapper = mount(MasterLernmentorApp, { props: { bank: bankProp() } })
    await openFirstChapter(wrapper)
    await findButtonByText(wrapper, 'Ich habe es gelesen – jetzt abfragen').trigger('click')
    await wrapper.find('.freetext-field textarea').setValue('Irgendein Text')
    await findButtonByText(wrapper, 'Antwort prüfen').trigger('click')
    await findButtonByText(wrapper, 'Nächste Frage').trigger('click')

    expect(wrapper.find('.freetext-field textarea').element.value).toBe('')
  })
})

describe('Antwortprüfung (Test 10, 11, 12, 20)', () => {
  it('zeigt nach Prüfung die Musterantwort, erkannte CoreConcepts und getrennte OptionalConcepts', async () => {
    const wrapper = mount(MasterLernmentorApp, { props: { bank: bankProp() } })
    await openFirstChapter(wrapper)
    await findButtonByText(wrapper, 'Ich habe es gelesen – jetzt abfragen').trigger('click')
    await wrapper.find('.freetext-field textarea').setValue('Hier kommt Erklärung A vorkommt und auch Erklärung B vorkommt.')
    await findButtonByText(wrapper, 'Antwort prüfen').trigger('click')

    expect(wrapper.find('.model-answer-box').text()).toContain('Dies ist die Musterantwort.')
    expect(wrapper.text()).toContain('Automatische Erkennung = Lernhilfe')

    const coreItems = wrapper.findAll('.core-concept-list li')
    expect(coreItems).toHaveLength(2)
    expect(coreItems.every((item) => item.classes().includes('concept-matched'))).toBe(true)

    const optionalItems = wrapper.findAll('.optional-concept-list li')
    expect(optionalItems).toHaveLength(1)
    expect(wrapper.text()).toContain('Zusätzlich möglich')
  })

  it('zeigt einen neutralen Hinweis statt einer harten Note, wenn responseRequirements nicht erfüllt sind (Test 20)', async () => {
    const wrapper = mount(MasterLernmentorApp, { props: { bank: bankProp() } })
    await openFirstChapter(wrapper)
    await findButtonByText(wrapper, 'Ich habe es gelesen – jetzt abfragen').trigger('click')
    await wrapper.find('.freetext-field textarea').setValue('Nur etwas Unklares.')
    await findButtonByText(wrapper, 'Antwort prüfen').trigger('click')

    expect(wrapper.text()).not.toMatch(/falsch\s*[-–]\s*\d+\s*%/i)
    expect(wrapper.find('.concept-requirement-hint').exists()).toBe(true)
  })
})

describe('Kurz-Lernantwort / shortLearnAnswer (Test 4-11)', () => {
  it('zeigt die Kurz-Lernantwort nach "Antwort prüfen" exakt und unverändert an (Test 4, 5)', async () => {
    const wrapper = mount(MasterLernmentorApp, { props: { bank: bankWithShortLearnAnswer() } })
    await openFirstChapter(wrapper)
    await findButtonByText(wrapper, 'Ich habe es gelesen – jetzt abfragen').trigger('click')
    await findButtonByText(wrapper, 'Antwort prüfen').trigger('click')

    expect(wrapper.find('.short-learn-answer-box').exists()).toBe(true)
    expect(wrapper.find('.short-learn-answer-box').text()).toContain('SHORT_LEARN_ANSWER_EXAKTER_TEXT_92817')
  })

  it('zeigt die ausführliche Musterantwort bei shortLearnAnswer zunächst eingeklappt, mit korrektem aria-expanded (Test 6, 9)', async () => {
    const wrapper = mount(MasterLernmentorApp, { props: { bank: bankWithShortLearnAnswer() } })
    await openFirstChapter(wrapper)
    await findButtonByText(wrapper, 'Ich habe es gelesen – jetzt abfragen').trigger('click')
    await findButtonByText(wrapper, 'Antwort prüfen').trigger('click')

    expect(wrapper.find('.model-answer-box').exists()).toBe(false)
    const toggle = findButtonByText(wrapper, 'Ausführliche Musterantwort anzeigen')
    expect(toggle).toBeTruthy()
    expect(toggle.attributes('aria-expanded')).toBe('false')
  })

  it('öffnet und schließt die ausführliche Musterantwort per Toggle (Test 7, 8, 9)', async () => {
    const wrapper = mount(MasterLernmentorApp, { props: { bank: bankWithShortLearnAnswer() } })
    await openFirstChapter(wrapper)
    await findButtonByText(wrapper, 'Ich habe es gelesen – jetzt abfragen').trigger('click')
    await findButtonByText(wrapper, 'Antwort prüfen').trigger('click')

    await findButtonByText(wrapper, 'Ausführliche Musterantwort anzeigen').trigger('click')
    expect(wrapper.find('.model-answer-box').exists()).toBe(true)
    expect(wrapper.find('.model-answer-box').text()).toContain('Dies ist die Musterantwort.')
    const openToggle = findButtonByText(wrapper, 'Ausführliche Musterantwort ausblenden')
    expect(openToggle.attributes('aria-expanded')).toBe('true')

    await openToggle.trigger('click')
    expect(wrapper.find('.model-answer-box').exists()).toBe(false)
    expect(findButtonByText(wrapper, 'Ausführliche Musterantwort anzeigen')).toBeTruthy()
  })

  it('setzt den Toggle beim Wechsel zur nächsten Frage wieder auf eingeklappt zurück', async () => {
    const wrapper = mount(MasterLernmentorApp, { props: { bank: bankWithShortLearnAnswer() } })
    await openFirstChapter(wrapper)
    await findButtonByText(wrapper, 'Ich habe es gelesen – jetzt abfragen').trigger('click')
    await findButtonByText(wrapper, 'Antwort prüfen').trigger('click')
    await findButtonByText(wrapper, 'Ausführliche Musterantwort anzeigen').trigger('click')
    expect(wrapper.find('.model-answer-box').exists()).toBe(true)

    await findButtonByText(wrapper, 'Nächste Frage').trigger('click')
    await findButtonByText(wrapper, 'Antwort prüfen').trigger('click')

    // q02 hat kein shortLearnAnswer -> bisheriger Flow, Musterantwort sofort sichtbar.
    expect(wrapper.find('.short-learn-answer-box').exists()).toBe(false)
    expect(wrapper.find('.model-answer-box').exists()).toBe(true)
  })

  it('zeigt bei einer Frage ohne shortLearnAnswer weiterhin den bisherigen Flow ohne Kurzantwort/Toggle (Test 10)', async () => {
    const wrapper = mount(MasterLernmentorApp, { props: { bank: bankProp() } })
    await openFirstChapter(wrapper)
    await findButtonByText(wrapper, 'Ich habe es gelesen – jetzt abfragen').trigger('click')
    await findButtonByText(wrapper, 'Antwort prüfen').trigger('click')

    expect(wrapper.find('.short-learn-answer-box').exists()).toBe(false)
    expect(findButtonByText(wrapper, 'Ausführliche Musterantwort anzeigen')).toBeFalsy()
    expect(wrapper.find('.model-answer-box').exists()).toBe(true)
    expect(wrapper.find('.model-answer-box').text()).toContain('Dies ist die Musterantwort.')
  })

  it('persistiert shortLearnAnswer nie in localStorage (Test 11)', async () => {
    const setItemSpy = vi.spyOn(window.localStorage.__proto__, 'setItem')
    const wrapper = mount(MasterLernmentorApp, { props: { bank: bankWithShortLearnAnswer() } })
    await openFirstChapter(wrapper)
    await findButtonByText(wrapper, 'Ich habe es gelesen – jetzt abfragen').trigger('click')
    await findButtonByText(wrapper, 'Antwort prüfen').trigger('click')
    await findButtonByText(wrapper, 'Ausführliche Musterantwort anzeigen').trigger('click')

    for (const call of setItemSpy.mock.calls) {
      expect(call.join('|')).not.toContain('SHORT_LEARN_ANSWER_EXAKTER_TEXT_92817')
    }
    const raw = window.localStorage.getItem('marketingLearningProgress:v2')
    expect(raw).not.toContain('SHORT_LEARN_ANSWER_EXAKTER_TEXT_92817')
  })
})

describe('Eigene Beispiele / answerFlexibility (Test 18)', () => {
  it('markiert ein nicht wortgleiches eigenes Beispiel nicht fälschlich als falsch, wenn equivalentOwnExamplesAllowed=true', async () => {
    const wrapper = mount(MasterLernmentorApp, { props: { bank: bankProp() } })
    await openFirstChapter(wrapper)
    await findButtonByText(wrapper, 'Ich habe es gelesen – jetzt abfragen').trigger('click')
    await findButtonByText(wrapper, 'Antwort prüfen').trigger('click')
    await findButtonByText(wrapper, 'Nächste Frage').trigger('click')

    await wrapper.find('.freetext-field textarea').setValue('Ein komplett eigenes, unerwartetes Beispiel.')
    await findButtonByText(wrapper, 'Antwort prüfen').trigger('click')

    expect(wrapper.text()).toContain('Eigenes Beispiel bitte selbst mit der Musterlösung')
    expect(wrapper.text()).not.toMatch(/falsch/i)
  })
})

describe('caseBound (Test 19)', () => {
  it('zeigt einen Hinweis, dass sich die Frage auf den konkret genannten Fall bezieht', async () => {
    const wrapper = mount(MasterLernmentorApp, { props: { bank: bankProp() } })
    await openFirstChapter(wrapper)
    await findButtonByText(wrapper, 'Ich habe es gelesen – jetzt abfragen').trigger('click')
    await findButtonByText(wrapper, 'Antwort prüfen').trigger('click')
    await findButtonByText(wrapper, 'Nächste Frage').trigger('click')
    await findButtonByText(wrapper, 'Antwort prüfen').trigger('click')
    await findButtonByText(wrapper, 'Nächste Frage').trigger('click')
    // Topic (beide Fragen) abgeschlossen -> nächstes Unterthema (Fall-Frage)
    await findButtonByText(wrapper, 'Nächstes Unterthema').trigger('click')
    await findButtonByText(wrapper, 'Ich habe es gelesen – jetzt abfragen').trigger('click')

    expect(wrapper.find('.case-bound-note').exists()).toBe(true)
    expect(wrapper.text()).toContain('konkret genannten Fall')
  })
})

describe('MasterExcerpt direkt erreichbar (Test 13)', () => {
  it('zeigt bei jeder Frage direkt question.masterExcerpt, ohne das ganze Topic/Kapitel öffnen zu müssen', async () => {
    const wrapper = mount(MasterLernmentorApp, { props: { bank: bankProp() } })
    await openFirstChapter(wrapper)
    await findButtonByText(wrapper, 'Ich habe es gelesen – jetzt abfragen').trigger('click')

    const detailsList = wrapper.findAll('.master-excerpt-details')
    expect(detailsList).toHaveLength(2)
    expect(detailsList[1].text()).toContain('Passende Stelle im Master')
    expect(detailsList[1].text()).toContain('Passender Masterausschnitt für Frage eins.')
    expect(detailsList[1].text()).not.toContain('Weiterer Lerntext')
  })
})

describe('VisualAsset-Slot über den [ABBILDUNG:]-Marker (Test 23)', () => {
  it('rendert den Bild-Slot anstelle des Rohmarkers in der Lernphase', async () => {
    const wrapper = mount(MasterLernmentorApp, { props: { bank: bankProp() } })
    await openFirstChapter(wrapper)

    expect(wrapper.text()).not.toContain('[ABBILDUNG:')
    expect(wrapper.find('.visual-asset-slot').exists()).toBe(true)
    expect(wrapper.text()).toContain('Originalabbildung lokal laden')
  })
})

describe('Self-Rating (Test 14)', () => {
  it('speichert die Selbsteinschätzung technisch, ohne Punkte zu berechnen', async () => {
    const wrapper = mount(MasterLernmentorApp, { props: { bank: bankProp() } })
    await openFirstChapter(wrapper)
    await findButtonByText(wrapper, 'Ich habe es gelesen – jetzt abfragen').trigger('click')
    await findButtonByText(wrapper, 'Antwort prüfen').trigger('click')

    const greenButton = wrapper.findAll('.self-rating-button').find((b) => b.text().includes('Sicher'))
    await greenButton.trigger('click')
    expect(greenButton.attributes('aria-pressed')).toBe('true')

    const checkpoint = getMasterLearnProgress(FINGERPRINT_A)
    expect(checkpoint.selfRatings.q01).toBe('green')
    // Kein berechneter Score/keine Note - der neutrale responseRequirements-
    // Hinweis ("mindestens N Punkte/Elemente...") ist erlaubt und kein Score.
    expect(wrapper.text()).not.toMatch(/Note[:\s]/i)
    expect(wrapper.text()).not.toMatch(/\d+\s*Punkte\s*(erreicht|erzielt|von\s*\d+)/i)
  })
})

describe('Topic-/Kapitelwechsel und Fortschritt (Test 21, 22)', () => {
  it('wechselt in Master-Reihenfolge über Topics und Kapitel hinweg und zeigt echten Fortschritt', async () => {
    const wrapper = mount(MasterLernmentorApp, { props: { bank: bankProp() } })
    await openFirstChapter(wrapper)
    await findButtonByText(wrapper, 'Ich habe es gelesen – jetzt abfragen').trigger('click')
    expect(wrapper.text()).toContain('Topic 1 von 2 im Kapitel')

    await findButtonByText(wrapper, 'Antwort prüfen').trigger('click')
    await findButtonByText(wrapper, 'Nächste Frage').trigger('click')
    await findButtonByText(wrapper, 'Antwort prüfen').trigger('click')
    await findButtonByText(wrapper, 'Nächste Frage').trigger('click')

    expect(wrapper.find('.result-card').exists()).toBe(true)
    expect(wrapper.text()).toContain('Gesamt-Master-Fortschritt: 33 %')

    await findButtonByText(wrapper, 'Nächstes Unterthema').trigger('click')
    expect(wrapper.text()).toContain('Zweites Topic')

    await findButtonByText(wrapper, 'Ich habe es gelesen – jetzt abfragen').trigger('click')
    await findButtonByText(wrapper, 'Antwort prüfen').trigger('click')
    await findButtonByText(wrapper, 'Nächste Frage').trigger('click')
    await findButtonByText(wrapper, 'Nächstes Unterthema').trigger('click')

    // Über die Kapitelgrenze hinweg landet man im nächsten Kapitel, exakt Master-Reihenfolge.
    expect(wrapper.text()).toContain('Drittes Topic')
  })
})

describe('Resume (Test 15, 16)', () => {
  it('stellt die gespeicherte Position wieder her, wenn der Fingerprint passt', async () => {
    const wrapper = mount(MasterLernmentorApp, { props: { bank: bankProp() } })
    await openFirstChapter(wrapper)
    await findButtonByText(wrapper, 'Ich habe es gelesen – jetzt abfragen').trigger('click')
    await findButtonByText(wrapper, 'Antwort prüfen').trigger('click')
    await findButtonByText(wrapper, 'Nächste Frage').trigger('click')
    // Jetzt bei Frage 2 von Topic 1 - neu mounten (simuliert Tab-Wechsel/Reload) und fortsetzen.
    await wrapper.unmount()

    const resumed = mount(MasterLernmentorApp, { props: { bank: bankProp(), resumeRequest: { nonce: 1 } } })
    await resumed.vm.$nextTick()
    expect(resumed.text()).toContain('Nennen Sie ein eigenes Beispiel.')
  })

  it('übernimmt das Resume nicht, wenn die neu geladene Bank einen anderen Fingerprint hat (Test 16, Abschnitt 30)', async () => {
    const wrapper = mount(MasterLernmentorApp, { props: { bank: bankProp(FINGERPRINT_A) } })
    await openFirstChapter(wrapper)
    await findButtonByText(wrapper, 'Ich habe es gelesen – jetzt abfragen').trigger('click')
    await findButtonByText(wrapper, 'Antwort prüfen').trigger('click')
    await findButtonByText(wrapper, 'Nächste Frage').trigger('click')
    await wrapper.unmount()

    const other = mount(MasterLernmentorApp, { props: { bank: bankProp(FINGERPRINT_B) } })
    await other.vm.$nextTick()
    // Andere Bank, kein Checkpoint für FINGERPRINT_B -> Kapitelübersicht, kein falscher Sprung.
    expect(other.find('.chapter-overview').exists()).toBe(true)
    expect(other.text()).toContain('Master gelernt: 0 %')
  })
})

describe('Bank-Aware Resume-Hardening (Codex Finding m-01, MINOR) - End-to-End', () => {
  it('crasht nicht und zeigt keine leere Fragenansicht bei manipuliertem/veraltetem Checkpoint, sondern normalisiert sicher', async () => {
    // Simuliert beschädigten/manipulierten Storage: unbekanntes Topic, absurd
    // hoher Frageindex, unbekannte completedTopicIds/Ratings, vorgetäuschtes isComplete.
    saveMasterLearnProgress(FINGERPRINT_A, {
      bankFileName: 'manipuliert.json',
      currentChapterId: 'geist-kapitel',
      currentTopicId: 'geist-topic',
      currentQuestionId: 'geist-frage',
      currentQuestionIndex: 9999,
      topicsSeen: ['geist-topic', 'ch01-t01'],
      completedTopicIds: ['ch01-t01', 'ch01-t02', 'ch02-t01', 'geist-1', 'geist-2', 'geist-3'],
      selfRatings: { q01: 'green', 'geist-frage': 'red' },
      isComplete: true,
      lastAccessedAt: new Date().toISOString(),
    })

    // mount() wirft hier keine Exception - ein manipulierter Checkpoint darf
    // niemals zu einem Absturz führen.
    const wrapper = mount(MasterLernmentorApp, { props: { bank: bankProp(), resumeRequest: { nonce: 1 } } })
    await wrapper.vm.$nextTick()

    // Kein leerer/kaputter Zustand: entweder Kapitelübersicht oder eine echte Lernphase/Frage - nie eine leere Section.
    const visibleScreens = ['.chapter-overview', '.learning-phase-card', '.quiz-layout', '.topic-intro-card']
    expect(visibleScreens.some((selector) => wrapper.find(selector).exists())).toBe(true)
    // Insbesondere: falls die Fragenansicht aktiv ist, muss eine echte Frage stehen (kein leeres .question-card ohne Inhalt).
    if (wrapper.find('.quiz-layout').exists()) {
      expect(wrapper.find('.question-card h2').text().length).toBeGreaterThan(0)
    }

    // Storage wurde bankgebunden bereinigt (self-healing): echte Bank hat nur 3
    // Topics insgesamt - trotz 6 gespeicherter Einträge (3 davon Geister-IDs)
    // dürfen nie mehr als 3 gezählt werden, und jeder verbleibende Eintrag muss
    // tatsächlich in der Bank existieren.
    const healedCheckpoint = getMasterLearnProgress(FINGERPRINT_A)
    expect(healedCheckpoint.completedTopicIds.length).toBeLessThanOrEqual(3)
    expect(healedCheckpoint.completedTopicIds.every((id) => ['ch01-t01', 'ch01-t02', 'ch02-t01'].includes(id))).toBe(true)
    expect(healedCheckpoint.selfRatings).toEqual({ q01: 'green' })
    expect(healedCheckpoint.currentTopicId).toBe('ch01-t01')
    expect(healedCheckpoint.currentQuestionIndex).toBe(0)
  })
})

// Cross-Reference-Metadata-Repair (Codex Technical Red Team): ein Topic mit
// topicKind === "crossReference" (questions: []) darf nie in den Fragenmodus
// wechseln, nie eine Phantomfrage erzeugen und den Fortschritt/100%/Resume
// der übrigen, echten Fragen nicht kaputt machen.
describe('Cross-Reference-Topic (topicKind === "crossReference")', () => {
  it('zeigt beim Betreten nur den Lernabschnitt, nie ein Fragen-Layout - crasht nicht (Test 7, 8)', async () => {
    const wrapper = mount(MasterLernmentorApp, { props: { bank: bankWithCrossReferenceTopic() } })
    await openFirstChapter(wrapper)
    await findButtonByText(wrapper, 'Ich habe es gelesen – jetzt abfragen').trigger('click')
    await findButtonByText(wrapper, 'Antwort prüfen').trigger('click')
    await findButtonByText(wrapper, 'Nächste Frage').trigger('click')
    await findButtonByText(wrapper, 'Antwort prüfen').trigger('click')
    await findButtonByText(wrapper, 'Nächste Frage').trigger('click')
    // ch01-t01 (2 Fragen) fertig -> "Nächstes Unterthema" führt zum Cross-Reference-Topic.
    await findButtonByText(wrapper, 'Nächstes Unterthema').trigger('click')

    expect(wrapper.text()).toContain('Verweis-Topic')
    expect(wrapper.find('.learning-phase-card').exists()).toBe(true)
    expect(wrapper.find('.quiz-layout').exists()).toBe(false)
    expect(wrapper.find('.freetext-field').exists()).toBe(false)
    // Keine Phantomfrage: kein "abfragen"-Button, weil es nichts abzufragen gibt.
    expect(findButtonByText(wrapper, 'Ich habe es gelesen – jetzt abfragen')).toBeFalsy()
    expect(findButtonByText(wrapper, 'Gelesen – weiter')).toBeTruthy()
  })

  it('schließt das Cross-Reference-Topic beim Bestätigen direkt ab, ohne je ins Fragen-Layout zu wechseln (Test 8, 9)', async () => {
    const wrapper = mount(MasterLernmentorApp, { props: { bank: bankWithCrossReferenceTopic() } })
    await openFirstChapter(wrapper)
    await findButtonByText(wrapper, 'Ich habe es gelesen – jetzt abfragen').trigger('click')
    await findButtonByText(wrapper, 'Antwort prüfen').trigger('click')
    await findButtonByText(wrapper, 'Nächste Frage').trigger('click')
    await findButtonByText(wrapper, 'Antwort prüfen').trigger('click')
    await findButtonByText(wrapper, 'Nächste Frage').trigger('click')
    await findButtonByText(wrapper, 'Nächstes Unterthema').trigger('click')

    await findButtonByText(wrapper, 'Gelesen – weiter').trigger('click')

    expect(wrapper.find('.quiz-layout').exists()).toBe(false)
    expect(wrapper.find('.result-card').exists()).toBe(true)
    expect(wrapper.text()).toContain('Verweis-Topic')
    // Bank hat 4 Topics gesamt (ch01-t01, Verweis-Topic, ch01-t02, ch02-t01) -> 2 abgeschlossen = 50%.
    expect(wrapper.text()).toContain('Gesamt-Master-Fortschritt: 50 %')
  })

  it('führt die Navigation danach sicher zur nächsten echten Frage (Test 9)', async () => {
    const wrapper = mount(MasterLernmentorApp, { props: { bank: bankWithCrossReferenceTopic() } })
    await openFirstChapter(wrapper)
    await findButtonByText(wrapper, 'Ich habe es gelesen – jetzt abfragen').trigger('click')
    await findButtonByText(wrapper, 'Antwort prüfen').trigger('click')
    await findButtonByText(wrapper, 'Nächste Frage').trigger('click')
    await findButtonByText(wrapper, 'Antwort prüfen').trigger('click')
    await findButtonByText(wrapper, 'Nächste Frage').trigger('click')
    await findButtonByText(wrapper, 'Nächstes Unterthema').trigger('click')
    await findButtonByText(wrapper, 'Gelesen – weiter').trigger('click')
    await findButtonByText(wrapper, 'Nächstes Unterthema').trigger('click')

    expect(wrapper.text()).toContain('Zweites Topic')
    await findButtonByText(wrapper, 'Ich habe es gelesen – jetzt abfragen').trigger('click')
    expect(wrapper.text()).toContain('Fall Y - was folgt daraus?')
  })

  it('zählt weiterhin nur die echten Fragen, erzeugt keine 173./Phantom-Frage und erreicht 100 % (Test 10, 11)', async () => {
    const wrapper = mount(MasterLernmentorApp, { props: { bank: bankWithCrossReferenceTopic() } })
    expect(wrapper.text()).toContain('Master gelernt: 0 %')
    await openFirstChapter(wrapper)

    await findButtonByText(wrapper, 'Ich habe es gelesen – jetzt abfragen').trigger('click')
    expect(wrapper.text()).toContain('Frage 1 von 2')
    await findButtonByText(wrapper, 'Antwort prüfen').trigger('click')
    await findButtonByText(wrapper, 'Nächste Frage').trigger('click')
    expect(wrapper.text()).toContain('Frage 2 von 2')
    await findButtonByText(wrapper, 'Antwort prüfen').trigger('click')
    await findButtonByText(wrapper, 'Nächste Frage').trigger('click')
    await findButtonByText(wrapper, 'Nächstes Unterthema').trigger('click')
    await findButtonByText(wrapper, 'Gelesen – weiter').trigger('click')
    await findButtonByText(wrapper, 'Nächstes Unterthema').trigger('click')

    // ch01-t02: genau 1 echte Frage, kein "Frage 1 von 0" oder Ähnliches.
    await findButtonByText(wrapper, 'Ich habe es gelesen – jetzt abfragen').trigger('click')
    expect(wrapper.text()).toContain('Frage 1 von 1')
    await findButtonByText(wrapper, 'Antwort prüfen').trigger('click')
    await findButtonByText(wrapper, 'Nächste Frage').trigger('click')
    await findButtonByText(wrapper, 'Nächstes Unterthema').trigger('click')

    // Letztes Topic (ch02-t01, 1 echte Frage).
    await findButtonByText(wrapper, 'Ich habe es gelesen – jetzt abfragen').trigger('click')
    await findButtonByText(wrapper, 'Antwort prüfen').trigger('click')
    await findButtonByText(wrapper, 'Nächste Frage').trigger('click')
    await findButtonByText(wrapper, 'Nächstes Unterthema').trigger('click')

    expect(wrapper.text()).toContain('Master gelernt: 100 %')
  })

  it('Resume auf einem Cross-Reference-Topic bleibt valide, keine Sackgasse (Test 12)', async () => {
    const wrapper = mount(MasterLernmentorApp, { props: { bank: bankWithCrossReferenceTopic() } })
    await openFirstChapter(wrapper)
    await findButtonByText(wrapper, 'Ich habe es gelesen – jetzt abfragen').trigger('click')
    await findButtonByText(wrapper, 'Antwort prüfen').trigger('click')
    await findButtonByText(wrapper, 'Nächste Frage').trigger('click')
    await findButtonByText(wrapper, 'Antwort prüfen').trigger('click')
    await findButtonByText(wrapper, 'Nächste Frage').trigger('click')
    await findButtonByText(wrapper, 'Nächstes Unterthema').trigger('click')
    // Checkpoint zeigt jetzt auf das Cross-Reference-Topic (learningPhase, noch nicht bestätigt).
    await wrapper.unmount()

    const resumed = mount(MasterLernmentorApp, { props: { bank: bankWithCrossReferenceTopic(), resumeRequest: { nonce: 1 } } })
    await resumed.vm.$nextTick()

    expect(resumed.find('.quiz-layout').exists()).toBe(false)
    const visibleScreens = ['.chapter-overview', '.learning-phase-card', '.topic-intro-card', '.result-card']
    expect(visibleScreens.some((selector) => resumed.find(selector).exists())).toBe(true)
    expect(resumed.text()).toContain('Verweis-Topic')
    // Von hier aus muss es sicher weitergehen, ohne Absturz/Sackgasse.
    await findButtonByText(resumed, 'Gelesen – weiter').trigger('click')
    expect(resumed.find('.quiz-layout').exists()).toBe(false)
  })

  it('lässt normale Topics und den shortLearnAnswer-Flow unverändert, auch wenn ein Cross-Reference-Topic in derselben Bank existiert (Test 13, 14, 15)', async () => {
    const data = testBank()
    data.chapters[0].topics[0].questions[0].shortLearnAnswer = 'SHORT_LEARN_ANSWER_CROSSREF_COEXIST_55219'
    data.chapters[0].topics.splice(1, 0, {
      topicId: 'ch01-t01b',
      topicNumber: '1.1b',
      topicTitle: 'Verweis-Topic',
      topicKind: 'crossReference',
      chapterId: 'ch01',
      learningPhase: { masterAnchor: '1.1b', masterContent: '## 1.1b Verweis-Topic\n\nVerweis ohne eigene Frage.' },
      questions: [],
      visualAssets: [],
    })
    const wrapper = mount(MasterLernmentorApp, { props: { bank: { data, fingerprint: FINGERPRINT_A, fileName: 'mixed-bank.json' } } })
    await openFirstChapter(wrapper)
    await findButtonByText(wrapper, 'Ich habe es gelesen – jetzt abfragen').trigger('click')
    await findButtonByText(wrapper, 'Antwort prüfen').trigger('click')

    // q01 hat shortLearnAnswer - unveränderter Flow trotz Cross-Reference-Topic in derselben Bank.
    expect(wrapper.find('.short-learn-answer-box').text()).toContain('SHORT_LEARN_ANSWER_CROSSREF_COEXIST_55219')
    await findButtonByText(wrapper, 'Nächste Frage').trigger('click')
    await findButtonByText(wrapper, 'Antwort prüfen').trigger('click')
    // q02 hat kein shortLearnAnswer - bisheriger Flow bleibt intakt.
    expect(wrapper.find('.short-learn-answer-box').exists()).toBe(false)
    expect(wrapper.find('.model-answer-box').exists()).toBe(true)
  })
})
