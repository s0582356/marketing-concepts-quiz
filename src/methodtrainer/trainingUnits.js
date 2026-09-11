// Generisches Datenschema für private Methodentrainer-Inhalte.
// Ein Schema, eine Validierung, sechs Methoden (verteilt auf 5 Kernmethoden):
// duel, misconception, case (gemeinsame "Quiz-Hülle"), assignment (Zuordnung),
// matrix und process (beide "Matrix-/Prozess-Trainer").
//
// Öffentliche Demo-Daten (src/data/public/sampleTrainingUnits.json) nutzen exakt
// dasselbe Schema, dürfen aber niemals sourceReference oder professorbezogene
// Inhalte enthalten.

export const QUIZ_STYLE_METHODS = ['duel', 'misconception', 'case']
export const TRAINING_METHODS = [...QUIZ_STYLE_METHODS, 'assignment', 'matrix', 'process']
export const TRAINING_MODES = ['learn', 'apply', 'exam']

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== ''
}

function isOptionalString(value) {
  return value === undefined || value === null || typeof value === 'string'
}

function fail(label, message) {
  throw new Error(`${label}: ${message}`)
}

function validateCommonFields(unit, label) {
  let modeSupport = TRAINING_MODES
  if (unit.modeSupport !== undefined) {
    if (
      !Array.isArray(unit.modeSupport)
      || unit.modeSupport.length === 0
      || !unit.modeSupport.every((m) => TRAINING_MODES.includes(m))
    ) {
      fail(label, `"modeSupport" muss eine Teilmenge von ${TRAINING_MODES.join(', ')} sein.`)
    }
    modeSupport = unit.modeSupport
  }

  let compassPath = null
  if (unit.compassPath !== undefined && unit.compassPath !== null) {
    if (!Array.isArray(unit.compassPath) || !unit.compassPath.every(isNonEmptyString)) {
      fail(label, '"compassPath" muss ein Array von Texten sein.')
    }
    compassPath = unit.compassPath
  }

  const optionalStringFields = ['concept', 'explanation', 'guidedExample', 'feedback', 'misconception', 'distractorExplanation', 'reasoning', 'sourceReference']
  optionalStringFields.forEach((field) => {
    if (!isOptionalString(unit[field])) fail(label, `"${field}" muss ein Text sein.`)
  })

  let mcQuestionReference = null
  if (unit.mcQuestionReference !== undefined && unit.mcQuestionReference !== null) {
    const ref = unit.mcQuestionReference
    if (typeof ref !== 'object' || Array.isArray(ref)) fail(label, '"mcQuestionReference" muss ein Objekt sein.')
    if (!isOptionalString(ref.category) || !isOptionalString(ref.question)) {
      fail(label, '"mcQuestionReference" darf nur Textfelder enthalten.')
    }
    mcQuestionReference = { category: ref.category ?? null, question: ref.question ?? null }
  }

  return {
    modeSupport,
    compassPath,
    concept: unit.concept ?? null,
    explanation: unit.explanation ?? null,
    guidedExample: unit.guidedExample ?? null,
    feedback: unit.feedback ?? null,
    misconception: unit.misconception ?? null,
    distractorExplanation: unit.distractorExplanation ?? null,
    reasoning: unit.reasoning ?? null,
    sourceReference: unit.sourceReference ?? null,
    mcQuestionReference,
  }
}

// duel / misconception / case teilen sich Form und Trainingshülle (TrainingUnitCard.vue).
function validateQuizStyleUnit(unit, label) {
  if (!isNonEmptyString(unit.prompt)) fail(label, '"prompt" fehlt oder ist ungültig.')

  if (!Array.isArray(unit.choices) || unit.choices.length < 2 || !unit.choices.every(isNonEmptyString)) {
    fail(label, '"choices" muss mindestens zwei Texte enthalten.')
  }

  if (!isNonEmptyString(unit.correctAnswer) || !unit.choices.includes(unit.correctAnswer)) {
    fail(label, '"correctAnswer" muss in "choices" enthalten sein.')
  }

  if (!isOptionalString(unit.decisiveClue)) fail(label, '"decisiveClue" muss ein Text sein.')

  return {
    prompt: unit.prompt,
    choices: unit.choices,
    correctAnswer: unit.correctAnswer,
    decisiveClue: unit.decisiveClue ?? null,
  }
}

function validateAssignmentUnit(unit, label) {
  if (!isNonEmptyString(unit.prompt)) fail(label, '"prompt" fehlt oder ist ungültig.')

  if (!Array.isArray(unit.items) || unit.items.length < 2) fail(label, '"items" muss mindestens zwei Elemente enthalten.')
  if (!Array.isArray(unit.targets) || unit.targets.length < 2) fail(label, '"targets" muss mindestens zwei Kategorien enthalten.')

  unit.items.forEach((item, index) => {
    if (!item || !isNonEmptyString(item.id) || !isNonEmptyString(item.label)) {
      fail(label, `"items[${index}]" braucht "id" und "label" als Text.`)
    }
  })
  unit.targets.forEach((target, index) => {
    if (!target || !isNonEmptyString(target.id) || !isNonEmptyString(target.label)) {
      fail(label, `"targets[${index}]" braucht "id" und "label" als Text.`)
    }
  })

  const itemIds = unit.items.map((item) => item.id)
  const targetIds = unit.targets.map((target) => target.id)
  if (new Set(itemIds).size !== itemIds.length) fail(label, '"items" enthält doppelte IDs.')
  if (new Set(targetIds).size !== targetIds.length) fail(label, '"targets" enthält doppelte IDs.')

  if (!unit.assignments || typeof unit.assignments !== 'object' || Array.isArray(unit.assignments)) {
    fail(label, '"assignments" muss ein Objekt sein, das jedes Item einer Zielkategorie zuordnet.')
  }
  const assignmentKeys = Object.keys(unit.assignments)
  if (assignmentKeys.length !== itemIds.length || !itemIds.every((id) => assignmentKeys.includes(id))) {
    fail(label, '"assignments" muss für jedes Item aus "items" genau einen Eintrag enthalten.')
  }
  itemIds.forEach((id) => {
    if (!targetIds.includes(unit.assignments[id])) fail(label, `"assignments.${id}" muss auf eine gültige Zielkategorie zeigen.`)
  })

  let itemFeedback = null
  if (unit.itemFeedback !== undefined && unit.itemFeedback !== null) {
    if (typeof unit.itemFeedback !== 'object' || Array.isArray(unit.itemFeedback)) fail(label, '"itemFeedback" muss ein Objekt sein.')
    itemFeedback = {}
    Object.entries(unit.itemFeedback).forEach(([itemId, entry]) => {
      if (!itemIds.includes(itemId)) fail(label, `"itemFeedback" verweist auf unbekanntes Item "${itemId}".`)
      if (!entry || typeof entry !== 'object') fail(label, `"itemFeedback.${itemId}" muss ein Objekt sein.`)
      const { decisiveClue, misconception, distractorExplanation } = entry
      if (!isOptionalString(decisiveClue) || !isOptionalString(misconception) || !isOptionalString(distractorExplanation)) {
        fail(label, `"itemFeedback.${itemId}" darf nur Textfelder enthalten.`)
      }
      itemFeedback[itemId] = {
        decisiveClue: decisiveClue ?? null,
        misconception: misconception ?? null,
        distractorExplanation: distractorExplanation ?? null,
      }
    })
  }

  return {
    prompt: unit.prompt,
    items: unit.items.map((item) => ({ id: item.id, label: item.label })),
    targets: unit.targets.map((target) => ({ id: target.id, label: target.label })),
    assignments: { ...unit.assignments },
    itemFeedback,
  }
}

function validateMatrixUnit(unit, label) {
  if (!isNonEmptyString(unit.prompt)) fail(label, '"prompt" fehlt oder ist ungültig.')
  if (!Array.isArray(unit.rowLabels) || unit.rowLabels.length < 2 || !unit.rowLabels.every(isNonEmptyString)) {
    fail(label, '"rowLabels" muss mindestens zwei Texte enthalten.')
  }
  if (!Array.isArray(unit.columnLabels) || unit.columnLabels.length < 2 || !unit.columnLabels.every(isNonEmptyString)) {
    fail(label, '"columnLabels" muss mindestens zwei Texte enthalten.')
  }
  if (
    !unit.correctCell
    || typeof unit.correctCell !== 'object'
    || !unit.rowLabels.includes(unit.correctCell.row)
    || !unit.columnLabels.includes(unit.correctCell.column)
  ) {
    fail(label, '"correctCell" muss { row, column } mit gültigen Werten aus rowLabels/columnLabels sein.')
  }

  return {
    prompt: unit.prompt,
    rowLabels: unit.rowLabels,
    columnLabels: unit.columnLabels,
    correctCell: { row: unit.correctCell.row, column: unit.correctCell.column },
  }
}

function validateProcessUnit(unit, label) {
  if (!isNonEmptyString(unit.prompt)) fail(label, '"prompt" fehlt oder ist ungültig.')
  if (!Array.isArray(unit.steps) || unit.steps.length < 2) fail(label, '"steps" muss mindestens zwei Schritte enthalten.')
  unit.steps.forEach((step, index) => {
    if (!step || !isNonEmptyString(step.id) || !isNonEmptyString(step.label)) {
      fail(label, `"steps[${index}]" braucht "id" und "label" als Text.`)
    }
  })
  const stepIds = unit.steps.map((step) => step.id)
  if (new Set(stepIds).size !== stepIds.length) fail(label, '"steps" enthält doppelte IDs.')

  if (
    !Array.isArray(unit.correctOrder)
    || unit.correctOrder.length !== stepIds.length
    || new Set(unit.correctOrder).size !== stepIds.length
    || !unit.correctOrder.every((id) => stepIds.includes(id))
  ) {
    fail(label, '"correctOrder" muss genau eine Permutation der Schritt-IDs aus "steps" sein.')
  }

  let stepFeedback = null
  if (unit.stepFeedback !== undefined && unit.stepFeedback !== null) {
    if (typeof unit.stepFeedback !== 'object' || Array.isArray(unit.stepFeedback)) fail(label, '"stepFeedback" muss ein Objekt sein.')
    stepFeedback = {}
    Object.entries(unit.stepFeedback).forEach(([stepId, text]) => {
      if (!stepIds.includes(stepId)) fail(label, `"stepFeedback" verweist auf unbekannten Schritt "${stepId}".`)
      if (!isNonEmptyString(text)) fail(label, `"stepFeedback.${stepId}" muss ein Text sein.`)
      stepFeedback[stepId] = text
    })
  }

  return {
    prompt: unit.prompt,
    steps: unit.steps.map((step) => ({ id: step.id, label: step.label })),
    correctOrder: unit.correctOrder,
    stepFeedback,
  }
}

/**
 * Validiert und normalisiert ein Array von Trainingseinheiten.
 * Wirft bei jedem ungültigen Datensatz einen Fehler (kein stilles Akzeptieren,
 * keine Teilübernahme) - analog zum Verhalten des bestehenden MC-Fragen-Imports.
 */
export function validateTrainingUnits(data) {
  if (!Array.isArray(data)) throw new Error('Die JSON-Datei muss ein Array von Trainingseinheiten enthalten.')
  if (data.length === 0) throw new Error('Die JSON-Datei enthält keine Trainingseinheiten.')

  return data.map((unit, index) => {
    const label = `Einheit ${index + 1}`

    if (!unit || typeof unit !== 'object' || Array.isArray(unit)) fail(label, 'ungültiger Datensatz.')
    if (!TRAINING_METHODS.includes(unit.method)) fail(label, `"method" muss eine von ${TRAINING_METHODS.join(', ')} sein.`)

    const common = validateCommonFields(unit, label)

    let methodFields
    if (QUIZ_STYLE_METHODS.includes(unit.method)) methodFields = validateQuizStyleUnit(unit, label)
    else if (unit.method === 'assignment') methodFields = validateAssignmentUnit(unit, label)
    else if (unit.method === 'matrix') methodFields = validateMatrixUnit(unit, label)
    else methodFields = validateProcessUnit(unit, label)

    return {
      id: unit.id ?? index + 1,
      method: unit.method,
      ...common,
      ...methodFields,
    }
  })
}

export function unitsForMethod(units, method, mode) {
  return units.filter((unit) => unit.method === method && unit.modeSupport.includes(mode))
}

export function unitsForMethods(units, methods, mode) {
  return units.filter((unit) => methods.includes(unit.method) && unit.modeSupport.includes(mode))
}

/**
 * Sucht in einer aktuell geladenen MC-Fragenbank (bestehendes Quiz-Schema:
 * question/options/correctAnswer/explanation/category) eine zur mcQuestionReference
 * passende Frage. Liefert null statt zu werfen, wenn nichts passt - der MC-Abschluss
 * bleibt dadurch optional und die App stürzt nie ab.
 */
export function resolveMcQuestion(mcQuestions, reference) {
  if (!reference || !Array.isArray(mcQuestions) || mcQuestions.length === 0) return null

  const category = isNonEmptyString(reference.category) ? reference.category.trim().toLowerCase() : null
  const questionText = isNonEmptyString(reference.question) ? reference.question.trim().toLowerCase() : null
  if (!category && !questionText) return null

  const candidates = category
    ? mcQuestions.filter((q) => (q.category || '').trim().toLowerCase() === category)
    : mcQuestions

  if (questionText) {
    const exact = candidates.find((q) => (q.question || '').trim().toLowerCase() === questionText)
    if (exact) return exact
    const partial = candidates.find((q) => (q.question || '').toLowerCase().includes(questionText))
    if (partial) return partial
    if (!category) return null
  }

  return candidates[0] ?? null
}
