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
      points INTEGER DEFAULT 0,
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

    db.run(`CREATE TABLE IF NOT EXISTS member_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      duration_days INTEGER,
      total_times INTEGER,
      price REAL NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS member_type_relations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER NOT NULL,
      type_id INTEGER NOT NULL,
      start_date DATETIME NOT NULL,
      end_date DATETIME,
      remaining_times INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(member_id) REFERENCES members(id),
      FOREIGN KEY(type_id) REFERENCES member_types(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS point_levels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      min_points INTEGER NOT NULL,
      max_points INTEGER,
      discount REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
  }
});

// 会员管理API
app.post('/api/members', async (req, res) => {
  const { name, phone, initialBalance, bonusAmount, memberTypes } = req.body;
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

  try {
    await new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        db.run('INSERT INTO members (name, phone, balance, bonus_balance, points) VALUES (?, ?, ?, ?, ?)', 
          [name, phone, balance, bonusBalance, balance], 
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

            // 创建一个数组来存储所有需要执行的Promise
            const allPromises = [];

            // 添加会员类型关联
            if (memberTypes && memberTypes.length > 0) {
              const typePromises = memberTypes.map(type => {
                return new Promise((resolve, reject) => {
                  const startDate = new Date();
                  const endDate = type.duration_days ? 
                    new Date(startDate.getTime() + type.duration_days * 24 * 60 * 60 * 1000) : 
                    null;
                  
                  db.run(
                    'INSERT INTO member_type_relations (member_id, type_id, start_date, end_date, remaining_times) VALUES (?, ?, ?, ?, ?)',
                    [memberId, type.id, startDate.toISOString(), endDate?.toISOString(), type.total_times],
                    (err) => err ? reject(err) : resolve()
                  );
                });
              });
              allPromises.push(...typePromises);
            }

            // 添加交易记录
            if (balance > 0) {
              allPromises.push(new Promise((resolve, reject) => {
                db.run(
                  'INSERT INTO transactions (member_id, type, amount, description) VALUES (?, ?, ?, ?)',
                  [memberId, 'recharge', balance, '开卡初始储值'],
                  (err) => err ? reject(err) : resolve()
                );
              }));
            }
            
            if (bonusBalance > 0) {
              allPromises.push(new Promise((resolve, reject) => {
                db.run(
                  'INSERT INTO transactions (member_id, type, amount, description) VALUES (?, ?, ?, ?)',
                  [memberId, 'bonus', bonusBalance, '开卡赠费'],
                  (err) => err ? reject(err) : resolve()
                );
              }));
            }

            // 等待所有操作完成后再提交事务并发送响应
            Promise.all(allPromises)
              .then(() => {
                db.run('COMMIT');
                res.json({ id: memberId, name, phone, balance, bonus_balance: bonusBalance });
              })
              .catch(err => {
                db.run('ROLLBACK');
                res.status(400).json({ error: err.message });
              });
          });
      });
    });
  } catch (err) {
    console.error('处理交易错误:', err);
    res.status(500).json({ error: '服务器内部错误', code: 500 });
  }
});

app.get('/api/members', (req, res) => {
  res.set('Content-Type', 'application/json');
  db.all(`
    SELECT 
      m.*, 
      (m.balance + m.bonus_balance) as totalBalance,
      GROUP_CONCAT(mt.name) as memberTypes,
      pl.name as levelName,
      pl.discount as levelDiscount
    FROM members m
    LEFT JOIN member_type_relations mtr ON m.id = mtr.member_id
    LEFT JOIN member_types mt ON mtr.type_id = mt.id
    LEFT JOIN (
      SELECT pl1.*
      FROM point_levels pl1
      LEFT JOIN point_levels pl2 
      ON pl1.min_points < pl2.min_points 
      AND pl2.min_points <= (SELECT points FROM members WHERE id = members.id)
      WHERE pl2.id IS NULL 
      AND pl1.min_points <= (SELECT points FROM members WHERE id = members.id)
    ) pl ON 1=1
    GROUP BY m.id
  `, [], (err, rows) => {
    if (err) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// 储值和消费API
app.post('/api/transactions', async (req, res) => {
  const { member_id, type, amount, description, member_type_id } = req.body;
  const memberTypes = await new Promise((resolve, reject) => {
    db.all('SELECT * FROM member_types', (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
  res.set('Content-Type', 'application/json');

  try {
    await new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        if (type === 'consume') {
          // 获取会员信息、会员类型和积分等级
          db.get(`
            SELECT 
              m.*, 
              pl.discount,
              mtr.remaining_times,
              mt.type as member_type,
              mt.duration_days
            FROM members m
            LEFT JOIN (
              SELECT pl1.*
              FROM point_levels pl1
              LEFT JOIN point_levels pl2 ON pl1.min_points < pl2.min_points AND pl2.min_points <= (
                SELECT points FROM members WHERE id = ?
              )
              WHERE pl2.id IS NULL AND pl1.min_points <= (
                SELECT points FROM members WHERE id = ?
              )
            ) pl ON 1=1
            LEFT JOIN member_type_relations mtr ON m.id = mtr.member_id AND mtr.type_id = ?
            LEFT JOIN member_types mt ON mtr.type_id = mt.id
            WHERE m.id = ?
          `, [member_id, member_id, member_type_id || null, member_id], (err, row) => {
            if (err || !row) {
              db.run('ROLLBACK');
              res.status(400).json({ error: err ? err.message : '会员不存在', code: 400 });
              return;
            }

            // 验证会员类型有效期
            if (member_type_id && row.duration_days) {
              const memberTypeCreatedAt = new Date(row.created_at);
              const now = new Date();
              const daysDiff = Math.floor((now - memberTypeCreatedAt) / (1000 * 60 * 60 * 24));
              
              if (daysDiff > row.duration_days) {
                db.run('ROLLBACK');
                res.status(400).json({ error: '会员类型已过期' });
                return;
              }
            }

            // 计算折扣后金额
            const discount = row.discount || 1;
            const discountedAmount = parseFloat((amount * discount).toFixed(2));

            // 如果是次卡消费
            if (member_type_id && row.member_type === 'times') {
              if (!row.remaining_times || row.remaining_times <= 0) {
                db.run('ROLLBACK');
                res.status(400).json({ error: '次数已用完' });
                return;
              }

              // 更新剩余次数
              db.run('UPDATE member_type_relations SET remaining_times = remaining_times - 1 WHERE member_id = ? AND type_id = ?',
                [member_id, member_type_id],
                (err) => {
                  if (err) {
                    db.run('ROLLBACK');
                    res.status(400).json({ error: err.message });
                    return;
                  }

                  // 添加消费记录
                  db.run(
                    'INSERT INTO transactions (member_id, type, amount, description) VALUES (?, ?, ?, ?)',
                    [member_id, 'consume', 0, description + ' (次卡消费)'],
                    function(err) {
                      if (err) {
                        db.run('ROLLBACK');
                        res.status(400).json({ error: err.message });
                        return;
                      }
                      db.run('COMMIT');
                      res.json({ id: this.lastID, member_id, type, amount: 0, description });
                    }
                  );
                }
              );
              return;
            }

            // 储值卡消费逻辑
            const balance = parseFloat(row.balance) || 0;
            const bonusBalance = parseFloat(row.bonus_balance) || 0;
            const totalBalance = balance + bonusBalance;

            if (totalBalance < discountedAmount) {
              db.run('ROLLBACK');
              res.status(400).json({ error: '余额不足' });
              return;
            }

            const bonusToUse = Math.min(bonusBalance, discountedAmount);
            const balanceToUse = discountedAmount - bonusToUse;

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

                db.run(
                  'INSERT INTO transactions (member_id, type, amount, description) VALUES (?, ?, ?, ?)',
                  [member_id, type, discountedAmount, `${description} (原价:${amount}, 折扣:${discount})`],
                  function(err) {
                    if (err) {
                      db.run('ROLLBACK');
                      res.status(400).json({ error: err.message });
                      return;
                    }
                    db.run('COMMIT');
                    res.json({ id: this.lastID, member_id, type, amount: discountedAmount, description });
                  }
                );
              }
            );
          });
        } else if (type === 'recharge') {
          // 根据会员类型处理充值
          const memberType = memberTypes.find(t => t.id === member_type_id);
          if (!memberType) {
            db.run('ROLLBACK');
            res.status(400).json({ error: '无效的会员类型' });
            return;
          }

          if (memberType.type === 'times') {
            // 次卡充值逻辑
            if (!req.body.times || req.body.times <= 0) {
              db.run('ROLLBACK');
              res.status(400).json({ error: '请输入有效的充值次数' });
              return;
            }
            db.run('INSERT OR REPLACE INTO member_type_relations (member_id, type_id, remaining_times) VALUES (?, ?, COALESCE((SELECT remaining_times FROM member_type_relations WHERE member_id = ? AND type_id = ?), 0) + ?)',
              [member_id, member_type_id, member_id, member_type_id, req.body.times],
              function(err) {
                if (err) {
                  db.run('ROLLBACK');
                  res.status(400).json({ error: err.message });
                  return;
                }
                db.run(
                  'INSERT INTO transactions (member_id, type, amount, description) VALUES (?, ?, ?, ?)',
                  [member_id, type, amount, `${description} (剩余次数:${amount})`],
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
          } else if (memberType.type === 'stored') {
            // 储值会员充值逻辑
            db.run('UPDATE members SET balance = balance + ?, points = points + ? WHERE id = ?',
              [amount, Math.floor(amount * 10), member_id],
              function(err) {
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
              }
            );
          } else {
            // 其他类型会员充值逻辑
            const durationDays = req.body.duration_days || memberType.duration_days;
            db.run('UPDATE members SET points = points + ? WHERE id = ?',
              [Math.floor(amount * 10), member_id],
              function(err) {
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
              }
            );
          }
        } else {
          // 赠费充值
          db.run('UPDATE members SET bonus_balance = bonus_balance + ? WHERE id = ?',
            [amount, member_id],
            function(err) {
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
            }
          );
        }
      });
    });
  } catch (err) {
    console.error('处理交易错误:', err);
    res.status(500).json({ error: '服务器内部错误', code: 500 });
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

// 获取月度报表
app.get('/api/monthly-report', authenticateToken, (req, res) => {
  const { month } = req.query;
  if (!month) {
    res.status(400).json({ error: '请提供月份参数' });
    return;
  }

  const startDate = new Date(month + '-01');
  const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0, 23, 59, 59);

  db.get(`
    SELECT
      COALESCE(SUM(CASE WHEN type = 'recharge' THEN amount ELSE 0 END), 0) as totalRecharge,
      COALESCE(SUM(CASE WHEN type = 'bonus' THEN amount ELSE 0 END), 0) as totalBonus,
      COALESCE(SUM(CASE WHEN type = 'consume' THEN amount ELSE 0 END), 0) as totalConsume,
      (SELECT COUNT(*) FROM members) as totalMembers,
      (SELECT COUNT(*) FROM members WHERE balance + bonus_balance > 0) as validMembers
    FROM transactions
    WHERE created_at BETWEEN ? AND ?
  `, [startDate.toISOString(), endDate.toISOString()], (err, row) => {
    if (err) {
      res.status(500).json({ error: '获取月度报表失败' });
      return;
    }
    
    const result = {
      ...row,
      totalRechargeWithBonus: row.totalRecharge + row.totalBonus
    };
    res.json(result);
  });
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

// 会员类型管理API
app.get('/api/member-types', authenticateToken, (req, res) => {
  res.set('Content-Type', 'application/json');
  db.all('SELECT * FROM member_types', [], (err, rows) => {
    if (err) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// 更新会员类型
app.put('/api/member-types/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { name, type, duration_days, total_times, price, description } = req.body;
  res.set('Content-Type', 'application/json');

  db.run(
    'UPDATE member_types SET name = ?, type = ?, duration_days = ?, total_times = ?, price = ?, description = ? WHERE id = ?',
    [name, type, duration_days, total_times, price, description, id],
    function(err) {
      if (err) {
        res.status(400).json({ error: err.message });
        return;
      }
      res.json({ message: '会员类型更新成功' });
    }
  );
});

app.post('/api/member-types', authenticateToken, (req, res) => {
  const { name, type, duration_days, total_times, price, description } = req.body;
  res.set('Content-Type', 'application/json');

  db.run(
    'INSERT INTO member_types (name, type, duration_days, total_times, price, description) VALUES (?, ?, ?, ?, ?, ?)',
    [name, type, duration_days, total_times, price, description],
    function(err) {
      if (err) {
        res.status(400).json({ error: err.message });
        return;
      }
      res.json({ id: this.lastID, name, type, duration_days, total_times, price, description });
    }
  );
});

// 积分等级管理API
app.get('/api/point-levels', authenticateToken, (req, res) => {
  res.set('Content-Type', 'application/json');
  db.all('SELECT * FROM point_levels ORDER BY min_points', [], (err, rows) => {
    if (err) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// 更新积分等级
app.put('/api/point-levels/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { name, min_points, max_points, discount } = req.body;
  res.set('Content-Type', 'application/json');

  db.run(
    'UPDATE point_levels SET name = ?, min_points = ?, max_points = ?, discount = ? WHERE id = ?',
    [name, min_points, max_points, discount, id],
    function(err) {
      if (err) {
        res.status(400).json({ error: err.message });
        return;
      }
      res.json({ message: '积分等级更新成功' });
    }
  );
});

app.post('/api/point-levels', authenticateToken, (req, res) => {
  const { name, min_points, max_points, discount } = req.body;
  res.set('Content-Type', 'application/json');

  db.run(
    'INSERT INTO point_levels (name, min_points, max_points, discount) VALUES (?, ?, ?, ?)',
    [name, min_points, max_points, discount],
    function(err) {
      if (err) {
        res.status(400).json({ error: err.message });
        return;
      }
      res.json({ id: this.lastID, name, min_points, max_points, discount });
    }
  );
});

// 删除会员API
app.delete('/api/members/:id', async (req, res) => {
  const { id } = req.params;
  res.set('Content-Type', 'application/json');

  try {
    await new Promise((resolve, reject) => {
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
              res.status(400).json({ error: err.message, code: 400 });
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
  } catch (err) {
    console.error('处理交易错误:', err);
    res.status(500).json({ error: '服务器内部错误', code: 500 });
  }
});

// 月度报表API
app.get('/api/reports/monthly/:year/:month', async (req, res) => {
  const { year, month } = req.params;
  res.set('Content-Type', 'application/json');

  // 计算月份的开始和结束日期
  const startDate = `${year}-${month.padStart(2, '0')}-01`;
  const endDate = `${year}-${month.padStart(2, '0')}-${new Date(year, month, 0).getDate()}`;

  try {
    await new Promise((resolve, reject) => {
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
  } catch (err) {
    console.error('处理交易错误:', err);
    res.status(500).json({ error: '服务器内部错误', code: 500 });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});