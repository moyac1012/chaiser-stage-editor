/** 画面上の Blockly ワークスペースの作成・読み込み・保存 */
import * as Blockly from 'blockly';
import { ensureChaserBlocks } from './chaserBlocks';
import { CREATE_VARIABLE_CALLBACK, type Toolbox } from './toolbox';

export function mountWorkspace(host: HTMLElement, toolbox: Toolbox): Blockly.WorkspaceSvg {
  ensureChaserBlocks();
  const ws = Blockly.inject(host, {
    toolbox,
    media: `${import.meta.env.BASE_URL}blockly-media/`,
    trashcan: true,
    sounds: false,
    grid: { spacing: 20, length: 1, colour: '#dadfd9', snap: false },
    zoom: { controls: true, wheel: true, startScale: 0.8, maxScale: 2.5, minScale: 0.35, scaleSpeed: 1.15, pinch: true },
    move: { scrollbars: true, drag: true, wheel: false },
  });
  ws.registerButtonCallback(CREATE_VARIABLE_CALLBACK, () => Blockly.Variables.createVariableButtonHandler(ws));
  return ws;
}

/** XML を読み込む。読めない XML のときは false を返し、emptyXml（空のプログラム）にする */
export function loadProgram(ws: Blockly.WorkspaceSvg, xml: string, emptyXml: string): boolean {
  ws.clear();
  try {
    Blockly.Xml.domToWorkspace(Blockly.utils.xml.textToDom(xml.trim() ? xml : emptyXml), ws);
    return true;
  } catch {
    ws.clear();
    Blockly.Xml.domToWorkspace(Blockly.utils.xml.textToDom(emptyXml), ws);
    return false;
  }
}

/** プログラムが見えるように倍率と位置を合わせる。文字が読めないほどは縮めない。 */
export function fitProgram(ws: Blockly.WorkspaceSvg, minScale = 0.65, maxScale = 0.8): void {
  ws.zoomToFit();
  ws.setScale(Math.min(maxScale, Math.max(minScale, ws.scale)));
  // ブロックの左上が見える位置へ
  const content = ws.getMetricsManager().getContentMetrics();
  const PAD = 16;
  ws.scroll(-content.left + PAD, -content.top + PAD);
}

export function serializeProgram(ws: Blockly.WorkspaceSvg): string {
  return Blockly.Xml.domToText(Blockly.Xml.workspaceToDom(ws));
}

export function updateToolbox(ws: Blockly.WorkspaceSvg, toolbox: Toolbox): void {
  ws.updateToolbox(toolbox);
}

export function resizeWorkspace(ws: Blockly.WorkspaceSvg): void {
  Blockly.svgResize(ws);
}

/** ブロックの形が変わる変更だけを拾う（選択・スクロールなどは無視） */
export function onProgramChange(ws: Blockly.WorkspaceSvg, fn: () => void): void {
  ws.addChangeListener((e: Blockly.Events.Abstract) => {
    if (e.isUiEvent) return;
    fn();
  });
}
