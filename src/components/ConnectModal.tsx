/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Bluetooth, Sparkles, Smartphone, ShieldCheck, AlertCircle, Eye, EyeOff, X } from 'lucide-react';
import { bleManager } from '../services/bleService';

interface ConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnectBle: () => Promise<void>;
  onStartDemo: () => void;
}

export const ConnectModal: React.FC<ConnectModalProps> = ({
  isOpen,
  onClose,
  onConnectBle,
  onStartDemo,
}) => {
  const [pin, setPin] = useState<string>(() => bleManager.getSavedPin());
  const [showPin, setShowPin] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const isBtSupported = bleManager.isBluetoothSupported();

  const handleConnectBle = async () => {
    setIsConnecting(true);
    setErrorMsg(null);
    try {
      bleManager.setSavedPin(pin.trim() || '1234');
      await onConnectBle();
      onClose();
    } catch (err: unknown) {
      const error = err as Error;
      if (error.name !== 'NotFoundError') {
        setErrorMsg(error.message || 'Không thể kết nối Bluetooth');
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDemo = () => {
    bleManager.setSavedPin(pin.trim() || '1234');
    onStartDemo();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 text-slate-100 max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          aria-label="Đóng"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center space-x-3 mb-5">
          <div className="p-3 bg-cyan-500/20 text-cyan-400 rounded-xl border border-cyan-500/30">
            <Bluetooth className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-wide">Kết Nối CITO CHILLER</h2>
            <p className="text-xs text-slate-400">Giao thức Web Bluetooth 2.0.0</p>
          </div>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 bg-red-950/60 border border-red-500/50 rounded-xl text-red-200 text-sm flex items-start space-x-2">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* PIN Configuration */}
        <div className="mb-5 bg-slate-800/80 p-4 rounded-xl border border-slate-700/80">
          <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-cyan-400" /> Mã PIN máy (mặc định 1234)
            </span>
            <span className="text-[10px] text-slate-400">4–8 ký tự</span>
          </label>
          <div className="relative">
            <input
              type={showPin ? 'text' : 'password'}
              maxLength={8}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="1234"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-base tracking-widest font-mono text-cyan-300 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
            />
            <button
              type="button"
              onClick={() => setShowPin(!showPin)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
            >
              {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-[11px] text-slate-400 mt-1.5">
            Mã PIN được lưu trên trình duyệt của bạn để tự động xác thực khi kết nối.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 mb-6">
          <button
            onClick={handleConnectBle}
            disabled={isConnecting}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white font-semibold rounded-xl shadow-lg shadow-cyan-900/30 flex items-center justify-center space-x-2 transition cursor-pointer"
          >
            <Bluetooth className="w-5 h-5" />
            <span>{isConnecting ? 'Đang dò tìm thiết bị...' : 'Tìm & Kết nối Bluetooth'}</span>
          </button>

          <button
            onClick={handleDemo}
            className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300 hover:text-cyan-200 font-medium rounded-xl flex items-center justify-center space-x-2 transition cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span>Mở Chế Độ Dùng Thử (Demo)</span>
          </button>
        </div>

        {/* Compatibility and Guidelines */}
        <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 text-xs text-slate-400 space-y-2">
          <div className="flex items-center text-slate-300 font-medium space-x-2">
            <Smartphone className="w-4 h-4 text-cyan-400" />
            <span>Hướng dẫn tương thích trình duyệt:</span>
          </div>

          <ul className="list-disc list-inside space-y-1 text-slate-400 pl-1 leading-relaxed">
            <li>
              <strong className="text-slate-300">Máy tính / Android:</strong> Dùng trình duyệt Google Chrome, Edge, hoặc Opera.
            </li>
            <li>
              <strong className="text-slate-300">iPhone / iPad:</strong> Safari không hỗ trợ Web Bluetooth. Hãy tải app miễn phí <strong className="text-cyan-300">Bluefy</strong> trên App Store và mở trang web này bên trong Bluefy.
            </li>
            <li>
              Tên thiết bị sẽ hiển thị dạng: <code className="text-cyan-300 bg-slate-900 px-1 py-0.5 rounded">CITO-CH-XXXX</code>.
            </li>
          </ul>

          {!isBtSupported && (
            <div className="mt-3 p-2.5 bg-amber-950/40 border border-amber-600/40 rounded-lg text-amber-300 text-[11px] leading-tight">
              Trình duyệt hiện tại chưa hỗ trợ Web Bluetooth. Bạn có thể bấm nút &quot;Chế Độ Dùng Thử&quot; ở trên để trải nghiệm mọi chức năng!
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
