import React, { useState, useEffect } from 'react';

export default function ProgressInput({ lockedProcess }) {
  const [planId, setPlanId] = useState('');
  const [selectedProcess, setSelectedProcess] = useState(lockedProcess || '');
  const [selectedStatus, setSelectedStatus] = useState('作業中');
  
  const [loading, setLoading] = useState(false);
  const [planDetails, setPlanDetails] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const processes = ['裁断', '準備', '組立', '縫製', '検査', '包装'];
  const statuses = ['作業中', '完了'];

  // lockedProcessが変わったら、選択工程も追従させる
  useEffect(() => {
    if (lockedProcess) {
      setSelectedProcess(lockedProcess);
    }
  }, [lockedProcess]);

  // 指示Noの情報を取得する関数
  const fetchPlanDetails = async (idToFetch) => {
    const targetId = idToFetch || planId;
    if (!targetId.trim()) return;

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    setPlanDetails(null);

    try {
      const response = await fetch(`/api/plans/${encodeURIComponent(targetId.trim())}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('指定された指示Noは存在しません。データ管理画面でCSVを取り込んでください。');
        } else {
          throw new Error('サーバーエラーが発生しました。');
        }
      }
      const data = await response.json();
      setPlanDetails(data);
    } catch (err) {
      setErrorMsg(err.message);
      setPlanDetails(null);
    } finally {
      setLoading(false);
    }
  };

  // 入力欄でEnterキーが押された時の処理
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      fetchPlanDetails();
    }
  };

  // 進捗登録処理
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!planId.trim()) {
      setErrorMsg('指示Noを入力してください。');
      return;
    }
    if (!selectedProcess) {
      setErrorMsg('工程を選択してください。');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const response = await fetch('/api/progress', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          plan_id: planId.trim(),
          process: selectedProcess,
          status: selectedStatus,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || '進捗の更新に失敗しました。');
      }

      setSuccessMsg(`指示No ${planId} の「${selectedProcess}」工程を「${selectedStatus}」として登録しました。`);
      
      // 更新後のプラン情報を再取得して表示を最新にする
      await fetchPlanDetails(planId);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-md shadow-sm border border-gray-200">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 pb-2 border-b border-gray-200 gap-2">
        <h2 className="text-xl font-bold text-gray-800">【画面1】現場進捗入力</h2>
        {lockedProcess && (
          <span className="bg-slate-700 text-white text-xs font-bold px-3 py-1.5 rounded-full">
            ※担当工程「{lockedProcess}」で固定中
          </span>
        )}
      </div>

      {/* エラー・成功メッセージ */}
      {errorMsg && (
        <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-base font-bold">
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="mb-4 p-4 bg-green-50 border-l-4 border-green-500 text-green-700 text-base font-bold">
          {successMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* 左側：指示No入力と工程・状態選択フォーム */}
        <div>
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* 指示No入力 (大入力欄・大ボタン) */}
            <div>
              <label htmlFor="planIdInput" className="block text-base font-bold text-gray-700 mb-2">
                指示Noを入力してください (入力後にEnterキーまたは照会ボタン)
              </label>
              <div className="flex gap-2">
                <input
                  id="planIdInput"
                  type="text"
                  value={planId}
                  onChange={(e) => setPlanId(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="例: PP-2026-0001"
                  className="flex-1 px-4 py-4 border-2 border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500 text-lg font-bold"
                />
                <button
                  type="button"
                  onClick={() => fetchPlanDetails()}
                  disabled={loading}
                  className="px-6 py-4 bg-slate-700 hover:bg-slate-800 text-white font-bold rounded-md text-base transition-colors duration-150 shadow"
                >
                  照会・確認
                </button>
              </div>
            </div>

            {/* 工程選択 (6工程) - タブレット用にボタンを巨大化 */}
            <div>
              <span className="block text-base font-bold text-gray-700 mb-2">担当工程</span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {processes.map((proc) => {
                  const isLocked = lockedProcess !== undefined;
                  const isThisLocked = lockedProcess === proc;
                  
                  return (
                    <button
                      key={proc}
                      type="button"
                      disabled={isLocked && !isThisLocked}
                      onClick={() => setSelectedProcess(proc)}
                      className={`py-5 px-4 border-2 rounded-lg text-lg font-black text-center transition-all duration-150 ${
                        selectedProcess === proc
                          ? 'bg-slate-800 border-slate-800 text-white shadow-md'
                          : isLocked
                          ? 'bg-gray-100 border-gray-200 text-gray-300 cursor-not-allowed opacity-50'
                          : 'bg-slate-50 border-gray-300 text-slate-800 hover:bg-gray-200'
                      }`}
                    >
                      {proc}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 状態選択 (作業中 / 完了) - タブレット用に巨大化 */}
            <div>
              <span className="block text-base font-bold text-gray-700 mb-2">現在の状態</span>
              <div className="grid grid-cols-2 gap-4">
                {statuses.map((stat) => (
                  <button
                    key={stat}
                    type="button"
                    onClick={() => setSelectedStatus(stat)}
                    className={`py-6 px-4 border-2 rounded-lg text-xl font-black text-center transition-all duration-150 shadow-sm ${
                      selectedStatus === stat
                        ? stat === '完了'
                          ? 'bg-green-700 border-green-700 text-white shadow-md'
                          : 'bg-yellow-600 border-yellow-600 text-white shadow-md'
                        : 'bg-slate-50 border-gray-300 text-slate-800 hover:bg-gray-200'
                    }`}
                  >
                    {stat}
                  </button>
                ))}
              </div>
            </div>

            {/* 送信ボタン - 巨大化 */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={loading || !planDetails}
                className={`w-full py-5 text-white font-black rounded-lg text-xl shadow-md transition-colors duration-150 ${
                  loading || !planDetails
                    ? 'bg-gray-300 cursor-not-allowed text-gray-500 shadow-none'
                    : 'bg-slate-800 hover:bg-slate-900'
                }`}
              >
                {loading ? '登録処理中...' : '進捗実績を登録・更新する'}
              </button>
              {!planDetails && (
                <p className="mt-3 text-sm text-red-500 text-center font-bold">
                  ※指示Noを照会・確認するまで登録ボタンは押せません。
                </p>
              )}
            </div>

          </form>
        </div>

        {/* 右側：照会した指示情報の表示 */}
        <div className="bg-slate-50 p-6 rounded-md border border-gray-200">
          <h3 className="text-base font-bold text-gray-800 mb-4 pb-1 border-b border-gray-300">
            生産指示 情報確認
          </h3>

          {loading ? (
            <div className="py-12 text-center text-sm text-gray-500">データを読み込み中...</div>
          ) : planDetails ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
                <div className="text-gray-500">指示No:</div>
                <div className="font-mono font-bold text-gray-900">{planDetails.plan_id}</div>

                <div className="text-gray-500">ロットNO:</div>
                <div className="font-bold text-gray-900">{planDetails.lot_no}</div>

                <div className="text-gray-500">品番:</div>
                <div className="font-mono font-bold text-gray-900">{planDetails.product_code}</div>

                <div className="text-gray-500">製品名:</div>
                <div className="font-bold text-gray-900">{planDetails.product_name}</div>

                <div className="text-gray-500">生産指示数:</div>
                <div className="font-bold text-gray-900">{planDetails.quantity.toLocaleString()}</div>

                <div className="text-gray-500">払出先:</div>
                <div className="font-bold text-slate-800">{planDetails.destination}</div>

                <div className="text-gray-500">生産指示日:</div>
                <div className="font-bold text-gray-900">{planDetails.instruction_date}</div>
              </div>

              {/* 現時点の進捗一覧 */}
              <div className="mt-6 pt-4 border-t border-gray-200">
                <span className="block text-sm font-bold text-gray-700 mb-3">現在の各工程ステータス</span>
                <div className="space-y-2">
                  {processes.map((proc) => {
                    const statusInfo = planDetails.progress?.[proc];
                    return (
                      <div
                        key={proc}
                        className="flex justify-between items-center p-3.5 rounded bg-white border border-gray-200 text-sm"
                      >
                        <span className="font-bold text-gray-700">{proc} 工程</span>
                        <span
                          className={`px-3 py-1.5 rounded font-bold ${
                            statusInfo?.status === '完了'
                              ? 'bg-green-100 text-green-800'
                              : statusInfo?.status === '作業中'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-gray-100 text-gray-400'
                          }`}
                        >
                          {statusInfo ? statusInfo.status : '未着手'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="py-20 text-center text-base text-gray-400 leading-relaxed">
              左の入力欄に指示Noを入力して照会してください。<br />
              （QRコードスキャナー等の代わりにキーボードで手入力します）
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
