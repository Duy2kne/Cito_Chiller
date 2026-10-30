/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { INITIAL_APP_STATE, applyPacket } from './packetParser';
import { EV, HISTORY_MAX, describeEvent, eventDay, formatEventTime, fromTuple, isAlarmEvent } from './history';
import { HistoryTuple } from '../types/system';

const T = 1793175600; // 28/10/2026 08:20:00 gio dia phuong
const tup = (i: number): HistoryTuple => [T - i * 60, EV.SETTINGS, 3, i];

describe('nhat ky – ghep goi', () => {
  it('nhieu trang hi: trang dau thay danh sach, cac trang sau noi tiep', () => {
    let s = applyPacket(INITIAL_APP_STATE, { t: 'hi', clr: true, end: false, max: 100, e: [tup(0), tup(1)] });
    expect(s.historyLoading).toBe(true);
    s = applyPacket(s, { t: 'hi', clr: false, end: true, max: 100, e: [tup(2)] });
    expect(s.history.map((e) => e.val)).toEqual([0, 1, 2]);
    expect(s.historyLoading).toBe(false);
    s = applyPacket(s, { t: 'hi', clr: true, end: true, max: 100, e: [] });
    expect(s.history).toEqual([]); // CLEAR_HISTORY
  });

  it('ev: chen len dau (may gui cu -> moi), bo trung, toi da 100', () => {
    let s = applyPacket(INITIAL_APP_STATE, { t: 'hi', clr: true, end: true, max: 100, e: [tup(0)] });
    s = applyPacket(s, { t: 'ev', e: [tup(-1), tup(-2)] });
    expect(s.history.map((e) => e.val)).toEqual([-2, -1, 0]); // moi nhat truoc
    s = applyPacket(s, { t: 'ev', e: [tup(-2)] }); // vua co trong danh sach -> bo
    expect(s.history.length).toBe(3);
    const many: HistoryTuple[] = Array.from({ length: 150 }, (_, i) => [T + i, EV.SETTINGS, 3, i]);
    s = applyPacket(s, { t: 'ev', e: many });
    expect(s.history.length).toBe(HISTORY_MAX);
    expect(s.history[0].val).toBe(149);
  });
});

describe('nhat ky – dich', () => {
  it('gio that / chua co gio (bit 31)', () => {
    const real = fromTuple([T, EV.POWER, 1, 0]);
    expect(eventDay(real)).toBe('28/10/2026');
    expect(formatEventTime(real)).toBe('08:20:00');
    const up = fromTuple([2147483648 + 3725, EV.BOOT, 1, 2048]); // firmware gui so khong dau
    expect(eventDay(up)).toBe('');
    expect(formatEventTime(up)).toContain('1 giờ 2 phút sau khởi động');
  });

  it('noi dung tieng Viet', () => {
    expect(describeEvent(fromTuple([T, EV.BOOT, 9, 2048]))).toBe('Máy khởi động (sụt nguồn – BROWNOUT) – firmware 2.0.0');
    expect(describeEvent(fromTuple([T, EV.SETPOINT, 3, 215]))).toBe('Đặt nhiệt độ 21.5 °C');
    expect(describeEvent(fromTuple([T, EV.SETPOINT, 3, 0x10000 - 15]))).toBe('Đặt nhiệt độ -1.5 °C');
    expect(describeEvent(fromTuple([T, EV.COOL_RUN, 2, 1260]))).toBe('Làm lạnh xong – chạy 21 phút (2 sò)');
    expect(describeEvent(fromTuple([T, EV.ERR_SET, 4, (1 << 5) | (1 << 3)]))).toContain('E4');
    expect(isAlarmEvent(fromTuple([T, EV.ERR_SET, 4, 8]))).toBe(true);
    expect(isAlarmEvent(fromTuple([T, EV.BOOT, 7, 2048]))).toBe(true); // watchdog
    expect(isAlarmEvent(fromTuple([T, EV.BOOT, 1, 2048]))).toBe(false);
  });

  it('loi E13..E18: ERR_SET cho E1..E16, ERR_SET_HI cho E17+', () => {
    expect(describeEvent(fromTuple([T, EV.ERR_SET, 4, 1 << 12]))).toContain('E13');
    expect(describeEvent(fromTuple([T, EV.ERR_SET, 4, 1 << 14]))).toContain('E15');
    expect(describeEvent(fromTuple([T, EV.ERR_SET_HI, 4, 1 << 1]))).toContain('E18');
    expect(describeEvent(fromTuple([T, EV.ERR_CLEAR_HI, 3, 1 << 0]))).toMatch(/^Hết lỗi: E17/);
    expect(isAlarmEvent(fromTuple([T, EV.ERR_SET_HI, 4, 2]))).toBe(true);
  });
});
