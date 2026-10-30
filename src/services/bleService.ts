/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AnyPacket, PacketAck } from '../types/system';
import { DemoChillerDevice } from './demo';
import { localEpochNow } from './history';
import { AppState, INITIAL_APP_STATE, PacketFramingBuffer, applyPacket } from './packetParser';

export const CHILLER_SERVICE_UUID = 'f54c14eb-99db-4d72-85fa-a58e08cc73d6';
export const CHILLER_STATUS_UUID = '2eb32407-1ae5-442f-a776-9fb824f2c624';
export const CHILLER_COMMAND_UUID = '66805ab7-d333-4e7a-9b63-f0802d81c114';

export const STORAGE_PIN_KEY = 'cito_chiller_pin';
export const STORAGE_LAST_DEVICE_KEY = 'cito_chiller_device_id';

export type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'authenticating'
  | 'connected'
  | 'reconnecting';

export interface CommandPending {
  action: string;
  payload?: Record<string, unknown>;
  resolve: (ack: PacketAck) => void;
  reject: (reason: Error) => void;
  timeoutId: number;
}

export class ChillerBleManager {
  private static instance: ChillerBleManager;

  private state: AppState = { ...INITIAL_APP_STATE };
  private connectionState: ConnectionState = 'disconnected';
  private deviceName: string = '';
  private isDemoMode: boolean = false;

  private bluetoothDevice: BluetoothDevice | null = null;
  private gattServer: BluetoothRemoteGATTServer | null = null;
  private statusChar: BluetoothRemoteGATTCharacteristic | null = null;
  private commandChar: BluetoothRemoteGATTCharacteristic | null = null;

  private framingBuffer = new PacketFramingBuffer();
  private demoDevice: DemoChillerDevice | null = null;

  // Command queue & ACK resolution
  private commandQueue: {
    action: string;
    payload?: Record<string, unknown>;
    resolve: (ack: PacketAck) => void;
    reject: (reason: Error) => void;
  }[] = [];
  private isWriting: boolean = false;
  private currentPendingAck: CommandPending | null = null;

  // Auto reconnection state
  private reconnectAttempt: number = 0;
  private reconnectTimer: number | null = null;
  private manualDisconnect: boolean = false;

  // Event subscribers
  private stateSubscribers = new Set<(state: AppState) => void>();
  private connectionSubscribers = new Set<
    (status: ConnectionState, deviceName: string, isDemo: boolean) => void
  >();
  private toastSubscribers = new Set<
    (type: 'success' | 'error' | 'info', msg: string) => void
  >();
  private pinRequiredSubscribers = new Set<(msg?: string) => void>();

  // Gan 1 lan duy nhat: bind() moi lan tao ham moi -> removeEventListener khong go duoc,
  // noi lai se gan them listener -> moi goi bi xu ly 2 lan, bo dem ghep goi hong.
  private readonly onValueChanged = (event: Event) => this.handleCharacteristicValueChanged(event);

  private constructor() {
    this.handlePacketReceived = this.handlePacketReceived.bind(this);
    this.handleDisconnected = this.handleDisconnected.bind(this);
  }

  public static getInstance(): ChillerBleManager {
    if (!ChillerBleManager.instance) {
      ChillerBleManager.instance = new ChillerBleManager();
    }
    return ChillerBleManager.instance;
  }

  // --- Subscription methods ---
  public subscribeState(callback: (state: AppState) => void): () => void {
    this.stateSubscribers.add(callback);
    callback(this.state);
    return () => this.stateSubscribers.delete(callback);
  }

  public subscribeConnection(
    callback: (status: ConnectionState, deviceName: string, isDemo: boolean) => void
  ): () => void {
    this.connectionSubscribers.add(callback);
    callback(this.connectionState, this.deviceName, this.isDemoMode);
    return () => this.connectionSubscribers.delete(callback);
  }

  public subscribeToast(
    callback: (type: 'success' | 'error' | 'info', msg: string) => void
  ): () => void {
    this.toastSubscribers.add(callback);
    return () => this.toastSubscribers.delete(callback);
  }

  public subscribePinRequired(callback: (msg?: string) => void): () => void {
    this.pinRequiredSubscribers.add(callback);
    return () => this.pinRequiredSubscribers.delete(callback);
  }

  private notifyState() {
    for (const sub of this.stateSubscribers) {
      sub(this.state);
    }
  }

  private notifyConnection() {
    for (const sub of this.connectionSubscribers) {
      sub(this.connectionState, this.deviceName, this.isDemoMode);
    }
  }

  private notifyToast(type: 'success' | 'error' | 'info', msg: string) {
    for (const sub of this.toastSubscribers) {
      sub(type, msg);
    }
  }

  private notifyPinRequired(msg?: string) {
    for (const sub of this.pinRequiredSubscribers) {
      sub(msg);
    }
  }

  public getState(): AppState {
    return this.state;
  }

  public getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  public getDeviceName(): string {
    return this.deviceName;
  }

  public getIsDemo(): boolean {
    return this.isDemoMode;
  }

  public getSavedPin(): string {
    return localStorage.getItem(STORAGE_PIN_KEY) || '1234';
  }

  public setSavedPin(pin: string): void {
    localStorage.setItem(STORAGE_PIN_KEY, pin);
  }

  // Check Web Bluetooth support
  public isBluetoothSupported(): boolean {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }

  // --- Connect via Web Bluetooth ---
  public async connect(): Promise<void> {
    if (!this.isBluetoothSupported()) {
      throw new Error(
        'Trình duyệt này không hỗ trợ Web Bluetooth. Vui lòng dùng Chrome/Edge trên PC/Android hoặc Bluefy trên iPhone, hoặc chuyển sang chế độ Demo.'
      );
    }

    this.disconnect();
    this.manualDisconnect = false;
    this.isDemoMode = false;
    this.setConnectionState('connecting', 'Đang quét thiết bị...');

    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [
          { namePrefix: 'CITO-CH' },
          { services: [CHILLER_SERVICE_UUID] },
        ],
        optionalServices: [CHILLER_SERVICE_UUID],
      });

      this.bluetoothDevice = device;
      this.deviceName = device.name || 'CITO-CH-XXXX';
      localStorage.setItem(STORAGE_LAST_DEVICE_KEY, device.id);

      device.addEventListener('gattserverdisconnected', this.handleDisconnected);

      await this.establishGattConnection(device);
    } catch (err: unknown) {
      const error = err as Error;
      console.warn('Bluetooth connect failed:', error);
      this.setConnectionState('disconnected', '');
      if (error.name !== 'NotFoundError') {
        this.notifyToast('error', error.message || 'Không thể kết nối Bluetooth');
      }
      throw error;
    }
  }

  // Connect to GATT & Characteristics
  private async establishGattConnection(device: BluetoothDevice): Promise<void> {
    this.setConnectionState('connecting', device.name || 'CITO-CH-XXXX');

    const server = await device.gatt?.connect();
    if (!server) throw new Error('Không thể kết nối tới GATT Server');
    this.gattServer = server;

    const service = await server.getPrimaryService(CHILLER_SERVICE_UUID);
    this.statusChar = await service.getCharacteristic(CHILLER_STATUS_UUID);
    this.commandChar = await service.getCharacteristic(CHILLER_COMMAND_UUID);

    // Setup streaming buffer
    this.framingBuffer.reset();
    this.statusChar.removeEventListener('characteristicvaluechanged', this.onValueChanged);
    this.statusChar.addEventListener('characteristicvaluechanged', this.onValueChanged);
    await this.statusChar.startNotifications();

    // Send AUTH immediately
    this.setConnectionState('authenticating', this.deviceName);
    const pin = this.getSavedPin();
    await this.sendAuth(pin);
  }

  private handleCharacteristicValueChanged(event: Event) {
    const target = event.target as BluetoothRemoteGATTCharacteristic;
    const value = target.value;
    if (!value) return;

    const packets = this.framingBuffer.push(value);
    for (const pkt of packets) {
      this.handlePacketReceived(pkt);
    }
  }

  // --- Connect in Demo Mode ---
  public startDemo(): void {
    this.disconnect();
    this.manualDisconnect = false;
    this.isDemoMode = true;
    this.deviceName = 'CITO-CH-A4F2 (DEMO)';

    this.demoDevice = new DemoChillerDevice((pkt) => {
      this.handlePacketReceived(pkt);
    });
    this.demoDevice.start();

    this.setConnectionState('authenticating', this.deviceName);
    const pin = this.getSavedPin();
    this.sendAuth(pin);
  }

  // --- Disconnect ---
  public disconnect(): void {
    this.manualDisconnect = true;
    this.clearReconnectTimer();

    this.abortPendingCommands();

    if (this.demoDevice) {
      this.demoDevice.stop();
      this.demoDevice = null;
    }

    if (this.statusChar) {
      try {
        this.statusChar.removeEventListener('characteristicvaluechanged', this.onValueChanged);
      } catch (e) {
        console.debug('Failed to remove statusChar listener:', e);
      }
      this.statusChar = null;
    }

    if (this.gattServer && this.gattServer.connected) {
      this.gattServer.disconnect();
    }
    this.gattServer = null;

    if (this.bluetoothDevice) {
      this.bluetoothDevice.removeEventListener(
        'gattserverdisconnected',
        this.handleDisconnected
      );
      this.bluetoothDevice = null;
    }

    this.isDemoMode = false;
    this.state = { ...INITIAL_APP_STATE };
    this.notifyState();
    this.setConnectionState('disconnected', '');
  }

  // Huy lenh dang cho ack + hang doi (lenh cu khong con y nghia sau khi mat ket noi;
  // neu giu lai, AUTH luc noi lai phai doi lenh cu het han 5 s)
  private abortPendingCommands() {
    if (this.currentPendingAck) {
      clearTimeout(this.currentPendingAck.timeoutId);
      this.currentPendingAck.reject(new Error('Đã ngắt kết nối'));
      this.currentPendingAck = null;
    }
    for (const cmd of this.commandQueue) cmd.reject(new Error('Đã ngắt kết nối'));
    this.commandQueue = [];
    this.isWriting = false;
  }

  private handleDisconnected() {
    if (this.manualDisconnect) return;

    console.warn('Bluetooth disconnected unexpectedly. Attempting reconnection...');
    this.abortPendingCommands();
    this.setConnectionState('reconnecting', this.deviceName);
    this.reconnectAttempt = 0;
    this.scheduleReconnect();
  }

  // Tu noi lai toi da 3 lan (cho 2 s, 4 s, 6 s). Lan noi that bai khong ban lai su kien
  // 'gattserverdisconnected' -> phai tu hen lan ke tiep o day (vd may dang khoi dong lai sau REBOOT / nap firmware).
  private scheduleReconnect() {
    if (this.manualDisconnect || !this.bluetoothDevice) return;
    if (this.reconnectAttempt >= 3) {
      this.setConnectionState('disconnected', this.deviceName);
      this.notifyToast('error', 'Không thể tự kết nối lại. Bấm nút Kết nối để thử lại.');
      return;
    }
    this.reconnectAttempt += 1;
    const delay = this.reconnectAttempt * 2000;
    this.notifyToast('info', `Mất sóng, đang kết nối lại lần ${this.reconnectAttempt}/3...`);

    this.reconnectTimer = window.setTimeout(async () => {
      this.reconnectTimer = null;
      if (this.manualDisconnect || !this.bluetoothDevice) return;
      try {
        await this.establishGattConnection(this.bluetoothDevice);
        this.reconnectAttempt = 0;
        this.notifyToast('success', 'Đã kết nối lại máy làm lạnh!');
      } catch (e) {
        console.warn(`Reconnect attempt ${this.reconnectAttempt} failed`, e);
        this.setConnectionState('reconnecting', this.deviceName);
        this.scheduleReconnect();
      }
    }, delay);
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempt = 0;
  }

  private setConnectionState(state: ConnectionState, deviceName: string) {
    this.connectionState = state;
    this.deviceName = deviceName;
    this.notifyConnection();
  }

  // --- Packet Handling ---
  private handlePacketReceived(pkt: AnyPacket) {
    // If packet is ACK, match with pending command
    if (pkt.t === 'ack') {
      if (this.currentPendingAck && this.currentPendingAck.action === pkt.a) {
        clearTimeout(this.currentPendingAck.timeoutId);
        const current = this.currentPendingAck;
        this.currentPendingAck = null;

        if (pkt.a === 'AUTH') {
          if (pkt.ok) {
            this.setConnectionState('connected', this.deviceName);
            this.reconnectAttempt = 0;
            this.notifyToast('success', pkt.msg || 'Kết nối thành công!');
            // May khong co dong ho: gui gio dien thoai -> nhat ky co gio that
            this.sendCommand('TIME_SET', { t: localEpochNow() }).catch(() => undefined);
          } else {
            this.notifyPinRequired(pkt.msg || 'Mã PIN không đúng');
            this.notifyToast('error', pkt.msg || 'Sai mã PIN');
          }
        } else {
          if (pkt.ok) {
            // Firmware chi gui msg cho thao tac can bao (luu, bat/tat...). TEST_SET khong co msg
            // -> khong hien toast moi lan bam / keo trong dieu khien thu cong.
            if (pkt.msg) this.notifyToast('success', pkt.msg);
          } else {
            this.notifyToast('error', pkt.msg || `Lệnh ${pkt.a} bị từ chối`);
          }
        }

        current.resolve(pkt);
        this.processNextCommand();
      }
    }

    // Apply packet to app state purely
    this.state = applyPacket(this.state, pkt);
    this.notifyState();
  }

  // --- Send AUTH command ---
  public async sendAuth(pin: string): Promise<PacketAck> {
    this.setSavedPin(pin);
    return this.sendCommand('AUTH', { pin });
  }

  // --- Command Queue and Sequential Writing ---
  public async sendCommand(
    action: string,
    payload?: Record<string, unknown>
  ): Promise<PacketAck> {
    return new Promise<PacketAck>((resolve, reject) => {
      this.commandQueue.push({ action, payload, resolve, reject });
      if (!this.isWriting && !this.currentPendingAck) {
        this.processNextCommand();
      }
    });
  }

  private async processNextCommand(): Promise<void> {
    if (this.commandQueue.length === 0 || this.currentPendingAck) {
      this.isWriting = false;
      return;
    }

    this.isWriting = true;
    const cmd = this.commandQueue.shift()!;

    // Prepare JSON payload: {"a":"<CMD>","p":{...}}
    const cmdObj: { a: string; p?: Record<string, unknown> } = { a: cmd.action };
    if (cmd.payload && Object.keys(cmd.payload).length > 0) {
      cmdObj.p = cmd.payload;
    }

    const jsonStr = JSON.stringify(cmdObj);
    const encoder = new TextEncoder();
    const data = encoder.encode(jsonStr);

    if (data.byteLength > 511) {
      cmd.reject(new Error('Kích thước lệnh vượt quá 511 bytes'));
      this.isWriting = false;
      this.processNextCommand();
      return;
    }

    // Set 5s timeout waiting for corresponding ACK
    const timeoutId = window.setTimeout(() => {
      if (this.currentPendingAck && this.currentPendingAck.action === cmd.action) {
        console.warn(`Command ${cmd.action} timed out after 5s`);
        this.currentPendingAck = null;
        cmd.reject(new Error('Máy không phản hồi, thử lại'));
        this.notifyToast('error', 'Máy không phản hồi, thử lại');
        this.processNextCommand();
      }
    }, 5000);

    this.currentPendingAck = {
      action: cmd.action,
      payload: cmd.payload,
      resolve: cmd.resolve,
      reject: cmd.reject,
      timeoutId,
    };

    // Forward to Demo or write to real BLE characteristic
    if (this.isDemoMode && this.demoDevice) {
      this.demoDevice.handleCommand(cmdObj);
    } else if (this.commandChar) {
      try {
        if (typeof this.commandChar.writeValueWithResponse === 'function') {
          await this.commandChar.writeValueWithResponse(data);
        } else if (typeof this.commandChar.writeValue === 'function') {
          await this.commandChar.writeValue(data);
        } else {
          await this.commandChar.writeValueWithoutResponse(data);
        }
      } catch (err: unknown) {
        const error = err as Error;
        console.warn('GATT write failed:', error);
        clearTimeout(timeoutId);
        this.currentPendingAck = null;
        cmd.reject(error);
        this.notifyToast('error', `Lỗi gửi lệnh: ${error.message}`);
        this.processNextCommand();
      }
    } else {
      clearTimeout(timeoutId);
      this.currentPendingAck = null;
      cmd.reject(new Error('Chưa kết nối tới thiết bị'));
      this.processNextCommand();
    }
  }

  // --- Convenience Command Helpers ---
  public async setPower(on: boolean): Promise<PacketAck> {
    return this.sendCommand('POWER', { on });
  }

  public async clearFaults(): Promise<PacketAck> {
    return this.sendCommand('CLEAR_FAULTS');
  }

  public async setConfig(params: Record<string, number | string | boolean>): Promise<PacketAck> {
    return this.sendCommand('SET', params);
  }

  public async startTest(): Promise<PacketAck> {
    return this.sendCommand('TEST_START');
  }

  public async stopTest(): Promise<PacketAck> {
    return this.sendCommand('TEST_STOP');
  }

  public async setTest(p1: boolean, p2: boolean, fan: number): Promise<PacketAck> {
    return this.sendCommand('TEST_SET', { p1, p2, fan });
  }

  /** Chinh he so dem/A theo ampe kim: ch 0 quat / 1 so 1 + van / 2 so 2, ma = dong ampe kim (mA). */
  public async calAcs(ch: number, ma: number): Promise<PacketAck> {
    return this.sendCommand('ACS_CAL', { ch, ma });
  }

  public async zeroAcs(): Promise<PacketAck> {
    return this.sendCommand('ACS_ZERO');
  }

  public async restoreDefaults(): Promise<PacketAck> {
    return this.sendCommand('DEFAULTS');
  }

  public async reboot(): Promise<PacketAck> {
    return this.sendCommand('REBOOT');
  }

  public async scanWifi(): Promise<PacketAck> {
    return this.sendCommand('WIFI_SCAN');
  }

  public async setWifi(ssid: string, pass?: string): Promise<PacketAck> {
    const payload: Record<string, string> = { ssid };
    if (pass !== undefined) payload.pass = pass;
    return this.sendCommand('WIFI_SET', payload);
  }

  public async clearWifi(): Promise<PacketAck> {
    return this.sendCommand('WIFI_CLEAR');
  }

  public async setPin(pin: string): Promise<PacketAck> {
    const res = await this.sendCommand('SET_PIN', { pin });
    if (res.ok) {
      this.setSavedPin(pin);
    }
    return res;
  }

  public async getHistory(): Promise<PacketAck> {
    return this.sendCommand('GET_HISTORY');
  }

  public async clearHistory(): Promise<PacketAck> {
    return this.sendCommand('CLEAR_HISTORY');
  }

  public async sendSim(line: string): Promise<PacketAck> {
    return this.sendCommand('SIM', { line });
  }
}

export const bleManager = ChillerBleManager.getInstance();
