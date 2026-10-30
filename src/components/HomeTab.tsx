/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Power,
  Fan,
  Thermometer,
  Zap,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Clock,
  Droplets,
  Activity,
  Plus,
  Minus,
  Sparkles,
} from 'lucide-react';
import { ChillerConfig, ChillerStatus, formatCurrent, getStateDetails, parseErrors } from '../types/system';
import { bleManager } from '../services/bleService';
import { ManualControlSection } from './ManualControlSection';

interface HomeTabProps {
  status: ChillerStatus | null;
  config: ChillerConfig | null;
  isConnected: boolean;
  onOpenConnectModal: () => void;
}

export const HomeTab: React.FC<HomeTabProps> = ({
  status,
  config,
  isConnected,
  onOpenConnectModal,
}) => {
  // Local target temperature for responsive UI with 600ms debounce
  const [localSetTemp, setLocalSetTemp] = useState<number>(20.0);
  const debounceTimerRef = useRef<number | null>(null);
  const isEditingTempRef = useRef<boolean>(false);

  // Power toggle confirmation dialog
  const [showPowerOffConfirm, setShowPowerOffConfirm] = useState<boolean>(false);
  const [isPowering, setIsPowering] = useState<boolean>(false);
  const [isClearingFaults, setIsClearingFaults] = useState<boolean>(false);

  // Sync local temp from server/machine config when not actively typing/clicking
  useEffect(() => {
    if (!isEditingTempRef.current) {
      if (status?.set !== undefined) {
        setLocalSetTemp(status.set);
      } else if (config?.set !== undefined) {
        setLocalSetTemp(config.set);
      }
    }
  }, [status?.set, config?.set]);

  // Adjust temperature with debounce
  const handleAdjustTemp = (delta: number) => {
    if (!isConnected) return;
    isEditingTempRef.current = true;
    const newTemp = Math.round(Math.min(35.0, Math.max(0.0, localSetTemp + delta)) * 10) / 10;
    setLocalSetTemp(newTemp);

    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = window.setTimeout(async () => {
      isEditingTempRef.current = false;
      try {
        await bleManager.setConfig({ set: newTemp });
      } catch (e) {
        console.warn('Failed to set target temp', e);
      }
    }, 600);
  };

  // Continuous hold support for - / + buttons
  const holdIntervalRef = useRef<number | null>(null);
  const holdTimeoutRef = useRef<number | null>(null);

  const startHold = (delta: number) => {
    handleAdjustTemp(delta);
    holdTimeoutRef.current = window.setTimeout(() => {
      holdIntervalRef.current = window.setInterval(() => {
        handleAdjustTemp(delta);
      }, 120);
    }, 400);
  };

  const stopHold = () => {
    if (holdTimeoutRef.current !== null) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }
    if (holdIntervalRef.current !== null) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
  };

  // Power ON / OFF
  const handleTogglePower = async () => {
    if (!isConnected) {
      onOpenConnectModal();
      return;
    }
    const currentPw = status?.pw ?? 0;
    if (currentPw === 1) {
      // Prompt confirm before turning off
      setShowPowerOffConfirm(true);
    } else {
      // Turn ON: also clears locked errors (like holding SET for 5s)
      setIsPowering(true);
      try {
        await bleManager.setPower(true);
      } finally {
        setIsPowering(false);
      }
    }
  };

  const confirmPowerOff = async () => {
    setShowPowerOffConfirm(false);
    setIsPowering(true);
    try {
      await bleManager.setPower(false);
    } finally {
      setIsPowering(false);
    }
  };

  // Change Fan Mode
  const handleSetFanMode = async (mode: number) => {
    if (!isConnected) return;
    try {
      await bleManager.setConfig({ mode });
    } catch (e) {
      console.warn('Failed to set fan mode', e);
    }
  };

  // Clear Faults
  const handleClearFaults = async () => {
    setIsClearingFaults(true);
    try {
      await bleManager.clearFaults();
    } finally {
      setIsClearingFaults(false);
    }
  };

  // Status and error interpretation
  const parsed = parseErrors(status?.err ?? 0, status?.wrn ?? 0);
  const stateInfo = getStateDetails(
    status?.st ?? 0,
    status?.ph ?? 'OFF',
    (status?.err ?? 0) & ~(status?.wrn ?? 0),   // Chi canh bao (wrn) thi may van chay -> khong bao "LOI"
    status?.stg ?? 0,
    status?.pw ?? 0
  );

  const isPowerOn = (status?.pw ?? 0) === 1;
  const currentFanMode = status?.fm ?? config?.mode ?? 0;

  // Water temp display: if null -> "Lỗi cảm biến", do NOT show old value
  const waterTemp = status?.w;
  const isWaterSensorError = waterTemp === null || waterTemp === undefined;
  const waterTempDisplay = !isConnected
    ? '—'
    : isWaterSensorError
    ? 'LỖI'
    : waterTemp.toFixed(1);

  // TECs details
  const tec1 = status?.p?.[0]; // [on, bad, en, cur, ma]
  const tec2 = status?.p?.[1];

  const tec1On = tec1 ? tec1[0] === 1 : false;
  const tec1Bad = tec1 ? tec1[1] === 1 : false;
  const tec1En = tec1 ? tec1[2] === 1 : (config?.pel1_en ?? 1) === 1;
  const tec1Current = tec1 ? formatCurrent(tec1[4]) : '0 mA';

  const tec2On = tec2 ? tec2[0] === 1 : false;
  const tec2Bad = tec2 ? tec2[1] === 1 : false;
  const tec2En = tec2 ? tec2[2] === 1 : (config?.pel2_en ?? 1) === 1;
  const tec2Current = tec2 ? formatCurrent(tec2[4]) : '0 mA';

  // Fan details
  const fanPct = status?.f?.pct ?? 0;
  const fanRpm1 = status?.f?.rpm?.[0] ?? 0;
  const fanRpm2 = status?.f?.rpm?.[1] ?? 0;
  const fanMa = status?.f?.ma ?? 0;

  // Cong suat: dong do duoc x dien ap danh dinh (may gui "vn", mac dinh 12 V)
  const supplyV = status?.vn ?? 12;
  const wattOf = (ma: number) => (ma * supplyV) / 1000;
  const tec1W = wattOf(tec1?.[4] ?? 0);
  const tec2W = wattOf(tec2?.[4] ?? 0);
  const fanW = wattOf(fanMa);
  const totalW = status?.wt ?? tec1W + tec2W + fanW;
  const fanBad1 = status?.f?.bad?.[0] === 1;
  const fanBad2 = status?.f?.bad?.[1] === 1;

  // Badge background color map
  const stateColorClasses = {
    blue: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    green: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    yellow: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    gray: 'bg-slate-700/30 text-slate-400 border-slate-700/50',
    red: 'bg-red-500/20 text-red-300 border-red-500/40 animate-pulse',
    purple: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
  };

  return (
    <div className="space-y-4 max-w-xl mx-auto pb-6">
      {/* Not Connected Banner */}
      {!isConnected && (
        <div className="bg-slate-800/90 border border-cyan-500/40 rounded-2xl p-4 shadow-lg flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-cyan-500/20 text-cyan-400 rounded-xl">
              <Droplets className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm">Chưa kết nối máy làm lạnh</h3>
              <p className="text-xs text-slate-400">Bấm kết nối để điều khiển máy qua Bluetooth</p>
            </div>
          </div>
          <button
            onClick={onOpenConnectModal}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold rounded-xl shadow transition cursor-pointer"
          >
            Kết Nối Ngay
          </button>
        </div>
      )}

      {/* Main Status & Temperature Card */}
      <div className="relative overflow-hidden bg-gradient-to-b from-slate-800/90 to-slate-900/90 border border-slate-700/70 rounded-3xl p-6 shadow-xl backdrop-blur-md">
        {/* Machine Status Line */}
        <div className="flex items-center justify-between mb-4">
          <div
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
              stateColorClasses[stateInfo.color]
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-current animate-ping" />
            <span>{stateInfo.text}</span>
          </div>

          {status?.red === 1 && (
            <span className="text-[11px] font-medium text-amber-400 bg-amber-950/50 px-2 py-0.5 rounded border border-amber-600/30">
              Giảm 1 sò do nóng
            </span>
          )}
        </div>

        {/* Big Water Temperature Display */}
        <div className="flex flex-col items-center justify-center my-3 text-center">
          <div className="flex items-center gap-2 text-slate-400 text-xs uppercase tracking-wider font-medium mb-1">
            <Droplets className="w-4 h-4 text-cyan-400" />
            <span>Nhiệt Độ Nước Bể Cá (T1)</span>
          </div>

          <div className="flex items-baseline justify-center">
            {isWaterSensorError && isConnected ? (
              <div className="flex flex-col items-center">
                <span className="text-4xl sm:text-5xl font-black text-red-400 tracking-tight">
                  Lỗi Cảm Biến
                </span>
                <span className="text-xs text-red-300 mt-1">Đầu dò nước T1 hở mạch / mất kết nối</span>
              </div>
            ) : (
              <>
                <span className="text-6xl sm:text-7xl font-extrabold tracking-tight text-white font-mono">
                  {waterTempDisplay}
                </span>
                {isConnected && !isWaterSensorError && (
                  <span className="text-3xl sm:text-4xl font-light text-cyan-400 ml-1.5">°C</span>
                )}
              </>
            )}
          </div>

          {/* Quick differential hint */}
          {isConnected && status?.w !== null && status?.w !== undefined && (
            <div className="text-xs text-slate-400 mt-2 flex items-center gap-2">
              <span>Độ chênh chạy lại: <strong>{config?.diff ?? 1.0} °C</strong></span>
              <span>•</span>
              <span>
                Chạy lại khi: <strong>{((localSetTemp ?? 20) + (config?.diff ?? 1.0)).toFixed(1)} °C</strong>
              </span>
            </div>
          )}
        </div>

        {/* Target Temp Adjustment (- / +) */}
        <div className="mt-5 pt-4 border-t border-slate-700/60 flex items-center justify-between bg-slate-900/60 p-3.5 rounded-2xl">
          <button
            onMouseDown={() => startHold(-0.1)}
            onMouseUp={stopHold}
            onMouseLeave={stopHold}
            onTouchStart={() => startHold(-0.1)}
            onTouchEnd={stopHold}
            disabled={!isConnected}
            className="w-12 h-12 bg-slate-800 hover:bg-slate-700 active:scale-95 disabled:opacity-40 text-cyan-300 rounded-xl flex items-center justify-center shadow transition border border-slate-700 cursor-pointer text-xl"
            aria-label="Giảm nhiệt độ"
          >
            <Minus className="w-6 h-6" />
          </button>

          <div className="text-center">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-medium block">
              Mục Tiêu Đặt
            </span>
            <span className="text-2xl font-bold font-mono text-cyan-300">
              {isConnected ? localSetTemp.toFixed(1) : '—'} <span className="text-base">°C</span>
            </span>
            {isConnected && localSetTemp < 5 && (
              <span className="block max-w-[11rem] mx-auto text-[10px] leading-tight text-amber-300 mt-1">
                Dưới 5 °C: block lạnh dễ chạm ngưỡng chống đông (E5), máy có thể dừng liên tục
              </span>
            )}
          </div>

          <button
            onMouseDown={() => startHold(0.1)}
            onMouseUp={stopHold}
            onMouseLeave={stopHold}
            onTouchStart={() => startHold(0.1)}
            onTouchEnd={stopHold}
            disabled={!isConnected}
            className="w-12 h-12 bg-slate-800 hover:bg-slate-700 active:scale-95 disabled:opacity-40 text-cyan-300 rounded-xl flex items-center justify-center shadow transition border border-slate-700 cursor-pointer text-xl"
            aria-label="Tăng nhiệt độ"
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Primary Action Row: Power Button & Fan Mode Selector */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Large Power Button */}
        <button
          onClick={handleTogglePower}
          disabled={isPowering}
          className={`relative p-4 rounded-2xl border transition shadow-lg flex items-center justify-between group cursor-pointer ${
            isPowerOn
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 border-emerald-400/50 text-white shadow-emerald-950/40'
              : 'bg-slate-800/90 hover:bg-slate-800 border-slate-700 text-slate-300'
          }`}
        >
          <div className="flex items-center space-x-3">
            <div
              className={`p-3 rounded-xl transition ${
                isPowerOn ? 'bg-white/20 text-white' : 'bg-slate-700 text-slate-400'
              }`}
            >
              <Power className={`w-6 h-6 ${isPowerOn ? 'animate-pulse' : ''}`} />
            </div>
            <div className="text-left">
              <span className="text-xs text-slate-300 uppercase tracking-wider block font-medium">
                Hệ Thống Làm Lạnh
              </span>
              <span className="text-base font-bold text-white">
                {isPowerOn ? 'ĐANG BẬT (RUN)' : 'ĐÃ TẮT (OFF)'}
              </span>
            </div>
          </div>

          <span
            className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${
              isPowerOn
                ? 'bg-white/20 text-white border-white/30'
                : 'bg-slate-700 text-slate-300 border-slate-600'
            }`}
          >
            {isPowerOn ? 'Chạm để Tắt' : 'Chạm để Bật'}
          </span>
        </button>

        {/* Fan Mode Selector (Segmented 3-button) */}
        <div className="bg-slate-800/90 border border-slate-700 p-2.5 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between px-1 mb-1.5">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Fan className="w-3.5 h-3.5 text-cyan-400" /> Chế độ quạt
            </span>
            <span className="text-[11px] text-cyan-400 font-semibold font-mono">
              {currentFanMode === 0 ? 'Tự Động' : currentFanMode === 1 ? 'Êm Ái' : 'Mạnh / Khẩn Cấp'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1.5 bg-slate-900/80 p-1 rounded-xl">
            <button
              onClick={() => handleSetFanMode(0)}
              disabled={!isConnected}
              className={`py-2 px-1 text-xs font-semibold rounded-lg transition cursor-pointer ${
                currentFanMode === 0
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-900/40'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              Tự Động
            </button>
            <button
              onClick={() => handleSetFanMode(1)}
              disabled={!isConnected}
              className={`py-2 px-1 text-xs font-semibold rounded-lg transition cursor-pointer ${
                currentFanMode === 1
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-900/40'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              Êm (Vừa)
            </button>
            <button
              onClick={() => handleSetFanMode(2)}
              disabled={!isConnected}
              className={`py-2 px-1 text-xs font-semibold rounded-lg transition cursor-pointer ${
                currentFanMode === 2
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-900/40'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              Mạnh (Tối Đa)
            </button>
          </div>
        </div>
      </div>

      {/* 3 Component Status Cards (Sò 1 + Van, Sò 2, Quạt) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Card 1: Sò 1 + Van Nước */}
        <div
          className={`p-4 rounded-2xl border transition bg-slate-800/80 ${
            tec1Bad
              ? 'border-red-500/70 bg-red-950/20'
              : !tec1En
              ? 'border-slate-700 opacity-60'
              : tec1On
              ? 'border-cyan-500/60 shadow-lg shadow-cyan-950/20'
              : 'border-slate-700/80'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-cyan-400" />
              Sò 1 + Van Nước
            </span>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                tec1Bad
                  ? 'bg-red-500/20 text-red-300'
                  : !tec1En
                  ? 'bg-slate-700 text-slate-400'
                  : tec1On
                  ? 'bg-cyan-500/20 text-cyan-300'
                  : 'bg-slate-700/60 text-slate-400'
              }`}
            >
              {tec1Bad ? 'LỖI' : !tec1En ? 'TẮT B/TRÌ' : tec1On ? 'CHẠY' : 'NGHỈ'}
            </span>
          </div>

          <div className="space-y-1">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-slate-400">Dòng điện:</span>
              <span className="text-sm font-bold font-mono text-cyan-300">{tec1Current}</span>
            </div>
            <p className="text-[10px] text-slate-400 italic">
              {tec1On ? 'Van nước đang MỞ' : 'Van nước đang ĐÓNG'}
            </p>
          </div>
        </div>

        {/* Card 2: Sò 2 */}
        <div
          className={`p-4 rounded-2xl border transition bg-slate-800/80 ${
            tec2Bad
              ? 'border-red-500/70 bg-red-950/20'
              : !tec2En
              ? 'border-slate-700 opacity-60'
              : tec2On
              ? 'border-cyan-500/60 shadow-lg shadow-cyan-950/20'
              : 'border-slate-700/80'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-cyan-400" />
              Sò Lạnh 2
            </span>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                tec2Bad
                  ? 'bg-red-500/20 text-red-300'
                  : !tec2En
                  ? 'bg-slate-700 text-slate-400'
                  : tec2On
                  ? 'bg-cyan-500/20 text-cyan-300'
                  : 'bg-slate-700/60 text-slate-400'
              }`}
            >
              {tec2Bad ? 'LỖI' : !tec2En ? 'TẮT B/TRÌ' : tec2On ? 'CHẠY' : 'NGHỈ'}
            </span>
          </div>

          <div className="space-y-1">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-slate-400">Dòng điện:</span>
              <span className="text-sm font-bold font-mono text-cyan-300">{tec2Current}</span>
            </div>
            <p className="text-[10px] text-slate-400">
              {status?.stg === 2 ? 'Kích hoạt hỗ trợ tầng 2' : 'Sẵn sàng khi nước tăng'}
            </p>
          </div>
        </div>

        {/* Card 3: Quạt Giải Nhiệt (RPM 1 & 2 riêng) */}
        <div
          className={`p-4 rounded-2xl border transition bg-slate-800/80 ${
            fanBad1 || fanBad2
              ? 'border-red-500/70 bg-red-950/20'
              : fanPct > 0
              ? 'border-cyan-500/60 shadow-lg shadow-cyan-950/20'
              : 'border-slate-700/80'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Fan className="w-3.5 h-3.5 text-cyan-400" />
              Quạt Giải Nhiệt
            </span>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                fanBad1 || fanBad2
                  ? 'bg-red-500/20 text-red-300'
                  : fanPct > 0
                  ? 'bg-cyan-500/20 text-cyan-300'
                  : 'bg-slate-700/60 text-slate-400'
              }`}
            >
              {fanBad1 || fanBad2 ? 'LỖI QUẠT' : `${fanPct}%`}
            </span>
          </div>

          <div className="space-y-1 text-[11px]">
            <div className="flex justify-between items-center text-slate-400">
              <span>Quạt 1:</span>
              <span className="font-mono font-medium text-slate-200">
                {fanBad1 ? <span className="text-red-400 font-bold">KẸT</span> : `${fanRpm1} RPM`}
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-400">
              <span>Quạt 2:</span>
              <span className="font-mono font-medium text-slate-200">
                {fanBad2 ? <span className="text-red-400 font-bold">KẸT</span> : `${fanRpm2} RPM`}
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-400 pt-0.5 border-t border-slate-700/60">
              <span>Dòng quạt:</span>
              <span className="font-mono text-cyan-300">{formatCurrent(fanMa)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Power now + energy this month */}
      <div className="p-4 rounded-2xl border border-slate-700/80 bg-slate-800/80">
        <div className="flex items-center justify-between mb-3 gap-2">
          <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            Công Suất Điện
          </span>
          <span className="text-[10px] text-slate-400 text-right">
            Ước tính: dòng đo × {supplyV.toFixed(0)} V
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-slate-900/60 rounded-xl border border-slate-800 p-3">
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Đang tiêu thụ</div>
            <div className="text-2xl font-bold font-mono text-white mt-0.5">
              {isConnected ? `${Math.round(totalW)} W` : '—'}
            </div>
            <div className="text-[10px] text-slate-400 font-mono mt-1">
              {isConnected
                ? `Sò 1: ${Math.round(tec1W)} W · Sò 2: ${Math.round(tec2W)} W · Quạt: ${Math.round(fanW)} W`
                : 'Sò 1 · Sò 2 · Quạt'}
            </div>
          </div>

          <div className="bg-slate-900/60 rounded-xl border border-slate-800 p-3">
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Điện tháng này</div>
            <div className="text-2xl font-bold font-mono text-emerald-400 mt-0.5">
              {!isConnected || status?.kwh === undefined ? '—' : `${status.kwh.toFixed(1)} kWh`}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              {isConnected && status?.kwh === undefined
                ? 'Cần nạp firmware mới để đếm điện năng'
                : 'Máy tự đếm, sang tháng mới đếm lại từ 0'}
            </div>
          </div>
        </div>
      </div>

      {/* Manual Control Section for direct manual testing */}
      <ManualControlSection
        status={status}
        config={config}
        isConnected={isConnected}
        onOpenConnectModal={onOpenConnectModal}
        title="Bật / Tắt Thủ Công (Manual Test)"
      />

      {/* Error & Warning Card (only shown when errors or warnings exist) */}
      {parsed.activeErrors.length > 0 && (
        <div className="p-4 bg-red-950/50 border border-red-500/50 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-red-300">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
              <h4 className="font-bold text-sm">
                Hệ Thống Báo Lỗi ({parsed.activeErrors.length})
              </h4>
            </div>

            {parsed.hasLockedErrors && (
              <button
                onClick={handleClearFaults}
                disabled={isClearingFaults}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-500 active:scale-95 text-white font-semibold text-xs rounded-xl shadow flex items-center space-x-1.5 transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{isClearingFaults ? 'Đang xóa...' : 'Xóa Lỗi Khóa'}</span>
              </button>
            )}
          </div>

          <div className="space-y-2">
            {parsed.activeErrors.map((err) => (
              <div
                key={err.code}
                className={`p-3 rounded-xl border text-xs space-y-1 ${
                  err.isWarningOnly
                    ? 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                    : 'bg-red-900/30 border-red-500/30 text-red-200'
                }`}
              >
                <div className="flex items-center justify-between font-semibold">
                  <span className="flex items-center gap-1.5">
                    <span className="font-mono bg-black/40 px-1.5 py-0.5 rounded text-[11px]">
                      {err.code}
                    </span>
                    <span>{err.name}</span>
                  </span>
                  {err.isWarningOnly && (
                    <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30">
                      Cảnh báo (máy vẫn chạy)
                    </span>
                  )}
                  {err.isLocked && (
                    <span className="text-[10px] bg-red-500/30 text-red-200 px-2 py-0.5 rounded border border-red-500/40">
                      Lỗi Khóa [K]
                    </span>
                  )}
                </div>
                <p className="text-slate-300">{err.description}</p>
                <p className="text-slate-400 text-[11px]">
                  <strong>Gợi ý xử lý:</strong> {err.suggestedAction}
                </p>
                {err.steps.length > 0 && (
                  <details className="text-[11px] text-slate-300">
                    <summary className="cursor-pointer select-none font-semibold text-slate-200">
                      Cách xử lý từng bước
                    </summary>
                    <ol className="list-decimal pl-5 mt-1.5 space-y-1">
                      {err.steps.map((st, i) => (
                        <li key={i}>{st}</li>
                      ))}
                    </ol>
                  </details>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Secondary Heatsink & Cold Block Temperature Pills (Discreet at bottom) */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-3 flex flex-wrap items-center justify-around gap-y-2 text-xs text-slate-400">
        <div className="flex items-center space-x-2">
          <Thermometer className="w-4 h-4 text-cyan-400" />
          <span>
            T2 Block lạnh:{' '}
            <strong className="text-slate-200 font-mono">
              {!isConnected
                ? '—'
                : status?.c === null || status?.c === undefined
                ? 'Lỗi'
                : `${status.c.toFixed(1)} °C`}
            </strong>
          </span>
        </div>

        <div className="w-px h-4 bg-slate-800" />

        <div className="flex items-center space-x-2">
          <Thermometer className="w-4 h-4 text-amber-400" />
          <span>
            T3 Cục nóng:{' '}
            <strong
              className={`font-mono ${
                (status?.h ?? 0) >= (config?.hot_red ?? 65)
                  ? 'text-red-400 font-bold'
                  : 'text-slate-200'
              }`}
            >
              {!isConnected
                ? '—'
                : status?.h === null || status?.h === undefined
                ? 'Lỗi'
                : `${status.h.toFixed(1)} °C`}
            </strong>
          </span>
        </div>

        <div className="w-px h-4 bg-slate-800" />

        <div className="flex items-center space-x-2">
          <Thermometer className="w-4 h-4 text-amber-400" />
          <span>
            T4 Cục nóng 2:{' '}
            <strong
              className={`font-mono ${
                (status?.h2 ?? 0) >= (config?.hot_red ?? 65)
                  ? 'text-red-400 font-bold'
                  : 'text-slate-200'
              }`}
            >
              {!isConnected || status?.h2 === undefined
                ? '—'
                : status.h2 === null
                ? 'Lỗi'
                : `${status.h2.toFixed(1)} °C`}
            </strong>
          </span>
        </div>

      </div>

      {/* Power Off Confirmation Modal */}
      {showPowerOffConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl p-5 text-slate-100 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-amber-400">
              <div className="p-2.5 bg-amber-500/20 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-base text-white">Xác nhận tắt làm lạnh?</h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Khi tắt làm lạnh, sò sẽ ngắt ngay và quạt sẽ tiếp tục giải nhiệt khoảng vài chục giây trước khi tắt hẳn để bảo vệ sò lạnh.
            </p>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={() => setShowPowerOffConfirm(false)}
                className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                Hủy Bỏ
              </button>
              <button
                onClick={confirmPowerOff}
                className="py-2.5 px-3 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-xl shadow transition cursor-pointer"
              >
                Đồng Ý Tắt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
