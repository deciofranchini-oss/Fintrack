// ── Budgets v2 ────────────────────────────────────────────────────────────
// Features:
//   • Monthly (with auto_reset) and Annual budgets, shown separately by tab
//   • Category hierarchy: parent budget accumulates spending of all children
//   • History: last 12 months per category with totals/averages
//   • Edit modal restores full state from _budgetCache

'use strict';

let _budgetView  = 'monthly'; // 'monthly' | 'annual'
let _budgetCache = [];        // last loaded budgets (for edit modal lookup)

// ── Utilities ─────────────────────────────────────────────────────────────

function _lastDayOf(y, m) {
  return new Date(+y, +m, 0).getDate();
}

// Set of IDs that count toward catId (self + children + grandchildren)
function _categoryFamily(catId) {
  const ids = new Set([catId]);
  state.categories.forEach(c => { if (c.parent_id === catId) ids.add(c.id); });
  // second pass: grandchildren
  const lvl1 = new Set(ids);
  state.categories.forEach(c => { if (lvl1.has(c.parent_id) && c.id !== catId) ids.add(c.id); });
  return ids;
}

function _buildRawSpending(txs) {
  const map = {};
  (txs || []).forEach(t => {
    if (t.category_id) map[t.category_id] = (map[t.category_id] || 0) + Math.abs(t.amount);
  });
  return map;
}

// ── Selectors init ────────────────────────────────────────────────────────

function _populateYearSelectors() {
  const cur  = new Date().getFullYear();
  const html = Array.from({ length: 7 }, (_, i) => cur - 3 + i)
    .map(y => `<option value="${y}" ${y === cur ? 'selected' : ''}>${y}</option>`)
    .join('');
  ['budgetYear', 'budgetModalYear'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  });
}

function _populateHistCat() {
  const sel = document.getElementById('budgetHistCat');
  if (!sel) return;
  const parents = state.categories.filter(c => c.type === 'despesa' && !c.parent_id)
    .sort((a, b) => a.name.localeCompare(b.name));
  let html = '<option value="">— Selecionar categoria —</option>';
  parents.forEach(p => {
    html += `<option value="${p.id}">${p.icon || '📦'} ${esc(p.name)}</option>`;
    state.categories.filter(c => c.type === 'despesa' && c.parent_id === p.id)
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach(c => { html += `<option value="${c.id}">　${c.icon || '•'} ${esc(c.name)}</option>`; });
  });
  sel.innerHTML = html;
}

// ── Tab switching ─────────────────────────────────────────────────────────

function setBudgetView(view) {
  _budgetView = view;
  document.getElementById('budgetTabMonthly')?.classList.toggle('active', view === 'monthly');
  document.getElementById('budgetTabAnnual')?.classList.toggle('active',  view === 'annual');
  const mp = document.getElementById('budgetMonthPicker');
  const yp = document.getElementById('budgetYearPicker');
  if (mp) mp.style.display = view === 'monthly' ? '' : 'none';
  if (yp) yp.style.display = view === 'annual'  ? '' : 'none';
  loadBudgets();
}

// ── Period helpers ────────────────────────────────────────────────────────

function _getSelectedPeriod() {
  if (_budgetView === 'annual') {
    const y = parseInt(document.getElementById('budgetYear')?.value) || new Date().getFullYear();
    return { year: y };
  }
  const mv = document.getElementById('budgetMonth')?.value || new Date().toISOString().slice(0, 7);
  const [y, m] = mv.split('-');
  return { year: parseInt(y), month: parseInt(m), monthStr: mv };
}

// ── Load & render ─────────────────────────────────────────────────────────

async function loadBudgets() {
  const period = _getSelectedPeriod();
  const grid   = document.getElementById('budgetGrid');
  if (!grid) return;

  grid.innerHTML = '<div class="budget-loading"><span>⏳</span> Carregando...</div>';

  // 1. Load budgets
  let bq = famQ(sb.from('budgets').select('*, categories(id,name,icon,color,parent_id)'))
    .eq('budget_type', _budgetView);

  if (_budgetView === 'monthly') {
    const ms = `${period.year}-${String(period.month).padStart(2, '0')}-01`;
    bq = bq.eq('month', ms);
  } else {
    bq = bq.eq('year', period.year);
  }

  const { data: budgets, error: be } = await bq;
  if (be) { toast(be.message, 'error'); return; }
  _budgetCache = budgets || [];

  // 2. Load spending (expenses only)
  let txQ = famQ(sb.from('transactions').select('category_id,amount')).lt('amount', 0);
  if (_budgetView === 'monthly') {
    const y = String(period.year), m = String(period.month).padStart(2, '0');
    const last = String(_lastDayOf(y, m)).padStart(2, '0');
    txQ = txQ.gte('date', `${y}-${m}-01`).lte('date', `${y}-${m}-${last}`);
  } else {
    txQ = txQ.gte('date', `${period.year}-01-01`).lte('date', `${period.year}-12-31`);
  }
  const { data: txs } = await txQ;
  const raw = _buildRawSpending(txs);

  // 3. Resolve spending per budget (hierarchy)
  const resolved = {};
  _budgetCache.forEach(b => {
    const fam = _categoryFamily(b.category_id);
    resolved[b.id] = 0;
    fam.forEach(cid => { resolved[b.id] += (raw[cid] || 0); });
  });

  // 4. Empty state
  if (!_budgetCache.length) {
    const lbl = _budgetView === 'monthly'
      ? new Date(period.year, period.month - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
      : String(period.year);
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
      <div class="es-icon">🎯</div>
      <p>Nenhum orçamento ${_budgetView === 'monthly' ? 'mensal' : 'anual'} para <strong>${lbl}</strong></p>
      <button class="btn btn-primary" style="margin-top:14px" onclick="openBudgetModal()">+ Criar orçamento</button>
    </div>`;
    return;
  }

  // 5. Sort: over-budget first → % desc
  const sorted = [..._budgetCache].sort((a, b) =>
    (resolved[b.id] / (b.amount || 1)) - (resolved[a.id] / (a.amount || 1))
  );

  grid.innerHTML = sorted.map(b => _budgetCardHTML(b, resolved[b.id])).join('');
}

// ── Card HTML ─────────────────────────────────────────────────────────────

function _budgetCardHTML(b, spent) {
  const pct   = b.amount > 0 ? Math.min(100, (spent / b.amount) * 100) : 0;
  const over  = spent > b.amount;
  const near  = !over && pct >= 80;
  const cat   = b.categories || {};
  const color = over ? 'var(--red)' : near ? '#f59e0b' : (cat.color || 'var(--accent)');
  const rem   = b.amount - spent;

  const parentCat = cat.parent_id ? state.categories.find(c => c.id === cat.parent_id) : null;
  const children  = state.categories.filter(c => c.parent_id === b.category_id && c.type === 'despesa');

  const childTags = children.length
    ? `<div class="budget-child-tags">
        <span style="font-size:.68rem;color:var(--muted);margin-right:3px">Inclui:</span>
        ${children.map(c =>
          `<span class="budget-child-tag" style="background:${c.color || 'var(--accent)'}22;color:${c.color || 'var(--accent)'}">
            ${c.icon || ''} ${esc(c.name)}
          </span>`).join('')}
       </div>` : '';

  const badges = [
    b.auto_reset && _budgetView === 'monthly' ? `<span class="budget-badge" style="background:#e0f2fe;color:#0369a1" title="Reseta todo mês">🔄 mensal</span>` : '',
    _budgetView === 'annual' ? `<span class="budget-badge" style="background:#f0fdf4;color:#15803d">📆 anual</span>` : '',
    b.notes ? `<span class="budget-badge" style="background:var(--bg2);color:var(--muted)" title="${esc(b.notes)}">📝</span>` : '',
  ].filter(Boolean).join('');

  return `
  <div class="budget-card${over ? ' budget-card--over' : near ? ' budget-card--near' : ''}">
    <div class="budget-card-stripe" style="background:${color}"></div>
    <div class="budget-card-header">
      <div class="budget-cat-info">
        <span class="budget-cat-icon">${cat.icon || '📦'}</span>
        <div>
          ${parentCat ? `<div style="font-size:.67rem;color:var(--muted);line-height:1.1;margin-bottom:1px">${parentCat.icon || ''} ${esc(parentCat.name)} ›</div>` : ''}
          <div style="font-weight:700;font-size:.9rem">${esc(cat.name || '—')}</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:4px;flex-shrink:0">
        ${badges}
        <button class="btn-icon" onclick="openBudgetModal('${b.id}')" title="Editar">✏️</button>
        <button class="btn-icon" onclick="deleteBudget('${b.id}')" title="Excluir" style="color:var(--red)">🗑️</button>
      </div>
    </div>

    <div class="budget-amounts">
      <div>
        <div class="budget-amt-lbl">Gasto</div>
        <div class="budget-amt-val${over ? ' amount-neg' : ''}">${fmt(spent)}</div>
      </div>
      <div style="text-align:center">
        <div class="budget-amt-lbl">${over ? 'Excesso' : 'Restante'}</div>
        <div class="budget-amt-val" style="color:${over ? 'var(--red)' : 'var(--green)'}">
          ${over ? '-' : ''}${fmt(Math.abs(rem))}
        </div>
      </div>
      <div style="text-align:right">
        <div class="budget-amt-lbl">Meta</div>
        <div class="budget-amt-val">${fmt(b.amount)}</div>
      </div>
    </div>

    <div style="margin-top:10px">
      <div class="progress" style="height:8px">
        <div class="progress-bar" style="width:${pct}%;background:${color}"></div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:4px;font-size:.7rem;color:var(--muted)">
        <span>${pct.toFixed(0)}% utilizado</span>
        ${over ? `<span style="color:var(--red);font-weight:600">⚠ Excedido</span>` : near ? `<span style="color:#f59e0b;font-weight:600">⚡ Atenção</span>` : ''}
      </div>
    </div>

    ${childTags}
  </div>`;
}

// ── History ───────────────────────────────────────────────────────────────

async function loadBudgetHistory() {
  const catId     = document.getElementById('budgetHistCat')?.value;
  const container = document.getElementById('budgetHistContainer');
  if (!container) return;

  if (!catId) {
    container.innerHTML = '<div style="color:var(--muted);font-size:.83rem;padding:16px 12px">Selecione uma categoria para ver o histórico.</div>';
    return;
  }

  container.innerHTML = '<div style="padding:24px;text-align:center;color:var(--muted)">⏳ Carregando...</div>';

  // Last 12 months list
  const now    = new Date();
  const months = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = String(d.getFullYear());
    const m = String(d.getMonth() + 1).padStart(2, '0');
    months.push({
      monthStart: `${y}-${m}-01`, y, m,
      label: d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
    });
  }

  // Fetch budgets for this category in those months
  const { data: histBudgets } = await famQ(sb.from('budgets').select('month,amount,auto_reset'))
    .eq('category_id', catId)
    .eq('budget_type', 'monthly')
    .in('month', months.map(m => m.monthStart));

  const budgetMap = {};
  (histBudgets || []).forEach(b => { budgetMap[b.month] = b; });

  // If an auto_reset budget exists, use its amount for months without explicit entries
  const autoResetAmt = (histBudgets || []).find(b => b.auto_reset)?.amount ?? 0;

  // Fetch all transactions in range
  const last0 = months[months.length - 1];
  const { data: txAll } = await famQ(sb.from('transactions').select('category_id,amount,date'))
    .lt('amount', 0)
    .gte('date', months[0].monthStart)
    .lte('date', `${last0.y}-${last0.m}-${String(_lastDayOf(last0.y, last0.m)).padStart(2, '0')}`);

  const family   = _categoryFamily(catId);
  let totBudget  = 0, totSpent = 0, countBudgeted = 0;

  const rows = months.map(({ monthStart, y, m, label }) => {
    const last    = String(_lastDayOf(y, m)).padStart(2, '0');
    const monthEnd = `${y}-${m}-${last}`;
    const spent   = (txAll || [])
      .filter(t => family.has(t.category_id) && t.date >= monthStart && t.date <= monthEnd)
      .reduce((s, t) => s + Math.abs(t.amount), 0);

    const bEntry  = budgetMap[monthStart];
    const bAmt    = bEntry?.amount ?? (autoResetAmt || 0);
    const hasB    = bAmt > 0;

    if (hasB) { totBudget += bAmt; countBudgeted++; }
    totSpent += spent;

    const pct  = hasB ? Math.min(100, (spent / bAmt) * 100) : 0;
    const over = hasB && spent > bAmt;

    return `<tr>
      <td style="font-weight:500;white-space:nowrap">${label}</td>
      <td>${hasB ? fmt(bAmt) : '<span style="color:var(--muted)">—</span>'}</td>
      <td class="${over ? 'amount-neg' : spent > 0 ? '' : 'text-muted'}" style="font-weight:${spent > 0 ? '600' : '400'}">${fmt(spent)}</td>
      <td style="min-width:90px">${hasB ? `
        <div class="progress" style="height:5px;margin-top:0">
          <div class="progress-bar" style="width:${pct}%;background:${over ? 'var(--red)' : 'var(--accent)'}"></div>
        </div>
        <div style="font-size:.67rem;color:var(--muted);margin-top:2px">${pct.toFixed(0)}%</div>` : ''}</td>
      <td class="${over ? 'amount-neg' : hasB ? 'amount-pos' : ''}" style="font-size:.8rem">
        ${hasB ? `${over ? '-' : ''}${fmt(Math.abs(bAmt - spent))}` : ''}
      </td>
    </tr>`;
  }).join('');

  const avgSpent  = totSpent / 12;
  const avgBudget = countBudgeted > 0 ? totBudget / countBudgeted : 0;
  const netDelta  = totBudget - totSpent;

  container.innerHTML = `<div class="table-wrap">
    <table style="font-size:.82rem">
      <thead><tr><th>Mês</th><th>Orçamento</th><th>Gasto</th><th style="min-width:90px">Progresso</th><th>Saldo</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr style="border-top:2px solid var(--border);font-weight:700">
          <td style="font-size:.78rem;color:var(--muted)">Média / mês</td>
          <td style="font-size:.82rem">${avgBudget > 0 ? fmt(avgBudget) : '—'}</td>
          <td style="font-size:.82rem;color:var(--text)">${fmt(avgSpent)}</td>
          <td></td>
          <td class="${totBudget > 0 ? (netDelta >= 0 ? 'amount-pos' : 'amount-neg') : ''}" style="font-size:.8rem">
            ${totBudget > 0 ? `${netDelta < 0 ? '-' : ''}${fmt(Math.abs(netDelta / 12))}` : ''}
          </td>
        </tr>
      </tfoot>
    </table>
  </div>`;
}

// ── Modal ─────────────────────────────────────────────────────────────────

function openBudgetModal(id = '') {
  const existing = id ? _budgetCache.find(x => x.id === id) : null;

  document.getElementById('budgetId').value = id;
  document.getElementById('budgetModalTitle').textContent = id ? 'Editar Orçamento' : 'Novo Orçamento';

  const btype  = existing?.budget_type || _budgetView;
  _setBudgetModalType(btype);

  const period = _getSelectedPeriod();
  const now    = new Date();

  // Month
  const monthEl = document.getElementById('budgetModalMonth');
  if (monthEl) monthEl.value = existing?.month?.slice(0, 7) || period.monthStr || now.toISOString().slice(0, 7);

  // Year
  const yearEl = document.getElementById('budgetModalYear');
  if (yearEl) yearEl.value = existing?.year || period.year || now.getFullYear();

  // Categories grouped
  const catSel = document.getElementById('budgetCategory');
  const parents = state.categories.filter(c => c.type === 'despesa' && !c.parent_id)
    .sort((a, b) => a.name.localeCompare(b.name));
  let opts = '';
  parents.forEach(p => {
    opts += `<option value="${p.id}">${p.icon || '📦'} ${esc(p.name)}</option>`;
    state.categories.filter(c => c.type === 'despesa' && c.parent_id === p.id)
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach(c => { opts += `<option value="${c.id}">　${c.icon || '•'} ${esc(c.name)}</option>`; });
  });
  catSel.innerHTML = opts;
  if (existing?.category_id) catSel.value = existing.category_id;

  _updateBudgetCatHint();
  catSel.onchange = _updateBudgetCatHint;

  setAmtField('budgetAmount', existing?.amount || 0);

  const arEl = document.getElementById('budgetAutoReset');
  if (arEl) arEl.checked = existing ? !!existing.auto_reset : true;

  const notesEl = document.getElementById('budgetNotes');
  if (notesEl) notesEl.value = existing?.notes || '';

  openModal('budgetModal');
}

function _updateBudgetCatHint() {
  const catId = document.getElementById('budgetCategory')?.value;
  const hint  = document.getElementById('budgetCatHint');
  if (!hint) return;
  const hasKids = catId && state.categories.some(c => c.parent_id === catId && c.type === 'despesa');
  hint.style.display = hasKids ? '' : 'none';
}

function setBudgetModalType(type) { _setBudgetModalType(type); }

function _setBudgetModalType(type) {
  document.getElementById('budgetModalTypeMonthly')?.classList.toggle('active', type === 'monthly');
  document.getElementById('budgetModalTypeAnnual')?.classList.toggle('active',  type === 'annual');
  const mg = document.getElementById('budgetModalMonthGroup');
  const yg = document.getElementById('budgetModalYearGroup');
  const rg = document.getElementById('budgetAutoResetGroup');
  const tt = document.getElementById('budgetModalTypeCurrent');
  if (mg) mg.style.display = type === 'monthly' ? '' : 'none';
  if (yg) yg.style.display = type === 'annual'  ? '' : 'none';
  if (rg) rg.style.display = type === 'monthly' ? '' : 'none';
  if (tt) tt.setAttribute('data-type', type);
}

// ── Save / Delete ─────────────────────────────────────────────────────────

async function saveBudget() {
  const id        = document.getElementById('budgetId').value;
  const tt        = document.getElementById('budgetModalTypeCurrent');
  const btype     = tt?.getAttribute('data-type') || _budgetView;
  const catId     = document.getElementById('budgetCategory').value;
  const amount    = Math.abs(getAmtField('budgetAmount'));
  const autoReset = document.getElementById('budgetAutoReset')?.checked ?? true;
  const notes     = document.getElementById('budgetNotes')?.value.trim() || null;

  if (!catId)  { toast('Selecione uma categoria', 'error'); return; }
  if (!amount) { toast('Informe o valor limite',  'error'); return; }

  let month = null, year = null;
  if (btype === 'monthly') {
    const mv = document.getElementById('budgetModalMonth')?.value;
    if (!mv) { toast('Selecione o mês', 'error'); return; }
    const [y, m] = mv.split('-');
    month = `${y}-${m}-01`;
    year  = parseInt(y);
  } else {
    year = parseInt(document.getElementById('budgetModalYear')?.value);
    if (!year) { toast('Selecione o ano', 'error'); return; }
  }

  const data = {
    category_id: catId,
    budget_type: btype,
    amount,
    auto_reset:  btype === 'monthly' ? autoReset : false,
    month,
    year,
    notes,
    family_id:   famId(),
  };

  let err;
  if (id) {
    ({ error: err } = await sb.from('budgets').update(data).eq('id', id));
  } else {
    const conflict = btype === 'monthly'
      ? 'family_id,category_id,month,budget_type'
      : 'family_id,category_id,year,budget_type';
    ({ error: err } = await sb.from('budgets').upsert(data, { onConflict: conflict }));
  }

  if (err) { toast(err.message, 'error'); return; }
  toast(id ? 'Orçamento atualizado!' : 'Orçamento salvo!', 'success');
  closeModal('budgetModal');
  await loadBudgets();
}

async function deleteBudget(id) {
  if (!confirm('Excluir este orçamento?')) return;
  const { error } = await sb.from('budgets').delete().eq('id', id);
  if (error) { toast(error.message, 'error'); return; }
  toast('Orçamento removido', 'success');
  loadBudgets();
}

// ── Page init ─────────────────────────────────────────────────────────────

function initBudgetsPage() {
  const now     = new Date();
  const monthEl = document.getElementById('budgetMonth');
  if (monthEl && !monthEl.value) monthEl.value = now.toISOString().slice(0, 7);

  _populateYearSelectors();
  _populateHistCat();

  setBudgetView(_budgetView); // applies tab state + calls loadBudgets
}
