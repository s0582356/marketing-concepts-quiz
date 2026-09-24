// Sicheres, rein lokales Parsing des Markdown-artigen Master-Lernmentor-Texts
// (learningPhase.masterContent / question.masterExcerpt) in strukturierte
// Blöcke. Bewusst KEIN v-html/HTML-String-Rendering - der Renderer
// (MasterContentRenderer.vue) bildet jeden Blocktyp auf ein festes Set
// Vue-Elemente ab. Verändert den Text selbst nie (kein "Reparieren" von
// Content), nur die Darstellung.

const HEADING_RE = /^(#{1,6})\s+(.*)$/
const VISUAL_ASSET_RE = /^\[ABBILDUNG:(.*)\]\s*$/
const LIST_ITEM_RE = /^[-*]\s+(.*)$/
const TABLE_SEPARATOR_RE = /^:?-+:?(\s*\|\s*:?-+:?)*$/

function isBlockStart(line) {
  const trimmed = line.trim()
  return (
    HEADING_RE.test(line)
    || VISUAL_ASSET_RE.test(line)
    || trimmed.startsWith('|')
    || trimmed.startsWith('>')
    || LIST_ITEM_RE.test(trimmed)
  )
}

function splitTableRow(row) {
  return row.replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim())
}

function parseTableBlock(tableLines) {
  const header = splitTableRow(tableLines[0])
  let bodyLines = tableLines.slice(1)
  if (bodyLines.length > 0 && TABLE_SEPARATOR_RE.test(splitTableRow(bodyLines[0]).join('|').trim())) {
    bodyLines = bodyLines.slice(1)
  }
  return { type: 'table', header, rows: bodyLines.map(splitTableRow) }
}

// Zerlegt masterContent/masterExcerpt in eine Liste typisierter Blöcke:
// heading, paragraph, list, table, blockquote, visualAsset.
export function parseMasterContent(markdown) {
  const lines = (markdown || '').split('\n')
  const blocks = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    if (line.trim() === '') {
      i++
      continue
    }

    const headingMatch = line.match(HEADING_RE)
    if (headingMatch) {
      blocks.push({ type: 'heading', level: headingMatch[1].length, text: headingMatch[2].trim() })
      i++
      continue
    }

    const visualMatch = line.match(VISUAL_ASSET_RE)
    if (visualMatch) {
      blocks.push({ type: 'visualAsset', label: visualMatch[1].trim() })
      i++
      continue
    }

    if (line.trim().startsWith('|')) {
      const tableLines = []
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i].trim())
        i++
      }
      blocks.push(parseTableBlock(tableLines))
      continue
    }

    if (line.trim().startsWith('>')) {
      const quoteLines = []
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''))
        i++
      }
      blocks.push({ type: 'blockquote', lines: quoteLines })
      continue
    }

    if (LIST_ITEM_RE.test(line.trim())) {
      const items = []
      let current = null
      while (i < lines.length) {
        const raw = lines[i]
        if (raw.trim() === '') break
        const itemMatch = raw.trim().match(LIST_ITEM_RE)
        if (itemMatch) {
          if (current !== null) items.push(current)
          current = itemMatch[1]
          i++
        } else if (/^\s+\S/.test(raw) && current !== null) {
          current += ` ${raw.trim()}`
          i++
        } else {
          break
        }
      }
      if (current !== null) items.push(current)
      blocks.push({ type: 'list', items })
      continue
    }

    const paragraphLines = []
    while (i < lines.length && lines[i].trim() !== '' && !isBlockStart(lines[i])) {
      paragraphLines.push(lines[i].trim())
      i++
    }
    if (paragraphLines.length > 0) {
      blocks.push({ type: 'paragraph', text: paragraphLines.join(' ') })
    }
  }

  return blocks
}

// Zerlegt einen Textabschnitt in Inline-Segmente (bold/italic/text) - für
// Überschriften, Absätze, Listeneinträge, Tabellenzellen und Blockquote-Zeilen
// gleichermaßen verwendet.
export function parseInline(text) {
  return (text || '')
    .split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
    .filter((part) => part !== '')
    .map((part) => {
      if (part.startsWith('**') && part.endsWith('**')) return { type: 'bold', text: part.slice(2, -2) }
      if (part.startsWith('*') && part.endsWith('*')) return { type: 'italic', text: part.slice(1, -1) }
      return { type: 'text', text: part }
    })
}
