import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { loadHighlights, normalizeHighlightWord, toggleHighlight } from '../lib/highlights'

interface HighlightContextValue {
  isHighlighted: (word: string) => boolean
  toggle: (word: string) => void
}

const HighlightContext = createContext<HighlightContextValue | null>(null)

export function HighlightProvider({
  passageId,
  children,
}: {
  passageId: string
  children: ReactNode
}) {
  const [words, setWords] = useState(() => loadHighlights(passageId))

  const toggle = useCallback(
    (word: string) => {
      setWords(toggleHighlight(passageId, word))
    },
    [passageId],
  )

  const value = useMemo(
    () => ({
      isHighlighted: (word: string) => words.has(normalizeHighlightWord(word)),
      toggle,
    }),
    [words, toggle],
  )

  return (
    <HighlightContext.Provider value={value}>{children}</HighlightContext.Provider>
  )
}

export function useHighlights() {
  const ctx = useContext(HighlightContext)
  if (!ctx) {
    return {
      isHighlighted: () => false,
      toggle: () => {},
    }
  }
  return ctx
}
