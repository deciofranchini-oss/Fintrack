// User needs to configure their EmailJS credentials
/* ═══════════════════════════════════════════════════════════════
   EMAILJS CONFIGURATION
═══════════════════════════════════════════════════════════════ */
const EMAILJS_CONFIG = {
  serviceId:  '',
  templateId: '',
  // Optional: dedicated template for scheduled transaction notifications.
  // If empty, the app falls back to templateId.
  scheduledTemplateId: '',
  publicKey:  '',
};

/* ═══════════════════════════════════════════════════════════════
   APP SETTINGS — stored in app_settings table (Supabase)
   Falls back to localStorage for backward compatibility
═══════════════════════════════════════════════════════════════ */
