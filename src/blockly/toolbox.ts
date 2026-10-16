/** ブロックセット（使えるブロックの一覧）からツールボックスの定義を作る */
import { BLOCK_CATALOG, HOT_CATALOG } from './catalog';

export const CREATE_VARIABLE_CALLBACK = 'CREATE_VAR';

interface ToolboxItem {
  kind: string;
  [key: string]: unknown;
}

function usesVariables(allowed: ReadonlySet<string>): boolean {
  return [...allowed].some((t) => t.startsWith('chaser_state_') || t.endsWith('_store'));
}

export interface Toolbox {
  kind: 'categoryToolbox';
  contents: ToolboxItem[];
}

export function buildToolbox(allowedTypes: readonly string[]): Toolbox {
  const allowed = new Set(allowedTypes);
  const contents: ToolboxItem[] = [];
  for (const group of BLOCK_CATALOG) {
    const blocks: ToolboxItem[] = group.types.filter((t) => allowed.has(t)).map((type) => ({ kind: 'block', type }));
    if (!blocks.length) continue;
    if (group.name === '変数' && usesVariables(allowed)) {
      blocks.unshift({ kind: 'button', text: '変数を作る', callbackkey: CREATE_VARIABLE_CALLBACK });
    }
    contents.push({ kind: 'category', name: group.name, colour: group.color, contents: blocks });
  }
  return { kind: 'categoryToolbox', contents };
}

/** HOT の行動プログラム用（ブロックセットによらず同じ） */
export function buildHotToolbox(): Toolbox {
  return {
    kind: 'categoryToolbox',
    contents: HOT_CATALOG.map((g) => ({ kind: 'category', name: g.name, colour: g.color, contents: g.types.map((type) => ({ kind: 'block', type })) })),
  };
}

/** ツールボックスの左に出す説明用：使えるカテゴリ名 */
export function allowedCategoryNames(allowedTypes: readonly string[]): string[] {
  const allowed = new Set(allowedTypes);
  return BLOCK_CATALOG.filter((g) => g.types.some((t) => allowed.has(t))).map((g) => g.name);
}
