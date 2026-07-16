import { Outlet, Link, useLocation } from 'react-router-dom'

export function Layout() {
  const location = useLocation()
  const isHome = location.pathname === '/'

  return (
    <div className="app">
      <header className="app-header">
        <Link to="/" className="brand">
          考研阅读
        </Link>
        {!isHome && (
          <span className="app-header-hint">单击查词 · 双击标记</span>
        )}
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}
