/**
 * 保存された Blockly XML を、字下げした日本語の文章にする（レビュー用 HTML に載せる）。
 * 旧エディタ stage_editor_next_hot_review_text.js の detailedHotProgram と同じ書き方にする。
 */
import * as Blockly from 'blockly';
import { blockLabel } from './catalog';

const DIRS: Record<string, string> = { Up: '↑ 上', Down: '↓ 下', Left: '← 左', Right: '→ 右' };
const TILES: Record<string, string> = { '0': '床', '1': 'キャラクター', '2': 'ブロック', '3': 'アイテム' };
const HOT_TILES: Record<string, string> = { ...TILES, '1': 'COOL' };
const COMPARE: Record<string, string> = { EQ: '＝', NEQ: '≠', LT: '＜', LTE: '≦', GT: '＞', GTE: '≧' };
const ARITHMETIC: Record<string, string> = { ADD: '＋', MINUS: '－', MULTIPLY: '×', DIVIDE: '÷', POWER: '^' };

function children(el: Element | null | undefined, tag: string): Element[] {
  return el ? Array.from(el.children).filter((n) => n.tagName.toLowerCase() === tag) : [];
}

function field(block: Element, name: string): string {
  return children(block, 'field').find((n) => n.getAttribute('name') === name)?.textContent ?? '';
}

function input(block: Element, name: string): Element | null {
  const slot = [...children(block, 'value'), ...children(block, 'statement')].find((n) => n.getAttribute('name') === name);
  return children(slot, 'block')[0] ?? null;
}

function next(block: Element): Element | null {
  return children(children(block, 'next')[0], 'block')[0] ?? null;
}

function dir(block: Element): string {
  const d = field(block, 'DIR');
  return DIRS[d] ?? (d || '指定した向き');
}

/** 変数は id で参照されることがあるので、<variables> から名前を引く */
function variableNamer(root: Element): (block: Element) => string {
  const names = new Map(children(children(root, 'variables')[0], 'variable').map((v) => [v.getAttribute('id') ?? '', v.textContent ?? '']));
  return (block) => {
    const f = children(block, 'field').find((n) => n.getAttribute('name') === 'VAR');
    return f?.textContent || names.get(f?.getAttribute('id') ?? '') || '変数';
  };
}

function describer(varName: (b: Element) => string) {
  function value(block: Element | null): string {
    if (!block) return '（値なし）';
    const type = block.getAttribute('type') ?? '';
    const tiles = type.startsWith('chaser_hot_') ? HOT_TILES : TILES;
    switch (type) {
      case 'chaser_hot_is_tile':
        return `HOTの${dir(block)}のマスが${tiles[field(block, 'TILE')] ?? '指定した種類'}`;
      case 'chaser_is_tile':
        return `${dir(block)}のマスが${tiles[field(block, 'TILE')] ?? '指定した種類'}`;
      case 'chaser_hot_get_tile':
        return `HOTの${dir(block)}のマスの種類`;
      case 'chaser_get_tile':
        return `${dir(block)}のマスの種類`;
      case 'chaser_tile_value':
        return tiles[field(block, 'TILE')] ?? 'マスの種類';
      case 'logic_boolean':
        return field(block, 'BOOL') === 'TRUE' ? '真' : '偽';
      case 'math_number':
        return field(block, 'NUM') || '0';
      case 'chaser_state_get':
      case 'variables_get':
        return `変数「${varName(block)}」`;
      case 'chaser_turn_number':
        return '現在のターン数';
      case 'chaser_last_direction':
        return '前に進んだ向き';
      case 'chaser_direction_value':
        return dir(block);
      case 'chaser_action_look':
        return `${dir(block)}を見た結果`;
      case 'chaser_action_search':
        return `${dir(block)}をまっすぐ見た結果`;
      case 'chaser_get_around':
        return `まわりの ${value(input(block, 'INDEX'))} 番`;
      case 'logic_compare':
        return `${value(input(block, 'A'))} ${COMPARE[field(block, 'OP')] ?? '＝'} ${value(input(block, 'B'))}`;
      case 'logic_operation':
        return `(${value(input(block, 'A'))} ${field(block, 'OP') === 'AND' ? 'かつ' : 'または'} ${value(input(block, 'B'))})`;
      case 'logic_negate':
        return `（${value(input(block, 'BOOL'))}）ではない`;
      case 'math_modulo':
        return `(${value(input(block, 'DIVIDEND'))} を ${value(input(block, 'DIVISOR'))} で割った余り)`;
      case 'math_arithmetic':
        return `(${value(input(block, 'A'))} ${ARITHMETIC[field(block, 'OP')] ?? '＋'} ${value(input(block, 'B'))})`;
      case 'math_random_int':
        return `${value(input(block, 'FROM'))} から ${value(input(block, 'TO'))} までのランダムな整数`;
      case 'math_random_float':
        return '0以上1未満のランダムな小数';
    }
    const fields = children(block, 'field').map((n) => n.textContent).filter(Boolean);
    return fields.length ? `${blockLabel(type)}（${fields.join('，')}）` : blockLabel(type);
  }

  function statements(first: Element | null, depth: number): string[] {
    const lines: string[] = [];
    for (let b = first; b; b = next(b)) lines.push(...statement(b, depth));
    return lines;
  }

  function statement(block: Element, depth: number): string[] {
    const indent = '\t'.repeat(depth);
    const type = block.getAttribute('type') ?? '';
    switch (type) {
      case 'chaser_on_turn':
      case 'chaser_hot_on_turn':
        return [`${indent}${blockLabel(type)}`, ...statements(input(block, 'DO'), depth + 1)];
      case 'controls_if': {
        const lines: string[] = [];
        for (let i = 0; input(block, `IF${i}`) || input(block, `DO${i}`); i++) {
          lines.push(`${indent}${i === 0 ? 'もし' : 'そうでなくもし'} ${value(input(block, `IF${i}`))}`);
          lines.push(...statements(input(block, `DO${i}`), depth + 1));
        }
        const otherwise = input(block, 'ELSE');
        if (otherwise) lines.push(`${indent}そうでなければ`, ...statements(otherwise, depth + 1));
        return lines;
      }
      case 'chaser_action_walk':
      case 'chaser_action_put':
      case 'chaser_hot_walk':
      case 'chaser_hot_put':
        return [`${indent}${blockLabel(type)}：${dir(block)}`];
      case 'chaser_action_walk_last':
      case 'chaser_hot_walk_last':
        return [`${indent}${blockLabel(type)}（最初は：${dir(block)}）`];
      case 'chaser_action_look_store':
        return [`${indent}${dir(block)}を広く見た結果を 変数「${varName(block)}」に入れる`];
      case 'chaser_action_search_store':
        return [`${indent}${dir(block)}をまっすぐ見た結果を 変数「${varName(block)}」に入れる`];
      case 'chaser_state_set':
      case 'variables_set':
        return [`${indent}変数「${varName(block)}」に ${value(input(block, 'VALUE'))} を入れる`];
      case 'chaser_state_change':
      case 'math_change':
        return [`${indent}変数「${varName(block)}」を ${value(input(block, 'DELTA'))} だけ増減する`];
      case 'chaser_state_create':
        return [`${indent}変数「${varName(block)}」を作る`];
      case 'chaser_discard_value':
        return [`${indent}${value(input(block, 'VALUE'))}（結果は使わない）`];
    }
    return [`${indent}${value(block)}`];
  }

  return statements;
}

/** プログラムを文章にする。毎ターンのブロックがあればそれだけ、なければ置かれているブロックを全部 */
export function describeProgram(xml: string): string {
  if (!xml.trim()) return '（プログラムは未設定です）';
  let root: Element;
  try {
    root = Blockly.utils.xml.textToDom(xml);
  } catch {
    return '（プログラムを読み取れませんでした）';
  }
  const tops = children(root, 'block');
  if (!tops.length) return '（プログラムは未設定です）';
  const statements = describer(variableNamer(root));
  const main = tops.filter((b) => /^chaser(_hot)?_on_turn$/.test(b.getAttribute('type') ?? ''));
  return (main.length ? main : tops).flatMap((b) => statements(b, 0)).join('\n');
}
