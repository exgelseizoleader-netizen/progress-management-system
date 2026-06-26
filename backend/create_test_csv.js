const fs = require('fs');
const path = require('path');
const iconv = require('iconv-lite');

const csvDir = path.join(__dirname, 'csv_input');
if (!fs.existsSync(csvDir)) {
  fs.mkdirSync(csvDir, { recursive: true });
}

// テストデータ定義 (指示No, 生産指示日, 品番, 製品名, 生産指示数, ロットNO, 払出先)
const csvContent = 
`指示No,生産指示日,品番,製品名,生産指示数,ロットNO,払出先
PP-2026-0001,2026-06-20,A-101,特殊防護カバー,150,6-19,1
PP-2026-0002,2026-06-20,B-202,高耐久シート,300,6-20,2ライン
PP-2026-0003,2026-06-20,C-303,耐熱ベルト,50,6-18,Aエリア
PP-2026-0004,2026-06-20,D-404,防水バッグ,500,6-21,3
`;

// 1. UTF-8 版の保存 (BOMなし)
fs.writeFileSync(path.join(csvDir, 'test_plans_utf8.csv'), csvContent, 'utf8');
console.log('Created UTF-8 CSV: test_plans_utf8.csv');

// 2. Shift-JIS 版の保存 (CP932デコード検証用)
const sjisBuffer = iconv.encode(csvContent, 'cp932');
fs.writeFileSync(path.join(csvDir, 'test_plans_sjis.csv'), sjisBuffer);
console.log('Created Shift-JIS (CP932) CSV: test_plans_sjis.csv');
