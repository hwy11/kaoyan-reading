import { useCallback, useEffect, useRef, useState } from 'react'
import { useHighlights } from '../context/HighlightContext'
import { fetchWordMeaning, formatTags, type DictResult } from '../lib/dictionary'
import type { Passage } from '../types'

interface PopupState {
  word: string
  result: DictResult | null
  loading: boolean
  x: number
  y: number
}

interface ClickableTextProps {
  text: string
  passage?: Passage
  className?: string
}

function tokenize(text: string): { type: 'word' | 'space'; value: string }[] {
  const tokens: { type: 'word' | 'space'; value: string }[] = []
  const regex = /([a-zA-Z]+(?:'[a-zA-Z]+)?)|(\s+)|([^a-zA-Z\s]+)/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(text)) !== null) {
    if (match[1]) tokens.push({ type: 'word', value: match[1] })
    else tokens.push({ type: 'space', value: match[0] })
  }
  return tokens
}

export function ClickableText({ text, passage, className }: ClickableTextProps) {
  const [popup, setPopup] = useState<PopupState | null>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const seqRef = useRef(0)
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { isHighlighted, toggle } = useHighlights()

  const lookupWord = useCallback(
    async (word: string, e: React.MouseEvent) => {
      e.stopPropagation()
      const rect = (e.target as HTMLElement).getBoundingClientRect()
      const seq = ++seqRef.current

      setPopup({
        word,
        result: null,
        loading: true,
        x: rect.left + rect.width / 2,
        y: rect.top,
      })

      const result = await fetchWordMeaning(word, passage)
      if (seq !== seqRef.current) return

      setPopup({
        word,
        result,
        loading: false,
        x: rect.left + rect.width / 2,
        y: rect.top,
      })
    },
    [passage],
  )

  // 单击查词；延迟触发以避免与双击标记冲突
  const handleClick = useCallback(
    (word: string, e: React.MouseEvent) => {
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current)
      clickTimerRef.current = setTimeout(() => {
        lookupWord(word, e)
      }, 220)
    },
    [lookupWord],
  )

  const handleDoubleClick = useCallback(
    (word: string, e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current)
        clickTimerRef.current = null
      }
      toggle(word)
    },
    [toggle],
  )

  useEffect(() => {
    return () => {
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current)
    }
  }, [])

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setPopup(null)
      }
    }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [])

  const tokens = tokenize(text)
  const tags = popup?.result ? formatTags(popup.result.tag) : ''

  return (
    <>
      <span className={className}>
        {tokens.map((token, i) =>
          token.type === 'word' ? (
            <span
              key={i}
              className={`word${isHighlighted(token.value) ? ' word-marked' : ''}`}
              onClick={(e) => handleClick(token.value, e)}
              onDoubleClick={(e) => handleDoubleClick(token.value, e)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter')
                  handleClick(token.value, e as unknown as React.MouseEvent)
              }}
            >
              {token.value}
            </span>
          ) : (
            <span key={i}>{token.value}</span>
          ),
        )}
      </span>

      {popup && (
        <div
          ref={popupRef}
          className="word-popup"
          style={{ left: popup.x, top: popup.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="word-popup-word">{popup.result?.word ?? popup.word}</div>

          {popup.loading ? (
            <div className="word-popup-loading">查询中…</div>
          ) : popup.result ? (
            <>
              {popup.result.phonetic && (
                <div className="word-popup-phonetic">/{popup.result.phonetic}/</div>
              )}
              <div className="word-popup-meaning">{popup.result.translation}</div>
              {tags && <div className="word-popup-tags">{tags}</div>}
            </>
          ) : (
            <div className="word-popup-meaning word-popup-empty">
              未找到释义（词典服务未启动？）
            </div>
          )}
        </div>
      )}
    </>
  )
}
