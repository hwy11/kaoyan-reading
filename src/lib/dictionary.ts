import { lookupWord as lookupManual } from '../data'
import type { Passage } from '../types'

export interface DictResult {
  word: string
  phonetic?: string
  translation: string
  definition?: string
  tag?: string
  source: 'manual' | 'ecdict' | 'api' | 'cache'
}

const memoryCache = new Map<string, DictResult>()
const CACHE_KEY = 'kaoyan-dict-cache-v1'
const MAX_CACHE = 2000

function loadStorageCache(): Record<string, DictResult> {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveToStorage(word: string, result: DictResult) {
  try {
    const cache = loadStorageCache()
    cache[word] = result
    const keys = Object.keys(cache)
    if (keys.length > MAX_CACHE) {
      for (const k of keys.slice(0, keys.length - MAX_CACHE)) delete cache[k]
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch {
    // localStorage 满了就忽略
  }
}

function normalize(word: string) {
  return word.toLowerCase().replace(/[^a-z'-]/g, '')
}

/** 先查手动词库，再查本地缓存，最后请求 ECDICT 服务 */
export async function fetchWordMeaning(
  word: string,
  passage?: Passage,
): Promise<DictResult | null> {
  const key = normalize(word)
  if (!key) return null

  const manual = lookupManual(word, passage)
  if (manual) {
    return { word: key, translation: manual, source: 'manual' }
  }

  if (memoryCache.has(key)) return memoryCache.get(key)!

  const stored = loadStorageCache()[key]
  if (stored) {
    memoryCache.set(key, { ...stored, source: 'cache' })
    return memoryCache.get(key)!
  }

  try {
    const res = await fetch(`/api/dict?word=${encodeURIComponent(key)}`)
    if (!res.ok) return null
    const data = await res.json()
    const result: DictResult = {
      word: data.word || key,
      phonetic: data.phonetic,
      translation: data.translation,
      definition: data.definition,
      tag: data.tag,
      source: (data.tag ? 'ecdict' : 'api') as DictResult['source'],
    }
    memoryCache.set(key, result)
    saveToStorage(key, result)
    return result
  } catch {
    return null
  }
}

/** 格式化考试标签，如 gk cet4 → 高考 四级 */
export function formatTags(tag?: string): string {
  if (!tag) return ''
  const map: Record<string, string> = {
    zk: '中考',
    gk: '高考',
    cet4: '四级',
    cet6: '六级',
    ky: '考研',
    toefl: '托福',
    ielts: '雅思',
    gre: 'GRE',
  }
  return tag
    .split(/\s+/)
    .map((t) => map[t] || t)
    .filter(Boolean)
    .join(' · ')
}
