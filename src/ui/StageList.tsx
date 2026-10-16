/** 左のステージ一覧：検索・グループの開閉・ドラッグで並べ替え・行ごとの操作 */
import { useEffect, useState } from 'preact/hooks';
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
  onDeleteGroup: (phaseId: string) => void;
}

function matches(stage: Stage, q: string): boolean {
  if (!q) return true;
  const text = `${String(stage.no).padStart(2, '0')} ${stage.title} ${stage.blockSet} ${stage.id}`.toLowerCase();
  return q.toLowerCase().split(/\s+/).every((w) => text.includes(w));
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

  const searching = query.trim().length > 0;

  return (
    <nav class="pane-left" aria-label="ステージ一覧">
      <label class="field-label" for="stage-search">ステージを探す</label>
      <input id="stage-search" type="search" class="input" placeholder="タイトル・番号・ブロックセット" value={query} onInput={(e) => setQuery(e.currentTarget.value)} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px' }}>
        {phases.map((p) => {
          const items = p.stages.map((s, index) => ({ s, index })).filter((x) => matches(x.s, query));
          if (searching && !items.length) return null;
          const isOpen = searching || open.has(p.id);
          const off = p.stages.filter((s) => !s.includeInExport).length;
          return (
            <div key={p.id}>
              <div class="group-head">
                <button type="button" class="group-toggle" aria-expanded={isOpen} onClick={() => toggle(p.id)}>
                  <span class="group-chev" aria-hidden="true">{isOpen ? '▼' : '▶'}</span>
                  <span class="group-id">{p.id}</span>
                  {renaming === p.id ? null : <span class="group-name">{p.name}</span>}
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
                <span class="group-meta">{off ? `${p.stages.length}件・公開外 ${off}` : `${p.stages.length}件`}</span>
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
                            <span class="stage-title">{s.title}</span>
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
