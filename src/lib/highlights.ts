/** 按篇章持久化用户标记的生词（双击切换） */
const PREFIX = 'kaoyan-highlight-'

function normalize(word: string) {
  return word.toLowerCase().replace(/[^a-z'-]/g, '')
}

export function loadHighlights(passageId: string): Set<string> {
  try {
    const raw = localStorage.getItem(PREFIX + passageId)
    return new Set(raw ? JSON.parse(raw) : [])
  } catch {
    return new Set()
  }
}

export function saveHighlights(passageId: string, words: Set<string>) {
  try {
    localStorage.setItem(PREFIX + passageId, JSON.stringify([...words]))
  } catch {
    // ignore quota errors
  }
}

export function toggleHighlight(passageId: string, word: string): Set<string> {
  const key = normalize(word)
  if (!key) return loadHighlights(passageId)

  const next = loadHighlights(passageId)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  saveHighlights(passageId, next)
  return next
}

export { normalize as normalizeHighlightWord }
