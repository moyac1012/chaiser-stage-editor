/** ブロックセット（使えるブロックの一覧）からツールボックスの定義を作る */
import { BLOCK_CATALOG } from './chaserBlocks';

export const CREATE_VARIABLE_CALLBACK = 'CREATE_VAR';

interface ToolboxItem {
  kind: string;
  [key: string]: unknown;
}

function usesVariables(allowed: ReadonlySet<string>): boolean {
  return [...allowed].some((t) => t.startsWith('chaser_state_') || t.endsWith('_store'));
}

export function buildToolbox(allowedTypes: readonly string[]): { kind: 'categoryToolbox'; contents: ToolboxItem[] } {
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

/** ツールボックスの左に出す説明用：使えるカテゴリ名 */
export function allowedCategoryNames(allowedTypes: readonly string[]): string[] {
  const allowed = new Set(allowedTypes);
  return BLOCK_CATALOG.filter((g) => g.types.some((t) => allowed.has(t))).map((g) => g.name);
}
