import { describe, expect, it } from 'vitest'
import { masterQuestionPosition } from '../masterLernmentorProgress.js'
import { countQuestions, countTopics } from '../masterLernmentorValidator.js'
import { syntheticMasterBank } from '../../__tests__/helpers/syntheticMasterBank.js'

// Gleiche Form wie Kapitel 1 der realen Bank: 16 Themen, 29 Fragen.
const CHAPTER_ONE_SHAPE = [2, 3, 1, 2, 2, 1, 2, 2, 1, 2, 2, 2, 1, 2, 2, 2]

describe('masterQuestionPosition', () => {
  it('liefert Themen-Frageindex, Kapitel-Frageindex, Kapitelgesamtzahl und Themenindex (Test 11-14)', () => {
    const bank = syntheticMasterBank({ chapters: [CHAPTER_ONE_SHAPE, [1, 1]] })
    expect(CHAPTER_ONE_SHAPE.reduce((sum, count) => sum + count, 0)).toBe(29)

    expect(masterQuestionPosition(bank, 'ch01-t01', 0)).toEqual({
      topicQuestionNumber: 1,
      topicQuestionTotal: 2,
      chapterQuestionNumber: 1,
      chapterQuestionTotal: 29,
      chapterTopicNumber: 1,
      chapterTopicTotal: 16,
    })
    // Thema 1 hat 2 Fragen -> erste Frage in Thema 2 ist Kapitel-Frage 3.
    expect(masterQuestionPosition(bank, 'ch01-t02', 0)).toMatchObject({
      topicQuestionNumber: 1,
      topicQuestionTotal: 3,
      chapterQuestionNumber: 3,
      chapterQuestionTotal: 29,
      chapterTopicNumber: 2,
    })
    // Letzte Frage des Kapitels.
    expect(masterQuestionPosition(bank, 'ch01-t16', 1)).toMatchObject({
      chapterQuestionNumber: 29,
      chapterQuestionTotal: 29,
      chapterTopicNumber: 16,
      chapterTopicTotal: 16,
    })
  })

  it('beginnt an der Kapitelgrenze wieder bei 1 und zählt nie Fragen fremder Kapitel mit (Test 16)', () => {
    const bank = syntheticMasterBank({ chapters: [CHAPTER_ONE_SHAPE, [1, 4]] })
    expect(masterQuestionPosition(bank, 'ch02-t01', 0)).toEqual({
      topicQuestionNumber: 1,
      topicQuestionTotal: 1,
      chapterQuestionNumber: 1,
      chapterQuestionTotal: 5,
      chapterTopicNumber: 1,
      chapterTopicTotal: 2,
    })
    expect(masterQuestionPosition(bank, 'ch02-t02', 3)).toMatchObject({ chapterQuestionNumber: 5, chapterQuestionTotal: 5 })
  })

  it('zählt ein Cross-Reference-Topic als Thema, aber nicht als Frage - keine Phantomfrage (Test 15)', () => {
    const bank = syntheticMasterBank({ chapters: [[2, 0, 3]] })
    expect(masterQuestionPosition(bank, 'ch01-t03', 0)).toEqual({
      topicQuestionNumber: 1,
      topicQuestionTotal: 3,
      chapterQuestionNumber: 3,
      chapterQuestionTotal: 5,
      chapterTopicNumber: 3,
      chapterTopicTotal: 3,
    })
    // Das Verweis-Topic selbst hat keine Frageposition.
    expect(masterQuestionPosition(bank, 'ch01-t02', 0)).toBeNull()
  })

  it('bildet die reale Bankform ab: 8 Kapitel, 88 Themen, 172 Fragen, ein Verweis-Topic - keine 173. Frage', () => {
    // Fragen je Kapitel 29/19/24/17/19/31/16/17, Themen je Kapitel 16/10/14/11/9/12/8/8.
    const spread = (topics, questions, crossReference = false) => {
      const real = crossReference ? topics - 1 : topics
      const counts = Array.from({ length: real }, (_, index) => Math.floor(questions / real) + (index < questions % real ? 1 : 0))
      return crossReference ? [...counts, 0] : counts
    }
    const bank = syntheticMasterBank({
      chapters: [spread(16, 29), spread(10, 19), spread(14, 24), spread(11, 17), spread(9, 19), spread(12, 31), spread(8, 16, true), spread(8, 17)],
    })
    expect(bank.chapters).toHaveLength(8)
    expect(countTopics(bank)).toBe(88)
    expect(countQuestions(bank)).toBe(172)

    const perChapterTotals = bank.chapters.map((chapter) => {
      const firstRealTopic = chapter.topics.find((topic) => topic.questions.length > 0)
      return masterQuestionPosition(bank, firstRealTopic.topicId, 0).chapterQuestionTotal
    })
    expect(perChapterTotals).toEqual([29, 19, 24, 17, 19, 31, 16, 17])
    expect(perChapterTotals.reduce((sum, count) => sum + count, 0)).toBe(172)

    // Jede Frage erhält genau eine eindeutige, lückenlose Kapitelnummer.
    bank.chapters.forEach((chapter) => {
      const numbers = chapter.topics.flatMap((topic) => topic.questions.map((_, index) => masterQuestionPosition(bank, topic.topicId, index).chapterQuestionNumber))
      expect(numbers).toEqual(numbers.map((_, index) => index + 1))
    })
  })

  it('liefert null statt einer falschen Anzeige bei unbekanntem Topic oder ungültigem Index', () => {
    const bank = syntheticMasterBank()
    expect(masterQuestionPosition(bank, 'gibt-es-nicht', 0)).toBeNull()
    expect(masterQuestionPosition(bank, 'ch01-t01', 99)).toBeNull()
    expect(masterQuestionPosition(bank, 'ch01-t01', -1)).toBeNull()
    expect(masterQuestionPosition(null, 'ch01-t01', 0)).toBeNull()
  })
})
