/**
 * レビュー用 HTML（stage_review.html）を作る。
 * 旧エディタの「レビュー用HTML」と同じく、公開の対象にしたステージだけを番号を振り直して並べ、
 * ブロックセット一覧・マップ・HOT の行動プログラム・模範解答の画像を載せる。
 * 1 ファイルで開けるよう、スタイルと画像は埋め込み、スクリプトは使わない。
 */
import type { StageDocument, StageMap } from '../domain/types';
import { describeValidation } from '../domain/validation';
import { competitionText } from '../domain/hot';
import { blockLabel } from '../blockly/catalog';
import { describeProgram } from '../blockly/programText';

export const REVIEW_FILE_NAME = 'stage_review.html';

export interface ReviewStage {
  no: number;
  id: string;
  title: string;
  blockSet: string;
  condition: string;
  difficulty: number;
  goal: string;
  rule: string;
  maps: StageMap[];
  program: string;
  hotProgram: string | null;
  solutions: Array<{ imageDataUrl: string; imageName: string; note: string }>;
}

export interface ReviewPhase {
  id: string;
  name: string;
  desc: string;
  color: string;
  bg: string;
  stages: ReviewStage[];
}

export interface ReviewData {
  phases: ReviewPhase[];
  blockSets: Array<{ name: string; types: string[] }>;
}

/** 公開の対象にしたステージだけを集める。空のグループは載せない */
export function buildReviewData(doc: StageDocument): ReviewData {
  let no = 1;
  const phases = doc.phases
    .map((p) => ({
      id: p.id,
      name: p.name,
      desc: p.desc,
      color: p.color,
      bg: p.bg,
      stages: p.stages
        .filter((s) => s.includeInExport)
        .map((s) => ({
          no: no++,
          id: s.id,
          title: s.title,
          blockSet: s.blockSet,
          condition: s.hotCompetition?.enabled ? competitionText(s.hotCompetition.turns) : describeValidation(s.play.validation),
          difficulty: s.difficulty,
          goal: s.goal,
          rule: s.rule,
          maps: s.maps,
          program: describeProgram(s.play.savedBlocklyXml),
          hotProgram: s.hotBehavior.enabled ? describeProgram(s.hotBehavior.savedBlocklyXml) : null,
          solutions: s.solutions.map((img, i) => ({ imageDataUrl: img.imageDataUrl, imageName: img.imageName || `模範解答 ${i + 1}`, note: img.note ?? '' })),
        })),
    }))
    .filter((p) => p.stages.length);
  const blockSets = doc.blockSetOrder.map((name) => ({ name, types: doc.blockSets[name] ?? [] }));
  return { phases, blockSets };
}

function esc(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function color(value: string, fallback: string): string {
  return /^#[0-9a-f]{3,8}$/i.test(value) ? value : fallback;
}

/** 画像は data:image/ の URL だけを通す */
function imageUrl(value: string): string | null {
  return /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(value) ? value : null;
}

const TILE_CLASS: Record<string, string> = { '#': 't-wall', '.': 't-floor', I: 't-item', C: 't-cool', H: 't-hot', G: 't-goal' };

function mapHtml(map: StageMap): string {
  const width = map.rows.reduce((w, r) => Math.max(w, r.length), 0);
  const cells = map.rows
    .flatMap((row) => Array.from({ length: width }, (_, x) => row[x] ?? '#'))
    .map((ch) => `<span class="c ${TILE_CLASS[ch] ?? 't-floor'}">${ch === '.' || ch === '#' ? '' : esc(ch)}</span>`)
    .join('');
  return `<figure class="map"><figcaption>${esc(map.label)}</figcaption><div class="grid" style="grid-template-columns:repeat(${width},16px)" role="img" aria-label="${esc(map.label)}：${esc(map.rows.join(' / '))}">${cells}</div>${map.note ? `<p class="note">${esc(map.note)}</p>` : ''}</figure>`;
}

function section(label: string, body: string, extraClass = ''): string {
  return `<section class="part ${extraClass}"><h4>${esc(label)}</h4>${body}</section>`;
}

function stageHtml(s: ReviewStage, phase: ReviewPhase): string {
  const badges = [
    `<span class="badge">${esc(s.blockSet)}</span>`,
    `<span class="badge">マップ ${s.maps.length}</span>`,
    `<span class="badge blue">${esc(s.condition)}</span>`,
    s.difficulty ? `<span class="badge yellow">難易度 ${s.difficulty}/15</span>` : '<span class="badge muted">難易度 未設定</span>',
    s.hotProgram !== null ? '<span class="badge red">HOTが動く</span>' : '',
  ].join('');
  const images = s.solutions
    .map((img) => {
      const url = imageUrl(img.imageDataUrl);
      if (!url) return '';
      return `<figure class="solution"><img src="${url}" alt="${esc(img.imageName)}" loading="lazy"><figcaption>${esc(img.imageName)}${img.note ? `<span>${esc(img.note)}</span>` : ''}</figcaption></figure>`;
    })
    .join('');
  const parts = [
    s.goal ? section('学習目標', `<p>${esc(s.goal)}</p>`) : '',
    s.rule ? section('反応型ルール', `<p class="pre">${esc(s.rule)}</p>`) : '',
    section('マップ', `<div class="maps">${s.maps.map(mapHtml).join('')}</div>`),
    s.hotProgram !== null ? section('HOTの行動プログラム', `<pre>${esc(s.hotProgram)}</pre>`, 'hot') : '',
    images ? section('模範解答', `<div class="solutions">${images}</div>`) : '',
    `<details class="part"><summary>模範解答プログラム（文章）</summary><pre>${esc(s.program)}</pre></details>`,
  ].join('');
  return `<article class="stage" id="${esc(s.id)}"><header><span class="no">${String(s.no).padStart(2, '0')}</span><div><h3>${esc(s.title)}</h3><span class="id">${esc(s.id)}</span></div><i style="background:${color(phase.color, '#64748b')}"></i></header><div class="badges">${badges}</div><div class="body">${parts}</div></article>`;
}

function blockSetsHtml(sets: ReviewData['blockSets']): string {
  const items = sets
    .map(
      (b) =>
        `<div class="set"><b>${esc(b.name)}</b><span class="count">${b.types.length}個</span><div class="chips">${b.types.length ? b.types.map((t) => `<span title="${esc(t)}">${esc(blockLabel(t))}</span>`).join('') : '<span>ブロックなし</span>'}</div></div>`,
    )
    .join('');
  return `<section class="panel"><h2>ブロックセット一覧</h2><div class="sets">${items}</div></section>`;
}

const STYLE = `
:root{color-scheme:light;--ink:#1b1f24;--sub:#5b636b;--faint:#8a9098;--line:#d9ddd8;--soft:#e4e7e2;--ground:#f1f3f0;--surface:#fff;--sunk:#f6f7f5}
*{box-sizing:border-box}body{margin:0;font-family:'Hiragino Sans','Yu Gothic UI','BIZ UDPGothic',system-ui,sans-serif;font-size:14px;line-height:1.6;color:var(--ink);background:var(--ground)}
.top{position:sticky;top:0;z-index:5;background:var(--ink);color:#fff}.top-inner,.nav,main{max-width:1360px;margin:0 auto;padding-left:16px;padding-right:16px}
.top-inner{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 16px;padding-top:12px;padding-bottom:12px}.top h1{margin:0;font-size:16px}.top .meta{font-size:12px;color:#c9ced4}.top .count{margin-left:auto;font-size:12px;font-weight:700}
.nav{display:flex;flex-wrap:wrap;gap:6px;padding-top:14px}.nav a{text-decoration:none;border:1px solid var(--line);border-radius:999px;padding:3px 12px;font-size:12px;font-weight:700}
main{padding-top:18px;padding-bottom:48px}.panel,.stage{background:var(--surface);border:1px solid var(--line);border-radius:10px}
.panel{padding:16px;margin-bottom:28px}.panel h2{margin:0 0 12px;font-size:16px}
.sets{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px}.set{border:1px solid var(--soft);border-radius:8px;padding:10px;background:var(--sunk)}.set .count{margin-left:8px;font-size:11px;color:var(--sub)}
.chips{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}.chips span{font-size:11px;background:var(--surface);border:1px solid var(--line);border-radius:999px;padding:1px 8px}
.phase{margin-bottom:36px;scroll-margin-top:64px}.phase>header{display:flex;flex-wrap:wrap;justify-content:space-between;gap:6px 12px;padding:12px 16px;border-radius:10px;margin-bottom:12px;border-left:6px solid}
.phase>header h2{margin:0;font-size:18px}.phase>header p{margin:2px 0 0;font-size:12px;color:var(--sub);white-space:pre-wrap}.phase>header em{font-style:normal;font-size:12px;color:var(--sub)}
.stages{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,360px),1fr));gap:12px}.stage{overflow:hidden;scroll-margin-top:64px}
.stage>header{display:flex;gap:10px;align-items:flex-start;padding:12px 16px 8px}.stage .no{font-size:24px;font-weight:800;min-width:40px;font-variant-numeric:tabular-nums}.stage h3{margin:0;font-size:15px}.stage .id{font-size:11px;color:var(--faint);font-family:ui-monospace,monospace}
.stage>header i{flex:none;width:10px;height:10px;border-radius:50%;margin:6px 0 0 auto}
.badges{display:flex;flex-wrap:wrap;gap:4px;padding:0 16px 10px;border-bottom:1px solid var(--soft)}.badge{font-size:11px;font-weight:700;color:#3b4148;background:var(--sunk);border:1px solid var(--line);border-radius:999px;padding:1px 8px}
.badge.blue{background:#e6eefc;color:#1f4fae;border-color:#c5d5f5}.badge.yellow{background:#fdf1d6;color:#7a4f00;border-color:#efd8a0}.badge.red{background:#fbe7e6;color:#8e2420;border-color:#e8b4b1}.badge.muted{color:var(--faint)}
.body{padding:10px 16px 16px;display:flex;flex-direction:column;gap:12px;font-size:13px}.part h4{margin:0 0 4px;font-size:11px;letter-spacing:.08em;color:var(--sub)}.part p{margin:0}.pre{white-space:pre-wrap;font-family:ui-monospace,monospace;font-size:12px}
.part.hot{border:1px solid #e8b4b1;background:#fdf3f2;border-radius:8px;padding:8px 10px}pre{margin:0;white-space:pre-wrap;tab-size:2;font:12px/1.55 ui-monospace,monospace}
details summary{cursor:pointer;font-size:12px;color:var(--sub)}details pre{margin-top:6px;padding:8px 10px;background:var(--sunk);border-radius:6px}
.maps{display:flex;flex-wrap:wrap;gap:12px}.map{margin:0}.map figcaption{font-size:11px;color:var(--sub);margin-bottom:2px}.grid{display:inline-grid;gap:1px;padding:2px;background:#c9cec8;border-radius:4px}
.c{width:16px;height:16px;border-radius:2px;display:flex;align-items:center;justify-content:center;font:700 9px ui-monospace,monospace}.t-wall{background:#2a3038}.t-floor{background:#fff}.t-item{background:#f2b33d;color:#4a3000}.t-cool{background:#2f6fde;color:#fff}.t-hot{background:#c9343f;color:#fff}.t-goal{background:#17875a;color:#fff}
.note{font-size:11px;color:var(--sub);margin:2px 0 0}
.solutions{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px}.solution{margin:0;border:1px solid var(--line);border-radius:8px;padding:6px;background:var(--sunk)}.solution img{display:block;width:100%;max-height:240px;object-fit:contain;background:#fff;border-radius:4px}
.solution figcaption{font-size:11px;font-weight:700;margin-top:4px;overflow-wrap:anywhere}.solution figcaption span{display:block;font-weight:400;color:var(--sub);white-space:pre-wrap}
.empty{margin:48px auto;max-width:480px;padding:24px;text-align:center;color:var(--sub);background:var(--surface);border:1px dashed var(--line);border-radius:10px}
@media print{.top{position:static}.nav{display:none}.stage{break-inside:avoid}}
`;

export function reviewHtml(data: ReviewData, generatedAt: Date): string {
  const total = data.phases.reduce((n, p) => n + p.stages.length, 0);
  const date = `${generatedAt.getFullYear()}-${String(generatedAt.getMonth() + 1).padStart(2, '0')}-${String(generatedAt.getDate()).padStart(2, '0')}`;
  const nav = data.phases
    .map((p) => `<a href="#phase-${esc(p.id)}" style="color:${color(p.color, '#64748b')};background:${color(p.bg, '#f1f5f9')}">${esc(p.id)} ${esc(p.name)}</a>`)
    .join('');
  const phases = data.phases
    .map((p) => {
      const range = `${String(p.stages[0].no).padStart(2, '0')}〜${String(p.stages[p.stages.length - 1].no).padStart(2, '0')}（${p.stages.length}ステージ）`;
      return `<section class="phase" id="phase-${esc(p.id)}"><header style="background:${color(p.bg, '#f1f5f9')};border-left-color:${color(p.color, '#64748b')}"><div><h2>${esc(p.id)} ${esc(p.name)}</h2>${p.desc ? `<p>${esc(p.desc)}</p>` : ''}</div><em>${range}</em></header><div class="stages">${p.stages.map((s) => stageHtml(s, p)).join('')}</div></section>`;
    })
    .join('');
  return [
    '<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">',
    '<title>CHaser ステージ一覧（レビュー用）</title>',
    `<style>${STYLE}</style></head><body>`,
    `<header class="top"><div class="top-inner"><h1>CHaser チュートリアル ステージ一覧</h1><span class="meta">レビュー用・${date} 書き出し</span><span class="count">${total}ステージ・${data.phases.length}グループ</span></div></header>`,
    `<nav class="nav" aria-label="グループ">${nav}</nav>`,
    '<main>',
    total ? blockSetsHtml(data.blockSets) + phases : '<p class="empty">公開の対象にしたステージがありません。</p>',
    '</main></body></html>',
  ].join('');
}
