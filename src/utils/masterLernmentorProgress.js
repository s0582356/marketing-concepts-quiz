// Reine Positionsberechnung für die Fortschrittsanzeige im Master-Lernmentor.
// "Frage X von Y" allein ist missverständlich (meint nur das aktuelle Thema) -
// diese Funktion liefert zusätzlich die Position im Kapitel. Gezählt werden
// ausschließlich echte Fragen: ein Cross-Reference-Topic (questions: [])
// trägt 0 zur Kapitelzählung bei, es entsteht nie eine Phantomfrage.
//
// Gibt null zurück, wenn Topic oder Frage in der Bank nicht existieren (z. B.
// Cross-Reference-Topic ohne Frage) - nie eine "Frage 1 von 0"-Anzeige.
export function masterQuestionPosition(bank, topicId, questionIndex) {
  if (!bank || !Array.isArray(bank.chapters)) return null
  for (const chapter of bank.chapters) {
    const topicIndex = chapter.topics.findIndex((topic) => topic.topicId === topicId)
    if (topicIndex < 0) continue

    const topic = chapter.topics[topicIndex]
    if (!Number.isInteger(questionIndex) || questionIndex < 0 || questionIndex >= topic.questions.length) return null

    const questionsBefore = chapter.topics.slice(0, topicIndex).reduce((sum, earlier) => sum + earlier.questions.length, 0)
    return {
      topicQuestionNumber: questionIndex + 1,
      topicQuestionTotal: topic.questions.length,
      chapterQuestionNumber: questionsBefore + questionIndex + 1,
      chapterQuestionTotal: chapter.topics.reduce((sum, entry) => sum + entry.questions.length, 0),
      chapterTopicNumber: topicIndex + 1,
      chapterTopicTotal: chapter.topics.length,
    }
  }
  return null
}
