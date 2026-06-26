import React from 'react';

export default function ProcessSelect({ onProcessSelect, onLogout }) {
  const processes = ['裁断', '準備', '組立', '縫製', '検査', '包装'];

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center px-4 py-8">
      <div className="w-full max-w-2xl bg-white border border-gray-200 shadow-lg rounded-lg p-8">
        
        {/* タイトル */}
        <div className="text-center mb-8">
          <span className="bg-slate-100 text-slate-700 text-xs font-bold px-3 py-1 rounded-full">
            作業者用アカウント
          </span>
          <h2 className="text-2xl font-black text-gray-800 mt-3">
            担当する工程を選択してください
          </h2>
          <p className="text-sm text-gray-500 mt-2">
            選択した工程は入力画面で自動的に固定されます。
          </p>
        </div>

        {/* 6つの大きな工程選択ボタン */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {processes.map((proc) => (
            <button
              key={proc}
              type="button"
              onClick={() => onProcessSelect(proc)}
              className="py-6 px-6 bg-slate-50 hover:bg-slate-800 hover:text-white border border-gray-200 rounded-lg text-xl font-bold text-slate-800 text-center transition-all duration-150 shadow-sm flex items-center justify-center min-h-[90px]"
            >
              {proc}
            </button>
          ))}
        </div>

        {/* ログアウトボタン */}
        <div className="mt-8 pt-6 border-t border-gray-100 flex justify-end">
          <button
            type="button"
            onClick={onLogout}
            className="py-2.5 px-6 border border-gray-300 rounded hover:bg-gray-100 text-sm font-bold text-gray-600 transition-colors duration-150"
          >
            ログアウト
          </button>
        </div>

      </div>
    </div>
  );
}
