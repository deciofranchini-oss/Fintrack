/* ═══════════════════════════════════════════════════════════════════════════
   subscriptions.js — Sistema de Assinaturas FinTrack
   Admin: configuração + painel de gestão + histórico de pagamentos
   Usuário: gate de acesso + paywall
   ═══════════════════════════════════════════════════════════════════════════ */

// ── Estado global ──────────────────────────────────────────────────────────
const _sub = {
  config:        null,   // app_settings.subscription_config
  myStatus:      null,   // family_subscriptions row para a família atual
  initialized:   false,
};

// ── Constantes ─────────────────────────────────────────────────────────────
const SUB_STATUS_LABELS = {
  trialing:  { label: 'Trial',        icon: '🟡', color: '#f59e0b' },
  active:    { label: 'Ativo',        icon: '🟢', color: '#16a34a' },
  past_due:  { label: 'Vencido',      icon: '🟠', color: '#ea580c' },
  canceled:  { label: 'Cancelado',    icon: '⚫', color: '#6b7280' },
  expired:   { label: 'Expirado',     icon: '🔴', color: '#dc2626' },
  free:      { label: 'Gratuito',     icon: '🎁', color: '#7c3aed' },
  blocked:   { label: 'Bloqueado',    icon: '🚫', color: '#dc2626' },
};

// ══════════════════════════════════════════════════════════════════════════
//  CONFIG — Carregar / salvar config global
// ══════════════════════════════════════════════════════════════════════════

async function loadSubscriptionConfig() {
  try {
    const { data } = await sb.from('app_settings')
      .select('value').eq('key', 'subscription_config').maybeSingle();
    _sub.config = data?.value || { mode: 'beta', trial_days: 30, price_brl: 29.90,
      price_usd: 5.99, currency: 'BRL', payment_providers: [], mp_public_key: '', pp_client_id: '' };
  } catch(_) {
    _sub.config = { mode: 'beta', trial_days: 30, price_brl: 29.90,
      price_usd: 5.99, currency: 'BRL', payment_providers: [], mp_public_key: '', pp_client_id: '' };
  }
  return _sub.config;
}
window.loadSubscriptionConfig = loadSubscriptionConfig;

async function saveSubscriptionConfig(cfg) {
  const merged = { ..._sub.config, ...cfg };
  await sb.from('app_settings').upsert(
    { key: 'subscription_config', value: merged, updated_at: new Date().toISOString() },
    { onConflict: 'key' }
  );
  _sub.config = merged;
  toast('✅ Configurações de assinatura salvas!', 'success');
}
window.saveSubscriptionConfig = saveSubscriptionConfig;

// ══════════════════════════════════════════════════════════════════════════
//  GATE — Verificar acesso da família atual
// ══════════════════════════════════════════════════════════════════════════

async function checkSubscriptionGate() {
  try {
    const cfg = _sub.config || await loadSubscriptionConfig();

    // Modo beta: acesso livre para todos
    if (cfg.mode === 'beta') return { allowed: true, reason: 'beta' };

    // Admin global sempre tem acesso
    if (currentUser?.role === 'admin') return { allowed: true, reason: 'admin' };

    const fid = famId?.();
    if (!fid) return { allowed: false, reason: 'no_family' };

    // Buscar assinatura da família
    const { data: sub } = await sb.from('family_subscriptions')
      .select('*').eq('family_id', fid).maybeSingle();

    // Sem registro → criar trial automático
    if (!sub) {
      await _createTrialForFamily(fid, cfg.trial_days || 30);
      return { allowed: true, reason: 'new_trial' };
    }

    _sub.myStatus = sub;
    const today = new Date().toISOString().slice(0, 10);

    if (sub.status === 'free')     return { allowed: true, reason: 'free_grant' };
    if (sub.status === 'trialing' && sub.trial_end >= today) return { allowed: true, reason: 'trialing', daysLeft: _daysBetween(today, sub.trial_end) };
    if (sub.status === 'active'   && sub.current_period_end >= today) return { allowed: true, reason: 'active' };

    // Atualizar status se trial expirou
    if (sub.status === 'trialing' && sub.trial_end < today) {
      await sb.from('family_subscriptions').update({ status: 'expired', updated_at: new Date().toISOString() }).eq('id', sub.id);
      return { allowed: false, reason: 'trial_expired', sub };
    }
    if (sub.status === 'active' && sub.current_period_end < today) {
      await sb.from('family_subscriptions').update({ status: 'past_due', updated_at: new Date().toISOString() }).eq('id', sub.id);
      return { allowed: false, reason: 'past_due', sub };
    }
    return { allowed: false, reason: sub.status, sub };
  } catch(e) {
    console.warn('[sub gate]', e.message);
    return { allowed: true, reason: 'error_bypass' }; // erro → não bloquear
  }
}
window.checkSubscriptionGate = checkSubscriptionGate;

async function _createTrialForFamily(fid, trialDays) {
  const start = new Date().toISOString().slice(0, 10);
  const end   = new Date(Date.now() + trialDays * 86400000).toISOString().slice(0, 10);
  try {
    await sb.from('family_subscriptions').upsert({
      family_id: fid, status: 'trialing',
      trial_start: start, trial_end: end,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'family_id' });
  } catch(e) { console.warn('[sub] create trial:', e.message); }
}

function _daysBetween(from, to) {
  return Math.max(0, Math.round((new Date(to) - new Date(from)) / 86400000));
}

// ══════════════════════════════════════════════════════════════════════════
//  PAYWALL — Mostrar modal de assinatura bloqueada
// ══════════════════════════════════════════════════════════════════════════

async function showPaywall(gateResult) {
  const cfg = _sub.config || await loadSubscriptionConfig();
  const sub = gateResult?.sub;
  const familyName = currentUser?.families?.find(f => f.id === famId?.())?.name || 'sua família';

  const reasonMessages = {
    trial_expired: `Seu período de trial de <strong>${cfg.trial_days} dias</strong> expirou.`,
    past_due:      `O pagamento da última fatura não foi processado.`,
    expired:       `Sua assinatura expirou.`,
    canceled:      `Sua assinatura foi cancelada.`,
    blocked:       `Seu acesso foi bloqueado pelo administrador.`,
    no_family:     `Sua conta não está vinculada a uma família.`,
  };
  const msg = reasonMessages[gateResult?.reason] || 'Sua assinatura precisa ser renovada.';

  const hasMp  = cfg.mp_public_key && (cfg.payment_providers||[]).includes('mercadopago');
  const hasPp  = cfg.pp_client_id  && (cfg.payment_providers||[]).includes('paypal');
  const priceBrl = Number(cfg.price_brl || 29.90).toFixed(2).replace('.', ',');

  const overlay = document.createElement('div');
  overlay.id = 'paywallOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(4px)';
  overlay.innerHTML = `
    <div style="background:var(--surface);border-radius:20px;max-width:440px;width:100%;box-shadow:0 32px 80px rgba(0,0,0,.4);overflow:hidden">
      <!-- Header -->
      <div style="background:linear-gradient(135deg,#0d2e1a,#122a18);padding:28px 24px 24px;text-align:center;position:relative">
        <div style="font-size:2.5rem;margin-bottom:8px">🔒</div>
        <div style="font-size:1.1rem;font-weight:800;color:#fff;margin-bottom:4px">Assinatura necessária</div>
        <div style="font-size:.8rem;color:rgba(255,255,255,.5)">${msg}</div>
        <div style="margin-top:12px;display:inline-flex;align-items:center;gap:7px;background:rgba(125,194,66,.1);border:1px solid rgba(125,194,66,.25);border-radius:100px;padding:5px 14px">
          <span style="font-size:.72rem;color:#9ed45f;font-weight:700">👨‍👩‍👧 ${esc(familyName)}</span>
        </div>
      </div>

      <!-- Price card -->
      <div style="padding:20px 24px">
        <div style="background:var(--surface2);border:1.5px solid var(--border);border-radius:14px;padding:18px;margin-bottom:16px">
          <div style="text-align:center;margin-bottom:14px">
            <div style="font-size:.7rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin-bottom:4px">Plano Família</div>
            <div style="font-size:2rem;font-weight:800;color:var(--text)">R$ ${priceBrl}<span style="font-size:.85rem;font-weight:400;color:var(--muted)">/mês</span></div>
            <div style="font-size:.75rem;color:var(--muted);margin-top:2px">Todos os membros da família incluídos</div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:.75rem;color:var(--muted)">
            ${['✓ IA embarcada','✓ Telegram Bot','✓ 40+ funcionalidades','✓ Cancele a qualquer hora'].map(f=>`<div>${f}</div>`).join('')}
          </div>
        </div>

        <!-- Payment buttons -->
        <div style="display:flex;flex-direction:column;gap:10px">
          ${hasMp ? `<button onclick="_subStartMercadoPago()" id="btnPayMp"
            style="width:100%;padding:13px;border-radius:12px;border:none;cursor:pointer;background:#009ee3;color:#fff;font-family:var(--font-sans);font-size:.88rem;font-weight:700;display:flex;align-items:center;justify-content:center;gap:8px">
            <svg width="18" height="18" viewBox="0 0 40 40" fill="none"><path d="M20 3C10.6 3 3 10.6 3 20s7.6 17 17 17 17-7.6 17-17S29.4 3 20 3z" fill="#fff"/><path d="M20 8c-6.6 0-12 5.4-12 12s5.4 12 12 12 12-5.4 12-12S26.6 8 20 8zm0 18c-3.3 0-6-2.7-6-6s2.7-6 6-6 6 2.7 6 6-2.7 6-6 6z" fill="#009ee3"/></svg>
            Pagar com Mercado Pago
          </button>` : ''}
          ${hasPp ? `<button onclick="_subStartPayPal()" id="btnPayPp"
            style="width:100%;padding:13px;border-radius:12px;border:none;cursor:pointer;background:#0070ba;color:#fff;font-family:var(--font-sans);font-size:.88rem;font-weight:700;display:flex;align-items:center;justify-content:center;gap:8px">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="4" fill="#003087"/><path d="M7 8h5.5c2 0 3 .8 2.8 2.5-.3 2-1.8 3-3.5 3H10l-.8 4H7l2-9.5z" fill="#009cde"/><path d="M9 8h5.5c2 0 3 .8 2.8 2.5-.3 2-1.8 3-3.5 3H12l-.8 4H9l2-9.5z" fill="#fff" opacity=".7"/></svg>
            Pagar com PayPal
          </button>` : ''}
          ${!hasMp && !hasPp ? `<div style="text-align:center;padding:16px;font-size:.82rem;color:var(--muted)">
            Entre em contato com o administrador para regularizar sua assinatura.
          </div>` : ''}
        </div>

        <!-- Footer links -->
        <div style="display:flex;justify-content:space-between;margin-top:16px">
          <button onclick="logoutUser()" style="background:none;border:none;font-size:.75rem;color:var(--muted);cursor:pointer;font-family:var(--font-sans)">Fazer logout</button>
          ${cfg.support_email ? `<a href="mailto:${esc(cfg.support_email)}" style="font-size:.75rem;color:var(--accent);text-decoration:none">Falar com suporte</a>` : ''}
        </div>
      </div>
    </div>`;

  document.body.appendChild(overlay);
}
window.showPaywall = showPaywall;

// ── Integração Mercado Pago ────────────────────────────────────────────────
async function _subStartMercadoPago() {
  const cfg = _sub.config;
  if (!cfg?.mp_public_key) { toast('Chave Mercado Pago não configurada', 'error'); return; }
  const btn = document.getElementById('btnPayMp');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Conectando...'; }
  try {
    // Chamar Edge Function para criar preferência/plano de assinatura
    const res = await fetch(`${typeof SB_URL !== 'undefined' ? SB_URL : ''}/functions/v1/sub-checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sb.auth.session?.access_token || ''}` },
      body: JSON.stringify({ provider: 'mercadopago', family_id: famId?.(), price_brl: cfg.price_brl }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { checkout_url } = await res.json();
    if (checkout_url) window.location.href = checkout_url;
    else throw new Error('URL de checkout não retornada');
  } catch(e) {
    toast('Erro ao iniciar pagamento: ' + e.message, 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Pagar com Mercado Pago'; }
  }
}
window._subStartMercadoPago = _subStartMercadoPago;

// ── Integração PayPal ─────────────────────────────────────────────────────
async function _subStartPayPal() {
  const cfg = _sub.config;
  if (!cfg?.pp_client_id) { toast('Client ID PayPal não configurado', 'error'); return; }
  const btn = document.getElementById('btnPayPp');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Conectando...'; }
  try {
    const res = await fetch(`${typeof SB_URL !== 'undefined' ? SB_URL : ''}/functions/v1/sub-checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sb.auth.session?.access_token || ''}` },
      body: JSON.stringify({ provider: 'paypal', family_id: famId?.(), price_usd: cfg.price_usd }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { checkout_url } = await res.json();
    if (checkout_url) window.location.href = checkout_url;
    else throw new Error('URL de checkout não retornada');
  } catch(e) {
    toast('Erro ao iniciar pagamento: ' + e.message, 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Pagar com PayPal'; }
  }
}
window._subStartPayPal = _subStartPayPal;

// ══════════════════════════════════════════════════════════════════════════
//  ADMIN — Painel de gestão de assinaturas
// ══════════════════════════════════════════════════════════════════════════

const _subAdmin = { families: [], subs: [], payments: [], tab: 'config', page: 0 };

async function openSubscriptionAdmin() {
  if (currentUser?.role !== 'admin') { toast('Acesso restrito ao administrador', 'error'); return; }
  await loadSubscriptionConfig();
  openModal('subscriptionAdminModal');
  _subAdminSwitchTab('config');
}
window.openSubscriptionAdmin = openSubscriptionAdmin;

function _subAdminSwitchTab(tab) {
  _subAdmin.tab = tab;
  ['config','subs','payments'].forEach(t => {
    const btn  = document.getElementById(`subAdmTab-${t}`);
    const pane = document.getElementById(`subAdmPane-${t}`);
    if (btn)  { btn.style.background = t === tab ? 'var(--accent)' : 'transparent'; btn.style.color = t === tab ? '#fff' : 'var(--muted)'; }
    if (pane) pane.style.display = t === tab ? '' : 'none';
  });
  if (tab === 'config')   _subAdminRenderConfig();
  if (tab === 'subs')     _subAdminLoadSubs();
  if (tab === 'payments') _subAdminLoadPayments();
}
window._subAdminSwitchTab = _subAdminSwitchTab;

// ── Tab Config ────────────────────────────────────────────────────────────
function _subAdminRenderConfig() {
  const cfg  = _sub.config || {};
  const pane = document.getElementById('subAdmPane-config');
  if (!pane) return;

  const isBeta = cfg.mode !== 'production';
  pane.innerHTML = `
    <div style="padding:16px">

      <!-- Mode toggle -->
      <div style="margin-bottom:20px">
        <div style="font-size:.72rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">Modo do App</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <button id="subModeBeta" onclick="_subSetMode('beta')"
            style="padding:14px 10px;border-radius:12px;border:2px solid ${isBeta?'var(--accent)':'var(--border)'};background:${isBeta?'var(--accent-lt)':'var(--surface2)'};cursor:pointer;font-family:var(--font-sans);transition:all .15s">
            <div style="font-size:1.4rem">🧪</div>
            <div style="font-size:.82rem;font-weight:700;color:${isBeta?'var(--accent)':'var(--text)'}">Beta</div>
            <div style="font-size:.7rem;color:var(--muted);margin-top:2px">Sem assinatura · Acesso livre</div>
          </button>
          <button id="subModeProd" onclick="_subSetMode('production')"
            style="padding:14px 10px;border-radius:12px;border:2px solid ${!isBeta?'var(--accent)':'var(--border)'};background:${!isBeta?'var(--accent-lt)':'var(--surface2)'};cursor:pointer;font-family:var(--font-sans);transition:all .15s">
            <div style="font-size:1.4rem">🚀</div>
            <div style="font-size:.82rem;font-weight:700;color:${!isBeta?'var(--accent)':'var(--text)'}">Produção</div>
            <div style="font-size:.7rem;color:var(--muted);margin-top:2px">Trial + cobrança recorrente</div>
          </button>
        </div>
        ${isBeta ? '<div style="margin-top:10px;padding:10px 12px;background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.2);border-radius:10px;font-size:.75rem;color:#d97706">⚠️ Modo beta ativo — todos os usuários têm acesso gratuito</div>' : ''}
      </div>

      <!-- Trial + Preço -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
        <div>
          <label style="font-size:.72rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:5px">Trial (dias)</label>
          <input type="number" id="subTrialDays" value="${cfg.trial_days||30}" min="1" max="365"
            style="width:100%;padding:9px 11px;border:1.5px solid var(--border);border-radius:9px;background:var(--surface);font-size:.9rem;font-family:var(--font-sans)">
        </div>
        <div>
          <label style="font-size:.72rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:5px">Preço BRL/mês</label>
          <input type="number" id="subPriceBrl" value="${cfg.price_brl||29.90}" min="0" step="0.01"
            style="width:100%;padding:9px 11px;border:1.5px solid var(--border);border-radius:9px;background:var(--surface);font-size:.9rem;font-family:var(--font-sans)">
        </div>
        <div>
          <label style="font-size:.72rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:5px">Preço USD/mês</label>
          <input type="number" id="subPriceUsd" value="${cfg.price_usd||5.99}" min="0" step="0.01"
            style="width:100%;padding:9px 11px;border:1.5px solid var(--border);border-radius:9px;background:var(--surface);font-size:.9rem;font-family:var(--font-sans)">
        </div>
        <div>
          <label style="font-size:.72rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:5px">E-mail suporte</label>
          <input type="email" id="subSupportEmail" value="${cfg.support_email||''}" placeholder="suporte@app.com"
            style="width:100%;padding:9px 11px;border:1.5px solid var(--border);border-radius:9px;background:var(--surface);font-size:.85rem;font-family:var(--font-sans)">
        </div>
      </div>

      <!-- Provedores -->
      <div style="font-size:.72rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Provedores de Pagamento</div>

      <div style="background:var(--surface2);border-radius:12px;padding:14px;margin-bottom:10px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
          <input type="checkbox" id="subUseMp" ${(cfg.payment_providers||[]).includes('mercadopago')?'checked':''}
            style="width:15px;height:15px;accent-color:var(--accent)">
          <label for="subUseMp" style="font-size:.85rem;font-weight:700;color:var(--text)">💳 Mercado Pago</label>
        </div>
        <div>
          <label style="font-size:.7rem;color:var(--muted);display:block;margin-bottom:4px">Public Key</label>
          <input type="text" id="subMpKey" value="${cfg.mp_public_key||''}" placeholder="APP_USR-..." autocomplete="off"
            style="width:100%;padding:7px 10px;border:1px solid var(--border);border-radius:8px;background:var(--surface);font-size:.78rem;font-family:monospace">
        </div>
      </div>

      <div style="background:var(--surface2);border-radius:12px;padding:14px;margin-bottom:16px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
          <input type="checkbox" id="subUsePp" ${(cfg.payment_providers||[]).includes('paypal')?'checked':''}
            style="width:15px;height:15px;accent-color:var(--accent)">
          <label for="subUsePp" style="font-size:.85rem;font-weight:700;color:var(--text)">🌐 PayPal</label>
        </div>
        <div>
          <label style="font-size:.7rem;color:var(--muted);display:block;margin-bottom:4px">Client ID</label>
          <input type="text" id="subPpClientId" value="${cfg.pp_client_id||''}" placeholder="AXxx..." autocomplete="off"
            style="width:100%;padding:7px 10px;border:1px solid var(--border);border-radius:8px;background:var(--surface);font-size:.78rem;font-family:monospace">
        </div>
      </div>

      <button onclick="_subAdminSaveConfig()"
        style="width:100%;padding:12px;border:none;border-radius:12px;background:var(--accent);color:#fff;font-family:var(--font-sans);font-size:.88rem;font-weight:700;cursor:pointer">
        💾 Salvar Configurações
      </button>
    </div>`;
}

window._subSetMode = function(mode) {
  if (!_sub.config) return;
  _sub.config.mode = mode;
  _subAdminRenderConfig();
};

window._subAdminSaveConfig = async function() {
  const providers = [];
  if (document.getElementById('subUseMp')?.checked) providers.push('mercadopago');
  if (document.getElementById('subUsePp')?.checked) providers.push('paypal');
  await saveSubscriptionConfig({
    mode:              _sub.config?.mode || 'beta',
    trial_days:        parseInt(document.getElementById('subTrialDays')?.value || '30', 10),
    price_brl:         parseFloat(document.getElementById('subPriceBrl')?.value || '29.90'),
    price_usd:         parseFloat(document.getElementById('subPriceUsd')?.value || '5.99'),
    mp_public_key:     document.getElementById('subMpKey')?.value?.trim() || '',
    pp_client_id:      document.getElementById('subPpClientId')?.value?.trim() || '',
    support_email:     document.getElementById('subSupportEmail')?.value?.trim() || '',
    payment_providers: providers,
  });
};

// ── Tab Assinaturas ───────────────────────────────────────────────────────
async function _subAdminLoadSubs() {
  const pane = document.getElementById('subAdmPane-subs');
  if (!pane) return;
  pane.innerHTML = '<div style="text-align:center;padding:32px;color:var(--muted);font-size:.85rem">⏳ Carregando...</div>';
  try {
    const { data: subs } = await sb.from('family_subscriptions')
      .select('*, families(name)').order('created_at', { ascending: false });
    _subAdmin.subs = subs || [];
    _subAdminRenderSubs();
  } catch(e) {
    pane.innerHTML = `<div style="color:var(--danger);padding:16px">Erro: ${esc(e.message)}</div>`;
  }
}

function _subAdminRenderSubs() {
  const pane = document.getElementById('subAdmPane-subs');
  if (!pane) return;
  const subs = _subAdmin.subs;
  const today = new Date().toISOString().slice(0, 10);

  const stats = {
    active:   subs.filter(s => s.status === 'active').length,
    trialing: subs.filter(s => s.status === 'trialing').length,
    expired:  subs.filter(s => ['expired','canceled','blocked','past_due'].includes(s.status)).length,
    free:     subs.filter(s => s.status === 'free').length,
  };

  pane.innerHTML = `
    <div style="padding:12px 16px">
      <!-- Stats row -->
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px">
        ${[
          { label:'Ativos',    value: stats.active,   color:'#16a34a' },
          { label:'Trial',     value: stats.trialing, color:'#f59e0b' },
          { label:'Gratuitos', value: stats.free,     color:'#7c3aed' },
          { label:'Inativos',  value: stats.expired,  color:'#dc2626' },
        ].map(s => `<div style="background:var(--surface2);border-radius:10px;padding:10px;text-align:center">
          <div style="font-size:1.3rem;font-weight:800;color:${s.color}">${s.value}</div>
          <div style="font-size:.65rem;color:var(--muted)">${s.label}</div>
        </div>`).join('')}
      </div>

      <button onclick="_subAdminCreateTrial()" style="width:100%;padding:9px;border:1.5px dashed var(--border);border-radius:10px;background:transparent;font-family:var(--font-sans);font-size:.8rem;color:var(--muted);cursor:pointer;margin-bottom:12px">+ Criar trial manual para família</button>

      ${subs.length === 0 ? '<div style="text-align:center;padding:24px;color:var(--muted)">Nenhuma assinatura cadastrada.</div>' :
        subs.map(s => {
          const st = SUB_STATUS_LABELS[s.status] || { label: s.status, icon: '⚪', color: '#6b7280' };
          const familyName = s.families?.name || s.family_id.slice(0, 8);
          const trialDaysLeft = s.status === 'trialing' ? _daysBetween(today, s.trial_end) : null;
          return `
          <div style="background:var(--surface2);border-radius:12px;padding:12px 14px;margin-bottom:8px">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;flex-wrap:wrap">
              <div style="flex:1;min-width:0">
                <div style="font-size:.88rem;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(familyName)}</div>
                <div style="font-size:.7rem;color:var(--muted)">
                  ${s.status === 'trialing' ? `Trial até ${s.trial_end} (${trialDaysLeft}d restantes)` :
                    s.status === 'active'   ? `Ativo até ${s.current_period_end||'—'}` :
                    s.status === 'free'     ? 'Acesso gratuito (admin grant)' :
                    `Desde ${s.created_at?.slice(0,10)}`}
                </div>
              </div>
              <span style="font-size:.72rem;font-weight:700;padding:3px 10px;border-radius:20px;background:${st.color}18;color:${st.color};white-space:nowrap">${st.icon} ${st.label}</span>
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              <button onclick="_subAdminManage('${s.id}')" style="padding:5px 10px;font-size:.72rem;border:1px solid var(--border);border-radius:8px;background:var(--surface);cursor:pointer;font-family:var(--font-sans)">⚙️ Gerenciar</button>
              ${s.status !== 'free' ? `<button onclick="_subAdminGrantFree('${s.id}')" style="padding:5px 10px;font-size:.72rem;border:1px solid rgba(124,58,237,.3);border-radius:8px;background:rgba(124,58,237,.06);color:#7c3aed;cursor:pointer;font-family:var(--font-sans)">🎁 Gratuito</button>` : ''}
              ${['trialing','expired'].includes(s.status) ? `<button onclick="_subAdminExtendTrial('${s.id}')" style="padding:5px 10px;font-size:.72rem;border:1px solid rgba(245,158,11,.3);border-radius:8px;background:rgba(245,158,11,.06);color:#d97706;cursor:pointer;font-family:var(--font-sans)">📅 Estender Trial</button>` : ''}
              ${s.status !== 'blocked' ? `<button onclick="_subAdminBlock('${s.id}')" style="padding:5px 10px;font-size:.72rem;border:1px solid rgba(220,38,38,.25);border-radius:8px;background:rgba(220,38,38,.05);color:#dc2626;cursor:pointer;font-family:var(--font-sans)">🚫 Bloquear</button>` : ''}
            </div>
          </div>`;
        }).join('')
      }
    </div>`;
}

window._subAdminManage = async function(subId) {
  const sub = _subAdmin.subs.find(s => s.id === subId);
  if (!sub) return;
  const familyName = sub.families?.name || sub.family_id;
  const note = prompt(`Notas administrativas para "${familyName}" (opcional):`, sub.admin_notes || '');
  if (note === null) return;
  await sb.from('family_subscriptions').update({ admin_notes: note, updated_at: new Date().toISOString() }).eq('id', subId);
  toast('✅ Notas salvas', 'success');
  _subAdminLoadSubs();
};

window._subAdminGrantFree = async function(subId) {
  if (!confirm('Conceder acesso gratuito permanente para esta família?')) return;
  await sb.from('family_subscriptions').update({ status: 'free', updated_at: new Date().toISOString() }).eq('id', subId);
  toast('🎁 Acesso gratuito concedido', 'success');
  _subAdminLoadSubs();
};

window._subAdminExtendTrial = async function(subId) {
  const days = prompt('Quantos dias adicionar ao trial?', '15');
  if (!days || isNaN(parseInt(days))) return;
  const sub = _subAdmin.subs.find(s => s.id === subId);
  const base = sub?.trial_end > new Date().toISOString().slice(0,10) ? sub.trial_end : new Date().toISOString().slice(0,10);
  const newEnd = new Date(new Date(base).getTime() + parseInt(days) * 86400000).toISOString().slice(0,10);
  await sb.from('family_subscriptions').update({
    status: 'trialing', trial_end: newEnd, updated_at: new Date().toISOString()
  }).eq('id', subId);
  toast(`📅 Trial estendido até ${newEnd}`, 'success');
  _subAdminLoadSubs();
};

window._subAdminBlock = async function(subId) {
  if (!confirm('Bloquear acesso desta família?')) return;
  await sb.from('family_subscriptions').update({ status: 'blocked', updated_at: new Date().toISOString() }).eq('id', subId);
  toast('🚫 Família bloqueada', 'success');
  _subAdminLoadSubs();
};

window._subAdminCreateTrial = async function() {
  const { data: families } = await sb.from('families').select('id,name').eq('active', true).order('name');
  if (!families?.length) { toast('Nenhuma família encontrada', 'warning'); return; }
  const opts = families.map(f => `${f.name} (${f.id.slice(0,8)})`).join('\n');
  const pick = prompt(`Escolha o número da família:\n${families.map((f,i)=>`${i+1}. ${f.name}`).join('\n')}`);
  if (!pick) return;
  const idx = parseInt(pick, 10) - 1;
  if (idx < 0 || idx >= families.length) { toast('Número inválido', 'error'); return; }
  const fam = families[idx];
  const days = parseInt(prompt('Dias de trial:', String(_sub.config?.trial_days || 30)) || '30', 10);
  await _createTrialForFamily(fam.id, days);
  toast(`🟡 Trial de ${days} dias criado para "${fam.name}"`, 'success');
  _subAdminLoadSubs();
};

// ── Tab Pagamentos ────────────────────────────────────────────────────────
async function _subAdminLoadPayments() {
  const pane = document.getElementById('subAdmPane-payments');
  if (!pane) return;
  pane.innerHTML = '<div style="text-align:center;padding:32px;color:var(--muted);font-size:.85rem">⏳ Carregando...</div>';
  try {
    const { data: payments } = await sb.from('subscription_payments')
      .select('*, families(name)').order('created_at', { ascending: false }).limit(50);
    _subAdmin.payments = payments || [];
    _subAdminRenderPayments();
  } catch(e) {
    pane.innerHTML = `<div style="color:var(--danger);padding:16px">Erro: ${esc(e.message)}</div>`;
  }
}

function _subAdminRenderPayments() {
  const pane = document.getElementById('subAdmPane-payments');
  if (!pane) return;
  const payments = _subAdmin.payments;

  const totalPaid = payments.filter(p => p.status === 'paid').reduce((a, p) => a + Number(p.amount), 0);
  const fmt = v => `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  const STATUS_COLORS = { paid:'#16a34a', failed:'#dc2626', pending:'#f59e0b', refunded:'#7c3aed', disputed:'#ea580c' };

  pane.innerHTML = `
    <div style="padding:12px 16px">
      <div style="background:var(--surface2);border-radius:12px;padding:14px;margin-bottom:14px;display:flex;align-items:center;gap:12px">
        <div>
          <div style="font-size:.72rem;font-weight:700;color:var(--muted);text-transform:uppercase">Total recebido</div>
          <div style="font-size:1.4rem;font-weight:800;color:var(--green,#16a34a)">${fmt(totalPaid)}</div>
        </div>
        <div style="margin-left:auto;text-align:right">
          <div style="font-size:.72rem;color:var(--muted)">${payments.filter(p=>p.status==='paid').length} pagamentos</div>
          <div style="font-size:.72rem;color:#dc2626">${payments.filter(p=>p.status==='failed').length} falhas</div>
        </div>
      </div>
      ${payments.length === 0 ? '<div style="text-align:center;padding:24px;color:var(--muted)">Nenhum pagamento registrado.</div>' :
        payments.map(p => {
          const color = STATUS_COLORS[p.status] || '#6b7280';
          return `
          <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)">
            <div style="flex:1;min-width:0">
              <div style="font-size:.82rem;font-weight:600;color:var(--text)">${esc(p.families?.name || p.family_id?.slice(0,8) || '—')}</div>
              <div style="font-size:.7rem;color:var(--muted)">${p.payment_provider || '—'} · ${p.created_at?.slice(0,10)}</div>
            </div>
            <div style="text-align:right">
              <div style="font-size:.88rem;font-weight:700;color:var(--text)">${fmt(p.amount)}</div>
              <span style="font-size:.65rem;padding:2px 8px;border-radius:12px;background:${color}18;color:${color}">${p.status}</span>
            </div>
          </div>`;
        }).join('')
      }
    </div>`;
}

// Exports
window.SUB_STATUS_LABELS = SUB_STATUS_LABELS;
