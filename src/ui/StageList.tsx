/** 左のステージ一覧：検索・グループの開閉・ドラッグで並べ替え（ステージ・グループ）・行ごとの操作 */
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Phase, Stage, StageRef } from '../domain/types';

interface StageListProps {
  phases: Phase[];
  selected: StageRef | null;
  onSelect: (ref: StageRef) => void;
  onAddStage: (phaseId: string) => void;
  onMove: (from: StageRef, toPhaseId: string, toIndex: number) => void;
  onDuplicate: (ref: StageRef) => void;
  onDelete: (ref: StageRef) => void;
  onAddGroup: () => void;
  onRenameGroup: (phaseId: string, name: string) => void;
  /** toIndex は移す前の並びでの挿入位置 */
  onMoveGroup: (phaseId: string, toIndex: number) => void;
  onSetExport: (ref: StageRef, include: boolean) => void;
  onSetGroupExport: (phaseId: string, include: boolean) => void;
  onDeleteGroup: (phaseId: string) => void;
}

function matches(stage: Stage, q: string): boolean {
  if (!q) return true;
  const text = `${String(stage.no).padStart(2, '0')} ${stage.title} ${stage.blockSet} ${stage.id}`.toLowerCase();
  return q.toLowerCase().split(/\s+/).every((w) => text.includes(w));
}

export const SIDE_WIDTH_DEFAULT = 300;
const SIDE_WIDTH_MIN = 200;
const SIDE_WIDTH_MAX = 560;
const SIDE_WIDTH_KEY = 'chaiser-stage-editor:side-width';

function clampWidth(w: number): number {
  return Math.round(Math.min(SIDE_WIDTH_MAX, Math.max(SIDE_WIDTH_MIN, w)));
}

/** 幅はこのブラウザだけの好みなので localStorage に置く（使えなくても既定の幅で動く） */
function loadWidth(): number {
  try {
    const n = Number(localStorage.getItem(SIDE_WIDTH_KEY));
    return n ? clampWidth(n) : SIDE_WIDTH_DEFAULT;
  } catch {
    return SIDE_WIDTH_DEFAULT;
  }
}

function saveWidth(w: number): void {
  try {
    localStorage.setItem(SIDE_WIDTH_KEY, String(w));
  } catch {
    // 保存できなくても、開いている間は今の幅のまま
  }
}

function sameRef(a: StageRef | null, b: StageRef | null): boolean {
  return !!a && !!b && a.phaseId === b.phaseId && a.index === b.index;
}

export function StageList(props: StageListProps) {
  const { phases, selected } = props;
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Set<string>>(() => new Set(selected ? [selected.phaseId] : []));
  const [menuFor, setMenuFor] = useState<StageRef | null>(null);
  const [groupMenu, setGroupMenu] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [dragging, setDragging] = useState<StageRef | null>(null);
  const [dropAt, setDropAt] = useState<StageRef | null>(null);
  const [draggingGroup, setDraggingGroup] = useState<string | null>(null);
  /** グループを落とす位置（この番号のグループの前。末尾は phases.length） */
  const [groupDropAt, setGroupDropAt] = useState<number | null>(null);
  const [width, setWidth] = useState(loadWidth);
  const resizeFrom = useRef<{ x: number; width: number } | null>(null);

  function resizeTo(w: number) {
    const next = clampWidth(w);
    setWidth(next);
    saveWidth(next);
  }

  // 選んだステージのグループは開いておく
  useEffect(() => {
    if (selected && !open.has(selected.phaseId)) setOpen(new Set([...open, selected.phaseId]));
  }, [selected?.phaseId]);

  useEffect(() => {
    const close = () => {
      setMenuFor(null);
      setGroupMenu(null);
    };
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, []);

  function toggle(id: string) {
    const next = new Set(open);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setOpen(next);
  }

  function drop(toPhaseId: string, toIndex: number) {
    if (dragging) {
      // 同じグループ内で下へ動かすときは、取り除いた分だけ位置がずれる
      const adjusted = dragging.phaseId === toPhaseId && dragging.index < toIndex ? toIndex - 1 : toIndex;
      props.onMove(dragging, toPhaseId, adjusted);
    }
    setDragging(null);
    setDropAt(null);
  }

  function dropGroup() {
    if (draggingGroup !== null && groupDropAt !== null) props.onMoveGroup(draggingGroup, groupDropAt);
    setDraggingGroup(null);
    setGroupDropAt(null);
  }

  /** 落とす位置の線を出すか（動かしても並びが変わらない位置には出さない） */
  function groupLine(index: number): boolean {
    if (draggingGroup === null || groupDropAt !== index) return false;
    const from = phases.findIndex((p) => p.id === draggingGroup);
    return index !== from && index !== from + 1;
  }

  const searching = query.trim().length > 0;

  return (
    <>
    <nav class="pane-left" aria-label="ステージ一覧" id="stage-list" style={{ '--side-width': `${width}px` }}>
      <label class="field-label" for="stage-search">ステージを探す</label>
      <input id="stage-search" type="search" class="input" placeholder="タイトル・番号・ブロックセット" value={query} onInput={(e) => setQuery(e.currentTarget.value)} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px' }}>
        {phases.map((p, pi) => {
          const items = p.stages.map((s, index) => ({ s, index })).filter((x) => matches(x.s, query));
          if (searching && !items.length) return null;
          const isOpen = searching || open.has(p.id);
          const off = p.stages.filter((s) => !s.includeInExport).length;
          return (
            <div
              key={p.id}
              class={['group', draggingGroup === p.id && 'dragging', groupLine(pi) && 'group-drop-before', pi === phases.length - 1 && groupLine(phases.length) && 'group-drop-after'].filter(Boolean).join(' ')}
              onDragOver={(e) => {
                if (draggingGroup === null) return;
                e.preventDefault();
                // グループの上半分なら前、下半分なら後ろに入れる
                const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
                setGroupDropAt(e.clientY < box.top + box.height / 2 ? pi : pi + 1);
              }}
              onDrop={(e) => {
                if (draggingGroup === null) return;
                e.preventDefault();
                dropGroup();
              }}
            >
              <div
                class="group-head"
                draggable={!searching && renaming !== p.id}
                title={searching ? undefined : 'ドラッグしてグループを並べ替え'}
                onDragStart={(e) => {
                  if (dragging) return;
                  setDraggingGroup(p.id);
                  e.dataTransfer?.setData('text/plain', p.id);
                  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
                }}
                onDragEnd={() => {
                  setDraggingGroup(null);
                  setGroupDropAt(null);
                }}
              >
                <button type="button" class="group-toggle" aria-expanded={isOpen} onClick={() => toggle(p.id)}>
                  <span class="group-chev" aria-hidden="true">{isOpen ? '▼' : '▶'}</span>
                  <span class="group-id">{p.id}</span>
                  {renaming === p.id ? null : <span class="group-name" title={p.name}>{p.name}</span>}
                </button>
                {renaming === p.id && (
                  <input
                    class="input"
                    style={{ height: '30px' }}
                    aria-label="グループ名"
                    value={p.name}
                    ref={(el) => el?.focus()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === 'Escape') setRenaming(null);
                    }}
                    onBlur={() => setRenaming(null)}
                    onInput={(e) => props.onRenameGroup(p.id, e.currentTarget.value)}
                  />
                )}
                <span class="group-meta" title={off ? `${p.stages.length}ステージ（うち非公開 ${off}）` : `${p.stages.length}ステージ`}>
                  {p.stages.length}
                  {off > 0 && <span class="off-count">非公開{off}</span>}
                </span>
                <span class="row-menu-anchor">
                  <button
                    type="button"
                    class="stage-more"
                    aria-label={`${p.name} の操作`}
                    aria-haspopup="menu"
                    onClick={(e) => {
                      e.stopPropagation();
                      setGroupMenu(groupMenu === p.id ? null : p.id);
                      setMenuFor(null);
                    }}
                  >
                    <MoreIcon />
                  </button>
                  {groupMenu === p.id && (
                    <div class="menu" role="menu" onClick={(e) => e.stopPropagation()}>
                      <button type="button" role="menuitem" onClick={() => { setRenaming(p.id); setGroupMenu(null); }}>グループ名を変える</button>
                      <button type="button" role="menuitem" onClick={() => { props.onAddStage(p.id); setGroupMenu(null); }}>ステージを追加</button>
                      <hr />
                      <button type="button" role="menuitem" disabled={!off} onClick={() => { props.onSetGroupExport(p.id, true); setGroupMenu(null); }}>すべて公開の対象にする</button>
                      <button type="button" role="menuitem" disabled={off === p.stages.length} onClick={() => { props.onSetGroupExport(p.id, false); setGroupMenu(null); }}>すべて公開の対象から外す</button>
                      <hr />
                      <button type="button" role="menuitem" disabled={pi === 0} onClick={() => { props.onMoveGroup(p.id, pi - 1); setGroupMenu(null); }}>グループを1つ上へ</button>
                      <button type="button" role="menuitem" disabled={pi === phases.length - 1} onClick={() => { props.onMoveGroup(p.id, pi + 2); setGroupMenu(null); }}>グループを1つ下へ</button>
                      <hr />
                      <button type="button" role="menuitem" class="menu-danger" disabled={p.stages.length > 0} title={p.stages.length ? 'ステージがあるグループは削除できません' : undefined} onClick={() => { props.onDeleteGroup(p.id); setGroupMenu(null); }}>
                        グループを削除{p.stages.length ? '（空のときだけ）' : ''}
                      </button>
                    </div>
                  )}
                </span>
              </div>
              {isOpen && (
                <div
                  class={`group-body ${dragging && dropAt?.phaseId === p.id && dropAt.index === p.stages.length ? 'drop-target' : ''}`}
                  onDragOver={(e) => {
                    if (!dragging) return;
                    e.preventDefault();
                    if (e.target === e.currentTarget) setDropAt({ phaseId: p.id, index: p.stages.length });
                  }}
                  onDrop={(e) => {
                    if (!dragging) return;
                    e.preventDefault();
                    drop(p.id, dropAt?.phaseId === p.id ? dropAt.index : p.stages.length);
                  }}
                >
                  {items.map(({ s, index }) => {
                    const ref = { phaseId: p.id, index };
                    const active = sameRef(ref, selected);
                    return (
                      <div class="row-menu-anchor" key={s.id + index}>
                        <div
                          class={['stage-row', active && 'active', !s.includeInExport && 'excluded', sameRef(dropAt, ref) && dragging && 'drop-before'].filter(Boolean).join(' ')}
                          draggable={!searching}
                          onDragStart={(e) => {
                            setDragging(ref);
                            e.dataTransfer?.setData('text/plain', s.id);
                          }}
                          onDragEnd={() => {
                            setDragging(null);
                            setDropAt(null);
                          }}
                          onDragOver={(e) => {
                            if (!dragging) return;
                            e.preventDefault();
                            e.stopPropagation();
                            setDropAt(ref);
                          }}
                          onDrop={(e) => {
                            if (!dragging) return;
                            e.preventDefault();
                            e.stopPropagation();
                            drop(p.id, index);
                          }}
                        >
                          <button
                            type="button"
                            class="group-toggle"
                            style={{ fontWeight: 'inherit', color: 'inherit' }}
                            aria-current={active ? 'true' : undefined}
                            onClick={() => props.onSelect(ref)}
                          >
                            <span class="stage-no">{String(s.no).padStart(2, '0')}</span>
                            <span class="stage-title" title={s.title}>{s.title}</span>
                            {!s.includeInExport && (
                              <span class="stage-off" title="非公開（公開の対象から外しています）">
                                <EyeOffIcon />
                                <span class="visually-hidden">非公開</span>
                              </span>
                            )}
                            <span class={`stage-diff ${s.difficulty ? '' : 'unset'}`}>{s.difficulty ? `難${s.difficulty}` : '難 —'}</span>
                          </button>
                          <button
                            type="button"
                            class="stage-more"
                            aria-label={`${s.title} の操作`}
                            aria-haspopup="menu"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuFor(sameRef(menuFor, ref) ? null : ref);
                              setGroupMenu(null);
                            }}
                          >
                            <MoreIcon />
                          </button>
                        </div>
                        {sameRef(menuFor, ref) && (
                          <div class="menu" role="menu" onClick={(e) => e.stopPropagation()}>
                            <button type="button" role="menuitem" disabled={index === 0} onClick={() => { props.onMove(ref, p.id, index - 1); setMenuFor(null); }}>1つ上へ</button>
                            <button type="button" role="menuitem" disabled={index === p.stages.length - 1} onClick={() => { props.onMove(ref, p.id, index + 1); setMenuFor(null); }}>1つ下へ</button>
                            <button type="button" role="menuitem" onClick={() => { props.onDuplicate(ref); setMenuFor(null); }}>複製する</button>
                            <button type="button" role="menuitem" onClick={() => { props.onSetExport(ref, !s.includeInExport); setMenuFor(null); }}>
                              {s.includeInExport ? '公開の対象から外す' : '公開の対象にする'}
                            </button>
                            <hr />
                            <button type="button" role="menuitem" class="menu-danger" onClick={() => { props.onDelete(ref); setMenuFor(null); }}>削除する</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {!searching && (
                    <button type="button" class="btn-text" style={{ alignSelf: 'flex-start', fontSize: '13px' }} onClick={() => props.onAddStage(p.id)}>
                      ステージを追加
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {searching && phases.every((p) => !p.stages.some((s) => matches(s, query))) && (
          <p class="field-hint">「{query}」に合うステージはありません。</p>
        )}
        {!searching && (
          <button type="button" class="btn" style={{ marginTop: '8px' }} onClick={props.onAddGroup}>グループを追加</button>
        )}
      </div>
    </nav>
    <div
      class="side-resizer"
      role="separator"
      aria-orientation="vertical"
      aria-controls="stage-list"
      aria-label="ステージ一覧の幅"
      aria-valuenow={width}
      aria-valuemin={SIDE_WIDTH_MIN}
      aria-valuemax={SIDE_WIDTH_MAX}
      tabIndex={0}
      title="ドラッグで幅を変える（ダブルクリックで元の幅）"
      onPointerDown={(e) => {
        e.preventDefault();
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        resizeFrom.current = { x: e.clientX, width };
        document.body.classList.add('resizing');
      }}
      onPointerMove={(e) => {
        if (resizeFrom.current) setWidth(clampWidth(resizeFrom.current.width + e.clientX - resizeFrom.current.x));
      }}
      onPointerUp={() => {
        if (!resizeFrom.current) return;
        resizeFrom.current = null;
        document.body.classList.remove('resizing');
        saveWidth(width);
      }}
      onDblClick={() => resizeTo(SIDE_WIDTH_DEFAULT)}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 60 : 20;
        if (e.key === 'ArrowLeft') resizeTo(width - step);
        else if (e.key === 'ArrowRight') resizeTo(width + step);
        else if (e.key === 'Home') resizeTo(SIDE_WIDTH_MIN);
        else if (e.key === 'End') resizeTo(SIDE_WIDTH_MAX);
        else return;
        e.preventDefault();
      }}
    />
    </>
  );
}

function EyeOffIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M3 3l18 18" />
      <path d="M10.6 5.1A10 10 0 0 1 12 5c5 0 9 4.5 10 7a13 13 0 0 1-2.6 3.6M6.6 6.6A13 13 0 0 0 2 12c1 2.5 5 7 10 7a9.6 9.6 0 0 0 5.4-1.6" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </svg>
  );
}
