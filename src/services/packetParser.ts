/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AnyPacket, ChillerConfig, ChillerStatus, PacketAck } from '../types/system';
import { HISTORY_MAX, HistoryEvent, fromTuple, prependEvents } from './history';

export interface AppState {
  status: ChillerStatus | null;
  config: ChillerConfig | null;
  lastAck: PacketAck | null;
  wifiList: [string, number, number][];
  wifiScanError: string | null;
  history: HistoryEvent[]; // Nhat ky, MOI NHAT truoc, toi da historyMax (= so may luu)
  historyMax: number;
  historyLoading: boolean; // Dang nhan cac trang 'hi'
}

export const INITIAL_APP_STATE: AppState = {
  status: null,
  config: null,
  lastAck: null,
  wifiList: [],
  wifiScanError: null,
  history: [],
  historyMax: HISTORY_MAX,
  historyLoading: false,
};

/**
 * Pure state reducer for applying received packets to app state.
 * Absolutely pure with zero side-effects.
 */
export function applyPacket(prev: AppState, pkt: AnyPacket): AppState {
  switch (pkt.t) {
    case 'st': {
      // Overwrite status completely. Crucial: if w/c/h is null, do NOT keep old values!
      const { t: _type, ...statusFields } = pkt;
      return {
        ...prev,
        status: statusFields as ChillerStatus,
      };
    }
    case 'cf': {
      // Merge config with any existing config
      const { t: _type, ...configFields } = pkt;
      return {
        ...prev,
        config: {
          ...(prev.config || ({} as ChillerConfig)),
          ...(configFields as ChillerConfig),
        },
      };
    }
    case 'ack': {
      return {
        ...prev,
        lastAck: pkt,
      };
    }
    case 'hi': {
      // Nhieu trang, moi nhat truoc. Trang dau (clr) thay ca danh sach.
      const max = Math.min(pkt.max || HISTORY_MAX, 500);
      const page = (Array.isArray(pkt.e) ? pkt.e : []).map(fromTuple);
      const list = (pkt.clr ? page : [...prev.history, ...page]).slice(0, max);
      return { ...prev, history: list, historyMax: max, historyLoading: !pkt.end };
    }
    case 'ev': {
      // Su kien moi phat sinh, may gui cu -> moi
      const fresh = (Array.isArray(pkt.e) ? pkt.e : []).map(fromTuple);
      return { ...prev, history: prependEvents(prev.history, fresh, prev.historyMax) };
    }
    case 'wl': {
      return {
        ...prev,
        wifiList: Array.isArray(pkt.n) ? pkt.n : [],
        wifiScanError: pkt.err || null,
      };
    }
    default:
      return prev;
  }
}

/**
 * Handles incoming Bluetooth chunked streams.
 * Uses TextDecoder with { stream: true } so UTF-8 characters split across packet boundaries are correctly decoded.
 * Splits incoming stream by '\n'. Drops buffer if it exceeds 8192 bytes without a newline.
 */
export class PacketFramingBuffer {
  private decoder: TextDecoder;
  private buffer: string = '';
  private readonly maxBufferSize = 8192; // 8 KB safety threshold

  constructor() {
    this.decoder = new TextDecoder('utf-8');
  }

  /**
   * Push raw bytes (Uint8Array or ArrayBufferView), decode and return any complete parsed JSON packets.
   */
  public push(chunk: ArrayBufferView | ArrayBuffer): AnyPacket[] {
    const textChunk = this.decoder.decode(chunk, { stream: true });
    this.buffer += textChunk;

    // Safety guard: if buffer exceeds 8 KB without finding \n, discard to self-resync
    if (this.buffer.length > this.maxBufferSize) {
      console.warn('PacketFramingBuffer overflow (>8KB without newline). Discarding corrupted buffer.');
      this.buffer = '';
      return [];
    }

    const packets: AnyPacket[] = [];
    let newlineIndex = this.buffer.indexOf('\n');

    while (newlineIndex !== -1) {
      const line = this.buffer.slice(0, newlineIndex).trim();
      this.buffer = this.buffer.slice(newlineIndex + 1);

      if (line.length > 0) {
        try {
          const parsed = JSON.parse(line) as AnyPacket;
          if (parsed && typeof parsed === 'object' && 't' in parsed) {
            packets.push(parsed);
          }
        } catch (err) {
          console.warn('Failed to parse JSON packet line:', line, err);
        }
      }

      newlineIndex = this.buffer.indexOf('\n');
    }

    return packets;
  }

  /**
   * Reset buffer state (e.g. on disconnect)
   */
  public reset(): void {
    this.buffer = '';
    this.decoder = new TextDecoder('utf-8');
  }

  public getRawBuffer(): string {
    return this.buffer;
  }
}
