/**
 * 元に戻す／やり直すの履歴。値そのものは触らず、並びだけを管理する純粋関数。
 * 同じ coalesceKey の連続した変更（1 回のドラッグ塗り、文字入力など）は 1 つにまとめる。
 */

export interface History<T> {
  past: T[];
  present: T;
  future: T[];
  /** 直前の変更のまとめ用キー */
  lastKey: string | null;
}

export const HISTORY_LIMIT = 100;

export function createHistory<T>(present: T): History<T> {
  return { past: [], present, future: [], lastKey: null };
}

export function pushHistory<T>(h: History<T>, next: T, coalesceKey: string | null = null): History<T> {
  if (next === h.present) return h;
  if (coalesceKey !== null && coalesceKey === h.lastKey) {
    return { ...h, present: next, future: [] };
  }
  const past = [...h.past, h.present].slice(-HISTORY_LIMIT);
  return { past, present: next, future: [], lastKey: coalesceKey };
}

export function undoHistory<T>(h: History<T>): History<T> {
  if (!h.past.length) return h;
  return { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future], lastKey: null };
}

export function redoHistory<T>(h: History<T>): History<T> {
  if (!h.future.length) return h;
  return { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1), lastKey: null };
}
