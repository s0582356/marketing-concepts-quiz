// Rein synthetische Master-Lernmentor-Bank für Tests - enthält keinerlei
// echten Lerninhalt. `questionsPerTopic` beschreibt ein Kapitel je Eintrag:
// jede Zahl ist die Fragenanzahl eines Themas, 0 erzeugt ein Cross-Reference-
// Topic (questions: []).
export function syntheticMasterBank({ chapters = [[2, 1], [1]], shortLearnAnswers = false, marker = 'SYN' } = {}) {
  let questionCounter = 0
  return {
    libraryId: `synthetic-${marker}`,
    chapters: chapters.map((questionsPerTopic, chapterIndex) => {
      const chapterId = `ch${String(chapterIndex + 1).padStart(2, '0')}`
      return {
        chapterId,
        chapterNumber: String(chapterIndex + 1),
        chapterTitle: `${marker} Kapitel ${chapterIndex + 1}`,
        topics: questionsPerTopic.map((questionCount, topicIndex) => {
          const topicId = `${chapterId}-t${String(topicIndex + 1).padStart(2, '0')}`
          return {
            topicId,
            topicNumber: `${chapterIndex + 1}.${topicIndex + 1}`,
            topicTitle: `${marker} Thema ${chapterIndex + 1}.${topicIndex + 1}`,
            chapterId,
            ...(questionCount === 0 ? { topicKind: 'crossReference' } : {}),
            learningPhase: { masterContent: `${marker}_MASTERTEXT_${topicId}` },
            questions: Array.from({ length: questionCount }, () => {
              questionCounter++
              const questionId = `q${String(questionCounter).padStart(3, '0')}`
              return {
                questionId,
                topicId,
                question: `${marker}_FRAGE_${questionId}?`,
                hint: null,
                coreConcepts: [{ conceptId: `c-${questionId}`, label: `${marker}_KERNPUNKT_${questionId}` }],
                optionalConcepts: [],
                shortModelAnswer: `${marker}_MUSTERANTWORT_${questionId}`,
                ...(shortLearnAnswers ? { shortLearnAnswer: `${marker}_KURZLERNANTWORT_${questionId}` } : {}),
                masterExcerpt: `${marker}_AUSZUG_${questionId}`,
                responseRequirements: { requiresAllCoreConcepts: true, minimumItems: 1, minimumExamples: null, minimumExamplesPerGroup: null },
                answerFlexibility: { wordingMatchRequired: false, equivalentOwnExamplesAllowed: false, caseBound: false },
              }
            }),
            visualAssets: [],
          }
        }),
      }
    }),
  }
}
