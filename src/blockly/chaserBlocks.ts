/**
 * CHaser 用ブロックの定義と、JavaScript への変換規則。
 * 旧エディタ（stage_editor_next_runtime.js / variable_runtime_fix.js）のブロック type と
 * フィールド名をそのまま使うので、保存済みの Blockly XML を読み込める。
 */
import * as Blockly from 'blockly';
import { javascriptGenerator, Order } from 'blockly/javascript';
import * as Ja from 'blockly/msg/ja';
import { COLOR_ACTION, COLOR_HOT, COLOR_HOT_VIEW, COLOR_ON_TURN, COLOR_STATE, COLOR_VIEW } from './catalog';

const DIRS = [['→ 右', 'Right'], ['← 左', 'Left'], ['↑ 上', 'Up'], ['↓ 下', 'Down']];
const DIRS_UDLR = [['↑ 上', 'Up'], ['↓ 下', 'Down'], ['← 左', 'Left'], ['→ 右', 'Right']];
const TILE_OPTIONS = [['床 (0)', '0'], ['プレイヤー (1)', '1'], ['ブロック (2)', '2'], ['アイテム (3)', '3']];
const HOT_TILE_OPTIONS = [['床 (0)', '0'], ['COOL (1)', '1'], ['ブロック (2)', '2'], ['アイテム (3)', '3']];
const AROUND_INDEX: Record<string, number> = { Up: 1, Down: 7, Left: 3, Right: 5 };

const BLOCK_JSON = [
  { type: 'chaser_on_turn', message0: '毎ターン', message1: 'やること %1', args1: [{ type: 'input_statement', name: 'DO' }], colour: COLOR_ON_TURN, hat: 'cap' },
  { type: 'chaser_turn_end', message0: 'ターンを終える', previousStatement: null, colour: COLOR_ON_TURN },
  { type: 'chaser_state_create', message0: '変数を作る %1', args0: [{ type: 'field_variable', name: 'VAR', variable: 'x' }], previousStatement: null, nextStatement: null, colour: COLOR_STATE },
  { type: 'chaser_state_set', message0: '変数 %1 に %2 を入れる', args0: [{ type: 'field_variable', name: 'VAR', variable: 'x' }, { type: 'input_value', name: 'VALUE' }], previousStatement: null, nextStatement: null, colour: COLOR_STATE },
  { type: 'chaser_state_get', message0: '変数 %1', args0: [{ type: 'field_variable', name: 'VAR', variable: 'x' }], output: null, colour: COLOR_STATE },
  { type: 'chaser_state_change', message0: '変数 %1 を %2 だけ増減', args0: [{ type: 'field_variable', name: 'VAR', variable: 'x' }, { type: 'input_value', name: 'DELTA', check: 'Number' }], previousStatement: null, nextStatement: null, colour: COLOR_STATE },
  { type: 'chaser_turn_number', message0: '現在のターン数', output: 'Number', colour: COLOR_STATE },
  { type: 'chaser_last_direction', message0: '前に進んだ向き', output: 'Direction', colour: COLOR_STATE },
  { type: 'chaser_direction_value', message0: '向き %1', args0: [{ type: 'field_dropdown', name: 'DIR', options: DIRS }], output: 'Direction', colour: COLOR_STATE },
  { type: 'chaser_action_walk_last', message0: '前に進んだ向きで歩く（最初は %1）', args0: [{ type: 'field_dropdown', name: 'DIR', options: DIRS }], previousStatement: null, nextStatement: null, colour: COLOR_ACTION },
  { type: 'chaser_action_walk_random', message0: 'どこかに歩く', previousStatement: null, nextStatement: null, colour: COLOR_ACTION },
  { type: 'chaser_action_walk', message0: '歩く %1', args0: [{ type: 'field_dropdown', name: 'DIR', options: DIRS_UDLR }], previousStatement: null, nextStatement: null, colour: COLOR_ACTION },
  { type: 'chaser_action_put', message0: 'ブロックを置く %1', args0: [{ type: 'field_dropdown', name: 'DIR', options: DIRS_UDLR }], previousStatement: null, nextStatement: null, colour: COLOR_ACTION },
  { type: 'chaser_action_look', message0: '見る %1', args0: [{ type: 'field_dropdown', name: 'DIR', options: DIRS_UDLR }], output: 'Array', colour: COLOR_ACTION },
  { type: 'chaser_action_search', message0: 'まっすぐ見る %1', args0: [{ type: 'field_dropdown', name: 'DIR', options: DIRS_UDLR }], output: 'Array', colour: COLOR_ACTION },
  { type: 'chaser_action_look_store', message0: '広く %1 を見た結果を %2 に入れる', args0: [{ type: 'field_dropdown', name: 'DIR', options: DIRS }, { type: 'field_variable', name: 'VAR', variable: 'x' }], previousStatement: null, nextStatement: null, colour: COLOR_ACTION },
  { type: 'chaser_action_search_store', message0: 'まっすぐ %1 を見た結果を %2 に入れる', args0: [{ type: 'field_dropdown', name: 'DIR', options: DIRS }, { type: 'field_variable', name: 'VAR', variable: 'x' }], previousStatement: null, nextStatement: null, colour: COLOR_ACTION },
  { type: 'chaser_get_tile', message0: '方向 %1 のマス', args0: [{ type: 'field_dropdown', name: 'DIR', options: DIRS }], output: 'Number', colour: COLOR_VIEW },
  { type: 'chaser_is_tile', message0: '方向 %1 のマスは %2 ?', args0: [{ type: 'field_dropdown', name: 'DIR', options: DIRS }, { type: 'field_dropdown', name: 'TILE', options: TILE_OPTIONS }], output: 'Boolean', colour: COLOR_VIEW },
  { type: 'chaser_get_around', message0: 'まわりの %1 番', args0: [{ type: 'input_value', name: 'INDEX', check: 'Number' }], output: 'Number', colour: COLOR_VIEW },
  { type: 'chaser_view_get_around', message0: '見た結果 %1 の %2 番', args0: [{ type: 'input_value', name: 'VIEW' }, { type: 'input_value', name: 'INDEX', check: 'Number' }], output: 'Number', colour: COLOR_VIEW },
  { type: 'chaser_view_has_tile', message0: '見た結果 %1 に %2 がある', args0: [{ type: 'input_value', name: 'VIEW' }, { type: 'field_dropdown', name: 'TILE', options: TILE_OPTIONS }], output: 'Boolean', colour: COLOR_VIEW },
  { type: 'chaser_view_count_tile', message0: '見た結果 %1 の %2 の数', args0: [{ type: 'input_value', name: 'VIEW' }, { type: 'field_dropdown', name: 'TILE', options: TILE_OPTIONS }], output: 'Number', colour: COLOR_VIEW },
  { type: 'chaser_discard_value', message0: '結果を使わない %1', args0: [{ type: 'input_value', name: 'VALUE' }], previousStatement: null, nextStatement: null, colour: COLOR_VIEW },
  { type: 'chaser_tile_value', message0: 'マスの種類 %1', args0: [{ type: 'field_dropdown', name: 'TILE', options: TILE_OPTIONS }], output: 'Number', colour: COLOR_VIEW },
  // HOT の行動プログラム用（旧エディタ stage_editor_next_hot_blockly_v3.js と同じ type・フィールド名）
  { type: 'chaser_hot_on_turn', message0: 'HOTの毎ターン', message1: 'やること %1', args1: [{ type: 'input_statement', name: 'DO' }], colour: COLOR_HOT, hat: 'cap' },
  { type: 'chaser_hot_turn_end', message0: 'HOTのターンを終える', previousStatement: null, colour: COLOR_HOT },
  { type: 'chaser_hot_walk', message0: 'HOTが歩く %1', args0: [{ type: 'field_dropdown', name: 'DIR', options: DIRS_UDLR }], previousStatement: null, nextStatement: null, colour: COLOR_HOT },
  { type: 'chaser_hot_walk_last', message0: 'HOTが前に進んだ向きで歩く（最初は %1）', args0: [{ type: 'field_dropdown', name: 'DIR', options: DIRS_UDLR }], previousStatement: null, nextStatement: null, colour: COLOR_HOT },
  { type: 'chaser_hot_walk_random', message0: 'HOTがどこかに歩く', previousStatement: null, nextStatement: null, colour: COLOR_HOT },
  { type: 'chaser_hot_put', message0: 'HOTがブロックを置く %1', args0: [{ type: 'field_dropdown', name: 'DIR', options: DIRS_UDLR }], previousStatement: null, nextStatement: null, colour: COLOR_HOT },
  { type: 'chaser_hot_is_tile', message0: 'HOTの %1 のマスは %2 ?', args0: [{ type: 'field_dropdown', name: 'DIR', options: DIRS }, { type: 'field_dropdown', name: 'TILE', options: HOT_TILE_OPTIONS }], output: 'Boolean', colour: COLOR_HOT_VIEW },
  { type: 'chaser_hot_get_tile', message0: 'HOTの %1 のマス', args0: [{ type: 'field_dropdown', name: 'DIR', options: DIRS }], output: 'Number', colour: COLOR_HOT_VIEW },
];

/** 生成コード内で使う予約名 */
export const TURN_ENDED = '__chaserTurnEnded';
const HOT_TURN_ENDED = '__hotTurnEnded';
const TURN = '__chaserTurn';
const LAST = '__chaserLastAction';

type Gen = typeof javascriptGenerator;
type B = Blockly.Block;

function varName(g: Gen, block: B, field = 'VAR'): string {
  return g.getVariableName(block.getFieldValue(field));
}

function value(g: Gen, block: B, input: string, fallback = '0'): string {
  return g.valueToCode(block, input, Order.NONE) || fallback;
}

function dirOf(block: B, fallback = 'Right'): string {
  return String(block.getFieldValue('DIR') || fallback);
}

function tileOf(block: B): string {
  return String(Number(block.getFieldValue('TILE')) || 0);
}

function registerGenerators(g: Gen): void {
  const f = g.forBlock;
  f.chaser_on_turn = (b) =>
    `function onTurn(api){${TURN}+=1;var ${TURN_ENDED}=false;\n${g.statementToCode(b, 'DO')}if(!${TURN_ENDED}){throw new Error('「ターンを終える」ブロックまで届きませんでした');}}\n`;
  f.chaser_turn_end = () => `${TURN_ENDED}=true;return;\n`;
  f.chaser_state_create = () => '';
  f.chaser_state_set = (b) => `${varName(g, b)}=(${value(g, b, 'VALUE')});\n`;
  f.chaser_state_get = (b) => [varName(g, b), Order.ATOMIC];
  f.chaser_state_change = (b) => `${varName(g, b)}=(${varName(g, b)}||0)+(${value(g, b, 'DELTA')});\n`;
  f.chaser_turn_number = () => [TURN, Order.ATOMIC];
  f.chaser_last_direction = () => [`((${LAST}&&${LAST}.dir)||'Up')`, Order.ATOMIC];
  f.chaser_direction_value = (b) => [`'${dirOf(b, 'Up')}'`, Order.ATOMIC];
  f.chaser_action_walk_last = (b) =>
    `(function(){var d=(${LAST}&&${LAST}.dir)||'${dirOf(b, 'Up')}';${LAST}={kind:'walk',dir:d};api['walk'+d]();})();\n`;
  f.chaser_action_walk_random = () =>
    `(function(){var ds=['Up','Down','Left','Right'];var ix={Up:1,Down:7,Left:3,Right:5};var ok=ds.filter(function(d){return api.around[ix[d]]!==2;});var pool=ok.length?ok:ds;var d=pool[Math.floor(Math.random()*pool.length)];${LAST}={kind:'walk',dir:d};api['walk'+d]();})();\n`;
  for (const method of ['walk', 'put']) {
    f[`chaser_action_${method}`] = (b) => `${LAST}={kind:'${method}',dir:'${dirOf(b)}'};api.${method}${dirOf(b)}();\n`;
  }
  for (const method of ['look', 'search']) {
    f[`chaser_action_${method}`] = (b) => [`(function(){${LAST}={kind:'${method}',dir:'${dirOf(b)}'};return api.${method}${dirOf(b)}();})()`, Order.FUNCTION_CALL];
    f[`chaser_action_${method}_store`] = (b) => `${varName(g, b)}=api.${method}${dirOf(b)}();\n`;
  }
  f.chaser_get_tile = (b) => [`api.around[${AROUND_INDEX[dirOf(b)] ?? 5}]`, Order.MEMBER];
  f.chaser_is_tile = (b) => [`(api.around[${AROUND_INDEX[dirOf(b)] ?? 5}]===${tileOf(b)})`, Order.ATOMIC];
  f.chaser_get_around = (b) => [`api.around[${value(g, b, 'INDEX')}]`, Order.MEMBER];
  f.chaser_view_get_around = (b) => [`(${value(g, b, 'VIEW', '[]')})[${value(g, b, 'INDEX')}]`, Order.MEMBER];
  f.chaser_view_has_tile = (b) => [`(${value(g, b, 'VIEW', '[]')}).includes(${tileOf(b)})`, Order.FUNCTION_CALL];
  f.chaser_view_count_tile = (b) => [`(${value(g, b, 'VIEW', '[]')}).filter(function(v){return v===${tileOf(b)};}).length`, Order.MEMBER];
  f.chaser_discard_value = (b) => `${value(g, b, 'VALUE', 'undefined')};\n`;
  f.chaser_tile_value = (b) => [tileOf(b), Order.ATOMIC];
  f.chaser_hot_on_turn = (b) =>
    `function onHotTurn(api){var ${HOT_TURN_ENDED}=false;\n${g.statementToCode(b, 'DO')}if(!${HOT_TURN_ENDED}){throw new Error('「HOTのターンを終える」ブロックまで届きませんでした');}}\n`;
  f.chaser_hot_turn_end = () => `${HOT_TURN_ENDED}=true;return;\n`;
  f.chaser_hot_walk = (b) => `api.walk${dirOf(b)}();\n`;
  f.chaser_hot_put = (b) => `api.put${dirOf(b)}();\n`;
  f.chaser_hot_walk_last = (b) => `api.walkLast('${dirOf(b, 'Up')}');\n`;
  f.chaser_hot_walk_random = () =>
    `(function(){var ds=['Up','Down','Left','Right'];var ix={Up:1,Down:7,Left:3,Right:5};var ok=ds.filter(function(d){return api.around[ix[d]]!==2;});var pool=ok.length?ok:ds;api['walk'+pool[Math.floor(Math.random()*pool.length)]]();})();\n`;
  f.chaser_hot_is_tile = (b) => [`(api.around[${AROUND_INDEX[dirOf(b)] ?? 5}]===${tileOf(b)})`, Order.ATOMIC];
  f.chaser_hot_get_tile = (b) => [`api.around[${AROUND_INDEX[dirOf(b)] ?? 5}]`, Order.MEMBER];
  // 旧版で変数ブロックを使って保存したプログラム向け
  f.variables_get = (b) => [varName(g, b), Order.ATOMIC];
  f.variables_set = (b) => `${varName(g, b)}=(${value(g, b, 'VALUE')});\n`;
  f.math_change = (b) => `${varName(g, b)}=(${varName(g, b)}||0)+(${value(g, b, 'DELTA')});\n`;
}

let ready = false;

/** ブロック定義・生成規則・日本語メッセージを 1 回だけ登録する */
export function ensureChaserBlocks(): void {
  if (ready) return;
  ready = true;
  Blockly.setLocale(Ja as unknown as Record<string, string>);
  Blockly.defineBlocksWithJsonArray(BLOCK_JSON);
  registerGenerators(javascriptGenerator);
}

export const EMPTY_PROGRAM_XML =
  '<xml xmlns="https://developers.google.com/blockly/xml"><block type="chaser_on_turn" x="40" y="40"><statement name="DO"><block type="chaser_turn_end"></block></statement></block></xml>';
