import sqlite3 from 'sqlite3';

const db = new sqlite3.Database('vip.db');

// 创建管理员表
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // 检查是否已存在管理员账户
  db.get('SELECT COUNT(*) as count FROM admins', [], (err, row) => {
    if (err) {
      console.error('检查管理员账户失败:', err.message);
      return;
    }

    if (row.count === 0) {
      console.log('数据库初始化完成，请运行系统并按照引导创建管理员账户。');
    }
  });
});