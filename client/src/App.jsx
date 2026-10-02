import { useEffect, useState } from 'react'
import Scene from './Scene.jsx'

async function api(path, body, token) {
  const res = await fetch('/api/' + path, {
    method: body ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Có lỗi xảy ra')
  return data
}

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token'))
  const [user, setUser] = useState(null)
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!token) return setUser(null)
    api('me', null, token)
      .then((d) => setUser(d.username))
      .catch(() => logout())
  }, [token])

  function logout() {
    localStorage.removeItem('token')
    setToken(null)
  }

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const d = await api(mode, form)
      localStorage.setItem('token', d.token)
      setToken(d.token)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (token && user)
    return (
      <>
        <Scene />
        <div className="bar">
          <span>Xin chào, {user}. Kéo chuột để xoay, cuộn để phóng to.</span>
          <button className="out" onClick={logout}>Đăng xuất</button>
        </div>
      </>
    )

  if (token) return <div className="center">Đang tải...</div>

  const isLogin = mode === 'login'
  return (
    <div className="center">
      <form className="card" onSubmit={submit}>
        <h1>{isLogin ? 'Đăng nhập' : 'Tạo tài khoản'}</h1>
        <p className="sub">Đăng nhập để vào phòng 3D.</p>
        <label htmlFor="u">Tên đăng nhập</label>
        <input id="u" value={form.username} autoComplete="username" required
          onChange={(e) => setForm({ ...form, username: e.target.value })} />
        <label htmlFor="p">Mật khẩu</label>
        <input id="p" type="password" value={form.password} minLength={6} required
          autoComplete={isLogin ? 'current-password' : 'new-password'}
          onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <div className="err" role="alert">{error}</div>
        <button className="primary" disabled={busy}>
          {isLogin ? 'Đăng nhập' : 'Tạo tài khoản'}
        </button>
        <div className="switch">
          {isLogin ? 'Chưa có tài khoản? ' : 'Đã có tài khoản? '}
          <button type="button" className="link"
            onClick={() => { setMode(isLogin ? 'register' : 'login'); setError('') }}>
            {isLogin ? 'Đăng ký' : 'Đăng nhập'}
          </button>
        </div>
      </form>
    </div>
  )
}
