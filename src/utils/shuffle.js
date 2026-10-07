// Gemeinsamer Fisher-Yates-Shuffle für Antwortoptionen (Quiz, Mixed Transfer
// Exam, MC-Abschlussfrage im Methodentrainer). Liefert eine Permutation der
// ORIGINAL-Indizes - die Aufrufer halten diese Reihenfolge einmalig pro
// Frage/Durchlauf im State und werten Antworten weiterhin über den
// Antworttext bzw. den Original-Index aus, nie über die angezeigte Position.
// `random` ist nur für deterministische Tests injizierbar.
export function shuffledIndices(length, random = Math.random) {
  const order = Array.from({ length }, (_, index) => index)
  for (let index = order.length - 1; index > 0; index--) {
    const randomIndex = Math.floor(random() * (index + 1))
    const value = order[index]
    order[index] = order[randomIndex]
    order[randomIndex] = value
  }
  return order
}
