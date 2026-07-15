import { Routes, Route, Navigate, useParams } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Home } from './components/Home'
import { PassageReader } from './components/PassageReader'
import { getPassageById } from './data'

function PassageRoute() {
  const { id } = useParams<{ id: string }>()
  const passage = id ? getPassageById(id) : undefined
  if (!passage) return <div className="not-found">未找到该阅读</div>
  return <PassageReader passage={passage} />
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/read/:id" element={<PassageRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
