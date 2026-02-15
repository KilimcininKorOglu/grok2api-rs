let apiKey = '';
let currentConfig = {};
const byId = (id) => document.getElementById(id);
const NUMERIC_FIELDS = new Set([
  'timeout',
  'max_retry',
  'refresh_interval_hours',
  'fail_threshold',
  'limit_mb',
  'save_delay_ms',
  'assets_max_concurrent',
  'media_max_concurrent',
  'usage_max_concurrent',
  'assets_delete_batch_size',
  'assets_batch_size',
  'assets_max_tokens',
  'usage_batch_size',
  'usage_max_tokens',
  'reload_interval_sec',
  'nsfw_max_concurrent',
  'nsfw_batch_size',
  'nsfw_max_tokens'
]);

const LOCALE_MAP = {
  "app": {
    "label": "App Settings",
    "api_key": { title: "API Key", desc: "Bearer Token required to call Grok2API-rs service. Keep it safe." },
    "app_key": { title: "Admin Password", desc: "Password for Grok2API-rs admin dashboard. Keep it safe." },
    "app_url": { title: "App URL", desc: "External URL for Grok2API-rs service, used for file link access." },
    "image_format": { title: "Image Format", desc: "Generated image format (url or base64)." },
    "video_format": { title: "Video Format", desc: "Generated video format (url only)." }
  },
  "grok": {
    "label": "Grok Settings",
    "temporary": { title: "Temporary Chat", desc: "Enable temporary chat mode." },
    "stream": { title: "Stream Response", desc: "Enable streaming output by default." },
    "thinking": { title: "Thinking Chain", desc: "Enable model thinking chain output." },
    "dynamic_statsig": { title: "Dynamic Fingerprint", desc: "Enable dynamic Statsig value generation." },
    "filter_tags": { title: "Filter Tags", desc: "Auto-filter special tags in Grok responses." },
    "timeout": { title: "Timeout", desc: "Request timeout for Grok service (seconds)." },
    "base_proxy_url": { title: "Base Proxy URL", desc: "Proxy base URL for Grok website requests." },
    "asset_proxy_url": { title: "Asset Proxy URL", desc: "Proxy URL for Grok static assets (images/videos)." },
    "cf_clearance": { title: "CF Clearance", desc: "Cloudflare verification cookie." },
    "wreq_emulation": { title: "wreq Fingerprint", desc: "Browser fingerprint template for upstream requests (e.g. chrome_136, edge_136, firefox_136)." },
    "wreq_emulation_usage": { title: "Usage Fingerprint", desc: "Browser fingerprint for /rest/rate-limits only. Empty follows wreq fingerprint." },
    "wreq_emulation_nsfw": { title: "NSFW Fingerprint", desc: "Browser fingerprint for NSFW enable endpoint. Empty follows wreq fingerprint; falls back to chrome_116 on 401/403." },
    "max_retry": { title: "Max Retry", desc: "Maximum retry count for failed Grok requests." },
    "retry_status_codes": { title: "Retry Status Codes", desc: "HTTP status codes that trigger retry." }
  },
  "token": {
    "label": "Token Pool Settings",
    "auto_refresh": { title: "Auto Refresh", desc: "Enable automatic token refresh." },
    "refresh_interval_hours": { title: "Refresh Interval", desc: "Token refresh interval (hours)." },
    "fail_threshold": { title: "Fail Threshold", desc: "Consecutive failures before marking token unavailable." },
    "save_delay_ms": { title: "Save Delay", desc: "Delay for merging token changes before write (ms)." },
    "reload_interval_sec": { title: "Consistency Refresh", desc: "Token state refresh interval for multi-worker scenarios (seconds)." }
  },
  "cache": {
    "label": "Cache Settings",
    "enable_auto_clean": { title: "Auto Clean", desc: "Enable automatic cache cleanup when limit exceeded." },
    "limit_mb": { title: "Clean Threshold", desc: "Cache size threshold (MB) that triggers cleanup." }
  },
  "performance": {
    "label": "Concurrency Performance",
    "media_max_concurrent": { title: "Media Concurrency Limit", desc: "Max concurrent video/media generation requests. Recommended: 50." },
    "nsfw_max_concurrent": { title: "NSFW Enable Concurrency Limit", desc: "Max concurrent requests for batch NSFW enable. Recommended: 10." },
    "nsfw_batch_size": { title: "NSFW Enable Batch Size", desc: "Batch size for NSFW enable operations. Recommended: 50." },
    "nsfw_max_tokens": { title: "NSFW Enable Max Count", desc: "Max tokens per batch NSFW enable to prevent accidents. Recommended: 1000." },
    "usage_max_concurrent": { title: "Token Refresh Concurrency Limit", desc: "Max concurrent requests for batch token refresh. Recommended: 25." },
    "usage_batch_size": { title: "Token Refresh Batch Size", desc: "Batch size for token refresh operations. Recommended: 50." },
    "usage_max_tokens": { title: "Token Refresh Max Count", desc: "Max tokens per batch refresh operation. Recommended: 1000." },
    "assets_max_concurrent": { title: "Assets Concurrency Limit", desc: "Max concurrent requests for batch asset find/delete. Recommended: 25." },
    "assets_batch_size": { title: "Assets Batch Size", desc: "Batch size for asset find/delete operations. Recommended: 10." },
    "assets_max_tokens": { title: "Assets Max Count", desc: "Max tokens per batch asset operation. Recommended: 1000." },
    "assets_delete_batch_size": { title: "Assets Delete Batch Size", desc: "Batch size for single account asset deletion. Recommended: 10." }
  },
  "downstream": {
    "label": "Downstream Management",
    "enable_chat_completions": { title: "Chat Completions", desc: "Enable /v1/chat/completions (OpenAI Chat Completions compatible)." },
    "enable_responses": { title: "Responses API", desc: "Enable /v1/responses (OpenAI Responses API compatible)." },
    "enable_images": { title: "Images Generations", desc: "Enable /v1/images/generations (image generation)." },
    "enable_images_nsfw": { title: "Images NSFW", desc: "Enable /v1/images/generations/nsfw (NSFW image generation, auto-enables NSFW)." },
    "enable_models": { title: "Models", desc: "Enable /v1/models (model list)." },
    "enable_files": { title: "Files", desc: "Enable /v1/files/image/* and /v1/files/video/* (cached file access)." }
  }
};

const SECTION_ORDER = new Map(Object.keys(LOCALE_MAP).map((key, index) => [key, index]));

function normalizeLocaleKey(value) {
  return String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function getText(section, key) {
  const sectionKeys = [section, normalizeLocaleKey(section)];
  const keyKeys = [key, normalizeLocaleKey(key)];

  for (const sec of sectionKeys) {
    const localeSection = LOCALE_MAP[sec];
    if (!localeSection) continue;
    for (const k of keyKeys) {
      if (localeSection[k]) {
        return localeSection[k];
      }
    }
  }

  return {
    title: String(key || '').replace(/_/g, ' '),
    desc: 'No description available. Please refer to documentation.'
  };
}

function getSectionLabel(section) {
  const localeSection = LOCALE_MAP[section] || LOCALE_MAP[normalizeLocaleKey(section)];
  return (localeSection && localeSection.label) || `${section} Settings`;
}

function sortByOrder(keys, orderMap) {
  if (!orderMap) return keys;
  return keys.sort((a, b) => {
    const ia = orderMap.get(a);
    const ib = orderMap.get(b);
    if (ia !== undefined && ib !== undefined) return ia - ib;
    if (ia !== undefined) return -1;
    if (ib !== undefined) return 1;
    return 0;
  });
}

function setInputMeta(input, section, key) {
  input.dataset.section = section;
  input.dataset.key = key;
}

function createOption(value, text, selectedValue) {
  const option = document.createElement('option');
  option.value = value;
  option.text = text;
  if (selectedValue !== undefined && selectedValue === value) option.selected = true;
  return option;
}

function buildBooleanInput(section, key, val) {
  const label = document.createElement('label');
  label.className = 'relative inline-flex items-center cursor-pointer';

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = val;
  input.className = 'sr-only peer';
  setInputMeta(input, section, key);

  const slider = document.createElement('div');
  slider.className = "w-9 h-5 bg-[var(--accents-2)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-black";

  label.appendChild(input);
  label.appendChild(slider);

  return { input, node: label };
}

function buildSelectInput(section, key, val, options) {
  const input = document.createElement('select');
  input.className = 'geist-input h-[34px]';
  setInputMeta(input, section, key);
  options.forEach(opt => {
    input.appendChild(createOption(opt.val, opt.text, val));
  });
  return { input, node: input };
}

function buildJsonInput(section, key, val) {
  const input = document.createElement('textarea');
  input.className = 'geist-input font-mono text-xs';
  input.rows = 4;
  input.value = JSON.stringify(val, null, 2);
  setInputMeta(input, section, key);
  input.dataset.type = 'json';
  return { input, node: input };
}

function buildTextInput(section, key, val) {
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'geist-input';
  input.value = val;
  setInputMeta(input, section, key);
  return { input, node: input };
}

function buildSecretInput(section, key, val) {
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'geist-input flex-1 h-[34px]';
  input.value = val;
  setInputMeta(input, section, key);

  const wrapper = document.createElement('div');
  wrapper.className = 'flex items-center gap-2';

  const copyBtn = document.createElement('button');
  copyBtn.className = 'flex-none w-[32px] h-[32px] flex items-center justify-center bg-black text-white rounded-md hover:opacity-80 transition-opacity';
  copyBtn.type = 'button';
  copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
  copyBtn.onclick = () => copyToClipboard(input.value, copyBtn);

  wrapper.appendChild(input);
  wrapper.appendChild(copyBtn);

  return { input, node: wrapper };
}

async function init() {
  apiKey = await ensureApiKey();
  if (apiKey === null) return;
  loadData();
}

async function loadData() {
  try {
    const res = await fetch('/api/v1/admin/config', {
      headers: buildAuthHeaders(apiKey)
    });
    if (res.ok) {
      currentConfig = await res.json();
      renderConfig(currentConfig);
    } else if (res.status === 401) {
      logout();
    }
  } catch (e) {
    showToast('Connection failed', 'error');
  }
}

function renderConfig(data) {
  const container = byId('config-container');
  if (!container) return;
  container.replaceChildren();

  const fragment = document.createDocumentFragment();
  const sections = sortByOrder(
    Object.keys(data).filter((section) => section !== 'downstream'),
    SECTION_ORDER
  );

  sections.forEach(section => {
    const items = data[section];
    const localeSection = LOCALE_MAP[section];
    const keyOrder = localeSection ? new Map(Object.keys(localeSection).map((k, i) => [k, i])) : null;

    const card = document.createElement('div');
    card.className = 'config-section';

    const header = document.createElement('div');
    header.innerHTML = `<div class="config-section-title">${getSectionLabel(section)}</div>`;
    card.appendChild(header);

    const grid = document.createElement('div');
    grid.className = 'config-grid';

    const keys = sortByOrder(Object.keys(items), keyOrder);

    keys.forEach(key => {
      const val = items[key];
      const text = getText(section, key);

      const fieldCard = document.createElement('div');
      fieldCard.className = 'config-field';

      const titleEl = document.createElement('div');
      titleEl.className = 'config-field-title';
      titleEl.textContent = text.title;
      fieldCard.appendChild(titleEl);

      const descEl = document.createElement('p');
      descEl.className = 'config-field-desc';
      descEl.textContent = text.desc;
      fieldCard.appendChild(descEl);

      const inputWrapper = document.createElement('div');
      inputWrapper.className = 'config-field-input';

      let built;
      if (typeof val === 'boolean') {
        built = buildBooleanInput(section, key, val);
      }
      else if (key === 'image_format') {
        built = buildSelectInput(section, key, val, [
          { val: 'url', text: 'URL' },
          { val: 'base64', text: 'Base64' }
        ]);
      }
      else if (key === 'video_format') {
        built = buildSelectInput(section, key, 'url', [
          { val: 'url', text: 'URL' }
        ]);
      }
      else if (Array.isArray(val) || typeof val === 'object') {
        built = buildJsonInput(section, key, val);
      }
      else {
        if (key === 'api_key' || key === 'app_key') {
          built = buildSecretInput(section, key, val);
        } else {
          built = buildTextInput(section, key, val);
        }
      }

      if (built) {
        inputWrapper.appendChild(built.node);
      }
      fieldCard.appendChild(inputWrapper);
      grid.appendChild(fieldCard);
    });

    card.appendChild(grid);

    if (grid.children.length > 0) {
      fragment.appendChild(card);
    }
  });

  container.appendChild(fragment);
}

async function saveConfig() {
  const btn = byId('save-btn');
  const originalText = btn.innerText;
  btn.disabled = true;
  btn.innerText = 'Saving...';

  try {
    const newConfig = typeof structuredClone === 'function'
      ? structuredClone(currentConfig)
      : JSON.parse(JSON.stringify(currentConfig));
    const inputs = document.querySelectorAll('input[data-section], textarea[data-section], select[data-section]');

    inputs.forEach(input => {
      const s = input.dataset.section;
      const k = input.dataset.key;
      let val = input.value;

      if (input.type === 'checkbox') {
        val = input.checked;
      } else if (input.dataset.type === 'json') {
        try { val = JSON.parse(val); } catch (e) { throw new Error(`Invalid JSON: ${getText(s, k).title}`); }
      } else if (k === 'app_key' && val.trim() === '') {
        throw new Error('Admin password cannot be empty');
      } else if (NUMERIC_FIELDS.has(k)) {
        if (val.trim() !== '' && !Number.isNaN(Number(val))) {
          val = Number(val);
        }
      }

      if (!newConfig[s]) newConfig[s] = {};
      newConfig[s][k] = val;
    });

    const res = await fetch('/api/v1/admin/config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...buildAuthHeaders(apiKey)
      },
      body: JSON.stringify(newConfig)
    });

    if (res.ok) {
      btn.innerText = 'Saved';
      showToast('Configuration saved', 'success');
      setTimeout(() => {
        btn.innerText = originalText;
        btn.style.backgroundColor = '';
      }, 2000);
    } else {
      showToast('Save failed', 'error');
    }
  } catch (e) {
    showToast('Error: ' + e.message, 'error');
  } finally {
    if (btn.innerText === 'Saving...') {
      btn.disabled = false;
      btn.innerText = originalText;
    } else {
      btn.disabled = false;
    }
  }
}

async function copyToClipboard(text, btn) {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);

    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    btn.style.backgroundColor = '#10b981';
    btn.style.borderColor = '#10b981';

    setTimeout(() => {
      btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
      btn.style.backgroundColor = '';
      btn.style.borderColor = '';
    }, 2000);
  } catch (err) {
    console.error('Failed to copy', err);
  }
}

window.onload = init;
