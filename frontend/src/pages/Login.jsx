import React, { useState } from 'react';

export default function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setErrorMsg('ユーザー名とパスワードを入力してください。');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: username.trim(),
          password: password.trim(),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'ログインに失敗しました。');
      }

      // ログイン成功時のコールバック
      onLoginSuccess(data);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-md bg-white border border-gray-200 shadow-lg rounded-lg p-8">
        
        {/* ロゴ / タイトル */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-black text-slate-800 tracking-wider">
            現場進捗管理システム
          </h1>
          <p className="text-xs text-gray-500 mt-1 font-mono">
            SECURE LOGIN PORTAL
          </p>
        </div>

        {errorMsg && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm font-bold">
            {errorMsg}
          </div>
        )}

        {/* ログインフォーム (大ボタン・大入力欄) */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="usernameInput" className="block text-sm font-bold text-gray-700 mb-1">
              ユーザーID
            </label>
            <input
              id="usernameInput"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="例: worker または admin"
              disabled={loading}
              className="w-full px-4 py-3.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500 text-base font-bold"
            />
          </div>

          <div>
            <label htmlFor="passwordInput" className="block text-sm font-bold text-gray-700 mb-1">
              パスワード
            </label>
            <input
              id="passwordInput"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={loading}
              className="w-full px-4 py-3.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500 text-base"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-4 text-white font-bold rounded-md text-lg transition-colors duration-150 shadow-md ${
              loading 
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-slate-800 hover:bg-slate-900'
            }`}
          >
            {loading ? '認証中...' : 'ログイン'}
          </button>
        </form>

        {/* アカウント例のヒント（管理者向け） */}
        <div className="mt-8 pt-6 border-t border-gray-100 text-xs text-gray-400 space-y-1">
          <div className="font-bold text-gray-500">ログイン情報（テスト用）:</div>
          <div>・管理者: ID `admin` / PW `admin123`</div>
          <div>・作業者: ID `worker` / PW `worker123`</div>
        </div>

      </div>
    </div>
  );
}
