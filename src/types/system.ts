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
  set: number; // 0 - 35 °C: Target water temperature (< 5 °C: block may hit anti-freeze E5)
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
  hot_max: number; // 40 - 90 °C (default 75): T3/T4 >= hot_max -> full stop (E4)
  hot_clr: number; // °C: T3 < hot_clr before E4 can be cleared
  cold_min: number; // -10 - 15 °C: T2 <= cold_min -> cutoff (E5, anti-freeze)
  fan_lo: number; // °C: T3 <= fan_lo -> lowest fan speed
  fan_hi: number; // °C: T3 >= fan_hi -> highest fan speed
  fan_off: number; // °C (default 45): TEC off (also machine OFF) + hot side > fan_off -> fans keep cooling
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
  flow_dt?: number; // 5 - 30 °C (default 12): E13 when block is colder than water by >= flow_dt (absent = older firmware)
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
  code: string; // E1 - E19
  bit: number;
  name: string;
  description: string;
  isLocked: boolean; // Locked error [K] requiring CLEAR_FAULTS or POWER toggle
  isWarningOnly: boolean; // Machine keeps running
  suggestedAction: string;
  steps: string[]; // Cac buoc xu ly cho khach hang (hien tren trang chu khi co loi)
}

// Locked errors bitmask: E4, E6, E7, E8, E9, E10, E11, E13, E14
// Bits 3, 5, 6, 7, 8, 9, 10, 12, 13 => 0x37E8
export const LOCKED_ERRORS_BITMASK = 0x37e8;

// So ma loi firmware gui (bit b = E(b+1)); firmware 2.0 build 30/10/2026: E1..E19
export const ERROR_COUNT = 19;

export const ERROR_DEFINITIONS: Record<number, Omit<ErrorInfo, 'bit'>> = {
  1: {
    code: 'E1',
    name: 'Cảm biến nước T1 lỗi',
    description:
      'Không đọc được nhiệt độ nước. Nếu cảm biến block T2 còn tốt, máy vẫn chạy (tối đa 1 sò) và lấy T2 để điều khiển.',
    isLocked: false,
    isWarningOnly: true,
    suggestedAction: 'Kiểm tra đầu dò nước T1 và dây cắm.',
    steps: [
      'Kiểm tra đầu dò T1 có ngâm trong nước / gắn đúng chỗ không.',
      'Rút ra cắm lại giắc cảm biến T1 trên bo mạch, xem dây có bị đứt, gãy, chuột cắn không.',
      'Lỗi tự hết khi cảm biến đọc lại được. Vẫn lỗi → thay đầu dò DS18B20 mới.',
    ],
  },
  2: {
    code: 'E2',
    name: 'Cảm biến block lạnh T2 lỗi',
    description:
      'Không đọc được nhiệt độ block lạnh. Nếu T1 còn tốt, máy vẫn chạy (tối đa 1 sò) nhưng mất chống đông block.',
    isLocked: false,
    isWarningOnly: true,
    suggestedAction: 'Kiểm tra đầu dò T2 gắn trên block lạnh.',
    steps: [
      'Kiểm tra đầu dò T2 còn ép sát vào block lạnh không.',
      'Rút ra cắm lại giắc cảm biến T2, kiểm tra dây.',
      'Nên xử lý sớm: khi T2 lỗi máy không biết block có sắp đông đá hay không.',
    ],
  },
  3: {
    code: 'E3',
    name: 'Cảm biến cục nóng T3/T4 lỗi',
    description: 'Mất tín hiệu cảm biến nhiệt tản nhiệt nóng (T3, hoặc T4 nếu có lắp). Máy ngắt sò, quạt chạy tối đa.',
    isLocked: false,
    isWarningOnly: false,
    suggestedAction: 'Kiểm tra đầu dò T3 / T4 trên tản nhiệt.',
    steps: [
      'Kiểm tra đầu dò T3 (và T4) còn gắn chặt trên tản nhiệt.',
      'Rút ra cắm lại giắc cảm biến, kiểm tra dây có bị nóng chảy / đứt không.',
      'Lỗi tự hết khi đọc lại được, máy tự chạy lại.',
    ],
  },
  4: {
    code: 'E4',
    name: 'Cục nóng quá nhiệt – dừng hẳn',
    description:
      'Tản nhiệt T3/T4 vượt ngưỡng an toàn (hot_max, mặc định 75 °C). Máy dừng hẳn sò, quạt chạy tối đa để hạ nhiệt.',
    isLocked: true,
    isWarningOnly: false,
    suggestedAction: 'Chờ nguội dưới hot_clr (55 °C), làm sạch tản nhiệt / quạt rồi xóa lỗi.',
    steps: [
      'KHÔNG tắt nguồn – để quạt tiếp tục chạy hạ nhiệt cục nóng.',
      'Kiểm tra 2 quạt có quay không, cánh quạt và lá tản nhiệt có bám bụi không.',
      'Đảm bảo máy đặt nơi thoáng, cách tường ≥ 20 cm, không bị che hướng gió ra.',
      'Chờ T3/T4 xuống dưới 55 °C rồi bấm "Xóa lỗi" (hoặc bật lại làm lạnh).',
      'Lỗi lặp lại thường xuyên → kiểm tra keo tản nhiệt giữa sò và tản nhiệt, liên hệ kỹ thuật.',
    ],
  },
  5: {
    code: 'E5',
    name: 'Block lạnh sắp đông đá',
    description:
      'Block T2 xuống dưới cold_min (mặc định 1 °C). Máy tạm ngắt sò để block không đóng băng, ấm lên 4 °C tự chạy lại. ' +
      'Khác E13: E5 là bảo vệ tức thời, có thể chỉ do đặt nhiệt độ quá thấp.',
    isLocked: false,
    isWarningOnly: false,
    suggestedAction: 'Kiểm tra nhiệt độ đặt và nước có chảy qua máy không.',
    steps: [
      'Nếu đặt nhiệt độ dưới 5 °C: tăng nhiệt độ đặt lên – block luôn lạnh hơn nước vài độ nên dễ chạm ngưỡng đông.',
      'Kiểm tra bơm có chạy, ống vào / ra không bị gập, lưới lọc không nghẹt.',
      'Máy tự chạy lại khi block ấm lên. Lặp lại 3 lần trong 30 phút sẽ chuyển thành E13 (khóa).',
    ],
  },
  6: {
    code: 'E6',
    name: 'Quạt 1 không quay / tốc độ bất thường',
    description: 'Quạt làm mát số 1 bị kẹt, quay quá chậm hoặc mất dây tín hiệu tốc độ.',
    isLocked: true,
    isWarningOnly: false,
    suggestedAction: 'Kiểm tra cánh quạt 1 và giắc cắm quạt.',
    steps: [
      'Tắt máy, xem cánh quạt 1 có bị rác / dây vướng làm kẹt không.',
      'Kiểm tra giắc 4 dây của quạt 1 cắm chặt (dây vàng/xanh là tín hiệu tốc độ).',
      'Bấm "Xóa lỗi" – máy chạy thử quạt và kiểm tra lại tốc độ trước khi bật sò.',
      'Vẫn lỗi → thay quạt 1.',
    ],
  },
  7: {
    code: 'E7',
    name: 'Quạt 2 không quay / tốc độ bất thường',
    description: 'Quạt làm mát số 2 bị kẹt, quay quá chậm hoặc mất dây tín hiệu tốc độ.',
    isLocked: true,
    isWarningOnly: false,
    suggestedAction: 'Kiểm tra cánh quạt 2 và giắc cắm quạt.',
    steps: [
      'Tắt máy, xem cánh quạt 2 có bị rác / dây vướng làm kẹt không.',
      'Kiểm tra giắc 4 dây của quạt 2 cắm chặt.',
      'Bấm "Xóa lỗi" – máy chạy thử quạt và kiểm tra lại tốc độ trước khi bật sò.',
      'Vẫn lỗi → thay quạt 2.',
    ],
  },
  8: {
    code: 'E8',
    name: 'Quạt quá dòng – đã cắt nguồn quạt',
    description: 'Dòng 2 quạt vượt ngưỡng (fan_ma) hoặc bị chập. Máy cắt nguồn quạt và ngắt sò ngay.',
    isLocked: true,
    isWarningOnly: false,
    suggestedAction: 'Kiểm tra chập dây / motor quạt.',
    steps: [
      'Tắt nguồn máy.',
      'Kiểm tra dây quạt có bị chập, vỏ dây có bị cháy xém không.',
      'Thử quay cánh quạt bằng tay – nặng / kẹt là motor hỏng.',
      'Thay quạt hỏng rồi bật lại, bấm "Xóa lỗi".',
    ],
  },
  9: {
    code: 'E9',
    name: 'Sò 1 (+ van) đứt / quá dòng / ngắn mạch',
    description: 'Dòng sò lạnh 1 (đi chung van nước) không có, quá lớn hoặc bị chập.',
    isLocked: true,
    isWarningOnly: false,
    suggestedAction: 'Kiểm tra sò 1, van nước và nguồn 12 V.',
    steps: [
      'Xem chữ trên màn hình: OPEN = đứt (không có dòng), OVERCURRENT = quá dòng, SHORT = chập.',
      'OPEN: kiểm tra dây sò 1, cầu chì, giắc cắm; dùng đồng hồ đo điện trở sò.',
      'OVERCURRENT / SHORT: tắt nguồn ngay, kiểm tra dây sò bị chạm vỏ, sò bị cháy.',
      'Có thể tạm tắt sò 1 trong Cài đặt để máy chạy bằng sò 2 (lưu ý: van nước đi chung sò 1).',
      'Sửa xong bấm "Xóa lỗi".',
    ],
  },
  10: {
    code: 'E10',
    name: 'Sò 2 đứt / quá dòng / ngắn mạch',
    description: 'Dòng sò lạnh 2 không có, quá lớn hoặc bị chập.',
    isLocked: true,
    isWarningOnly: false,
    suggestedAction: 'Kiểm tra sò 2 và dây công suất.',
    steps: [
      'Xem chữ trên màn hình: OPEN = đứt, OVERCURRENT = quá dòng, SHORT = chập.',
      'Kiểm tra dây sò 2, cầu chì, giắc cắm; đo điện trở sò.',
      'Có thể tạm tắt sò 2 trong Cài đặt để máy chạy bằng sò 1.',
      'Sửa xong bấm "Xóa lỗi".',
    ],
  },
  11: {
    code: 'E11',
    name: 'Sò bị kẹt ON (tắt vẫn có dòng)',
    description: 'MOSFET điều khiển sò bị chập: sò vẫn chạy khi máy đã lệnh tắt. Máy đã nhả relay nguồn sò.',
    isLocked: true,
    isWarningOnly: false,
    suggestedAction: 'Ngắt nguồn ngay, kiểm tra mạch công suất.',
    steps: [
      'NGẮT NGUỒN ĐIỆN NGAY – sò chạy không kiểm soát có thể làm đông đá / hỏng máy.',
      'Liên hệ kỹ thuật kiểm tra / thay MOSFET điều khiển sò.',
      'Không tự xóa lỗi rồi chạy tiếp khi chưa sửa.',
    ],
  },
  12: {
    code: 'E12',
    name: 'Mất cảm biến dòng của sò',
    description: 'Bo mạch không nhận cảm biến dòng ACS712 của sò → không bảo vệ quá dòng được nên máy ngắt sò.',
    isLocked: false,
    isWarningOnly: false,
    suggestedAction: 'Kiểm tra kết nối mô-đun cảm biến dòng ACS712.',
    steps: [
      'Tắt nguồn, kiểm tra mô-đun ACS712 và dây nối về bo mạch.',
      'Kiểm tra nguồn 5 V cấp cho mô-đun.',
      'Bật lại – lỗi tự hết khi đọc được cảm biến.',
    ],
  },
  13: {
    code: 'E13',
    name: 'Không có nước / nước không chảy qua máy',
    description:
      'Máy phát hiện nước không chảy qua block lạnh: block lạnh hơn nước quá nhiều (≥ flow_dt, mặc định 12 °C), ' +
      'block tụt nhiệt rất nhanh trong khi nước không đổi, hoặc block sắp đông đá (E5) lặp lại nhiều lần. ' +
      'Máy dừng sò để block không đông đá và nứt.',
    isLocked: true,
    isWarningOnly: false,
    suggestedAction: 'Kiểm tra bơm, ống nước, van và lưới lọc rồi xóa lỗi.',
    steps: [
      'Kiểm tra bơm có chạy và có ngập nước không (bơm hút khí / hết nước trong lọc).',
      'Kiểm tra ống vào / ra máy không bị gập, xoắn, tuột; lưới lọc / bông lọc không nghẹt.',
      'Kiểm tra van nước của máy có mở (van chạy cùng sò 1 – nếu tắt sò 1 thì van đóng).',
      'Đuổi khí trong ống: nâng / lắc nhẹ ống cho bọt khí ra hết.',
      'Đảm bảo nước chảy đều rồi bấm "Xóa lỗi". Vẫn báo → liên hệ kỹ thuật.',
    ],
  },
  14: {
    code: 'E14',
    name: 'Sò lắp ngược / block không lạnh',
    description:
      'Sò đã chạy hơn 2 phút, dòng điện bình thường nhưng block KHÔNG lạnh hơn nước: thường do đấu ngược cực sò, ' +
      'sò hỏng một mặt hoặc cảm biến T2 gắn sai chỗ.',
    isLocked: true,
    isWarningOnly: false,
    suggestedAction: 'Kiểm tra cực đấu sò và vị trí cảm biến T2.',
    steps: [
      'Sờ thử block lạnh sau khi chạy (cẩn thận): nếu ẤM / NÓNG là sò bị đấu ngược cực.',
      'Đảo lại 2 dây sò (đỏ / đen) theo đúng sơ đồ.',
      'Kiểm tra đầu dò T2 có gắn đúng trên block lạnh (không phải bên tản nhiệt nóng).',
      'Sửa xong bấm "Xóa lỗi".',
    ],
  },
  15: {
    code: 'E15',
    name: 'Làm lạnh chậm',
    description:
      'Máy đã chạy đủ số sò cho phép 20 phút nhưng nước giảm chưa tới 0.3 °C. Máy vẫn chạy bình thường, đây chỉ là cảnh báo.',
    isLocked: false,
    isWarningOnly: true,
    suggestedAction: 'Kiểm tra công suất so với thể tích bể, giải nhiệt và lưu lượng nước.',
    steps: [
      'Bể có quá lớn so với công suất máy không? Trời nóng / đèn bể tỏa nhiệt nhiều cũng làm chậm.',
      'Làm sạch tản nhiệt và quạt; để máy nơi thoáng gió.',
      'Kiểm tra nước chảy qua máy đều (lưu lượng quá yếu hoặc quá mạnh đều giảm hiệu quả).',
      'Kiểm tra cả 2 sò đều đang bật trong Cài đặt và chế độ quạt không phải "Êm" (giới hạn số sò).',
      'Cảnh báo tự hết khi nước bắt đầu giảm hoặc đạt nhiệt độ.',
    ],
  },
  16: {
    code: 'E16',
    name: 'Cục nóng tăng nhiệt liên tục',
    description:
      'Quạt đã chạy tối đa nhưng cục nóng vẫn tăng liên tục (≥ 4.5 °C trong 3 phút). Máy tự giảm còn 1 sò để không bị E4.',
    isLocked: false,
    isWarningOnly: true,
    suggestedAction: 'Làm sạch tản nhiệt, kiểm tra quạt và chỗ đặt máy.',
    steps: [
      'Kiểm tra 2 quạt đều quay mạnh, không có vật cản hướng gió vào / ra.',
      'Vệ sinh bụi trên lá tản nhiệt.',
      'Giảm nhiệt độ phòng / di chuyển máy ra nơi thoáng hơn.',
      'Cảnh báo tự hết khi cục nóng ngừng tăng, máy tự về 2 sò.',
    ],
  },
  17: {
    code: 'E17',
    name: '2 tản nhiệt lệch nhiệt độ',
    description: 'Cục nóng 1 (T3) và cục nóng 2 (T4) lệch nhau hơn 15 °C trong 1 phút – một bên giải nhiệt kém.',
    isLocked: false,
    isWarningOnly: true,
    suggestedAction: 'Kiểm tra quạt và tản nhiệt của bên nóng hơn.',
    steps: [
      'Xem T3 / T4 bên nào nóng hơn ở trang chủ.',
      'Kiểm tra quạt phía đó có quay, tản nhiệt phía đó có bám bụi / bị che không.',
      'Kiểm tra đầu dò T3 / T4 còn gắn chặt (đầu dò lỏng sẽ đọc thấp hơn thực tế).',
    ],
  },
  18: {
    code: 'E18',
    name: '2 quạt lệch tốc độ',
    description: 'Hai quạt chạy cùng lệnh nhưng tốc độ lệch nhau hơn 40% trong 1 phút – một quạt sắp hỏng.',
    isLocked: false,
    isWarningOnly: true,
    suggestedAction: 'Vệ sinh / thay quạt chậm hơn trước khi nó dừng hẳn.',
    steps: [
      'Xem RPM quạt 1 / quạt 2 ở trang chủ để biết quạt nào chậm.',
      'Vệ sinh bụi bám ở cánh và trục quạt chậm.',
      'Quạt kêu to / rung → bạc đạn mòn, nên thay sớm trước khi thành lỗi E6 / E7.',
    ],
  },
  19: {
    code: 'E19',
    name: 'Nguồn điện không ổn định',
    description: 'Máy tự khởi động lại 3 lần liên tiếp do sụt áp / treo trong thời gian ngắn.',
    isLocked: false,
    isWarningOnly: true,
    suggestedAction: 'Kiểm tra nguồn 12 V và dây nguồn.',
    steps: [
      'Kiểm tra adapter / nguồn 12 V đủ công suất (≥ tổng công suất máy + 20%).',
      'Kiểm tra dây nguồn, giắc DC, cầu đấu có lỏng / nóng / oxi hóa không.',
      'Tránh cắm chung ổ với máy bơm lớn, máy sưởi.',
      'Bấm "Xóa lỗi" để đếm lại; máy chạy ổn định 1 giờ cảnh báo tự hết.',
    ],
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
  for (let b = 0; b < ERROR_COUNT; b++) {
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
        steps: [],
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
