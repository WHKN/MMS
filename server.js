import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import sqlite3 from 'sqlite3';
const { verbose } = sqlite3;
const app = express();
app.use(cors());
app.use(bodyParser.json());

// 创建数据库连接
const db = new sqlite3.Database('vip.db', (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('成功连接到数据库');
    // 创建表
    db.run(`CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT UNIQUE NOT NULL,
      balance REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(member_id) REFERENCES members(id)
    )`);
  }
});

// 会员管理API
app.post('/api/members', (req, res) => {
  const { name, phone, initialBalance } = req.body;
  res.set('Content-Type', 'application/json');

  // 验证手机号格式
  if (!/^\d{11}$/.test(phone)) {
    res.status(400).json({ error: '电话号码错误，请重新输入！' });
    return;
  }

  // 验证初始储值金额
  const balance = parseFloat(initialBalance || 0);
  if (isNaN(balance) || balance < 0) {
    res.status(400).json({ error: '初始储值金额无效' });
    return;
  }

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');

    db.run('INSERT INTO members (name, phone, balance) VALUES (?, ?, ?)', [name, phone, balance], function(err) {
      if (err) {
        db.run('ROLLBACK');
        if (err.message.includes('UNIQUE constraint failed: members.phone')) {
          res.status(400).json({ error: '当前会员手机号已存在' });
          return;
        }
        res.status(400).json({ error: err.message });
        return;
      }

      const memberId = this.lastID;

      // 如果有初始储值，添加交易记录
      if (balance > 0) {
        db.run(
          'INSERT INTO transactions (member_id, type, amount, description) VALUES (?, ?, ?, ?)',
          [memberId, 'recharge', balance, '开卡初始储值'],
          (err) => {
            if (err) {
              db.run('ROLLBACK');
              res.status(400).json({ error: err.message });
              return;
            }
            db.run('COMMIT');
            res.json({ id: memberId, name, phone, balance });
          }
        );
      } else {
        db.run('COMMIT');
        res.json({ id: memberId, name, phone, balance });
      }
    });
  });
});

app.get('/api/members', (req, res) => {
  res.set('Content-Type', 'application/json');
  db.all('SELECT * FROM members', [], (err, rows) => {
    if (err) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// 储值和消费API
app.post('/api/transactions', (req, res) => {
  const { member_id, type, amount, description } = req.body;
  res.set('Content-Type', 'application/json');

  // 如果是消费交易，先检查余额是否充足
  if (type === 'consume') {
    db.get('SELECT balance FROM members WHERE id = ?', [member_id], (err, member) => {
      if (err) {
        res.status(400).json({ error: err.message });
        return;
      }
      if (!member) {
        res.status(404).json({ error: '会员不存在' });
        return;
      }
      if (member.balance < amount) {
        res.status(400).json({ error: '余额不足' });
        return;
      }
      // 余额充足，继续处理交易
      processTransaction();
    });
  } else {
    // 充值交易直接处理
    processTransaction();
  }

  function processTransaction() {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
    
      const updateBalance = type === 'recharge' ? 
        'UPDATE members SET balance = balance + ? WHERE id = ?' :
        'UPDATE members SET balance = balance - ? WHERE id = ?';
    
      db.run(updateBalance, [amount, member_id], function(err) {
        if (err) {
          db.run('ROLLBACK');
          res.status(400).json({ error: err.message });
          return;
        }
        
        db.run(
          'INSERT INTO transactions (member_id, type, amount, description) VALUES (?, ?, ?, ?)',
          [member_id, type, amount, description],
          function(err) {
            if (err) {
              db.run('ROLLBACK');
              res.status(400).json({ error: err.message });
              return;
            }
            db.run('COMMIT');
            res.json({ id: this.lastID, member_id, type, amount, description });
          }
        );
      });
    });
  }
});

// 获取会员交易记录
app.get('/api/transactions/:memberId', (req, res) => {
  const { memberId } = req.params;
  res.set('Content-Type', 'application/json');
  db.all(
    'SELECT * FROM transactions WHERE member_id = ? ORDER BY created_at DESC',
    [memberId],
    (err, rows) => {
      if (err) {
        res.status(400).json({ error: err.message });
        return;
      }
      res.json(rows);
    }
  );
});

// 获取会员信息
app.get('/api/members/:id', (req, res) => {
  const { id } = req.params;
  res.set('Content-Type', 'application/json');
  db.get('SELECT * FROM members WHERE id = ?', [id], (err, row) => {
    if (err) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.json(row);
  });
});

// 更新会员信息API
app.put('/api/members/:id', (req, res) => {
  const { id } = req.params;
  const { name, phone } = req.body;
  
  // 首先检查请求参数
  if (!name || !phone) {
    res.status(400).json({ error: '姓名和电话号码不能为空' });
    return;
  }

  // 检查会员是否存在
  db.get('SELECT * FROM members WHERE id = ?', [id], (err, member) => {
    if (err) {
      res.set('Content-Type', 'application/json');
      res.status(400).json({ error: err.message });
      return;
    }
    
    if (!member) {
      res.set('Content-Type', 'application/json');
      res.status(404).json({ error: '会员不存在' });
      return;
    }

    // 更新会员信息
    db.run(
      'UPDATE members SET name = ?, phone = ? WHERE id = ?',
      [name, phone, id],
      function(err) {
        if (err) {
          res.set('Content-Type', 'application/json');
          res.status(400).json({ error: err.message });
          return;
        }
        res.set('Content-Type', 'application/json');
        res.json({ id, name, phone });
      }
    );
  });
});

// 月度报表API
// 删除会员API
app.delete('/api/members/:id', (req, res) => {
  const { id } = req.params;
  res.set('Content-Type', 'application/json');

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');

    // 首先删除会员的所有交易记录
    db.run('DELETE FROM transactions WHERE member_id = ?', [id], (err) => {
      if (err) {
        db.run('ROLLBACK');
        res.status(400).json({ error: err.message });
        return;
      }

      // 然后删除会员记录
      db.run('DELETE FROM members WHERE id = ?', [id], function(err) {
        if (err) {
          db.run('ROLLBACK');
          res.status(400).json({ error: err.message });
          return;
        }

        if (this.changes === 0) {
          db.run('ROLLBACK');
          res.status(404).json({ error: '会员不存在' });
          return;
        }

        db.run('COMMIT');
        res.json({ message: '会员删除成功' });
      });
    });
  });
});

app.get('/api/reports/monthly/:year/:month', (req, res) => {
  const { year, month } = req.params;
  res.set('Content-Type', 'application/json');


  // 计算月份的开始和结束日期
  const startDate = `${year}-${month.padStart(2, '0')}-01`;
  const endDate = `${year}-${month.padStart(2, '0')}-${new Date(year, month, 0).getDate()}`;

  db.serialize(() => {
    // 获取月度交易统计
    const query = `
      SELECT 
        SUM(CASE WHEN type = 'recharge' THEN amount ELSE 0 END) as totalRecharge,
        SUM(CASE WHEN type = 'consume' THEN amount ELSE 0 END) as totalConsume,
        SUM(CASE WHEN type = 'recharge' THEN 1 ELSE 0 END) as rechargeCount,
        SUM(CASE WHEN type = 'consume' THEN 1 ELSE 0 END) as consumeCount,
        COUNT(DISTINCT member_id) as activeMembers
      FROM transactions
      WHERE date(created_at) BETWEEN date(?) AND date(?)
    `;

    db.get(query, [startDate, endDate], (err, stats) => {
      if (err) {
        res.status(400).json({ error: err.message });
        return;
      }

      // 获取月度交易记录
      const transactionsQuery = `
        SELECT t.*, m.name as member_name
        FROM transactions t
        JOIN members m ON t.member_id = m.id
        WHERE date(t.created_at) BETWEEN date(?) AND date(?)
        ORDER BY t.created_at DESC
      `;

      db.all(transactionsQuery, [startDate, endDate], (err, transactions) => {
        if (err) {
          res.status(400).json({ error: err.message });
          return;
        }

        res.json({
          ...stats,
          transactions
        });
      });
    });
  });
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});