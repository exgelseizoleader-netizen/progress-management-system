const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Database connection error:', err.message);
  } else {
    console.log('Connected to SQLite database at:', dbPath);
    initializeTables();
  }
});

function initializeTables() {
  db.serialize(() => {
    // 1. 生産指示データテーブル (production_plans)
    db.run(`
      CREATE TABLE IF NOT EXISTS production_plans (
        plan_id TEXT PRIMARY KEY,
        instruction_date TEXT NOT NULL,
        product_code TEXT NOT NULL,
        product_name TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        lot_no TEXT NOT NULL,
        destination TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) {
        console.error('Failed to create production_plans table:', err.message);
      } else {
        console.log('production_plans table is ready.');
      }
    });

    // 2. 進捗実績テーブル (progress_records)
    db.run(`
      CREATE TABLE IF NOT EXISTS progress_records (
        plan_id TEXT NOT NULL,
        process TEXT NOT NULL,
        status TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (plan_id, process),
        FOREIGN KEY (plan_id) REFERENCES production_plans(plan_id) ON DELETE CASCADE
      )
    `, (err) => {
      if (err) {
        console.error('Failed to create progress_records table:', err.message);
      } else {
        console.log('progress_records table is ready.');
      }
    });
  });
}

// データベース操作用ヘルパー関数
module.exports = {
  db,
  
  // 生産指示の登録・更新 (CSVインポート用)
  upsertProductionPlan: (plan) => {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO production_plans (plan_id, instruction_date, product_code, product_name, quantity, lot_no, destination)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(plan_id) DO UPDATE SET
          instruction_date = excluded.instruction_date,
          product_code = excluded.product_code,
          product_name = excluded.product_name,
          quantity = excluded.quantity,
          lot_no = excluded.lot_no,
          destination = excluded.destination
      `;
      db.run(
        sql,
        [plan.plan_id, plan.instruction_date, plan.product_code, plan.product_name, plan.quantity, plan.lot_no, plan.destination],
        function(err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });
  },

  // 生産指示の取得 (指示No指定)
  getPlanById: (planId) => {
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM production_plans WHERE plan_id = ?`;
      db.get(sql, [planId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },

  // 生産指示と各進捗レコードの取得 (指示No指定)
  getPlanWithProgress: (planId) => {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT p.*, r.process, r.status, r.updated_at as record_updated_at
        FROM production_plans p
        LEFT JOIN progress_records r ON p.plan_id = r.plan_id
        WHERE p.plan_id = ?
      `;
      db.all(sql, [planId], (err, rows) => {
        if (err) {
          reject(err);
        } else if (rows.length === 0) {
          resolve(null);
        } else {
          // 進捗レコードを配列に集約
          const plan = {
            plan_id: rows[0].plan_id,
            instruction_date: rows[0].instruction_date,
            product_code: rows[0].product_code,
            product_name: rows[0].product_name,
            quantity: rows[0].quantity,
            lot_no: rows[0].lot_no,
            destination: rows[0].destination,
            progress: {}
          };
          rows.forEach(row => {
            if (row.process) {
              plan.progress[row.process] = {
                status: row.status,
                updated_at: row.record_updated_at
              };
            }
          });
          resolve(plan);
        }
      });
    });
  },

  // 進捗状況の更新
  upsertProgress: (planId, process, status) => {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO progress_records (plan_id, process, status, updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(plan_id, process) DO UPDATE SET
          status = excluded.status,
          updated_at = CURRENT_TIMESTAMP
      `;
      db.run(sql, [planId, process, status], function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
  },

  // ダッシュボード検索用（指示No、ロット、品番）
  searchPlans: (query) => {
    return new Promise((resolve, reject) => {
      const searchVal = `%${query}%`;
      const sql = `
        SELECT p.*, r.process, r.status
        FROM production_plans p
        LEFT JOIN progress_records r ON p.plan_id = r.plan_id
        WHERE p.plan_id LIKE ? OR p.lot_no LIKE ? OR p.product_code LIKE ?
      `;
      db.all(sql, [searchVal, searchVal, searchVal], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          // グループ化して進捗情報をまとめる
          const planMap = {};
          rows.forEach(row => {
            if (!planMap[row.plan_id]) {
              planMap[row.plan_id] = {
                plan_id: row.plan_id,
                instruction_date: row.instruction_date,
                product_code: row.product_code,
                product_name: row.product_name,
                quantity: row.quantity,
                lot_no: row.lot_no,
                destination: row.destination,
                progress: {}
              };
            }
            if (row.process) {
              planMap[row.plan_id].progress[row.process] = row.status;
            }
          });
          resolve(Object.values(planMap));
        }
      });
    });
  },

  // 全ての生産指示を取得 (進捗状況付き)
  getAllPlansWithProgress: () => {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT p.*, r.process, r.status
        FROM production_plans p
        LEFT JOIN progress_records r ON p.plan_id = r.plan_id
      `;
      db.all(sql, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          const planMap = {};
          rows.forEach(row => {
            if (!planMap[row.plan_id]) {
              planMap[row.plan_id] = {
                plan_id: row.plan_id,
                instruction_date: row.instruction_date,
                product_code: row.product_code,
                product_name: row.product_name,
                quantity: row.quantity,
                lot_no: row.lot_no,
                destination: row.destination,
                progress: {}
              };
            }
            if (row.process) {
              planMap[row.plan_id].progress[row.process] = row.status;
            }
          });
          resolve(Object.values(planMap));
        }
      });
    });
  },

  // 過去の実績CSVダウンロード用データの取得
  getExportData: (lotNo, process, status, updateDate) => {
    return new Promise((resolve, reject) => {
      let sql = `
        SELECT p.plan_id, p.instruction_date, p.product_code, p.product_name, p.quantity, p.lot_no, p.destination,
               r.process, r.status, r.updated_at
        FROM production_plans p
        LEFT JOIN progress_records r ON p.plan_id = r.plan_id
        WHERE 1=1
      `;
      const params = [];
      if (lotNo) {
        sql += ` AND p.lot_no = ?`;
        params.push(lotNo);
      }
      if (process) {
        sql += ` AND r.process = ?`;
        params.push(process);
      }
      if (status) {
        sql += ` AND r.status = ?`;
        params.push(status);
      }
      if (updateDate) {
        sql += ` AND date(r.updated_at, 'localtime') = ?`;
        params.push(updateDate);
      }
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
};
