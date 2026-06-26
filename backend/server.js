const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const csv = require('csv-parser');
const iconv = require('iconv-lite');
require('dotenv').config();

const dbHelper = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

// CSVスキャンフォルダの取得
const CSV_INPUT_DIR = process.env.CSV_INPUT_DIR || path.join(__dirname, 'csv_input');

// スキャンフォルダが存在しない場合は作成
if (!fs.existsSync(CSV_INPUT_DIR)) {
  fs.mkdirSync(CSV_INPUT_DIR, { recursive: true });
  console.log('Created CSV scan directory at:', CSV_INPUT_DIR);
}

app.use(cors());
app.use(express.json());

// アップロード先の一時フォルダ設定
const upload = multer({ dest: path.join(__dirname, 'uploads/') });

// 一時アップロードフォルダのクリーンアップ
if (!fs.existsSync(path.join(__dirname, 'uploads/'))) {
  fs.mkdirSync(path.join(__dirname, 'uploads/'));
}

// ----------------------------------------------------
// CSVパース・バリデーション用ヘルパー関数
// ----------------------------------------------------

// 文字コード判定とデコード
function decodeBuffer(buffer) {
  // UTF-8 BOM のチェック (\xEF\xBB\xBF)
  if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
    return buffer.toString('utf8', 3);
  }
  
  // UTF-8として正しくデコードできるか判定する
  const utf8String = buffer.toString('utf8');
  const reconstructedBuffer = Buffer.from(utf8String, 'utf8');
  
  if (buffer.equals(reconstructedBuffer)) {
    return utf8String;
  } else {
    // 異なっていればShift-JIS (cp932) としてデコード
    return iconv.decode(buffer, 'cp932');
  }
}

// CSV文字列の解析
function parseCSV(text) {
  return new Promise((resolve, reject) => {
    const results = [];
    const stream = Readable.from([text]);
    stream
      .pipe(csv())
      .on('data', (row) => {
        // キーと値のトリム処理
        const cleanRow = {};
        for (const key in row) {
          const cleanKey = key.trim();
          const cleanValue = row[key] ? row[key].trim() : '';
          cleanRow[cleanKey] = cleanValue;
        }
        results.push(cleanRow);
      })
      .on('end', () => resolve(results))
      .on('error', (err) => reject(err));
  });
}

// バリデーションとデータベース書き込み
async function importCSVData(rows) {
  if (rows.length === 0) {
    throw new Error('CSVファイルが空です。');
  }

  // 必須列のチェック
  const requiredColumns = ['指示No', '生産指示日', '品番', '製品名', '生産指示数', 'ロットNO', '払出先'];
  const headers = Object.keys(rows[0]);
  const missingColumns = requiredColumns.filter(col => !headers.includes(col));

  if (missingColumns.length > 0) {
    throw new Error(`必須列が不足しています: ${missingColumns.join(', ')}`);
  }

  let successCount = 0;
  for (const row of rows) {
    let destination = row['払出先'];
    // 払出先が数字単体の場合、「〇ライン」に自動補完
    if (/^\d+$/.test(destination)) {
      destination = destination + 'ライン';
    }

    const plan = {
      plan_id: row['指示No'],
      instruction_date: row['生産指示日'],
      product_code: row['品番'],
      product_name: row['製品名'],
      quantity: parseInt(row['生産指示数'], 10) || 0,
      lot_no: row['ロットNO'],
      destination: destination
    };

    await dbHelper.upsertProductionPlan(plan);
    successCount++;
  }

  return successCount;
}

// ----------------------------------------------------
// APIエンドポイントの実装
// ----------------------------------------------------

// 1. 指示Noの確認用（進捗入力画面で打ち込み時に呼び出し）
app.get('/api/plans/:plan_id', async (req, res) => {
  try {
    const plan = await dbHelper.getPlanWithProgress(req.params.plan_id);
    if (!plan) {
      return res.status(404).json({ error: '指定された指示Noが見つかりません。' });
    }
    res.json(plan);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'データベースエラーが発生しました。' });
  }
});

// 2. 進捗状況の更新（画面1：進捗入力画面用）
app.post('/api/progress', async (req, res) => {
  const { plan_id, process, status } = req.body;
  if (!plan_id || !process || !status) {
    return res.status(400).json({ error: '指示No、工程、および状態は必須入力です。' });
  }

  const validProcesses = ['裁断', '準備', '組立', '縫製', '検査', '包装'];
  const validStatuses = ['作業中', '完了'];

  if (!validProcesses.includes(process)) {
    return res.status(400).json({ error: `無効な工程です。次のいずれかを選択してください: ${validProcesses.join(', ')}` });
  }
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `無効な状態です。作業中 または 完了 を選択してください。` });
  }

  try {
    // 指示Noが実在するかチェック
    const plan = await dbHelper.getPlanById(plan_id);
    if (!plan) {
      return res.status(404).json({ error: '指定された指示Noは登録されていません。先にCSVから登録してください。' });
    }

    await dbHelper.upsertProgress(plan_id, process, status);
    res.json({ message: '進捗情報を更新しました。' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '進捗情報の更新に失敗しました。' });
  }
});

// 3. 指示No、ロット、品番による検索API（画面2：ダッシュボード検索用）
app.get('/api/plans/search', async (req, res) => {
  const { query } = req.query;
  try {
    const results = await dbHelper.searchPlans(query || '');
    res.json(results);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '検索中にエラーが発生しました。' });
  }
});

// 4. すべての生産指示の進捗状況を含む一覧取得
app.get('/api/plans', async (req, res) => {
  try {
    const plans = await dbHelper.getAllPlansWithProgress();
    res.json(plans);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'データ取得中にエラーが発生しました。' });
  }
});

// 5. ドラッグ＆ドロップされたCSVのアップロードインポート
app.post('/api/import-csv', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'ファイルがアップロードされていません。' });
  }

  const filePath = req.file.path;
  try {
    const buffer = fs.readFileSync(filePath);
    const decodedText = decodeBuffer(buffer);
    const rows = await parseCSV(decodedText);
    const importedCount = await importCSVData(rows);

    // 一時ファイルのクリーンアップ
    fs.unlinkSync(filePath);

    res.json({ message: `CSVインポート成功。${importedCount}件の生産指示を登録・更新しました。` });
  } catch (error) {
    console.error(error);
    // エラー時も一時ファイルを削除
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    res.status(500).json({ error: `インポートエラー: ${error.message}` });
  }
});

// 6. サーバー上の指定フォルダをスキャンしてCSVインポート
app.post('/api/scan-csv', async (req, res) => {
  try {
    if (!fs.existsSync(CSV_INPUT_DIR)) {
      return res.status(400).json({ error: `指定フォルダが存在しません: ${CSV_INPUT_DIR}` });
    }

    const files = fs.readdirSync(CSV_INPUT_DIR);
    const csvFiles = files.filter(file => path.extname(file).toLowerCase() === '.csv');

    if (csvFiles.length === 0) {
      return res.json({ message: 'スキャン対象のCSVファイルが見つかりませんでした。', processedFiles: [] });
    }

    const processedFiles = [];
    let totalImported = 0;

    for (const file of csvFiles) {
      const filePath = path.join(CSV_INPUT_DIR, file);
      try {
        const buffer = fs.readFileSync(filePath);
        const decodedText = decodeBuffer(buffer);
        const rows = await parseCSV(decodedText);
        const importedCount = await importCSVData(rows);

        totalImported += importedCount;

        // インポート成功後、ファイルをリネームして片付ける (例: example.csv -> example.csv.processed)
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const newPath = path.join(CSV_INPUT_DIR, `${file}.processed_${timestamp}`);
        fs.renameSync(filePath, newPath);

        processedFiles.push({ file, status: 'success', count: importedCount });
      } catch (fileError) {
        console.error(`Error processing file ${file}:`, fileError.message);
        // エラー時はファイル名に .error を付与
        const newPath = path.join(CSV_INPUT_DIR, `${file}.error`);
        if (fs.existsSync(filePath)) {
          fs.renameSync(filePath, newPath);
        }
        processedFiles.push({ file, status: 'error', error: fileError.message });
      }
    }

    res.json({
      message: `スキャン処理完了。合計 ${totalImported} 件のデータをインポートしました。`,
      processedFiles
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: `フォルダスキャンエラー: ${error.message}` });
  }
});

// 8. ログイン認証API (管理者/作業者)
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'admin123') {
    return res.json({ success: true, username: 'admin', role: 'admin', token: 'mock-admin-token' });
  } else if (username === 'worker' && password === 'worker123') {
    return res.json({ success: true, username: 'worker', role: 'worker', token: 'mock-worker-token' });
  } else {
    return res.status(401).json({ error: 'ユーザー名またはパスワードが正しくありません。' });
  }
});

// 日付パース・計算用ヘルパー（エクスポート絞り込み用）
function parseLotNoToDate(lotNo) {
  if (!lotNo) return null;
  const clean = String(lotNo).trim()
    .replace(/月/g, '-')
    .replace(/日/g, '')
    .replace(/\//g, '-');
  let match = clean.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) {
    return new Date(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10));
  }
  match = clean.match(/^(\d{1,2})-(\d{1,2})$/);
  if (match) {
    const currentYear = new Date().getFullYear();
    return new Date(currentYear, parseInt(match[1], 10) - 1, parseInt(match[2], 10));
  }
  const parsed = Date.parse(clean);
  if (!isNaN(parsed)) return new Date(parsed);
  return null;
}

function getPlannedDate(baseDate, process) {
  if (!baseDate) return null;
  const date = new Date(baseDate.getTime());
  if (process === '裁断') {
    date.setDate(date.getDate() - 3);
  } else if (process === '準備') {
    date.setDate(date.getDate() - 2);
  } else if (process === '組立') {
    // 当日
  } else if (process === '縫製') {
    date.setDate(date.getDate() + 1);
  } else if (process === '検査') {
    date.setDate(date.getDate() + 2);
  } else if (process === '包装') {
    date.setDate(date.getDate() + 2);
  }
  return date;
}

function formatDateToMD(lotNo) {
  const date = parseLotNoToDate(lotNo);
  if (date) {
    return `${date.getMonth() + 1}-${date.getDate()}`;
  }
  return lotNo;
}

function formatDateToString(date) {
  if (!date) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// 7. 実績データのフィルタリング検索とCSVエクスポート（UTF-8-SIG形式）
app.get('/api/export-results', async (req, res) => {
  const { lot_no, process, status, update_date, planned_date } = req.query;

  try {
    // DBから実績更新日等で絞り込んだデータを取得
    let data = await dbHelper.getExportData(lot_no, process, status, update_date);

    // 稼働日/予定日 (planned_date: YYYY-MM-DD) が指定されている場合はメモリ上で絞り込み
    if (planned_date) {
      data = data.filter(item => {
        const baseDate = parseLotNoToDate(item.lot_no);
        if (!baseDate) return false;
        const proc = item.process || '組立'; // 進捗未登録の場合は組立工程の予定日で判定
        const planned = getPlannedDate(baseDate, proc);
        return formatDateToString(planned) === planned_date;
      });
    }

    // CSV文字列の組み立て
    const headers = ['指示No', '生産指示日', '品番', '製品名', '生産指示数', 'ロットNO', '払出先', '実績工程', '実績状態', '実績更新日時'];
    const rows = data.map(item => [
      item.plan_id,
      item.instruction_date,
      item.product_code,
      item.product_name,
      item.quantity,
      formatDateToMD(item.lot_no), // ロットNoを「6-19」形式に正規化して出力
      item.destination,
      item.process || '未着手',
      item.status || '未着手',
      item.updated_at || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(val => {
        const strVal = String(val);
        if (strVal.includes(',') || strVal.includes('\n') || strVal.includes('"')) {
          return `"${strVal.replace(/"/g, '""')}"`;
        }
        return strVal;
      }).join(','))
    ].join('\r\n');

    // UTF-8-SIG (BOM付き) バッファの生成
    const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
    const csvBuffer = Buffer.concat([bom, Buffer.from(csvContent, 'utf8')]);

    // ファイル名（ダウンロード用）
    const filename = `progress_export_${new Date().toISOString().slice(0,10)}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvBuffer);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'CSVエクスポートに失敗しました。' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`CSV scan path is configured to: ${CSV_INPUT_DIR}`);
});
