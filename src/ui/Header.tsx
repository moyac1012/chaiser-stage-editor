/** 上部バー：現在地・保存状態・元に戻す／やり直す・書き出し・その他の操作 */
import { useEffect, useState } from 'preact/hooks';

interface HeaderProps {
  crumbGroup: string;
  crumbStage: string;
  saving: boolean;
  dirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onExport: () => void;
  onExportReview: () => void;
  onEditBlockSets: () => void;
  onImport: () => void;
  onLoadDefault: () => void;
  onClearLocal: () => void;
}

export function Header(props: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [menuOpen]);

  function pick(fn: () => void) {
    setMenuOpen(false);
    fn();
  }

  return (
    <header class="header">
      <div class="header-title">
        <span class="header-name">CHaser ステージエディタ</span>
        <nav aria-label="現在の場所" class="header-crumb">
          {props.crumbGroup} ／ <strong>{props.crumbStage}</strong>
        </nav>
      </div>
      <div class="header-status" aria-live="polite">
        <span class={`dot ${props.saving ? 'saving' : ''}`} aria-hidden="true" />
        <span>{props.saving ? 'ブラウザに保存中' : 'ブラウザに保存済み'}</span>
        {props.dirty && <span class="dirty">書き出していない変更があります</span>}
      </div>
      <div class="header-actions">
        <button type="button" class="btn btn-icon" aria-label="元に戻す" title="元に戻す（Ctrl+Z）" disabled={!props.canUndo} onClick={props.onUndo}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14L4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 0 10h-3" /></svg>
        </button>
        <button type="button" class="btn btn-icon" aria-label="やり直す" title="やり直す（Ctrl+Shift+Z）" disabled={!props.canRedo} onClick={props.onRedo}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 14l5-5-5-5" /><path d="M20 9H9a5 5 0 0 0 0 10h3" /></svg>
        </button>
        <button type="button" class="btn btn-primary" onClick={props.onExport}>JSONを書き出す</button>
        <button
          type="button"
          class="btn"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen(!menuOpen);
          }}
        >
          その他
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
        </button>
        {menuOpen && (
          <div class="menu" role="menu" onClick={(e) => e.stopPropagation()}>
            <button type="button" role="menuitem" onClick={() => pick(props.onEditBlockSets)}>ブロックセットを編集</button>
            <button type="button" role="menuitem" onClick={() => pick(props.onExportReview)}>レビュー用HTMLを書き出す</button>
            <hr />
            <button type="button" role="menuitem" onClick={() => pick(props.onImport)}>JSONファイルを読み込む</button>
            <button type="button" role="menuitem" onClick={() => pick(props.onLoadDefault)}>既定のステージ（82件）を読み込む</button>
            <hr />
            <button type="button" role="menuitem" class="menu-danger" onClick={() => pick(props.onClearLocal)}>ブラウザに保存したデータを消す</button>
          </div>
        )}
      </div>
    </header>
  );
}
