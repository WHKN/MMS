import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import sqlite3 from 'sqlite3';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
const { verbose } = sqlite3;
const app = express();
app.use(cors());
app.use(bodyParser.json());

// JWT密钥
const JWT_SECRET = 'your-secret-key';

// 验证JWT中间件
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: '未提供认证令牌' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: '无效的认证令牌' });
    }
    req.user = user;
    next();
  });
};

// 管理员API
app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body;
  res.set('Content-Type', 'application/json');

  db.get('SELECT * FROM admins WHERE username = ?', [username], async (err, admin) => {
    if (err) {
      res.status(500).json({ error: '服务器错误' });
      return;
    }

    if (!admin) {
      res.status(401).json({ error: '用户名或密码错误' });
      return;
    }

    const validPassword = await bcrypt.compare(password, admin.password);
    if (!validPassword) {
      res.status(401).json({ error: '用户名或密码错误' });
      return;
    }

    const token = jwt.sign({ id: admin.id, username: admin.username }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token });
  });
});

app.get('/api/admin/check-init', (req, res) => {
  res.set('Content-Type', 'application/json');
  db.get('SELECT COUNT(*) as count FROM admins', [], (err, row) => {
    if (err) {
      res.status(500).json({ error: '服务器错误' });
      return;
    }
    res.json({ needInit: row.count === 0 });
  });
});

app.post('/api/admin/init', async (req, res) => {
  const { username, password } = req.body;
  res.set('Content-Type', 'application/json');

  // 检查是否已存在管理员账户
  db.get('SELECT COUNT(*) as count FROM admins', [], async (err, row) => {
    if (err) {
      res.status(500).json({ error: '服务器错误' });
      return;
    }

    if (row.count > 0) {
      res.status(400).json({ error: '管理员账户已存在' });
      return;
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 10);

    // 创建管理员账户
    db.run('INSERT INTO admins (username, password) VALUES (?, ?)', 
      [username, hashedPassword], 
      (err) => {
        if (err) {
          res.status(500).json({ error: '创建管理员账户失败' });
          return;
        }
        res.json({ message: '管理员账户创建成功' });
      }
    );
  });
});

// 为所有需要认证的API添加中间件
app.use('/api/members', authenticateToken);
app.use('/api/transactions', authenticateToken);
app.use('/api/reports', authenticateToken);

// 创建数据库连接
const db = new sqlite3.Database('vip.db', (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('成功连接到数据库');
    // 创建表
    db.run(`CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT UNIQUE NOT NULL,
      balance REAL DEFAULT 0,
      bonus_balance REAL DEFAULT 0,
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
  const { name, phone, initialBalance, bonusAmount } = req.body;
  res.set('Content-Type', 'application/json');

  // 验证手机号格式
  if (!/^\d{11}$/.test(phone)) {
    res.status(400).json({ error: '电话号码错误，请重新输入！' });
    return;
  }

  // 验证初始储值金额和赠费金额
  const balance = parseFloat(initialBalance || 0);
  const bonusBalance = parseFloat(bonusAmount || 0);
  if (isNaN(balance) || balance < 0 || isNaN(bonusBalance) || bonusBalance < 0) {
    res.status(400).json({ error: '金额无效' });
    return;
  }

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');

    db.run('INSERT INTO members (name, phone, balance, bonus_balance) VALUES (?, ?, ?, ?)', 
      [name, phone, balance, bonusBalance], 
      function(err) {
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

        // 如果有初始储值或赠费，添加交易记录
        if (balance > 0 || bonusBalance > 0) {
          const promises = [];
          
          if (balance > 0) {
            promises.push(new Promise((resolve, reject) => {
              db.run(
                'INSERT INTO transactions (member_id, type, amount, description) VALUES (?, ?, ?, ?)',
                [memberId, 'recharge', balance, '开卡初始储值'],
                (err) => err ? reject(err) : resolve()
              );
            }));
          }
          
          if (bonusBalance > 0) {
            promises.push(new Promise((resolve, reject) => {
              db.run(
                'INSERT INTO transactions (member_id, type, amount, description) VALUES (?, ?, ?, ?)',
                [memberId, 'bonus', bonusBalance, '开卡赠费'],
                (err) => err ? reject(err) : resolve()
              );
            }));
          }

          Promise.all(promises)
            .then(() => {
              db.run('COMMIT');
              res.json({ id: memberId, name, phone, balance, bonus_balance: bonusBalance });
            })
            .catch(err => {
              db.run('ROLLBACK');
              res.status(400).json({ error: err.message });
            });
        } else {
          db.run('COMMIT');
          res.json({ id: memberId, name, phone, balance: 0, bonus_balance: 0 });
        }
    });
  });
});

app.get('/api/members', (req, res) => {
  res.set('Content-Type', 'application/json');
  db.all('SELECT *, (balance + bonus_balance) as totalBalance FROM members', [], (err, rows) => {
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

  // 如果是消费交易，直接进入处理流程
  if (type === 'consume') {
    processTransaction();
  } else {
    // 充值交易直接处理
    processTransaction();
  }

  function processTransaction() {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      // 如果是消费，先检查总余额是否足够
      if (type === 'consume') {
        db.get('SELECT balance, bonus_balance FROM members WHERE id = ?', [member_id], (err, row) => {
          if (err || !row) {
            db.run('ROLLBACK');
            res.status(400).json({ error: err ? err.message : '会员不存在' });
            return;
          }
          
          const balance = parseFloat(row.balance) || 0;
          const bonusBalance = parseFloat(row.bonus_balance) || 0;
          const totalBalance = balance + bonusBalance;
          const consumeAmount = parseFloat(amount) || 0;
          
          // 检查消费金额是否有效
          if (isNaN(consumeAmount) || consumeAmount <= 0) {
            db.run('ROLLBACK');
            res.status(400).json({ error: '消费金额无效' });
            return;
          }

          // 检查总余额是否足够
          if (totalBalance < consumeAmount) {
            db.run('ROLLBACK');
            res.status(400).json({ error: '余额不足' });
            return;
          }

          // 优先扣除赠费余额，但不能超过实际的赠费余额
          const bonusToUse = Math.min(bonusBalance, consumeAmount);
          const balanceToUse = consumeAmount - bonusToUse;
          
          // 检查储值余额是否足够支付剩余金额
          if (balanceToUse > balance) {
            db.run('ROLLBACK');
            res.status(400).json({ error: '储值余额不足' });
            return;
          }
          
          db.run('UPDATE members SET bonus_balance = bonus_balance - ?, balance = balance - ? WHERE id = ?',
            [bonusToUse, balanceToUse, member_id],
            function(err) {
              if (err) {
                db.run('ROLLBACK');
                res.status(400).json({ error: err.message });
                return;
              }

              // 添加交易记录
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
            }
          );
        });
      } else if (type === 'bonus') {
        // 赠费增加赠费余额
        db.run('UPDATE members SET bonus_balance = bonus_balance + ? WHERE id = ?',
          [amount, member_id],
          function(err) {
            if (err) {
              db.run('ROLLBACK');
              res.status(400).json({ error: err.message });
              return;
            }
            
            // 添加交易记录
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
          }
        );
      } else {
        // 充值增加储值余额
        db.run('UPDATE members SET balance = balance + ? WHERE id = ?',
          [amount, member_id],
          function(err) {
            if (err) {
              db.run('ROLLBACK');
              res.status(400).json({ error: err.message });
              return;
            }
            
            // 添加交易记录
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
          }
        );
      }
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
        COUNT(DISTINCT member_id) as activeMembers,
        (SELECT COUNT(*) FROM members) as totalMembers,
        (SELECT COUNT(*) FROM members WHERE balance + bonus_balance > 0) as validMembers,
        (SELECT SUM(balance + bonus_balance) FROM members) as totalRechargeWithBonus
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