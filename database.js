const initSqlJs = require('sql.js');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'agrotech.db');
let db;

async function initDB() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      price_per_day REAL NOT NULL,
      category TEXT,
      image TEXT,
      available INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      total_price REAL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      rating INTEGER NOT NULL,
      comment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS cart (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      start_date TEXT,
      end_date TEXT
    )
  `);

  const adminCheck = db.exec("SELECT id FROM users WHERE role = 'admin'");
  if (!adminCheck.length || !adminCheck[0].values.length) {
    const hash = bcrypt.hashSync('AgR0T3ch$2026!', 10);
    db.run("INSERT INTO users (name, email, phone, password, role) VALUES (?, ?, ?, ?, ?)",
      ['Администратор', 'admin@agrotech.ru', '+7 (000) 000-00-00', hash, 'admin']);
  }

  const countCheck = db.exec("SELECT COUNT(*) as c FROM products");
  if (countCheck[0].values[0][0] === 0) {
    const products = [
      ['Трактор John Deere 8R', 'Мощный трактор для обработки больших площадей. 400 л.с., полный привод, кондиционер.', 15000, 'Тракторы', 'tractor1.jpg'],
      ['Комбайн CLAAS Lexion 770', 'Зерноуборочный комбайн высокой производительности. Ширина жатки 12м.', 25000, 'Комбайны', 'combine1.jpg'],
      ['Сеялка Amazone Citan', 'Пневматическая сеялка для точного высева. Рабочая ширина 6м.', 8000, 'Сеялки', 'seeder1.jpg'],
      ['Плуг Lemken Juwel', 'Оборотный плуг для глубокой вспашки. 5 корпусов.', 5000, 'Плуги', 'plow1.jpg'],
      ['Опрыскиватель Hardi Navigator', 'Прицепной опрыскиватель. Бак 4000л, штанга 24м.', 7000, 'Опрыскиватели', 'sprayer1.jpg'],
      ['Трактор Беларус МТЗ-82', 'Универсальный трактор для средних хозяйств. 81 л.с.', 6000, 'Тракторы', 'tractor2.jpg'],
      ['Косилка Krone EasyCut', 'Дисковая косилка для заготовки кормов. Ширина захвата 3.2м.', 4000, 'Косилки', 'mower1.jpg'],
      ['Культиватор Horsch Tiger', 'Универсальный культиватор для предпосевной обработки. Ширина 6м.', 6500, 'Культиваторы', 'cultivator1.jpg'],
    ];
    for (const p of products) {
      db.run("INSERT INTO products (name, description, price_per_day, category, image) VALUES (?, ?, ?, ?, ?)", p);
    }
  }

  saveDB();
  return db;
}

function saveDB() {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function query(sql, params = []) {
  const result = db.exec(sql, params);
  if (!result.length) return [];
  const cols = result[0].columns;
  return result[0].values.map(row => {
    const obj = {};
    cols.forEach((c, i) => obj[c] = row[i]);
    return obj;
  });
}

function run(sql, params = []) {
  db.run(sql, params);
  saveDB();
  return { lastInsertRowid: db.exec("SELECT last_insert_rowid()")[0].values[0][0] };
}

function get(sql, params = []) {
  const rows = query(sql, params);
  return rows[0] || null;
}

module.exports = { initDB, query, run, get, saveDB };
