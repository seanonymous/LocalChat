const dom = {
  chat: document.getElementById('chat'),
  input: document.getElementById('input'),
  send: document.getElementById('btn-send'),
  newChat: document.getElementById('btn-new'),
  settingsBtn: document.getElementById('btn-settings'),
  settingsPanel: document.getElementById('settings'),
  settingsClose: document.getElementById('btn-close-settings'),
  serverUrl: document.getElementById('server-url'),
  model: document.getElementById('model'),
  saveHistory: document.getElementById('save-history'),
  saveSettings: document.getElementById('btn-save-settings'),
  refreshModels: document.getElementById('btn-refresh-models'),
  modelsList: document.getElementById('models-list'),
  modelLabel: document.getElementById('model-label'),
  serverLabel: document.getElementById('server-label'),
};

const DEFAULTS = {
  serverUrl: 'http://192.168.50.50:11434',
  model: 'llama3.1',
  saveHistory: true,
};

const STORAGE_KEYS = {
  settings: 'neon/settings',
  history: 'neon/history',
};

let appState = {
  settings: { ...DEFAULTS },
  history: [],
  isStreaming: false,
};

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.settings);
    if (raw) appState.settings = { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {}
}

function saveSettings() {
  try {
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(appState.settings));
  } catch {}
}

function loadHistory() {
  if (!appState.settings.saveHistory) return;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.history);
    if (raw) appState.history = JSON.parse(raw);
  } catch {}
}

function saveHistory() {
  if (!appState.settings.saveHistory) return;
  try {
    localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(appState.history));
  } catch {}
}

function scrollToBottom() {
  dom.chat.scrollTop = dom.chat.scrollHeight;
}

function render() {
  dom.chat.innerHTML = '';
  for (const msg of appState.history) {
    const el = renderMessage(msg.role, msg.content);
    dom.chat.appendChild(el);
  }
  dom.modelLabel.textContent = appState.settings.model;
  dom.serverLabel.textContent = appState.settings.serverUrl.replace(/^https?:\/\//, '');
  scrollToBottom();
}

function renderMessage(role, content) {
  const wrap = document.createElement('div');
  wrap.className = 'message';
  const avatar = document.createElement('div');
  avatar.className = `avatar ${role}`;
  avatar.textContent = role === 'user' ? '👤' : '◇';
  const bubble = document.createElement('div');
  bubble.className = `bubble ${role}`;
  bubble.textContent = content || '';
  wrap.append(avatar, bubble);
  return wrap;
}

function addMessage(role, content) {
  const msg = { role, content };
  appState.history.push(msg);
  const el = renderMessage(role, content);
  dom.chat.appendChild(el);
  scrollToBottom();
  saveHistory();
  return { msg, el };
}

async function discoverModels() {
  const url = `${appState.settings.serverUrl.replace(/\/$/, '')}/api/tags`;
  try {
    dom.refreshModels.disabled = true;
    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) throw new Error('Failed to load models');
    const data = await res.json();
    const models = (data.models || []).map(m => m.name).sort();
    dom.modelsList.innerHTML = models.map(m => `<option value="${m}">${m}</option>`).join('');
    dom.modelsList.classList.remove('hidden');
    if (models.length) dom.modelsList.value = models[0];
  } catch (e) {
    alert('Could not discover models from server. Ensure the server is reachable.');
  } finally {
    dom.refreshModels.disabled = false;
  }
}

function applySettingsToUI() {
  dom.serverUrl.value = appState.settings.serverUrl;
  dom.model.value = appState.settings.model;
  dom.saveHistory.checked = appState.settings.saveHistory;
}

function openSettings() { dom.settingsPanel.classList.remove('hidden'); }
function closeSettings() { dom.settingsPanel.classList.add('hidden'); }

function newChat() {
  appState.history = [];
  render();
  saveHistory();
}

async function sendMessage() {
  const content = dom.input.value.trim();
  if (!content || appState.isStreaming) return;

  addMessage('user', content);
  dom.input.value = '';
  dom.input.style.height = 'auto';
  const { el } = addMessage('assistant', '');
  const bubble = el.querySelector('.bubble');

  try {
    appState.isStreaming = true;
    const payload = {
      model: appState.settings.model,
      messages: appState.history.map(m => ({ role: m.role, content: m.content })),
      stream: true,
    };

    const url = `${appState.settings.serverUrl.replace(/\/$/, '')}/api/chat`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok || !res.body) {
      throw new Error(`Request failed: ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const json = JSON.parse(line);
          if (json.message && json.message.content) {
            bubble.textContent += json.message.content;
            appState.history[appState.history.length - 1].content = bubble.textContent;
            scrollToBottom();
          }
          if (json.error) {
            bubble.textContent += `\n[error] ${json.error}`;
          }
        } catch (e) {
          // ignore partial lines
        }
      }
    }
  } catch (e) {
    bubble.textContent += `\n[network] ${e.message || e}`;
  } finally {
    appState.isStreaming = false;
    saveHistory();
  }
}

function autoResizeTextarea() {
  const el = dom.input;
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, window.innerHeight * 0.4) + 'px';
}

function bindEvents() {
  dom.send.addEventListener('click', sendMessage);
  dom.input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  dom.input.addEventListener('input', autoResizeTextarea);
  dom.newChat.addEventListener('click', newChat);
  dom.settingsBtn.addEventListener('click', openSettings);
  dom.settingsClose.addEventListener('click', closeSettings);
  dom.saveSettings.addEventListener('click', () => {
    appState.settings.serverUrl = dom.serverUrl.value.trim() || DEFAULTS.serverUrl;
    appState.settings.model = dom.model.value.trim() || DEFAULTS.model;
    appState.settings.saveHistory = !!dom.saveHistory.checked;
    saveSettings();
    if (!appState.settings.saveHistory) {
      try { localStorage.removeItem(STORAGE_KEYS.history); } catch {}
    }
    closeSettings();
    render();
  });
  dom.refreshModels.addEventListener('click', discoverModels);
  dom.modelsList.addEventListener('change', () => {
    dom.model.value = dom.modelsList.value;
  });
}

(function init() {
  loadSettings();
  loadHistory();
  applySettingsToUI();
  bindEvents();
  render();
})();