/** ブロックセットの編集：セットの追加・名前変更・削除・並べ替えと、使えるブロックの選択 */
import { useEffect, useRef, useState } from 'preact/hooks';
import type { StageDocument } from '../domain/types';
import * as sets from '../domain/blockSets';
import { ALL_BLOCK_TYPES, BLOCK_CATALOG, blockLabel } from '../blockly/catalog';

interface BlockSetDialogProps {
  doc: StageDocument;
  /** 開いたときに選ぶセット（いまのステージのセット） */
  initial: string | null;
  /** いまのステージ。null ならステージ未選択 */
  stageBlockSet: string | null;
  onEdit: (next: StageDocument) => void;
  onUseForStage: (name: string) => void;
  onClose: () => void;
}

export function BlockSetDialog({ doc, initial, stageBlockSet, onEdit, onUseForStage, onClose }: BlockSetDialogProps) {
  const order = doc.blockSetOrder;
  const [selected, setSelected] = useState(initial && order.includes(initial) ? initial : order[0] ?? null);
  const [nameDraft, setNameDraft] = useState(selected ?? '');
  const [newName, setNewName] = useState('');
  const [copyCurrent, setCopyCurrent] = useState(true);
  const closeButton = useRef<HTMLButtonElement>(null);

  // 元に戻すなどで選んでいたセットが無くなったとき
  const active = selected && order.includes(selected) ? selected : order[0] ?? null;
  useEffect(() => {
    if (active !== selected) setSelected(active);
    setNameDraft(active ?? '');
  }, [active]);

  useEffect(() => {
    closeButton.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const renameError = active ? sets.blockSetNameError(doc, sets.normalizeBlockSetName(nameDraft), active) : null;
  const addName = sets.normalizeBlockSetName(newName);
  const addError = newName.trim() ? sets.blockSetNameError(doc, addName) : null;
  const types = active ? doc.blockSets[active] ?? [] : [];
  const allowed = new Set(types);
  const usage = active ? sets.countBlockSetUsage(doc, active) : 0;
  const replacement = active ? sets.replacementBlockSet(doc, active) : null;
  const index = active ? order.indexOf(active) : -1;

  function commitRename() {
    if (!active) return;
    const name = sets.normalizeBlockSetName(nameDraft);
    if (name === active || renameError) {
      setNameDraft(active);
      return;
    }
    onEdit(sets.renameBlockSet(doc, active, name));
    setSelected(name);
  }

  function setTypes(next: string[]) {
    if (!active) return;
    // 一覧にないブロック（新しい版で増えたものなど）は消さずに残す
    const unknown = types.filter((t) => !ALL_BLOCK_TYPES.includes(t));
    onEdit(sets.setBlockSetTypes(doc, active, [...ALL_BLOCK_TYPES.filter((t) => next.includes(t)), ...unknown]));
  }

  function toggle(type: string, on: boolean) {
    setTypes(on ? [...types, type] : types.filter((t) => t !== type));
  }

  function add() {
    if (!addName || addError) return;
    onEdit(sets.addBlockSet(doc, addName, copyCurrent ? active : null));
    setSelected(addName);
    setNewName('');
  }

  return (
    <div class="backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="dialog dialog-wide" role="dialog" aria-modal="true" aria-labelledby="blockset-title">
        <div class="inline" style={{ justifyContent: 'space-between' }}>
          <h2 id="blockset-title">ブロックセットを編集</h2>
          <button type="button" class="btn" ref={closeButton} onClick={onClose}>閉じる</button>
        </div>
        <span class="field-hint">ステージごとに選ぶ「使えるブロックの組み合わせ」です。変更はすべてのステージに効き、元に戻す（Ctrl+Z）で戻せます。</span>

        <div class="blockset-layout">
          <div class="blockset-list" role="listbox" aria-label="ブロックセット">
            {order.map((name) => {
              const count = sets.countBlockSetUsage(doc, name);
              return (
                <button type="button" role="option" aria-selected={name === active} key={name} onClick={() => setSelected(name)}>
                  <span class="mono">{name}</span>
                  <span class="blockset-meta">{(doc.blockSets[name] ?? []).length}個・{count}ステージ</span>
                </button>
              );
            })}
            <div class="blockset-add">
              <label class="field-label" for="blockset-new">セットを追加</label>
              <input
                id="blockset-new"
                class="input mono"
                placeholder="例：LOOP"
                value={newName}
                onInput={(e) => setNewName(e.currentTarget.value)}
                onKeyDown={(e) => e.key === 'Enter' && add()}
              />
              {active && (
                <label class="check field-hint">
                  <input type="checkbox" checked={copyCurrent} onChange={(e) => setCopyCurrent(e.currentTarget.checked)} />
                  {active} の中身を写す
                </label>
              )}
              {addError && <span class="error-text">{addError}</span>}
              <button type="button" class="btn" disabled={!addName || !!addError} onClick={add}>追加</button>
            </div>
          </div>

          {active ? (
            <div class="blockset-detail">
              <div class="blockset-row">
                <div class="field" style={{ flex: '1 1 200px' }}>
                  <label class="field-label" for="blockset-name">名前</label>
                  <input
                    id="blockset-name"
                    class="input mono"
                    value={nameDraft}
                    onInput={(e) => setNameDraft(e.currentTarget.value)}
                    onBlur={commitRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename();
                      if (e.key === 'Escape') {
                        e.stopPropagation();
                        setNameDraft(active);
                      }
                    }}
                  />
                  {renameError && sets.normalizeBlockSetName(nameDraft) !== active && <span class="error-text">{renameError}</span>}
                </div>
                <div class="inline" style={{ alignSelf: 'flex-end' }}>
                  <button type="button" class="btn" aria-label="1つ上へ" disabled={index <= 0} onClick={() => onEdit(sets.moveBlockSet(doc, active, -1))}>↑</button>
                  <button type="button" class="btn" aria-label="1つ下へ" disabled={index >= order.length - 1} onClick={() => onEdit(sets.moveBlockSet(doc, active, 1))}>↓</button>
                  {stageBlockSet !== null && (
                    <button type="button" class="btn" disabled={stageBlockSet === active} onClick={() => onUseForStage(active)}>
                      {stageBlockSet === active ? 'このステージで使用中' : 'このステージで使う'}
                    </button>
                  )}
                </div>
              </div>

              <div class="inline" style={{ flexWrap: 'wrap' }}>
                <span class="field-label" style={{ marginRight: 'auto' }}>使えるブロック（{types.length}個）</span>
                <button type="button" class="btn-text" onClick={() => setTypes([...ALL_BLOCK_TYPES])}>すべて選ぶ</button>
                <button type="button" class="btn-text" onClick={() => setTypes([])}>すべて外す</button>
              </div>
              <div class="blockset-groups">
                {BLOCK_CATALOG.map((group) => (
                  <fieldset class="blockset-group" key={group.name}>
                    <legend>
                      <span class="blockset-dot" style={{ background: group.color }} aria-hidden="true" />
                      {group.name}
                    </legend>
                    {group.types.map((type) => (
                      <label class="check blockset-block" key={type}>
                        <input type="checkbox" checked={allowed.has(type)} onChange={(e) => toggle(type, e.currentTarget.checked)} />
                        <span>
                          {blockLabel(type)}
                          <span class="mono blockset-type">{type}</span>
                        </span>
                      </label>
                    ))}
                  </fieldset>
                ))}
              </div>
              {!allowed.has('chaser_on_turn') && types.length > 0 && (
                <span class="field-hint" style={{ color: 'var(--warn-ink)' }}>「毎ターン」がないと、このセットでは模範解答を組み立てられません。</span>
              )}

              <div class="blockset-danger">
                <button type="button" class="btn-danger-text" disabled={order.length <= 1} onClick={() => onEdit(sets.deleteBlockSet(doc, active))}>
                  {active} を削除
                </button>
                <span class="field-hint">
                  {order.length <= 1
                    ? '最後のブロックセットは削除できません。'
                    : usage
                      ? `使っている ${usage} ステージは ${replacement} に変わります。`
                      : 'このセットを使っているステージはありません。'}
                </span>
              </div>
            </div>
          ) : (
            <p class="field-hint">ブロックセットがありません。左で追加してください。</p>
          )}
        </div>
      </div>
    </div>
  );
}
