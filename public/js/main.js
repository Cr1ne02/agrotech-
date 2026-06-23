const API = '';

async function api(url, options = {}) {
  const res = await fetch(API + url, { headers: { 'Content-Type': 'application/json' }, ...options });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Ошибка');
  return data;
}

function showAlert(container, message, type = 'error') {
  const el = document.getElementById(container) || container;
  if (typeof el === 'string') return;
  el.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
  setTimeout(() => el.innerHTML = '', 4000);
}

async function checkAuth() {
  try {
    const user = await api('/api/me');
    document.querySelectorAll('.auth-only').forEach(el => el.style.display = '');
    document.querySelectorAll('.guest-only').forEach(el => el.style.display = 'none');
    if (user.role === 'admin') document.querySelectorAll('.admin-only').forEach(el => el.style.display = '');
    return user;
  } catch {
    document.querySelectorAll('.auth-only').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.guest-only').forEach(el => el.style.display = '');
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
    return null;
  }
}

async function logout() {
  await api('/api/logout', { method: 'POST' });
  window.location.href = '/';
}

function formatDate(d) {
  return new Date(d).toLocaleDateString('ru-RU');
}

function formatPrice(p) {
  return Number(p).toLocaleString('ru-RU') + ' ₽';
}

function renderStars(rating) {
  return '★'.repeat(rating) + '☆'.repeat(5 - rating);
}

function getHeader(activePage) {
  return `
  <header class="header">
    <div class="header-inner">
      <a href="/" class="logo">🌾 Агро<span>Теч</span></a>
      <nav class="nav">
        <a href="/" class="${activePage === 'home' ? 'active' : ''}">Главная</a>
        <a href="/catalog.html" class="${activePage === 'catalog' ? 'active' : ''}">Каталог</a>
        <a href="/about.html" class="${activePage === 'about' ? 'active' : ''}">О нас</a>
        <a href="/contacts.html" class="${activePage === 'contacts' ? 'active' : ''}">Контакты</a>
        <a href="/cart.html" class="auth-only ${activePage === 'cart' ? 'active' : ''}">Корзина</a>
        <a href="/profile.html" class="auth-only ${activePage === 'profile' ? 'active' : ''}">Кабинет</a>
        <a href="/admin.html" class="admin-only ${activePage === 'admin' ? 'active' : ''}" style="display:none">Админ</a>
        <a href="/login.html" class="guest-only btn-nav">Войти</a>
        <a href="#" onclick="logout()" class="auth-only btn-nav">Выйти</a>
      </nav>
    </div>
  </header>`;
}

function getFooter() {
  return `
  <footer class="footer">
    <p>&copy; 2026 АгроТеч — Аренда сельскохозяйственной техники. Все права защищены.</p>
  </footer>`;
}

function productCard(p) {
  return `
  <div class="card">
    <div class="card-img">
      ${p.image ? `<img src="/images/${p.image}" alt="${p.name}" onerror="this.parentElement.innerHTML='🚜'">` : '🚜'}
    </div>
    <div class="card-body">
      <span class="badge">${p.category || 'Техника'}</span>
      <h3>${p.name}</h3>
      <p>${(p.description || '').substring(0, 80)}...</p>
      <div class="card-footer">
        <div class="card-price">${formatPrice(p.price_per_day)} <small>/ день</small></div>
        <a href="/product.html?id=${p.id}" class="btn btn-primary btn-sm">Подробнее</a>
      </div>
    </div>
  </div>`;
}

document.addEventListener('DOMContentLoaded', () => checkAuth());
