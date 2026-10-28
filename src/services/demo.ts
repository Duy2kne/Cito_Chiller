/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AnyPacket, ChillerConfig, ChillerStatus } from '../types/system';

export class DemoChillerDevice {
  private timer: number | null = null;
  private pin: string = '1234';
  private isAuthenticated: boolean = false;
  private onPacketCallback: ((packet: AnyPacket) => void) | null = null;

  // Internal state
  private status: ChillerStatus = {
    w: 25.4,
    c: 24.1,
    h: 31.2,
    set: 20.0,
    pw: 1,
    fm: 0, // Auto
    st: 3, // Cooling
    ph: 'COOLING',
    stg: 2,
    lim: 2,
    red: 0,
    p: [
      [1, 0, 1, 1, 4280], // TEC1 + valve on, ~4.28A
      [1, 0, 1, 1, 3850], // TEC2 on, ~3.85A
    ],
    f: {
      pct: 65,
      max: 100,
      cur: 1,
      ma: 580,
      rpm: [2720, 2760],
      bad: [0, 0],
      ok: 1,
    },
    err: 0,
    wrn: 0,
    tst: {
      on: 0,
      left: 0,
      p1: 0,
      p2: 0,
      fan: 0,
    },
    wifi: {
      sta: 2,
      ip: '192.168.1.168',
      rssi: -58,
    },
    up: 3620,
    heap: 184520,
    maxblk: 112400,
    sim: 1, // Sim is enabled so simulation controls are available
  };

  private config: ChillerConfig = {
    set: 20.0,
    diff: 1.0,
    mode: 0,
    pel1_en: 1,
    pel2_en: 1,
    s2on: 2.0,
    s2off: 0.5,
    min_on: 60,
    min_off: 60,
    hot_red: 65,
    hot_max: 75,
    hot_clr: 55,
    cold_min: 5,
    fan_lo: 35,
    fan_hi: 55,
    fan_off: 32,
    fan_min: 25,
    fmax_a: 100,
    fmax_m: 65,
    fmax_e: 100,
    med_tec: 1,
    fan_runon: 60,
    fan_rpm: 1200,
    fan_rpmx: 4500,
    fan_ma: 2500,
    pel_min: 1500,
    pel_max: 7000,
    off_w: 0.0,
    off_c: 0.0,
    off_h: 0.0,
    z_f: 1.65,
    z_p1: 1.65,
    z_p2: 1.65,
    k_f: 82.7,
    k_p1: 82.7,
    k_p2: 82.7,
    bz_key: 1,
    bz_alarm: 1,
    fw: '2.0.0 (Oct 28 2026)',
    dev: 'A4F29871C012',
    ssid: 'AquaHome_5G',
    rst: 'POWERON',
    pend: 0,
    ap: 'CITO-CH-A4F2',
  };

  private cooldownTimer: number = 0;

  // TEST giong firmware (_update_test trong chiller.cpp): so chi bat khi 2 quat da dat RPM on dinh
  // (~1 s kick + 3 s xac nhan), 2 so bat cach nhau 10 s, co so thi quat >= fan_min.
  private testFanOnSec: number = 0;
  private testLastTecChange: number = -100;

  private stopTestState() {
    this.status.tst = { on: 0, left: 0, p1: 0, p2: 0, fan: 0 };
    for (const i of [0, 1]) {
      this.status.p[i][0] = 0;
      this.status.p[i][4] = 0;
    }
    this.status.f.ok = 0;
    this.testFanOnSec = 0;
    this.status.st = this.status.pw ? 1 : 0;
    this.status.ph = this.status.pw ? 'READY' : 'OFF';
  }

  private updateTest() {
    const tst = this.status.tst;
    const anyReq = (tst.p1 && this.config.pel1_en) || (tst.p2 && this.config.pel2_en);
    let fan = tst.fan;
    if (anyReq && fan < this.config.fan_min) fan = this.config.fan_min;
    this.testFanOnSec = fan > 0 ? this.testFanOnSec : 0;
    const fansOk = fan > 0 && this.testFanOnSec >= 4;

    this.status.f.pct = fan;
    this.status.f.ok = fansOk ? 1 : 0;
    this.status.f.rpm = fan > 0 ? [Math.round(1500 + fan * 15), Math.round(1520 + fan * 15)] : [0, 0];
    this.status.f.ma = fan > 0 ? Math.round(200 + fan * 5) : 0;

    const req = [tst.p1 && this.config.pel1_en, tst.p2 && this.config.pel2_en];
    const amps = [4200, 3800];
    for (const i of [0, 1]) {
      const on = this.status.p[i][0] === 1;
      if (req[i] && !on && fansOk && this.status.up - this.testLastTecChange >= 10) {
        this.status.p[i][0] = 1;
        this.testLastTecChange = this.status.up;
      } else if (!req[i] && on) {
        this.status.p[i][0] = 0;
      }
      this.status.p[i][4] = this.status.p[i][0] ? amps[i] : 0;
    }
  }

  constructor(onPacket: (packet: AnyPacket) => void) {
    this.onPacketCallback = onPacket;
  }

  public setPacketHandler(onPacket: (packet: AnyPacket) => void) {
    this.onPacketCallback = onPacket;
  }

  public start() {
    this.stop();
    this.timer = window.setInterval(() => {
      this.tick();
    }, 1000);
  }

  public stop() {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isAuthenticated = false;
  }

  private sendPacket(packet: AnyPacket) {
    if (this.onPacketCallback) {
      this.onPacketCallback(packet);
    }
  }

  private tick() {
    if (!this.isAuthenticated) return;

    this.status.up += 1;

    // In Test Mode
    if (this.status.tst.on) {
      if (this.status.f.pct > 0) this.testFanOnSec += 1;
      this.updateTest();
      if (this.status.tst.left > 0) {
        this.status.tst.left -= 1;
        if (this.status.tst.left === 0) {
          this.stopTestState();
        }
      }
      this.sendPacket({ ...this.status, t: 'st' });
      return;
    }

    // Normal operation simulation (chi loi THAT moi dung may; wrn = canh bao, may van chay)
    if ((this.status.err & ~this.status.wrn) !== 0) {
      this.status.st = 5; // FAULT
      this.status.ph = 'FAULT';
      this.status.p[0][0] = 0;
      this.status.p[0][4] = 0;
      this.status.p[1][0] = 0;
      this.status.p[1][4] = 0;
      this.status.f.pct = 100;
      this.status.f.rpm = [3200, 3250];
      this.status.f.ma = 780;
      this.sendPacket({ ...this.status, t: 'st' });
      return;
    }

    if (this.status.pw === 0) {
      // Power is OFF
      this.status.p[0][0] = 0;
      this.status.p[0][4] = 0;
      this.status.p[1][0] = 0;
      this.status.p[1][4] = 0;

      if (this.cooldownTimer > 0) {
        this.cooldownTimer -= 1;
        this.status.st = 4; // STOPPING
        this.status.ph = 'COOL-DOWN';
        this.status.f.pct = 50;
        this.status.f.rpm = [2200, 2250];
        this.status.f.ma = 420;
      } else {
        this.status.st = 0; // OFF
        this.status.ph = 'OFF';
        this.status.f.pct = 0;
        this.status.f.rpm = [0, 0];
        this.status.f.ma = 0;
      }

      // Heat up water slowly toward ambient 28°C
      if (this.status.w !== null && this.status.w < 28) {
        this.status.w = Math.min(28, +(this.status.w + 0.02).toFixed(1));
      }
      if (this.status.h !== null && this.status.h > 31) {
        this.status.h = Math.max(31, +(this.status.h - 0.2).toFixed(1));
      }
      if (this.status.c !== null && this.status.c < 25) {
        this.status.c = Math.min(25, +(this.status.c + 0.1).toFixed(1));
      }

      this.sendPacket({ ...this.status, t: 'st' });
      return;
    }

    // Cooling is ON
    const target = this.config.set;
    const diff = this.config.diff;
    const s2on = this.config.s2on;

    if (this.status.w !== null) {
      if (this.status.w >= target + diff) {
        // Needs cooling
        this.status.st = 3;
        this.status.ph = 'COOLING';

        // Check stages
        if (this.status.w >= target + s2on && this.config.pel2_en) {
          this.status.stg = 2;
          this.status.lim = 2;
          this.status.p[0][0] = this.config.pel1_en ? 1 : 0;
          this.status.p[0][4] = this.config.pel1_en ? 4250 : 0;
          this.status.p[1][0] = 1;
          this.status.p[1][4] = 3820;
        } else {
          this.status.stg = 1;
          this.status.lim = 1;
          this.status.p[0][0] = this.config.pel1_en ? 1 : 0;
          this.status.p[0][4] = this.config.pel1_en ? 4250 : 0;
          this.status.p[1][0] = 0;
          this.status.p[1][4] = 0;
        }

        // Fan speed based on mode
        let fanPct = 65;
        if (this.config.mode === 1) fanPct = this.config.fmax_m || 50;
        if (this.config.mode === 2) fanPct = this.config.fmax_e || 100;
        this.status.f.pct = fanPct;
        this.status.f.rpm = [Math.round(2000 + fanPct * 12), Math.round(2020 + fanPct * 12)];
        this.status.f.ma = Math.round(300 + fanPct * 4.5);

        // Water temp decreases
        const tempDrop = this.status.stg === 2 ? 0.05 : 0.03;
        this.status.w = Math.max(target, +(this.status.w - tempDrop).toFixed(1));

        // Cold block drops
        if (this.status.c !== null) {
          this.status.c = Math.max(12.0, +(this.status.c - 0.1).toFixed(1));
        }
        // Heatsink warms up
        if (this.status.h !== null) {
          this.status.h = Math.min(42.5, +(this.status.h + 0.1).toFixed(1));
        }
      } else if (this.status.w <= target) {
        // Target reached
        this.status.st = 1;
        this.status.ph = 'READY';
        this.status.stg = 0;
        this.status.p[0][0] = 0;
        this.status.p[0][4] = 0;
        this.status.p[1][0] = 0;
        this.status.p[1][4] = 0;
        this.status.f.pct = 25;
        this.status.f.rpm = [1400, 1420];
        this.status.f.ma = 260;

        // Temperature creeps up slightly
        this.status.w = +(this.status.w + 0.01).toFixed(1);
      }
    }

    this.sendPacket({ ...this.status, t: 'st' });
  }

  // Handle command from web
  public handleCommand(cmdObj: { a: string; p?: Record<string, unknown> }): void {
    const { a, p = {} } = cmdObj;

    if (a === 'AUTH') {
      const inputPin = String(p.pin || '');
      if (inputPin === this.pin) {
        this.isAuthenticated = true;
        this.sendPacket({ t: 'ack', a: 'AUTH', ok: true, msg: 'Đăng nhập thành công' });
        // Immediately send cf and st
        this.sendPacket({ ...this.config, t: 'cf' });
        this.sendPacket({ ...this.status, t: 'st' });
      } else {
        this.sendPacket({ t: 'ack', a: 'AUTH', ok: false, msg: 'Sai mã PIN' });
      }
      return;
    }

    if (!this.isAuthenticated) {
      this.sendPacket({ t: 'ack', a, ok: false, msg: 'Chưa nhập mã PIN' });
      return;
    }

    switch (a) {
      case 'GET_CONFIG': {
        this.sendPacket({ t: 'ack', a: 'GET_CONFIG', ok: true, msg: 'Đã gửi cấu hình' });
        this.sendPacket({ ...this.config, t: 'cf' });
        break;
      }
      case 'POWER': {
        const on = Boolean(p.on);
        this.status.pw = on ? 1 : 0;
        if (on) {
          // Power ON also clears locked errors (similar to holding SET for 5s)
          this.status.err = 0;
          this.status.wrn = 0;
          this.status.st = 2;
          this.status.ph = 'FAN CHECK';
        } else {
          this.cooldownTimer = 15;
          this.status.st = 4;
          this.status.ph = 'COOL-DOWN';
        }
        this.sendPacket({
          t: 'ack',
          a: 'POWER',
          ok: true,
          msg: on ? 'Đã bật làm lạnh' : 'Đang quạt giải nhiệt rồi tắt',
        });
        this.sendPacket({ ...this.config, t: 'cf' });
        this.sendPacket({ ...this.status, t: 'st' });
        break;
      }
      case 'CLEAR_FAULTS': {
        if (this.status.h !== null && this.status.h >= this.config.hot_clr) {
          this.sendPacket({
            t: 'ack',
            a: 'CLEAR_FAULTS',
            ok: false,
            msg: `Cục nóng còn quá nhiệt (${this.status.h}°C ≥ ${this.config.hot_clr}°C). Chờ nguội bớt.`,
          });
          return;
        }
        this.status.err = 0;
        this.status.wrn = 0;
        this.status.f.bad = [0, 0];
        this.status.p[0][1] = 0;
        this.status.p[1][1] = 0;
        this.status.st = this.status.pw ? 1 : 0;
        this.status.ph = this.status.pw ? 'READY' : 'OFF';

        this.sendPacket({ t: 'ack', a: 'CLEAR_FAULTS', ok: true, msg: 'Đã xóa lỗi khóa' });
        this.sendPacket({ ...this.status, t: 'st' });
        break;
      }
      case 'SET': {
        // Giong firmware: co khoa la -> tu choi CA lenh, khong doi gi
        const unknown = Object.keys(p).filter((k) => !(k in this.config) || ['fw', 'dev', 'ssid', 'rst', 'pend', 'ap'].includes(k));
        if (unknown.length > 0) {
          this.sendPacket({ t: 'ack', a: 'SET', ok: false, msg: 'Khóa cài đặt không hợp lệ' });
          return;
        }
        let changed = false;
        for (const [key, val] of Object.entries(p)) {
          if (key in this.config) {
            const numVal = Number(val);
            if (!isNaN(numVal)) {
              (this.config as unknown as Record<string, unknown>)[key] = numVal;
              changed = true;
              if (key === 'set') {
                this.status.set = numVal;
              }
              if (key === 'mode') {
                this.status.fm = numVal;
              }
            }
          }
        }
        if (changed) {
          this.sendPacket({ t: 'ack', a: 'SET', ok: true, msg: 'Đã lưu cài đặt' });
          this.sendPacket({ ...this.config, t: 'cf' });
          this.sendPacket({ ...this.status, t: 'st' });
        } else {
          this.sendPacket({ t: 'ack', a: 'SET', ok: false, msg: 'Không có thông số hợp lệ' });
        }
        break;
      }
      case 'TEST_START': {
        if (this.status.tst.on) {
          this.status.tst.left = 600;          // Firmware: dang TEST thi chi gia han, giu nguyen lenh
        } else {
          this.status.tst = { on: 1, left: 600, p1: 0, p2: 0, fan: 0 };
          this.status.p[0][0] = 0;
          this.status.p[1][0] = 0;
          this.testFanOnSec = 0;
          this.updateTest();
        }
        this.status.st = 6;
        this.status.ph = 'TEST (APP)';
        this.sendPacket({ t: 'ack', a: 'TEST_START', ok: true, msg: 'Đã vào chế độ kiểm tra' });
        this.sendPacket({ ...this.status, t: 'st' });
        break;
      }
      case 'TEST_STOP': {
        this.stopTestState();
        this.sendPacket({ t: 'ack', a: 'TEST_STOP', ok: true, msg: 'Đã thoát chế độ kiểm tra' });
        this.sendPacket({ ...this.status, t: 'st' });
        break;
      }
      case 'TEST_SET': {
        if (!this.status.tst.on) {
          this.sendPacket({ t: 'ack', a: 'TEST_SET', ok: false, msg: 'Chưa bật chế độ kiểm tra' });
          return;
        }
        const p1 = Boolean(p.p1);
        const p2 = Boolean(p.p2);
        const fan = Math.min(100, Math.max(0, Number(p.fan) || 0));

        this.status.tst.p1 = p1 ? 1 : 0;
        this.status.tst.p2 = p2 ? 1 : 0;
        this.status.tst.fan = fan;
        this.status.tst.left = 600;            // Firmware: moi thao tac tinh lai thoi gian tu thoat
        this.updateTest();                     // So chi bat sau khi quat dat RPM + cach nhau 10 s

        this.sendPacket({ t: 'ack', a: 'TEST_SET', ok: true });
        this.sendPacket({ ...this.status, t: 'st' });
        break;
      }
      case 'ACS_ZERO': {
        if (this.status.p[0][0] || this.status.p[1][0] || this.status.f.pct > 0) {
          this.sendPacket({
            t: 'ack',
            a: 'ACS_ZERO',
            ok: false,
            msg: 'Từ chối: Quạt hoặc sò đang chạy! Hãy tắt làm lạnh trước.',
          });
          return;
        }
        this.config.z_f = 1.652;
        this.config.z_p1 = 1.648;
        this.config.z_p2 = 1.651;
        this.sendPacket({ t: 'ack', a: 'ACS_ZERO', ok: true, msg: 'Đã đo và lưu điểm 0 A cho 3 cảm biến' });
        this.sendPacket({ ...this.config, t: 'cf' });
        break;
      }
      case 'DEFAULTS': {
        this.config.set = 20.0;
        this.config.diff = 1.0;
        this.config.mode = 0;
        this.config.s2on = 2.0;
        this.config.s2off = 0.5;
        this.config.hot_max = 75;
        this.config.hot_clr = 55;
        this.config.cold_min = 5;
        this.config.bz_key = 1;
        this.config.bz_alarm = 1;
        this.sendPacket({ t: 'ack', a: 'DEFAULTS', ok: true, msg: 'Đã khôi phục cài đặt gốc' });
        this.sendPacket({ ...this.config, t: 'cf' });
        break;
      }
      case 'REBOOT': {
        this.sendPacket({ t: 'ack', a: 'REBOOT', ok: true, msg: 'Máy đang khởi động lại...' });
        setTimeout(() => {
          this.status.up = 1;
          this.config.rst = 'SW';
          this.sendPacket({ ...this.config, t: 'cf' });
          this.sendPacket({ ...this.status, t: 'st' });
        }, 800);
        break;
      }
      case 'WIFI_SCAN': {
        this.sendPacket({ t: 'ack', a: 'WIFI_SCAN', ok: true, msg: 'Đang quét sóng WiFi...' });
        setTimeout(() => {
          this.sendPacket({
            t: 'wl',
            n: [
              ['AquaHome_5G', -52, 1],
              ['HoCaCanh_LivingRoom', -65, 1],
              ['CITO_Factory_Guest', -78, 0],
              ['Coffee_Shop_WiFi', -85, 1],
            ],
          });
        }, 1200);
        break;
      }
      case 'WIFI_SET': {
        const ssid = String(p.ssid || '').trim();
        if (!ssid) {
          this.sendPacket({ t: 'ack', a: 'WIFI_SET', ok: false, msg: 'Thiếu tên mạng SSID' });
          return;
        }
        this.config.ssid = ssid;
        this.status.wifi = {
          sta: 2,
          ip: '192.168.1.189',
          rssi: -55,
        };
        this.sendPacket({ t: 'ack', a: 'WIFI_SET', ok: true, msg: `Đã kết nối WiFi: ${ssid}` });
        this.sendPacket({ ...this.config, t: 'cf' });
        this.sendPacket({ ...this.status, t: 'st' });
        break;
      }
      case 'WIFI_CLEAR': {
        this.config.ssid = '';
        this.status.wifi = {
          sta: 0,
          ip: '192.168.4.1',
          rssi: 0,
        };
        this.sendPacket({ t: 'ack', a: 'WIFI_CLEAR', ok: true, msg: 'Đã xóa WiFi nhà' });
        this.sendPacket({ ...this.config, t: 'cf' });
        this.sendPacket({ ...this.status, t: 'st' });
        break;
      }
      case 'SET_PIN': {
        const newPin = String(p.pin || '');
        if (newPin.length < 4 || newPin.length > 8) {
          this.sendPacket({ t: 'ack', a: 'SET_PIN', ok: false, msg: 'PIN phải từ 4 đến 8 ký tự' });
          return;
        }
        this.pin = newPin;
        this.sendPacket({ t: 'ack', a: 'SET_PIN', ok: true, msg: 'Đã đổi mã PIN mới thành công' });
        break;
      }
      case 'SIM': {
        const line = String(p.line || '').trim();
        let simResult = 'Lệnh giả lập không hợp lệ';

        if (line === 'w x') {
          this.status.w = null;
          this.status.err |= 1 << 0; // E1 - giong firmware: bit canh bao co ca trong err lan wrn
          this.status.wrn |= 1 << 0;
          simResult = 'Đã ngắt cảm biến nước T1 (null, E1)';
        } else if (line.startsWith('w ')) {
          const val = parseFloat(line.slice(2));
          this.status.w = isNaN(val) ? 25.0 : val;
          this.status.err &= ~(1 << 0);
          this.status.wrn &= ~(1 << 0);
          simResult = `T1 nước = ${this.status.w}°C`;
        } else if (line === 'h 75') {
          this.status.h = 76.5;
          this.status.err |= 1 << 3; // E4
          this.status.st = 5;
          this.status.ph = 'FAULT';
          simResult = 'Cục nóng T3 = 76.5°C -> Bật lỗi E4 quá nhiệt [K]';
        } else if (line === 'h ok') {
          this.status.h = 38.0;
          simResult = 'Cục nóng T3 nguội về 38.0°C (cho phép xóa E4)';
        } else if (line === 'f1 x') {
          this.status.f.rpm[0] = 0;
          this.status.f.bad[0] = 1;
          this.status.err |= 1 << 5; // E6
          this.status.st = 5;
          this.status.ph = 'FAULT';
          simResult = 'Quạt 1 kẹt RPM 0 -> Bật lỗi E6 [K]';
        } else if (line === 'p1 o') {
          this.status.p[0][1] = 1;
          this.status.p[0][4] = 0;
          this.status.err |= 1 << 8; // E9
          this.status.st = 5;
          this.status.ph = 'FAULT';
          simResult = 'Sò 1 đứt dòng 0mA -> Bật lỗi E9 [K]';
        } else if (line === 'p1 ok') {
          this.status.p[0][1] = 0;
          this.status.err &= ~(1 << 8);
          simResult = 'Sò 1 hoạt động bình thường';
        } else if (line === 'f ok') {
          this.status.f.bad = [0, 0];
          this.status.err &= ~((1 << 5) | (1 << 6));
          simResult = '2 quạt hoạt động bình thường';
        } else if (line === 'clear') {
          this.status.err = 0;
          this.status.wrn = 0;
          this.status.w = 25.2;
          this.status.h = 35.0;
          this.status.c = 18.0;
          this.status.f.bad = [0, 0];
          this.status.p[0][1] = 0;
          this.status.p[1][1] = 0;
          this.status.st = this.status.pw ? 3 : 0;
          this.status.ph = this.status.pw ? 'COOLING' : 'OFF';
          simResult = 'Đã khôi phục trạng thái máy giả lập chuẩn';
        }

        this.sendPacket({ t: 'ack', a: 'SIM', ok: true, msg: simResult });
        this.sendPacket({ ...this.status, t: 'st' });
        break;
      }
      default: {
        this.sendPacket({ t: 'ack', a, ok: false, msg: `Lệnh chưa biết: ${a}` });
        break;
      }
    }
  }
}
