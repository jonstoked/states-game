import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Home } from './routes/Home'
import { StateChallenge } from './routes/StateChallenge'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/:stateSlug" element={<StateChallenge />} />
      </Routes>
    </BrowserRouter>
  )
}
