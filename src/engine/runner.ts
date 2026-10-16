/**
 * Blockly から作ったプログラムを盤面で動かす。
 * プログラムは毎ターン onTurn(api) を呼ばれ、api の行動関数を呼ぶと
 * その手の行動が決まる（最後に呼んだものが有効）。
 */
import type { Direction } from '../domain/types';
import { applyAction, around, failWithError, search, type Action, type GameState } from './game';

export interface BotApi {
  around: number[];
  [method: string]: unknown;
}

export interface BotProgram {
  onTurn(api: BotApi): void;
}

const DIRECTIONS: Direction[] = ['Up', 'Down', 'Left', 'Right'];

function createApi(state: GameState, choose: (a: Action) => void): BotApi {
  const api: BotApi = { around: around(state) };
  for (const dir of DIRECTIONS) {
    api[`walk${dir}`] = () => choose({ kind: 'walk', dir });
    api[`put${dir}`] = () => choose({ kind: 'put', dir });
    api[`look${dir}`] = () => {
      choose({ kind: 'look', dir });
      return around(state);
    };
    api[`search${dir}`] = () => {
      choose({ kind: 'search', dir });
      return search(state, dir);
    };
  }
  return api;
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** 1 手だけ動かす */
export function runTurn(state: GameState, program: BotProgram): GameState {
  if (state.status !== 'running') return state;
  let action: Action | null = null;
  try {
    program.onTurn(createApi(state, (a) => (action = a)));
  } catch (e) {
    return failWithError(state, errorMessage(e));
  }
  return applyAction(state, action);
}

export const DEFAULT_TURN_LIMIT = 200;

/**
 * 終わるまで動かし、0 手目を含む全ての手の状態を返す。
 * 終わらないプログラムは turnLimit 手で打ち切って失敗にする。
 */
export function runToEnd(start: GameState, program: BotProgram, turnLimit = DEFAULT_TURN_LIMIT): GameState[] {
  const history = [start];
  let s = start;
  while (s.status === 'running' && s.turn < turnLimit) {
    s = runTurn(s, program);
    history.push(s);
  }
  if (s.status === 'running') {
    history[history.length - 1] = { ...s, status: 'failed', message: `${turnLimit}手たってもクリアも失敗もしませんでした` };
  }
  return history;
}
