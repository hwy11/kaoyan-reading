import { useState } from 'react'
import { Link } from 'react-router-dom'
import { HighlightProvider } from '../context/HighlightContext'
import type { Passage } from '../types'
import { ClickableText } from './ClickableText'

interface PassageReaderProps {
  passage: Passage
}

export function PassageReader({ passage }: PassageReaderProps) {
  const [showChinese, setShowChinese] = useState(true)

  return (
    <HighlightProvider passageId={passage.id}>
    <article className="reader">
      <nav className="reader-nav">
        <Link to="/" className="back-link">
          ← 返回
        </Link>
        <div className="reader-nav-right">
          <span className="reader-year">{passage.year} 英语二</span>
          <button
            type="button"
            className={`toggle-zh ${showChinese ? 'active' : ''}`}
            onClick={() => setShowChinese((v) => !v)}
            aria-pressed={showChinese}
          >
            {showChinese ? '隐藏中文' : '显示中文'}
          </button>
        </div>
      </nav>

      <header className="reader-header">
        <h1>{passage.title}</h1>
        {passage.subtitle && <p className="reader-subtitle">{passage.subtitle}</p>}
        {passage.source && <p className="reader-source">出处：{passage.source}</p>}
      </header>

      <section className="passage-body">
        {passage.paragraphs.map((para, idx) => (
          <div
            key={idx}
            className={`para-row ${showChinese ? 'with-zh' : 'en-only'}`}
          >
            <div className="para-en">
              <span className="para-num">{idx + 1}</span>
              <ClickableText text={para.en} passage={passage} />
            </div>
            {showChinese && (
              <div className="para-zh">
                <p>{para.zh || '（暂无译文）'}</p>
              </div>
            )}
          </div>
        ))}
      </section>

      <section className="questions-section">
        <h2>题目</h2>
        <p className="questions-hint">单击查词，双击标记生词；选项中的单词同样适用</p>
        {passage.questions.map((q) => (
          <div key={q.number} className="question-block">
            <p className="question-text">
              <span className="q-num">{q.number}.</span>
              <ClickableText text={q.text} passage={passage} />
            </p>
            <ul className="options-list">
              {q.options.map((opt, i) => (
                <li key={i}>
                  <span className="opt-label">
                    {String.fromCharCode(65 + i)}.
                  </span>
                  <ClickableText text={opt} passage={passage} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </article>
    </HighlightProvider>
  )
}
