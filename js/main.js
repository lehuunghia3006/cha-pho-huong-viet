// ===== HEADER SCROLL =====
const header = document.querySelector('header');

window.addEventListener('scroll', () => {
  if (window.scrollY > 50) {
    header.classList.add('scrolled');
  } else {
    header.classList.remove('scrolled');
  }
});

// ===== DISHES DATA =====
let menuDishes = [];
const CATEGORY_LABELS = {
  'cha-gio': '🥩 Chả – Giò',
  'cha-da': '🌶️ Chả – Da',
  'xuc-xich': '🌭 Xúc xích – Lạp xưởng',
  'nuong': '🔥 Món nướng',
  'pho': '🍜 Phở & Mì',
  'banh': '🏕️ Bánh'
};

// Load dishes from API
async function loadMenuDishes() {
  try {
    const response = await fetch('/api/dishes?active=true');
    const data = await response.json();

    if (data.success) {
      menuDishes = data.dishes;
      renderMenuCards();
      renderDishSelect();
    }
  } catch (error) {
    console.error('Lỗi tải món ăn:', error);
  }
}

// Render menu cards
function renderMenuCards() {
  const grid = document.getElementById('menuGrid');
  if (!grid) return;

  if (menuDishes.length === 0) {
    grid.innerHTML = '<p style="text-align:center; color:#6c757d; grid-column:1/-1;">Đang tải thực đơn...</p>';
    return;
  }

  grid.innerHTML = menuDishes.map(dish => {
    const priceFormatted = dish.price.toLocaleString('vi-VN') + 'đ';
    const imageHtml = dish.image
      ? `<img src="${dish.image}" alt="${escapeHtml(dish.name)}" loading="lazy" onerror="this.parentElement.innerHTML='${dish.emoji}'">`
      : dish.emoji;
    return `
      <div class="menu-card fade-in" data-category="${dish.category}">
        <div class="menu-card-image">
          ${imageHtml}
          ${dish.badge ? `<div class="menu-card-badge">${dish.badge}</div>` : ''}
        </div>
        <div class="menu-card-body">
          <h3>${escapeHtml(dish.name)}</h3>
          <p>${escapeHtml(dish.description)}</p>
          <div class="menu-card-footer">
            <div class="price">${priceFormatted}</div>
            <button class="btn-add" data-dish-id="${dish.id}">+</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Re-attach scroll animations
  document.querySelectorAll('.menu-card.fade-in').forEach(el => {
    observer.observe(el);
  });

  // Re-attach add button listeners
  attachAddButtonListeners();
}

// Render dish select in order form
function renderDishSelect() {
  const select = document.getElementById('dishSelect');
  if (!select) return;

  // Keep the first option
  select.innerHTML = '<option value="">-- Chọn món --</option>';

  menuDishes.forEach(dish => {
    const priceFormatted = dish.price.toLocaleString('vi-VN') + 'đ';
    const option = document.createElement('option');
    option.value = dish.id;
    option.textContent = `${dish.name} - ${priceFormatted}`;
    select.appendChild(option);
  });
}

// Escape HTML helper
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ===== MOBILE NAVIGATION =====
const hamburger = document.querySelector('.hamburger');
const nav = document.querySelector('nav');

hamburger.addEventListener('click', () => {
  hamburger.classList.toggle('active');
  nav.classList.toggle('open');
});

// Close nav on link click
document.querySelectorAll('nav a').forEach(link => {
  link.addEventListener('click', () => {
    hamburger.classList.remove('active');
    nav.classList.remove('open');
  });
});

// ===== ACTIVE NAV LINK ON SCROLL =====
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('nav a:not(.nav-cta)');

window.addEventListener('scroll', () => {
  let current = '';
  sections.forEach(section => {
    const sectionTop = section.offsetTop - 120;
    if (window.scrollY >= sectionTop) {
      current = section.getAttribute('id');
    }
  });

  navLinks.forEach(link => {
    link.classList.remove('active');
    if (link.getAttribute('href') === `#${current}`) {
      link.classList.add('active');
    }
  });
});

// ===== SCROLL ANIMATIONS =====
const observerOptions = {
  threshold: 0.1,
  rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, observerOptions);

document.querySelectorAll('.fade-in, .fade-in-left, .fade-in-right').forEach(el => {
  observer.observe(el);
});

// ===== MENU TABS =====
const menuTabs = document.querySelectorAll('.menu-tab');

menuTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    // Update active tab
    menuTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    const filter = tab.getAttribute('data-filter');
    const cards = document.querySelectorAll('.menu-card');

    // Filter cards
    cards.forEach(card => {
      if (filter === 'all' || card.getAttribute('data-category') === filter) {
        card.style.display = 'block';
        setTimeout(() => {
          card.style.opacity = '1';
          card.style.transform = 'translateY(0)';
        }, 50);
      } else {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        setTimeout(() => {
          card.style.display = 'none';
        }, 300);
      }
    });
  });
});

// ===== CONTACT FORM =====
const contactForm = document.getElementById('contactForm');

contactForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  // Get form values
  const name = contactForm.querySelector('input[name="name"]').value;
  const phone = contactForm.querySelector('input[name="phone"]').value;
  const email = contactForm.querySelector('input[name="email"]').value;
  const dish = contactForm.querySelector('select[name="dish"]').value;
  const quantity = contactForm.querySelector('input[name="quantity"]')?.value || 1;
  const note = contactForm.querySelector('textarea[name="note"]').value;

  // Simple validation
  if (!name || !phone) {
    alert('Vui lòng điền đầy đủ thông tin bắt buộc!');
    return;
  }

  const btn = contactForm.querySelector('.btn-submit');
  const originalText = btn.textContent;

  try {
    btn.textContent = 'Đang gửi...';
    btn.disabled = true;

    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, email, dish, quantity, note })
    });

    const data = await response.json();

    if (data.success) {
      btn.textContent = '✓ Đặt hàng thành công!';
      btn.style.background = 'linear-gradient(135deg, #2d6a4f, #40916c)';
      contactForm.reset();
    } else {
      btn.textContent = '✗ Lỗi: ' + (data.error || 'Thử lại');
      btn.style.background = 'linear-gradient(135deg, #e76f51, #f4a261)';
    }
  } catch (error) {
    btn.textContent = '✗ Lỗi kết nối server';
    btn.style.background = 'linear-gradient(135deg, #e76f51, #f4a261)';
  }

  setTimeout(() => {
    btn.textContent = originalText;
    btn.style.background = '';
    btn.disabled = false;
  }, 3000);
});

// ===== SMOOTH SCROLL =====
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      target.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  });
});

// ===== COUNTER ANIMATION =====
function animateCounter(el) {
  const target = parseInt(el.getAttribute('data-target'));
  const duration = 2000;
  const step = target / (duration / 16);
  let current = 0;

  const timer = setInterval(() => {
    current += step;
    if (current >= target) {
      el.textContent = target;
      clearInterval(timer);
    } else {
      el.textContent = Math.floor(current);
    }
  }, 16);
}

// Observe counters
const counterObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      animateCounter(entry.target);
      counterObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.5 });

document.querySelectorAll('.stat h3').forEach(counter => {
  counterObserver.observe(counter);
});

// ===== ADD TO CART ANIMATION =====
function attachAddButtonListeners() {
  document.querySelectorAll('.btn-add').forEach(btn => {
    btn.addEventListener('click', () => {
      const dishId = btn.getAttribute('data-dish-id');
      if (dishId) {
        // Scroll to order form and select the dish
        const dishSelect = document.getElementById('dishSelect');
        if (dishSelect) {
          dishSelect.value = dishId;
          document.getElementById('contact').scrollIntoView({ behavior: 'smooth' });
        }
      }

      btn.style.background = 'var(--primary)';
      btn.style.color = 'white';
      btn.textContent = '✓';

      setTimeout(() => {
        btn.style.background = '';
        btn.style.color = '';
        btn.textContent = '+';
      }, 1500);
    });
  });
}

// Initial attachment
attachAddButtonListeners();

// ===== PARALLAX EFFECT ON HERO =====
window.addEventListener('scroll', () => {
  const scrolled = window.scrollY;
  const heroVisual = document.querySelector('.hero-visual');
  if (heroVisual && scrolled < window.innerHeight) {
    heroVisual.style.transform = `translateY(${scrolled * 0.15}px)`;
  }
});

// ===== INITIALIZE =====
document.addEventListener('DOMContentLoaded', () => {
  loadMenuDishes();
});
