import React, { useState, useEffect } from 'react';
import Login from './pages/Login';
import ProcessSelect from './pages/ProcessSelect';
import ProgressInput from './pages/ProgressInput';
import Dashboard from './pages/Dashboard';
import DataManagement from './pages/DataManagement';

export default function App() {
  const [user, setUser] = useState(null);
  const [selectedProcess, setSelectedProcess] = useState(null); // 作業者向けの固定工程
  const [activeTab, setActiveTab] = useState('dashboard'); // 'input', 'dashboard', 'management'

  // マウント時にローカルストレージからログイン状態を復元
  useEffect(() => {
    const savedUserStr = localStorage.getItem('progress_user');
    const savedProcess = localStorage.getItem('progress_selected_process');
    if (savedUserStr) {
      const savedUser = JSON.parse(savedUserStr);
      setUser(savedUser);
      if (savedUser.role === 'worker') {
        setSelectedProcess(savedProcess || null);
        setActiveTab('input'); // 作業者のデフォルトは進捗入力
      } else {
        setActiveTab('dashboard'); // 管理者のデフォルトはダッシュボード
      }
    }
  }, []);

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    localStorage.setItem('progress_user', JSON.stringify(userData));
    if (userData.role === 'worker') {
      setSelectedProcess(null); // 工程選択画面に進ませるため初期化
      setActiveTab('input');
    } else {
      setSelectedProcess(null);
      setActiveTab('dashboard');
    }
  };

  const handleProcessSelect = (processName) => {
    setSelectedProcess(processName);
    localStorage.setItem('progress_selected_process', processName);
    setActiveTab('input');
  };

  const handleLogout = () => {
    setUser(null);
    setSelectedProcess(null);
    localStorage.removeItem('progress_user');
    localStorage.removeItem('progress_selected_process');
  };

  const handleChangeProcess = () => {
    setSelectedProcess(null);
    localStorage.removeItem('progress_selected_process');
  };

  // 1. 未ログインの場合はログイン画面を表示
  if (!user) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  // 2. 作業者ログインで工程が未選択の場合は工程選択画面を表示
  if (user.role === 'worker' && !selectedProcess) {
    return <ProcessSelect onProcessSelect={handleProcessSelect} onLogout={handleLogout} />;
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col font-sans">
      
      {/* 画面ヘッダー */}
      <header className="bg-slate-800 text-white shadow-md w-full">
        <div className="max-w-full px-6 py-4 flex flex-col lg:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-extrabold tracking-wider border-r border-slate-600 pr-4">
              現場進捗管理システム
            </h1>
            <span className="text-xs text-slate-400 font-mono hidden md:inline">
              Ver 1.1.0 (ロール: {user.role === 'admin' ? '管理者' : '作業者'})
            </span>
          </div>

          {/* メインタブ・ナビゲーション (タブレット向けにタッチエリアを拡張) */}
          <div className="flex flex-wrap items-center gap-4">
            <nav className="flex bg-slate-900 rounded p-1.5 border border-slate-700">
              <button
                onClick={() => setActiveTab('input')}
                className={`px-6 py-2.5 text-base font-bold rounded transition-all duration-150 ${
                  activeTab === 'input'
                    ? 'bg-slate-700 text-white shadow'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                進捗入力
              </button>
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`px-6 py-2.5 text-base font-bold rounded transition-all duration-150 ${
                  activeTab === 'dashboard'
                    ? 'bg-slate-700 text-white shadow'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                ダッシュボード
              </button>
              {user.role === 'admin' && (
                <button
                  onClick={() => setActiveTab('management')}
                  className={`px-6 py-2.5 text-base font-bold rounded transition-all duration-150 ${
                    activeTab === 'management'
                      ? 'bg-slate-700 text-white shadow'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  データ管理
                </button>
              )}
            </nav>

            {/* アクションボタン */}
            <div className="flex gap-2">
              {user.role === 'worker' && (
                <button
                  onClick={handleChangeProcess}
                  className="px-4 py-2.5 bg-slate-600 hover:bg-slate-700 text-white font-bold rounded text-sm transition-colors duration-150 border border-slate-500"
                >
                  工程変更 ({selectedProcess})
                </button>
              )}
              <button
                onClick={handleLogout}
                className="px-4 py-2.5 bg-red-700 hover:bg-red-800 text-white font-bold rounded text-sm transition-colors duration-150"
              >
                ログアウト
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* メインコンテンツ領域 */}
      <main className="flex-1 w-full max-w-full px-6 py-6 overflow-x-auto">
        <div className="w-full">
          {activeTab === 'input' && <ProgressInput lockedProcess={selectedProcess} />}
          {activeTab === 'dashboard' && <Dashboard />}
          {activeTab === 'management' && user.role === 'admin' && <DataManagement />}
        </div>
      </main>

      {/* フッター */}
      <footer className="bg-white border-t border-gray-200 py-3 text-center text-xs text-gray-500 w-full mt-auto">
        &copy; {new Date().getFullYear()} 現場進捗管理システム. All rights reserved.
      </footer>
      
    </div>
  );
}
