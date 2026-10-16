/**
 * ブロックの一覧と日本語の呼び名。Blockly 本体を読み込まずに使えるよう分けてある
 * （ブロックセットの編集画面・レビュー用 HTML で使う）。
 */

export const COLOR_ACTION = '#E07B24';
export const COLOR_ON_TURN = '#3359C4';
export const COLOR_VIEW = '#2E8C82';
export const COLOR_STATE = '#3E8E4E';
export const COLOR_HOT = '#C9343F';
export const COLOR_HOT_VIEW = '#7C3AED';

export interface BlockCatalogGroup {
  name: string;
  color: string;
  types: string[];
}

/** ツールボックスに並べる順番。ブロックセットはこの中から選ぶ。 */
export const BLOCK_CATALOG: readonly BlockCatalogGroup[] = [
  { name: '行動', color: COLOR_ACTION, types: ['chaser_on_turn', 'chaser_action_walk', 'chaser_action_put', 'chaser_action_walk_last', 'chaser_action_walk_random', 'chaser_action_look', 'chaser_action_search', 'chaser_action_look_store', 'chaser_action_search_store', 'chaser_turn_end'] },
  { name: 'まわりを見る', color: COLOR_VIEW, types: ['chaser_get_tile', 'chaser_is_tile', 'chaser_get_around', 'chaser_view_get_around', 'chaser_view_has_tile', 'chaser_view_count_tile', 'chaser_discard_value', 'chaser_tile_value'] },
  { name: '変数', color: COLOR_STATE, types: ['chaser_state_create', 'chaser_state_set', 'chaser_state_get', 'chaser_state_change', 'chaser_turn_number', 'chaser_last_direction', 'chaser_direction_value'] },
  { name: '条件', color: '#5B6FA5', types: ['controls_if', 'logic_compare', 'logic_operation', 'logic_boolean', 'logic_negate'] },
  { name: '数', color: '#5B67A5', types: ['math_number', 'math_arithmetic', 'math_modulo', 'math_number_property', 'math_random_int', 'math_random_float'] },
];

export const ALL_BLOCK_TYPES: readonly string[] = BLOCK_CATALOG.flatMap((g) => g.types);

/** HOT の行動プログラムで使えるブロック（ブロックセットとは別で、いつも同じ） */
export const HOT_CATALOG: readonly BlockCatalogGroup[] = [
  { name: 'HOTの行動', color: COLOR_HOT, types: ['chaser_hot_on_turn', 'chaser_hot_walk', 'chaser_hot_walk_last', 'chaser_hot_walk_random', 'chaser_hot_put', 'chaser_hot_turn_end'] },
  { name: 'HOTから見る', color: COLOR_HOT_VIEW, types: ['chaser_hot_is_tile', 'chaser_hot_get_tile'] },
  { name: '条件', color: '#5B6FA5', types: ['controls_if', 'logic_compare', 'logic_operation', 'logic_boolean', 'logic_negate'] },
  { name: '数', color: '#5B67A5', types: ['math_number', 'math_arithmetic', 'math_modulo', 'math_random_int'] },
];

/** 旧エディタのブロックセット編集画面・レビューページと同じ呼び名 */
export const BLOCK_LABELS: Readonly<Record<string, string>> = {
  chaser_on_turn: '毎ターン',
  chaser_action_walk: '歩く',
  chaser_action_put: 'ブロックを置く',
  chaser_action_walk_last: '前に進んだ向きで歩く',
  chaser_action_walk_random: 'どこかに歩く',
  chaser_action_look: '見る',
  chaser_action_search: 'まっすぐ見る',
  chaser_action_look_store: '広く見た結果を変数に入れる',
  chaser_action_search_store: 'まっすぐ見た結果を変数に入れる',
  chaser_turn_end: 'ターンを終える',
  chaser_get_tile: '方向のマス',
  chaser_is_tile: '方向のマス判定',
  chaser_get_around: 'まわりの番号',
  chaser_view_get_around: '見た結果の番号',
  chaser_view_has_tile: '見た結果に指定マスがある',
  chaser_view_count_tile: '見た結果の指定マス数',
  chaser_discard_value: '結果を使わない',
  chaser_tile_value: 'マスの種類',
  chaser_state_create: '変数を作る',
  chaser_state_set: '変数に値を入れる',
  chaser_state_get: '変数を読む',
  chaser_state_change: '変数を増減',
  chaser_turn_number: '現在のターン数',
  chaser_last_direction: '前に進んだ向き',
  chaser_direction_value: '向き',
  controls_if: 'もし / そうでなければ',
  logic_compare: '比較',
  logic_operation: 'かつ / または',
  logic_boolean: '真 / 偽',
  logic_negate: 'ではない',
  math_number: '数',
  math_arithmetic: '四則演算',
  math_modulo: '余り',
  math_number_property: '数の性質',
  math_random_int: 'ランダムな整数',
  math_random_float: 'ランダムな小数',
  chaser_hot_on_turn: 'HOTの毎ターン',
  chaser_hot_turn_end: 'HOTのターンを終える',
  chaser_hot_walk: 'HOTが歩く',
  chaser_hot_walk_last: 'HOTが前に進んだ向きで歩く',
  chaser_hot_walk_random: 'HOTがどこかに歩く',
  chaser_hot_put: 'HOTがブロックを置く',
  chaser_hot_is_tile: 'HOTの方向のマス判定',
  chaser_hot_get_tile: 'HOTの方向のマス',
};

export function blockLabel(type: string): string {
  return BLOCK_LABELS[type] ?? type;
}
