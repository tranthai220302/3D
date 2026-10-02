require('dotenv').config()
const express = require('express')
const path = require('path')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { Pool } = require('pg')

const { DATABASE_URL, JWT_SECRET, PORT = 3000 } = process.env
if (!DATABASE_URL || !JWT_SECRET) {
  console.error('Thiếu DATABASE_URL hoặc JWT_SECRET trong server/.env')
  process.exit(1)
}

const pool = new Pool({ connectionString: DATABASE_URL })
const app = express()
app.use(express.json())

const sign = (u) =>
  jwt.sign({ id: u.id, username: u.username }, JWT_SECRET, { expiresIn: '7d' })

function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '')
  try {
    req.user = jwt.verify(token, JWT_SECRET)
    next()
  } catch {
    res.status(401).json({ error: 'Chưa đăng nhập' })
  }
}

app.post('/api/register', async (req, res) => {
  const { username, password } = req.body || {}
  if (!username || !password || password.length < 6)
    return res.status(400).json({ error: 'Cần tên đăng nhập và mật khẩu từ 6 ký tự' })
  try {
    const hash = await bcrypt.hash(password, 10)
    const r = await pool.query(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username',
      [username.trim(), hash]
    )
    res.json({ token: sign(r.rows[0]), username: r.rows[0].username })
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Tên đăng nhập đã tồn tại' })
    console.error(e)
    res.status(500).json({ error: 'Lỗi server' })
  }
})

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body || {}
  try {
    const r = await pool.query('SELECT * FROM users WHERE username = $1', [(username || '').trim()])
    const u = r.rows[0]
    if (!u || !(await bcrypt.compare(password || '', u.password_hash)))
      return res.status(401).json({ error: 'Sai tên đăng nhập hoặc mật khẩu' })
    res.json({ token: sign(u), username: u.username })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Lỗi server' })
  }
})

app.get('/api/me', auth, (req, res) => res.json({ username: req.user.username }))

const dist = path.join(__dirname, '../client/dist')
app.use(express.static(dist))
app.use((req, res) => res.sendFile(path.join(dist, 'index.html')))

pool
  .query(`CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
  )`)
  .then(() => app.listen(PORT, () => console.log('Chạy ở port ' + PORT)))
  .catch((e) => {
    console.error('Không kết nối được Postgres:', e.message)
    process.exit(1)
  })
