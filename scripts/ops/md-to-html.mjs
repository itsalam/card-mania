// Minimal Markdown -> Basecamp rich text. Basecamp's editor (Trix) only renders a small tag set:
// <div> <h1> <strong> <em> <a> <ul>/<ol>/<li> <blockquote> <pre> <br>, so every heading
// level maps to <h1> and inline code renders as plain text.

const escapeHtml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function inline(text) {
  return escapeHtml(text)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^\w*])[*_]([^*_]+)[*_](?=[^\w*]|$)/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '$1')
}

export function mdToHtml(markdown) {
  const out = []
  // Stack of open lists: { type: 'ul' | 'ol', indent }
  const lists = []
  let paragraph = []

  const flushParagraph = () => {
    if (paragraph.length) out.push(`<div>${paragraph.map(inline).join('<br>')}</div>`)
    paragraph = []
  }
  const closeListsTo = (indent) => {
    while (lists.length && lists.at(-1).indent > indent) out.push(`</li></${lists.pop().type}>`)
  }
  const closeAllLists = () => closeListsTo(-1)

  for (const raw of markdown.replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.replace(/\s+$/, '')
    const item = line.match(/^(\s*)([-*]|\d+\.)\s+(.*)$/)

    if (item) {
      flushParagraph()
      const indent = item[1].length
      const type = /\d/.test(item[2]) ? 'ol' : 'ul'
      closeListsTo(indent)
      const top = lists.at(-1)
      if (!top || indent > top.indent) {
        out.push(`<${type}><li>`)
        lists.push({ type, indent })
      } else {
        out.push('</li><li>')
      }
      out.push(inline(item[3]))
      continue
    }

    if (!line.trim()) {
      flushParagraph()
      continue
    }

    closeAllLists()
    const heading = line.match(/^#{1,6}\s+(.*)$/)
    if (heading) {
      flushParagraph()
      out.push(`<h1>${inline(heading[1])}</h1>`)
    } else if (line.startsWith('>')) {
      flushParagraph()
      out.push(`<blockquote>${inline(line.replace(/^>\s?/, ''))}</blockquote>`)
    } else if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
      flushParagraph()
      out.push('<hr>')
    } else {
      paragraph.push(line.trim())
    }
  }
  flushParagraph()
  closeAllLists()
  return out.join('')
}
