/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { AlertTriangle, History, RefreshCw, Settings2, Snowflake, Trash2, Cpu, Loader2 } from 'lucide-react';
import {
  HistoryCategory,
  HistoryEvent,
  describeEvent,
  eventCategory,
  eventDay,
  eventSource,
  formatEventTime,
  isAlarmEvent,
} from '../services/history';
import { bleManager } from '../services/bleService';

interface HistoryTabProps {
  history: HistoryEvent[];
  historyMax: number;
  loading: boolean;
  isConnected: boolean;
  onOpenConnectModal?: () => void;
}

const FILTERS: { key: 'all' | HistoryCategory; label: string }[] = [
  { key: 'all', label: 'Tất cả' },
  { key: 'cool', label: 'Làm lạnh' },
  { key: 'error', label: 'Lỗi' },
  { key: 'control', label: 'Điều khiển' },
  { key: 'system', label: 'Hệ thống' },
];

const ICON: Record<HistoryCategory, React.ReactNode> = {
  cool: <Snowflake className="w-4 h-4 text-cyan-400" />,
  error: <AlertTriangle className="w-4 h-4 text-red-400" />,
  control: <Settings2 className="w-4 h-4 text-violet-400" />,
  system: <Cpu className="w-4 h-4 text-slate-400" />,
};

export const HistoryTab: React.FC<HistoryTabProps> = ({
  history,
  historyMax,
  loading,
  isConnected,
  onOpenConnectModal,
}) => {
  const [filter, setFilter] = useState<'all' | HistoryCategory>('all');
  const [confirmClear, setConfirmClear] = useState(false);

  const list = useMemo(
    () => history.filter((e) => filter === 'all' || eventCategory(e) === filter),
    [history, filter]
  );
  const coolRuns = useMemo(() => history.filter((e) => eventCategory(e) === 'cool').length, [history]);

  const handleClear = async () => {
    setConfirmClear(false);
    try {
      await bleManager.clearHistory();
    } catch (e) {
      console.warn('Failed to clear history', e);
    }
  };

  let lastDay = '#';
  return (
    <div className="space-y-4 max-w-xl mx-auto pb-8">
      <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-700">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-cyan-500/20 text-cyan-400 rounded-lg">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Nhật Ký Hoạt Động</h3>
              <p className="text-xs text-slate-400">
                {history.length}/{historyMax} sự kiện gần nhất · máy lưu cả khi mất điện, đầy thì tự xóa cái cũ nhất
                {coolRuns > 0 && ` · ${coolRuns} lần làm lạnh`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => bleManager.getHistory().catch(() => undefined)}
              disabled={!isConnected || loading}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-700 disabled:opacity-40 text-slate-200 border border-slate-700 transition cursor-pointer"
              title="Tải lại"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setConfirmClear(true)}
              disabled={!isConnected || history.length === 0}
              className="p-2 rounded-xl bg-red-950/50 hover:bg-red-900/60 disabled:opacity-40 text-red-300 border border-red-500/40 transition cursor-pointer"
              title="Xóa nhật ký"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                filter === f.key
                  ? 'bg-cyan-600 text-white border-cyan-500'
                  : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {confirmClear && (
          <div className="p-3 bg-red-950/50 border border-red-500/50 rounded-xl text-xs text-red-200 flex items-center justify-between gap-2">
            <span>Xóa toàn bộ nhật ký trên máy? Không khôi phục được.</span>
            <div className="flex gap-1.5 shrink-0">
              <button onClick={() => setConfirmClear(false)} className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-200 cursor-pointer">
                Hủy
              </button>
              <button onClick={handleClear} className="px-2.5 py-1 rounded-lg bg-red-600 text-white font-bold cursor-pointer">
                Xóa
              </button>
            </div>
          </div>
        )}

        {!isConnected && history.length === 0 ? (
          <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-800 text-xs text-slate-400 flex items-center justify-between">
            <span>Kết nối Bluetooth với máy để xem nhật ký.</span>
            {onOpenConnectModal && (
              <button onClick={onOpenConnectModal} className="px-3 py-1.5 rounded-lg bg-cyan-600 text-white font-semibold cursor-pointer">
                Kết nối
              </button>
            )}
          </div>
        ) : list.length === 0 ? (
          <p className="p-4 bg-slate-900/60 rounded-xl border border-slate-800 text-xs text-slate-400">
            {loading ? 'Đang tải nhật ký từ máy…' : 'Chưa có sự kiện nào trong nhóm này.'}
          </p>
        ) : (
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 divide-y divide-slate-800/80">
            {list.map((e, i) => {
              const day = eventDay(e);
              const header = day !== lastDay;
              lastDay = day;
              const alarm = isAlarmEvent(e);
              const src = eventSource(e);
              return (
                <React.Fragment key={`${e.t}-${e.type}-${e.val}-${i}`}>
                  {header && (
                    <div className="px-3 py-1.5 bg-slate-900 text-[11px] font-bold text-slate-400 sticky top-0">
                      {day || 'Lần chạy trước (chưa có giờ)'}
                    </div>
                  )}
                  <div className={`px-3 py-2.5 flex items-start gap-3 text-xs ${alarm ? 'bg-red-950/30' : ''}`}>
                    <span className="mt-0.5 shrink-0">{ICON[eventCategory(e)]}</span>
                    <div className="min-w-0 flex-1">
                      <div className={`${alarm ? 'text-red-300 font-bold' : 'text-slate-200'} break-words`}>
                        {describeEvent(e)}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5 flex flex-wrap gap-x-2">
                        <span className="font-mono">{formatEventTime(e)}</span>
                        {src && <span>· {src}</span>}
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
