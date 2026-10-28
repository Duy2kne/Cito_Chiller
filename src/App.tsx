/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  ThermometerSnowflake,
  Sliders,
  Wrench,
  Bluetooth,
  BluetoothConnected,
  BluetoothOff,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Info,
  X,
} from 'lucide-react';
import { ConnectModal } from './components/ConnectModal';
import { HomeTab } from './components/HomeTab';
import { SettingsTab } from './components/SettingsTab';
import { TechTab } from './components/TechTab';
import { bleManager, ConnectionState } from './services/bleService';
import { AppState } from './services/packetParser';

interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'home' | 'settings' | 'tech'>('home');
  const [appState, setAppState] = useState<AppState>(() => bleManager.getState());
  const [connectionState, setConnectionState] = useState<ConnectionState>(() =>
    bleManager.getConnectionState()
  );
  const [deviceName, setDeviceName] = useState<string>(() => bleManager.getDeviceName());
  const [isDemo, setIsDemo] = useState<boolean>(() => bleManager.getIsDemo());
  const [isConnectModalOpen, setIsConnectModalOpen] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // Subscriptions to BLE service
  useEffect(() => {
    const unsubState = bleManager.subscribeState((state) => {
      setAppState(state);
    });

    const unsubConn = bleManager.subscribeConnection((conn, dev, demo) => {
      setConnectionState(conn);
      setDeviceName(dev);
      setIsDemo(demo);
    });

    const unsubToast = bleManager.subscribeToast((type, message) => {
      const id = `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      setToasts((prev) => [...prev, { id, type, message }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    });

    const unsubPin = bleManager.subscribePinRequired(() => {
      setIsConnectModalOpen(true);
    });

    return () => {
      unsubState();
      unsubConn();
      unsubToast();
      unsubPin();
    };
  }, []);

  const isConnected = connectionState === 'connected';

  const handleConnectBle = async () => {
    await bleManager.connect();
  };

  const handleStartDemo = () => {
    bleManager.startDemo();
  };

  const handleToggleConnection = () => {
    if (isConnected || connectionState === 'authenticating' || connectionState === 'reconnecting') {
      bleManager.disconnect();
    } else {
      setIsConnectModalOpen(true);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Toast Notification Container */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full px-4 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto p-3.5 rounded-xl shadow-xl border flex items-start space-x-2.5 text-xs font-medium animate-slide-in backdrop-blur-md transition ${
              toast.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200'
                : toast.type === 'error'
                ? 'bg-red-950/90 border-red-500/50 text-red-200'
                : 'bg-slate-900/90 border-cyan-500/50 text-cyan-200'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : toast.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            ) : (
              <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            )}
            <span className="flex-1 leading-snug">{toast.message}</span>
            <button
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Top Header Bar (Always Visible) */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-3">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          {/* Logo & Device Name */}
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-gradient-to-tr from-cyan-600 to-blue-600 rounded-xl shadow-md shadow-cyan-950/50">
              <ThermometerSnowflake className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <h1 className="text-sm font-extrabold tracking-tight text-white uppercase">
                  CITO CHILLER
                </h1>
                {isDemo && (
                  <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-1.5 py-0.2 rounded font-bold border border-cyan-500/40">
                    DEMO
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-1.5 text-[11px] text-slate-400">
                {/* Connection Status Dot */}
                <span
                  className={`w-2 h-2 rounded-full ${
                    connectionState === 'connected'
                      ? 'bg-emerald-400 shadow-sm shadow-emerald-400 animate-pulse'
                      : connectionState === 'reconnecting' || connectionState === 'authenticating'
                      ? 'bg-amber-400 animate-ping'
                      : 'bg-slate-600'
                  }`}
                />
                <span className="font-mono truncate max-w-[140px] sm:max-w-none">
                  {connectionState === 'connected'
                    ? deviceName || 'CITO-CH-XXXX'
                    : connectionState === 'reconnecting'
                    ? 'Đang nối lại...'
                    : connectionState === 'authenticating'
                    ? 'Đang xác thực...'
                    : 'Chưa kết nối'}
                </span>
              </div>
            </div>
          </div>

          {/* Connect / Disconnect Button */}
          <button
            onClick={handleToggleConnection}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer border shadow-sm ${
              isConnected
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                : connectionState === 'reconnecting'
                ? 'bg-amber-600/30 text-amber-300 border-amber-500/50 animate-pulse'
                : 'bg-cyan-600 hover:bg-cyan-500 text-white border-cyan-500 shadow-cyan-950/40'
            }`}
          >
            {isConnected ? (
              <>
                <BluetoothConnected className="w-4 h-4 text-emerald-400" />
                <span>Ngắt Kết Nối</span>
              </>
            ) : connectionState === 'reconnecting' ? (
              <>
                <Bluetooth className="w-4 h-4 text-amber-300 animate-spin" />
                <span>Nối lại...</span>
              </>
            ) : (
              <>
                <Bluetooth className="w-4 h-4 text-white" />
                <span>Kết Nối</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Manual Mode Active Global Notice */}
      {appState.status?.tst?.on === 1 && (
        <div className="bg-purple-950/90 text-purple-200 border-b border-purple-500/50 px-4 py-2 text-xs flex items-center justify-between sticky top-[57px] z-30 backdrop-blur-md">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
            <span className="font-semibold">
              Chế độ Manual (Test) đang bật – Còn {Math.floor((appState.status.tst.left ?? 0) / 60)}:
              {String((appState.status.tst.left ?? 0) % 60).padStart(2, '0')}
            </span>
          </div>
          <button
            onClick={() => bleManager.stopTest()}
            className="px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white font-bold text-[11px] rounded-lg shadow transition cursor-pointer"
          >
            Thoát Manual
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 px-4 pt-4 pb-20 max-w-xl mx-auto w-full">
        {activeTab === 'home' && (
          <HomeTab
            status={appState.status}
            config={appState.config}
            isConnected={isConnected}
            onOpenConnectModal={() => setIsConnectModalOpen(true)}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsTab config={appState.config} isConnected={isConnected} />
        )}

        {activeTab === 'tech' && (
          <TechTab
            status={appState.status}
            config={appState.config}
            wifiList={appState.wifiList}
            isConnected={isConnected}
            isDemo={isDemo}
          />
        )}
      </main>

      {/* Bottom Navigation Bar (3 Tabs) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-lg border-t border-slate-800 py-2 px-4 shadow-2xl">
        <div className="max-w-xl mx-auto grid grid-cols-3 gap-2">
          <button
            onClick={() => setActiveTab('home')}
            className={`py-2 px-3 rounded-xl flex flex-col items-center justify-center transition cursor-pointer ${
              activeTab === 'home'
                ? 'text-cyan-400 bg-cyan-500/10 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ThermometerSnowflake className="w-5 h-5 mb-1" />
            <span className="text-[11px]">Trang Chính</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`py-2 px-3 rounded-xl flex flex-col items-center justify-center transition cursor-pointer ${
              activeTab === 'settings'
                ? 'text-cyan-400 bg-cyan-500/10 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-5 h-5 mb-1" />
            <span className="text-[11px]">Cài Đặt</span>
          </button>

          <button
            onClick={() => setActiveTab('tech')}
            className={`py-2 px-3 rounded-xl flex flex-col items-center justify-center transition cursor-pointer ${
              activeTab === 'tech'
                ? 'text-cyan-400 bg-cyan-500/10 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Wrench className="w-5 h-5 mb-1" />
            <span className="text-[11px]">Kỹ Thuật</span>
          </button>
        </div>
      </nav>

      {/* Connect & Setup Modal */}
      <ConnectModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        onConnectBle={handleConnectBle}
        onStartDemo={handleStartDemo}
      />
    </div>
  );
}
