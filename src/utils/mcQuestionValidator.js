// Geteilte Validierung für MC-Fragen-JSON. Wird sowohl vom bestehenden
// Einzelimport (PrivateQuestionImporter.vue) als auch vom zentralen
// Lernbibliotheken-Loader (libraryImport.js) verwendet - eine Validierung,
// keine zweite parallele Implementierung.
export function validateMcQuestions(data) {
  if (!Array.isArray(data)) {
    throw new Error('Die JSON-Datei muss ein Array von Fragen enthalten.')
  }

  if (data.length === 0) {
    throw new Error('Die JSON-Datei enthält keine Fragen.')
  }

  data.forEach((question, index) => {
    if (!question.question || typeof question.question !== 'string') {
      throw new Error(`Frage ${index + 1}: "question" fehlt oder ist ungültig.`)
    }

    if (!Array.isArray(question.options) || question.options.length < 2) {
      throw new Error(`Frage ${index + 1}: "options" muss mindestens zwei Antworten enthalten.`)
    }

    if (!question.correctAnswer || typeof question.correctAnswer !== 'string') {
      throw new Error(`Frage ${index + 1}: "correctAnswer" fehlt oder ist ungültig.`)
    }

    if (!question.options.includes(question.correctAnswer)) {
      throw new Error(`Frage ${index + 1}: "correctAnswer" muss in "options" enthalten sein.`)
    }

    if (!question.explanation || typeof question.explanation !== 'string') {
      throw new Error(`Frage ${index + 1}: "explanation" fehlt oder ist ungültig.`)
    }

    if (question.category !== undefined && typeof question.category !== 'string') {
      throw new Error(`Frage ${index + 1}: "category" muss ein Text sein.`)
    }

    if (question.difficulty !== undefined && typeof question.difficulty !== 'string') {
      throw new Error(`Frage ${index + 1}: "difficulty" muss ein Text sein.`)
    }
  })

  return data.map((question, index) => ({
    id: question.id ?? index + 1,
    category: question.category || 'Eigene Fragen',
    difficulty: question.difficulty || 'custom',
    question: question.question,
    options: question.options,
    correctAnswer: question.correctAnswer,
    explanation: question.explanation,
    soMerkstDuDirDas: question.soMerkstDuDirDas ?? null,
  }))
}

// Inhaltsbasierte Erkennung (keine Dateinamenlogik): MC-Fragen haben stets
// "options" (Array) und "correctAnswer" (Text). Trainingseinheiten verwenden
// dafür "choices"/"correctAnswer" (Quiz-Stil) oder gar kein "correctAnswer" -
// beide Schemata verwenden nie ein Feld "options", daher keine Kollision.
export function looksLikeMcQuestions(data) {
  return Array.isArray(data)
    && data.length > 0
    && data.every((entry) => entry && typeof entry === 'object' && Array.isArray(entry.options) && typeof entry.correctAnswer === 'string')
}
