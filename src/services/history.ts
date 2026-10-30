/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Dich nhat ky cua may (history.h firmware) sang tieng Viet.
// Su kien: [t, type, src, val]. t = giay "gio dia phuong" tu 1970 (doc bang getUTC*),
// hoac bit 31 = 1: chua biet gio, 31 bit thap = so giay tu luc may khoi dong.

import { ERROR_DEFINITIONS, HistoryTuple } from '../types/system';

export interface HistoryEvent {
  t: number;
  type: number;
  src: number;
  val: number;
}

export const HISTORY_MAX = 100; // Bang HIST_SIZE cua firmware: web giu toi da bang may
export const TIME_UPTIME = 0x80000000;

export const EV = {
  BOOT: 1,
  POWER: 2,
  SETPOINT: 3,
  FAN_MODE: 4,
  COOL_RUN: 5,
  ERR_SET: 6,
  ERR_CLEAR: 7,
  HOT_REDUCE: 8,
  TEST: 9,
  SETTINGS: 10,
  DEFAULTS: 11,
  ACS_ZERO: 12,
  WIFI_UP: 13,
  OTA: 14,
  TIME_SET: 15,
} as const;

export type HistoryCategory = 'cool' | 'error' | 'control' | 'system';

const SRC_LABEL: Record<number, string> = {
  0: 'tự động',
  1: 'nút trên máy',
  2: 'remote',
  3: 'app',
  4: 'bảo vệ',
  5: 'hết giờ',
  6: 'trang nạp firmware',
};

// esp_reset_reason()
const RESET_LABEL: Record<number, string> = {
  1: 'cắm điện',
  2: 'nút reset',
  3: 'khởi động lại bằng phần mềm',
  4: 'lỗi phần mềm – PANIC',
  5: 'máy bị treo – watchdog',
  6: 'máy bị treo – watchdog',
  7: 'máy bị treo – watchdog',
  8: 'thức dậy',
  9: 'sụt nguồn – BROWNOUT',
};

const FAN_MODE_LABEL = ['Tự động', 'Êm', 'Mạnh'];

export function fromTuple(x: HistoryTuple): HistoryEvent {
  return { t: x[0] >>> 0, type: x[1], src: x[2], val: x[3] };
}

const same = (a: HistoryEvent, b: HistoryEvent) =>
  a.t === b.t && a.type === b.type && a.src === b.src && a.val === b.val;

/** Them su kien moi (cu -> moi) len dau danh sach (moi nhat truoc), bo trung, giu toi da `max`. */
export function prependEvents(list: HistoryEvent[], fresh: HistoryEvent[], max = HISTORY_MAX): HistoryEvent[] {
  const out = [...list];
  for (const e of fresh) {
    if (out.slice(0, 20).some((x) => same(x, e))) continue; // Su kien vua gui trong trang 'hi' xong lai gui 'ev'
    out.unshift(e);
  }
  return out.slice(0, max);
}

const unpackVer = (v: number) => `${(v >> 10) & 0x3f}.${(v >> 5) & 0x1f}.${v & 0x1f}`;

export function formatDuration(sec: number): string {
  if (sec >= 65535) return 'hơn 18 giờ';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h} giờ ${m} phút`;
  if (m > 0) return `${m} phút${s ? ` ${s} giây` : ''}`;
  return `${s} giây`;
}

function errorList(mask: number): string {
  const out: string[] = [];
  for (let b = 0; b < 12; b++) {
    if (mask & (1 << b)) {
      const d = ERROR_DEFINITIONS[b + 1];
      out.push(d ? `${d.code} ${d.name}` : `E${b + 1}`);
    }
  }
  return out.join(', ');
}

export function eventCategory(e: HistoryEvent): HistoryCategory {
  switch (e.type) {
    case EV.COOL_RUN:
    case EV.HOT_REDUCE:
      return 'cool';
    case EV.ERR_SET:
    case EV.ERR_CLEAR:
      return 'error';
    case EV.POWER:
    case EV.SETPOINT:
    case EV.FAN_MODE:
    case EV.TEST:
    case EV.SETTINGS:
    case EV.DEFAULTS:
    case EV.ACS_ZERO:
      return 'control';
    default:
      return 'system';
  }
}

/** Su kien can de y (to do): loi, may bi treo / sut nguon. */
export function isAlarmEvent(e: HistoryEvent): boolean {
  return e.type === EV.ERR_SET || (e.type === EV.BOOT && [4, 5, 6, 7, 9].includes(e.src));
}

/** Ai / cai gi gay ra (chi voi su kien co nguon). '' = khong hien. */
export function eventSource(e: HistoryEvent): string {
  if (e.type === EV.BOOT || e.type === EV.COOL_RUN || e.type === EV.HOT_REDUCE || e.type === EV.ERR_SET) return '';
  return SRC_LABEL[e.src] ?? '';
}

export function describeEvent(e: HistoryEvent): string {
  switch (e.type) {
    case EV.BOOT:
      return `Máy khởi động (${RESET_LABEL[e.src] ?? `lý do ${e.src}`}) – firmware ${unpackVer(e.val)}`;
    case EV.POWER:
      return e.val ? 'Bật làm lạnh' : 'Tắt làm lạnh';
    case EV.SETPOINT: {
      const v = e.val >= 0x8000 ? e.val - 0x10000 : e.val; // int16
      return `Đặt nhiệt độ ${(v / 10).toFixed(1)} °C`;
    }
    case EV.FAN_MODE:
      return `Chế độ quạt: ${FAN_MODE_LABEL[e.val] ?? e.val}`;
    case EV.COOL_RUN:
      return `Làm lạnh xong – chạy ${formatDuration(e.val)} (${e.src >= 2 ? '2 sò' : '1 sò + van'})`;
    case EV.ERR_SET:
      return `Lỗi: ${errorList(e.val)}`;
    case EV.ERR_CLEAR:
      return `Hết lỗi: ${errorList(e.val)}`;
    case EV.HOT_REDUCE:
      return `Cục nóng ${(e.val / 10).toFixed(1)} °C – giảm còn 1 sò`;
    case EV.TEST:
      return e.val ? 'Vào điều khiển thủ công (kiểm tra)' : 'Thoát điều khiển thủ công';
    case EV.SETTINGS:
      return `Đổi ${e.val} cài đặt`;
    case EV.DEFAULTS:
      return 'Về cài đặt mặc định';
    case EV.ACS_ZERO:
      if (e.val >= 11 && e.val <= 13) return `Hiệu chỉnh cảm biến dòng ${['quạt', 'sò 1', 'sò 2'][e.val - 11]} theo ampe kìm`;
      return 'Đo điểm 0 A cảm biến dòng';
    case EV.WIFI_UP:
      return `Kết nối WiFi nhà (−${e.val} dBm)`;
    case EV.OTA:
      return 'Nạp firmware mới';
    case EV.TIME_SET:
      return 'Đồng bộ giờ từ điện thoại';
    default:
      return `Sự kiện #${e.type}`;
  }
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Ngay (dd/mm/yyyy) cua su kien, '' neu chua biet gio. */
export function eventDay(e: HistoryEvent): string {
  if (e.t & TIME_UPTIME) return '';
  const d = new Date(e.t * 1000);
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

export function formatEventTime(e: HistoryEvent): string {
  if (e.t & TIME_UPTIME) return `Chưa có giờ · ${formatDuration((e.t & 0x7fffffff) >>> 0)} sau khởi động`;
  const d = new Date(e.t * 1000);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

/** Gio dia phuong cua dien thoai (giay tu 1970, da cong mui gio) cho lenh TIME_SET. */
export function localEpochNow(): number {
  return Math.floor(Date.now() / 1000) - new Date().getTimezoneOffset() * 60;
}
