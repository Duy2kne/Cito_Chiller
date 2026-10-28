/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Wrench,
  Play,
  Square,
  Fan,
  Zap,
  Clock,
  ShieldCheck,
  RotateCcw,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { ChillerConfig, ChillerStatus, formatCurrent } from '../types/system';
import { bleManager } from '../services/bleService';

interface ManualControlSectionProps {
  status: ChillerStatus | null;
  config: ChillerConfig | null;
  isConnected: boolean;
  onOpenConnectModal?: () => void;
  title?: string;
}

export const ManualControlSection: React.FC<ManualControlSectionProps> = ({
  status,
  config,
  isConnected,
  onOpenConnectModal,
  title = 'Bật / Tắt Thủ Công (Manual Test)',
}) => {
  const isTestActive = (status?.tst?.on ?? 0) === 1;
  const testSecondsLeft = status?.tst?.left ?? 0;

  // Local state for controls
  const [p1State, setP1State] = useState<boolean>(false);
  const [p2State, setP2State] = useState<boolean>(false);
  const [fanSpeed, setFanSpeed] = useState<number>(50);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Sync with machine status when in test mode
  useEffect(() => {
    if (status?.tst?.on) {
      setP1State(Boolean(status.tst.p1));
      setP2State(Boolean(status.tst.p2));
      if (status.tst.fan !== undefined) {
        setFanSpeed(status.tst.fan);
      }
    }
  }, [status?.tst?.on, status?.tst?.p1, status?.tst?.p2, status?.tst?.fan]);

  // Start Manual Mode
  const handleStartManual = async () => {
    if (!isConnected) {
      if (onOpenConnectModal) onOpenConnectModal();
      return;
    }
    setIsLoading(true);
    try {
      await bleManager.startTest();
      // Initial default: fan 40%, tecs off
      setFanSpeed(40);
      setP1State(false);
      setP2State(false);
      await bleManager.setTest(false, false, 40);
    } catch (e) {
      console.warn('Failed to start manual test mode', e);
    } finally {
      setIsLoading(false);
    }
  };

  // Stop Manual Mode
  const handleStopManual = async () => {
    if (!isConnected) return;
    setIsLoading(true);
    try {
      await bleManager.stopTest();
    } catch (e) {
      console.warn('Failed to stop manual test mode', e);
    } finally {
      setIsLoading(false);
    }
  };

  // Send manual state update
  const sendTestSet = async (p1: boolean, p2: boolean, fan: number) => {
    if (!isConnected || !isTestActive) return;
    try {
      await bleManager.setTest(p1, p2, fan);
    } catch (e) {
      console.warn('Failed to send test command', e);
    }
  };

  // Toggle Sò 1
  const handleToggleP1 = () => {
    const nextP1 = !p1State;
    setP1State(nextP1);
    // If turning on TEC and fan speed is too low (< 25%), bump fan up for safety
    let nextFan = fanSpeed;
    if (nextP1 && fanSpeed < 30) {
      nextFan = 40;
      setFanSpeed(40);
    }
    sendTestSet(nextP1, p2State, nextFan);
  };

  // Toggle Sò 2
  const handleToggleP2 = () => {
    const nextP2 = !p2State;
    setP2State(nextP2);
    let nextFan = fanSpeed;
    if (nextP2 && fanSpeed < 30) {
      nextFan = 50;
      setFanSpeed(50);
    }
    sendTestSet(p1State, nextP2, nextFan);
  };

  // Change Fan Speed: keo thanh truot chi gui 1 lenh sau khi dung tay 300 ms
  // (moi lenh phai cho ack, gui theo tung buoc keo se xep hang dai va tre)
  const fanTimer = useRef<number | null>(null);
  useEffect(() => () => {
    if (fanTimer.current !== null) window.clearTimeout(fanTimer.current);
  }, []);
  const handleFanChange = (speed: number, immediate = true) => {
    setFanSpeed(speed);
    if (fanTimer.current !== null) window.clearTimeout(fanTimer.current);
    if (immediate) {
      sendTestSet(p1State, p2State, speed);
      return;
    }
    fanTimer.current = window.setTimeout(() => {
      fanTimer.current = null;
      sendTestSet(p1State, p2State, speed);
    }, 300);
  };

  // Gia han them 10 phut (firmware: TEST_START khi dang TEST = tinh lai thoi gian)
  const handleExtend = async () => {
    if (!isConnected || !isTestActive) return;
    try {
      await bleManager.startTest();
    } catch (e) {
      console.warn('Failed to extend test mode', e);
    }
  };

  // Quick Presets
  const handleApplyPreset = (preset: 'fan_only' | 'tec1' | 'both_tecs' | 'all_off') => {
    if (!isTestActive) return;
    if (preset === 'fan_only') {
      setP1State(false);
      setP2State(false);
      setFanSpeed(50);
      sendTestSet(false, false, 50);
    } else if (preset === 'tec1') {
      setP1State(true);
      setP2State(false);
      setFanSpeed(60);
      sendTestSet(true, false, 60);
    } else if (preset === 'both_tecs') {
      setP1State(true);
      setP2State(true);
      setFanSpeed(100);
      sendTestSet(true, true, 100);
    } else if (preset === 'all_off') {
      setP1State(false);
      setP2State(false);
      setFanSpeed(0);
      sendTestSet(false, false, 0);
    }
  };

  // Real-time currents & RPM (luon lay so do THAT tu may, ke ca khi da tat - de thay sò ket ON)
  const p1Current = status?.p?.[0] ? formatCurrent(status.p[0][4]) : '—';
  const p2Current = status?.p?.[1] ? formatCurrent(status.p[1][4]) : '—';
  const fanMa = status?.f?.ma ?? 0;
  const fanRpm1 = status?.f?.rpm?.[0] ?? 0;
  const fanRpm2 = status?.f?.rpm?.[1] ?? 0;
  const fanActual = status?.f?.pct ?? 0;
  const fansOkKnown = status?.f?.ok !== undefined;   // Firmware truoc 28/10/2026 chua gui f.ok
  const fansOk = (status?.f?.ok ?? 0) === 1;

  // Trang thai THAT cua tung so. Firmware chi bat so khi: so dang duoc phep (pel_en), khong co loi an toan,
  // 2 quat da dat RPM on dinh, va cach lan bat so truoc >= 10 s -> nut "Bat" chi la YEU CAU.
  type TecView = { badge: string; tone: 'on' | 'off' | 'wait' | 'warn' | 'err'; note: string };
  const tecView = (i: 0 | 1, requested: boolean): TecView => {
    const row = status?.p?.[i];
    const on = row?.[0] === 1;
    const bad = row?.[1] === 1;
    const enabled = row ? row[2] !== 0 : true;
    const safety = ((status?.err ?? 0) & ~(status?.wrn ?? 0)) !== 0;
    if (on) return { badge: 'ĐANG CHẠY', tone: 'on', note: '' };
    if (!requested) return { badge: 'ĐANG TẮT', tone: 'off', note: '' };
    if (!enabled) return { badge: 'KHÔNG BẬT ĐƯỢC', tone: 'warn', note: 'Sò đang tắt bảo trì (Cài đặt → Cơ bản)' };
    if (bad || safety) return { badge: 'BỊ CHẶN', tone: 'err', note: 'Máy đang có lỗi bảo vệ – xử lý và xóa lỗi trước' };
    if (!fansOkKnown) return { badge: 'ĐANG CHỜ', tone: 'wait', note: 'Chờ quạt đạt tốc độ; 2 sò bật cách nhau 10 giây' };
    if (!fansOk) return { badge: 'CHỜ QUẠT', tone: 'wait', note: 'Sò chỉ bật khi 2 quạt đã đạt tốc độ ổn định (vài giây)' };
    return { badge: 'SẮP BẬT', tone: 'wait', note: 'Hai sò bật cách nhau 10 giây để tránh sụt nguồn' };
  };
  const toneClass: Record<TecView['tone'], string> = {
    on: 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40',
    off: 'bg-slate-800 text-slate-400',
    wait: 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse',
    warn: 'bg-orange-500/20 text-orange-300 border border-orange-500/40',
    err: 'bg-red-500/20 text-red-300 border border-red-500/40',
  };
  const tec1 = tecView(0, p1State);
  const tec2 = tecView(1, p2State);

  return (
    <div className="bg-slate-800/90 border border-slate-700/80 rounded-3xl p-5 shadow-xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-700">
        <div className="flex items-center space-x-2.5">
          <div
            className={`p-2.5 rounded-xl transition ${
              isTestActive
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                : 'bg-cyan-500/20 text-cyan-400'
            }`}
          >
            <Wrench className={`w-5 h-5 ${isTestActive ? 'animate-bounce' : ''}`} />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="font-bold text-white text-base">{title}</h3>
              {isTestActive && (
                <span className="text-[10px] font-bold bg-purple-500/30 text-purple-200 px-2 py-0.5 rounded-full border border-purple-500/40 animate-pulse">
                  ĐANG BẬT
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Kiểm tra bật/tắt từng sò lạnh và quạt độc lập
            </p>
          </div>
        </div>

        {/* Master Start / Stop Button */}
        {isTestActive ? (
          <button
            onClick={handleStopManual}
            disabled={isLoading || !isConnected}
            className="px-3.5 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg shadow-red-950/40 flex items-center space-x-1.5 transition cursor-pointer"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            <span>Thoát Manual</span>
          </button>
        ) : (
          <button
            onClick={handleStartManual}
            disabled={isLoading}
            className="px-3.5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-purple-950/40 flex items-center space-x-1.5 transition cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Bật Chế Độ Manual</span>
          </button>
        )}
      </div>

      {isTestActive ? (
        <div className="space-y-4 animate-fade-in">
          {/* Active Manual Status Bar */}
          <div className="bg-gradient-to-r from-purple-950/60 to-slate-900/90 border border-purple-500/40 p-3 rounded-2xl flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2 text-purple-200">
              <Clock className="w-4 h-4 text-purple-400 animate-spin" />
              <span>Thời gian kiểm tra còn lại:</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="font-mono font-bold text-amber-300 text-sm bg-black/40 px-2 py-0.5 rounded border border-amber-500/30">
                {Math.floor(testSecondsLeft / 60)} phút {testSecondsLeft % 60} giây
              </span>
              <button
                onClick={handleExtend}
                className="px-2 py-0.5 bg-purple-700/60 hover:bg-purple-600 text-purple-100 rounded font-semibold transition cursor-pointer"
              >
                +10 phút
              </button>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 -mt-2">
            Mỗi lần bấm điều khiển, thời gian được tính lại. Hết giờ máy tự về chạy theo nhiệt độ.
          </p>

          {/* Quick Preset Buttons */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Kịch Bản Thử Nhanh 1 Chạm:
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <button
                onClick={() => handleApplyPreset('fan_only')}
                className="p-2 bg-slate-900 hover:bg-slate-700/80 text-cyan-300 border border-slate-700 rounded-xl font-medium transition cursor-pointer text-center"
              >
                🌀 Quạt 50%
              </button>
              <button
                onClick={() => handleApplyPreset('tec1')}
                className="p-2 bg-slate-900 hover:bg-slate-700/80 text-cyan-300 border border-slate-700 rounded-xl font-medium transition cursor-pointer text-center"
              >
                ❄️ Sò 1 + Quạt 60%
              </button>
              <button
                onClick={() => handleApplyPreset('both_tecs')}
                className="p-2 bg-slate-900 hover:bg-slate-700/80 text-cyan-300 border border-slate-700 rounded-xl font-medium transition cursor-pointer text-center"
              >
                ❄️❄️ 2 Sò + Quạt 100%
              </button>
              <button
                onClick={() => handleApplyPreset('all_off')}
                className="p-2 bg-slate-900 hover:bg-slate-700/80 text-red-300 border border-slate-700 rounded-xl font-medium transition cursor-pointer text-center"
              >
                🛑 Tắt Toàn Bộ
              </button>
            </div>
          </div>

          {/* Fan Speed Manual Slider & Buttons */}
          <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-700/70 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Fan className={`w-4 h-4 text-cyan-400 ${fanSpeed > 0 ? 'animate-spin' : ''}`} />
                <span className="text-xs font-bold text-slate-200">
                  Điều Khiển Quạt Giải Nhiệt
                </span>
              </div>
              <span className="font-mono font-extrabold text-cyan-300 text-sm bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/40">
                {fanSpeed}%
              </span>
            </div>

            {/* Quick Speed Buttons */}
            <div className="grid grid-cols-5 gap-1.5 text-xs">
              {[0, 30, 50, 75, 100].map((spd) => (
                <button
                  key={spd}
                  onClick={() => handleFanChange(spd)}
                  className={`py-1.5 px-1 rounded-lg font-semibold transition cursor-pointer text-center ${
                    fanSpeed === spd
                      ? 'bg-cyan-600 text-white shadow shadow-cyan-950/40'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {spd === 0 ? 'TẮT' : `${spd}%`}
                </button>
              ))}
            </div>

            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={fanSpeed}
              onChange={(e) => handleFanChange(parseInt(e.target.value), false)}
              className="w-full accent-cyan-400 cursor-pointer"
            />

            {/* Trang thai quat THAT: firmware tu nang quat len toi thieu khi co so, tang khi cuc nong nong */}
            <div className="flex items-center justify-between text-[11px]">
              <span className={fansOk ? 'text-emerald-400' : fanActual > 0 ? 'text-amber-300' : 'text-slate-400'}>
                {fanActual === 0 ? 'Quạt đang tắt' : !fansOkKnown ? 'Quạt đang chạy' : fansOk ? '✓ 2 quạt đã đạt tốc độ' : '… Đang chờ quạt đạt tốc độ'}
              </span>
              {fanActual !== fanSpeed && (
                <span className="text-slate-400">
                  Máy đang chạy <b className="text-cyan-300">{fanActual}%</b>
                </span>
              )}
            </div>

            {/* Live Fan Metrics */}
            <div className="grid grid-cols-3 gap-2 text-[11px] font-mono bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 text-slate-300 text-center">
              <div>
                <span className="text-slate-400 block text-[10px]">Quạt 1:</span>
                <span className="font-bold text-slate-100">{fanRpm1} RPM</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Quạt 2:</span>
                <span className="font-bold text-slate-100">{fanRpm2} RPM</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Dòng quạt:</span>
                <span className="font-bold text-cyan-300">{formatCurrent(fanMa)}</span>
              </div>
            </div>
          </div>

          {/* Sò 1 and Sò 2 Manual Switches */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Sò 1 Switch */}
            <div
              className={`p-4 rounded-2xl border transition bg-slate-900/80 flex flex-col justify-between space-y-3 ${
                tec1.tone === 'on'
                  ? 'border-cyan-500/70 shadow-lg shadow-cyan-950/30'
                  : 'border-slate-700/70'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Zap className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-bold text-slate-200">
                    Sò Lạnh 1 + Van Nước
                  </span>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${toneClass[tec1.tone]}`}>
                  {tec1.badge}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-400 block">Dòng điện đo được:</span>
                  <span className="font-mono font-bold text-cyan-300 text-sm">{p1Current}</span>
                </div>

                <button
                  onClick={handleToggleP1}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer shadow ${
                    p1State
                      ? 'bg-cyan-600 hover:bg-cyan-500 text-white'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                  }`}
                >
                  {p1State ? 'Tắt Sò 1' : 'Bật Sò 1'}
                </button>
              </div>

              <p className={`text-[10px] italic ${tec1.note ? 'text-amber-300' : 'text-slate-400'}`}>
                {tec1.note || '* Sò 1 chạy thì van nước mở (đấu chung).'}
              </p>
            </div>

            {/* Sò 2 Switch */}
            <div
              className={`p-4 rounded-2xl border transition bg-slate-900/80 flex flex-col justify-between space-y-3 ${
                tec2.tone === 'on'
                  ? 'border-cyan-500/70 shadow-lg shadow-cyan-950/30'
                  : 'border-slate-700/70'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Zap className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-bold text-slate-200">Sò Lạnh 2</span>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${toneClass[tec2.tone]}`}>
                  {tec2.badge}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-400 block">Dòng điện đo được:</span>
                  <span className="font-mono font-bold text-cyan-300 text-sm">{p2Current}</span>
                </div>

                <button
                  onClick={handleToggleP2}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer shadow ${
                    p2State
                      ? 'bg-cyan-600 hover:bg-cyan-500 text-white'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                  }`}
                >
                  {p2State ? 'Tắt Sò 2' : 'Bật Sò 2'}
                </button>
              </div>

              <p className={`text-[10px] ${tec2.note ? 'text-amber-300 italic' : 'text-slate-400'}`}>
                {tec2.note || '* Tầng lạnh tăng cường thứ 2.'}
              </p>
            </div>
          </div>

          {/* Safety Disclaimer */}
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-xs text-slate-400 flex items-start space-x-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span className="leading-relaxed text-[11px]">
              <strong>Máy vẫn giữ mọi bảo vệ:</strong> sò chỉ bật khi 2 quạt đã đạt tốc độ, 2 sò bật cách nhau 10 giây,
              có sò chạy thì quạt không thấp hơn mức tối thiểu. Gặp lỗi (quá nhiệt, quá dòng…) máy tự ngắt sò ngay.
            </span>
          </div>
        </div>
      ) : (
        <div className="p-4 bg-slate-900/60 rounded-2xl border border-slate-800/80 flex items-center justify-between text-xs">
          <div className="space-y-0.5">
            <span className="font-medium text-slate-300 block">
              Chế độ Manual đang TẮT (Máy chạy theo nhiệt độ tự động)
            </span>
            <p className="text-[11px] text-slate-400">
              Nhấn nút &quot;Bật Chế Độ Manual&quot; để thử riêng quạt, sò 1 (+ van nước) và sò 2 trong 10 phút.
            </p>
          </div>

          <button
            onClick={handleStartManual}
            disabled={isLoading}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-xs font-semibold rounded-xl transition cursor-pointer shrink-0 ml-3"
          >
            Bật Thử Ngay
          </button>
        </div>
      )}
    </div>
  );
};
