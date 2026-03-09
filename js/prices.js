/* ═══════════════════════════════════════════════════════════════════════════
   PRICES.JS — Gestão de Preços
   • price_items  — catálogo de produtos
   • price_stores — estabelecimentos (com vínculo opcional a payees)
   • price_history — histórico de preço por item × estabelecimento
   ─────────────────────────────────────────────────────────────────────────
   Arquitectura:
     _px.items   — todos os itens da família (com avg/last/min calculados)
     _px.stores  — todos os estabelecimentos
     _px.history — last loaded (per-item, no state)
═══════════════════════════════════════════════════════════════════════════ */

// ── Estado local ──────────────────────────────────────────────────────────────
const _px = {
  items:         [],
  stores:        [],
  activeItemId:  null,
  activeHistAll: [],   // full history of active item (for filter)
  search:        '',
  catFilter:     '',
  storeFilter:   '',
};

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE FLAG
// ─────────────────────────────────────────────────────────────────────────────
async function isPricesEnabled() {
  const famId = currentUser?.family_id;
  if (!famId) return false;
  const val = await getAppSetting('prices_enabled_' + famId, false);
  return val === true || val === 'true';
}

async function applyPricesFeature() {
  const on = await isPricesEnabled();
  const navEl = document.getElementById('pricesNav');
  if (navEl) navEl.style.display = on ? '' : 'none';
  const txBtn = document.getElementById('txRegisterPricesBtn');
  if (txBtn && !on) txBtn.style.display = 'none';
}

async function toggleFamilyPrices(familyId, enabled) {
  await saveAppSetting('prices_enabled_' + familyId, enabled);
  if (typeof applyPricesFeature === 'function') applyPricesFeature().catch(() => {});
  toast(enabled ? '✓ Gestão de Preços ativada para esta família' : 'Gestão de Preços desativada', 'success');
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE INIT & DATA LOAD
// ─────────────────────────────────────────────────────────────────────────────
async function initPricesPage() {
  const on = await isPricesEnabled();
  if (!on) { toast('Recurso de preços não está ativo para esta família.', 'warning'); navigate('dashboard'); return; }
  _px.search = ''; _px.catFilter = ''; _px.storeFilter = '';
  const searchEl = document.getElementById('pricesSearch');
  const catEl    = document.getElementById('pricesCatFilter');
  const storeEl  = document.getElementById('pricesStoreFilter');
  if (searchEl) searchEl.value = '';
  if (catEl)    catEl.value    = '';
  if (storeEl)  storeEl.value  = '';
  _populatePricesCatFilter();
  await _loadPricesData();
  _renderPricesPage();
}

function _populatePricesCatFilter() {
  const sel = document.getElementById('pricesCatFilter');
  if (!sel) return;
  sel.innerHTML = '<option value="">Todas as categorias</option>' +
    (state.categories || []).filter(c => c.type !== 'income')
      .map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
}

function _populatePricesStoreFilter() {
  const sel = document.getElementById('pricesStoreFilter');
  if (!sel) return;
  sel.innerHTML = '<option value="">Todos os estabelecimentos</option>' +
    _px.stores.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('');
}

async function _loadPricesData() {
  const fid = _famId();
  if (!fid) return;
  const [itemsRes, storesRes] = await Promise.all([
    sb.from('price_items')
      .select('id, name, description, unit, category_id, avg_price, last_price, min_price, record_count, categories(name,color)')
      .eq('family_id', fid).order('name'),
    sb.from('price_stores')
      .select('id, name, address, city, state_uf, phone, cnpj, payee_id, payees(id,name,address,city,state_uf,phone,cnpj_cpf)')
      .eq('family_id', fid).order('name'),
  ]);
  _px.items  = itemsRes.data  || [];
  _px.stores = storesRes.data || [];
  _populatePricesStoreFilter();
}

function _famId() { return currentUser?.family_id || null; }

// ─────────────────────────────────────────────────────────────────────────────
// RENDER PRICES PAGE
// ─────────────────────────────────────────────────────────────────────────────
function _renderPricesPage() {
  const listEl = document.getElementById('pricesItemList');
  if (!listEl) return;

  let items = _px.items;
  if (_px.search) {
    const q = _px.search.toLowerCase();
    items = items.filter(i => i.name.toLowerCase().includes(q) || (i.description||'').toLowerCase().includes(q));
  }
  if (_px.catFilter)   items = items.filter(i => i.category_id === _px.catFilter);

  const countEl = document.getElementById('pricesCount');
  if (countEl) countEl.textContent = items.length + (items.length !== 1 ? ' itens' : ' item');

  if (!items.length) {
    listEl.innerHTML = `<div class="prices-empty">
      <div style="font-size:2.8rem;margin-bottom:12px">🏷️</div>
      <div style="font-weight:700;font-size:.95rem;margin-bottom:6px">Nenhum item cadastrado</div>
      <div style="font-size:.82rem;color:var(--muted);max-width:280px;text-align:center;line-height:1.55">
        Use <strong>+ Novo Item</strong> para cadastrar um produto<br>ou importe um recibo com IA.
      </div></div>`;
    return;
  }

  listEl.innerHTML = `<div class="price-list">` + items.map(item => {
    const avg  = item.avg_price  != null ? fmt(item.avg_price)  : '—';
    const last = item.last_price != null ? fmt(item.last_price) : '—';
    const min  = item.min_price  != null ? fmt(item.min_price)  : '—';
    const cat  = item.categories;
    const catBadge = cat
      ? `<span style="font-size:.68rem;font-weight:600;color:${cat.color||'var(--accent)'};background:${cat.color||'var(--accent)'}18;border-radius:4px;padding:1px 6px;margin-top:3px;display:inline-block">${esc(cat.name)}</span>`
      : '';
    return `<div class="price-card" onclick="openPriceItemDetail('${item.id}')">
      <div class="price-card-body">
        <div class="price-card-name">${esc(item.name)}</div>
        ${catBadge}
        ${item.description ? `<div class="price-card-desc">${esc(item.description)}</div>` : ''}
      </div>
      <div class="price-card-stats">
        <div class="price-stat-col">
          <span class="price-stat-lbl">Médio</span>
          <span class="price-stat-val accent">${avg}</span>
        </div>
        <div class="price-stat-col">
          <span class="price-stat-lbl">Mínimo</span>
          <span class="price-stat-val" style="color:var(--green)">${min}</span>
        </div>
        <div class="price-stat-col">
          <span class="price-stat-lbl">Último</span>
          <span class="price-stat-val">${last}</span>
        </div>
        <div class="price-stat-col">
          <span class="price-stat-lbl">Reg.</span>
          <span class="price-stat-val">${item.record_count || 0}</span>
        </div>
      </div>
      <div class="price-card-chevron">›</div>
    </div>`;
  }).join('') + `</div>`;
}

function pricesSearch(val)      { _px.search = val;      _renderPricesPage(); }
function pricesCatFilter(val)   { _px.catFilter = val;   _renderPricesPage(); }
function pricesStoreFilter(val) { _px.storeFilter = val; _renderPricesPage(); }

// ─────────────────────────────────────────────────────────────────────────────
// ITEM DETAIL MODAL
// ─────────────────────────────────────────────────────────────────────────────
async function openPriceItemDetail(itemId) {
  _px.activeItemId = itemId;
  const item = _px.items.find(i => i.id === itemId);
  if (!item) return;

  document.getElementById('pidModalTitle').textContent = '📦 ' + item.name;
  const _pidCat  = document.getElementById('pidItemCat');  if (_pidCat)  _pidCat.textContent  = item.categories?.name || '';
  const _pidDesc = document.getElementById('pidItemDesc'); if (_pidDesc) { _pidDesc.textContent = item.description || ''; _pidDesc.style.display = item.description ? '' : 'none'; }
  const _pidUnit = document.getElementById('pidItemUnit'); if (_pidUnit) _pidUnit.textContent  = item.unit ? '(' + item.unit + ')' : '';
  document.getElementById('pidAvgPrice').textContent  = item.avg_price  != null ? fmt(item.avg_price)  : '—';
  document.getElementById('pidMinPrice').textContent  = item.min_price  != null ? fmt(item.min_price)  : '—';
  document.getElementById('pidLastPrice').textContent = item.last_price != null ? fmt(item.last_price) : '—';
  document.getElementById('pidCount').textContent = item.record_count || '0';

  const histEl = document.getElementById('pidHistoryList');
  histEl.innerHTML = '<div class="pid-loading">⏳ Carregando histórico...</div>';
  openModal('priceItemDetailModal');

  const { data: hist } = await sb
    .from('price_history')
    .select('id, unit_price, quantity, purchased_at, price_stores(id, name, address, city, state_uf)')
    .eq('item_id', itemId)
    .order('purchased_at', { ascending: false })
    .limit(120);

  _px.activeHistAll = hist || [];

  // Populate store filter for this item
  const storeFilter = document.getElementById('pidStoreFilter');
  if (storeFilter) {
    const stores = [...new Map((hist||[]).filter(h=>h.price_stores).map(h=>[h.price_stores.id, h.price_stores])).values()];
    storeFilter.innerHTML = '<option value="">Todos os estabelecimentos</option>' +
      stores.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('');
  }

  _renderPidHistory(_px.activeHistAll);
}

function filterPidHistory() {
  const storeId = document.getElementById('pidStoreFilter')?.value || '';
  const filtered = storeId ? _px.activeHistAll.filter(h => h.price_stores?.id === storeId) : _px.activeHistAll;
  _renderPidHistory(filtered);
}

function _renderPidHistory(hist) {
  const histEl = document.getElementById('pidHistoryList');
  if (!histEl) return;
  if (!hist?.length) { histEl.innerHTML = '<div class="pid-empty">Nenhum registro encontrado.</div>'; return; }

  histEl.innerHTML = hist.map(h => {
    const store   = h.price_stores;
    const dateStr = h.purchased_at ? new Date(h.purchased_at + 'T12:00:00').toLocaleDateString('pt-BR') : '—';
    const loc = [store?.city, store?.state_uf].filter(Boolean).join('/');
    return `<div class="pid-row">
      <div class="pid-row-date">${dateStr}</div>
      <div class="pid-row-store">
        <div class="pid-row-store-name">${esc(store?.name || '—')}</div>
        ${store?.address ? `<div class="pid-row-store-addr">${esc(store.address)}${loc?' · '+esc(loc):''}</div>` : (loc ? `<div class="pid-row-store-addr">${esc(loc)}</div>` : '')}
      </div>
      <div class="pid-row-qty">×${h.quantity ?? 1}</div>
      <div class="pid-row-price">${fmt(h.unit_price)}</div>
      <button class="pid-row-del" onclick="event.stopPropagation();deletePriceHistory('${h.id}','${_px.activeItemId}')"
              title="Remover registro">🗑</button>
    </div>`;
  }).join('');
}

async function deletePriceHistory(histId, itemId) {
  if (!confirm('Remover este registro do histórico?')) return;
  const { error } = await sb.from('price_history').delete().eq('id', histId);
  if (error) { toast('Erro: ' + error.message, 'error'); return; }
  await _refreshItemStats(itemId);
  await _loadPricesData();
  await openPriceItemDetail(itemId);
  _renderPricesPage();
  toast('Registro removido', 'success');
}

async function openEditPriceItem() {
  const item = _px.items.find(i => i.id === _px.activeItemId);
  if (!item) return;
  closeModal('priceItemDetailModal');
  _openItemForm(item);
}

function deletePriceItemCurrent() { deletePriceItem(); }
async function deletePriceItem() {
  const item = _px.items.find(i => i.id === _px.activeItemId);
  if (!item) return;
  if (!confirm(`Excluir o item "${item.name}" e todo o histórico de preços?\n\nEsta ação é irreversível.`)) return;
  await sb.from('price_history').delete().eq('item_id', item.id);
  await sb.from('price_items').delete().eq('id', item.id);
  closeModal('priceItemDetailModal');
  toast('Item excluído', 'success');
  await _loadPricesData();
  _renderPricesPage();
}

// ─────────────────────────────────────────────────────────────────────────────
// ADD PRICE RECORD (manual, from detail modal)
// ─────────────────────────────────────────────────────────────────────────────
function openAddPriceRecord() {
  const item = _px.items.find(i => i.id === _px.activeItemId);
  if (!item) return;
  document.getElementById('aprItemId').value   = item.id;
  document.getElementById('aprModalTitle').textContent = '📌 Registrar Preço — ' + item.name;
  document.getElementById('aprStoreInput').value = '';
  document.getElementById('aprStoreId').value    = '';
  document.getElementById('aprPrice').value      = '';
  document.getElementById('aprQty').value        = '1';
  document.getElementById('aprDate').value       = new Date().toISOString().slice(0, 10);
  document.getElementById('aprError').style.display = 'none';
  _closeSuggest('aprStoreSuggest');
  openModal('addPriceRecordModal');
  setTimeout(() => document.getElementById('aprStoreInput')?.focus(), 150);
}

async function saveAddPriceRecord() {
  const itemId  = document.getElementById('aprItemId').value;
  const storeId = document.getElementById('aprStoreId').value;
  const price   = parseFloat(document.getElementById('aprPrice').value);
  const qty     = parseFloat(document.getElementById('aprQty').value) || 1;
  const date    = document.getElementById('aprDate').value;
  const errEl   = document.getElementById('aprError');
  const saveBtn = document.getElementById('aprSaveBtn');

  if (!storeId) { errEl.textContent = 'Selecione um estabelecimento.'; errEl.style.display=''; return; }
  if (!price || price <= 0) { errEl.textContent = 'Informe o valor unitário.'; errEl.style.display=''; return; }
  if (!date)  { errEl.textContent = 'Informe a data.'; errEl.style.display=''; return; }
  errEl.style.display = 'none';
  saveBtn.disabled = true; saveBtn.textContent = '⏳';

  try {
    const { error } = await sb.from('price_history').insert({
      family_id: _famId(), item_id: itemId, store_id: storeId,
      unit_price: price, quantity: qty, purchased_at: date,
    });
    if (error) throw error;
    await _refreshItemStats(itemId);
    await _loadPricesData();
    closeModal('addPriceRecordModal');
    await openPriceItemDetail(itemId);
    _renderPricesPage();
    toast('✓ Preço registrado', 'success');
  } catch(e) {
    errEl.textContent = 'Erro: ' + e.message; errEl.style.display = '';
  } finally {
    saveBtn.disabled = false; saveBtn.textContent = '💾 Salvar';
  }
}

// Store autocomplete helpers for addPriceRecord modal
function _aprStoreSearch(val) {
  _storeAutoComplete(val, 'aprStoreSuggest', (s) => {
    document.getElementById('aprStoreInput').value = s.name;
    document.getElementById('aprStoreId').value    = s.id;
    _closeSuggest('aprStoreSuggest');
  });
}
function aprNewStore() { _openStoreFormInline(() => openAddPriceRecord()); }

// ─────────────────────────────────────────────────────────────────────────────
// ITEM CREATE / EDIT FORM
// ─────────────────────────────────────────────────────────────────────────────
function openNewPriceItem() { _openItemForm(null); }

function _openItemForm(item) {
  document.getElementById('pifItemId').value    = item?.id || '';
  document.getElementById('pifName').value      = item?.name || '';
  document.getElementById('pifDesc').value      = item?.description || '';
  document.getElementById('pifUnit').value      = item?.unit || 'un';
  document.getElementById('pifModalTitle').textContent = item ? '✏️ Editar Item' : '🏷️ Novo Item';

  // Category select
  const catSel = document.getElementById('pifCategory');
  catSel.innerHTML = '<option value="">— Nenhuma —</option>' +
    (state.categories || []).filter(c => c.type !== 'income')
      .map(c => `<option value="${c.id}"${item?.category_id === c.id ? ' selected' : ''}>${esc(c.name)}</option>`)
      .join('');

  // Show/hide price section — only for new items
  const priceSection = document.getElementById('pifPriceSection');
  if (priceSection) priceSection.style.display = item ? 'none' : '';

  // Price fields
  if (!item) {
    document.getElementById('pifPrice').value      = '';
    document.getElementById('pifQty').value        = '1';
    document.getElementById('pifDate').value       = new Date().toISOString().slice(0, 10);
    document.getElementById('pifStoreInput').value = '';
    document.getElementById('pifStoreId').value    = '';
    _closeSuggest('pifStoreSuggest');
  }

  document.getElementById('pifError').style.display = 'none';
  openModal('priceItemFormModal');
  setTimeout(() => document.getElementById('pifName')?.focus(), 150);
}

async function savePriceItem() {
  const id    = document.getElementById('pifItemId').value;
  const name  = document.getElementById('pifName').value.trim();
  const desc  = document.getElementById('pifDesc').value.trim();
  const unit  = document.getElementById('pifUnit').value || 'un';
  const catId = document.getElementById('pifCategory').value || null;
  const errEl = document.getElementById('pifError');

  if (!name) { _pifErr('Informe o nome do item.'); return; }

  // Price fields (only for new items)
  const price   = !id ? parseFloat(document.getElementById('pifPrice').value)  : null;
  const qty     = !id ? parseFloat(document.getElementById('pifQty').value) || 1 : null;
  const date    = !id ? document.getElementById('pifDate').value : null;
  const storeId = !id ? document.getElementById('pifStoreId').value : null;

  errEl.style.display = 'none';

  const payload = { name, description: desc || null, unit, category_id: catId, family_id: _famId() };
  let itemId = id;

  try {
    if (id) {
      const { error } = await sb.from('price_items').update(payload).eq('id', id);
      if (error) throw error;
    } else {
      const { data: ni, error } = await sb.from('price_items').insert(payload).select('id').single();
      if (error) throw error;
      itemId = ni.id;

      // Optionally save initial price record
      if (price > 0 && storeId && date) {
        await sb.from('price_history').insert({
          family_id: _famId(), item_id: itemId, store_id: storeId,
          unit_price: price, quantity: qty, purchased_at: date,
        });
        await _refreshItemStats(itemId);
      }
    }
    toast(id ? '✓ Item atualizado' : '✓ Item criado', 'success');
    closeModal('priceItemFormModal');
    await _loadPricesData();
    _renderPricesPage();
  } catch(e) { _pifErr('Erro: ' + e.message); }
}

function _pifErr(msg) {
  const el = document.getElementById('pifError');
  if (el) { el.textContent = msg; el.style.display = ''; }
}

// Store autocomplete for pif modal
function _pifStoreSearch(val) {
  _storeAutoComplete(val, 'pifStoreSuggest', (s) => {
    document.getElementById('pifStoreInput').value = s.name;
    document.getElementById('pifStoreId').value    = s.id;
    _closeSuggest('pifStoreSuggest');
  });
}
function _pifStoreNew() { _openStoreFormInline(null); }

// ─────────────────────────────────────────────────────────────────────────────
// STORE MANAGER
// ─────────────────────────────────────────────────────────────────────────────
function openPricesStoreManager() {
  _renderStoreList('');
  openModal('pricesStoreModal');
}

let _storeListFilter = '';
function _filterStoreList(val) { _storeListFilter = val; _renderStoreList(val); }

function _renderStoreList(filter) {
  const el = document.getElementById('storeList');
  if (!el) return;
  let stores = _px.stores;
  if (filter) { const q = filter.toLowerCase(); stores = stores.filter(s => s.name.toLowerCase().includes(q) || (s.address||'').toLowerCase().includes(q)); }
  if (!stores.length) { el.innerHTML = '<div class="pid-empty">Nenhum estabelecimento cadastrado.</div>'; return; }

  el.innerHTML = stores.map(s => {
    const payeeName = s.payees?.name;
    const loc = [s.address, s.city, s.state_uf].filter(Boolean).join(', ');
    return `<div class="store-row">
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:.875rem">${esc(s.name)}</div>
        ${payeeName ? `<div style="font-size:.7rem;color:var(--accent);margin-top:1px">🔗 ${esc(payeeName)}</div>` : ''}
        ${loc ? `<div style="font-size:.72rem;color:var(--muted);margin-top:1px">📍 ${esc(loc)}</div>` : ''}
        ${s.phone ? `<div style="font-size:.72rem;color:var(--muted)">📞 ${esc(s.phone)}</div>` : ''}
      </div>
      <div style="display:flex;gap:5px;flex-shrink:0">
        <button class="btn-icon" onclick="openStoreForm('${s.id}')" title="Editar">✏️</button>
        <button class="btn-icon" onclick="deleteStore('${s.id}')" title="Excluir" style="color:var(--red)">🗑️</button>
      </div>
    </div>`;
  }).join('');
}

function openStoreForm(storeId) {
  const store = storeId ? _px.stores.find(s => s.id === storeId) : null;
  document.getElementById('storeFormId').value      = store?.id || '';
  document.getElementById('storeFormName').value    = store?.name || '';
  document.getElementById('storeFormAddress').value = store?.address || '';
  document.getElementById('storeFormCity').value    = store?.city || '';
  document.getElementById('storeFormUf').value      = store?.state_uf || '';
  document.getElementById('storeFormPhone').value   = store?.phone || '';
  document.getElementById('storeFormCnpj').value    = store?.cnpj || '';
  document.getElementById('storeFormTitle').textContent = store ? '✏️ Editar Estabelecimento' : '🏪 Novo Estabelecimento';
  document.getElementById('storeFormError').style.display = 'none';

  // Payee select
  const payeeSel = document.getElementById('storeFormPayee');
  payeeSel.innerHTML = '<option value="">— Nenhum —</option>' +
    (state.payees || []).map(p => `<option value="${p.id}"${store?.payee_id === p.id ? ' selected' : ''}>${esc(p.name)}</option>`).join('');
  // When payee selected, auto-fill address if empty
  payeeSel.onchange = () => {
    const payee = (state.payees||[]).find(p=>p.id===payeeSel.value);
    if (payee) {
      if (!document.getElementById('storeFormAddress').value && payee.address) document.getElementById('storeFormAddress').value = payee.address;
      if (!document.getElementById('storeFormCity').value    && payee.city)    document.getElementById('storeFormCity').value    = payee.city;
      if (!document.getElementById('storeFormUf').value      && payee.state_uf) document.getElementById('storeFormUf').value     = payee.state_uf;
      if (!document.getElementById('storeFormPhone').value   && payee.phone)   document.getElementById('storeFormPhone').value   = payee.phone;
      if (!document.getElementById('storeFormCnpj').value    && payee.cnpj_cpf) document.getElementById('storeFormCnpj').value   = payee.cnpj_cpf;
    }
  };

  openModal('storeFormModal');
  setTimeout(() => document.getElementById('storeFormName')?.focus(), 150);
}

async function saveStoreForm() {
  const id      = document.getElementById('storeFormId').value;
  const name    = document.getElementById('storeFormName').value.trim();
  const errEl   = document.getElementById('storeFormError');
  if (!name) { errEl.textContent = 'Informe o nome do estabelecimento.'; errEl.style.display=''; return; }
  errEl.style.display = 'none';

  const payload = {
    name,
    address:   document.getElementById('storeFormAddress').value.trim() || null,
    city:      document.getElementById('storeFormCity').value.trim()    || null,
    state_uf:  document.getElementById('storeFormUf').value.trim().toUpperCase() || null,
    phone:     document.getElementById('storeFormPhone').value.trim()   || null,
    cnpj:      document.getElementById('storeFormCnpj').value.trim()    || null,
    payee_id:  document.getElementById('storeFormPayee').value || null,
    family_id: _famId(),
  };

  const { error } = id
    ? await sb.from('price_stores').update(payload).eq('id', id)
    : await sb.from('price_stores').insert(payload);

  if (error) { errEl.textContent = 'Erro: ' + error.message; errEl.style.display=''; return; }

  toast(id ? '✓ Estabelecimento atualizado' : '✓ Estabelecimento criado', 'success');
  closeModal('storeFormModal');
  await _loadPricesData();
  _renderStoreList(_storeListFilter);
}

async function deleteStore(storeId) {
  const store = _px.stores.find(s => s.id === storeId);
  if (!store) return;
  if (!confirm(`Excluir "${store.name}"?\n\nOs registros de preços com este estabelecimento serão mantidos mas sem vínculo de loja.`)) return;
  const { error } = await sb.from('price_stores').delete().eq('id', storeId);
  if (error) { toast('Erro: ' + error.message, 'error'); return; }
  toast('✓ Estabelecimento excluído', 'success');
  await _loadPricesData();
  _renderStoreList(_storeListFilter);
}

// Called from registerPricesModal / addPriceRecordModal to quickly create a store
function _openStoreFormInline(callback) {
  openStoreForm(null);
  // After save, callback
  window._storeFormCallback = callback;
}

// ─────────────────────────────────────────────────────────────────────────────
// STORE AUTOCOMPLETE (shared)
// ─────────────────────────────────────────────────────────────────────────────
function _storeAutoComplete(val, suggestId, onSelect) {
  const el = document.getElementById(suggestId);
  if (!el) return;
  if (!val || val.length < 1) { _closeSuggest(suggestId); return; }
  const q = val.toLowerCase();
  const matches = _px.stores.filter(s => s.name.toLowerCase().includes(q) || (s.address||'').toLowerCase().includes(q));
  if (!matches.length) { _closeSuggest(suggestId); return; }
  el.style.display = '';
  el.innerHTML = matches.map(s => {
    const loc = [s.city, s.state_uf].filter(Boolean).join('/');
    return `<div style="padding:8px 12px;cursor:pointer;font-size:.85rem;border-bottom:1px solid var(--border2)"
                 onmousedown="event.preventDefault()"
                 onclick="(${onSelect.toString()})(${JSON.stringify(s)})"
                 onmouseover="this.style.background='var(--bg2)'" onmouseout="this.style.background=''">
      <div style="font-weight:600">${esc(s.name)}</div>
      ${s.address||loc ? `<div style="font-size:.72rem;color:var(--muted)">${esc([s.address,loc].filter(Boolean).join(' · '))}</div>` : ''}
    </div>`;
  }).join('');
}

function _closeSuggest(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'none';
}

// Close suggest on blur
document.addEventListener('click', e => {
  ['pifStoreSuggest','rpmStoreSuggest','aprStoreSuggest'].forEach(id => {
    const el = document.getElementById(id);
    if (el && !el.contains(e.target)) _closeSuggest(id);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// REGISTER PRICES FROM RECEIPT
// ─────────────────────────────────────────────────────────────────────────────
async function openRegisterPricesFromReceipt() {
  const result = window._lastReceiptAiResult;
  if (!result) { toast('Leia o recibo com IA primeiro.', 'warning'); return; }
  await _loadPricesData();
  _openRegisterModal(result);
}

function _openRegisterModal(aiResult) {
  // Try to match store from known stores OR payees
  let matchedStore = null;
  if (aiResult.payee) {
    const q = aiResult.payee.toLowerCase();
    matchedStore = _px.stores.find(s =>
      s.name.toLowerCase().includes(q) || q.includes(s.name.toLowerCase())
    );
    // Try matching via payee name
    if (!matchedStore) {
      const matchedPayee = (state.payees||[]).find(p =>
        p.name.toLowerCase().includes(q) || q.includes(p.name.toLowerCase())
      );
      if (matchedPayee) {
        matchedStore = _px.stores.find(s => s.payee_id === matchedPayee.id);
      }
    }
  }

  const storeInput = document.getElementById('rpmStoreInput');
  const storeIdEl  = document.getElementById('rpmStoreId');
  const storeInfo  = document.getElementById('rpmStoreInfo');
  const dateEl     = document.getElementById('rpmDate');
  const errEl      = document.getElementById('rpmError');

  if (matchedStore) {
    if (storeInput) storeInput.value = matchedStore.name;
    if (storeIdEl)  storeIdEl.value  = matchedStore.id;
    _showRpmStoreInfo(matchedStore, aiResult.address);
  } else {
    if (storeInput) storeInput.value = aiResult.payee || '';
    if (storeIdEl)  storeIdEl.value  = '';
    if (storeInfo)  storeInfo.style.display = 'none';
    // If AI returned an address, show it as hint
    if (aiResult.address && storeInfo) {
      storeInfo.style.display = '';
      storeInfo.innerHTML = `📍 Endereço do recibo: <strong>${esc(aiResult.address)}</strong> — <a href="#" onclick="event.preventDefault();rpmNewStore()" style="color:var(--accent)">Criar estabelecimento</a>`;
    }
  }
  if (dateEl) dateEl.value = aiResult.date || new Date().toISOString().slice(0, 10);
  if (errEl)  errEl.style.display = 'none';
  _closeSuggest('rpmStoreSuggest');

  const rawItems = aiResult.items || [];
  _renderRpmRows(rawItems.length ? rawItems : [{
    ai_name: aiResult.description || '', quantity: 1, unit_price: aiResult.amount || 0,
  }]);

  openModal('registerPricesModal');
}

function _showRpmStoreInfo(store, aiAddress) {
  const el = document.getElementById('rpmStoreInfo');
  if (!el) return;
  const loc = [store.address || aiAddress, store.city, store.state_uf].filter(Boolean).join(', ');
  el.style.display = '';
  el.innerHTML = `✓ Estabelecimento encontrado` +
    (loc ? ` · <span style="color:var(--text)">📍 ${esc(loc)}</span>` : '') +
    (store.payees ? ` · 🔗 ${esc(store.payees.name)}` : '') +
    ` <button onclick="openStoreForm('${store.id}')" style="background:none;border:none;cursor:pointer;font-size:.78rem;color:var(--accent);padding:0 4px">✏️</button>`;
}

// rpm store search
function _rpmStoreSearch(val) {
  _storeAutoComplete(val, 'rpmStoreSuggest', (s) => {
    document.getElementById('rpmStoreInput').value = s.name;
    document.getElementById('rpmStoreId').value    = s.id;
    _closeSuggest('rpmStoreSuggest');
    _showRpmStoreInfo(s, null);
  });
}

function rpmNewStore() {
  window._storeFormCallback = () => {
    // Reload and try to re-open register modal with last AI result
    _loadPricesData().then(() => {
      if (window._lastReceiptAiResult) _openRegisterModal(window._lastReceiptAiResult);
    });
  };
  openStoreForm(null);
  // Pre-fill from AI result if available
  const r = window._lastReceiptAiResult;
  if (r) {
    setTimeout(() => {
      if (r.payee) document.getElementById('storeFormName').value = r.payee;
      if (r.address) document.getElementById('storeFormAddress').value = r.address;
    }, 50);
  }
}

// Render rpm item rows
function _renderRpmRows(items) {
  const el = document.getElementById('rpmItemList');
  if (!el) return;
  window._rpmItems = items.map((it, idx) => ({ ...it, idx }));
  el.innerHTML = window._rpmItems.map(it => _rpmRowHtml(it)).join('');
}

function _rpmRowHtml(it) {
  const idx      = it.idx;
  const catOpts  = (state.categories || []).filter(c => c.type !== 'income')
    .map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
  // Try to match existing item name
  const nameLower = (it.description || it.ai_name || '').toLowerCase();
  const bestMatch = _px.items.find(i => i.name.toLowerCase().includes(nameLower) || nameLower.includes(i.name.toLowerCase()));
  const itemOpts  = _px.items.map(i => `<option value="${i.id}"${bestMatch?.id===i.id?' selected':''}>${esc(i.name)}</option>`).join('');

  return `<div class="rpm-item" id="rpmItem-${idx}">
    <div class="rpm-item-header">
      <span class="rpm-item-num">${idx + 1}</span>
      <input type="text" class="rpm-item-desc" id="rpmDesc-${idx}"
             placeholder="Descrição do item"
             value="${esc(it.description || it.ai_name || '')}"
             style="flex:1">
      <button class="rpm-ai-btn" onclick="rpmNormalizeAI(${idx})" title="Normalizar com IA">🤖</button>
      <button class="rpm-del-btn" onclick="rpmRemoveRow(${idx})" title="Remover">✕</button>
    </div>
    <div class="rpm-item-fields">
      <div class="form-group" style="margin:0">
        <label style="font-size:.72rem">Qtd</label>
        <input type="number" id="rpmQty-${idx}" value="${it.quantity ?? 1}"
               min="0.001" step="any" style="font-size:.83rem;text-align:center">
      </div>
      <div class="form-group" style="margin:0">
        <label style="font-size:.72rem">Preço Unit. (R$)</label>
        <input type="number" id="rpmPrice-${idx}" value="${(it.unit_price || 0).toFixed(2)}"
               min="0" step="0.01" style="font-size:.83rem">
      </div>
      <div class="form-group" style="margin:0">
        <label style="font-size:.72rem">Categoria</label>
        <select id="rpmCat-${idx}" style="font-size:.8rem">
          <option value="">—</option>${catOpts}
        </select>
      </div>
    </div>
    <div class="form-group" style="margin:6px 0 0">
      <label style="font-size:.72rem">Vincular a item cadastrado <span style="color:var(--muted)">(vazio = criar novo)</span></label>
      <select id="rpmLink-${idx}" style="font-size:.8rem">
        <option value="">— Criar novo item —</option>${itemOpts}
      </select>
    </div>
  </div>`;
}

function rpmRemoveRow(idx) { document.getElementById(`rpmItem-${idx}`)?.remove(); }

async function rpmNormalizeAI(idx) {
  const descEl = document.getElementById(`rpmDesc-${idx}`);
  const raw    = descEl?.value?.trim();
  if (!raw) return;
  const apiKey = await getAppSetting(RECEIPT_AI_KEY_SETTING, '');
  if (!apiKey) { toast('Configure a chave Gemini.', 'warning'); return; }
  const btn = descEl?.parentElement?.querySelector('.rpm-ai-btn');
  if (btn) { btn.textContent = '⏳'; btn.disabled = true; }
  try {
    const url  = `https://generativelanguage.googleapis.com/v1beta/models/${RECEIPT_AI_MODEL}:generateContent?key=${apiKey}`;
    const resp = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text:
        `Normalize este nome de produto de supermercado para descrição curta e padronizada em PT-BR.\n` +
        `Remova: abreviações técnicas, códigos internos, caracteres desnecessários.\n` +
        `Padronize: "ARROZ BRANCO TYPE1 5KG" → "Arroz Branco 5kg"\n` +
        `Retorne APENAS o nome normalizado em Title Case, sem explicações.\n\nProduto: ${raw}`
      }] }], generationConfig: { maxOutputTokens: 50, temperature: 0.1 } }),
    });
    const data = await resp.json();
    const norm = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (norm && descEl) descEl.value = norm;
    toast('✓ Nome normalizado', 'success');
  } catch(e) { toast('Erro na IA: ' + e.message, 'error'); }
  finally { if (btn) { btn.textContent = '🤖'; btn.disabled = false; } }
}

async function rpmNormalizeAllAI() {
  const rows = document.querySelectorAll('.rpm-item');
  for (const row of rows) {
    await rpmNormalizeAI(row.id.replace('rpmItem-', ''));
    await new Promise(r => setTimeout(r, 200));
  }
}

function rpmAddRow() {
  const container = document.getElementById('rpmItemList');
  if (!container) return;
  const maxIdx = window._rpmItems?.length ? Math.max(...window._rpmItems.map(i => i.idx)) + 1 : 0;
  const newItem = { idx: maxIdx, ai_name: '', quantity: 1, unit_price: 0 };
  window._rpmItems = [...(window._rpmItems || []), newItem];
  const div = document.createElement('div');
  div.innerHTML = _rpmRowHtml(newItem);
  container.appendChild(div.firstElementChild);
  document.getElementById(`rpmDesc-${maxIdx}`)?.focus();
}

async function saveRegisterPrices() {
  const storeId   = document.getElementById('rpmStoreId')?.value;
  const storeName = document.getElementById('rpmStoreInput')?.value?.trim();
  const date      = document.getElementById('rpmDate')?.value;
  const errEl     = document.getElementById('rpmError');
  const saveBtn   = document.getElementById('rpmSaveBtn');

  if (!date) { _rpmErr('Informe a data.'); return; }
  errEl.style.display = 'none';
  saveBtn.disabled = true; saveBtn.textContent = '⏳ Salvando...';

  try {
    const fid = _famId();

    // Resolve or create store
    let resolvedStoreId = storeId;
    if (!resolvedStoreId && storeName) {
      // Try exact match
      const existing = _px.stores.find(s => s.name.toLowerCase() === storeName.toLowerCase());
      if (existing) {
        resolvedStoreId = existing.id;
      } else {
        const { data: ns, error: nsErr } = await sb
          .from('price_stores')
          .insert({ family_id: fid, name: storeName })
          .select('id').single();
        if (nsErr) throw new Error('Erro ao salvar estabelecimento: ' + nsErr.message);
        resolvedStoreId = ns.id;
        await _loadPricesData(); // refresh store list
      }
    }
    if (!resolvedStoreId) { _rpmErr('Informe o estabelecimento.'); return; }

    const rows  = document.querySelectorAll('.rpm-item');
    let   saved = 0;
    for (const row of rows) {
      const idx   = row.id.replace('rpmItem-', '');
      const desc  = document.getElementById(`rpmDesc-${idx}`)?.value?.trim();
      const qty   = parseFloat(document.getElementById(`rpmQty-${idx}`)?.value)   || 1;
      const price = parseFloat(document.getElementById(`rpmPrice-${idx}`)?.value) || 0;
      const catId = document.getElementById(`rpmCat-${idx}`)?.value  || null;
      const link  = document.getElementById(`rpmLink-${idx}`)?.value || null;
      if (!desc || price <= 0) continue;

      let itemId = link;
      if (!itemId) {
        const { data: ni, error: niErr } = await sb
          .from('price_items').insert({ family_id: fid, name: desc, category_id: catId }).select('id').single();
        if (niErr) { console.warn('price_item insert:', niErr.message); continue; }
        itemId = ni.id;
      } else if (catId) {
        await sb.from('price_items').update({ category_id: catId }).eq('id', itemId);
      }

      const { error: hErr } = await sb.from('price_history').insert({
        family_id: fid, item_id: itemId, store_id: resolvedStoreId,
        unit_price: price, quantity: qty, purchased_at: date,
      });
      if (hErr) { console.warn('price_history insert:', hErr.message); continue; }
      await _refreshItemStats(itemId);
      saved++;
    }

    toast(`✓ ${saved} preço${saved !== 1 ? 's' : ''} registrado${saved !== 1 ? 's' : ''}!`, 'success');
    closeModal('registerPricesModal');
    if (state.currentPage === 'prices') { await _loadPricesData(); _renderPricesPage(); }
  } catch(e) { _rpmErr('Erro: ' + e.message); }
  finally { saveBtn.disabled = false; saveBtn.textContent = '💾 Salvar Preços'; }
}

function _rpmErr(msg) {
  const el = document.getElementById('rpmError');
  if (el) { el.textContent = msg; el.style.display = ''; }
}

// ─────────────────────────────────────────────────────────────────────────────
// STATS RECALCULATION
// ─────────────────────────────────────────────────────────────────────────────
async function _refreshItemStats(itemId) {
  const { data: rows } = await sb.from('price_history').select('unit_price, purchased_at')
    .eq('item_id', itemId).order('purchased_at', { ascending: false });
  if (!rows?.length) {
    await sb.from('price_items').update({ avg_price: null, last_price: null, min_price: null, record_count: 0 }).eq('id', itemId);
    return;
  }
  const prices = rows.map(r => r.unit_price).filter(v => v != null);
  const avg    = prices.reduce((a, b) => a + b, 0) / prices.length;
  await sb.from('price_items').update({
    avg_price:    Math.round(avg * 100) / 100,
    last_price:   prices[0],
    min_price:    Math.min(...prices),
    record_count: prices.length,
  }).eq('id', itemId);
}

// ══════════════════════════════════════════════════════════════════════════════
// RECEIPT SCAN na página de Preços
// ══════════════════════════════════════════════════════════════════════════════
let _pricesReceiptPending = null;

function openPricesReceiptScan() {
  const zone = document.getElementById('pricesReceiptZone');
  if (zone) zone.style.display = '';
  _pricesReceiptPending = null;
  const nameEl = document.getElementById('pricesReceiptFileName');
  if (nameEl) nameEl.textContent = '';
  const btn    = document.getElementById('pricesReadAiBtn');
  const status = document.getElementById('pricesAiStatus');
  if (btn)    btn.style.display    = 'none';
  if (status) status.style.display = 'none';
}

function closePricesReceiptZone() {
  const zone = document.getElementById('pricesReceiptZone');
  if (zone) zone.style.display = 'none';
  _pricesReceiptPending = null;
  const inp = document.getElementById('pricesReceiptInput');
  if (inp) inp.value = '';
}

async function onPricesReceiptSelected(inputEl) {
  const file = inputEl?.files?.[0];
  if (!file) return;
  inputEl.value = '';
  const nameEl = document.getElementById('pricesReceiptFileName');
  const btn    = document.getElementById('pricesReadAiBtn');
  const status = document.getElementById('pricesAiStatus');
  if (nameEl) nameEl.textContent = file.name;
  if (btn)    btn.style.display  = 'none';
  if (status) { status.style.display = ''; status.textContent = '⏳ Preparando arquivo...'; }
  try {
    if (file.type === 'application/pdf') {
      const b64 = await _pdfPageToBase64(file);
      _pricesReceiptPending = { base64: b64, mediaType: 'image/png', fileName: file.name };
    } else if (file.type.startsWith('image/')) {
      const b64 = await _fileToBase64(file);
      _pricesReceiptPending = { base64: b64, mediaType: file.type, fileName: file.name };
    } else { throw new Error('Formato não suportado.'); }
    if (status) status.style.display = 'none';
    if (btn)    btn.style.display    = '';
  } catch(e) {
    if (status) status.textContent = '❌ ' + e.message;
  }
}

async function onPricesReceiptDrop(event) {
  event.preventDefault();
  const file = event.dataTransfer?.files?.[0];
  if (!file) return;
  const nameEl = document.getElementById('pricesReceiptFileName');
  if (nameEl) nameEl.textContent = file.name;
  await onPricesReceiptSelected({ files: [file], value: '' });
}

async function readPricesReceiptWithAI() {
  if (!_pricesReceiptPending) { toast('Selecione um arquivo primeiro.', 'warning'); return; }
  const apiKey = await getAppSetting(RECEIPT_AI_KEY_SETTING, '');
  if (!apiKey) { toast('Configure a chave Gemini em Configurações → IA.', 'warning'); return; }
  const btn    = document.getElementById('pricesReadAiBtn');
  const status = document.getElementById('pricesAiStatus');
  if (btn)    { btn.disabled = true; btn.textContent = '⏳ Analisando...'; }
  if (status) { status.style.display = ''; status.textContent = '⏳ Analisando recibo com IA...'; }
  try {
    const result = await _callPricesVision(apiKey, _pricesReceiptPending);
    _pricesReceiptPending = null;
    closePricesReceiptZone();
    await _loadPricesData();
    _openRegisterModal(result);
  } catch(e) {
    if (status) status.textContent = '❌ ' + e.message;
    toast('Erro na análise: ' + e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🤖 Analisar com IA'; }
  }
}

async function _callPricesVision(apiKey, pending) {
  const catList = (state.categories || []).filter(c => c.type === 'expense').map(c => c.name).join(', ');
  const today   = new Date().toISOString().slice(0, 10);
  const prompt  =
`Você é especialista em leitura de notas fiscais, cupons e recibos brasileiros.
Analise a imagem e extraia TODOS os itens com seus preços unitários e quantidades.
Responda SOMENTE com JSON válido, sem markdown.

CATEGORIAS DISPONÍVEIS (use o nome exato ou null): ${catList || 'Alimentação, Higiene, Limpeza, Outros'}

RETORNE EXATAMENTE ESTE JSON:
{
  "date": "YYYY-MM-DD",
  "payee": "nome do estabelecimento",
  "address": "endereço completo se visível, ou null",
  "phone": "telefone do estabelecimento se visível, ou null",
  "cnpj": "CNPJ se visível, ou null",
  "items": [
    {
      "description": "nome normalizado do produto",
      "ai_name": "nome exato como aparece no recibo",
      "quantity": 1,
      "unit_price": 0.00,
      "total_price": 0.00,
      "category": "categoria da lista ou null"
    }
  ]
}

REGRAS:
- description: nome limpo, sem abreviações, em português, Title Case
- quantity: decimal para peso (ex: 0.546 kg)
- unit_price = total_price / quantity
- date: data da compra; se não encontrar use ${today}
- address: rua + número + bairro + cidade se visível

Arquivo: ${pending.fileName}`;

  const url  = `https://generativelanguage.googleapis.com/v1beta/models/${RECEIPT_AI_MODEL}:generateContent?key=${apiKey}`;
  const resp = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [
        { inline_data: { mime_type: pending.mediaType, data: pending.base64 } },
        { text: prompt },
      ]}],
      generationConfig: { maxOutputTokens: 2000, temperature: 0.1 },
    }),
  });
  if (!resp.ok) { const err = await resp.json().catch(() => ({})); throw new Error(err?.error?.message || `HTTP ${resp.status}`); }
  const data  = await resp.json();
  const text  = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const clean = text.replace(/```json|```/g, '').trim();
  let parsed;
  try { parsed = JSON.parse(clean); } catch { throw new Error('Resposta inválida da IA'); }
  if (parsed.error) throw new Error(parsed.error);
  return parsed;
}
