/* ═══════════════════════════════════════════════════════════════════════════
   SETUP WIZARD — Family FinTrack — v2
   ─────────────────────────────────────────────────────────────────────────
   Step  1 — Bem-vindo / Nome da família
   Step  2 — Perfil / Sugestão (2 presets de categorias)
   Step  3 — Membros da família
   Step  4 — Renda mensal
   Step  5 — Categorias (auto-create com presets)
   Step  6 — Criar contas
   Step  7 — Sonhos & Metas
   Step  8 — Telegram Bot
   Step  9 — Módulos opcionais
   Step 10 — Concluído 🎉

   Persistência: localStorage 'fft_wz_draft' — resume automático.
   Pular etapa: botão "Pular" em cada step 2–9.
   Abandonar:  botão "Continuar depois" — salva rascunho e fecha.
═══════════════════════════════════════════════════════════════════════════ */

const WZ_TOTAL   = 10;
const WZ_LS_KEY  = 'fft_wz_draft';

// ── Presets de categorias ─────────────────────────────────────────────────
const WZ_PRESETS = {
  familia: {
    label:    'Família Brasileira',
    emoji:    '👨‍👩‍👧‍👦',
    desc:     'Moradia, escola, saúde, supermercado, transporte e lazer — o essencial para uma família completa.',
    color:    '#2a6049',
    groups: [
      { name:'Moradia',        icon:'🏠', color:'#c2410c', type:'expense', children:[
        { name:'Aluguel',        icon:'🏠', color:'#c2410c' },
        { name:'Condomínio',     icon:'🏢', color:'#c2410c' },
        { name:'Água',           icon:'💧', color:'#0891b2' },
        { name:'Energia',        icon:'⚡', color:'#f59e0b' },
        { name:'Gás',            icon:'🔥', color:'#f97316' },
        { name:'Manutenção',     icon:'🔧', color:'#6b7280' },
      ]},
      { name:'Alimentação',    icon:'🛒', color:'#16a34a', type:'expense', children:[
        { name:'Supermercado',   icon:'🛒', color:'#16a34a' },
        { name:'Feira',          icon:'🥬', color:'#15803d' },
        { name:'Padaria/Café',   icon:'☕', color:'#92400e' },
        { name:'Restaurante',    icon:'🍽️', color:'#b45309' },
        { name:'Delivery',       icon:'🛵', color:'#ef4444' },
      ]},
      { name:'Transporte',     icon:'🚗', color:'#7c3aed', type:'expense', children:[
        { name:'Combustível',    icon:'⛽', color:'#7c3aed' },
        { name:'Uber/Táxi',      icon:'🚕', color:'#6d28d9' },
        { name:'Ônibus/Metrô',   icon:'🚌', color:'#5b21b6' },
        { name:'Estacionamento', icon:'🅿️', color:'#4c1d95' },
        { name:'Manutenção Auto',icon:'🔧', color:'#6b7280' },
        { name:'IPVA/Seguro',    icon:'📋', color:'#374151' },
      ]},
      { name:'Saúde',          icon:'💊', color:'#dc2626', type:'expense', children:[
        { name:'Plano de Saúde', icon:'🏥', color:'#dc2626' },
        { name:'Consultas',      icon:'👨‍⚕️', color:'#ef4444' },
        { name:'Farmácia',       icon:'💊', color:'#f87171' },
        { name:'Academia',       icon:'🏋️', color:'#16a34a' },
      ]},
      { name:'Educação',       icon:'🎓', color:'#1d4ed8', type:'expense', children:[
        { name:'Escola/Facul',   icon:'🏫', color:'#1d4ed8' },
        { name:'Material Escolar',icon:'✏️', color:'#2563eb' },
        { name:'Cursos Online',  icon:'💻', color:'#3b82f6' },
      ]},
      { name:'Lazer',          icon:'🎭', color:'#be185d', type:'expense', children:[
        { name:'Streaming',      icon:'📺', color:'#be185d' },
        { name:'Cinema/Teatro',  icon:'🎬', color:'#9d174d' },
        { name:'Games',          icon:'🎮', color:'#7e22ce' },
        { name:'Viagens',        icon:'✈️', color:'#0891b2' },
      ]},
      { name:'Vestuário',      icon:'👔', color:'#0891b2', type:'expense', children:[
        { name:'Roupas',         icon:'👕', color:'#0891b2' },
        { name:'Calçados',       icon:'👟', color:'#0369a1' },
      ]},
      { name:'Pets',           icon:'🐾', color:'#84cc16', type:'expense', children:[
        { name:'Ração/Pet Shop', icon:'🐕', color:'#84cc16' },
        { name:'Veterinário',    icon:'🏥', color:'#65a30d' },
      ]},
      { name:'Assinaturas',    icon:'📱', color:'#6d28d9', type:'expense', children:[
        { name:'Internet/TV',    icon:'📡', color:'#6d28d9' },
        { name:'Celular',        icon:'📱', color:'#7c3aed' },
        { name:'Software/SaaS',  icon:'💾', color:'#8b5cf6' },
        { name:'Spotify',        icon:'🎵', color:'#1db954' },
        { name:'Netflix',        icon:'🎬', color:'#e50914' },
      ]},
      { name:'Impostos',       icon:'📋', color:'#374151', type:'expense', children:[
        { name:'IPTU',           icon:'🏠', color:'#374151' },
        { name:'IPVA',           icon:'🚗', color:'#4b5563' },
        { name:'IR',             icon:'📄', color:'#6b7280' },
      ]},
      { name:'Salário',        icon:'💼', color:'#16a34a', type:'income' },
      { name:'Renda Extra',    icon:'💡', color:'#2a6049', type:'income' },
      { name:'Dividendos',     icon:'📈', color:'#0891b2', type:'income' },
    ],
  },

  casal: {
    label:    'Solteiro / Casal Moderno',
    emoji:    '👫',
    desc:     'Foco em experiências, tecnologia e bem-estar — menos categorias, mais flexíveis.',
    color:    '#0891b2',
    groups: [
      { name:'Moradia',        icon:'🏠', color:'#c2410c', type:'expense', children:[
        { name:'Aluguel',        icon:'🏠', color:'#c2410c' },
        { name:'Água',           icon:'💧', color:'#0891b2' },
        { name:'Energia',        icon:'⚡', color:'#f59e0b' },
        { name:'Internet/TV',    icon:'📡', color:'#6d28d9' },
        { name:'Gás',            icon:'🔥', color:'#f97316' },
      ]},
      { name:'Alimentação',    icon:'🍽️', color:'#16a34a', type:'expense', children:[
        { name:'Supermercado',   icon:'🛒', color:'#16a34a' },
        { name:'Restaurante/Bar',icon:'🍻', color:'#b45309' },
        { name:'Delivery',       icon:'🛵', color:'#ef4444' },
        { name:'Cafés',          icon:'☕', color:'#92400e' },
      ]},
      { name:'Transporte',     icon:'🚌', color:'#7c3aed', type:'expense', children:[
        { name:'Uber/App',       icon:'🚕', color:'#7c3aed' },
        { name:'Metrô/Ônibus',   icon:'🚌', color:'#6d28d9' },
        { name:'Combustível',    icon:'⛽', color:'#5b21b6' },
      ]},
      { name:'Saúde & Bem-estar',icon:'💪', color:'#dc2626', type:'expense', children:[
        { name:'Academia',       icon:'🏋️', color:'#16a34a' },
        { name:'Consultas',      icon:'👨‍⚕️', color:'#dc2626' },
        { name:'Farmácia',       icon:'💊', color:'#ef4444' },
        { name:'Beleza',         icon:'💅', color:'#be185d' },
      ]},
      { name:'Estilo',         icon:'👗', color:'#0891b2', type:'expense', children:[
        { name:'Roupas/Calçados',icon:'👕', color:'#0891b2' },
        { name:'Cosméticos',     icon:'🧴', color:'#0369a1' },
      ]},
      { name:'Lazer & Cultura',icon:'🎯', color:'#be185d', type:'expense', children:[
        { name:'Streaming',      icon:'📺', color:'#be185d' },
        { name:'Bares/Eventos',  icon:'🍻', color:'#9d174d' },
        { name:'Viagens',        icon:'✈️', color:'#0891b2' },
        { name:'Esportes/Hobbies',icon:'⚽', color:'#16a34a' },
      ]},
      { name:'Tech & Digital',  icon:'💻', color:'#6d28d9', type:'expense', children:[
        { name:'Assinaturas',    icon:'📱', color:'#6d28d9' },
        { name:'Equipamentos',   icon:'🖥️', color:'#7c3aed' },
        { name:'Jogos',          icon:'🎮', color:'#8b5cf6' },
      ]},
      { name:'Desenvolvimento', icon:'📚', color:'#1d4ed8', type:'expense', children:[
        { name:'Cursos Online',  icon:'💻', color:'#1d4ed8' },
        { name:'Livros',         icon:'📖', color:'#2563eb' },
      ]},
      { name:'Salário',        icon:'💼', color:'#16a34a', type:'income' },
      { name:'Freelance',      icon:'🔧', color:'#0891b2', type:'income' },
      { name:'Investimentos',  icon:'📈', color:'#2a6049', type:'income' },
    ],
  },
};

// ── State ─────────────────────────────────────────────────────────────────
const _wz = {
  step:         1,
  familyName:   '',
  preset:       null,      // 'familia' | 'casal' | 'custom'
  adults:       [],
  children:     [],
  income:       0,
  incomeType:   'monthly',
  expenses:     [],        // custom expense chips (step 5 custom mode)
  modules:      { prices: false, investments: false, debts: false, aiInsights: false, dreams: false, loyalty: false, scheduled: false },
  dreams:       [],        // [{title, target, deadline}]
  hasTelegram:  false,
  creatingFamily: false,
};

// ── localStorage persistence ───────────────────────────────────────────────
function _wzSaveDraft() {
  try {
    localStorage.setItem(WZ_LS_KEY, JSON.stringify({
      step:       _wz.step,
      familyName: _wz.familyName,
      preset:     _wz.preset,
      adults:     _wz.adults,
      children:   _wz.children,
      income:     _wz.income,
      expenses:   _wz.expenses,
      modules:    _wz.modules,
      dreams:     _wz.dreams,
      savedAt:    Date.now(),
    }));
  } catch(_) {}
}

function _wzLoadDraft() {
  try {
    const raw = localStorage.getItem(WZ_LS_KEY);
    if (!raw) return false;
    const d = JSON.parse(raw);
    // Discard if older than 30 days
    if (Date.now() - (d.savedAt || 0) > 30 * 86400000) { localStorage.removeItem(WZ_LS_KEY); return false; }
    Object.assign(_wz, d);
    return true;
  } catch(_) { return false; }
}

function _wzClearDraft() {
  try { localStorage.removeItem(WZ_LS_KEY); } catch(_) {}
}

// ── Trigger check ─────────────────────────────────────────────────────────
async function _wizardShouldShow() {
  try {
    if (!currentUser?.can_admin && currentUser?.role !== 'owner') return false;
    const dismissed = await getAppSetting('wizard_dismissed', false);
    if (dismissed) return false;
    const { count: txCount } = await famQ(sb.from('transactions').select('id', { count:'exact', head:true }));
    if ((txCount || 0) > 0) { await saveAppSetting('wizard_dismissed', true); return false; }
    const hasAccounts = (state.accounts || []).length > 0;
    const hasCats     = (state.categories || []).length > 0;
    if (hasAccounts && hasCats) return false;
    return true;
  } catch(e) { console.warn('[Wizard]', e.message); return false; }
}

// ── Public API ────────────────────────────────────────────────────────────
async function initWizard() {
  const show = await _wizardShouldShow();
  if (show) _wzOpen();
}

async function openWizardManual() {
  _wzReset();
  await saveAppSetting('wizard_dismissed', false).catch(() => {});
  _wzOpen();
}

async function openWizardForNewUser() {
  _wzReset();
  _wz.creatingFamily = true;
  _wz.familyName = currentUser?.name ? currentUser.name + "'s Family" : '';
  await saveAppSetting('wizard_dismissed', false).catch(() => {});
  window._wzNeedsBoot = true;
  _wzOpen();
}

function _wzReset() {
  _wzClearDraft();
  Object.assign(_wz, {
    step:1, familyName:'', preset:null, adults:[], children:[],
    income:0, incomeType:'monthly', expenses:[],
    modules:{ prices:false, investments:false, debts:false, aiInsights:false, dreams:false, loyalty:false, scheduled:false },
    dreams:[], hasTelegram:false, creatingFamily:false,
  });
}

function _wzOpen() {
  // Attempt to restore draft
  const hadDraft = _wzLoadDraft();
  const el = document.getElementById('wizardOverlay');
  if (el) { el.style.display = 'flex'; _wzRenderStep(); }
  if (hadDraft && _wz.step > 1) {
    setTimeout(() => toast(`Assistente retomado do passo ${_wz.step} ✔`, 'info'), 400);
  }
}

function _wzClose() {
  const el = document.getElementById('wizardOverlay');
  if (el) el.style.display = 'none';
}

async function _wzDismiss() {
  _wzSaveDraft();
  _wzClose();
  await saveAppSetting('wizard_dismissed', true).catch(() => {});
  toast('Assistente fechado. Retome quando quiser em Configurações → Família.', 'info');
}

async function _wzSaveAndClose() {
  _wzSaveDraft();
  _wzClose();
  toast('Rascunho salvo! Retome quando quiser em Configurações → Família. 💾', 'success');
}

// ── Render ────────────────────────────────────────────────────────────────
function _wzRenderStep() {
  _wzClearError();
  const body     = document.getElementById('wzBody');
  const progress = document.getElementById('wzProgress');
  const backBtn  = document.getElementById('wzBackBtn');
  const nextBtn  = document.getElementById('wzNextBtn');
  const skipBtn  = document.getElementById('wzSkipBtn');
  const title    = document.getElementById('wzTitle');
  const subtitle = document.getElementById('wzSubtitle');
  const dots     = document.querySelectorAll('.wz-dot');
  if (!body) return;

  const pct = ((_wz.step - 1) / (WZ_TOTAL - 1)) * 100;
  if (progress) progress.style.width = pct + '%';

  dots.forEach((d, i) => {
    d.classList.toggle('wz-dot--active', i + 1 === _wz.step);
    d.classList.toggle('wz-dot--done',   i + 1 < _wz.step);
  });

  if (backBtn) backBtn.style.display  = _wz.step > 1 && _wz.step < WZ_TOTAL ? '' : 'none';
  if (nextBtn) nextBtn.style.display  = _wz.step < WZ_TOTAL ? '' : 'none';
  if (nextBtn) nextBtn.textContent    = _wz.step === WZ_TOTAL - 1 ? '✅ Finalizar' : 'Continuar →';

  const isSkippable = _wz.step >= 2 && _wz.step <= WZ_TOTAL - 1;
  if (skipBtn) skipBtn.style.display = isSkippable ? '' : 'none';

  // Inject "Continuar depois" button in footer if not present
  let laterBtn = document.getElementById('wzLaterBtn');
  if (!laterBtn) {
    const footer = document.querySelector('.wz-footer');
    if (footer) {
      laterBtn = document.createElement('button');
      laterBtn.id = 'wzLaterBtn';
      laterBtn.className = 'btn btn-ghost';
      laterBtn.style.cssText = 'font-size:.75rem;color:var(--muted);margin-right:auto;order:-1';
      laterBtn.textContent = '💾 Continuar depois';
      laterBtn.onclick = _wzSaveAndClose;
      footer.prepend(laterBtn);
    }
  }
  if (laterBtn) laterBtn.style.display = _wz.step < WZ_TOTAL ? '' : 'none';

  switch (_wz.step) {
    case  1: return _wzStep1 (body, title, subtitle);
    case  2: return _wzStep2 (body, title, subtitle);
    case  3: return _wzStep3 (body, title, subtitle);
    case  4: return _wzStep4 (body, title, subtitle);
    case  5: return _wzStep5 (body, title, subtitle);
    case  6: return _wzStep6 (body, title, subtitle);
    case  7: return _wzStep7 (body, title, subtitle);
    case  8: return _wzStep8 (body, title, subtitle);
    case  9: return _wzStep9 (body, title, subtitle);
    case 10: return _wzStep10(body, title, subtitle);
  }
}

function _wzNext() {
  if (!_wzValidateStep()) return;
  if (_wz.step < WZ_TOTAL) { _wz.step++; _wzSaveDraft(); _wzRenderStep(); }
}
function _wzBack() {
  if (_wz.step > 1) { _wz.step--; _wzSaveDraft(); _wzRenderStep(); }
}
function _wzSkip() {
  if (_wz.step < WZ_TOTAL) { _wz.step++; _wzSaveDraft(); _wzRenderStep(); }
}

function _wzValidateStep() {
  if (_wz.step === 1) {
    const name = document.getElementById('wzFamilyName')?.value.trim();
    if (!name) { _wzShowError('Informe o nome da família para continuar.'); return false; }
    _wz.familyName = name;
  }
  if (_wz.step === 3) { _wzCollectMembers(); }
  if (_wz.step === 4) {
    const v = parseFloat((document.getElementById('wzIncome')?.value||'0').replace(/\./g,'').replace(',','.'));
    _wz.income = isNaN(v) ? 0 : v;
    _wz.incomeType = document.getElementById('wzIncomeType')?.value || 'monthly';
  }
  if (_wz.step === 5) { _wzCollectCustomExpenses(); }
  _wzClearError();
  return true;
}

// ── Step 1: Nome da família ───────────────────────────────────────────────
function _wzStep1(body, title, subtitle) {
  if (title)    title.textContent    = 'Bem-vindo ao Family FinTrack! 👋';
  if (subtitle) subtitle.textContent = 'Vamos configurar tudo em poucos passos. Você pode pular ou retomar quando quiser.';
  body.innerHTML = `
    <div class="wz-field">
      <label class="wz-label">Como se chama sua família?</label>
      <input id="wzFamilyName" class="wz-input" type="text"
             placeholder="Ex.: Família Silva, Casa dos Ramos…"
             value="${esc(_wz.familyName)}" maxlength="60"
             oninput="_wz.familyName=this.value">
      <div class="wz-hint">Este nome aparece no dashboard e relatórios.</div>
      ${_wz.creatingFamily ? '<div class="wz-hint" style="margin-top:8px;padding:8px 10px;background:var(--accent-lt);border-radius:6px;color:var(--accent);font-weight:600">🔑 Você será o proprietário (Owner) desta família.</div>' : ''}
    </div>`;
  document.getElementById('wzFamilyName')?.focus();
}

// ── Step 2: Perfil / Sugestão ────────────────────────────────────────────
function _wzStep2(body, title, subtitle) {
  if (title)    title.textContent    = 'Qual o perfil da sua família? 🏠';
  if (subtitle) subtitle.textContent = 'Escolha um perfil para receber categorias prontas. Você poderá personalizar depois.';

  const cards = Object.entries(WZ_PRESETS).map(([key, p]) => {
    const sel = _wz.preset === key;
    return `
    <div onclick="_wzSelectPreset('${key}')" style="cursor:pointer;border:2px solid ${sel ? p.color : 'var(--border)'};border-radius:14px;padding:14px 16px;background:${sel ? p.color+'10' : 'var(--surface)'};transition:all .18s">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
        <span style="font-size:1.6rem">${p.emoji}</span>
        <div>
          <div style="font-weight:800;font-size:.92rem;color:${sel ? p.color : 'var(--text)'}">${p.label}</div>
          <div style="font-size:.65rem;color:var(--muted);font-weight:600">${p.groups.filter(g=>g.type==='expense').length} grupos de categorias · ${p.groups.reduce((s,g)=>s+(g.children?.length||0),0) + p.groups.filter(g=>!g.children).length} categorias no total</div>
        </div>
        <div style="margin-left:auto;width:22px;height:22px;border-radius:50%;border:2px solid ${sel ? p.color : 'var(--border)'};background:${sel ? p.color : 'transparent'};display:flex;align-items:center;justify-content:center;flex-shrink:0">
          ${sel ? '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
        </div>
      </div>
      <div style="font-size:.78rem;color:var(--muted);line-height:1.5">${p.desc}</div>
      <div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:10px">
        ${p.groups.slice(0,6).map(g=>`<span style="font-size:.65rem;padding:2px 7px;background:${g.color}14;color:${g.color};border-radius:20px;border:1px solid ${g.color}30">${g.icon} ${g.name}</span>`).join('')}
        ${p.groups.length > 6 ? `<span style="font-size:.65rem;color:var(--muted)">+${p.groups.length-6} mais</span>` : ''}
      </div>
    </div>`;
  }).join('');

  body.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:10px">
      ${cards}
      <div onclick="_wzSelectPreset('custom')" style="cursor:pointer;border:2px solid ${_wz.preset==='custom' ? '#6b7280' : 'var(--border)'};border-radius:14px;padding:12px 16px;background:var(--surface);transition:all .18s;display:flex;align-items:center;gap:12px">
        <span style="font-size:1.3rem">⚙️</span>
        <div style="flex:1">
          <div style="font-weight:700;font-size:.88rem;color:var(--text)">Quero criar as minhas próprias</div>
          <div style="font-size:.72rem;color:var(--muted)">Selecione manualmente os gastos no próximo passo</div>
        </div>
        <div style="width:22px;height:22px;border-radius:50%;border:2px solid ${_wz.preset==='custom' ? '#6b7280' : 'var(--border)'};background:${_wz.preset==='custom' ? '#6b7280' : 'transparent'};display:flex;align-items:center;justify-content:center;flex-shrink:0">
          ${_wz.preset==='custom' ? '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
        </div>
      </div>
    </div>
    <div class="wz-hint" style="margin-top:10px;text-align:center">💡 As categorias são criadas automaticamente quando você finalizar o assistente.</div>`;
}

function _wzSelectPreset(key) {
  _wz.preset = key;
  _wzStep2(document.getElementById('wzBody'), null, null);
}
window._wzSelectPreset = _wzSelectPreset;

// ── Step 3: Membros ───────────────────────────────────────────────────────
const _RELATIONS = ['Cônjuge/Parceiro(a)','Filho(a)','Pai/Mãe','Irmão/Irmã','Avô/Avó','Outro'];

function _wzStep3(body, title, subtitle) {
  if (title)    title.textContent    = 'Quem faz parte da família? 👨‍👩‍👧‍👦';
  if (subtitle) subtitle.textContent = 'Adicione os membros para personalizar relatórios e orçamentos.';
  body.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
      <div>
        <div class="wz-section-label">👨‍👩 Adultos (18+)</div>
        <div id="wzAdultList" class="wz-member-list">${_wzRenderAdults()}</div>
        <button class="wz-add-btn" onclick="_wzAddAdult()">+ Adicionar adulto</button>
      </div>
      <div>
        <div class="wz-section-label">👶 Crianças</div>
        <div id="wzChildList" class="wz-member-list">${_wzRenderChildren()}</div>
        <button class="wz-add-btn" onclick="_wzAddChild()">+ Adicionar criança</button>
      </div>
    </div>
    <div style="margin-top:8px">
      <div class="wz-section-label" style="margin-bottom:6px">📨 Convidar por e-mail</div>
      <div id="wzInviteList">${_wzRenderInvites()}</div>
    </div>`;
}

function _wzRenderAdults() {
  if (!_wz.adults.length) return '<div class="wz-empty-list">Nenhum adulto adicionado</div>';
  return _wz.adults.map((a,i)=>`
    <div class="wz-member-chip">
      <span class="wz-member-emoji">👤</span>
      <div class="wz-member-info"><strong>${esc(a.name||'—')}</strong><span>${esc(a.relation||'')}</span></div>
      <button class="wz-remove-btn" onclick="_wzRemoveAdult(${i})">✕</button>
    </div>`).join('');
}
function _wzRenderChildren() {
  if (!_wz.children.length) return '<div class="wz-empty-list">Nenhuma criança adicionada</div>';
  return _wz.children.map((c,i)=>`
    <div class="wz-member-chip">
      <span class="wz-member-emoji">🧒</span>
      <div class="wz-member-info"><strong>${esc(c.name||'—')}</strong><span>${esc(c.relation||'')}</span></div>
      <button class="wz-remove-btn" onclick="_wzRemoveChild(${i})">✕</button>
    </div>`).join('');
}
function _wzRenderInvites() {
  const adults = _wz.adults.filter(a => a.name);
  if (!adults.length) return '<div class="wz-hint">Adicione adultos acima para convidá-los.</div>';
  return adults.map((a,i) => `
    <div class="wz-invite-row">
      <label class="wz-invite-toggle">
        <input type="checkbox" id="wzInv_${i}" ${a.invite?'checked':''} onchange="_wz.adults[${i}].invite=this.checked;document.getElementById('wzInvEmail_${i}').style.display=this.checked?'':'none'">
        <span class="wz-invite-name">👤 ${esc(a.name)}</span>
        <span class="wz-invite-rel">${esc(a.relation)}</span>
      </label>
      <input class="wz-input wz-invite-email" id="wzInvEmail_${i}" type="email"
             placeholder="e-mail para convite" value="${esc(a.email||'')}"
             style="display:${a.invite?'':'none'}"
             oninput="_wz.adults[${i}].email=this.value">
    </div>`).join('');
}

function _wzAddAdult() {
  _wzCollectMembers();
  const rel = _RELATIONS.map(r=>`<option>${r}</option>`).join('');
  _wz.adults.push({ name:'', relation:'Cônjuge/Parceiro(a)', invite:false, email:'' });
  const list = document.getElementById('wzAdultList');
  if (list) list.innerHTML = _wzRenderAdults() + `
    <div class="wz-member-form">
      <input class="wz-input" id="wzAdultName" placeholder="Nome" maxlength="50" style="margin-bottom:6px">
      <select class="wz-select" id="wzAdultRel">${rel}</select>
      <button class="wz-add-btn" style="margin-top:6px" onclick="_wzConfirmAdult()">Confirmar</button>
    </div>`;
  document.getElementById('wzAdultName')?.focus();
}
function _wzConfirmAdult() {
  const name = document.getElementById('wzAdultName')?.value.trim();
  const rel  = document.getElementById('wzAdultRel')?.value;
  if (!name) return;
  const last = _wz.adults[_wz.adults.length - 1];
  if (last) { last.name = name; last.relation = rel; }
  _wzStep3(document.getElementById('wzBody'), null, null);
}
function _wzRemoveAdult(i) {
  _wz.adults.splice(i,1);
  _wzStep3(document.getElementById('wzBody'), null, null);
}
function _wzAddChild() {
  _wzCollectMembers();
  const rel = ['Filho(a)','Neto(a)','Sobrinho(a)','Outro'].map(r=>`<option>${r}</option>`).join('');
  _wz.children.push({ name:'', relation:'Filho(a)' });
  const list = document.getElementById('wzChildList');
  if (list) list.innerHTML = _wzRenderChildren() + `
    <div class="wz-member-form">
      <input class="wz-input" id="wzChildName" placeholder="Nome" maxlength="50" style="margin-bottom:6px">
      <select class="wz-select" id="wzChildRel">${rel}</select>
      <button class="wz-add-btn" style="margin-top:6px" onclick="_wzConfirmChild()">Confirmar</button>
    </div>`;
  document.getElementById('wzChildName')?.focus();
}
function _wzConfirmChild() {
  const name = document.getElementById('wzChildName')?.value.trim();
  const rel  = document.getElementById('wzChildRel')?.value;
  if (!name) return;
  const last = _wz.children[_wz.children.length - 1];
  if (last) { last.name = name; last.relation = rel; }
  _wzStep3(document.getElementById('wzBody'), null, null);
}
function _wzRemoveChild(i) {
  _wz.children.splice(i,1);
  _wzStep3(document.getElementById('wzBody'), null, null);
}
function _wzCollectMembers() {
  _wz.adults   = _wz.adults.filter(a => a.name);
  _wz.children = _wz.children.filter(c => c.name);
}
window._wzAddAdult    = _wzAddAdult;
window._wzConfirmAdult= _wzConfirmAdult;
window._wzRemoveAdult = _wzRemoveAdult;
window._wzAddChild    = _wzAddChild;
window._wzConfirmChild= _wzConfirmChild;
window._wzRemoveChild = _wzRemoveChild;

// ── Step 4: Renda mensal ─────────────────────────────────────────────────
function _wzStep4(body, title, subtitle) {
  if (title)    title.textContent    = 'Qual é a renda da família? 💰';
  if (subtitle) subtitle.textContent = 'Usaremos para sugerir orçamentos proporcionais. Você pode pular se preferir.';
  const fmtVal = _wz.income > 0 ? _wz.income.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}) : '';
  body.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:14px">
      <div class="wz-field">
        <label class="wz-label">Renda total mensal (R$)</label>
        <input id="wzIncome" class="wz-input" type="text" inputmode="decimal"
               placeholder="Ex.: 10.000,00" value="${fmtVal}"
               oninput="_invFmtBalanceInput?_invFmtBalanceInput(this):null"
               style="font-size:1.1rem;font-weight:700">
      </div>
      <div class="wz-field">
        <label class="wz-label">Tipo de renda</label>
        <select id="wzIncomeType" class="wz-select" onchange="_wz.incomeType=this.value">
          <option value="monthly"  ${_wz.incomeType==='monthly' ?'selected':''}>💼 Mensal (assalariado)</option>
          <option value="variable" ${_wz.incomeType==='variable'?'selected':''}>📊 Variável (autônomo/freelance)</option>
          <option value="mixed"    ${_wz.incomeType==='mixed'   ?'selected':''}>🔀 Mista (salário + extras)</option>
        </select>
      </div>
      <div style="background:rgba(42,96,73,.08);border:1px solid rgba(42,96,73,.2);border-radius:10px;padding:12px 14px">
        <div style="font-size:.78rem;color:var(--accent);font-weight:700;margin-bottom:6px">💡 Para que serve?</div>
        <div style="font-size:.75rem;color:var(--muted);line-height:1.6">
          Com a renda informada, o app consegue:<br>
          • Sugerir orçamentos por categoria<br>
          • Calcular sua taxa de poupança<br>
          • Alertar quando os gastos ultrapassam um % da renda
        </div>
      </div>
    </div>`;
}

// ── Step 5: Categorias ────────────────────────────────────────────────────
const _WZ_CUSTOM_EXPENSES = [
  { key:'moradia',     label:'Moradia',       emoji:'🏠', pct:0.30 },
  { key:'mercado',     label:'Supermercado',  emoji:'🛒', pct:0.15 },
  { key:'transporte',  label:'Transporte',    emoji:'🚗', pct:0.12 },
  { key:'saude',       label:'Saúde',         emoji:'💊', pct:0.10 },
  { key:'educacao',    label:'Educação',      emoji:'🎓', pct:0.08 },
  { key:'lazer',       label:'Lazer',         emoji:'🎭', pct:0.07 },
  { key:'restaurante', label:'Restaurantes',  emoji:'🍽️', pct:0.06 },
  { key:'assinaturas', label:'Assinaturas',   emoji:'📱', pct:0.04 },
  { key:'vestuario',   label:'Vestuário',     emoji:'👔', pct:0.04 },
  { key:'pets',        label:'Pets',          emoji:'🐾', pct:0.02 },
  { key:'viagens',     label:'Viagens',       emoji:'✈️', pct:0.05 },
  { key:'festas',      label:'Festas',        emoji:'🎉', pct:0.03 },
];

function _wzStep5(body, title, subtitle) {
  const preset = _wz.preset;

  if (preset && preset !== 'custom') {
    const p = WZ_PRESETS[preset];
    if (title)    title.textContent    = `Categorias: ${p.label} ${p.emoji}`;
    if (subtitle) subtitle.textContent = 'As categorias abaixo serão criadas automaticamente ao finalizar.';
    body.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:6px;max-height:320px;overflow-y:auto;padding-right:4px">
        ${p.groups.map(g => `
          <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:10px 12px">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:${g.children?.length?'7px':'0'}">
              <span style="font-size:1rem">${g.icon}</span>
              <span style="font-size:.85rem;font-weight:700;color:${g.color}">${g.name}</span>
              <span style="font-size:.62rem;color:var(--muted);margin-left:auto">${g.type==='income'?'Receita':'Despesa'}</span>
            </div>
            ${g.children?.length ? `<div style="display:flex;flex-wrap:wrap;gap:4px">
              ${g.children.map(c=>`<span style="font-size:.65rem;padding:2px 7px;background:${c.color}14;color:${c.color};border-radius:20px;border:1px solid ${c.color}30">${c.icon} ${c.name}</span>`).join('')}
            </div>` : ''}
          </div>`).join('')}
      </div>
      <div class="wz-hint" style="margin-top:10px;text-align:center">
        ✅ ${p.groups.reduce((s,g)=>s+(g.children?.length||1),0)} categorias serão criadas &nbsp;·&nbsp;
        <a href="#" onclick="event.preventDefault();_wzSelectPreset('custom');_wzStep5(document.getElementById('wzBody'),document.getElementById('wzTitle'),document.getElementById('wzSubtitle'))" style="color:var(--accent)">Prefiro personalizar</a>
      </div>`;
    return;
  }

  // Custom mode
  if (title)    title.textContent    = 'Quais são seus principais gastos? 💸';
  if (subtitle) subtitle.textContent = 'Selecione e informe o valor mensal aproximado para criar orçamentos.';

  const selectedKeys = new Set(_wz.expenses.map(e => e.key));
  const monthly = _wz.income > 0 ? _wz.income : 0;

  body.innerHTML = `
    <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px">
      ${_WZ_CUSTOM_EXPENSES.map(opt => {
        const sel = selectedKeys.has(opt.key);
        const suggested = monthly > 0 ? Math.round(monthly * opt.pct / 50) * 50 : 0;
        return `
        <div class="wz-chip ${sel?'wz-chip--sel':''}" id="wzChip_${opt.key}"
             onclick="_wzToggleChip('${opt.key}','${esc(opt.label)}','${opt.emoji}',${suggested})"
             style="border:1.5px solid ${sel?'var(--accent)':'var(--border)'};background:${sel?'var(--accent-lt)':'var(--surface)'};border-radius:8px;padding:7px 11px;cursor:pointer;transition:all .15s;display:flex;align-items:center;gap:6px">
          <span>${opt.emoji}</span>
          <span style="font-size:.82rem;font-weight:600;color:${sel?'var(--accent)':'var(--text)'}">${opt.label}</span>
          ${sel ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
        </div>`;
      }).join('')}
    </div>
    ${_wz.expenses.length ? `
    <div style="display:flex;flex-direction:column;gap:8px;max-height:200px;overflow-y:auto">
      ${_wz.expenses.map((e,i) => `
        <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--surface2);border-radius:8px;border:1px solid var(--border)">
          <span>${e.emoji}</span>
          <span style="flex:1;font-size:.82rem;font-weight:600">${esc(e.label)}</span>
          <div style="display:flex;align-items:center;gap:4px">
            <span style="font-size:.75rem;color:var(--muted)">R$</span>
            <input type="text" inputmode="decimal"
                   value="${e.amount > 0 ? e.amount.toLocaleString('pt-BR',{minimumFractionDigits:0,maximumFractionDigits:0}) : ''}"
                   placeholder="0"
                   onchange="_wz.expenses[${i}].amount=parseFloat(this.value.replace(/\\./g,'').replace(',','.'))||0"
                   style="width:80px;text-align:right;font-weight:700;border:1px solid var(--border);border-radius:6px;padding:4px 6px;background:var(--surface);font-family:inherit;font-size:.82rem">
          </div>
        </div>`).join('')}
    </div>` : '<div class="wz-hint" style="text-align:center;padding:12px">Selecione os gastos acima para definir orçamentos.</div>'}`;
}

function _wzToggleChip(key, label, emoji, suggested) {
  const idx = _wz.expenses.findIndex(e => e.key === key);
  if (idx >= 0) {
    _wz.expenses.splice(idx, 1);
  } else {
    _wz.expenses.push({ key, label, emoji, amount: suggested });
  }
  _wzStep5(document.getElementById('wzBody'), document.getElementById('wzTitle'), document.getElementById('wzSubtitle'));
}
window._wzToggleChip = _wzToggleChip;

function _wzCollectCustomExpenses() {
  document.querySelectorAll('[id^="wzExpAmt_"]').forEach(el => {
    const key = el.id.replace('wzExpAmt_','');
    const exp = _wz.expenses.find(e => e.key === key);
    if (exp) exp.amount = parseFloat(el.value.replace(/\./g,'').replace(',','.')) || 0;
  });
}

// ── Step 6: Criar primeira conta ─────────────────────────────────────────
function _wzStep6(body, title, subtitle) {
  if (title)    title.textContent    = 'Crie sua primeira conta 🏦';
  if (subtitle) subtitle.textContent = 'Uma conta representa um banco, carteira ou cartão.';
  const hasAccs = (state.accounts||[]).length > 0;
  body.innerHTML = `
    <div class="wz-guide-card">
      ${hasAccs ? `<div style="background:rgba(22,163,74,.08);border:1px solid rgba(22,163,74,.2);border-radius:10px;padding:10px 14px;margin-bottom:12px;font-size:.82rem;color:#16a34a;font-weight:700">
        ✅ Você já tem ${(state.accounts||[]).length} conta(s) cadastrada(s). Pode continuar!
      </div>` : ''}
      <div class="wz-guide-steps">
        <div class="wz-guide-step">
          <span class="wz-guide-num">1</span>
          <div>Clique em <strong>Criar Conta</strong> abaixo</div>
        </div>
        <div class="wz-guide-step">
          <span class="wz-guide-num">2</span>
          <div>Escolha o tipo: <strong>Corrente, Cartão de Crédito, Poupança</strong> ou outro</div>
        </div>
        <div class="wz-guide-step">
          <span class="wz-guide-num">3</span>
          <div>Informe nome, banco e <strong>saldo atual</strong></div>
        </div>
        <div class="wz-guide-step">
          <span class="wz-guide-num">4</span>
          <div>Marque como <strong>⭐ Favorita</strong> para destaque no dashboard</div>
        </div>
      </div>
      <div class="wz-guide-tip">💡 Sugestão: comece pela conta corrente principal. Você pode adicionar cartões e investimentos depois.</div>
      <div style="display:flex;gap:10px;justify-content:center;margin-top:16px;flex-wrap:wrap">
        <button class="btn btn-primary" onclick="_wzOpenAccount()">🏦 Criar conta agora</button>
        ${hasAccs ? '' : '<button class="btn btn-ghost" onclick="_wzSkip()" style="font-size:.8rem">Pular por agora</button>'}
      </div>
    </div>`;
}

function _wzOpenAccount() {
  _wzClose();
  navigate('accounts');
  setTimeout(() => { if (typeof openAccountModal === 'function') openAccountModal(); }, 400);
  _wzWatchModalClose('accountModal', () => {
    _wzOpen();
    if ((state.accounts||[]).length > 0 && _wz.step === 6) {
      _wz.step = 7; _wzRenderStep();
    }
  });
}
window._wzOpenAccount = _wzOpenAccount;

// ── Step 7: Sonhos & Metas ───────────────────────────────────────────────
function _wzStep7(body, title, subtitle) {
  if (title)    title.textContent    = 'Quais são os sonhos da família? 🌟';
  if (subtitle) subtitle.textContent = 'Defina metas financeiras. O app vai acompanhar o progresso automaticamente.';

  const dreams = _wz.dreams;
  body.innerHTML = `
    <div style="margin-bottom:12px">
      <div id="wzDreamList" style="display:flex;flex-direction:column;gap:8px;margin-bottom:10px">
        ${dreams.length ? dreams.map((d,i) => `
          <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--surface2);border-radius:10px;border:1px solid var(--border)">
            <span style="font-size:1.2rem">🌟</span>
            <div style="flex:1;min-width:0">
              <div style="font-size:.84rem;font-weight:700;color:var(--text)">${esc(d.title)}</div>
              <div style="font-size:.7rem;color:var(--muted)">
                ${d.target > 0 ? 'Meta: R$ ' + d.target.toLocaleString('pt-BR') : 'Sem valor definido'}
                ${d.deadline ? ' · Prazo: ' + d.deadline : ''}
              </div>
            </div>
            <button onclick="_wzRemoveDream(${i})" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:1rem;padding:0">✕</button>
          </div>`).join('') : '<div class="wz-hint" style="text-align:center">Nenhum sonho adicionado ainda.</div>'}
      </div>
      <div id="wzDreamForm" style="background:var(--surface);border:1.5px dashed var(--border);border-radius:10px;padding:12px">
        <div style="font-size:.8rem;font-weight:700;color:var(--text);margin-bottom:8px">✨ Adicionar sonho</div>
        <input id="wzDreamTitle" class="wz-input" type="text" placeholder="Ex.: Viagem para Europa, Carro novo, Reserva de emergência…" style="margin-bottom:8px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div>
            <label class="wz-label" style="font-size:.72rem">Valor alvo (R$)</label>
            <input id="wzDreamTarget" class="wz-input" type="text" inputmode="decimal" placeholder="0,00">
          </div>
          <div>
            <label class="wz-label" style="font-size:.72rem">Prazo (mês/ano)</label>
            <input id="wzDreamDeadline" class="wz-input" type="month">
          </div>
        </div>
        <button class="btn btn-primary" style="width:100%;margin-top:10px;font-size:.82rem" onclick="_wzAddDream()">+ Adicionar sonho</button>
      </div>
    </div>
    <div class="wz-hint" style="text-align:center">💡 Você pode gerenciar seus sonhos detalhadamente no módulo <strong>Sonhos & Metas</strong>.</div>`;
}

function _wzAddDream() {
  const title    = document.getElementById('wzDreamTitle')?.value.trim();
  if (!title) { toast('Informe o nome do sonho', 'error'); return; }
  const targetRaw = document.getElementById('wzDreamTarget')?.value || '0';
  const target   = parseFloat(targetRaw.replace(/\./g,'').replace(',','.')) || 0;
  const deadline = document.getElementById('wzDreamDeadline')?.value || '';
  _wz.dreams.push({ title, target, deadline });
  _wzStep7(document.getElementById('wzBody'), null, null);
}
function _wzRemoveDream(i) {
  _wz.dreams.splice(i,1);
  _wzStep7(document.getElementById('wzBody'), null, null);
}
window._wzAddDream    = _wzAddDream;
window._wzRemoveDream = _wzRemoveDream;

// ── Step 8: Telegram Bot ─────────────────────────────────────────────────
function _wzStep8(body, title, subtitle) {
  if (title)    title.textContent    = 'Configure o bot do Telegram 🤖';
  if (subtitle) subtitle.textContent = 'Registre transações pelo Telegram com texto simples ou fotos de nota fiscal.';
  const hasTg = !!currentUser?.telegram_chat_id;
  body.innerHTML = `
    <div class="wz-guide-card">
      ${hasTg ? `<div style="background:rgba(22,163,74,.08);border:1px solid rgba(22,163,74,.2);border-radius:10px;padding:10px 14px;margin-bottom:12px;font-size:.82rem;color:#16a34a;font-weight:700">
        ✅ Telegram já vinculado! Chat ID: ${esc(String(currentUser.telegram_chat_id))}
      </div>` : ''}
      <div class="wz-guide-steps">
        <div class="wz-guide-step">
          <span class="wz-guide-num">1</span>
          <div>No app: <strong>Menu Avatar → Transações por Chat</strong></div>
        </div>
        <div class="wz-guide-step">
          <span class="wz-guide-num">2</span>
          <div>Ative o canal e clique em <strong>Vincular Telegram</strong></div>
        </div>
        <div class="wz-guide-step">
          <span class="wz-guide-num">3</span>
          <div>Abra o link gerado no Telegram — ele vincula sua conta automaticamente</div>
        </div>
        <div class="wz-guide-step">
          <span class="wz-guide-num">4</span>
          <div>Envie mensagens como <code>ifood 45</code> ou uma foto de nota fiscal</div>
        </div>
      </div>
      <div class="wz-guide-tip">💡 Exemplos: <em>"uber 32,50"</em> · <em>"salário 8000"</em> · 📷 Foto de cupom fiscal</div>
      <div style="text-align:center;margin-top:14px">
        <button class="btn btn-ghost" onclick="_wzGoTo('settings');_wzSkip()">⚙️ Ir para Configurações</button>
      </div>
    </div>`;
}

// ── Step 9: Módulos ───────────────────────────────────────────────────────
const _WZ_MODULE_DATA = [
  {
    key: 'dreams',
    icon: '🌟',
    color: '#f59e0b',
    bg: '#fef3c7',
    title: 'Sonhos & Metas',
    badge: 'Planejamento',
    desc: 'Defina objetivos financeiros com valor-alvo e prazo — viagem, carro, imóvel, reserva de emergência. O app calcula quanto guardar por mês, monitora seu progresso com barra visual e alerta quando você está no caminho certo.',
    bullets: ['Meta com valor e prazo definidos', 'Progresso automático a partir das economias', 'Wizard de criação com assistente IA'],
  },
  {
    key: 'investments',
    icon: '📈',
    color: '#16a34a',
    bg: '#dcfce7',
    title: 'Carteira de Investimentos',
    badge: 'Patrimônio',
    desc: 'Acompanhe ações (B3 e EUA), FIIs, ETFs, renda fixa, criptomoedas e fundos em um só lugar. Cotações automáticas via B3/Yahoo Finance/CoinGecko, cálculo de custo médio, P&L por posição e evolução gráfica da carteira.',
    bullets: ['Cotações automáticas em tempo real', 'Suporte a BRL, USD e EUR', 'Integrado ao patrimônio líquido'],
  },
  {
    key: 'debts',
    icon: '💳',
    color: '#dc2626',
    bg: '#fee2e2',
    title: 'Controle de Dívidas',
    badge: 'Financiamento',
    desc: 'Registre empréstimos, financiamentos e parcelamentos. Calcula juros automaticamente (SELIC, IPCA, CDI, taxa fixa), simula estratégias de quitação antecipada (bola de neve ou avalanche) e mostra o impacto no seu fluxo de caixa.',
    bullets: ['Suporte a juros SELIC, CDI, IPCA', 'Estratégia bola de neve / avalanche', 'Impacto visual no fluxo de caixa'],
  },
  {
    key: 'aiInsights',
    icon: '🤖',
    color: '#7c3aed',
    bg: '#f3e8ff',
    title: 'IA Insights',
    badge: 'Inteligência Artificial',
    desc: 'Análise financeira inteligente com Google Gemini. Gera relatórios em linguagem natural, identifica padrões de gastos, detecta oportunidades de economia, projeta o saldo futuro e responde perguntas sobre seus dados em forma de chat.',
    bullets: ['Requer chave gratuita do Google Gemini', 'Chat financeiro em português', 'Análise de patrimônio e orçamentos'],
  },
  {
    key: 'prices',
    icon: '🏷️',
    color: '#0891b2',
    bg: '#e0f2fe',
    title: 'Rastreamento de Preços',
    badge: 'Economia doméstica',
    desc: 'Crie um catálogo de produtos com histórico de preços em diferentes lojas e supermercados. Descubra onde comprar mais barato, identifique a melhor época para determinadas compras e integre com a Lista de Mercado para comparar preços na hora das compras.',
    bullets: ['Histórico por produto × loja', 'Alerta de variação de preço', 'Integrado à Lista de Mercado'],
  },
  {
    key: 'loyalty',
    icon: '🎯',
    color: '#f97316',
    bg: '#fff7ed',
    title: 'Programas de Fidelidade',
    badge: 'Milhas e Pontos',
    desc: 'Gerencie Smiles, LATAM Pass, TudoAzul, Livelo, Esfera, Multiplus e outros programas em um só lugar. Registre acúmulo e resgates, acompanhe o saldo total, receba alertas de pontos próximos de vencer e veja o valor estimado das suas milhas.',
    bullets: ['Suporte aos principais programas BR', 'Alerta de expiração de pontos', 'Valor estimado em R$ das milhas'],
  },
  {
    key: 'scheduled',
    icon: '🗓️',
    color: '#6d28d9',
    bg: '#f5f3ff',
    title: 'Lançamentos Programados',
    badge: 'Automação',
    desc: 'Configure transações recorrentes que o app lança automaticamente na data certa: salário todo dia 5, aluguel todo dia 10, assinaturas mensais, parcelas de financiamento. Nunca esqueça de registrar uma despesa fixa — o app faz isso por você.',
    bullets: ['Frequência: diária, semanal, mensal, anual', 'Lançamento automático na data certa', 'Suporte a pausar e retomar'],
  },
];

function _wzStep9(body, title, subtitle) {
  if (title)    title.textContent    = 'Módulos opcionais 🧩';
  if (subtitle) subtitle.textContent = 'Expanda o FinTrack. Tudo pode ser ativado ou desativado depois em Configurações.';
  const m = _wz.modules;
  body.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:8px;max-height:340px;overflow-y:auto;padding-right:4px">
      ${_WZ_MODULE_DATA.map(mod => {
        const on = !!m[mod.key];
        return `
        <div onclick="_wzToggleMod('${mod.key}')" style="cursor:pointer;border:2px solid ${on ? mod.color : 'var(--border)'};border-radius:12px;padding:12px 14px;background:${on ? mod.bg : 'var(--surface)'};transition:all .18s;user-select:none">
          <div style="display:flex;align-items:flex-start;gap:10px">
            <div style="width:38px;height:38px;border-radius:10px;background:${mod.bg};display:flex;align-items:center;justify-content:center;font-size:1.15rem;flex-shrink:0;border:1.5px solid ${on ? mod.color : 'transparent'};margin-top:1px">${mod.icon}</div>
            <div style="flex:1;min-width:0">
              <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-bottom:3px">
                <span style="font-size:.86rem;font-weight:800;color:${on ? mod.color : 'var(--text)'}">${mod.title}</span>
                <span style="font-size:.6rem;font-weight:600;padding:1px 6px;border-radius:20px;background:${mod.bg};color:${mod.color};border:1px solid ${mod.color}30">${mod.badge}</span>
              </div>
              <div style="font-size:.74rem;color:var(--muted);line-height:1.55;margin-bottom:${mod.bullets?.length ? '6px' : '0'}">${mod.desc}</div>
              ${mod.bullets?.length ? `<div style="display:flex;flex-direction:column;gap:2px">
                ${mod.bullets.map(b => `<div style="display:flex;align-items:center;gap:5px;font-size:.68rem;color:${on ? mod.color : 'var(--muted)'}"><span style="flex-shrink:0">•</span><span>${b}</span></div>`).join('')}
              </div>` : ''}
            </div>
            <div style="width:22px;height:22px;border-radius:50%;border:2px solid ${on ? mod.color : 'var(--border)'};background:${on ? mod.color : 'transparent'};display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .18s;margin-top:2px">
              ${on ? '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
            </div>
          </div>
        </div>`;
      }).join('')}
    </div>
    <div class="wz-hint" style="margin-top:10px;text-align:center">💡 Ative ou desative módulos a qualquer momento em <strong>Configurações → Família</strong>.</div>`;
}

function _wzToggleMod(key) {
  _wz.modules[key] = !_wz.modules[key];
  _wzStep9(document.getElementById('wzBody'), null, null);
}
window._wzToggleMod = _wzToggleMod;

// ── Step 10: Concluído ────────────────────────────────────────────────────
function _wzStep10(body, title, subtitle) {
  if (title)    title.textContent    = 'Tudo pronto! 🎉';
  if (subtitle) subtitle.textContent = 'Criando sua configuração inicial…';
  const nextBtn = document.getElementById('wzNextBtn');
  if (nextBtn) nextBtn.style.display = 'none';
  const skipBtn = document.getElementById('wzSkipBtn');
  if (skipBtn) skipBtn.style.display = 'none';
  const laterBtn = document.getElementById('wzLaterBtn');
  if (laterBtn) laterBtn.style.display = 'none';

  body.innerHTML = `
    <div id="wzFinalStatus" class="wz-status-list">
      <div class="wz-status-row" id="wzSt_family">⏳ Configurando família…</div>
      <div class="wz-status-row" id="wzSt_cats"   style="display:none">⏳ Criando categorias…</div>
      <div class="wz-status-row" id="wzSt_budgets" style="display:none">⏳ Criando orçamentos…</div>
      <div class="wz-status-row" id="wzSt_dreams"  style="display:none">⏳ Salvando sonhos…</div>
      <div class="wz-status-row" id="wzSt_modules" style="display:none">⏳ Ativando módulos…</div>
      <div class="wz-status-row" id="wzSt_members" style="display:none">⏳ Salvando membros…</div>
      <div class="wz-status-row" id="wzSt_invites" style="display:none">⏳ Enviando convites…</div>
    </div>
    <div id="wzDoneBtn" style="display:none;text-align:center;margin-top:20px">
      <div style="margin:0 auto 20px;max-width:400px;background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);border:1.5px solid rgba(99,102,241,.35);border-radius:16px;padding:18px 20px;text-align:left">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
          <div style="width:36px;height:36px;border-radius:10px;background:rgba(99,102,241,.2);display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#818cf8" stroke-width="2" stroke-linecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </div>
          <div>
            <div style="color:#e0e7ff;font-size:.88rem;font-weight:700;line-height:1.2">Sua opinião importa! 💡</div>
            <div style="color:rgba(199,210,254,.6);font-size:.72rem;margin-top:2px">Ajude a melhorar o Family FinTrack</div>
          </div>
        </div>
        <p style="color:rgba(199,210,254,.8);font-size:.8rem;line-height:1.6;margin:0 0 12px">
          Encontrou algo a melhorar? O botão
          <span style="display:inline-flex;align-items:center;gap:4px;background:rgba(99,102,241,.2);border:1px solid rgba(99,102,241,.4);border-radius:6px;padding:2px 7px">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#818cf8" stroke-width="2" stroke-linecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <span style="font-size:.72rem;color:#a5b4fc;font-weight:600">Feedback</span>
          </span>
          está sempre disponível.
        </p>
        <button onclick="_wzClose();setTimeout(()=>openFeedbackModal&&openFeedbackModal(),400)"
          style="width:100%;padding:9px;border:1px solid rgba(99,102,241,.5);border-radius:10px;background:rgba(99,102,241,.15);color:#a5b4fc;font-family:var(--font-sans);font-size:.82rem;font-weight:700;cursor:pointer">
          💬 Enviar feedback →
        </button>
      </div>
      <button class="btn btn-primary" style="padding:12px 36px;font-size:.95rem" onclick="_wzFinish()">
        Ir para o Dashboard →
      </button>
    </div>`;

  _wzRunSetup();
}

function _wzSetStatus(id, msg, done) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.display = '';
  el.innerHTML = done ? `✅ ${msg}` : `⏳ ${msg}`;
}

// ── Setup Runner ──────────────────────────────────────────────────────────
async function _wzRunSetup() {
  try {
    // ── 1. Create / rename family ────────────────────────────────────────
    let famId_ = currentUser?.family_id || currentUser?.families?.[0]?.id;
    if (_wz.creatingFamily && !famId_) {
      _wzSetStatus('wzSt_family', 'Criando família…', false);
      const { data: rpcData, error: rpcErr } = await sb.rpc('create_family_with_owner', { p_name: _wz.familyName, p_description: null });
      if (rpcErr) {
        const { data: fam, error: famErr } = await sb.from('families').insert({ name: _wz.familyName }).select('id').single();
        if (famErr) throw famErr;
        famId_ = fam.id;
        await sb.from('family_members').insert({ user_id: currentUser.id, family_id: famId_, role: 'owner' });
        await sb.from('app_users').update({ family_id: famId_, preferred_family_id: famId_ }).eq('id', currentUser.id);
        currentUser.family_id = famId_;
      } else {
        await _loadCurrentUserContext?.();
        famId_ = currentUser?.family_id;
      }
      _wz.creatingFamily = false;
    } else if (famId_ && _wz.familyName) {
      try { await sb.from('families').update({ name: _wz.familyName }).eq('id', famId_); } catch(_) {}
    }
    _wzSetStatus('wzSt_family', `Família "${_wz.familyName || 'sua família'}" configurada`, true);

    // ── 2. Create categories ─────────────────────────────────────────────
    const preset = _wz.preset && _wz.preset !== 'custom' ? WZ_PRESETS[_wz.preset] : null;
    const now    = new Date().toISOString();
    let catCount = 0;
    const catBudgets = []; // [{catId, amount}]

    if (preset) {
      _wzSetStatus('wzSt_cats', 'Criando categorias…', false);
      for (const group of preset.groups) {
        // Create parent category
        const { data: parent, error: pErr } = await sb.from('categories').insert({
          name: group.name, icon: group.icon, color: group.color,
          type: group.type || 'expense', family_id: famId_,
          created_at: now,
        }).select('id').single();
        if (pErr) { console.warn('[Wizard cats]', pErr.message); continue; }
        catCount++;

        // Create children
        if (group.children?.length) {
          for (const child of group.children) {
            const { error: cErr } = await sb.from('categories').insert({
              name: child.name, icon: child.icon, color: child.color,
              type: group.type || 'expense', family_id: famId_,
              parent_id: parent.id, created_at: now,
            });
            if (!cErr) catCount++;
          }
        }

        // Suggest budget for expense groups (10–25% of income proportionally)
        if (group.type !== 'income' && _wz.income > 0) {
          const pctMap = { 'Moradia':0.30,'Alimentação':0.18,'Transporte':0.12,'Saúde':0.10,'Educação':0.08,'Lazer':0.07,'Vestuário':0.04,'Assinaturas':0.04 };
          const pct = pctMap[group.name];
          if (pct) catBudgets.push({ catId: parent.id, amount: Math.round(_wz.income * pct / 50) * 50 });
        }
      }
      _wzSetStatus('wzSt_cats', `${catCount} categorias criadas (${preset.label})`, true);

    } else if (_wz.expenses.length) {
      _wzSetStatus('wzSt_cats', 'Criando categorias…', false);
      const colorMap = { moradia:'#c2410c', mercado:'#16a34a', transporte:'#7c3aed', saude:'#dc2626', educacao:'#1d4ed8', lazer:'#be185d', restaurante:'#b45309', assinaturas:'#6d28d9', vestuario:'#0891b2', pets:'#84cc16', viagens:'#0891b2', festas:'#f59e0b' };
      for (const exp of _wz.expenses) {
        const { data: cat, error } = await sb.from('categories').insert({
          name: exp.label, icon: exp.emoji, color: colorMap[exp.key] || '#2a6049',
          type: 'expense', family_id: famId_, created_at: now,
        }).select('id').single();
        if (!error && cat) {
          catCount++;
          if (exp.amount > 0) catBudgets.push({ catId: cat.id, amount: exp.amount });
        }
      }
      _wzSetStatus('wzSt_cats', `${catCount} categoria${catCount !== 1 ? 's' : ''} criada${catCount !== 1 ? 's' : ''}`, true);
    } else {
      _wzSetStatus('wzSt_cats', 'Categorias: pulado', true);
    }

    // ── 3. Create budgets ────────────────────────────────────────────────
    if (catBudgets.length) {
      _wzSetStatus('wzSt_budgets', 'Criando orçamentos…', false);
      const ym = new Date().toISOString().slice(0, 7);
      const monthStr = ym + '-01';
      let budgetCount = 0;
      for (const { catId, amount } of catBudgets) {
        const { error } = await sb.from('budgets').upsert({ category_id: catId, amount, month: monthStr, family_id: famId_() }, { onConflict: 'category_id,month' });
        if (!error) budgetCount++;
      }
      _wzSetStatus('wzSt_budgets', `${budgetCount} orçamento${budgetCount !== 1 ? 's' : ''} criado${budgetCount !== 1 ? 's' : ''}`, true);
    } else {
      _wzSetStatus('wzSt_budgets', 'Orçamentos: pulado', true);
    }

    // ── 4. Save dreams ───────────────────────────────────────────────────
    if (_wz.dreams.length) {
      _wzSetStatus('wzSt_dreams', 'Salvando sonhos…', false);
      let dreamCount = 0;
      for (const d of _wz.dreams) {
        if (!d.title) continue;
        const { error } = await sb.from('dreams').insert({
          family_id: famId_,
          title: d.title,
          target_amount: d.target || null,
          deadline: d.deadline ? d.deadline + '-01' : null,
          status: 'active',
          created_at: now,
        });
        if (!error) dreamCount++;
      }
      _wzSetStatus('wzSt_dreams', `${dreamCount} sonho${dreamCount !== 1 ? 's' : ''} salvo${dreamCount !== 1 ? 's' : ''}`, true);
    } else {
      document.getElementById('wzSt_dreams').style.display = 'none';
    }

    // ── 5. Apply modules ─────────────────────────────────────────────────
    const mods    = _wz.modules || {};
    const anyMod  = Object.values(mods).some(v => v);
    if (anyMod) {
      _wzSetStatus('wzSt_modules', 'Ativando módulos…', false);
      const modMap = { aiInsights:'module_ai_insights', investments:'module_investments', debts:'module_debts', prices:'module_prices', dreams:'module_dreams', loyalty:'module_loyalty', scheduled:'module_scheduled' };
      const NAV_MAP = { prices:'[data-nav="prices"]', investments:'[data-nav="investments"]', debts:'[data-nav="debts"]', aiInsights:'[data-nav="ai_insights"]', dreams:'[data-nav="dreams"]', loyalty:'[data-nav="loyalty"]' };
      const active = [];
      if (typeof saveAppSetting === 'function') {
        for (const [k, v] of Object.entries(mods)) {
          if (modMap[k]) await saveAppSetting(modMap[k], v).catch(() => {});
          if (v) {
            active.push(k);
            if (k === 'prices') await saveAppSetting('module_grocery', true).catch(() => {});
          }
        }
      }
      Object.entries(NAV_MAP).forEach(([key, sel]) => {
        document.querySelectorAll(sel).forEach(el => { el.style.display = mods[key] ? '' : 'none'; });
      });
      _wzSetStatus('wzSt_modules', `Módulos: ${active.length ? active.map(k => _WZ_MODULE_DATA.find(m=>m.key===k)?.icon || k).join(' ') : 'nenhum ativado'}`, true);
    } else {
      document.getElementById('wzSt_modules').style.display = 'none';
    }

    // ── 6. Save family composition members ──────────────────────────────
    const allMembers = [...(_wz.adults||[]).filter(a=>a.name), ...(_wz.children||[]).filter(c=>c.name)];
    if (allMembers.length) {
      _wzSetStatus('wzSt_members', 'Salvando membros…', false);
      let memCount = 0;
      for (const m of allMembers) {
        const { error } = await sb.from('family_composition').insert({
          family_id: famId_, name: m.name, relation: m.relation || null, created_at: now,
        }).select('id').single();
        if (!error) memCount++;
      }
      _wzSetStatus('wzSt_members', `${memCount} membro${memCount !== 1 ? 's' : ''} salvo${memCount !== 1 ? 's' : ''}`, true);
    } else {
      document.getElementById('wzSt_members').style.display = 'none';
    }

    // ── 7. Send invites ──────────────────────────────────────────────────
    const invites = (_wz.adults||[]).filter(a => a.invite && a.email);
    if (invites.length) {
      _wzSetStatus('wzSt_invites', 'Enviando convites…', false);
      let sent = 0;
      for (const a of invites) {
        try { await _sendFamilyInviteEmail(a.email, a.name, _wz.familyName); sent++; }
        catch(e) { console.warn('[Wizard invite]', e.message); }
      }
      _wzSetStatus('wzSt_invites', `${sent} convite${sent !== 1 ? 's' : ''} enviado${sent !== 1 ? 's' : ''}`, true);
    } else {
      document.getElementById('wzSt_invites').style.display = 'none';
    }

    // ── 8. Mark done ─────────────────────────────────────────────────────
    await saveAppSetting('wizard_dismissed', true).catch(() => {});
    _wzClearDraft();
    DB.preload().then(() => { if(typeof populateSelects==='function') populateSelects(); }).catch(()=>{});

    document.getElementById('wzDoneBtn').style.display = '';
    const sub = document.getElementById('wzSubtitle');
    if (sub) sub.textContent = 'Configuração concluída com sucesso! 🎉';

  } catch(e) {
    console.error('[Wizard setup]', e);
    const sub = document.getElementById('wzSubtitle');
    if (sub) sub.textContent = 'Erro: ' + (e.message || 'desconhecido. Tente novamente.');
  }
}

function _wzFinish() {
  _wzClose();
  const needsBoot = !!window._wzNeedsBoot;
  window._wzNeedsBoot = false;
  if (needsBoot && typeof bootApp === 'function') {
    bootApp().catch(() => {});
  } else {
    loadDashboard?.().catch(() => {});
    navigate('dashboard');
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────
function _wzGoTo(page) {
  _wzClose();
  navigate(page);
  setTimeout(_wzOpen, 1200);
}
window._wzGoTo = _wzGoTo;

function _wzShowError(msg) {
  const el = document.getElementById('wzError');
  if (el) { el.textContent = msg; el.style.display = ''; }
}
function _wzClearError() {
  const el = document.getElementById('wzError');
  if (el) { el.textContent = ''; el.style.display = 'none'; }
}

function _wzWatchModalClose(modalId, callback) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  let prevOpen = modal.classList.contains('open') || modal.style.display !== 'none';
  const obs = new MutationObserver(() => {
    const nowOpen = modal.classList.contains('open') || modal.style.display !== 'none';
    if (prevOpen && !nowOpen) { obs.disconnect(); setTimeout(callback, 300); }
    prevOpen = nowOpen;
  });
  obs.observe(modal, { attributes: true, attributeFilter: ['class','style'] });
}

async function _sendFamilyInviteEmail(toEmail, toName, familyName) {
  if (!EMAILJS_CONFIG?.serviceId || !EMAILJS_CONFIG?.publicKey) return;
  emailjs.init(EMAILJS_CONFIG.publicKey);
  const appUrl = window.location.origin + window.location.pathname;
  await emailjs.send(EMAILJS_CONFIG.serviceId, EMAILJS_CONFIG.templateId, {
    to_email: toEmail,
    subject:  `Convite para a família "${familyName}" no FinTrack`,
    message:  `Olá ${toName}! Você foi convidado à família "${familyName}" no Family FinTrack.\n\nAcesse ${appUrl} e solicite acesso com este e-mail (${toEmail}).`,
    report_content: `<p>Olá <strong>${toName}</strong>!<br><br>Você foi convidado para a família <strong>${familyName}</strong> no Family FinTrack.<br><br><a href="${appUrl}" style="background:#2a6049;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:600">Acessar o app →</a></p>`,
    from_name: 'Family FinTrack',
  });
}

// ── Settings integration ──────────────────────────────────────────────────
async function _updateWizardSettingsStatus() {
  const el = document.getElementById('wizardStatus');
  if (!el) return;
  const dismissed = await getAppSetting('wizard_dismissed', false);
  const draft = (() => { try { return JSON.parse(localStorage.getItem(WZ_LS_KEY)||'null'); } catch(_) { return null; } })();
  const hasDraft = draft && (Date.now() - (draft.savedAt || 0)) < 30 * 86400000;
  if (dismissed) {
    el.innerHTML = hasDraft
      ? '✅ Concluído · <a href="#" onclick="event.preventDefault();openWizardManual()" style="color:var(--accent)">Rascunho disponível — Retomar</a>'
      : '✅ Concluído · <a href="#" onclick="event.preventDefault();openWizardManual()" style="color:var(--accent)">Reabrir</a>';
  } else {
    el.innerHTML = hasDraft
      ? `📋 Rascunho salvo (passo ${draft.step || 1}/10) · <a href="#" onclick="event.preventDefault();openWizardManual()" style="color:var(--accent)">Continuar</a>`
      : '⏳ Não concluído · <a href="#" onclick="event.preventDefault();openWizardManual()" style="color:var(--accent)">Abrir Assistente</a>';
  }
}

window.restartWizardFromProfile = async function() {
  const confirmed = confirm('Isso vai reiniciar o assistente de configuração. Deseja continuar?');
  if (!confirmed) return;
  _wzReset();
  await saveAppSetting('wizard_dismissed', false).catch(() => {});
  if (typeof closeModal === 'function') closeModal('myProfileModal');
  setTimeout(() => window._wzOpen(), 300);
};

// ── Public exports ────────────────────────────────────────────────────────
window._wz                              = _wz;
window._wzReset                         = _wzReset;
window._wzOpen                          = _wzOpen;
window._wzClose                         = _wzClose;
window._wzDismiss                       = _wzDismiss;
window._wzSaveAndClose                  = _wzSaveAndClose;
window._wzNext                          = _wzNext;
window._wzBack                          = _wzBack;
window._wzSkip                          = _wzSkip;
window._wzFinish                        = _wzFinish;
window._wzRenderStep                    = _wzRenderStep;
window._updateWizardSettingsStatus      = _updateWizardSettingsStatus;
window.initWizard                       = initWizard;
window.openWizardForNewUser             = openWizardForNewUser;
window.openWizardManual                 = openWizardManual;
