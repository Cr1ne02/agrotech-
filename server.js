const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const { initDB, query, run, get } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/images', express.static(path.join(__dirname, 'images')));
app.use(session({ secret: 'agrotech-secret-key-2026', resave: false, saveUninitialized: false, cookie: { maxAge: 24 * 60 * 60 * 1000 } }));

const storage = multer.diskStorage({
  destination: path.join(__dirname, 'images/'),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

function auth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Не авторизован' });
  next();
}
function adminAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Не авторизован' });
  const user = get('SELECT role FROM users WHERE id = ?', [req.session.userId]);
  if (!user || user.role !== 'admin') return res.status(403).json({ error: 'Нет доступа' });
  next();
}

app.post('/api/register', (req, res) => {
  const { name, email, phone, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Заполните все поля' });
  const exists = get('SELECT id FROM users WHERE email = ?', [email]);
  if (exists) return res.status(400).json({ error: 'Email уже зарегистрирован' });
  const hash = bcrypt.hashSync(password, 10);
  const result = run('INSERT INTO users (name, email, phone, password) VALUES (?, ?, ?, ?)', [name, email, phone || '', hash]);
  req.session.userId = result.lastInsertRowid;
  res.json({ success: true });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  const user = get('SELECT * FROM users WHERE email = ?', [email]);
  if (!user || !bcrypt.compareSync(password, user.password)) return res.status(400).json({ error: 'Неверный email или пароль' });
  req.session.userId = user.id;
  res.json({ success: true, role: user.role });
});

app.post('/api/logout', (req, res) => { req.session.destroy(); res.json({ success: true }); });

app.get('/api/me', auth, (req, res) => {
  const user = get('SELECT id, name, email, phone, role, created_at FROM users WHERE id = ?', [req.session.userId]);
  res.json(user);
});

app.put('/api/me', auth, (req, res) => {
  const { name, phone } = req.body;
  run('UPDATE users SET name = ?, phone = ? WHERE id = ?', [name, phone, req.session.userId]);
  res.json({ success: true });
});

app.get('/api/products', (req, res) => {
  const { category, search } = req.query;
  let sql = 'SELECT * FROM products WHERE 1=1';
  const params = [];
  if (category) { sql += ' AND category = ?'; params.push(category); }
  if (search) { sql += ' AND (name LIKE ? OR description LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  res.json(query(sql, params));
});

app.get('/api/products/:id', (req, res) => {
  const product = get('SELECT * FROM products WHERE id = ?', [Number(req.params.id)]);
  if (!product) return res.status(404).json({ error: 'Не найдено' });
  res.json(product);
});

app.get('/api/reviews/:productId', (req, res) => {
  const reviews = query('SELECT r.*, u.name as user_name FROM reviews r JOIN users u ON r.user_id = u.id WHERE r.product_id = ? ORDER BY r.created_at DESC', [Number(req.params.productId)]);
  res.json(reviews);
});

app.post('/api/reviews', auth, (req, res) => {
  const { product_id, rating, comment } = req.body;
  run('INSERT INTO reviews (user_id, product_id, rating, comment) VALUES (?, ?, ?, ?)', [req.session.userId, product_id, rating, comment || '']);
  res.json({ success: true });
});

app.get('/api/cart', auth, (req, res) => {
  const items = query('SELECT c.*, p.name, p.price_per_day, p.image FROM cart c JOIN products p ON c.product_id = p.id WHERE c.user_id = ?', [req.session.userId]);
  res.json(items);
});

app.post('/api/cart', auth, (req, res) => {
  const { product_id, start_date, end_date } = req.body;
  run('INSERT INTO cart (user_id, product_id, start_date, end_date) VALUES (?, ?, ?, ?)', [req.session.userId, product_id, start_date, end_date]);
  res.json({ success: true });
});

app.delete('/api/cart/:id', auth, (req, res) => {
  run('DELETE FROM cart WHERE id = ? AND user_id = ?', [Number(req.params.id), req.session.userId]);
  res.json({ success: true });
});

app.post('/api/bookings', auth, (req, res) => {
  const cartItems = query('SELECT c.*, p.price_per_day FROM cart c JOIN products p ON c.product_id = p.id WHERE c.user_id = ?', [req.session.userId]);
  if (!cartItems.length) return res.status(400).json({ error: 'Корзина пуста' });
  for (const item of cartItems) {
    const days = Math.max(1, Math.ceil((new Date(item.end_date) - new Date(item.start_date)) / 86400000));
    run('INSERT INTO bookings (user_id, product_id, start_date, end_date, total_price) VALUES (?, ?, ?, ?, ?)',
      [req.session.userId, item.product_id, item.start_date, item.end_date, days * item.price_per_day]);
  }
  run('DELETE FROM cart WHERE user_id = ?', [req.session.userId]);
  res.json({ success: true });
});

app.get('/api/bookings', auth, (req, res) => {
  const bookings = query('SELECT b.*, p.name as product_name, p.image FROM bookings b JOIN products p ON b.product_id = p.id WHERE b.user_id = ? ORDER BY b.created_at DESC', [req.session.userId]);
  res.json(bookings);
});

app.get('/api/admin/stats', adminAuth, (req, res) => {
  const users = get('SELECT COUNT(*) as c FROM users').c;
  const products = get('SELECT COUNT(*) as c FROM products').c;
  const bookings = get('SELECT COUNT(*) as c FROM bookings').c;
  const rev = get("SELECT COALESCE(SUM(total_price),0) as s FROM bookings WHERE status != 'cancelled'");
  res.json({ users, products, bookings, revenue: rev.s });
});

app.get('/api/admin/users', adminAuth, (req, res) => {
  res.json(query('SELECT id, name, email, phone, role, created_at FROM users ORDER BY created_at DESC'));
});

app.get('/api/admin/bookings', adminAuth, (req, res) => {
  res.json(query('SELECT b.*, u.name as user_name, u.email, p.name as product_name FROM bookings b JOIN users u ON b.user_id = u.id JOIN products p ON b.product_id = p.id ORDER BY b.created_at DESC'));
});

app.put('/api/admin/bookings/:id', adminAuth, (req, res) => {
  run('UPDATE bookings SET status = ? WHERE id = ?', [req.body.status, Number(req.params.id)]);
  res.json({ success: true });
});

app.delete('/api/admin/bookings/:id', adminAuth, (req, res) => {
  run('DELETE FROM bookings WHERE id = ?', [Number(req.params.id)]);
  res.json({ success: true });
});

app.post('/api/admin/products', adminAuth, upload.single('image'), (req, res) => {
  const { name, description, price_per_day, category } = req.body;
  const image = req.file ? req.file.filename : '';
  run('INSERT INTO products (name, description, price_per_day, category, image) VALUES (?, ?, ?, ?, ?)', [name, description, Number(price_per_day), category, image]);
  res.json({ success: true });
});

app.put('/api/admin/products/:id', adminAuth, (req, res) => {
  const id = Number(req.params.id);
  const current = get('SELECT * FROM products WHERE id = ?', [id]);
  if (!current) return res.status(404).json({ error: 'Не найдено' });
  const name = req.body.name !== undefined && req.body.name !== '' ? req.body.name : current.name;
  const description = req.body.description !== undefined ? req.body.description : current.description;
  const price_per_day = req.body.price_per_day !== undefined && req.body.price_per_day > 0 ? req.body.price_per_day : current.price_per_day;
  const category = req.body.category !== undefined && req.body.category !== '' ? req.body.category : current.category;
  const available = req.body.available !== undefined ? req.body.available : current.available;
  run('UPDATE products SET name=?, description=?, price_per_day=?, category=?, available=? WHERE id=?', [name, description, price_per_day, category, available, id]);
  res.json({ success: true });
});

app.delete('/api/admin/products/:id', adminAuth, (req, res) => {
  run('DELETE FROM products WHERE id = ?', [Number(req.params.id)]);
  res.json({ success: true });
});

app.delete('/api/admin/users/:id', adminAuth, (req, res) => {
  run("DELETE FROM users WHERE id = ? AND role != 'admin'", [Number(req.params.id)]);
  res.json({ success: true });
});

app.get('/api/admin/reviews', adminAuth, (req, res) => {
  res.json(query('SELECT r.*, u.name as user_name, p.name as product_name FROM reviews r JOIN users u ON r.user_id = u.id JOIN products p ON r.product_id = p.id ORDER BY r.created_at DESC'));
});

app.delete('/api/admin/reviews/:id', adminAuth, (req, res) => {
  run('DELETE FROM reviews WHERE id = ?', [Number(req.params.id)]);
  res.json({ success: true });
});

initDB().then(() => {
  app.listen(PORT, () => console.log(`АгроТеч запущен: http://localhost:${PORT}`));
}).catch(err => { console.error('Ошибка инициализации БД:', err); process.exit(1); });
