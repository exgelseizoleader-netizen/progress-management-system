import React, { useState, useEffect } from 'react';

// ロットNoからDate型へのパース関数
function parseLotNoToDate(lotNo) {
  if (!lotNo) return null;
  const clean = String(lotNo).trim()
    .replace(/月/g, '-')
    .replace(/日/g, '')
    .replace(/\//g, '-');
  
  // YYYY-MM-DD
  let match = clean.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) {
    return new Date(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10));
  }
  
  // M-D または MM-DD
  match = clean.match(/^(\d{1,2})-(\d{1,2})$/);
  if (match) {
    const currentYear = new Date().getFullYear();
    return new Date(currentYear, parseInt(match[1], 10) - 1, parseInt(match[2], 10));
  }

  const parsed = Date.parse(clean);
  if (!isNaN(parsed)) {
    return new Date(parsed);
  }
  return null;
}

// 基準日と工程から予定日を計算する
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

// 日付オブジェクトを YYYY-MM-DD 文字列に変換
function formatDateToString(date) {
  if (!date) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// 特殊ライン (0, 7, 9, 10) の除外判定関数
function isExcludedLine(destination) {
  if (!destination) return true;
  const cleanDest = String(destination).trim();
  const match = cleanDest.match(/^(\d+)/);
  if (match) {
    const num = parseInt(match[1], 10);
    return [0, 7, 9, 10].includes(num);
  }
  return false;
}

export default function Dashboard() {
  const [selectedDateStr, setSelectedDateStr] = useState(formatDateToString(new Date()));
  const [searchQuery, setSearchQuery] = useState('');
  
  const [allPlans, setAllPlans] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({});
  const [assemblyLineStats, setAssemblyLineStats] = useState({}); // 組立工程の払出先別進捗

  const processes = ['裁断', '準備', '組立', '縫製', '検査', '包装'];

  // 初期データおよびプラン一覧の取得
  const fetchAllPlans = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/plans');
      if (response.ok) {
        const data = await response.json();
        setAllPlans(data);
      }
    } catch (err) {
      console.error('Failed to fetch plans:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllPlans();
  }, []);

  // 選択日ごとの工程進捗集計 (stats & 組立ライン別進捗) を計算
  useEffect(() => {
    const newStats = {};
    processes.forEach(proc => {
      newStats[proc] = { total: 0, completed: 0 };
    });

    const newAssemblyLines = {}; // { '1ライン': { total: 0, completed: 0 }, ... }

    allPlans.forEach(plan => {
      const baseDate = parseLotNoToDate(plan.lot_no);
      if (!baseDate) return;

      // 1. 全工程の集計
      processes.forEach(proc => {
        const plannedDate = getPlannedDate(baseDate, proc);
        const plannedDateStr = formatDateToString(plannedDate);

        if (plannedDateStr === selectedDateStr) {
          newStats[proc].total += 1;
          if (plan.progress?.[proc] === '完了') {
            newStats[proc].completed += 1;
          }

          // 2. 組立工程における払出先（ライン）別の集計（0, 7, 9, 10 ラインは除外）
          if (proc === '組立') {
            const dest = plan.destination;
            if (dest && !isExcludedLine(dest)) {
              if (!newAssemblyLines[dest]) {
                newAssemblyLines[dest] = { total: 0, completed: 0 };
              }
              newAssemblyLines[dest].total += 1;
              if (plan.progress?.['組立'] === '完了') {
                newAssemblyLines[dest].completed += 1;
              }
            }
          }
        }
      });
    });

    setStats(newStats);
    setAssemblyLineStats(newAssemblyLines);
  }, [allPlans, selectedDateStr]);

  // 検索クエリに基づいてプランをフィルタリング（空のときは結果なし）
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = allPlans.filter(plan => 
      plan.plan_id.toLowerCase().includes(query) ||
      plan.lot_no.toLowerCase().includes(query) ||
      plan.product_code.toLowerCase().includes(query)
    );
    setSearchResults(filtered);
  }, [searchQuery, allPlans]);

  return (
    <div className="space-y-6">
      
      {/* 上部：日付選択と全工程進捗サマリー */}
      <div className="bg-white p-6 rounded-md shadow-sm border border-gray-200">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 pb-2 border-b border-gray-200 gap-4">
          <h2 className="text-xl font-bold text-gray-800">【画面2】工程進捗ダッシュボード</h2>
          
          <div className="flex items-center gap-3">
            <label htmlFor="workingDaySelector" className="text-base font-bold text-gray-700">予定日（稼働日）選択:</label>
            <input
              id="workingDaySelector"
              type="date"
              value={selectedDateStr}
              onChange={(e) => setSelectedDateStr(e.target.value)}
              className="px-4 py-2 border-2 border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-500 focus:border-slate-500 text-base font-bold"
            />
          </div>
        </div>

        {/* 工程ごとの完了率表示 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
          {processes.map(proc => {
            const { total, completed } = stats[proc] || { total: 0, completed: 0 };
            const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
            
            return (
              <div key={proc} className="bg-gray-50 p-4 rounded border border-gray-200 flex flex-col justify-between min-h-[120px]">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-base font-black text-gray-700">{proc}</span>
                    <span className="text-xs text-gray-500 font-bold">（予定数: {total}）</span>
                  </div>
                  <div className="text-2xl font-black text-slate-800 mb-2">
                    {completed} <span className="text-xs text-gray-500 font-bold">/ {total} 件完了</span>
                  </div>
                </div>
                
                {/* プログレスバー */}
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div 
                    className="bg-slate-700 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${rate}%` }}
                  ></div>
                </div>
                <div className="text-right text-xs text-slate-700 font-black mt-1">
                  {rate}%
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 中部：組立工程 払出先（ライン）別進捗 */}
      <div className="bg-white p-6 rounded-md shadow-sm border border-gray-200">
        <h3 className="text-base font-bold text-gray-800 mb-4 pb-2 border-b border-gray-100 flex items-center justify-between">
          <span>組立工程 払出先（ライン）別進捗 （※ 0, 7, 9, 10ライン除く）</span>
          <span className="text-xs font-normal text-gray-500">選択中の稼働日: {selectedDateStr}</span>
        </h3>

        {Object.keys(assemblyLineStats).length === 0 ? (
          <div className="py-6 text-center text-sm text-gray-400">
            選択された稼働日に「組立」工程が予定されている計画はありません。
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(assemblyLineStats).map(([dest, lineStat]) => {
              const rate = lineStat.total > 0 ? Math.round((lineStat.completed / lineStat.total) * 100) : 0;
              return (
                <div key={dest} className="bg-slate-50 p-4 border border-slate-200 rounded flex flex-col justify-between min-h-[100px]">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-base font-bold text-slate-800">{dest}</span>
                    <span className="text-xs font-bold text-gray-500">（組立数: {lineStat.total}）</span>
                  </div>
                  <div className="text-xl font-extrabold text-slate-700 mb-2">
                    {lineStat.completed} / {lineStat.total} <span className="text-xs font-normal text-gray-500">件組立完了</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-green-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${rate}%` }}
                    ></div>
                  </div>
                  <div className="text-right text-xs font-bold text-slate-600 mt-1">
                    {rate}%
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 下部：検索窓と進捗確認テーブル */}
      <div className="bg-white p-6 rounded-md shadow-sm border border-gray-200">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <h3 className="text-lg font-bold text-gray-800">生産指示 進捗検索・追跡</h3>
          
          <div className="w-full md:w-96">
            <input
              type="text"
              placeholder="指示No、ロット、品番を入力して検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-500 focus:border-slate-500 text-base"
            />
          </div>
        </div>

        {/* 検索結果テーブル */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 font-bold text-gray-700">指示No</th>
                <th className="px-4 py-3 font-bold text-gray-700">ロット</th>
                <th className="px-4 py-3 font-bold text-gray-700">品番</th>
                <th className="px-4 py-3 font-bold text-gray-700">製品名</th>
                <th className="px-4 py-3 font-bold text-gray-700 text-right">指示数</th>
                <th className="px-4 py-3 font-bold text-gray-700">払出先</th>
                <th className="px-4 py-3 font-bold text-gray-700 text-center w-96">工程進捗ステータス</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-4 py-12 text-center text-gray-500">
                    データを取得中...
                  </td>
                </tr>
              ) : searchQuery.trim() === '' ? (
                <tr>
                  <td colSpan="7" className="px-4 py-16 text-center text-slate-400 font-bold text-base">
                    上の検索窓に指示No、ロット、または品番を入力して検索してください。<br />
                    <span className="text-xs font-normal text-gray-400">※パフォーマンス保護のため、初期状態では全データは表示されません。</span>
                  </td>
                </tr>
              ) : searchResults.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-4 py-12 text-center text-red-500 font-bold">
                    該当する生産指示データが見つかりません。
                  </td>
                </tr>
              ) : (
                searchResults.map(plan => {
                  // 進捗率の計算
                  const completedCount = processes.filter(proc => plan.progress?.[proc] === '完了').length;
                  const progressPercent = Math.round((completedCount / processes.length) * 100);

                  return (
                    <tr key={plan.plan_id} className="hover:bg-gray-50 transition-colors duration-75">
                      <td className="px-4 py-4 font-mono font-bold text-slate-800">{plan.plan_id}</td>
                      <td className="px-4 py-4 font-bold text-gray-900">{plan.lot_no}</td>
                      <td className="px-4 py-4 font-mono text-gray-700">{plan.product_code}</td>
                      <td className="px-4 py-4 text-gray-800">{plan.product_name}</td>
                      <td className="px-4 py-4 text-right font-mono font-bold">{plan.quantity.toLocaleString()}</td>
                      <td className="px-4 py-4 text-gray-800 font-bold">{plan.destination}</td>
                      <td className="px-4 py-4">
                        {/* 6工程ステップ表示UI ＆ 進捗率テキスト */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs w-full">
                            {processes.map((proc, index) => {
                              const status = plan.progress?.[proc];
                              let bgColor = 'bg-gray-100 text-gray-400 border-gray-200';
                              if (status === '完了') {
                                bgColor = 'bg-green-100 text-green-800 border-green-300 font-bold';
                              } else if (status === '作業中') {
                                bgColor = 'bg-yellow-100 text-yellow-800 border-yellow-300 font-bold';
                              }

                              return (
                                <React.Fragment key={proc}>
                                  <div 
                                    className={`flex flex-col items-center justify-center px-2 py-1.5 border rounded text-center min-w-[50px] ${bgColor}`}
                                    title={`${proc}: ${status || '未着手'}`}
                                  >
                                    <span>{proc}</span>
                                  </div>
                                  {index < processes.length - 1 && (
                                    <div className="h-0.5 flex-1 bg-gray-200 mx-1"></div>
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </div>
                          <div className="text-right text-xs text-slate-700 font-bold">
                            進捗率: <span className="text-slate-900 font-black text-sm">{completedCount} / 6</span> 工程完了 ({progressPercent}%)
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      
    </div>
  );
}
