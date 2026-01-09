const MODE_DEFINITIONS = [
  {
    id: "auto",
    label: "Auto",
    group: "Core",
    description: "Let ChatGPT decide the best mode."
  },
  {
    id: "instant",
    label: "Instant",
    group: "Core",
    description: "Fast responses for quick questions."
  },
  {
    id: "thinking-light",
    label: "Thinking Light",
    group: "Thinking",
    description: "Light reasoning depth."
  },
  {
    id: "thinking-standard",
    label: "Thinking Standard",
    group: "Thinking",
    description: "Balanced reasoning depth."
  },
  {
    id: "thinking-extended",
    label: "Thinking Extended",
    group: "Thinking",
    description: "Deeper reasoning for complex tasks."
  },
  {
    id: "thinking-heavy",
    label: "Thinking Heavy",
    group: "Thinking",
    description: "Maximum reasoning intensity."
  },
  {
    id: "pro",
    label: "Pro",
    group: "Pro",
    description: "High-accuracy professional mode."
  },
  {
    id: "pro-extend",
    label: "Pro Extend",
    group: "Pro",
    description: "Extended reasoning for pro workloads."
  }
];

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

const MODE_MAP = new Map(MODE_DEFINITIONS.map((mode) => [mode.id, mode]));

let settings = { ...DEFAULT_SETTINGS };
let currentModeId = null;
let previousModeId = null;
let panelRoot = null;
let toastTimeout = null;
let availabilityTimer = null;

const storage = chrome?.storage?.sync ?? chrome?.storage?.local;

function loadSettings() {
  if (!storage) {
    return Promise.resolve({ ...DEFAULT_SETTINGS });
  }

  return new Promise((resolve) => {
    storage.get(DEFAULT_SETTINGS, (stored) => {
      resolve({ ...DEFAULT_SETTINGS, ...stored });
    });
  });
}

function saveLastMode(modeId) {
  if (!storage) {
    return;
  }
  storage.set({ lastModeId: modeId });
}

function createPanel() {
  panelRoot = document.createElement("div");
  panelRoot.id = "cgpt-mode-switcher";

  const header = document.createElement("div");
  header.className = "cgpt-panel-header";

  const titleWrap = document.createElement("div");
  const title = document.createElement("div");
  title.className = "cgpt-panel-title";
  title.textContent = "Mode Switcher";

  const subtitle = document.createElement("div");
  subtitle.className = "cgpt-panel-subtitle";
  subtitle.textContent = "Instant switching";

  titleWrap.append(title, subtitle);

  const gear = document.createElement("button");
  gear.className = "cgpt-panel-gear";
  gear.type = "button";
  gear.textContent = "⚙";
  gear.addEventListener("click", () => {
    window.open(chrome.runtime.getURL("src/options.html"), "_blank");
  });

  header.append(titleWrap, gear);

  panelRoot.append(header);

  const groups = buildGroups();
  groups.forEach((group) => panelRoot.append(group));

  document.body.append(panelRoot);
}

function buildGroups() {
  const groupOrder = [
    { id: "core", label: "Quick" },
    { id: "thinking", label: "Thinking" },
    { id: "pro", label: "Pro" }
  ];

  const groupMap = {
    core: ["auto", "instant"],
    thinking: [
      "thinking-light",
      "thinking-standard",
      "thinking-extended",
      "thinking-heavy"
    ],
    pro: ["pro", "pro-extend"]
  };

  return groupOrder.map((group) => {
    const wrapper = document.createElement("div");
    wrapper.className = "cgpt-mode-group";

    const label = document.createElement("div");
    label.className = "cgpt-group-label";
    label.textContent = group.label;

    const row = document.createElement("div");
    row.className = "cgpt-mode-row";

    groupMap[group.id].forEach((modeId) => {
      const mode = MODE_MAP.get(modeId);
      if (!mode) return;

      const button = document.createElement("button");
      button.type = "button";
      button.className = "cgpt-mode-button";
      button.dataset.modeId = mode.id;
      button.textContent = mode.label.replace("Thinking ", "");

      button.addEventListener("click", () => {
        handleModeSwitch(mode.id);
      });

      row.append(button);
    });

    wrapper.append(label, row);
    return wrapper;
  });
}

function applySettings() {
  if (!panelRoot) return;
  panelRoot.classList.remove(
    "cgpt-position-input-above",
    "cgpt-position-input-below",
    "cgpt-position-top",
    "cgpt-position-side"
  );
  panelRoot.classList.add(`cgpt-position-${settings.panelPosition}`);

  panelRoot
    .querySelectorAll(".cgpt-mode-button")
    .forEach((button) => {
      const modeId = button.dataset.modeId;
      const mode = MODE_MAP.get(modeId);
      if (!mode) return;
      if (settings.showTooltip) {
        const hotkey = settings.hotkeys?.[modeId] ?? "";
        const details = [mode.label];
        if (hotkey) details.push(`(${hotkey})`);
        if (mode.description) details.push(`- ${mode.description}`);
        button.title = details.join(" ");
      } else {
        button.title = "";
      }
    });
}

function setPanelDisabled(isDisabled, message) {
  if (!panelRoot) return;
  panelRoot.classList.toggle("cgpt-disabled", isDisabled);
  const subtitle = panelRoot.querySelector(".cgpt-panel-subtitle");
  if (subtitle) {
    subtitle.textContent = message ?? "Instant switching";
  }
}

function showToast(message, options = {}) {
  if (!settings.showToast) return;

  let toast = document.getElementById("cgpt-toast");
  if (toast) {
    toast.remove();
  }

  toast = document.createElement("div");
  toast.id = "cgpt-toast";
  if (options.type === "error") {
    toast.classList.add("cgpt-toast-error");
  }

  const text = document.createElement("span");
  text.textContent = message;
  toast.append(text);

  if (options.actionLabel && options.onAction) {
    const actionButton = document.createElement("button");
    actionButton.type = "button";
    actionButton.textContent = options.actionLabel;
    actionButton.addEventListener("click", () => {
      options.onAction();
      toast.remove();
    });
    toast.append(actionButton);
  }

  document.body.append(toast);

  clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => {
    toast.remove();
  }, options.duration ?? 3000);
}

function handleModeSwitch(targetModeId, { silent = false } = {}) {
  if (!settings.allowAutoClick) {
    showToast("Auto switching disabled in settings.", { type: "error" });
    return;
  }

  const targetMode = MODE_MAP.get(targetModeId);
  if (!targetMode) return;

  if (currentModeId && currentModeId !== targetModeId) {
    previousModeId = currentModeId;
  }

  attemptSwitch(targetMode, 0)
    .then((success) => {
      if (!success) {
        if (!silent) {
          showToast("Switch failed, retry?", {
            type: "error",
            actionLabel: "Retry",
            onAction: () => handleModeSwitch(targetModeId)
          });
        }
        return;
      }
      if (!silent) {
        showToast(`Switched to ${targetMode.label}.`);
      }
    })
    .catch(() => {
      showToast("Switch failed, retry?", {
        type: "error",
        actionLabel: "Retry",
        onAction: () => handleModeSwitch(targetModeId)
      });
    });
}

async function attemptSwitch(targetMode, attempt) {
  const trigger = findModeTrigger();
  if (!trigger) {
    return false;
  }

  trigger.click();

  const menu = await waitForMenu();
  if (!menu) {
    if (attempt < 2) {
      return attemptSwitch(targetMode, attempt + 1);
    }
    return false;
  }

  const menuItem = findMenuItem(menu, targetMode.label);
  if (!menuItem) {
    if (attempt < 2) {
      return attemptSwitch(targetMode, attempt + 1);
    }
    return false;
  }

  menuItem.click();
  await wait(200);

  currentModeId = targetMode.id;
  updateActiveButton(targetMode.id);
  saveLastMode(targetMode.id);
  return true;
}

function findModeTrigger() {
  const selectors = [
    'button[data-testid*="model"]',
    'button[aria-label*="Model"]',
    'button[aria-label*="mode"]',
    'button[aria-haspopup="menu"]'
  ];
  for (const selector of selectors) {
    const button = document.querySelector(selector);
    if (button && button.textContent.trim().length > 0) {
      return button;
    }
  }
  return null;
}

function waitForMenu() {
  const existing = document.querySelector('[role="menu"], [role="listbox"]');
  if (existing) return Promise.resolve(existing);

  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      const menu = document.querySelector('[role="menu"], [role="listbox"]');
      if (menu) {
        observer.disconnect();
        resolve(menu);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, 1200);
  });
}

function findMenuItem(menu, label) {
  const normalized = label.toLowerCase();
  const items = menu.querySelectorAll('[role="menuitem"], [role="option"], button');
  for (const item of items) {
    const text = item.textContent.trim().toLowerCase();
    if (!text) continue;
    if (normalized === "thinking light" && text.includes("light")) return item;
    if (normalized === "thinking standard" && text.includes("standard")) return item;
    if (normalized === "thinking extended" && text.includes("extended")) return item;
    if (normalized === "thinking heavy" && text.includes("heavy")) return item;
    if (normalized === "pro extend" && text.includes("extend")) return item;
    if (text.includes(normalized)) return item;
  }
  return null;
}

function updateActiveButton(modeId) {
  if (!panelRoot) return;
  panelRoot
    .querySelectorAll(".cgpt-mode-button")
    .forEach((button) => {
      button.classList.toggle("cgpt-active", button.dataset.modeId === modeId);
    });
}

function detectCurrentModeFromPage() {
  const menuSelected = document.querySelector('[role="menuitem"][aria-current="true"], [role="option"][aria-selected="true"]');
  if (menuSelected) {
    return matchModeFromText(menuSelected.textContent);
  }

  const trigger = findModeTrigger();
  if (trigger) {
    return matchModeFromText(trigger.textContent);
  }

  return null;
}

function matchModeFromText(text) {
  if (!text) return null;
  const normalized = text.toLowerCase();
  if (normalized.includes("auto")) return "auto";
  if (normalized.includes("instant")) return "instant";
  if (normalized.includes("thinking") && normalized.includes("light")) return "thinking-light";
  if (normalized.includes("thinking") && normalized.includes("standard")) return "thinking-standard";
  if (normalized.includes("thinking") && normalized.includes("extended")) return "thinking-extended";
  if (normalized.includes("thinking") && normalized.includes("heavy")) return "thinking-heavy";
  if (normalized.includes("pro") && normalized.includes("extend")) return "pro-extend";
  if (normalized.includes("pro")) return "pro";
  return null;
}

function updateModeFromPage() {
  const detected = detectCurrentModeFromPage();
  if (detected && detected !== currentModeId) {
    currentModeId = detected;
    updateActiveButton(detected);
  }
}

function shouldIgnoreHotkeys(event) {
  if (settings.allowWhenTyping) return false;
  const target = event.target;
  if (!target) return false;
  const tag = target.tagName?.toLowerCase();
  if (tag === "textarea" || tag === "input") return true;
  if (target.isContentEditable) return true;
  return false;
}

function normalizeHotkey(event) {
  const parts = [];
  if (event.altKey) parts.push("Alt");
  if (event.ctrlKey) parts.push("Ctrl");
  if (event.metaKey) parts.push("Meta");
  if (event.shiftKey) parts.push("Shift");

  const key = event.key.length === 1 ? event.key.toUpperCase() : event.key;
  if (!["Alt", "Control", "Shift", "Meta"].includes(key)) {
    parts.push(key);
  }

  return parts.join("+");
}

function handleHotkeys(event) {
  if (shouldIgnoreHotkeys(event)) return;

  const pressed = normalizeHotkey(event);
  const hotkeys = settings.hotkeys ?? {};

  const match = Object.entries(hotkeys).find(([, combo]) => combo === pressed);
  if (!match) return;

  event.preventDefault();
  const [modeId] = match;
  if (modeId === "previous") {
    if (settings.enablePreviousMode && previousModeId) {
      handleModeSwitch(previousModeId);
    }
    return;
  }

  handleModeSwitch(modeId);
}

function updateAvailability() {
  const input = document.querySelector("textarea");
  if (!input) {
    setPanelDisabled(true, "Not on a chat page");
    return;
  }
  setPanelDisabled(false, "Instant switching");
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function setupObservers() {
  const observer = new MutationObserver(() => {
    updateModeFromPage();
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });

  availabilityTimer = window.setInterval(updateAvailability, 2000);
}

async function init() {
  settings = await loadSettings();
  createPanel();
  applySettings();
  updateAvailability();
  updateModeFromPage();

  document.addEventListener("keydown", handleHotkeys);
  setupObservers();
}

init();
