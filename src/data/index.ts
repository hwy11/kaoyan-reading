import type { Passage, YearGroup } from '../types'

// 每年一份 JSON，新增年份只需运行 npm run import:years
const yearJsonModules = import.meta.glob('./years/*/english-2.json', {
  eager: true,
  import: 'default',
}) as Record<string, YearGroup>

export const yearGroups: YearGroup[] = Object.values(yearJsonModules).sort(
  (a, b) => b.year - a.year,
)

export function getAllPassages(): Passage[] {
  return yearGroups.flatMap((g) => g.exams.flatMap((e) => e.passages))
}

export function getPassageById(id: string): Passage | undefined {
  return getAllPassages().find((p) => p.id === id)
}

export function getYears(): number[] {
  return yearGroups.map((g) => g.year).sort((a, b) => b - a)
}

// 手动词库优先；自动查词走 ECDICT（见 src/lib/dictionary.ts）
export function lookupWord(word: string, passage?: Passage): string | null {
  const normalized = word.toLowerCase().replace(/[^a-z'-]/g, '')
  if (!normalized) return null

  if (passage?.vocabulary[normalized]) return passage.vocabulary[normalized]
  if (passage?.vocabulary[word]) return passage.vocabulary[word]

  const stems = [
    normalized,
    normalized.replace(/ies$/, 'y'),
    normalized.replace(/es$/, ''),
    normalized.replace(/s$/, ''),
    normalized.replace(/ed$/, ''),
    normalized.replace(/ing$/, ''),
    normalized.replace(/ly$/, ''),
  ]

  const vocab = passage?.vocabulary ?? {}
  for (const stem of stems) {
    if (vocab[stem]) return vocab[stem]
  }

  return null
}
