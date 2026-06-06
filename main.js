// ============================================================
//  メインスクリプト — Supabase からデータ取得して描画
// ============================================================

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

let allReviews     = [];
let allReactionMap = {};
let allLikeMap     = {};
const cardStates   = {};

// ── 初期化 ──
document.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('review-list');
  container.innerHTML =
    '<p style="text-align:center;padding:3rem;color:#aaa;">読み込み中...</p>';

  const [reviewsRes, reactionsRes, likesRes] = await Promise.all([
    sb.from('reviews').select('*').order('play_date', { ascending: false }),
    sb.from('reactions').select('*').order('created_at', { ascending: true }),
    sb.from('likes').select('review_id'),
  ]);

  if (reviewsRes.error) {
    container.innerHTML =
      `<p style="color:#c00;text-align:center;padding:2rem;">
        読み込みに失敗しました。<br><small>${reviewsRes.error.message}</small>
      </p>`;
    return;
  }

  allReactionMap = {};
  (reactionsRes.data || []).forEach(r => {
    if (!allReactionMap[r.review_id]) allReactionMap[r.review_id] = [];
    allReactionMap[r.review_id].push(r);
  });

  allLikeMap = {};
  (likesRes.data || []).forEach(l => {
    allLikeMap[l.review_id] = (allLikeMap[l.review_id] || 0) + 1;
  });

  allReviews = (reviewsRes.data || []).map(_mapRow);
  renderCards(allReviews);
  updateFilterCount(allReviews.length, allReviews.length);
});


// ============================================================
//  フィルター処理
// ============================================================

function onFilterChange() {
  const minEl = document.getElementById('filter-min');
  const maxEl = document.getElementById('filter-max');
  let minVal = parseInt(minEl.value);
  let maxVal = parseInt(maxEl.value);
  if (minVal > maxVal) { minEl.value = maxVal; minVal = maxVal; }
  document.getElementById('range-min-val').textContent = minVal;
  document.getElementById('range-max-val').textContent = maxVal;
  applyFilters();
}

function toggleChip(el) { el.classList.toggle('active'); applyFilters(); }

function clearFilters() {
  document.getElementById('filter-min').value = 0;
  document.getElementById('filter-max').value = 100;
  document.getElementById('range-min-val').textContent = '0';
  document.getElementById('range-max-val').textContent = '100';
  document.querySelectorAll('.filter-chip.active').forEach(c => c.classList.remove('active'));
  applyFilters();
}

function applyFilters() {
  const minScore   = parseInt(document.getElementById('filter-min').value);
  const maxScore   = parseInt(document.getElementById('filter-max').value);
  const activeKeys = Array.from(document.querySelectorAll('.filter-chip.active'))
    .map(el => el.dataset.key);

  const filtered = allReviews.filter(r => {
    if (r.scores.total < minScore || r.scores.total > maxScore) return false;
    for (const key of activeKeys) {
      if ((r.scores[key] ?? 0) < 8) return false;
    }
    return true;
  });

  renderCards(filtered);
  updateFilterCount(filtered.length, allReviews.length);
}

function updateFilterCount(shown, total) {
  const el = document.getElementById('filter-count');
  if (!el) return;
  el.textContent = shown === total ? `全 ${total} 件` : `${shown} / ${total} 件`;
}


// ============================================================
//  描画処理
// ============================================================

function renderCards(reviews) {
  const container = document.getElementById('review-list');
  container.innerHTML = '';

  if (reviews.length === 0) {
    container.innerHTML =
      '<p class="empty-state">条件に一致するレビューがありません。</p>';
    return;
  }

  const avg = (reviews.reduce((s, r) => s + r.scores.total, 0) / reviews.length).toFixed(1);
  const statsBar = document.createElement('div');
  statsBar.className = 'stats-bar';
  statsBar.innerHTML = `
    <div class="stats-item"><span>レビュー数</span>${reviews.length} 件</div>
    <div class="stats-item"><span>平均スコア</span>${avg} / 100</div>
    <div class="stats-item"><span>作品数</span>${_groupByTitle(reviews).length} 作品</div>
  `;
  container.appendChild(statsBar);

  const activeKeys = Array.from(document.querySelectorAll('.filter-chip.active'))
    .map(el => el.dataset.key);

  _groupByTitle(reviews).forEach(group => {
    container.appendChild(_createGroupCard(group, activeKeys));
  });
}

function _groupByTitle(reviews) {
  const map = new Map();
  reviews.forEach(r => {
    if (!map.has(r.title)) map.set(r.title, []);
    map.get(r.title).push(r);
  });
  return Array.from(map.values());
}


// ============================================================
//  カード生成
// ============================================================

function _createGroupCard(group, activeKeys) {
  const card = document.createElement('article');
  card.className = 'review-card';

  const gid = group[0].id;
  cardStates[gid] = { group, idx: 0 };

  const r0     = group[0];
  const totals = group.map(r => r.scores.total);
  const median = _calcMedian(totals);
  const avg    = _calcAvg(totals);

  const aggregateHTML = group.length > 1 ? `
    <div style="display:flex;align-items:center;gap:.8rem;margin-top:.6rem;flex-wrap:wrap;">
      <div style="display:flex;flex-direction:column;align-items:center;background:#1a1a2e;border:2px solid #c9a84c;border-radius:8px;padding:.35rem .75rem;min-width:64px;">
        <span style="font-size:1.4rem;font-weight:bold;color:#e8d8b4;line-height:1.1;">${median}</span>
        <span style="font-size:.6rem;color:#c9a84c;letter-spacing:.06em;">中央値</span>
      </div>
      <div style="font-size:.8rem;color:#888;">
        平均 <strong style="color:#555;">${avg}</strong>
        <span style="margin-left:.4rem;font-size:.72rem;color:#bbb;">（${group.length}件）</span>
      </div>
    </div>` : '';

  // OG画像（画像あり：カード上部にワイド表示）
  const ogImgHTML = r0.ogImageUrl
    ? `<div style="margin:-1.2rem -1.5rem 1rem;overflow:hidden;">
         <img src="${escHtml(r0.ogImageUrl)}" alt="${escHtml(r0.title)}"
           style="width:100%;aspect-ratio:1200/630;object-fit:cover;display:block;">
       </div>`
    : '';

  const staticHead = document.createElement('div');
  staticHead.className = 'card-static-header';
  staticHead.style.cssText = 'display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;';
  staticHead.innerHTML = `
    ${ogImgHTML}
    <div style="flex:1;min-width:0;">
      <div class="card-title">${escHtml(r0.title)}</div>
      ${r0.boothUrl
        ? `<a href="${escHtml(r0.boothUrl)}" target="_blank" rel="noopener" class="booth-link">BOOTHで見る →</a>`
        : ''}
      ${aggregateHTML}
    </div>
    <button class="btn-expand" id="expand-btn-${gid}" onclick="toggleCard(${gid})"
      style="flex-shrink:0;padding:.28rem .7rem;background:transparent;border:1px solid #c9a84c80;border-radius:4px;color:#c9a84c;font-size:.72rem;cursor:pointer;font-family:inherit;transition:all .15s;white-space:nowrap;"
      onmouseover="this.style.background='#c9a84c';this.style.color='#1a1a2e'"
      onmouseout="this.style.background='transparent';this.style.color='#c9a84c'">
      詳細を見る ▼
    </button>
  `;
  card.appendChild(staticHead);

  const collapseWrap = document.createElement('div');
  collapseWrap.id = `collapse-${gid}`;
  collapseWrap.style.display = 'none';

  if (group.length > 1) {
    collapseWrap.appendChild(_buildReviewerNav(gid, group, 0));
  }

  const dynamic = document.createElement('div');
  dynamic.id = `dynamic-${gid}`;
  _renderDynamic(dynamic, gid, activeKeys);
  collapseWrap.appendChild(dynamic);
  card.appendChild(collapseWrap);

  return card;
}

function _buildReviewerNav(gid, group, idx) {
  const nav = document.createElement('div');
  nav.className = 'reviewer-nav';
  const r     = group[idx];
  const label = r.reviewerName || r.playerCharacter || '名無し';
  nav.innerHTML = `
    <button class="nav-btn" onclick="switchReviewer(${gid}, -1)">◀</button>
    <span class="nav-text" id="nav-text-${gid}">
      ${escHtml(label)}　${idx + 1} / ${group.length}
    </span>
    <button class="nav-btn" onclick="switchReviewer(${gid}, 1)">▶</button>
  `;
  return nav;
}

function toggleCard(gid) {
  const wrap = document.getElementById(`collapse-${gid}`);
  const btn  = document.getElementById(`expand-btn-${gid}`);
  if (!wrap) return;
  const open = wrap.style.display === 'none';
  wrap.style.display = open ? '' : 'none';
  if (btn) btn.innerHTML = open ? '閉じる ▲' : '詳細を見る ▼';
}

function switchReviewer(gid, dir) {
  const state = cardStates[gid];
  if (!state) return;
  state.idx = (state.idx + dir + state.group.length) % state.group.length;
  const r     = state.group[state.idx];
  const label = r.reviewerName || r.playerCharacter || '名無し';
  const navText = document.getElementById(`nav-text-${gid}`);
  if (navText) navText.textContent = `${label}　${state.idx + 1} / ${state.group.length}`;
  const dynamic = document.getElementById(`dynamic-${gid}`);
  if (dynamic) {
    const activeKeys = Array.from(document.querySelectorAll('.filter-chip.active')).map(el => el.dataset.key);
    _renderDynamic(dynamic, gid, activeKeys);
  }
}

function _renderDynamic(container, gid, activeKeys = []) {
  const { group, idx } = cardStates[gid];
  const r         = group[idx];
  const reactions = allReactionMap[r.id] || [];
  const likeCount = allLikeMap[r.id] || 0;

  container.innerHTML = '';

  // メタ情報 ＋ 総合スコア
  const metaRow = document.createElement('div');
  metaRow.className = 'card-header';
  const metaArea = document.createElement('div');
  metaArea.className = 'card-title-area';
  metaArea.innerHTML = `
    <div class="card-meta">
      <span class="card-meta-item">🗓 ${escHtml(r.playDate)}</span>
      <span class="card-meta-item">👤 ${escHtml(r.playerCharacter)}</span>
      ${r.reviewerName ? `<span class="card-meta-item">✏️ ${escHtml(r.reviewerName)}</span>` : ''}
    </div>
  `;
  const totalArea = document.createElement('div');
  totalArea.className = 'total-score-area';
  totalArea.innerHTML = `
    <div class="score-circle">
      <span class="score-value" style="font-size:1.1rem;">${r.scores.total}</span>
      <span class="score-denom">/ 100</span>
    </div>
    <div class="total-label">総合スコア</div>
  `;
  metaRow.appendChild(metaArea);
  metaRow.appendChild(totalArea);
  container.appendChild(metaRow);

  // サブスコア
  const scoresDiv = document.createElement('div');
  scoresDiv.className = 'card-scores';
  CATEGORIES.forEach(({ key, label }) => {
    const val = r.scores[key] ?? null;
    if (val === null) return;
    const pct  = Math.min(100, (val / 10) * 100);
    const isHL = activeKeys.includes(key) && val >= 8;
    const row  = document.createElement('div');
    row.className = 'score-row';
    row.innerHTML = `
      <span class="score-label"${isHL ? ' style="color:#c9a84c;font-weight:bold;"' : ''}>${escHtml(label)}</span>
      <div class="score-bar-bg">
        <div class="score-bar-fill" style="width:${pct}%${isHL ? ';background:linear-gradient(to right,#c9a84c,#f0d080)' : ''}"></div>
      </div>
      <span class="score-num">${val}</span>
    `;
    scoresDiv.appendChild(row);
  });
  container.appendChild(scoresDiv);

  // 感想（折り畳み）
  if (r.comment) {
    const details = document.createElement('details');
    details.className = 'card-comment-wrapper';
    const summary = document.createElement('summary');
    summary.textContent = '💬 感想を見る（ネタバレあり）';
    const commentP = document.createElement('p');
    commentP.className = 'card-comment';
    commentP.textContent = r.comment;
    details.appendChild(summary);
    details.appendChild(commentP);
    container.appendChild(details);
  }

  container.appendChild(_buildLikeSection(r, likeCount));
  container.appendChild(_buildPlayRecordSection(r, reactions));
}


// ============================================================
//  ❤️ いいね（1回制限）
// ============================================================

function _likedKey(rid) { return `liked_${rid}`; }
function _hasLiked(rid) { return !!localStorage.getItem(_likedKey(rid)); }

function _buildLikeSection(review, likeCount) {
  const rid   = review.id;
  const liked = _hasLiked(rid);
  const section = document.createElement('div');
  section.className = 'like-section';
  section.innerHTML = `
    <button class="btn-like${liked ? ' liked' : ''}" id="like-btn-${rid}"
      onclick="addLike(${rid})" ${liked ? 'disabled' : ''}
      style="${liked ? 'opacity:.5;cursor:not-allowed;' : ''}">
      ❤️ いいね${liked ? '済み' : ''}
    </button>
    <span class="like-count" id="like-count-${rid}">${likeCount || ''}</span>
  `;
  return section;
}

async function addLike(rid) {
  if (_hasLiked(rid)) return;
  const { error } = await sb.from('likes').insert([{ review_id: rid }]);
  if (error) { console.error(error); return; }
  localStorage.setItem(_likedKey(rid), '1');
  allLikeMap[rid] = (allLikeMap[rid] || 0) + 1;
  const countEl = document.getElementById(`like-count-${rid}`);
  if (countEl) countEl.textContent = allLikeMap[rid];
  const btn = document.getElementById(`like-btn-${rid}`);
  if (btn) {
    btn.classList.add('pop');
    btn.addEventListener('animationend', () => btn.classList.remove('pop'), { once: true });
    btn.disabled = true;
    btn.style.cssText = 'opacity:.5;cursor:not-allowed;';
    btn.innerHTML = '❤️ いいね済み';
  }
}


// ============================================================
//  通過記録
// ============================================================

function _buildPlayRecordSection(review, reactions) {
  const rid = review.id;
  const section = document.createElement('div');
  section.className = 'play-record-section';
  section.innerHTML = `
    <div class="play-record-title">通過記録</div>
    <div class="reaction-header">
      <div class="reaction-names" id="reaction-list-${rid}"></div>
      <button class="btn-reaction" onclick="toggleReactionForm(${rid})">＋ 記録する</button>
    </div>
    <div class="reaction-form" id="reaction-form-${rid}">
      <input type="text" id="reaction-name-${rid}"
        class="reaction-input" placeholder="ハンドルネーム"
        onkeydown="if(event.key==='Enter') addReaction(${rid})">
      <label class="reaction-played-label">
        <input type="checkbox" id="reaction-played-${rid}"> 通過済み
      </label>
      <button class="btn-reaction-submit" onclick="addReaction(${rid})">追加</button>
    </div>
  `;
  _renderReactionList(section.querySelector(`#reaction-list-${rid}`), reactions);
  return section;
}

function _renderReactionList(el, reactions) {
  if (!el) return;
  if (reactions.length === 0) { el.innerHTML = ''; return; }
  el.innerHTML = reactions.map(r =>
    `<span class="reaction-item ${r.has_played ? 'played' : 'unplayed'}">
      ${r.has_played ? '✅' : '🕐'} ${escHtml(r.handle_name)}
      <button class="btn-reaction-del" onclick="deleteReaction(${r.id}, ${r.review_id})" title="削除">×</button>
    </span>`
  ).join('');
}

function toggleReactionForm(rid) {
  const form = document.getElementById(`reaction-form-${rid}`);
  if (!form) return;
  const show = form.style.display !== 'flex';
  form.style.display = show ? 'flex' : 'none';
  if (show) { const inp = document.getElementById(`reaction-name-${rid}`); if (inp) inp.focus(); }
}

async function addReaction(rid) {
  const nameEl   = document.getElementById(`reaction-name-${rid}`);
  const playedEl = document.getElementById(`reaction-played-${rid}`);
  const name = nameEl.value.trim();
  if (!name) { nameEl.style.borderColor = '#c62828'; nameEl.focus(); return; }
  nameEl.style.borderColor = '';
  const { error } = await sb.from('reactions').insert([{
    review_id: rid, handle_name: name, has_played: playedEl.checked,
  }]);
  if (error) { alert('追加に失敗しました：' + error.message); return; }
  nameEl.value = ''; playedEl.checked = false;
  toggleReactionForm(rid);
  const { data } = await sb.from('reactions').select('*').eq('review_id', rid).order('created_at', { ascending: true });
  allReactionMap[rid] = data || [];
  _renderReactionList(document.getElementById(`reaction-list-${rid}`), allReactionMap[rid]);
}

async function deleteReaction(reactionId, reviewId) {
  if (!confirm('この記録を削除しますか？')) return;
  const { error } = await sb.from('reactions').delete().eq('id', reactionId);
  if (error) { alert('削除に失敗しました：' + error.message); return; }
  const { data } = await sb.from('reactions').select('*').eq('review_id', reviewId).order('created_at', { ascending: true });
  allReactionMap[reviewId] = data || [];
  _renderReactionList(document.getElementById(`reaction-list-${reviewId}`), allReactionMap[reviewId]);
}


// ============================================================
//  ユーティリティ
// ============================================================

function _mapRow(r) {
  return {
    id:              r.id,
    title:           r.title,
    boothUrl:        r.booth_url,
    ogImageUrl:      r.og_image_url,
    playDate:        r.play_date,
    playerCharacter: r.player_character,
    reviewerName:    r.reviewer_name,
    scores: {
      total:     Number(r.score_total),
      suiri:     r.score_suiri,
      roleplay:  r.score_roleplay,
      design:    r.score_design,
      gimmick:   r.score_gimmick,
      character: r.score_character,
    },
    comment: r.comment,
  };
}

function _calcMedian(nums) {
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2 * 10) / 10;
}

function _calcAvg(nums) {
  return Math.round(nums.reduce((s, n) => s + n, 0) / nums.length * 10) / 10;
}

function escHtml(str) {
  if (str == null) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
