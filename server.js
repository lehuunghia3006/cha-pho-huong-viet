require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

// ===== MIDDLEWARE =====
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ===== DATABASE (JSON File) =====
const DB_FILE = path.join(__dirname, 'data', 'orders.json');
const DISHES_FILE = path.join(__dirname, 'data', 'dishes.json');

// Ensure data directory exists
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'));
}

// Initialize orders file if not exists
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify([], null, 2));
}

// Initialize dishes file if not exists
if (!fs.existsSync(DISHES_FILE)) {
  fs.writeFileSync(DISHES_FILE, JSON.stringify([], null, 2));
}

function readOrders() {
  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

function writeOrders(orders) {
  fs.writeFileSync(DB_FILE, JSON.stringify(orders, null, 2));
}

function readDishes() {
  try {
    const data = fs.readFileSync(DISHES_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

function writeDishes(dishes) {
  fs.writeFileSync(DISHES_FILE, JSON.stringify(dishes, null, 2));
}

// ===== EMAIL TRANSPORTER =====
let transporter = null;

if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
}

async function sendOrderEmail(order) {
  if (!transporter) {
    console.log('⚠️  Email chưa được cấu hình. Đơn hàng chỉ lưu trong hệ thống.');
    return;
  }

  const dishes = readDishes();

  // Build items list for email
  let itemsHtml = '';
  if (order.items && order.items.length > 0) {
    itemsHtml = order.items.map(item => {
      const dish = dishes.find(d => d.id === item.dish);
      const name = dish ? dish.name : item.dish;
      return `<tr>
        <td style="padding: 8px 10px; border-bottom: 1px solid #eee;">${name}</td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #eee; text-align:center;">${item.quantity}</td>
      </tr>`;
    }).join('');
  }

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: process.env.EMAIL_TO || process.env.EMAIL_USER,
    subject: `🍜 Đơn hàng mới từ ${order.name}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2d6a4f;">🍜 Đơn hàng mới từ Chả Phở Tín Bé</h2>
        <hr style="border: 1px solid #e0e0e0;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 10px; font-weight: bold;">Khách hàng:</td>
            <td style="padding: 10px;">${order.name}</td>
          </tr>
          <tr>
            <td style="padding: 10px; font-weight: bold;">Số điện thoại:</td>
            <td style="padding: 10px;">${order.phone}</td>
          </tr>
          <tr>
            <td style="padding: 10px; font-weight: bold;">Email:</td>
            <td style="padding: 10px;">${order.email || 'Không có'}</td>
          </tr>
        </table>
        <h3 style="color: #2d6a4f; margin-top: 20px;">Chi tiết đơn hàng:</h3>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #eee;">
          <thead>
            <tr style="background: #f8f9fa;">
              <th style="padding: 8px 10px; text-align: left;">Món</th>
              <th style="padding: 8px 10px; text-align: center;">SL</th>
            </tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
        </table>
        <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
          <tr>
            <td style="padding: 10px; font-weight: bold;">Ghi chú:</td>
            <td style="padding: 10px;">${order.note || 'Không có'}</td>
          </tr>
          <tr>
            <td style="padding: 10px; font-weight: bold;">Thời gian:</td>
            <td style="padding: 10px;">${new Date(order.createdAt).toLocaleString('vi-VN')}</td>
          </tr>
        </table>
        <hr style="border: 1px solid #e0e0e0;">
        <p style="color: #666; font-size: 12px;">Đây là email tự động từ hệ thống Chả Phở Tín Bé</p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Đã gửi email thông báo cho đơn hàng #${order.id}`);
  } catch (error) {
    console.error('❌ Lỗi gửi email:', error.message);
  }
}

// ===== API ROUTES =====

// POST /api/orders - Tạo đơn hàng mới
app.post('/api/orders', (req, res) => {
  const { name, phone, email, items, dish, quantity, note } = req.body;

  // Validate
  if (!name || !phone) {
    return res.status(400).json({ error: 'Vui lòng điền tên và số điện thoại' });
  }

  // Handle both old format (single dish) and new format (items array)
  let orderItems = [];
  if (items && Array.isArray(items) && items.length > 0) {
    orderItems = items.map(item => ({
      dish: item.dish || '',
      quantity: parseInt(item.quantity) || 1
    }));
  } else if (dish) {
    orderItems = [{ dish, quantity: parseInt(quantity) || 1 }];
  }

  if (orderItems.length === 0) {
    return res.status(400).json({ error: 'Vui lòng chọn ít nhất 1 món' });
  }

  const orders = readOrders();
  const newOrder = {
    id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
    name,
    phone,
    email: email || '',
    items: orderItems,
    note: note || '',
    status: 'new', // new, processing, completed, cancelled
    createdAt: new Date().toISOString()
  };

  orders.unshift(newOrder); // Thêm vào đầu danh sách
  writeOrders(orders);

  // Gửi email thông báo
  sendOrderEmail(newOrder);

  res.status(201).json({
    success: true,
    message: 'Đặt hàng thành công!',
    order: newOrder
  });
});

// GET /api/orders - Lấy danh sách đơn hàng (Admin)
app.get('/api/orders', (req, res) => {
  const orders = readOrders();
  const { status, search } = req.query;

  let filtered = orders;

  // Filter by status
  if (status && status !== 'all') {
    filtered = filtered.filter(o => o.status === status);
  }

  // Search by name or phone
  if (search) {
    const searchLower = search.toLowerCase();
    filtered = filtered.filter(o =>
      o.name.toLowerCase().includes(searchLower) ||
      o.phone.includes(search)
    );
  }

  res.json({
    success: true,
    orders: filtered,
    total: orders.length,
    stats: {
      new: orders.filter(o => o.status === 'new').length,
      processing: orders.filter(o => o.status === 'processing').length,
      completed: orders.filter(o => o.status === 'completed').length,
      cancelled: orders.filter(o => o.status === 'cancelled').length
    }
  });
});

// PUT /api/orders/:id/status - Cập nhật trạng thái đơn
app.put('/api/orders/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['new', 'processing', 'completed', 'cancelled'].includes(status)) {
    return res.status(400).json({ error: 'Trạng thái không hợp lệ' });
  }

  const orders = readOrders();
  const orderIndex = orders.findIndex(o => o.id === id);

  if (orderIndex === -1) {
    return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
  }

  orders[orderIndex].status = status;
  orders[orderIndex].updatedAt = new Date().toISOString();
  writeOrders(orders);

  res.json({
    success: true,
    message: 'Cập nhật thành công',
    order: orders[orderIndex]
  });
});

// DELETE /api/orders/:id - Xóa đơn
app.delete('/api/orders/:id', (req, res) => {
  const { id } = req.params;
  const orders = readOrders();
  const filtered = orders.filter(o => o.id !== id);

  if (filtered.length === orders.length) {
    return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
  }

  writeOrders(filtered);

  res.json({
    success: true,
    message: 'Đã xóa đơn hàng'
  });
});

// ===== DISHES API =====

// GET /api/dishes - Lấy danh sách món ăn
app.get('/api/dishes', (req, res) => {
  const dishes = readDishes();
  const { category, active } = req.query;

  let filtered = dishes;

  if (category && category !== 'all') {
    filtered = filtered.filter(d => d.category === category);
  }

  if (active !== undefined) {
    filtered = filtered.filter(d => d.active === (active === 'true'));
  }

  res.json({
    success: true,
    dishes: filtered,
    total: dishes.length
  });
});

// GET /api/dishes/:id - Lấy 1 món ăn
app.get('/api/dishes/:id', (req, res) => {
  const dishes = readDishes();
  const dish = dishes.find(d => d.id === req.params.id);

  if (!dish) {
    return res.status(404).json({ error: 'Không tìm thấy món ăn' });
  }

  res.json({ success: true, dish });
});

// POST /api/dishes - Thêm món ăn mới
app.post('/api/dishes', (req, res) => {
  const { name, description, price, category, emoji, badge, active } = req.body;

  if (!name || !price || !category) {
    return res.status(400).json({ error: 'Vui lòng điền tên, giá và danh mục' });
  }

  const dishes = readDishes();

  // Tạo ID từ tên
  const id = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') + '-' + Date.now().toString(36).slice(-4);

  const newDish = {
    id,
    name,
    description: description || '',
    price: parseInt(price),
    category,
    emoji: emoji || '🍽️',
    badge: badge || '',
    active: active !== false
  };

  dishes.push(newDish);
  writeDishes(dishes);

  res.status(201).json({
    success: true,
    message: 'Thêm món ăn thành công!',
    dish: newDish
  });
});

// PUT /api/dishes/:id - Cập nhật món ăn
app.put('/api/dishes/:id', (req, res) => {
  const dishes = readDishes();
  const index = dishes.findIndex(d => d.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ error: 'Không tìm thấy món ăn' });
  }

  const { name, description, price, category, emoji, badge, active } = req.body;

  dishes[index] = {
    ...dishes[index],
    name: name || dishes[index].name,
    description: description !== undefined ? description : dishes[index].description,
    price: price ? parseInt(price) : dishes[index].price,
    category: category || dishes[index].category,
    emoji: emoji || dishes[index].emoji,
    badge: badge !== undefined ? badge : dishes[index].badge,
    active: active !== undefined ? active : dishes[index].active
  };

  writeDishes(dishes);

  res.json({
    success: true,
    message: 'Cập nhật thành công',
    dish: dishes[index]
  });
});

// DELETE /api/dishes/:id - Xóa món ăn
app.delete('/api/dishes/:id', (req, res) => {
  const dishes = readDishes();
  const filtered = dishes.filter(d => d.id !== req.params.id);

  if (filtered.length === dishes.length) {
    return res.status(404).json({ error: 'Không tìm thấy món ăn' });
  }

  writeDishes(filtered);

  res.json({
    success: true,
    message: 'Đã xóa món ăn'
  });
});

// ===== SERVE STATIC FILES =====
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// ===== START SERVER =====
app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════╗
  ║   🍜 Chả Phở Tín Bé - Server       ║
  ║                                          ║
  ║   Website:  http://localhost:${PORT}        ║
  ║   Admin:    http://localhost:${PORT}/admin  ║
  ║                                          ║
  ║   Email: ${process.env.EMAIL_USER ? 'Đã cấu hình ✓' : 'Chưa cấu hình ✗'}                  ║
  ╚══════════════════════════════════════════╝
  `);
});
