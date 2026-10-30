/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Gauge, CheckCircle2, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { ChillerConfig, ChillerStatus, formatCurrent } from '../types/system';
import { bleManager } from '../services/bleService';

interface Props {
  status: ChillerStatus | null;
  config: ChillerConfig | null;
  isConnected: boolean;
}

// 3 kenh ACS712: 0 quat, 1 so 1 (+ van nuoc), 2 so 2 - so thu tu = "ch" cua lenh ACS_CAL
const CHANNELS = ['Quạt', 'Sò 1 + van', 'Sò 2'] as const;
const E11 = 1 << 10;
const E12 = 1 << 11;

/** Hieu chuan cam bien dong ACS712: buoc 1 do 0 A, buoc 2 chinh he so theo ampe kim. */
export const CurrentCalibration: React.FC<Props> = ({ status, config, isConnected }) => {
  const [busy, setBusy] = useState<'zero' | 'gain' | null>(null);
  const [ch, setCh] = useState<0 | 1 | 2>(1);
  const [clampA, setClampA] = useState<string>('');
  const [showAdv, setShowAdv] = useState(false);
  const [k, setK] = useState<[number, number, number]>([82.7, 82.7, 82.7]);

  useEffect(() => {
    if (config?.k_f !== undefined) setK([config.k_f, config.k_p1, config.k_p2]);
  }, [config?.k_f, config?.k_p1, config?.k_p2]);

  // [co ket noi ACS712, dong mA, tai dang chay]
  const chan = (i: number): [boolean, number, boolean] => {
    if (!status) return [false, 0, false];
    if (i === 0) return [status.f.cur === 1, status.f.ma, status.f.pct > 0];
    const r = status.p[i - 1];
    return [r[3] === 1, r[4], r[0] === 1];
  };
  const err = status?.err ?? 0;
  const [selConn, selMa, selOn] = chan(ch);

  const doZero = async () => {
    setBusy('zero');
    try {
      await bleManager.zeroAcs(); // May tu tat quat + so ~3 s, do xong tu chay lai
    } catch (e) {
      console.warn('ACS_ZERO failed', e);
    } finally {
      setBusy(null);
    }
  };

  const doGain = async () => {
    const a = parseFloat(clampA.replace(',', '.'));
    if (!(a > 0)) return;
    setBusy('gain');
    try {
      const ack = await bleManager.calAcs(ch, Math.round(a * 1000));
      if (ack.ok) setClampA('');
    } catch (e) {
      console.warn('ACS_CAL failed', e);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-5 shadow-lg space-y-4">
      <div className="flex items-center space-x-2.5 pb-3 border-b border-slate-700">
        <div className="p-2 bg-teal-500/20 text-teal-400 rounded-lg">
          <Gauge className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-bold text-white text-base">Hiệu Chuẩn Cảm Biến Dòng</h3>
          <p className="text-xs text-slate-400">3 cảm biến ACS712-20A: quạt, sò 1 (gồm van nước), sò 2</p>
        </div>
      </div>

      {/* Dong do duoc luc nay */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        {CHANNELS.map((name, i) => {
          const [conn, ma, on] = chan(i);
          return (
            <div key={name} className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 text-center">
              <span className="text-slate-400 block">{name}</span>
              <span className={`font-mono font-bold text-sm ${conn ? 'text-cyan-300' : 'text-red-400'}`}>
                {conn ? formatCurrent(ma) : 'Mất kết nối'}
              </span>
              <span className="block text-[10px] text-slate-500">{on ? 'tải đang chạy' : 'tải đang tắt'}</span>
            </div>
          );
        })}
      </div>

      {(err & E11) !== 0 && (
        <div className="p-3 bg-amber-950/40 border border-amber-600/40 rounded-xl text-[11px] text-amber-200 space-y-2">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
            <span>
              <b>E11 (sò tắt vẫn có dòng)</b> ngay khi bật máy thường do <b>điểm 0 A chưa đúng</b>, không phải MOSFET hỏng.
              Làm Bước 1 rồi bấm Xóa lỗi. Nếu sò thật sự kẹt, máy sẽ báo không đo được và E11 quay lại.
            </span>
          </div>
          <button
            onClick={() => bleManager.clearFaults().catch(() => undefined)}
            disabled={!isConnected}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white font-semibold rounded-lg cursor-pointer"
          >
            Xóa lỗi
          </button>
        </div>
      )}
      {(err & E12) !== 0 && (
        <p className="p-2.5 bg-red-950/40 border border-red-500/40 rounded-xl text-[11px] text-red-300">
          E12: có cảm biến dòng của sò mất kết nối (ô đỏ ở trên) – kiểm tra dây ACS712 / cầu chia áp, hiệu chuẩn không sửa được lỗi này.
        </p>
      )}

      {/* Buoc 1 */}
      <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <span className="text-xs font-bold text-slate-200 block">Bước 1 · Đo điểm 0 A</span>
            <p className="text-[11px] text-slate-400">
              Máy tự tắt quạt và sò khoảng 3 giây để đo, xong tự chạy lại. Máy cũng tự đo mỗi lần khởi động.
            </p>
          </div>
          <button
            onClick={doZero}
            disabled={!isConnected || busy !== null}
            className="px-3.5 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 text-white font-semibold text-xs rounded-xl shadow transition cursor-pointer shrink-0"
          >
            {busy === 'zero' ? 'Đang đo…' : 'Đo 0 A'}
          </button>
        </div>
        <div className="text-[10px] text-slate-500 font-mono">
          0 A hiện tại: quạt {config?.z_f ?? '—'} V · sò 1 {config?.z_p1 ?? '—'} V · sò 2 {config?.z_p2 ?? '—'} V
        </div>
      </div>

      {/* Buoc 2 */}
      <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-3">
        <div>
          <span className="text-xs font-bold text-slate-200 block">Bước 2 · Chỉnh theo ampe kìm (không bắt buộc)</span>
          <p className="text-[11px] text-slate-400">
            Bật tải ở mục <b>Điều khiển thủ công</b> (vd Sò 1 + quạt 60%), kẹp ampe kìm vào <b>đúng dây đi qua cảm biến</b>{' '}
            (dây sò 1 gồm cả van), chờ số ổn định 5 giây rồi nhập số ampe kìm.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-1.5 text-xs">
          {CHANNELS.map((name, i) => (
            <button
              key={name}
              onClick={() => setCh(i as 0 | 1 | 2)}
              className={`py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                ch === i ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {name}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">App đang đọc:</span>
          <span className="font-mono font-bold text-cyan-300">{selConn ? formatCurrent(selMa) : '—'}</span>
        </div>
        {!selOn && <p className="text-[11px] text-amber-300">Tải {CHANNELS[ch]} đang tắt – bật lên trước khi hiệu chỉnh.</p>}
        <div className="flex gap-2">
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min={0}
            placeholder="Ampe kìm đo được (A)"
            value={clampA}
            onChange={(e) => setClampA(e.target.value)}
            className="flex-1 min-w-0 bg-slate-950 border border-slate-700 rounded-lg p-2 font-mono text-cyan-300"
          />
          <button
            onClick={doGain}
            disabled={!isConnected || busy !== null || !(parseFloat(clampA.replace(',', '.')) > 0)}
            className="px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white font-semibold text-xs rounded-xl shadow transition cursor-pointer shrink-0"
          >
            {busy === 'gain' ? 'Đang chỉnh…' : 'Hiệu chỉnh'}
          </button>
        </div>
      </div>

      {/* Nang cao: sua tay he so */}
      <button
        onClick={() => setShowAdv((v) => !v)}
        className="w-full flex items-center justify-between text-[11px] text-slate-400 hover:text-slate-200 cursor-pointer"
      >
        <span>Nâng cao: sửa tay hệ số (số đếm / 1 A)</span>
        {showAdv ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {showAdv && (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2 text-xs">
            {CHANNELS.map((name, i) => (
              <div key={name} className="bg-slate-950/60 p-2 rounded-xl border border-slate-800 text-center">
                <span className="text-slate-400 block mb-1">{name}</span>
                <input
                  type="number"
                  step="0.1"
                  min={33}
                  max={207}
                  value={k[i]}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value) || 0;
                    setK((prev) => prev.map((x, j) => (j === i ? v : x)) as [number, number, number]);
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-1 text-center font-mono text-cyan-300 font-bold"
                />
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-slate-500">Mặc định 82.7 (ACS712-20A). Máy giới hạn 33 – 207.</span>
            <button
              onClick={() => bleManager.setConfig({ k_f: k[0], k_p1: k[1], k_p2: k[2] }).catch(() => undefined)}
              disabled={!isConnected}
              className="px-3 py-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white text-xs rounded-lg cursor-pointer flex items-center gap-1"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Lưu hệ số
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
