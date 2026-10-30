/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Save,
  Sliders,
  ShieldAlert,
  Volume2,
  Fan,
  Flame,
  Zap,
  ChevronDown,
  ChevronUp,
  Info,
  CheckCircle2,
} from 'lucide-react';
import { ChillerConfig } from '../types/system';
import { bleManager } from '../services/bleService';

interface SettingsTabProps {
  config: ChillerConfig | null;
  isConnected: boolean;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({ config, isConnected }) => {
  // Local form state
  const [formData, setFormData] = useState<Partial<ChillerConfig>>({});
  const [changedKeys, setChangedKeys] = useState<Set<string>>(new Set());
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [savingGroup, setSavingGroup] = useState<string | null>(null);

  // Sync formData with incoming config whenever config changes from BLE
  useEffect(() => {
    if (config) {
      setFormData((prev) => {
        const next: Partial<ChillerConfig> = { ...prev };
        // Only update keys that the user hasn't actively modified
        for (const [k, v] of Object.entries(config)) {
          if (!changedKeys.has(k)) {
            (next as unknown as Record<string, unknown>)[k] = v;
          }
        }
        return next;
      });
    }
  }, [config, changedKeys]);

  const handleChange = (key: keyof ChillerConfig, value: number) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setChangedKeys((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  };

  // Save specific subset of keys
  const handleSaveGroup = async (groupName: string, keys: (keyof ChillerConfig)[]) => {
    if (!isConnected) return;
    setSavingGroup(groupName);

    // Build payload of ONLY modified keys that belong to this group
    const payload: Record<string, number> = {};
    for (const k of keys) {
      if (changedKeys.has(k) && formData[k] !== undefined) {
        payload[k] = formData[k] as number;
      }
    }

    if (Object.keys(payload).length === 0) {
      setSavingGroup(null);
      return;
    }

    try {
      const ack = await bleManager.setConfig(payload);
      if (ack.ok) {
        // Clear modified status for saved keys
        setChangedKeys((prev) => {
          const next = new Set(prev);
          for (const k of keys) next.delete(k);
          return next;
        });
      }
    } catch (e) {
      console.warn('Failed to save settings', e);
    } finally {
      setSavingGroup(null);
    }
  };

  const basicKeys: (keyof ChillerConfig)[] = ['diff', 'bz_key', 'bz_alarm', 'pel1_en', 'pel2_en'];
  const tecKeys: (keyof ChillerConfig)[] = ['s2on', 's2off', 'min_on', 'min_off', 'med_tec'];
  const tempKeys: (keyof ChillerConfig)[] = ['hot_red', 'hot_max', 'hot_clr', 'cold_min'];
  const fanKeys: (keyof ChillerConfig)[] = [
    'fan_lo',
    'fan_hi',
    'fan_off',
    'fan_min',
    'fmax_a',
    'fmax_m',
    'fmax_e',
    'fan_runon',
    'fan_rpm',
    'fan_rpmx',
  ];
  const curKeys: (keyof ChillerConfig)[] = ['fan_ma', 'pel_min', 'pel_max'];

  const hasBasicChanges = basicKeys.some((k) => changedKeys.has(k));
  const hasTecChanges = tecKeys.some((k) => changedKeys.has(k));
  const hasTempChanges = tempKeys.some((k) => changedKeys.has(k));
  const hasFanChanges = fanKeys.some((k) => changedKeys.has(k));
  const hasCurChanges = curKeys.some((k) => changedKeys.has(k));

  return (
    <div className="space-y-5 max-w-xl mx-auto pb-8">
      {/* Group 1: Basic Settings (Always Visible) */}
      <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-700">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-cyan-500/20 text-cyan-400 rounded-lg">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Cài Đặt Cơ Bản</h3>
              <p className="text-xs text-slate-400">Các thông số vận hành thông dụng</p>
            </div>
          </div>

          <button
            onClick={() => handleSaveGroup('basic', basicKeys)}
            disabled={!isConnected || !hasBasicChanges || savingGroup === 'basic'}
            className="px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:hover:bg-cyan-600 text-white font-semibold text-xs rounded-xl shadow transition flex items-center space-x-1.5 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{savingGroup === 'basic' ? 'Đang lưu...' : 'Lưu Thay Đổi'}</span>
          </button>
        </div>

        {/* Diff setting */}
        <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-700/60 space-y-2">
          <div className="flex justify-between items-center">
            <div>
              <label className="text-xs font-semibold text-slate-200 block">
                Độ chênh nhiệt chạy lại (diff)
              </label>
              <p className="text-[11px] text-slate-400">
                Nước ≥ (Mục tiêu + diff) thì máy sẽ khởi động làm lạnh lại
              </p>
            </div>
            <span className="font-mono font-bold text-cyan-300 text-base">
              {(formData.diff ?? config?.diff ?? 1.0).toFixed(1)} °C
            </span>
          </div>
          <input
            type="range"
            min={0.5}
            max={2.0}
            step={0.1}
            disabled={!isConnected}
            value={formData.diff ?? config?.diff ?? 1.0}
            onChange={(e) => handleChange('diff', parseFloat(e.target.value))}
            className="w-full accent-cyan-400 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-400 font-mono">
            <span>0.5 °C (Chính xác)</span>
            <span>1.0 °C (Khuyên dùng)</span>
            <span>2.0 °C (Tiết kiệm)</span>
          </div>
        </div>

        {/* Buzzer Settings */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex items-center justify-between bg-slate-900/60 p-3 rounded-xl border border-slate-700/60">
            <div className="flex items-center space-x-2">
              <Volume2 className="w-4 h-4 text-cyan-400" />
              <div>
                <span className="text-xs font-medium text-slate-200 block">Bíp phím bấm</span>
                <span className="text-[10px] text-slate-400">Kêu bíp khi bấm nút</span>
              </div>
            </div>
            <button
              onClick={() => handleChange('bz_key', (formData.bz_key ?? config?.bz_key ?? 1) ? 0 : 1)}
              disabled={!isConnected}
              className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                (formData.bz_key ?? config?.bz_key ?? 1) ? 'bg-cyan-600' : 'bg-slate-700'
              }`}
            >
              <span
                className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                  (formData.bz_key ?? config?.bz_key ?? 1) ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between bg-slate-900/60 p-3 rounded-xl border border-slate-700/60">
            <div className="flex items-center space-x-2">
              <Volume2 className="w-4 h-4 text-amber-400" />
              <div>
                <span className="text-xs font-medium text-slate-200 block">Còi báo lỗi</span>
                <span className="text-[10px] text-slate-400">Kêu còi khi có sự cố</span>
              </div>
            </div>
            <button
              onClick={() => handleChange('bz_alarm', (formData.bz_alarm ?? config?.bz_alarm ?? 1) ? 0 : 1)}
              disabled={!isConnected}
              className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                (formData.bz_alarm ?? config?.bz_alarm ?? 1) ? 'bg-cyan-600' : 'bg-slate-700'
              }`}
            >
              <span
                className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                  (formData.bz_alarm ?? config?.bz_alarm ?? 1) ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Maintenance TEC toggles */}
        <div className="space-y-2 pt-1">
          <span className="text-xs font-medium text-slate-300 block uppercase tracking-wider">
            Bật / Tắt Từng Sò Để Bảo Trì
          </span>

          <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-700/60 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-200 block">
                Cho phép Sò 1 (+ Van nước)
              </span>
              <p className="text-[11px] text-amber-300">
                Lưu ý: Tắt Sò 1 thì van nước cũng đóng theo.
              </p>
            </div>
            <button
              onClick={() => handleChange('pel1_en', (formData.pel1_en ?? config?.pel1_en ?? 1) ? 0 : 1)}
              disabled={!isConnected}
              className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                (formData.pel1_en ?? config?.pel1_en ?? 1) ? 'bg-cyan-600' : 'bg-slate-700'
              }`}
            >
              <span
                className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                  (formData.pel1_en ?? config?.pel1_en ?? 1) ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-700/60 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-200 block">
                Cho phép Sò 2 (Tầng tăng cường)
              </span>
              <p className="text-[11px] text-slate-400">
                Tắt sò 2 nếu chỉ muốn chạy 1 sò tiết kiệm điện
              </p>
            </div>
            <button
              onClick={() => handleChange('pel2_en', (formData.pel2_en ?? config?.pel2_en ?? 1) ? 0 : 1)}
              disabled={!isConnected}
              className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                (formData.pel2_en ?? config?.pel2_en ?? 1) ? 'bg-cyan-600' : 'bg-slate-700'
              }`}
            >
              <span
                className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                  (formData.pel2_en ?? config?.pel2_en ?? 1) ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Advanced Accordion Toggle */}
      <div className="border border-slate-700/70 rounded-2xl overflow-hidden bg-slate-800/80">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-700/40 transition cursor-pointer"
        >
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">Cài Đặt Nâng Cao (Chuyên Sâu)</h3>
              <p className="text-xs text-amber-400/90">
                Chỉ chỉnh khi hiểu rõ các thông số kỹ thuật phần cứng
              </p>
            </div>
          </div>
          {showAdvanced ? (
            <ChevronUp className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          )}
        </button>

        {showAdvanced && (
          <div className="p-5 border-t border-slate-700 space-y-6 bg-slate-900/40 animate-fade-in">
            {/* Sub-Group: Điều khiển sò */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Zap className="w-4 h-4" /> 1. Điều Khiển Sò Lạnh
                </span>
                <button
                  onClick={() => handleSaveGroup('tec', tecKeys)}
                  disabled={!isConnected || !hasTecChanges || savingGroup === 'tec'}
                  className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-30 text-white text-xs font-medium rounded-lg transition"
                >
                  {savingGroup === 'tec' ? 'Đang lưu...' : 'Lưu Sò'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                  <label className="text-slate-300 font-medium block">
                    Bật sò 2 khi chênh (s2on):
                  </label>
                  <span className="text-[10px] text-slate-400">Nước ≥ Mục tiêu + s2on (diff – 10 °C)</span>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.s2on ?? config?.s2on ?? 2.0}
                    onChange={(e) => handleChange('s2on', parseFloat(e.target.value))}
                    className="mt-1 w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-cyan-300 font-mono"
                  />
                </div>

                <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                  <label className="text-slate-300 font-medium block">
                    Tắt sò 2 khi chênh (s2off):
                  </label>
                  <span className="text-[10px] text-slate-400">Nước &lt; Mục tiêu + s2off (0 – s2on °C)</span>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.s2off ?? config?.s2off ?? 0.5}
                    onChange={(e) => handleChange('s2off', parseFloat(e.target.value))}
                    className="mt-1 w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-cyan-300 font-mono"
                  />
                </div>

                <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                  <label className="text-slate-300 font-medium block">
                    Thời gian chạy tối thiểu (min_on):
                  </label>
                  <span className="text-[10px] text-slate-400">5 – 600 giây</span>
                  <input
                    type="number"
                    value={formData.min_on ?? config?.min_on ?? 60}
                    onChange={(e) => handleChange('min_on', parseInt(e.target.value))}
                    className="mt-1 w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-cyan-300 font-mono"
                  />
                </div>

                <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                  <label className="text-slate-300 font-medium block">
                    Thời gian nghỉ tối thiểu (min_off):
                  </label>
                  <span className="text-[10px] text-slate-400">10 – 900 giây</span>
                  <input
                    type="number"
                    value={formData.min_off ?? config?.min_off ?? 60}
                    onChange={(e) => handleChange('min_off', parseInt(e.target.value))}
                    className="mt-1 w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-cyan-300 font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Sub-Group: Bảo vệ nhiệt */}
            <div className="space-y-3 pt-3 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Flame className="w-4 h-4" /> 2. Bảo Vệ Nhiệt Độ
                </span>
                <button
                  onClick={() => handleSaveGroup('temp', tempKeys)}
                  disabled={!isConnected || !hasTempChanges || savingGroup === 'temp'}
                  className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-30 text-white text-xs font-medium rounded-lg transition"
                >
                  {savingGroup === 'temp' ? 'Đang lưu...' : 'Lưu Nhiệt'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                  <label className="text-slate-300 font-medium block">
                    Giảm 1 sò khi T3 nóng (hot_red):
                  </label>
                  <span className="text-[10px] text-slate-400">T3/T4 ≥ mức này thì giảm 1 sò (°C)</span>
                  <input
                    type="number"
                    value={formData.hot_red ?? config?.hot_red ?? 65}
                    onChange={(e) => handleChange('hot_red', parseInt(e.target.value))}
                    className="mt-1 w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-cyan-300 font-mono"
                  />
                </div>

                <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                  <label className="text-slate-300 font-medium block">
                    Ngắt quá nhiệt T3 (hot_max):
                  </label>
                  <span className="text-[10px] text-slate-400">T3/T4 ≥ mức này ngắt máy báo lỗi E4 (40–90°C)</span>
                  <input
                    type="number"
                    value={formData.hot_max ?? config?.hot_max ?? 75}
                    onChange={(e) => handleChange('hot_max', parseInt(e.target.value))}
                    className="mt-1 w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-cyan-300 font-mono"
                  />
                </div>

                <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                  <label className="text-slate-300 font-medium block">
                    Nhiệt độ xóa lỗi E4 (hot_clr):
                  </label>
                  <span className="text-[10px] text-slate-400">T3/T4 &lt; mức này mới xóa được lỗi E4 (°C)</span>
                  <input
                    type="number"
                    value={formData.hot_clr ?? config?.hot_clr ?? 55}
                    onChange={(e) => handleChange('hot_clr', parseInt(e.target.value))}
                    className="mt-1 w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-cyan-300 font-mono"
                  />
                </div>

                <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                  <label className="text-slate-300 font-medium block">
                    Chống đóng băng T2 (cold_min):
                  </label>
                  <span className="text-[10px] text-slate-400">T2 block ≤ mức này ngắt báo E5 (-10–15°C)</span>
                  <input
                    type="number"
                    value={formData.cold_min ?? config?.cold_min ?? 5}
                    onChange={(e) => handleChange('cold_min', parseInt(e.target.value))}
                    className="mt-1 w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-cyan-300 font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Sub-Group: Quạt giải nhiệt */}
            <div className="space-y-3 pt-3 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-teal-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Fan className="w-4 h-4" /> 3. Quạt Giải Nhiệt
                </span>
                <button
                  onClick={() => handleSaveGroup('fan', fanKeys)}
                  disabled={!isConnected || !hasFanChanges || savingGroup === 'fan'}
                  className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-30 text-white text-xs font-medium rounded-lg transition"
                >
                  {savingGroup === 'fan' ? 'Đang lưu...' : 'Lưu Quạt'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                  <label className="text-slate-300 font-medium block">
                    Quạt chạy thêm khi dừng (fan_runon):
                  </label>
                  <span className="text-[10px] text-slate-400">10 – 1800 giây</span>
                  <input
                    type="number"
                    value={formData.fan_runon ?? config?.fan_runon ?? 60}
                    onChange={(e) => handleChange('fan_runon', parseInt(e.target.value))}
                    className="mt-1 w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-cyan-300 font-mono"
                  />
                </div>

                <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                  <label className="text-slate-300 font-medium block">
                    Tốc độ quạt tối thiểu (fan_min):
                  </label>
                  <span className="text-[10px] text-slate-400">10 – 100 %</span>
                  <input
                    type="number"
                    value={formData.fan_min ?? config?.fan_min ?? 25}
                    onChange={(e) => handleChange('fan_min', parseInt(e.target.value))}
                    className="mt-1 w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-cyan-300 font-mono"
                  />
                </div>

                <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                  <label className="text-slate-300 font-medium block">
                    RPM tối thiểu báo lỗi quạt (fan_rpm):
                  </label>
                  <span className="text-[10px] text-slate-400">0 = không kiểm tra RPM</span>
                  <input
                    type="number"
                    value={formData.fan_rpm ?? config?.fan_rpm ?? 1200}
                    onChange={(e) => handleChange('fan_rpm', parseInt(e.target.value))}
                    className="mt-1 w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-cyan-300 font-mono"
                  />
                </div>

                <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                  <label className="text-slate-300 font-medium block">
                    RPM tối đa báo lỗi quạt (fan_rpmx):
                  </label>
                  <span className="text-[10px] text-slate-400">0 = không kiểm tra</span>
                  <input
                    type="number"
                    value={formData.fan_rpmx ?? config?.fan_rpmx ?? 4500}
                    onChange={(e) => handleChange('fan_rpmx', parseInt(e.target.value))}
                    className="mt-1 w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-cyan-300 font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Sub-Group: Bảo vệ dòng */}
            <div className="space-y-3 pt-3 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-red-300 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4" /> 4. Bảo Vệ Dòng Điện & An Toàn
                </span>
                <button
                  onClick={() => handleSaveGroup('cur', curKeys)}
                  disabled={!isConnected || !hasCurChanges || savingGroup === 'cur'}
                  className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-30 text-white text-xs font-medium rounded-lg transition"
                >
                  {savingGroup === 'cur' ? 'Đang lưu...' : 'Lưu Dòng'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                  <label className="text-slate-300 font-medium block">
                    Dòng ngắt quá dòng quạt (fan_ma):
                  </label>
                  <span className="text-[10px] text-slate-400">300 – 10000 mA (Báo E8)</span>
                  <input
                    type="number"
                    value={formData.fan_ma ?? config?.fan_ma ?? 2500}
                    onChange={(e) => handleChange('fan_ma', parseInt(e.target.value))}
                    className="mt-1 w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-cyan-300 font-mono"
                  />
                </div>

                <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                  <label className="text-slate-300 font-medium block">
                    Dòng tối thiểu của sò (pel_min):
                  </label>
                  <span className="text-[10px] text-slate-400">Dưới mức này báo đứt sò (E9/E10) (mA)</span>
                  <input
                    type="number"
                    value={formData.pel_min ?? config?.pel_min ?? 1500}
                    onChange={(e) => handleChange('pel_min', parseInt(e.target.value))}
                    className="mt-1 w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-cyan-300 font-mono"
                  />
                </div>

                <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                  <label className="text-slate-300 font-medium block">
                    Dòng tối đa của sò (pel_max):
                  </label>
                  <span className="text-[10px] text-slate-400">Trên mức này báo quá dòng (E9/E10) (mA)</span>
                  <input
                    type="number"
                    value={formData.pel_max ?? config?.pel_max ?? 7000}
                    onChange={(e) => handleChange('pel_max', parseInt(e.target.value))}
                    className="mt-1 w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-cyan-300 font-mono"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
