/**
 * 保存された Blockly XML から、盤面で動かせるプログラムを作る。
 * 画面上のワークスペースとは独立した見えないワークスペースで変換するので、
 * 書き出し前の一括チェックやテストでも同じ関数を使える。
 */
import * as Blockly from 'blockly';
import { javascriptGenerator } from 'blockly/javascript';
import type { BotProgram } from '../engine/runner';
import { ensureChaserBlocks } from './chaserBlocks';

export class ProgramError extends Error {}

/** XML → JavaScript のソース */
export function generateCode(xml: string): { code: string; variables: string[] } {
  ensureChaserBlocks();
  const ws = new Blockly.Workspace();
  try {
    if (xml.trim()) Blockly.Xml.domToWorkspace(Blockly.utils.xml.textToDom(xml), ws);
    javascriptGenerator.init(ws);
    javascriptGenerator.nameDB_?.setVariableMap(ws.getVariableMap());
    const code = javascriptGenerator.workspaceToCode(ws);
    const variables = ws.getVariableMap().getAllVariables().map((v) => javascriptGenerator.getVariableName(v.getId()));
    return { code, variables };
  } catch (e) {
    throw new ProgramError(`プログラムを読み込めません：${e instanceof Error ? e.message : String(e)}`);
  } finally {
    ws.dispose();
  }
}

/** 実行するたびに変数が 0 から始まるよう、毎回新しく作る */
export function compileProgram(xml: string): BotProgram {
  const { code, variables } = generateCode(xml);
  if (!code.includes('function onTurn')) throw new ProgramError('「毎ターン やること」ブロックがありません');
  const defs = variables.map((name) => `var ${name}=0;`).join('');
  const factory = new Function(`var __chaserLastAction=null;var __chaserTurn=0;${defs}\n${code}\nreturn {onTurn:onTurn};`);
  return factory() as BotProgram;
}
