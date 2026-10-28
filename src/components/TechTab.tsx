/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  Wrench,
  Gauge,
  Wifi,
  Cpu,
  RotateCw,
  Terminal,
  ShieldCheck,
  AlertTriangle,
  Play,
  Square,
  Sliders,
  ExternalLink,
  RefreshCw,
  Lock,
  Zap,
  CheckCircle,
} from 'lucide-react';
import { ChillerConfig, ChillerStatus, formatCurrent } from '../types/system';
import { bleManager } from '../services/bleService';
import { ManualControlSection } from './ManualControlSection';

interface TechTabProps {
  status: ChillerStatus | null;
  config: ChillerConfig | null;
  wifiList: [string, number, number][];
  isConnected: boolean;
  isDemo: boolean;
}

export const TechTab: React.FC<TechTabProps> = ({
  status,
  config,
  wifiList,
  isConnected,
  isDemo,
}) => {
  // Calibration inputs
  const [offW, setOffW] = useState<number>(config?.off_w ?? 0);
  const [offC, setOffC] = useState<number>(config?.off_c ?? 0);
  const [offH, setOffH] = useState<number>(config?.off_h ?? 0);
  const [kF, setKF] = useState<number>(config?.k_f ?? 82.7);
  const [kP1, setKP1] = useState<number>(config?.k_p1 ?? 82.7);
  const [kP2, setKP2] = useState<number>(config?.k_p2 ?? 82.7);
  const [isCalibratingZero, setIsCalibratingZero] = useState<boolean>(false);

  // Gia tri trong o lay theo may moi khi goi "cf" doi (mo tab truoc khi co cf, hoac doi tren may).
  // Khong dong bo -> o dang la 0 / 82.7 mac dinh, bam Luu se GHI DE gia tri that cua may.
  useEffect(() => {
    if (config?.off_w !== undefined) setOffW(config.off_w);
    if (config?.off_c !== undefined) setOffC(config.off_c);
    if (config?.off_h !== undefined) setOffH(config.off_h);
  }, [config?.off_w, config?.off_c, config?.off_h]);
  useEffect(() => {
    if (config?.k_f !== undefined) setKF(config.k_f);
    if (config?.k_p1 !== undefined) setKP1(config.k_p1);
    if (config?.k_p2 !== undefined) setKP2(config.k_p2);
  }, [config?.k_f, config?.k_p1, config?.k_p2]);

  // WiFi inputs
  const [selectedSsid, setSelectedSsid] = useState<string>('');
  const [wifiPass, setWifiPass] = useState<string>('');
  const [isScanningWifi, setIsScanningWifi] = useState<boolean>(false);

  // PIN input
  const [newPin, setNewPin] = useState<string>('');

  // Sim command input
  const [simLine, setSimLine] = useState<string>('');

  // Modals
  const [confirmModal, setConfirmModal] = useState<{
    type: 'reboot' | 'defaults';
    title: string;
    message: string;
  } | null>(null);

  const isTestActive = (status?.tst?.on ?? 0) === 1;
  const testSecondsLeft = status?.tst?.left ?? 0;

  // Format uptime into human-readable string
  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  };

  // Humanize reset reason
  const getResetDescription = (rst?: string) => {
    if (!rst) return 'Khởi động bình thường';
    if (rst === 'POWERON') return 'Cắm điện nguồn mới (POWERON)';
    if (rst === 'SW') return 'Khởi động lại bằng phần mềm (SW)';
    if (rst === 'WDT') return 'Máy từng bị treo, Watchdog tự khởi động lại (WDT)';
    if (rst === 'PANIC') return 'Phần mềm lỗi nghiêm trọng (PANIC)';
    if (rst === 'BROWNOUT') return 'Nguồn điện 12V từng bị sụt áp đột ngột (BROWNOUT)';
    return `Lý do: ${rst}`;
  };

  // Calibration offsets
  const handleSaveTempOffsets = async () => {
    if (!isConnected) return;
    try {
      await bleManager.setConfig({
        off_w: offW,
        off_c: offC,
        off_h: offH,
      });
    } catch (e) {
      console.warn('Failed to save offsets', e);
    }
  };

  // He so ACS712 (so dem ADC / 1 A), may ep vao 33 - 207
  const handleSaveAcsK = async () => {
    if (!isConnected) return;
    try {
      await bleManager.setConfig({ k_f: kF, k_p1: kP1, k_p2: kP2 });
    } catch (e) {
      console.warn('Failed to save ACS factors', e);
    }
  };

  // Zero ACS712
  const handleAcsZero = async () => {
    if (!isConnected) return;
    setIsCalibratingZero(true);
    try {
      await bleManager.zeroAcs();
    } finally {
      setIsCalibratingZero(false);
    }
  };

  // WiFi operations
  const handleScanWifi = async () => {
    if (!isConnected) return;
    setIsScanningWifi(true);
    try {
      await bleManager.scanWifi();
    } finally {
      setIsScanningWifi(false);
    }
  };

  const handleSaveWifi = async () => {
    if (!isConnected || !selectedSsid) return;
    await bleManager.setWifi(selectedSsid, wifiPass);
    setWifiPass('');
  };

  const handleClearWifi = async () => {
    if (!isConnected) return;
    await bleManager.clearWifi();
  };

  // Change PIN
  const handleSetPin = async () => {
    if (!isConnected || !newPin) return;
    await bleManager.setPin(newPin.trim());
    setNewPin('');
  };

  // Simulation quick buttons
  const handleSimQuick = async (cmd: string) => {
    if (!isConnected) return;
    await bleManager.sendSim(cmd);
  };

  const handleSimCustom = async () => {
    if (!isConnected || !simLine.trim()) return;
    await bleManager.sendSim(simLine.trim());
    setSimLine('');
  };

  // Reboot / Defaults execution
  const executeConfirmedAction = async () => {
    if (!confirmModal || !isConnected) return;
    if (confirmModal.type === 'reboot') {
      await bleManager.reboot();
    } else if (confirmModal.type === 'defaults') {
      await bleManager.restoreDefaults();
    }
    setConfirmModal(null);
  };

  const areLoadsOff =
    (status?.p?.[0]?.[0] ?? 0) === 0 &&
    (status?.p?.[1]?.[0] ?? 0) === 0 &&
    (status?.f?.pct ?? 0) === 0;

  return (
    <div className="space-y-5 max-w-xl mx-auto pb-10">
      {/* 1. MANUAL TEST & COMPONENT CONTROLS */}
      <ManualControlSection
        status={status}
        config={config}
        isConnected={isConnected}
        title="Kiểm Tra Trực Tiếp (TEST)"
      />

      {/* 2. CALIBRATION & SENSORS */}
      <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex items-center space-x-2.5 pb-3 border-b border-slate-700">
          <div className="p-2 bg-teal-500/20 text-teal-400 rounded-lg">
            <Gauge className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-white text-base">Hiệu Chuẩn Cảm Biến</h3>
            <p className="text-xs text-slate-400">Bù nhiệt độ và chỉnh cảm biến dòng ACS712</p>
          </div>
        </div>

        {/* Temperature offsets */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
              Bù Sai Số Nhiệt Độ (−10 đến +10 °C)
            </span>
            <button
              onClick={handleSaveTempOffsets}
              disabled={!isConnected}
              className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white text-xs font-medium rounded-lg transition"
            >
              Lưu Bù Nhiệt
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800 text-center">
              <span className="text-slate-400 block mb-1">T1 Nước</span>
              <input
                type="number"
                step="0.1"
                min={-10}
                max={10}
                value={offW}
                onChange={(e) => setOffW(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-950 border border-slate-700 rounded p-1 text-center font-mono text-cyan-300 font-bold"
              />
            </div>

            <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800 text-center">
              <span className="text-slate-400 block mb-1">T2 Block</span>
              <input
                type="number"
                step="0.1"
                min={-10}
                max={10}
                value={offC}
                onChange={(e) => setOffC(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-950 border border-slate-700 rounded p-1 text-center font-mono text-cyan-300 font-bold"
              />
            </div>

            <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800 text-center">
              <span className="text-slate-400 block mb-1">T3 Cục Nóng</span>
              <input
                type="number"
                step="0.1"
                min={-10}
                max={10}
                value={offH}
                onChange={(e) => setOffH(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-950 border border-slate-700 rounded p-1 text-center font-mono text-cyan-300 font-bold"
              />
            </div>
          </div>
        </div>

        {/* ACS712 Zero Calibration */}
        <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-200 block">
                Đo Điểm 0 A Cảm Biến Dòng (ACS_ZERO)
              </span>
              <p className="text-[11px] text-slate-400">
                Lấy lại điểm điện áp 0A tĩnh cho cả 3 cảm biến ACS712 (Quạt, Sò 1, Sò 2).
              </p>
            </div>
            <button
              onClick={handleAcsZero}
              disabled={!isConnected || !areLoadsOff || isCalibratingZero}
              className="px-3.5 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-30 disabled:hover:bg-teal-600 text-white font-semibold text-xs rounded-xl shadow transition cursor-pointer shrink-0 ml-3"
            >
              {isCalibratingZero ? 'Đang đo...' : 'Đo Điểm 0A'}
            </button>
          </div>

          {!areLoadsOff && isConnected && (
            <p className="text-[11px] text-amber-300 bg-amber-950/40 p-2 rounded border border-amber-600/30">
              * Nút bị khóa: Hãy tắt làm lạnh (quạt và sò đều dừng hẳn) thì máy mới cho phép đo 0A.
            </p>
          )}

          <div className="text-[11px] text-slate-400 border-t border-slate-800 pt-2 space-y-1 font-mono">
            <div>Điện áp 0A hiện tại: z_f={config?.z_f ?? '—'}V | z_p1={config?.z_p1 ?? '—'}V | z_p2={config?.z_p2 ?? '—'}V</div>
          </div>

          {/* He so ACS712: chinh theo ampe kim */}
          <div className="space-y-2 border-t border-slate-800 pt-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold text-slate-200">Hệ số cảm biến dòng (số đếm / 1 A)</span>
              <button
                onClick={handleSaveAcsK}
                disabled={!isConnected}
                className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white text-xs font-medium rounded-lg transition"
              >
                Lưu Hệ Số
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              {(
                [
                  ['Quạt', kF, setKF],
                  ['Sò 1 + van', kP1, setKP1],
                  ['Sò 2', kP2, setKP2],
                ] as [string, number, (v: number) => void][]
              ).map(([label, val, set]) => (
                <div key={label} className="bg-slate-950/60 p-2 rounded-xl border border-slate-800 text-center">
                  <span className="text-slate-400 block mb-1">{label}</span>
                  <input
                    type="number"
                    step="0.1"
                    min={33}
                    max={207}
                    value={val}
                    onChange={(e) => set(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-1 text-center font-mono text-cyan-300 font-bold"
                  />
                </div>
              ))}
            </div>
            <div className="text-[11px] text-cyan-400/90 italic">
              Chạy 1 tải ở mục Kiểm tra, đo bằng ampe kìm: Hệ số mới = Hệ số cũ × (Dòng trên App / Dòng ampe kìm).
              Mặc định 82.7 (ACS712-20A).
            </div>
          </div>
        </div>
      </div>

      {/* 3. SIMULATION CONTROLS (Only visible if st.sim = 1 or Demo mode) */}
      {((status?.sim ?? 0) === 1 || isDemo) && (
        <div className="bg-amber-950/20 border border-amber-500/40 rounded-2xl p-5 shadow-lg space-y-3">
          <div className="flex items-center space-x-2 text-amber-300">
            <Terminal className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-base">Bộ Giả Lập Cảm Biến & Lỗi (SIM)</h3>
          </div>
          <p className="text-xs text-slate-400">
            Đang kích hoạt chế độ SIM. Dùng các nút nhanh dưới đây để thử phản ứng của hệ thống:
          </p>

          <div className="flex flex-wrap gap-2 text-xs">
            <button
              onClick={() => handleSimQuick('w x')}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-lg border border-slate-700 cursor-pointer"
            >
              w x (Lỗi T1 nước)
            </button>
            <button
              onClick={() => handleSimQuick('h 75')}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-red-300 rounded-lg border border-slate-700 cursor-pointer"
            >
              h 75 (Quá nhiệt E4)
            </button>
            <button
              onClick={() => handleSimQuick('h ok')}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-300 rounded-lg border border-slate-700 cursor-pointer"
            >
              h ok (Nguội 38°C)
            </button>
            <button
              onClick={() => handleSimQuick('f1 x')}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-red-300 rounded-lg border border-slate-700 cursor-pointer"
            >
              f1 x (Kẹt Quạt 1 E6)
            </button>
            <button
              onClick={() => handleSimQuick('p1 o')}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-red-300 rounded-lg border border-slate-700 cursor-pointer"
            >
              p1 o (Đứt Sò 1 E9)
            </button>
            <button
              onClick={() => handleSimQuick('p1 ok')}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-300 rounded-lg border border-slate-700 cursor-pointer"
            >
              p1 ok (Sò 1 OK)
            </button>
            <button
              onClick={() => handleSimQuick('f ok')}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-300 rounded-lg border border-slate-700 cursor-pointer"
            >
              f ok (Quạt OK)
            </button>
            <button
              onClick={() => handleSimQuick('clear')}
              className="px-2.5 py-1.5 bg-cyan-900/40 hover:bg-cyan-800/40 text-cyan-200 rounded-lg border border-cyan-700/50 cursor-pointer"
            >
              Khôi phục SIM chuẩn
            </button>
          </div>

          <div className="flex gap-2 pt-1">
            <input
              type="text"
              placeholder="Nhập lệnh SIM, ví dụ: w 23.5 hoặc h 45"
              value={simLine}
              onChange={(e) => setSimLine(e.target.value)}
              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
            />
            <button
              onClick={handleSimCustom}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs rounded-lg transition"
            >
              Gửi SIM
            </button>
          </div>
        </div>
      )}

      {/* 4. WIFI & FIRMWARE OTA */}
      <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-700">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg">
              <Wifi className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">WiFi & Nạp Firmware OTA</h3>
              <p className="text-xs text-slate-400">Chỉ dùng WiFi để cập nhật firmware không dây</p>
            </div>
          </div>

          <button
            onClick={handleScanWifi}
            disabled={!isConnected || isScanningWifi}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-semibold rounded-xl flex items-center space-x-1.5 transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScanningWifi ? 'animate-spin' : ''}`} />
            <span>{isScanningWifi ? 'Đang quét...' : 'Quét WiFi'}</span>
          </button>
        </div>

        {/* Current WiFi Status */}
        <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
          <div>
            <span className="text-slate-400 block">Mạng đã kết nối:</span>
            <span className="font-semibold text-white font-mono">
              {config?.ssid || 'Chưa cài đặt'}
            </span>
          </div>

          <div className="text-right">
            <span className="text-slate-400 block">Địa chỉ IP máy:</span>
            <span className="font-semibold text-cyan-300 font-mono">
              {status?.wifi?.ip || '192.168.4.1'}
            </span>
          </div>

          {config?.ssid && (
            <button
              onClick={handleClearWifi}
              disabled={!isConnected}
              className="text-xs text-red-400 hover:text-red-300 ml-2"
            >
              Xóa WiFi
            </button>
          )}
        </div>

        {/* WiFi Scan Result List */}
        {wifiList.length > 0 && (
          <div className="space-y-1.5 max-h-44 overflow-y-auto bg-slate-950 p-2 rounded-xl border border-slate-800">
            <span className="text-[10px] uppercase font-semibold text-slate-400 px-1 block">
              Chọn mạng WiFi tìm thấy ({wifiList.length}):
            </span>
            {wifiList.map(([ssid, rssi, hasPass]) => (
              <button
                key={ssid}
                onClick={() => setSelectedSsid(ssid)}
                className={`w-full text-left p-2 rounded-lg text-xs flex items-center justify-between transition cursor-pointer ${
                  selectedSsid === ssid
                    ? 'bg-blue-600/30 border border-blue-500 text-white'
                    : 'hover:bg-slate-800 text-slate-300'
                }`}
              >
                <span className="font-mono">{ssid}</span>
                <span className="text-[10px] text-slate-400">
                  {rssi} dBm {hasPass ? '🔒' : '🔓'}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Connect WiFi Form */}
        {selectedSsid && (
          <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-700 space-y-2">
            <div className="text-xs text-slate-300">
              Nhập mật khẩu cho WiFi: <strong className="text-cyan-300 font-mono">{selectedSsid}</strong>
            </div>
            <div className="flex gap-2">
              <input
                type="password"
                placeholder="Mật khẩu WiFi (bỏ trống nếu giữ cũ)"
                value={wifiPass}
                onChange={(e) => setWifiPass(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
              />
              <button
                onClick={handleSaveWifi}
                className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold rounded-lg"
              >
                Lưu WiFi
              </button>
            </div>
          </div>
        )}

        {/* OTA Instruction Banner */}
        <div className="p-3.5 bg-slate-950/70 rounded-xl border border-slate-800 text-xs text-slate-400 space-y-2">
          <div className="flex items-center text-slate-300 font-medium space-x-1.5">
            <ExternalLink className="w-4 h-4 text-cyan-400" />
            <span>Cách nạp firmware OTA cho máy CITO:</span>
          </div>
          <p className="text-[11px] leading-relaxed">
            1. Kết nối điện thoại hoặc máy tính vào WiFi phát từ máy: tên <strong className="text-cyan-300 font-mono">{config?.ap || 'CITO-CH-XXXX'}</strong> (mật khẩu <code className="text-cyan-300">citocito</code>).<br />
            2. Mở trình duyệt web truy cập địa chỉ IP: <code className="text-cyan-300 font-mono">http://{status?.wifi?.ip || '192.168.4.1'}</code> để chọn file binary nạp.<br />
            * <strong className="text-amber-300">Lưu ý:</strong> Nạp firmware chỉ thực hiện qua WiFi web server của chip, không qua sóng Bluetooth.
          </p>
        </div>
      </div>

      {/* 5. MACHINE INFO & SYSTEM STATUS */}
      <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-5 shadow-lg space-y-3">
        <div className="flex items-center space-x-2.5 pb-3 border-b border-slate-700">
          <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-white text-base">Thông Tin Thiết Bị</h3>
            <p className="text-xs text-slate-400">Phiên bản và tình trạng phần cứng</p>
          </div>
        </div>

        {config?.pend === 1 && (
          <div className="p-3 bg-amber-950/40 border border-amber-500/40 rounded-xl text-amber-200 text-xs flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Firmware mới nạp, đang trong thời gian chờ xác nhận 60 giây.</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
            <span className="text-slate-400 block text-[11px]">Phiên bản Firmware:</span>
            <span className="font-mono font-semibold text-slate-200">{config?.fw || '—'}</span>
          </div>

          <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
            <span className="text-slate-400 block text-[11px]">Mã định danh (MAC):</span>
            <span className="font-mono font-semibold text-cyan-300">{config?.dev || '—'}</span>
          </div>

          <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
            <span className="text-slate-400 block text-[11px]">Thời gian hoạt động:</span>
            <span className="font-mono font-semibold text-slate-200">
              {status?.up !== undefined ? formatUptime(status.up) : '—'}
            </span>
          </div>

          <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
            <span className="text-slate-400 block text-[11px]">Bộ nhớ RAM trống:</span>
            <span className="font-mono font-semibold text-slate-200">
              {status?.heap ? `${Math.round(status.heap / 1024)} KB` : '—'}
            </span>
          </div>
        </div>

        <div className="p-2.5 bg-slate-900/60 rounded-xl border border-slate-800 text-xs">
          <span className="text-slate-400 block text-[11px]">Lần khởi động gần nhất:</span>
          <span className="font-semibold text-slate-200">
            {getResetDescription(config?.rst)}
          </span>
        </div>
      </div>

      {/* 6. SECURITY & MAINTENANCE CONTROLS */}
      <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex items-center space-x-2.5 pb-3 border-b border-slate-700">
          <div className="p-2 bg-slate-700 text-slate-300 rounded-lg">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-white text-base">Quản Trị Thiết Bị</h3>
            <p className="text-xs text-slate-400">Đổi PIN, khôi phục gốc và khởi động lại</p>
          </div>
        </div>

        {/* Change PIN */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
            Đổi Mã PIN Mới (4–8 ký tự)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              maxLength={8}
              placeholder="Nhập mã PIN mới..."
              value={newPin}
              onChange={(e) => setNewPin(e.target.value)}
              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-cyan-300"
            />
            <button
              onClick={handleSetPin}
              disabled={!isConnected || newPin.trim().length < 4}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white font-semibold text-xs rounded-xl shadow transition"
            >
              Lưu PIN
            </button>
          </div>
        </div>

        {/* Actions: Reboot and Defaults */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            onClick={() =>
              setConfirmModal({
                type: 'defaults',
                title: 'Khôi phục cài đặt gốc?',
                message:
                  'Mọi thông số kỹ thuật sẽ quay về mặc định của nhà sản xuất (giữ nguyên WiFi và hiệu chuẩn cảm biến dòng). Bạn có chắc chắn muốn khôi phục không?',
              })
            }
            disabled={!isConnected}
            className="p-3 bg-slate-900 hover:bg-slate-700/80 disabled:opacity-40 text-amber-300 border border-amber-600/30 rounded-xl text-xs font-semibold transition cursor-pointer"
          >
            Về Cài Đặt Gốc
          </button>

          <button
            onClick={() =>
              setConfirmModal({
                type: 'reboot',
                title: 'Khởi động lại máy CITO CHILLER?',
                message:
                  'Máy sẽ ngắt kết nối Bluetooth và khởi động lại sau 0.8 giây. Trình duyệt sẽ tự động kết nối lại khi máy phát sóng.',
              })
            }
            disabled={!isConnected}
            className="p-3 bg-slate-900 hover:bg-slate-700/80 disabled:opacity-40 text-cyan-300 border border-cyan-600/30 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center justify-center space-x-1.5"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>Khởi Động Lại</span>
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl p-5 text-slate-100 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-amber-400">
              <div className="p-2.5 bg-amber-500/20 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-base text-white">{confirmModal.title}</h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">{confirmModal.message}</p>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={() => setConfirmModal(null)}
                className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                Hủy Bỏ
              </button>
              <button
                onClick={executeConfirmedAction}
                className="py-2.5 px-3 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-xl shadow transition cursor-pointer"
              >
                Xác Nhận
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
