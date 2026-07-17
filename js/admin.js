// ===== CONFIG =====
const API_BASE = window.location.origin + '/api';
const ADMIN_PASSWORD = 'admin123';
const CATEGORY_LABELS = {
  'cha-gio': '🥩 Chả – Giò',
  'cha-da': '🌶️ Chả – Da',
  'xuc-xich': '🌭 Xúc xích – Lạp xưởng',
  'nuong': '🔥 Món nướng',
  'pho': '🍜 Phở & Mì',
  'banh': '🏕️ Bánh'
};

// ===== STATE =====
let currentPage = 'dashboard';
let currentFilter = 'all';
let searchQuery = '';
let allOrders = [];
let allDishes = [];
let dishFilter = 'all';
let dishSearchQuery = '';
let editingDishId = null;

// ===== DOM ELEMENTS =====
const loginOverlay = document.getElementById('loginOverlay');
const loginForm = document.getElementById('loginForm');
const loginPassword = document.getElementById('loginPassword');
const adminWrapper = document.getElementById('adminWrapper');
const sidebar = document.querySelector('.sidebar');
const sidebarToggle = document.getElementById('sidebarToggle');
const btnLogout = document.getElementById('btnLogout');
const navItems = document.querySelectorAll('.nav-item[data-page]');
const pages = document.querySelectorAll('.page');
const pageTitle = document.getElementById('pageTitle');
const toastContainer = document.getElementById('toastContainer');
const notificationBadge = document.getElementById('notificationBadge');

// ===== LOGIN =====
loginForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (loginPassword.value === ADMIN_PASSWORD) {
    loginOverlay.style.display = 'none';
    adminWrapper.style.display = 'flex';
    sessionStorage.setItem('adminAuth', 'true');
    loadOrders();
    loadDishes();
    startAutoRefresh();
  } else {
    showToast('Sai mật khẩu!', 'error');
    loginPassword.value = '';
    loginPassword.focus();
  }
});

// Check if already logged in
if (sessionStorage.getItem('adminAuth') === 'true') {
  loginOverlay.style.display = 'none';
  adminWrapper.style.display = 'flex';
  loadOrders();
  loadDishes();
  startAutoRefresh();
}

// ===== LOGOUT =====
btnLogout.addEventListener('click', () => {
  sessionStorage.removeItem('adminAuth');
  location.reload();
});

// ===== SIDEBAR TOGGLE =====
sidebarToggle.addEventListener('click', () => {
  sidebar.classList.toggle('open');
});

// ===== NAVIGATION =====
navItems.forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    const page = item.getAttribute('data-page');
    switchPage(page);
  });
});

function switchPage(page) {
  currentPage = page;

  // Update nav
  navItems.forEach(n => n.classList.remove('active'));
  document.querySelector(`.nav-item[data-page="${page}"]`).classList.add('active');

  // Update pages
  pages.forEach(p => p.classList.remove('active'));
  document.getElementById(`page-${page}`).classList.add('active');

  // Update title
  const titles = {
    dashboard: 'Dashboard',
    orders: 'Quản lý đơn hàng',
    dishes: 'Quản lý thực đơn'
  };
  pageTitle.textContent = titles[page] || 'Dashboard';

  // Load dishes when switching to dishes page
  if (page === 'dishes') {
    loadDishes();
  }

  // Close sidebar on mobile
  sidebar.classList.remove('open');
}

// ===== LOAD ORDERS =====
async function loadOrders() {
  try {
    const params = new URLSearchParams();
    if (currentFilter !== 'all') params.append('status', currentFilter);
    if (searchQuery) params.append('search', searchQuery);

    const response = await fetch(`${API_BASE}/orders?${params}`);
    const data = await response.json();

    if (data.success) {
      allOrders = data.orders;
      updateStats(data.stats);
      renderOrders(data.orders);
      updateNotificationBadge(data.stats.new);
    }
  } catch (error) {
    console.error('Lỗi tải đơn hàng:', error);
    showToast('Không thể kết nối server', 'error');
  }
}

// ===== UPDATE STATS =====
function updateStats(stats) {
  document.getElementById('statNew').textContent = stats.new;
  document.getElementById('statProcessing').textContent = stats.processing;
  document.getElementById('statCompleted').textContent = stats.completed;
  document.getElementById('statTotal').textContent = stats.new + stats.processing + stats.completed + stats.cancelled;
}

// ===== NOTIFICATION BADGE =====
function updateNotificationBadge(count) {
  if (count > 0) {
    notificationBadge.style.display = 'block';
    notificationBadge.textContent = count;
  } else {
    notificationBadge.style.display = 'none';
  }
}

// ===== RENDER ORDERS =====
function renderOrders(orders) {
  const dashboardBody = document.getElementById('dashboardOrdersBody');
  const ordersBody = document.getElementById('ordersBody');

  if (orders.length === 0) {
    const emptyRow = `<tr><td colspan="10" class="empty-state">Không tìm thấy đơn hàng nào</td></tr>`;
    dashboardBody.innerHTML = emptyRow;
    ordersBody.innerHTML = emptyRow;
    return;
  }

  // Dashboard: show recent 10
  const recentOrders = orders.slice(0, 10);
  dashboardBody.innerHTML = recentOrders.map(order => createOrderRow(order, false)).join('');

  // Orders page: show all
  ordersBody.innerHTML = orders.map(order => createOrderRow(order, true)).join('');

  // Attach event listeners
  attachActionListeners();
}

function createOrderRow(order, full) {
  const dish = allDishes.find(d => d.id === order.dish);
  const dishName = dish ? dish.name : order.dish || '—';
  const time = new Date(order.createdAt).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const statusLabels = {
    new: '🆕 Mới',
    processing: '⏳ Đang xử lý',
    completed: '✅ Hoàn thành',
    cancelled: '❌ Đã hủy'
  };

  const shortId = order.id.slice(-6).toUpperCase();

  let row = `
    <tr data-id="${order.id}">
      <td><span class="order-id">#${shortId}</span></td>
      <td><strong>${escapeHtml(order.name)}</strong></td>
      <td>${escapeHtml(order.phone)}</td>
  `;

  if (full) {
    row += `<td>${escapeHtml(order.email || '—')}</td>`;
  }

  row += `
      <td>${dishName}</td>
      <td>${order.quantity || 1}</td>
  `;

  if (full) {
    row += `<td>${escapeHtml(order.note || '—')}</td>`;
  }

  row += `
      <td><span class="status-badge status-${order.status}">${statusLabels[order.status]}</span></td>
      <td><span class="time-cell">${time}</span></td>
      <td>
        <div class="action-buttons">
  `;

  if (order.status === 'new') {
    row += `
      <button class="btn-action btn-process" data-action="processing" data-tooltip="Xử lý">⏳</button>
      <button class="btn-action btn-cancel" data-action="cancelled" data-tooltip="Hủy">❌</button>
    `;
  } else if (order.status === 'processing') {
    row += `
      <button class="btn-action btn-complete" data-action="completed" data-tooltip="Hoàn thành">✅</button>
      <button class="btn-action btn-cancel" data-action="cancelled" data-tooltip="Hủy">❌</button>
    `;
  }

  row += `
      <button class="btn-action btn-delete" data-action="delete" data-tooltip="Xóa">🗑️</button>
        </div>
      </td>
    </tr>
  `;

  return row;
}

// ===== ATTACH ACTION LISTENERS =====
function attachActionListeners() {
  document.querySelectorAll('.btn-action').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const row = e.target.closest('tr');
      const orderId = row.getAttribute('data-id');
      const action = e.target.getAttribute('data-action');

      if (action === 'delete') {
        if (confirm('Bạn có chắc muốn xóa đơn hàng này?')) {
          await deleteOrder(orderId);
        }
      } else {
        await updateOrderStatus(orderId, action);
      }
    });
  });
}

// ===== UPDATE ORDER STATUS =====
async function updateOrderStatus(id, status) {
  try {
    const response = await fetch(`${API_BASE}/orders/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });

    const data = await response.json();

    if (data.success) {
      const statusNames = {
        processing: 'đang xử lý',
        completed: 'hoàn thành',
        cancelled: 'đã hủy'
      };
      showToast(`Đơn hàng đã chuyển sang "${statusNames[status]}"`, 'success');
      loadOrders();
    } else {
      showToast(data.error || 'Lỗi cập nhật', 'error');
    }
  } catch (error) {
    showToast('Không thể kết nối server', 'error');
  }
}

// ===== DELETE ORDER =====
async function deleteOrder(id) {
  try {
    const response = await fetch(`${API_BASE}/orders/${id}`, {
      method: 'DELETE'
    });

    const data = await response.json();

    if (data.success) {
      showToast('Đã xóa đơn hàng', 'success');
      loadOrders();
    } else {
      showToast(data.error || 'Lỗi xóa', 'error');
    }
  } catch (error) {
    showToast('Không thể kết nối server', 'error');
  }
}

// ===== FILTER BUTTONS =====
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.getAttribute('data-status');
    loadOrders();
  });
});

// ===== SEARCH =====
let searchTimeout;
document.getElementById('searchInput').addEventListener('input', (e) => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    searchQuery = e.target.value.trim();
    loadOrders();
  }, 300);
});

// ===== REFRESH BUTTONS =====
document.getElementById('btnRefreshDashboard').addEventListener('click', loadOrders);
document.getElementById('btnRefreshOrders').addEventListener('click', loadOrders);

// ===== AUTO REFRESH =====
let refreshInterval;

function startAutoRefresh() {
  // Refresh every 10 seconds
  refreshInterval = setInterval(loadOrders, 10000);
}

// ===== TOAST NOTIFICATIONS =====
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const icons = {
    success: '✅',
    error: '❌',
    info: 'ℹ️'
  };

  toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span> ${message}`;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ===== ESCAPE HTML =====
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ===== DISHES MANAGEMENT =====

// Load dishes from API
async function loadDishes() {
  try {
    const response = await fetch(`${API_BASE}/dishes`);
    const data = await response.json();

    if (data.success) {
      allDishes = data.dishes;
      renderDishes();
    }
  } catch (error) {
    console.error('Lỗi tải món ăn:', error);
    showToast('Không thể tải danh sách món ăn', 'error');
  }
}

// Render dishes grid
function renderDishes() {
  const grid = document.getElementById('dishesGrid');
  let filtered = allDishes;

  // Filter by category
  if (dishFilter !== 'all') {
    filtered = filtered.filter(d => d.category === dishFilter);
  }

  // Search
  if (dishSearchQuery) {
    const q = dishSearchQuery.toLowerCase();
    filtered = filtered.filter(d =>
      d.name.toLowerCase().includes(q) ||
      d.description.toLowerCase().includes(q)
    );
  }

  if (filtered.length === 0) {
    grid.innerHTML = `<div class="empty-state-full">Không tìm thấy món ăn nào</div>`;
    return;
  }

  grid.innerHTML = filtered.map(dish => createDishCard(dish)).join('');
  attachDishListeners();
}

// Create dish card HTML
function createDishCard(dish) {
  const priceFormatted = dish.price.toLocaleString('vi-VN') + 'đ';
  const categoryLabel = CATEGORY_LABELS[dish.category] || dish.category;

  return `
    <div class="dish-card ${dish.active ? '' : 'inactive'}" data-id="${dish.id}">
      <div class="dish-card-top">
        <div class="dish-card-emoji">${dish.emoji}</div>
        <div class="dish-card-info">
          <h4>${escapeHtml(dish.name)}</h4>
          <div class="dish-category">${categoryLabel}</div>
          <div class="dish-price">${priceFormatted}</div>
        </div>
        ${dish.badge ? `<div class="dish-card-badge"><span class="badge-tag">${escapeHtml(dish.badge)}</span></div>` : ''}
      </div>
      <div class="dish-card-desc">${escapeHtml(dish.description)}</div>
      <div class="dish-card-actions">
        <button class="btn-edit-dish" data-id="${dish.id}">✏️ Sửa</button>
        <button class="btn-toggle-dish" data-id="${dish.id}">${dish.active ? '👁️ Ẩn' : '👁️‍🗨️ Hiện'}</button>
        <button class="btn-delete-dish" data-id="${dish.id}">🗑️ Xóa</button>
      </div>
    </div>
  `;
}

// Attach event listeners to dish cards
function attachDishListeners() {
  document.querySelectorAll('.btn-edit-dish').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      openEditDishModal(id);
    });
  });

  document.querySelectorAll('.btn-toggle-dish').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      await toggleDishActive(id);
    });
  });

  document.querySelectorAll('.btn-delete-dish').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      if (confirm('Bạn có chắc muốn xóa món ăn này?')) {
        await deleteDish(id);
      }
    });
  });
}

// Toggle dish active status
async function toggleDishActive(id) {
  const dish = allDishes.find(d => d.id === id);
  if (!dish) return;

  try {
    const response = await fetch(`${API_BASE}/dishes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !dish.active })
    });

    const data = await response.json();
    if (data.success) {
      showToast(dish.active ? 'Đã ẩn món ăn' : 'Đã hiện món ăn', 'success');
      loadDishes();
    }
  } catch (error) {
    showToast('Lỗi cập nhật', 'error');
  }
}

// Delete dish
async function deleteDish(id) {
  try {
    const response = await fetch(`${API_BASE}/dishes/${id}`, {
      method: 'DELETE'
    });

    const data = await response.json();
    if (data.success) {
      showToast('Đã xóa món ăn', 'success');
      loadDishes();
    }
  } catch (error) {
    showToast('Lỗi xóa', 'error');
  }
}

// ===== DISH MODAL =====
const dishModal = document.getElementById('dishModal');
const dishForm = document.getElementById('dishForm');
const dishModalTitle = document.getElementById('dishModalTitle');

function openAddDishModal() {
  editingDishId = null;
  dishModalTitle.textContent = 'Thêm món mới';
  dishForm.reset();
  document.getElementById('dishId').value = '';
  document.getElementById('dishEmoji').value = '🍽️';
  document.getElementById('dishActive').value = 'true';
  dishModal.classList.add('active');
}

function openEditDishModal(id) {
  const dish = allDishes.find(d => d.id === id);
  if (!dish) return;

  editingDishId = id;
  dishModalTitle.textContent = 'Sửa món ăn';
  document.getElementById('dishId').value = dish.id;
  document.getElementById('dishName').value = dish.name;
  document.getElementById('dishPrice').value = dish.price;
  document.getElementById('dishCategory').value = dish.category;
  document.getElementById('dishEmoji').value = dish.emoji;
  document.getElementById('dishDesc').value = dish.description;
  document.getElementById('dishBadge').value = dish.badge || '';
  document.getElementById('dishActive').value = dish.active.toString();
  dishModal.classList.add('active');
}

function closeDishModal() {
  dishModal.classList.remove('active');
  editingDishId = null;
}

// Modal event listeners
document.getElementById('btnAddDish').addEventListener('click', openAddDishModal);
document.getElementById('dishModalClose').addEventListener('click', closeDishModal);
document.getElementById('btnCancelDish').addEventListener('click', closeDishModal);

dishModal.addEventListener('click', (e) => {
  if (e.target === dishModal) closeDishModal();
});

// Form submit
dishForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const dishData = {
    name: document.getElementById('dishName').value,
    price: document.getElementById('dishPrice').value,
    category: document.getElementById('dishCategory').value,
    emoji: document.getElementById('dishEmoji').value || '🍽️',
    description: document.getElementById('dishDesc').value,
    badge: document.getElementById('dishBadge').value,
    active: document.getElementById('dishActive').value === 'true'
  };

  try {
    let response;
    if (editingDishId) {
      response = await fetch(`${API_BASE}/dishes/${editingDishId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dishData)
      });
    } else {
      response = await fetch(`${API_BASE}/dishes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dishData)
      });
    }

    const data = await response.json();
    if (data.success) {
      showToast(editingDishId ? 'Cập nhật thành công!' : 'Thêm món mới thành công!', 'success');
      closeDishModal();
      loadDishes();
    } else {
      showToast(data.error || 'Lỗi lưu dữ liệu', 'error');
    }
  } catch (error) {
    showToast('Không thể kết nối server', 'error');
  }
});

// Dish search
let dishSearchTimeout;
document.getElementById('dishSearchInput').addEventListener('input', (e) => {
  clearTimeout(dishSearchTimeout);
  dishSearchTimeout = setTimeout(() => {
    dishSearchQuery = e.target.value.trim();
    renderDishes();
  }, 300);
});

// Dish filter buttons
document.querySelectorAll('.dish-filter').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.dish-filter').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    dishFilter = btn.getAttribute('data-category');
    renderDishes();
  });
});
