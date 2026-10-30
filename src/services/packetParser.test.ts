/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { PacketFramingBuffer, applyPacket, INITIAL_APP_STATE } from './packetParser';
import { formatCurrent, parseErrors, LOCKED_ERRORS_BITMASK, ERROR_COUNT, ERROR_DEFINITIONS } from '../types/system';

describe('formatCurrent', () => {
  it('formats current under 1000 mA as mA', () => {
    expect(formatCurrent(0)).toBe('0 mA');
    expect(formatCurrent(450)).toBe('450 mA');
    expect(formatCurrent(999.4)).toBe('999 mA');
  });

  it('formats current 1000 mA or above as A with 2 decimals', () => {
    expect(formatCurrent(1000)).toBe('1.00 A');
    expect(formatCurrent(4280)).toBe('4.28 A');
    expect(formatCurrent(12540)).toBe('12.54 A');
  });
});

describe('parseErrors', () => {
  it('identifies clean system with no errors', () => {
    const res = parseErrors(0, 0);
    expect(res.activeErrors.length).toBe(0);
    expect(res.hasLockedErrors).toBe(false);
    expect(res.hasWarningOnly).toBe(false);
  });

  it('identifies warning-only errors like E1 (water sensor)', () => {
    // E1 is bit 0
    const res = parseErrors(0, 1 << 0);
    expect(res.activeErrors.length).toBe(1);
    expect(res.activeErrors[0].code).toBe('E1');
    expect(res.activeErrors[0].isWarningOnly).toBe(true);
    expect(res.hasLockedErrors).toBe(false);
  });

  it('treats bits present in BOTH err and wrn as warning-only (firmware: wrn is a subset of err)', () => {
    // Firmware gui E2 canh bao: err = E2 | E7, wrn = E2 -> E2 chi canh bao, E7 la loi khoa
    const res = parseErrors((1 << 1) | (1 << 6), 1 << 1);
    expect(res.activeErrors.map((e) => e.code)).toEqual(['E2', 'E7']);
    expect(res.activeErrors[0].isWarningOnly).toBe(true);
    expect(res.activeErrors[1].isWarningOnly).toBe(false);
    expect(res.hasWarningOnly).toBe(true);
    expect(res.hasLockedErrors).toBe(true);
  });

  it('identifies locked errors like E4 (heatsink overheat) and E6 (fan 1 stall)', () => {
    // E4 is bit 3 (1 << 3 = 8), E6 is bit 5 (1 << 5 = 32)
    const errMask = (1 << 3) | (1 << 5);
    const res = parseErrors(errMask, 0);
    expect(res.activeErrors.length).toBe(2);
    expect(res.hasLockedErrors).toBe(true);
    const codes = res.activeErrors.map((e) => e.code);
    expect(codes).toContain('E4');
    expect(codes).toContain('E6');
    expect(res.activeErrors.every((e) => e.isLocked)).toBe(true);
  });

  it('checks LOCKED_ERRORS_BITMASK matches specification (0x37E8)', () => {
    // Bits 3 (E4), 5 (E6), 6 (E7), 7 (E8), 8 (E9), 9 (E10), 10 (E11), 12 (E13), 13 (E14)
    const calculatedMask =
      (1 << 3) | (1 << 5) | (1 << 6) | (1 << 7) | (1 << 8) | (1 << 9) | (1 << 10) | (1 << 12) | (1 << 13);
    expect(calculatedMask).toBe(0x37e8);
    expect(LOCKED_ERRORS_BITMASK).toBe(0x37e8);
  });

  it('error table E1..E18 is consistent with the locked mask and has customer steps', () => {
    for (let n = 1; n <= ERROR_COUNT; n++) {
      const d = ERROR_DEFINITIONS[n];
      expect(d, `E${n}`).toBeDefined();
      expect(d.code).toBe(`E${n}`);
      expect(d.isLocked).toBe((LOCKED_ERRORS_BITMASK & (1 << (n - 1))) !== 0);
      expect(d.steps.length).toBeGreaterThan(0);
    }
  });

  it('parses new errors: E13 locked, E15 warning, E18 above 16 bits', () => {
    const e13 = 1 << 12, e15 = 1 << 14, e18 = 1 << 17;
    const res = parseErrors(e13 | e15 | e18, e15 | e18);
    expect(res.activeErrors.map((e) => e.code)).toEqual(['E13', 'E15', 'E18']);
    expect(res.hasLockedErrors).toBe(true);
    expect(res.activeErrors.find((e) => e.code === 'E13')?.isWarningOnly).toBe(false);
    expect(res.activeErrors.find((e) => e.code === 'E15')?.isWarningOnly).toBe(true);
    expect(res.activeErrors.find((e) => e.code === 'E18')?.isWarningOnly).toBe(true);
  });
});

describe('PacketFramingBuffer UTF-8 and streaming', () => {
  it('correctly handles multi-byte UTF-8 split across packet boundaries', () => {
    const buffer = new PacketFramingBuffer();
    // JSON line with Vietnamese characters: "Đang làm lạnh"
    const jsonStr = JSON.stringify({ t: 'ack', a: 'POWER', ok: true, msg: 'Đang làm lạnh bể cá' }) + '\n';
    const encoder = new TextEncoder();
    const bytes = encoder.encode(jsonStr);

    // Split right in the middle of multi-byte character
    const part1 = bytes.slice(0, 35);
    const part2 = bytes.slice(35);

    const pkts1 = buffer.push(part1);
    expect(pkts1.length).toBe(0); // Not complete yet

    const pkts2 = buffer.push(part2);
    expect(pkts2.length).toBe(1);
    expect(pkts2[0].t).toBe('ack');
    if (pkts2[0].t === 'ack') {
      expect(pkts2[0].msg).toBe('Đang làm lạnh bể cá');
    }
  });

  it('drops buffer if exceeds 8192 bytes without newline to self-resynchronize', () => {
    const buffer = new PacketFramingBuffer();
    const garbage = new Uint8Array(8200);
    garbage.fill(65); // 'A'
    const pkts = buffer.push(garbage);
    expect(pkts.length).toBe(0);
    expect(buffer.getRawBuffer()).toBe('');
  });
});

describe('applyPacket state reducer', () => {
  it('overwrites water temperature with null and does NOT retain old value', () => {
    // Initial state with valid temperature
    let state = applyPacket(INITIAL_APP_STATE, {
      t: 'st',
      w: 24.5,
      c: 20.0,
      h: 35.0,
      set: 22.0,
      pw: 1,
      fm: 0,
      st: 3,
      ph: 'COOLING',
      stg: 1,
      lim: 1,
      red: 0,
      p: [[1, 0, 1, 1, 4200], [0, 0, 1, 1, 0]],
      f: { pct: 60, max: 100, cur: 1, ma: 450, rpm: [2600, 2650], bad: [0, 0] },
      err: 0,
      wrn: 0,
      tst: { on: 0, left: 0, p1: 0, p2: 0, fan: 0 },
      wifi: { sta: 2, ip: '192.168.1.10', rssi: -60 },
      up: 100,
      heap: 120000,
      maxblk: 80000,
      sim: 0,
    });

    expect(state.status?.w).toBe(24.5);

    // New packet arrives with sensor error: w is null
    state = applyPacket(state, {
      t: 'st',
      w: null,
      c: 20.0,
      h: 35.0,
      set: 22.0,
      pw: 1,
      fm: 0,
      st: 5,
      ph: 'FAULT',
      stg: 0,
      lim: 0,
      red: 0,
      p: [[0, 0, 1, 1, 0], [0, 0, 1, 1, 0]],
      f: { pct: 0, max: 100, cur: 1, ma: 0, rpm: [0, 0], bad: [0, 0] },
      err: 1 << 0,
      wrn: 1 << 0,
      tst: { on: 0, left: 0, p1: 0, p2: 0, fan: 0 },
      wifi: { sta: 2, ip: '192.168.1.10', rssi: -60 },
      up: 101,
      heap: 120000,
      maxblk: 80000,
      sim: 0,
    });

    // Must be null, NOT the old 24.5!
    expect(state.status?.w).toBeNull();
  });
});
