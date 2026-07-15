import { Link } from 'react-router-dom'
import { yearGroups } from '../data'

export function Home() {
  return (
    <div className="home">
      <header className="page-header">
        <h1>考研英语阅读</h1>
        <p className="page-desc">左英右中对照，点击单词查释义，中文可隐藏</p>
      </header>

      {yearGroups.map((group) => (
        <section key={group.year} className="year-section">
          <h2 className="year-label">{group.year}</h2>

          {group.exams.map((exam) => (
            <div key={exam.type} className="exam-block">
              <h3 className="exam-label">{exam.label}</h3>
              <ul className="passage-list">
                {exam.passages.map((p) => (
                  <li key={p.id}>
                    <Link to={`/read/${p.id}`} className="passage-link">
                      <span className="passage-num">{p.title}</span>
                      {p.subtitle && (
                        <span className="passage-sub">{p.subtitle}</span>
                      )}
                      <span className="passage-meta">
                        {p.paragraphs.length} 段 · {p.questions.length} 题
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ))}
    </div>
  )
}
