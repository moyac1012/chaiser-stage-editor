/**
 * Blockly のプログラム（模範解答・HOT の行動）。
 * ステージか表示するプログラムが変わるたびに作り直す。
 */
import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import type { WorkspaceSvg } from 'blockly';
import type { Toolbox } from '../blockly/toolbox';
import { fitProgram, loadProgram, mountWorkspace, onProgramChange, resizeWorkspace, serializeProgram, updateToolbox } from '../blockly/workspace';

interface ProgramPanelProps {
  /** ステージと表示するプログラムを識別するキー。変わるとワークスペースを作り直す */
  stageKey: string;
  xml: string;
  /** XML が空・読めないときに置くプログラム */
  emptyXml: string;
  toolbox: Toolbox;
  /** ツールボックスの中身が変わったかを見分けるキー */
  toolboxKey: string;
  head: ComponentChildren;
  label: string;
  onChange: (xml: string) => void;
}

const SAVE_DELAY_MS = 250;

export function ProgramPanel({ stageKey, xml, emptyXml, toolbox, toolboxKey, head, label, onChange }: ProgramPanelProps) {
  const host = useRef<HTMLDivElement>(null);
  const ws = useRef<WorkspaceSvg | null>(null);
  const lastXml = useRef(xml);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // 作成と破棄
  useEffect(() => {
    if (!host.current) return;
    const workspace = mountWorkspace(host.current, toolbox);
    ws.current = workspace;
    loadProgram(workspace, xml, emptyXml);
    fitProgram(workspace);
    // 読み込み直後の形を基準にする（XML の書式差だけで変更扱いにしない）
    const loadedForm = { current: serializeProgram(workspace) };
    lastXml.current = xml;
    let timer = 0;
    onProgramChange(workspace, () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const next = serializeProgram(workspace);
        if (next === lastXml.current || next === loadedForm.current) return;
        loadedForm.current = '';
        lastXml.current = next;
        onChangeRef.current(next);
      }, SAVE_DELAY_MS);
    });
    const observer = new ResizeObserver(() => resizeWorkspace(workspace));
    observer.observe(host.current);
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
      workspace.dispose();
      ws.current = null;
    };
    // stageKey が変わったときだけ作り直す
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageKey]);

  // 元に戻すなどで外から XML が変わったとき
  useEffect(() => {
    if (!ws.current || xml === lastXml.current) return;
    loadProgram(ws.current, xml, emptyXml);
    lastXml.current = serializeProgram(ws.current);
  }, [xml]);

  // ブロックセットの変更
  useEffect(() => {
    if (ws.current) updateToolbox(ws.current, toolbox);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolboxKey]);

  return (
    <section class="panel program-panel" aria-label={label}>
      <div class="program-head">{head}</div>
      <div class="blockly-host" ref={host} />
    </section>
  );
}
