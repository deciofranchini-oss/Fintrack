const AI_ANALYSIS_PREFIX = 'ai_analysis_enabled_';
const AI_CHAT_PREFIX = 'ai_chat_enabled_';
window._aiInsights = { cache:{}, charts:{}, tab:'analysis', chatByContext:{} };

function _aiFamKey(prefix, familyId){ return `${prefix}${familyId}`; }
async function getFamilyAIFlags(familyId){
  const fid = familyId || famId();
  if (!fid) return { analysis:false, chat:false };
  window._familyFeaturesCache = window._familyFeaturesCache || {};
  const aKey = _aiFamKey(AI_ANALYSIS_PREFIX, fid), cKey = _aiFamKey(AI_CHAT_PREFIX, fid);
  let analysis = window._familyFeaturesCache[aKey], chat = window._familyFeaturesCache[cKey];
  if (analysis === undefined) { const raw = await getAppSetting(aKey, false); analysis = raw === true || raw === 'true'; window._familyFeaturesCache[aKey] = analysis; }
  if (chat === undefined) { const raw = await getAppSetting(cKey, false); chat = raw === true || raw === 'true'; window._familyFeaturesCache[cKey] = chat; }
  return { analysis: !!analysis, chat: !!chat };
}

async function applyAIInsightsFeature(){
  const navEl = document.getElementById('aiInsightsNav');
  const pageEl = document.getElementById('page-ai-insights');
  const fid = famId();
  if (!fid) { if (navEl) navEl.style.display='none'; if (pageEl) pageEl.style.display='none'; return; }
  const flags = await getFamilyAIFlags(fid);
  const visible = !!(flags.analysis || flags.chat);
  if (navEl) navEl.style.display = visible ? '' : 'none';
  if (pageEl) pageEl.style.display = visible ? '' : 'none';
}

function onAIInsightsPeriodChange(){
  const isCustom = document.getElementById('aiiPeriod')?.value === 'custom';
  const fw = document.getElementById('aiiFromWrap'), tw = document.getElementById('aiiToWrap');
  if (fw) fw.style.display = isCustom ? '' : 'none';
  if (tw) tw.style.display = isCustom ? '' : 'none';
  if (!isCustom) {
    const { from, to } = _aiResolvePeriodRange(document.getElementById('aiiPeriod')?.value || 'last30');
    const f = document.getElementById('aiiFrom'), t = document.getElementById('aiiTo');
    if (f) f.value = from; if (t) t.value = to;
  }
  refreshAIInsights();
}

function setAIInsightsTab(tab){
  window._aiInsights.tab = tab;
  document.getElementById('aiiAnalysisView').style.display = tab === 'analysis' ? '' : 'none';
  document.getElementById('aiiChatView').style.display = tab === 'chat' ? '' : 'none';
  document.getElementById('aiiTabAnalysis')?.classList.toggle('active', tab === 'analysis');
  document.getElementById('aiiTabChat')?.classList.toggle('active', tab === 'chat');
}

function _aiResolvePeriodRange(period){
  const now = new Date();
  const to = new Date(now); const from = new Date(now);
  if (period === 'last90') from.setDate(from.getDate()-89);
  else if (period === 'currentMonth') from.setDate(1);
  else if (period === 'previousMonth') { from.setMonth(from.getMonth()-1,1); to.setDate(0); }
  else from.setDate(from.getDate()-29);
  const fmtD = d => new Date(d.getTime() - (d.getTimezoneOffset()*60000)).toISOString().slice(0,10);
  return { from: fmtD(from), to: fmtD(to) };
}

function _aiFormatCurrency(v, currency='BRL'){ try { return new Intl.NumberFormat('pt-BR',{style:'currency',currency}).format(Number(v||0)); } catch { return String(v||0); } }
function _aiSafeText(v){ return typeof esc === 'function' ? esc(String(v ?? '')) : String(v ?? ''); }
function _aiNormalizePayee(name){ return String(name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9 ]/g,' ').replace(/\b(ltda|s a|sa|me|eireli|supermercado|mercado|store|loja|pag\*|pix|debito|credito)\b/gi,' ').replace(/\s+/g,' ').trim().toUpperCase(); }

async function loadAIInsightsPage(force=false){
  await applyAIInsightsFeature();
  const flags = await getFamilyAIFlags();
  const disabled = document.getElementById('aiiDisabledState');
  if (!flags.analysis && !flags.chat) {
    disabled.style.display = '';
    disabled.innerHTML = '<strong>AI Insights indisponível nesta família.</strong><br>Ative AI Analysis e/ou AI Chat em Gestão da Família.';
    return;
  }
  disabled.style.display = 'none';
  document.getElementById('aiiTabAnalysis').style.display = flags.analysis ? '' : 'none';
  document.getElementById('aiiTabChat').style.display = flags.chat ? '' : 'none';
  if (!flags.analysis && flags.chat) setAIInsightsTab('chat'); else if (!flags.chat && flags.analysis) setAIInsightsTab('analysis');
  _aiPopulateFilterOptions();
  if (!document.getElementById('aiiFrom')?.value) onAIInsightsPeriodChange();
  _aiRenderSuggestedQuestions();
  await refreshAIInsights(force);
}

function _aiPopulateFilterOptions(){
  const fill = (id, arr, mapFn) => { const el = document.getElementById(id); if (!el) return; const cur = el.value; el.innerHTML = '<option value="">Todos</option>' + (arr||[]).map(mapFn).join(''); if ([...el.options].some(o=>o.value===cur)) el.value = cur; };
  fill('aiiMember', window._fmcState?.members || [], m => `<option value="${m.id}">${_aiSafeText(m.name)}</option>`);
  fill('aiiAccount', state.accounts || [], a => `<option value="${a.id}">${_aiSafeText(a.name)}</option>`);
  fill('aiiCategory', state.categories || [], c => `<option value="${c.id}">${_aiSafeText(c.name)}</option>`);
  fill('aiiPayee', state.payees || [], p => `<option value="${p.id}">${_aiSafeText(p.name)}</option>`);
}

function _aiReadFilters(){
  const period = document.getElementById('aiiPeriod')?.value || 'last30';
  const resolved = period === 'custom' ? { from: document.getElementById('aiiFrom')?.value, to: document.getElementById('aiiTo')?.value } : _aiResolvePeriodRange(period);
  return {
    familyId: famId(), period, from: resolved.from, to: resolved.to,
    memberId: document.getElementById('aiiMember')?.value || '',
    accountId: document.getElementById('aiiAccount')?.value || '',
    categoryId: document.getElementById('aiiCategory')?.value || '',
    payeeId: document.getElementById('aiiPayee')?.value || '',
  };
}
function _aiContextKey(filters){ return JSON.stringify(filters); }

async function refreshAIInsights(force=false){
  const flags = await getFamilyAIFlags();
  const filters = _aiReadFilters();
  const key = _aiContextKey(filters);
  if (!force && window._aiInsights.cache[key]) {
    _aiRenderAnalysis(window._aiInsights.cache[key]);
    _aiRenderChatHistory(key);
    return;
  }
  _aiRenderLoading();
  try {
    const ctx = await _aiBuildFinancialContext(filters);
    let analysis = _aiBuildFallbackAnalysis(ctx);
    if (flags.analysis) {
      try { analysis = await _aiRunGeminiAnalysis(ctx); }
      catch (e) { console.warn('[AI Insights] analysis fallback', e.message); analysis._aiFallbackReason = e.message; }
    }
    const payload = { context: ctx, analysis, filters, flags };
    window._aiInsights.cache[key] = payload;
    _aiRenderAnalysis(payload);
    _aiRenderChatHistory(key);
  } catch (e) {
    document.getElementById('aiiExecutiveSummary').innerHTML = `<div class="aii-empty">Falha ao montar a análise: ${_aiSafeText(e.message)}</div>`;
  }
}

function _aiRenderLoading(){
  document.getElementById('aiiSummaryCards').innerHTML = Array.from({length:4}).map(()=>'<div class="aii-summary-card"><div class="skeleton" style="height:14px;width:60%;margin-bottom:10px"></div><div class="skeleton" style="height:26px;width:70%"></div></div>').join('');
  document.getElementById('aiiExecutiveSummary').innerHTML = '<div class="aii-line">Preparando contexto financeiro da família…</div>';
  ['aiiKeyInsights','aiiSavingsList','aiiCashflowAlerts','aiiPatterns','aiiClassSuggestions'].forEach(id=>{ const el=document.getElementById(id); if(el) el.innerHTML='<div class="aii-line">Carregando…</div>'; });
}

async function _aiBuildFinancialContext(filters){
  if (!sb) throw new Error('Banco não conectado.');
  let txQ = famQ(sb.from('transactions').select('*, accounts!transactions_account_id_fkey(id,name,currency), payees(id,name), categories(id,name,type,parent_id), family_composition(id,name,member_type)')).gte('date', filters.from).lte('date', filters.to).order('date', { ascending: false }).limit(2000);
  if (filters.accountId) txQ = txQ.eq('account_id', filters.accountId);
  if (filters.categoryId) txQ = txQ.eq('category_id', filters.categoryId);
  if (filters.payeeId) txQ = txQ.eq('payee_id', filters.payeeId);
  if (filters.memberId) txQ = txQ.or(`family_member_id.eq.${filters.memberId},family_member_ids.cs.{${filters.memberId}}`);
  const { data: txRows, error: txErr } = await txQ;
  if (txErr) throw txErr;

  const next30 = new Date(filters.to + 'T12:00:00'); next30.setDate(next30.getDate()+30);
  let scQ = famQ(sb.from('scheduled_transactions').select('*, accounts!scheduled_transactions_account_id_fkey(id,name,currency), payees(id,name), categories(id,name,color), occurrences:scheduled_occurrences(id,scheduled_date,execution_status,transaction_id)').eq('status','active').lte('start_date', next30.toISOString().slice(0,10)).limit(500));
  if (filters.accountId) scQ = scQ.eq('account_id', filters.accountId);
  if (filters.categoryId) scQ = scQ.eq('category_id', filters.categoryId);
  if (filters.payeeId) scQ = scQ.eq('payee_id', filters.payeeId);
  if (filters.memberId) scQ = scQ.or(`family_member_id.eq.${filters.memberId},family_member_ids.cs.{${filters.memberId}}`);
  const { data: scheduledRows } = await scQ;

  const txs = (txRows || []).filter(t => !filters.memberId || t.family_member_id === filters.memberId || (Array.isArray(t.family_member_ids) && t.family_member_ids.includes(filters.memberId)));
  const nonTransfer = txs.filter(t => !t.is_transfer && !t.is_card_payment);
  const confirmed = nonTransfer.filter(t => (t.status || 'confirmed') === 'confirmed');
  const expenses = confirmed.filter(t => Number(t.amount||0) < 0);
  const income = confirmed.filter(t => Number(t.amount||0) > 0);
  const sum = arr => arr.reduce((s,t)=>s+Math.abs(Number(t.brl_amount ?? t.amount ?? 0)),0);
  const totalExpenses = sum(expenses), totalIncome = income.reduce((s,t)=>s+Number(t.brl_amount ?? t.amount ?? 0),0), net = totalIncome - totalExpenses;
  const groupBy = (arr, keyFn, valueFn=(t)=>Math.abs(Number(t.brl_amount ?? t.amount ?? 0))) => {
    const m = new Map();
    arr.forEach(item => { const key = keyFn(item); if (!key) return; m.set(key, (m.get(key)||0) + valueFn(item)); });
    return [...m.entries()];
  };
  const categoryTotals = groupBy(expenses, t => t.categories?.name || 'Sem categoria').map(([name,total])=>({ name, total })).sort((a,b)=>b.total-a.total);
  const payeeTotals = groupBy(expenses, t => t.payees?.name || _aiNormalizePayee(t.description) || 'Sem beneficiário').map(([name,total])=>({ name, total })).sort((a,b)=>b.total-a.total);
  const memberSpendMap = new Map();
  expenses.forEach(t => {
    const ids = (Array.isArray(t.family_member_ids) && t.family_member_ids.length ? t.family_member_ids : (t.family_member_id ? [t.family_member_id] : ['family'])) || ['family'];
    const share = Math.abs(Number(t.brl_amount ?? t.amount ?? 0)) / ids.length;
    ids.forEach(id => memberSpendMap.set(id, (memberSpendMap.get(id)||0) + share));
  });
  const memberById = {}; (window._fmcState?.members || []).forEach(m => memberById[m.id] = m.name);
  const memberTotals = [...memberSpendMap.entries()].map(([id,total]) => ({ id, name: id === 'family' ? 'Família' : (memberById[id] || 'Membro'), total })).sort((a,b)=>b.total-a.total);
  const trendMap = new Map();
  confirmed.forEach(t => {
    const month = String(t.date||'').slice(0,7); if (!month) return;
    const cur = trendMap.get(month) || { month, income:0, expenses:0, net:0 };
    const val = Number(t.brl_amount ?? t.amount ?? 0);
    if (val > 0) cur.income += val; else cur.expenses += Math.abs(val);
    cur.net = cur.income - cur.expenses; trendMap.set(month, cur);
  });
  const monthlyTrend = [...trendMap.values()].sort((a,b)=>a.month.localeCompare(b.month));
  const normPayeeMap = {};
  expenses.forEach(t => { const raw = t.payees?.name || t.description || 'Sem nome'; const norm = _aiNormalizePayee(raw); if (!norm) return; normPayeeMap[norm] = normPayeeMap[norm] || new Set(); normPayeeMap[norm].add(raw); });
  const duplicateMerchantLabels = Object.entries(normPayeeMap).filter(([,set])=>set.size>1).slice(0,8).map(([norm,set])=>({ normalized:norm, variants:[...set] }));
  const recurringMerchants = payeeTotals.filter(p => expenses.filter(t => (t.payees?.name || _aiNormalizePayee(t.description)) === p.name).length >= 2).slice(0,8);
  const anomalies = expenses.filter(t => {
    const norm = _aiNormalizePayee(t.payees?.name || t.description);
    const peers = expenses.filter(x => _aiNormalizePayee(x.payees?.name || x.description) === norm).map(x => Math.abs(Number(x.brl_amount ?? x.amount ?? 0)));
    if (peers.length < 3) return false;
    const avg = peers.reduce((a,b)=>a+b,0)/peers.length;
    return Math.abs(Number(t.brl_amount ?? t.amount ?? 0)) > avg * 1.9;
  }).slice(0,12).map(t => ({ transaction_id:t.id, description:t.description, amount:Math.abs(Number(t.brl_amount ?? t.amount ?? 0)), payee:t.payees?.name || null, category:t.categories?.name || null, date:t.date }));
  const classificationSuggestions = expenses.slice(0,80).map(t => {
    const desc = `${t.description||''} ${(t.memo||'')}`.toLowerCase();
    let suggested_category = null, suggested_subcategory = null, likely_purpose = null, confidence = 0.58, explanation = 'Categoria atual parece coerente com o histórico conhecido.';
    if (/uber|99|taxi|estacionamento|posto|combust/i.test(desc)) { suggested_category='Transporte'; likely_purpose='mobilidade'; confidence=0.84; explanation='Descrição combina com despesas de mobilidade.'; }
    else if (/mercado|super|ifood|restaurante|padaria/i.test(desc)) { suggested_category='Alimentação'; likely_purpose='alimentação'; confidence=0.78; explanation='Texto e beneficiário sugerem alimentação.'; }
    else if (/farm|droga|clinica|medic/i.test(desc)) { suggested_category='Saúde'; likely_purpose='saúde'; confidence=0.8; explanation='Termos indicam gasto médico ou farmacêutico.'; }
    if (suggested_category && suggested_category !== (t.categories?.name || null)) return { transaction_id:t.id, current_category:t.categories?.name || null, suggested_category, suggested_subcategory, normalized_payee:_aiNormalizePayee(t.payees?.name || t.description), likely_purpose, confidence, explanation };
    return null;
  }).filter(Boolean).slice(0,10);
  const balances = (state.accounts || []).map(a => ({ account_name:a.name, currency:a.currency || 'BRL', balance:Number(a.balance || 0) }));
  const scheduledSummary = _aiBuildScheduledSummary(scheduledRows || [], filters.to);
  return {
    filters,
    totals: { total_income: totalIncome, total_expenses: totalExpenses, net_result: net, average_expenses: expenses.length ? totalExpenses / Math.max(monthlyTrend.length || 1,1) : 0 },
    spending_by_category: categoryTotals.slice(0,12),
    spending_by_member: memberTotals,
    monthly_trend: monthlyTrend,
    income_summary: groupBy(income, t => t.payees?.name || t.description || 'Receita').map(([name,total])=>({ name, total })).sort((a,b)=>b.total-a.total).slice(0,8),
    top_payees: payeeTotals.slice(0,10),
    scheduled_transactions_summary: scheduledSummary,
    unusual_spending_candidates: anomalies,
    account_balances: balances,
    contextual_signals: {
      recurring_merchants: recurringMerchants,
      duplicate_merchant_labels: duplicateMerchantLabels,
      household_spending_clusters: categoryTotals.slice(0,5).map(c=>c.name),
      unusual_transactions: anomalies,
      category_inconsistencies: classificationSuggestions.slice(0,6),
    },
    classification_suggestions_seed: classificationSuggestions,
    sample_transactions: txs.slice(0,120).map(t => ({ id:t.id, date:t.date, amount:Number(t.brl_amount ?? t.amount ?? 0), description:t.description, payee:t.payees?.name || null, category:t.categories?.name || null, member:t.family_composition?.name || null, account:t.accounts?.name || null, normalized_payee:_aiNormalizePayee(t.payees?.name || t.description), memo:t.memo || null }))
  };
}

function _aiBuildScheduledSummary(rows, fromDate){
  const start = new Date((fromDate || new Date().toISOString().slice(0,10)) + 'T12:00:00');
  const end = new Date(start); end.setDate(end.getDate()+30);
  const items = [];
  (rows || []).forEach(sc => {
    let next = new Date((sc.start_date || fromDate) + 'T12:00:00');
    if (Number.isNaN(next.getTime())) return;
    while (next < start) next = _aiAdvanceSchedule(next, sc.frequency, sc.custom_interval, sc.custom_unit);
    let guard = 0;
    while (next <= end && guard < 10) {
      const key = next.toISOString().slice(0,10);
      const already = (sc.occurrences || []).some(o => o.scheduled_date === key && (o.execution_status === 'executed' || o.transaction_id));
      if (!already) items.push({ date:key, description:sc.description, type:sc.type, amount:Number(sc.amount || 0), payee:sc.payees?.name || null, category:sc.categories?.name || null, account:sc.accounts?.name || null });
      next = _aiAdvanceSchedule(next, sc.frequency, sc.custom_interval, sc.custom_unit); guard++;
      if (sc.end_date && key >= sc.end_date) break;
      if (sc.frequency === 'once') break;
    }
  });
  const total = items.reduce((s,x)=>s + (x.type === 'income' ? 0 : Math.abs(Number(x.amount||0))), 0);
  return { count: items.length, expected_expenses_next_30d: total, upcoming_items: items.sort((a,b)=>a.date.localeCompare(b.date)).slice(0,12) };
}
function _aiAdvanceSchedule(date, frequency, customInterval, customUnit){ const d = new Date(date); if (frequency === 'weekly') d.setDate(d.getDate()+7); else if (frequency === 'biweekly') d.setDate(d.getDate()+14); else if (frequency === 'monthly') d.setMonth(d.getMonth()+1); else if (frequency === 'bimonthly') d.setMonth(d.getMonth()+2); else if (frequency === 'quarterly') d.setMonth(d.getMonth()+3); else if (frequency === 'semiannual') d.setMonth(d.getMonth()+6); else if (frequency === 'annual') d.setFullYear(d.getFullYear()+1); else if (frequency === 'custom') { const inc = Number(customInterval || 1); if (customUnit === 'weeks') d.setDate(d.getDate() + inc*7); else if (customUnit === 'months') d.setMonth(d.getMonth()+inc); else if (customUnit === 'years') d.setFullYear(d.getFullYear()+inc); else d.setDate(d.getDate()+inc); } else d.setDate(d.getDate()+3650); return d; }

function _aiBuildFallbackAnalysis(ctx){
  const topCats = ctx.spending_by_category.slice(0,3).map(c => `${c.name} (${_aiFormatCurrency(c.total)})`);
  const topMembers = ctx.spending_by_member.slice(0,3).map(m => `${m.name} (${_aiFormatCurrency(m.total)})`);
  const savingsSignal = ctx.totals.net_result >= 0 ? 'green' : 'red';
  return {
    executive_summary:[`A família registrou ${_aiFormatCurrency(ctx.totals.total_income)} em receitas e ${_aiFormatCurrency(ctx.totals.total_expenses)} em despesas no período.`, `O resultado líquido foi ${_aiFormatCurrency(ctx.totals.net_result)} e o peso maior ficou em ${topCats.join(', ')}.`],
    family_overview:{ total_income:ctx.totals.total_income, total_expenses:ctx.totals.total_expenses, net_result:ctx.totals.net_result, top_categories:ctx.spending_by_category.slice(0,5), top_payees:ctx.top_payees.slice(0,5), savings_signal:savingsSignal },
    member_spending_insights:ctx.spending_by_member.slice(0,6).map(m => ({ member_name:m.name, total_spent:m.total, top_categories:ctx.spending_by_category.slice(0,2).map(c=>c.name), trend_summary:'Leitura baseada no período atual.', notable_patterns:[`${m.name} aparece entre os principais centros de gasto do período.`] })),
    category_insights:ctx.spending_by_category.slice(0,6).map(c => ({ category:c.name, total:c.total, summary:`Categoria entre as maiores pressões do orçamento.` })),
    income_insights:ctx.income_summary.slice(0,5),
    key_insights:[`Maiores categorias: ${topCats.join(', ')}.`,`Distribuição por membro: ${topMembers.join(', ')}.`],
    anomalies:ctx.unusual_spending_candidates.slice(0,5).map(a => ({ title:a.description, detail:`Valor fora do padrão recente: ${_aiFormatCurrency(a.amount)} em ${a.date}.` })),
    opportunities_to_save:ctx.spending_by_category.slice(0,3).map(c => ({ title:`Revisar ${c.name}`, detail:`Categoria relevante no período com ${_aiFormatCurrency(c.total)}.` })),
    cashflow_alerts:ctx.scheduled_transactions_summary.upcoming_items.slice(0,4).map(i => ({ title:i.description, detail:`Previsto para ${i.date} · ${_aiFormatCurrency(Math.abs(i.amount || 0))}` })),
    category_trends:ctx.monthly_trend,
    recommended_actions:[{ title:'Revisar as 3 maiores categorias', detail:'Elas concentram a maior alavanca de economia.' }],
    chart_recommendations:[{ type:'line', key:'monthly_trend' },{ type:'donut', key:'spending_by_category' },{ type:'bar', key:'top_payees' },{ type:'bar', key:'spending_by_member' }],
    classification_suggestions:ctx.classification_suggestions_seed,
    contextual_patterns:{ recurring_merchants:ctx.contextual_signals.recurring_merchants, household_spending_clusters:ctx.contextual_signals.household_spending_clusters, personal_spending_clusters:ctx.spending_by_member.slice(0,4), potential_duplicate_merchant_labels:ctx.contextual_signals.duplicate_merchant_labels, category_inconsistencies:ctx.contextual_signals.category_inconsistencies, unusual_transactions:ctx.contextual_signals.unusual_transactions }
  };
}

async function _aiRunGeminiAnalysis(ctx){
  const prompt = `Você é um analista financeiro familiar. Use SOMENTE os valores calculados abaixo como verdade factual. Não recalcule balanços diferentes, não invente números e não altere a verdade do app. Gere apenas JSON válido.\n\nRETORNE este schema: {"executive_summary":[string],"family_overview":{"total_income":number,"total_expenses":number,"net_result":number,"top_categories":[{"name":string,"total":number}],"top_payees":[{"name":string,"total":number}],"savings_signal":"green|yellow|red"},"member_spending_insights":[{"member_name":string,"total_spent":number,"top_categories":[string],"trend_summary":string,"notable_patterns":[string]}],"category_insights":[{"category":string,"total":number,"summary":string}],"income_insights":[{"name":string,"total":number}],"key_insights":[string],"anomalies":[{"title":string,"detail":string}],"opportunities_to_save":[{"title":string,"detail":string}],"cashflow_alerts":[{"title":string,"detail":string}],"category_trends":[{"month":string,"income":number,"expenses":number,"net":number}],"recommended_actions":[{"title":string,"detail":string}],"chart_recommendations":[{"type":string,"key":string}],"classification_suggestions":[{"transaction_id":string,"current_category":string,"suggested_category":string,"suggested_subcategory":string,"normalized_payee":string,"likely_purpose":string,"confidence":number,"explanation":string}],"contextual_patterns":{"recurring_merchants":[object],"household_spending_clusters":[string],"personal_spending_clusters":[object],"potential_duplicate_merchant_labels":[object],"category_inconsistencies":[object],"unusual_transactions":[object]}}\n\nRegras:\n- texto curto, executivo e claro\n- se a evidência for fraca, diga isso nos detalhes\n- mantenha os números exatamente como vieram\n- classification_suggestions deve ser consultivo\n- savings_signal: green para situação confortável, yellow para atenção, red para pressão\n\nCONTEXTO JSON:\n${JSON.stringify(ctx)}`;
  return await window.AICore.generateJSON({ prompt, temperature:0.2, maxOutputTokens:4096 });
}

function _aiRenderAnalysis(payload){
  const analysis = payload.analysis, ctx = payload.context;
  const cards = [
    { label:'Receitas', value:_aiFormatCurrency(analysis.family_overview.total_income), meta:'Dado factual do app', kind:'fact' },
    { label:'Despesas', value:_aiFormatCurrency(analysis.family_overview.total_expenses), meta:'Dado factual do app', kind:'fact' },
    { label:'Resultado líquido', value:_aiFormatCurrency(analysis.family_overview.net_result), meta:'Saldo do período', kind:'fact' },
    { label:'Semáforo financeiro', value: analysis.family_overview.savings_signal === 'green' ? '🟢 Saudável' : analysis.family_overview.savings_signal === 'yellow' ? '🟡 Atenção' : '🔴 Pressão', meta:'Interpretação assistida por IA', kind:'ai' },
  ];
  document.getElementById('aiiSummaryCards').innerHTML = cards.map(c => `<div class="aii-summary-card"><div class="aii-summary-label">${c.label}</div><div class="aii-summary-value">${c.value}</div><div class="aii-summary-meta"><span class="aii-pill ${c.kind==='fact'?'aii-pill-fact':'aii-pill-ai'}">${c.kind==='fact'?'Sistema':'IA'}</span> ${c.meta}</div></div>`).join('');
  document.getElementById('aiiExecutiveSummary').innerHTML = (analysis.executive_summary || []).map(line => `<div class="aii-line">${_aiSafeText(line)}</div>`).join('') || '<div class="aii-line">Sem resumo suficiente para este filtro.</div>';
  _aiRenderBulletList('aiiKeyInsights', analysis.key_insights || [], 'ai');
  _aiRenderBulletList('aiiSavingsList', (analysis.opportunities_to_save || []).map(x => `${x.title}: ${x.detail}`), 'ai');
  _aiRenderBulletList('aiiCashflowAlerts', (analysis.cashflow_alerts || []).map(x => `${x.title}: ${x.detail}`), 'warn');
  const patterns = [];
  (analysis.contextual_patterns?.household_spending_clusters || []).forEach(x => patterns.push(`Cluster doméstico: ${x}`));
  (analysis.contextual_patterns?.potential_duplicate_merchant_labels || []).slice(0,5).forEach(x => patterns.push(`Possíveis rótulos duplicados: ${(x.variants || []).join(', ')}`));
  _aiRenderBulletList('aiiPatterns', patterns, 'ai');
  _aiRenderClassificationSuggestions(analysis.classification_suggestions || []);
  _aiRenderChart('aiiTrendChart', 'line', analysis.category_trends || ctx.monthly_trend || [], { labels: 'month', datasets:[{ label:'Receitas', key:'income' },{ label:'Despesas', key:'expenses' },{ label:'Net', key:'net' }] });
  _aiRenderChart('aiiCategoryChart', 'doughnut', analysis.family_overview.top_categories || ctx.spending_by_category.slice(0,6), { labels:'name', datasets:[{ label:'Categorias', key:'total' }] });
  _aiRenderChart('aiiMemberChart', 'bar', (analysis.member_spending_insights || []).map(m => ({ name:m.member_name, total:m.total_spent })), { labels:'name', datasets:[{ label:'Membros', key:'total' }] });
  _aiRenderChart('aiiPayeeChart', 'bar', analysis.family_overview.top_payees || ctx.top_payees.slice(0,6), { labels:'name', datasets:[{ label:'Beneficiários', key:'total' }] });
  if (analysis._aiFallbackReason) {
    const el = document.getElementById('aiiKeyInsights');
    el.insertAdjacentHTML('afterbegin', `<div class="aii-bullet"><span class="aii-pill aii-pill-warn">Fallback</span> A resposta da IA não foi usada e o módulo exibiu uma leitura local: ${_aiSafeText(analysis._aiFallbackReason)}</div>`);
  }
}

function _aiRenderBulletList(id, items, kind='ai'){ const el = document.getElementById(id); if (!el) return; el.innerHTML = (items && items.length ? items : ['Sem destaques suficientes para este recorte.']).map(item => `<div class="aii-bullet"><span class="aii-pill ${kind==='warn'?'aii-pill-warn':kind==='fact'?'aii-pill-fact':'aii-pill-ai'}">${kind==='fact'?'Sistema':kind==='warn'?'Atenção':'IA'}</span> ${_aiSafeText(typeof item === 'string' ? item : JSON.stringify(item))}</div>`).join(''); }
function _aiRenderClassificationSuggestions(items){ const el=document.getElementById('aiiClassSuggestions'); if(!el) return; if(!items?.length){ el.innerHTML='<div class="aii-line">Nenhuma sugestão consultiva relevante.</div>'; return; } el.innerHTML = `<div class="aii-cls-table">${items.slice(0,8).map(x => `<div class="aii-cls-row"><div class="aii-cls-top"><span>${_aiSafeText(x.current_category || 'Sem categoria')} → ${_aiSafeText(x.suggested_category || '—')}</span><span>${Math.round((Number(x.confidence||0))*100)}%</span></div><div class="aii-cls-sub">${_aiSafeText(x.explanation || '')}</div></div>`).join('')}</div>`; }
function _aiDestroyChart(id){ const c = window._aiInsights.charts[id]; if (c) { try { c.destroy(); } catch(_){} delete window._aiInsights.charts[id]; } }
function _aiRenderChart(id, type, rows, cfg){ const cv=document.getElementById(id); if(!cv || typeof Chart==='undefined') return; _aiDestroyChart(id); const labels=(rows||[]).map(r=>r[cfg.labels]); const datasets=(cfg.datasets||[]).map(ds => ({ label: ds.label, data: (rows||[]).map(r => Number(r[ds.key] || 0)), borderWidth:2, fill:type==='line'?false:true })); window._aiInsights.charts[id] = new Chart(cv.getContext('2d'), { type, data:{ labels, datasets }, options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:true, position:'top' } }, scales: type==='doughnut'?{}:{ y:{ beginAtZero:true } } } }); }

function _aiRenderSuggestedQuestions(){ const el=document.getElementById('aiiSuggestedQuestions'); if(!el) return; const qs=['Por que esta família gastou mais neste período?','Quais categorias mais cresceram?','Quem gastou mais e em quê?','Quais despesas parecem fora do padrão?','Quanto a família deve gastar nos próximos 30 dias?']; el.innerHTML = qs.map(q => `<button class="aii-chip" onclick="askAIInsightsSuggested(${JSON.stringify(q)})">${_aiSafeText(q)}</button>`).join(''); }
function askAIInsightsSuggested(q){ document.getElementById('aiiChatInput').value = q; setAIInsightsTab('chat'); sendAIInsightsChat(); }
function _aiRenderChatHistory(key){ const list = document.getElementById('aiiChatMessages'); if (!list) return; const history = window._aiInsights.chatByContext[key] || []; list.innerHTML = history.length ? history.map(m => `<div class="aii-msg ${m.role==='user'?'aii-msg-user':'aii-msg-ai'}">${_aiSafeText(m.text).replace(/\n/g,'<br>')}${m.meta ? `<div class="aii-msg-meta">${_aiSafeText(m.meta)}</div>`:''}</div>`).join('') : '<div class="aii-msg aii-msg-ai">Faça uma pergunta sobre receitas, despesas, membros, categorias ou próximas obrigações.</div>'; list.scrollTop = list.scrollHeight; }
function resetAIInsightsChat(){ const key = _aiContextKey(_aiReadFilters()); window._aiInsights.chatByContext[key] = []; _aiRenderChatHistory(key); }
async function sendAIInsightsChat(){ const flags = await getFamilyAIFlags(); if (!flags.chat) { toast('AI Chat desativado para esta família.', 'warning'); return; } const input = document.getElementById('aiiChatInput'); const q = (input?.value || '').trim(); if (!q) return; const key = _aiContextKey(_aiReadFilters()); const history = window._aiInsights.chatByContext[key] = window._aiInsights.chatByContext[key] || []; history.push({ role:'user', text:q }); _aiRenderChatHistory(key); input.value=''; const payload = window._aiInsights.cache[key] || null; const btn = document.getElementById('aiiChatSendBtn'); if (btn) btn.disabled = true; try { const answer = await _aiRunGeminiChat(q, payload); history.push({ role:'ai', text:answer.answer || 'Sem resposta.', meta: `Base factual: ${answer.factual_basis || 'contexto carregado'} · ${answer.evidence_strength || 'média evidência'}` }); if (answer.follow_ups?.[0]) history.push({ role:'ai', text:`Sugestão: ${answer.follow_ups[0]}`, meta:'próxima pergunta' }); } catch (e) { history.push({ role:'ai', text:`Não consegui responder com a IA agora. ${e.message}`, meta:'fallback' }); } finally { if (btn) btn.disabled = false; _aiRenderChatHistory(key); } }
async function _aiRunGeminiChat(question, payload){ if (!payload) throw new Error('Contexto ainda não carregado.'); const shortHistory = (window._aiInsights.chatByContext[_aiContextKey(_aiReadFilters())] || []).slice(-6); const prompt = `Você é um assistente financeiro familiar no app. Responda em português, com clareza e concisão. Use somente os fatos do CONTEXTO. Nunca invente saldos. Distinga dados factuais da interpretação. Retorne JSON válido: {"answer":string,"factual_basis":string,"evidence_strength":"forte|media|fraca","follow_ups":[string]}\n\nPERGUNTA: ${question}\n\nHISTÓRICO: ${JSON.stringify(shortHistory)}\n\nCONTEXTO: ${JSON.stringify(payload.context)}\n\nANÁLISE ATUAL: ${JSON.stringify(payload.analysis)}`; return await window.AICore.generateJSON({ prompt, temperature:0.2, maxOutputTokens:1500 }); }

function exportAIInsightsSummary(){ const key = _aiContextKey(_aiReadFilters()); const payload = window._aiInsights.cache[key]; if (!payload) { toast('Nenhuma análise carregada.', 'warning'); return; } const lines = []; lines.push('AI Insights'); lines.push(''); (payload.analysis.executive_summary || []).forEach(x => lines.push('- ' + x)); lines.push(''); lines.push(`Receitas: ${_aiFormatCurrency(payload.analysis.family_overview.total_income)}`); lines.push(`Despesas: ${_aiFormatCurrency(payload.analysis.family_overview.total_expenses)}`); lines.push(`Resultado líquido: ${_aiFormatCurrency(payload.analysis.family_overview.net_result)}`); const blob = new Blob([lines.join('\n')], { type:'text/plain;charset=utf-8' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `ai-insights-${famId() || 'family'}.txt`; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000); }
