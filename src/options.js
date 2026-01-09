const DEFAULT_SETTINGS = {
  panelPosition: "input-above",
  showTooltip: true,
  showToast: true,
  enablePreviousMode: true,
  allowWhenTyping: false,
  allowAutoClick: true,
  theme: "system",
  hotkeys: {
    auto: "Alt+1",
    instant: "Alt+2",
    "thinking-light": "Alt+3",
    "thinking-standard": "Alt+4",
    "thinking-extended": "Alt+5",
    "thinking-heavy": "Alt+6",
    pro: "Alt+7",
    "pro-extend": "Alt+8",
    previous: "Alt+0"
  }
};

const storage = chrome?.storage?.sync ?? chrome?.storage?.local;

const formElements = {
  panelPosition: document.getElementById("panelPosition"),
  showTooltip: document.getElementById("showTooltip"),
  showToast: document.getElementById("showToast"),
  enablePreviousMode: document.getElementById("enablePreviousMode"),
  allowWhenTyping: document.getElementById("allowWhenTyping"),
  allowAutoClick: document.getElementById("allowAutoClick"),
  theme: document.getElementById("theme")
};

const hotkeyInputs = Array.from(document.querySelectorAll("[data-hotkey]"));
const status = document.getElementById("status");
const hotkeyWarning = document.getElementById("hotkeyWarning");

function loadSettings() {
  if (!storage) return Promise.resolve({ ...DEFAULT_SETTINGS });
  return new Promise((resolve) => {
    storage.get(DEFAULT_SETTINGS, (stored) => {
      resolve({ ...DEFAULT_SETTINGS, ...stored });
    });
  });
}

function saveSettings(data) {
  if (!storage) return Promise.resolve();
  return new Promise((resolve) => {
    storage.set(data, resolve);
  });
}

function applySettings(settings) {
  formElements.panelPosition.value = settings.panelPosition;
  formElements.showTooltip.checked = settings.showTooltip;
  formElements.showToast.checked = settings.showToast;
  formElements.enablePreviousMode.checked = settings.enablePreviousMode;
  formElements.allowWhenTyping.checked = settings.allowWhenTyping;
  formElements.allowAutoClick.checked = settings.allowAutoClick;
  formElements.theme.value = settings.theme;

  hotkeyInputs.forEach((input) => {
    const key = input.dataset.hotkey;
    input.value = settings.hotkeys?.[key] ?? "";
  });
}

function gatherSettings() {
  const hotkeys = {};
  hotkeyInputs.forEach((input) => {
    const key = input.dataset.hotkey;
    hotkeys[key] = input.value.trim();
  });

  return {
    panelPosition: formElements.panelPosition.value,
    showTooltip: formElements.showTooltip.checked,
    showToast: formElements.showToast.checked,
    enablePreviousMode: formElements.enablePreviousMode.checked,
    allowWhenTyping: formElements.allowWhenTyping.checked,
    allowAutoClick: formElements.allowAutoClick.checked,
    theme: formElements.theme.value,
    hotkeys
  };
}

function normalizeHotkey(value) {
  if (!value) return "";
  const parts = value
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1));
  return parts.join("+");
}

function checkHotkeyConflicts(hotkeys) {
  const normalized = {};
  const conflicts = [];

  Object.entries(hotkeys).forEach(([mode, combo]) => {
    const norm = normalizeHotkey(combo);
    if (!norm) return;
    if (normalized[norm]) {
      conflicts.push(`${normalized[norm]} & ${mode}`);
    } else {
      normalized[norm] = mode;
    }
  });

  if (conflicts.length > 0) {
    return `Hotkey conflict detected: ${conflicts.join(", ")}`;
  }

  return "";
}

async function handleSave() {
  const settings = gatherSettings();
  const conflict = checkHotkeyConflicts(settings.hotkeys);
  if (conflict) {
    hotkeyWarning.textContent = conflict;
    hotkeyWarning.classList.add("status", "error");
    status.textContent = "";
    return;
  }

  hotkeyWarning.textContent = "";
  hotkeyWarning.classList.remove("status", "error");

  await saveSettings(settings);
  status.textContent = "Settings saved.";
  status.classList.remove("error");
  setTimeout(() => {
    status.textContent = "";
  }, 2000);
}

async function handleReset() {
  await saveSettings(DEFAULT_SETTINGS);
  applySettings(DEFAULT_SETTINGS);
  status.textContent = "Reset to defaults.";
  status.classList.remove("error");
  setTimeout(() => {
    status.textContent = "";
  }, 2000);
}

function initTheme(settings) {
  document.body.dataset.theme = settings.theme;
}

async function init() {
  const settings = await loadSettings();
  applySettings(settings);
  initTheme(settings);

  document.getElementById("save").addEventListener("click", handleSave);
  document.getElementById("reset").addEventListener("click", handleReset);
}

init();
