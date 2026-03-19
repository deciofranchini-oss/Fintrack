const AI_PROVIDER_SETTING_KEY = 'gemini_api_key';
const AI_DEFAULT_MODEL = 'gemini-2.5-flash-lite';
window.AICore = window.AICore || {
  async getConfig(){
    const apiKey = await getAppSetting(AI_PROVIDER_SETTING_KEY, '');
    const model = (window.RECEIPT_AI_MODEL || AI_DEFAULT_MODEL || 'gemini-2.5-flash-lite');
    return { apiKey, model, isConfigured: !!(apiKey && String(apiKey).startsWith('AIza')) };
  },
  async ensureConfigured(){
    const cfg = await this.getConfig();
    if (!cfg.isConfigured) throw new Error('Configure a chave Gemini em Configurações → IA.');
    return cfg;
  },
  async generate({ prompt, inlineData=null, temperature=0.2, maxOutputTokens=2048, responseMimeType=null }){
    const { apiKey, model } = await this.ensureConfigured();
    const parts = [];
    if (inlineData?.data) parts.push({ inline_data: { mime_type: inlineData.mimeType || 'application/octet-stream', data: inlineData.data } });
    parts.push({ text: prompt });
    const body = { contents:[{parts}], generationConfig:{ temperature, maxOutputTokens } };
    if (responseMimeType) body.generationConfig.responseMimeType = responseMimeType;
    const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(body)
    });
    if (!resp.ok) {
      const err = await resp.json().catch(()=>({}));
      throw new Error(err?.error?.message || `HTTP ${resp.status}`);
    }
    const data = await resp.json();
    return data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('\n').trim() || '';
  },
  async generateJSON(opts){
    const text = await this.generate({ ...opts, responseMimeType: 'application/json' });
    const clean = String(text || '').replace(/```json|```/g,'').trim();
    return JSON.parse(clean);
  }
};
