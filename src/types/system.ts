/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Status packet structure ("t":"st")
export interface ChillerStatus {
  w: number | null; // T1 Water temp (°C) - null = sensor error
  c: number | null; // T2 Cold block temp (°C) - null = sensor error
  h: number | null; // T3 Hot heatsink temp (°C) - null = sensor error
  h2?: number | null; // T4 Hot heatsink 2 (°C) - null = sensor error, absent = older firmware
  kwh?: number; // Energy used this month (kWh), counted by the machine
  wt?: number; // Total power now (W) = measured current x nominal voltage (fan + 2 TECs)
  vn?: number; // Nominal supply voltage used for the power estimate (V)
  set: number; // Target temperature (°C)
  pw: number; // 0 = OFF, 1 = ON (Cooling power)
  fm: number; // Fan mode: 0: Auto, 1: Medium (Êm), 2: Emergency (Mạnh)
  st: number; // Machine state: 0 TẮT, 1 CHỜ, 2 KHỞI ĐỘNG, 3 LÀM LẠNH, 4 DỪNG, 5 LỖI, 6 KIỂM TRA
  ph: string; // Phase text on machine LCD (e.g. OFF, READY, WAIT, FAN CHECK, SOFT START, COOLING, COOLING (HOT), SOFT STOP, COOL-DOWN, FAULT, TEST (APP), OTA)
  stg: number; // Stages needed according to temperature
  lim: number; // Stages allowed
  red: number; // 0/1: Stage reduction active due to hot T3
  // TEC1, TEC2 status: [on (0/1), bad (0/1), en (0/1), cur (0/1 has ACS712), ma (mA)]
  // Note: TEC1 is wired together with water valve (TEC1 on = valve open; TEC1 current includes valve current)
  p: [number, number, number, number, number][];
  // Fan status
  f: {
    pct: number; // Current PWM %
    max: number; // Max PWM % allowed for current mode
    cur: number; // Has ACS712 sensor (0/1)
    ma: number; // Total fan current in mA
    rpm: [number, number]; // [fan1_rpm, fan2_rpm]
    bad: [number, number]; // [fan1_bad, fan2_bad] locked fault flags
    ok?: number; // 1 = both fans reached stable RPM (firmware only switches a TEC on after this, also in TEST)
  };
  err: number; // Error bitmask (bit b = E(b+1))
  wrn: number; // Warning bitmask (warning only, machine keeps running)
  tst: {
    on: number; // Test mode active (0/1)
    left: number; // Seconds remaining in test mode (max 600s)
    p1: number; // Requested TEC1
    p2: number; // Requested TEC2
    fan: number; // Requested fan % (0-100)
  };
  wifi: {
    sta: number; // 0 not setup, 1 connecting, 2 connected, 3 not found, 4 wrong password
    ip: string; // IP address
    rssi: number; // Signal strength dBm
  };
  up: number; // Uptime in seconds
  heap: number; // Free RAM in bytes
  maxblk: number; // Largest RAM block in bytes
  sim: number; // Simulation mode active (0/1)
}

// Config packet structure ("t":"cf")
export interface ChillerConfig {
  set: number; // 5 - 35 °C: Target water temperature
  diff: number; // 0.5 - 2.0 °C: Differential before cooling restarts
  mode: number; // 0, 1, 2: Fan mode
  pel1_en: number; // 0/1: Enable TEC1 + water valve
  pel2_en: number; // 0/1: Enable TEC2
  s2on: number; // diff - 10 °C: Water >= set + s2on -> 2 TECs
  s2off: number; // 0 - s2on °C: Water < set + s2off -> back to 1 TEC
  min_on: number; // 5 - 600 s: Min TEC runtime
  min_off: number; // 10 - 900 s: Min TEC rest time
  // Hot side = T3, or the higher of T3/T4 once T4 is fitted
  hot_red: number; // °C: T3 >= hot_red -> reduce 1 TEC
  hot_max: number; // 40 - 90 °C: T3 >= hot_max -> cutoff (E4)
  hot_clr: number; // °C: T3 < hot_clr before E4 can be cleared
  cold_min: number; // -10 - 15 °C: T2 <= cold_min -> cutoff (E5, anti-freeze)
  fan_lo: number; // °C: T3 <= fan_lo -> lowest fan speed
  fan_hi: number; // °C: T3 >= fan_hi -> highest fan speed
  fan_off: number; // °C: TEC off + T3 < fan_off -> turn fan off
  fan_min: number; // 10 - 100 %: Min fan speed when active
  fmax_a: number; // fan_min - 100 %: Max fan speed for AUTO
  fmax_m: number; // fan_min - 100 %: Max fan speed for MEDIUM
  fmax_e: number; // fan_min - 100 %: Max fan speed for EMERGENCY
  med_tec: number; // 0 - 2: Max TEC stages allowed in MEDIUM mode
  fan_runon: number; // 10 - 1800 s: Fan post-run cooldown time after TECs turn off
  fan_rpm: number; // RPM: Min RPM threshold (0 = no check)
  fan_rpmx: number; // RPM: Max RPM threshold (0 = no check)
  fan_ma: number; // 300 - 10000 mA: Max fan current cutoff (E8)
  pel_min: number; // mA: Min TEC current when on (broken check E9/E10)
  pel_max: number; // mA: Max TEC current when on (overcurrent check E9/E10)
  off_w: number; // -10 - 10 °C: Calibration offset for T1 water
  off_c: number; // -10 - 10 °C: Calibration offset for T2 cold block
  off_h: number; // -10 - 10 °C: Calibration offset for T3 hot heatsink
  off_h2?: number; // -10 - 10 °C: Calibration offset for T4 hot heatsink 2 (absent = older firmware)
  z_f: number; // 1.17 - 2.17 V: ACS712 0A voltage for fan
  z_p1: number; // 1.17 - 2.17 V: ACS712 0A voltage for TEC1
  z_p2: number; // 1.17 - 2.17 V: ACS712 0A voltage for TEC2
  k_f: number; // 33 - 207 counts/A: ACS712 sensitivity coefficient for fan
  k_p1: number; // 33 - 207 counts/A: ACS712 sensitivity coefficient for TEC1
  k_p2: number; // 33 - 207 counts/A: ACS712 sensitivity coefficient for TEC2
  bz_key: number; // 0/1: Keypad beep
  bz_alarm: number; // 0/1: Alarm buzzer
  // Metadata fields
  fw?: string; // Firmware version & build date, e.g. "2.0.0 (Oct 28 2026)"
  dev?: string; // Device ID (WiFi MAC without colons)
  ssid?: string; // Configured home WiFi SSID
  rst?: string; // Last reset reason: POWERON, SW, PANIC, WDT, BROWNOUT, EXT
  pend?: number; // 1 = newly flashed firmware pending 60s confirmation
  ap?: string; // Machine WiFi AP SSID for firmware upload
}

// Inbound packet types
export interface PacketStatus extends ChillerStatus {
  t: 'st';
}

export interface PacketConfig extends ChillerConfig {
  t: 'cf';
}

export interface PacketAck {
  t: 'ack';
  a: string;
  ok: boolean;
  msg?: string;
}

export interface PacketWifiList {
  t: 'wl';
  n: [string, number, number][]; // [ssid, rssi_dBm, has_password (0/1)]
  err?: string;
}

// Nhat ky: 1 su kien = [t, type, src, val] (xem history.h firmware, src/services/history.ts)
export type HistoryTuple = [number, number, number, number];

export interface PacketHistory {
  t: 'hi'; // Danh sach nhat ky, MOI NHAT truoc, gui nhieu trang
  clr: boolean; // Trang dau -> xoa danh sach cu
  end: boolean; // Trang cuoi
  max?: number; // So su kien toi da may luu (100)
  e: HistoryTuple[];
}

export interface PacketHistoryEvent {
  t: 'ev'; // Su kien moi trong luc dang ket noi, CU -> MOI
  e: HistoryTuple[];
}

export type AnyPacket =
  | PacketStatus
  | PacketConfig
  | PacketAck
  | PacketWifiList
  | PacketHistory
  | PacketHistoryEvent;

// Error definition
export interface ErrorInfo {
  code: string; // E1 - E12
  bit: number;
  name: string;
  description: string;
  isLocked: boolean; // Locked error [K] requiring CLEAR_FAULTS or POWER toggle
  isWarningOnly: boolean; // Machine keeps running
  suggestedAction: string;
}

// Locked errors bitmask: E4, E6, E7, E8, E9, E10, E11
// Bits 3, 5, 6, 7, 8, 9, 10 => 0x07E8
export const LOCKED_ERRORS_BITMASK = 0x07e8;

export const ERROR_DEFINITIONS: Record<number, Omit<ErrorInfo, 'bit'>> = {
  1: {
    code: 'E1',
    name: 'Cảm biến nước T1 lỗi',
    description: 'Không đọc được nhiệt độ nước trong bể.',
    isLocked: false,
    isWarningOnly: true,
    suggestedAction: 'Kiểm tra giắc cắm đầu dò T1 hoặc dây cảm biến.',
  },
  2: {
    code: 'E2',
    name: 'Cảm biến block lạnh T2 lỗi',
    description: 'Không đọc được nhiệt độ block nhôm lạnh.',
    isLocked: false,
    isWarningOnly: true,
    suggestedAction: 'Kiểm tra đầu dò T2 gắn trên mặt lạnh của máy.',
  },
  3: {
    code: 'E3',
    name: 'Cảm biến cục nóng T3/T4 lỗi',
    description: 'Mất tín hiệu cảm biến nhiệt độ tản nhiệt nóng (T3, hoặc T4 nếu máy có lắp).',
    isLocked: false,
    isWarningOnly: false,
    suggestedAction: 'Kiểm tra đầu dò T3 / T4 trên dàn tản nhiệt quạt.',
  },
  4: {
    code: 'E4',
    name: 'Cục nóng quá nhiệt',
    description: 'Nhiệt độ tản nhiệt T3 (hoặc T4 nếu có lắp) vượt ngưỡng an toàn (hot_max).',
    isLocked: true,
    isWarningOnly: false,
    suggestedAction: 'Chờ tản nhiệt nguội dưới hot_clr, kiểm tra quạt và thông gió.',
  },
  5: {
    code: 'E5',
    name: 'Block lạnh quá lạnh – chống đóng băng',
    description: 'Nhiệt độ block T2 tụt quá thấp (cold_min), máy tạm ngắt để tránh nứt vỡ.',
    isLocked: false,
    isWarningOnly: false,
    suggestedAction: 'Kiểm tra lưu lượng nước qua máy, tránh nghẹt ống dẫn.',
  },
  6: {
    code: 'E6',
    name: 'Quạt 1 không quay / RPM bất thường',
    description: 'Quạt làm mát số 1 bị kẹt hoặc đứt dây tín hiệu tốc độ.',
    isLocked: true,
    isWarningOnly: false,
    suggestedAction: 'Kiểm tra cánh quạt 1 có bị kẹt rác không, kiểm tra giắc cắm quạt.',
  },
  7: {
    code: 'E7',
    name: 'Quạt 2 không quay / RPM bất thường',
    description: 'Quạt làm mát số 2 bị kẹt hoặc đứt dây tín hiệu tốc độ.',
    isLocked: true,
    isWarningOnly: false,
    suggestedAction: 'Kiểm tra cánh quạt 2 có bị cấn dây hoặc kẹt cánh không.',
  },
  8: {
    code: 'E8',
    name: 'Quạt quá dòng, đã cắt nguồn quạt',
    description: 'Dòng điện cấp cho 2 quạt vượt ngưỡng an toàn (fan_ma).',
    isLocked: true,
    isWarningOnly: false,
    suggestedAction: 'Kiểm tra ngắn mạch quạt hoặc cuộn dây motor quạt bị chập.',
  },
  9: {
    code: 'E9',
    name: 'Sò 1 (+ van) đứt / quá dòng / ngắn mạch',
    description: 'Dòng điện sò lạnh 1 hoặc van nước bất thường ngoài ngưỡng cho phép.',
    isLocked: true,
    isWarningOnly: false,
    suggestedAction: 'Kiểm tra sò lạnh 1, cuộn hút van nước và nguồn cấp 12V.',
  },
  10: {
    code: 'E10',
    name: 'Sò 2 đứt / quá dòng / ngắn mạch',
    description: 'Dòng điện sò lạnh 2 bất thường ngoài ngưỡng cho phép.',
    isLocked: true,
    isWarningOnly: false,
    suggestedAction: 'Kiểm tra sò lạnh 2 và dây dẫn công suất.',
  },
  11: {
    code: 'E11',
    name: 'Sò bị kẹt ON (tắt vẫn có dòng)',
    description: 'MOSFET điều khiển sò bị chập, sò vẫn ăn dòng khi lệnh tắt.',
    isLocked: true,
    isWarningOnly: false,
    suggestedAction: 'Ngắt nguồn điện ngay lập tức để kiểm tra mạch công suất MOSFET.',
  },
  12: {
    code: 'E12',
    name: 'Mất cảm biến dòng của sò',
    description: 'Mạch không nhận diện được cảm biến ACS712 của sò lạnh.',
    isLocked: false,
    isWarningOnly: false,
    suggestedAction: 'Kiểm tra kết nối mô-đun cảm biến dòng điện ACS712.',
  },
};

/**
 * Format current in mA:
 * Below 1000 mA -> mA (e.g. "450 mA")
 * From 1000 mA -> A with 2 decimals (e.g. "4.35 A")
 */
export function formatCurrent(mA: number): string {
  if (mA < 1000) {
    return `${Math.round(mA)} mA`;
  }
  return `${(mA / 1000).toFixed(2)} A`;
}

/**
 * Parse error bitmasks into detailed error objects
 */
export function parseErrors(errMask: number, wrnMask: number): {
  activeErrors: ErrorInfo[];
  hasLockedErrors: boolean;
  hasWarningOnly: boolean;
} {
  const activeErrors: ErrorInfo[] = [];
  let hasLocked = false;
  let hasWarningOnly = false;

  // Firmware: wrn la TAP CON cua err (bit canh bao co mat trong ca 2). Bit co trong wrn = chi canh bao,
  // may van chay - KHONG duoc coi la loi dung may.
  for (let b = 0; b < 12; b++) {
    const errorNum = b + 1;
    const isWarning = (wrnMask & (1 << b)) !== 0;
    const isError = (errMask & (1 << b)) !== 0 && !isWarning;

    if (isError || isWarning) {
      const def = ERROR_DEFINITIONS[errorNum] || {
        code: `E${errorNum}`,
        name: `Lỗi E${errorNum}`,
        description: 'Mã lỗi hệ thống chưa xác định',
        isLocked: (LOCKED_ERRORS_BITMASK & (1 << b)) !== 0,
        isWarningOnly: isWarning && !isError,
        suggestedAction: 'Kiểm tra thiết bị và khởi động lại',
      };

      const info: ErrorInfo = {
        ...def,
        bit: b,
        isWarningOnly: isWarning && !isError,
      };

      if (info.isLocked) {
        hasLocked = true;
      }
      if (info.isWarningOnly) {
        hasWarningOnly = true;
      }

      activeErrors.push(info);
    }
  }

  return {
    activeErrors,
    hasLockedErrors: hasLocked,
    hasWarningOnly,
  };
}

/**
 * Human-friendly state text and color
 */
export function getStateDetails(
  st: number,
  ph: string,
  errMask: number,
  stg: number,
  pw: number
): {
  text: string;
  badgeText: string;
  color: 'blue' | 'green' | 'yellow' | 'gray' | 'red' | 'purple';
} {
  if (errMask !== 0) {
    return {
      text: 'Máy phát hiện lỗi bảo vệ',
      badgeText: 'LỖI',
      color: 'red',
    };
  }

  if (st === 6 || ph.includes('TEST')) {
    return {
      text: 'Đang ở chế độ kiểm tra thiết bị',
      badgeText: 'KIỂM TRA',
      color: 'purple',
    };
  }

  if (pw === 0 || st === 0) {
    if (ph === 'COOL-DOWN' || ph.includes('STOP')) {
      return {
        text: 'Đang quạt giải nhiệt rồi tắt',
        badgeText: 'GIẢI NHIỆT',
        color: 'yellow',
      };
    }
    return {
      text: 'Làm lạnh đang tắt',
      badgeText: 'ĐÃ TẮT',
      color: 'gray',
    };
  }

  if (st === 1) {
    if (ph === 'WAIT') {
      return {
        text: 'Đang nghỉ chờ thời gian tối thiểu (min_off)',
        badgeText: 'CHỜ NGHỈ',
        color: 'yellow',
      };
    }
    return {
      text: 'Nước đã đạt nhiệt độ cài đặt',
      badgeText: 'ĐÃ ĐẠT NHIỆT',
      color: 'green',
    };
  }

  if (st === 2) {
    return {
      text: 'Đang khởi động quạt kiểm tra tốc độ',
      badgeText: 'KHỞI ĐỘNG',
      color: 'yellow',
    };
  }

  if (st === 3) {
    if (ph.includes('HOT')) {
      return {
        text: 'Đang làm lạnh (giảm công suất do tản nhiệt nóng)',
        badgeText: 'LÀM LẠNH (NÓNG)',
        color: 'yellow',
      };
    }
    const stageDesc = stg >= 2 ? '2 sò lạnh' : '1 sò lạnh + van';
    return {
      text: `Đang làm lạnh (${stageDesc})`,
      badgeText: 'LÀM LẠNH',
      color: 'blue',
    };
  }

  if (st === 4) {
    return {
      text: 'Đang dừng và quạt giải nhiệt',
      badgeText: 'ĐANG DỪNG',
      color: 'yellow',
    };
  }

  return {
    text: ph || 'Sẵn sàng',
    badgeText: ph || 'SẴN SÀNG',
    color: 'blue',
  };
}
