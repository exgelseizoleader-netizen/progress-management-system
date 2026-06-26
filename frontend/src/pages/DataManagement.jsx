import React, { useState } from 'react';

export default function DataManagement() {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  
  const [scanResults, setScanResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // エクスポート用フィルターの状態
  const [filterLotNo, setFilterLotNo] = useState('');
  const [filterProcess, setFilterProcess] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterUpdateDate, setFilterUpdateDate] = useState('');  // 実績更新日
  const [filterPlannedDate, setFilterPlannedDate] = useState(''); // 稼働日/予定日

  const processes = ['裁断', '準備', '組立', '縫製', '検査', '包装'];
  const statuses = ['作業中', '完了'];

  // ドラッグ＆ドロップ関連イベント
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.name.toLowerCase().endsWith('.csv')) {
        setSelectedFile(file);
        setErrorMsg('');
      } else {
        setErrorMsg('CSVファイルのみ選択してください。');
      }
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.name.toLowerCase().endsWith('.csv')) {
        setSelectedFile(file);
        setErrorMsg('');
      } else {
        setErrorMsg('CSVファイルのみ選択してください。');
      }
    }
  };

  // ドラッグ＆ドロップによるインポート実行
  const handleImportSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setErrorMsg('ファイルが選択されていません。');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    setScanResults(null);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await fetch('/api/import-csv', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'CSVインポートに失敗しました。');
      }

      setSuccessMsg(result.message);
      setSelectedFile(null);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  // サーバー上の特定フォルダをスキャンする
  const handleScanFolder = async () => {
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    setScanResults(null);

    try {
      const response = await fetch('/api/scan-csv', {
        method: 'POST',
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'フォルダのスキャン処理に失敗しました。');
      }

      setSuccessMsg(result.message);
      setScanResults(result.processedFiles || []);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  // エクスポートAPIの呼び出し（ブラウザでのダウンロード起動）
  const handleExportCSV = () => {
    const params = new URLSearchParams();
    if (filterLotNo.trim()) params.append('lot_no', filterLotNo.trim());
    if (filterProcess) params.append('process', filterProcess);
    if (filterStatus) params.append('status', filterStatus);
    if (filterUpdateDate) params.append('update_date', filterUpdateDate);
    if (filterPlannedDate) params.append('planned_date', filterPlannedDate);

    const downloadUrl = `/api/export-results?${params.toString()}`;
    window.location.href = downloadUrl;
  };

  return (
    <div className="space-y-6">
      
      {/* 上部：データインポート領域 */}
      <div className="bg-white p-6 rounded-md shadow-sm border border-gray-200">
        <h2 className="text-xl font-bold text-gray-800 mb-6 pb-2 border-b border-gray-200">【画面3】データ管理（インポート・エクスポート）</h2>

        {/* メッセージ表示 */}
        {errorMsg && (
          <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm font-medium">
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="mb-4 p-4 bg-green-50 border-l-4 border-green-500 text-green-700 text-sm font-medium">
            {successMsg}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* 左側：ドラッグ＆ドロップ CSV アップロード */}
          <div className="space-y-4">
            <h3 className="text-base font-bold text-gray-800">ドラッグ＆ドロップでCSVインポート</h3>
            
            <form onSubmit={handleImportSubmit} className="space-y-4">
              <div 
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors duration-150 ${
                  dragActive ? 'border-slate-600 bg-slate-50' : 'border-gray-300 bg-gray-50'
                }`}
              >
                <div className="space-y-2">
                  <span className="block text-sm text-gray-600">
                    生産指示CSVファイルをここにドラッグ＆ドロップ
                  </span>
                  <span className="block text-xs text-gray-400">または</span>
                  
                  <label className="inline-block px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-md text-xs font-bold cursor-pointer transition-colors duration-150">
                    ファイルを選択
                    <input 
                      type="file" 
                      accept=".csv"
                      onChange={handleFileChange}
                      className="hidden" 
                    />
                  </label>
                </div>
                
                {selectedFile && (
                  <div className="mt-4 p-2 bg-white border border-gray-200 rounded text-xs font-mono text-slate-700 flex justify-between items-center">
                    <span>選択されたファイル: <strong>{selectedFile.name}</strong> ({Math.round(selectedFile.size / 1024)} KB)</span>
                    <button 
                      type="button" 
                      onClick={() => setSelectedFile(null)}
                      className="text-red-500 hover:text-red-700 font-bold ml-2"
                    >
                      削除
                    </button>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={loading || !selectedFile}
                className={`w-full py-3 text-white font-bold rounded-md text-sm transition-colors duration-150 ${
                  loading || !selectedFile
                    ? 'bg-gray-300 cursor-not-allowed text-gray-500'
                    : 'bg-slate-800 hover:bg-slate-900 shadow-sm'
                }`}
              >
                {loading ? '処理中...' : '選択したCSVをインポートする'}
              </button>
            </form>
          </div>

          {/* 右側：サーバー上フォルダ自動スキャン */}
          <div className="space-y-4 flex flex-col justify-between">
            <div>
              <h3 className="text-base font-bold text-gray-800 mb-2">サーバー内特定フォルダのスキャン</h3>
              <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                サーバー上の所定フォルダ（例：Googleドライブの共有フォルダ等）に配置されたCSVファイルを自動検出してインポートします。<br />
                ※インポートに成功したCSVファイルは、重複読み込みを防ぐためにファイル名の末尾に `.processed_[日時]` が付与されリネームされます。
              </p>
            </div>

            <div className="space-y-4">
              <button
                type="button"
                onClick={handleScanFolder}
                disabled={loading}
                className="w-full py-6 bg-slate-700 hover:bg-slate-800 text-white font-bold rounded-md text-base transition-colors duration-150 shadow-sm flex flex-col items-center justify-center gap-1"
              >
                {loading ? 'スキャン処理中...' : 'サーバー側指定フォルダをスキャンする'}
                <span className="text-xs font-normal opacity-80">（バックエンド側の指定フォルダ内をチェックします）</span>
              </button>
              
              {/* スキャン詳細ログ */}
              {scanResults && (
                <div className="bg-gray-50 p-4 rounded border border-gray-200 text-xs font-mono text-gray-700 max-h-48 overflow-y-auto space-y-1.5">
                  <div className="font-bold text-gray-800 border-b border-gray-200 pb-1 mb-1">スキャン結果ログ:</div>
                  {scanResults.length === 0 ? (
                    <div>新規インポート対象 of CSVファイルはありませんでした。</div>
                  ) : (
                    scanResults.map((res, i) => (
                      <div key={i} className={res.status === 'success' ? 'text-green-700 font-bold' : 'text-red-600'}>
                        ● {res.file} : {res.status === 'success' ? `成功 (${res.count}件登録)` : `失敗 (${res.error})`}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

        </div>

        {/* CSV仕様の注記 */}
        <div className="mt-8 p-4 bg-gray-50 rounded border border-gray-200 text-xs text-gray-600 space-y-1">
          <div className="font-bold text-gray-700">【インポートCSV仕様】</div>
          <div>・文字コード： **UTF-8** または **Shift-JIS (CP932)** に対応しています。</div>
          <div>・トリム処理： 各列名・各値の前後の余分な半角・全角空白は自動で削除（トリム）されます。</div>
          <div>・必須列（7列）： **指示No**, **生産指示日**, **品番**, **製品名**, **生産指示数**, **ロットNO**, **払出先** がすべて含まれている必要があります。</div>
          <div>・払出先の補完： 払出先が「1」や「2」などの数値単体の場合は、自動で「1ライン」「2ライン」のように補完して登録されます。</div>
        </div>
      </div>

      {/* 下部：実績データCSVエクスポート（ダウンロード） */}
      <div className="bg-white p-6 rounded-md shadow-sm border border-gray-200">
        <h3 className="text-lg font-bold text-gray-800 mb-2">過去実績データ（日報用）のCSVエクスポート</h3>
        <p className="text-xs text-gray-500 mb-6">
          登録済みの生産計画と、これまでに登録された進捗実績データ（日付・状態）をフィルタリングして、CSVファイルとして一括ダウンロードします。
        </p>

        {/* フィルターフォーム（カレンダー入力の追加） */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
          <div>
            <label htmlFor="filterLot" className="block text-xs font-bold text-gray-700 mb-1">ロットNo（完全一致）</label>
            <input
              id="filterLot"
              type="text"
              placeholder="例: 6-19"
              value={filterLotNo}
              onChange={(e) => setFilterLotNo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-500 focus:border-slate-500 text-sm font-bold"
            />
          </div>

          <div>
            <label htmlFor="filterProc" className="block text-xs font-bold text-gray-700 mb-1">工程（絞り込み）</label>
            <select
              id="filterProc"
              value={filterProcess}
              onChange={(e) => setFilterProcess(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-500 focus:border-slate-500 text-sm font-bold"
            >
              <option value="">すべての工程</option>
              {processes.map(proc => (
                <option key={proc} value={proc}>{proc}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="filterStat" className="block text-xs font-bold text-gray-700 mb-1">状態（絞り込み）</label>
            <select
              id="filterStat"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-500 focus:border-slate-500 text-sm font-bold"
            >
              <option value="">すべての状態</option>
              <option value="未着手">未着手</option>
              {statuses.map(stat => (
                <option key={stat} value={stat}>{stat}</option>
              ))}
            </select>
          </div>

          {/* 実績更新日（日報） */}
          <div>
            <label htmlFor="filterUpDate" className="block text-xs font-bold text-gray-700 mb-1">実績更新日（日報用）</label>
            <input
              id="filterUpDate"
              type="date"
              value={filterUpdateDate}
              onChange={(e) => setFilterUpdateDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-500 focus:border-slate-500 text-sm font-bold"
            />
          </div>

          {/* 稼働日/予定日 */}
          <div>
            <label htmlFor="filterPlanDate" className="block text-xs font-bold text-gray-700 mb-1">稼働日/予定日（逆算日）</label>
            <input
              id="filterPlanDate"
              type="date"
              value={filterPlannedDate}
              onChange={(e) => setFilterPlannedDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-500 focus:border-slate-500 text-sm font-bold"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3">
          {/* クリアボタン */}
          <button
            type="button"
            onClick={() => {
              setFilterLotNo('');
              setFilterProcess('');
              setFilterStatus('');
              setFilterUpdateDate('');
              setFilterPlannedDate('');
            }}
            className="py-2.5 px-5 border border-gray-300 rounded hover:bg-gray-100 text-sm font-bold text-gray-600 transition-colors duration-150"
          >
            条件クリア
          </button>
          
          <button
            type="button"
            onClick={handleExportCSV}
            className="py-2.5 px-6 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-md text-sm transition-colors duration-150 shadow-sm flex items-center justify-center gap-1.5"
          >
            実績データをCSVダウンロード
          </button>
        </div>

        <div className="text-xs text-gray-500 mt-4">
          ※エクスポートされるCSVファイルは、Excel等のソフトで開いた際の文字化けを防ぐため、**UTF-8-SIG (BOM付きUTF-8)** 形式で出力されます。<br />
          ※ロットNO列の表記は元のデータ形式に関わらず、すべて `6-19` のようなハイフン表記に正規化して出力されます。
        </div>
      </div>
      
    </div>
  );
}
