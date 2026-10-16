/**
 * HOT の行動プログラムと「HOT との対戦」条件のデータ。
 * 旧エディタ stage_editor_next_hot_state_fix.js / hot_competition.js と同じ解釈にする。
 */
import type { HotBehavior, HotCompetition } from './types';

export const EMPTY_HOT_PROGRAM_XML =
  '<xml xmlns="https://developers.google.com/blockly/xml"><block type="chaser_hot_on_turn" x="24" y="24"><statement name="DO"><block type="chaser_hot_turn_end"></block></statement></block></xml>';

export const DEFAULT_COMPETITION_TURNS = 10;

type Raw = Record<string, unknown>;

function asObject(value: unknown): Raw {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Raw) : {};
}

/** hotEnabled（旧エディタが優先して読む値）と hotBehavior.enabled をそろえる */
export function normalizeHotBehavior(stage: Raw): HotBehavior {
  const raw = asObject(stage.hotBehavior);
  const enabled = typeof stage.hotEnabled === 'boolean' ? stage.hotEnabled : Boolean(raw.enabled);
  const xml = typeof raw.savedBlocklyXml === 'string' && raw.savedBlocklyXml.trim() ? raw.savedBlocklyXml : EMPTY_HOT_PROGRAM_XML;
  return { ...raw, enabled, savedBlocklyXml: xml };
}

export function competitionTurns(value: unknown): number {
  const n = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) && n >= 1 ? n : DEFAULT_COMPETITION_TURNS;
}

/** 有効な対戦条件のときだけ返す */
export function normalizeHotCompetition(raw: unknown): HotCompetition | null {
  const c = asObject(raw);
  if (!c.enabled) return null;
  return { ...c, enabled: true, turns: competitionTurns(c.turns) };
}

/** 旧エディタが stage.cond に入れる表記 */
export function competitionText(turns: number): string {
  return `HOTを倒す または ${turns}ターン後にアイテム数でHOTを上回る`;
}
