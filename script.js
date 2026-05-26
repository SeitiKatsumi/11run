const state = {
  view: "home",
  calendarView: "month",
  cursor: new Date(),
  activities: [],
  goals: [],
  language: localStorage.getItem("appLanguage") || "pt-BR",
  integrations: {},
  directory: { teams: [], coaches: [] },
  athletes: [],
  selectedAthleteId: localStorage.getItem("selectedAthleteId") || "",
  currentUser: null,
  appSettings: null,
  aiProjection: null,
  dashboardAnalysis: null,
  historyTimelineDraft: [],
  historyTimelineFilter: "all",
  historyTimelineOutput: null,
  editingAthleteId: "",
  editingAdminUserId: "",
  adminMode: "athlete",
  expandedAdminUserId: "",
  syncing: false,
  collapsedPanels: (() => {
    const defaults = {
      focusProjection: true,
      focusRoadmap: true,
      goalForm: true,
      performanceChart: true,
      dashboardIntegrations: true
    };
    try {
      const raw = localStorage.getItem("collapsedPanels");
      if (!raw) return defaults;
      const parsed = JSON.parse(raw);
      return { ...defaults, ...(parsed && typeof parsed === "object" ?parsed : {}) };
    } catch {
      return defaults;
    }
  })()
};

const APP_VERSION_FALLBACK = "local-ui";
const SECRET_MASK = "********";
const languageOptions = {
  "pt-BR": "Português do Brasil",
  "pt-PT": "Português de Portugal",
  en: "English",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
  ja: "日本語",
  zh: "中文",
  sw: "Kiswahili"
};
const translations = {
  "pt-BR": {
    "nav.home": "HOME",
    "nav.dashboard": "MEU DASHBOARD",
    "nav.training": "TREINAMENTOS",
    "nav.goals": "OBJETIVOS",
    "nav.preferences": "PREFERÊNCIAS",
    "nav.settings": "CONFIGURAÇÕES",
    "profile.language": "Idioma",
    "profile.expand": "Expandir painel",
    "profile.collapse": "Fechar painel",
    "profile.close": "Fechar"
  },
  "pt-PT": {
    "nav.home": "INÍCIO",
    "nav.dashboard": "O MEU DASHBOARD",
    "nav.training": "TREINOS",
    "nav.goals": "OBJETIVOS",
    "nav.preferences": "PREFERÊNCIAS",
    "nav.settings": "CONFIGURAÇÕES",
    "profile.language": "Idioma",
    "profile.expand": "Expandir painel",
    "profile.collapse": "Fechar painel",
    "profile.close": "Fechar"
  },
  en: {
    "nav.home": "HOME",
    "nav.dashboard": "MY DASHBOARD",
    "nav.training": "TRAINING",
    "nav.goals": "GOALS",
    "nav.preferences": "PREFERENCES",
    "nav.settings": "SETTINGS",
    "profile.language": "Language",
    "profile.expand": "Expand panel",
    "profile.collapse": "Close panel",
    "profile.close": "Close"
  },
  es: {
    "nav.home": "INICIO",
    "nav.dashboard": "MI DASHBOARD",
    "nav.training": "ENTRENAMIENTOS",
    "nav.goals": "OBJETIVOS",
    "nav.preferences": "PREFERENCIAS",
    "nav.settings": "CONFIGURACIÓN",
    "profile.language": "Idioma",
    "profile.expand": "Expandir panel",
    "profile.collapse": "Cerrar panel",
    "profile.close": "Cerrar"
  },
  fr: {
    "nav.home": "ACCUEIL",
    "nav.dashboard": "MON DASHBOARD",
    "nav.training": "ENTRAÎNEMENTS",
    "nav.goals": "OBJECTIFS",
    "nav.preferences": "PRÉFÉRENCES",
    "nav.settings": "PARAMÈTRES",
    "profile.language": "Langue",
    "profile.expand": "Développer le panneau",
    "profile.collapse": "Fermer le panneau",
    "profile.close": "Fermer"
  },
  de: {
    "nav.home": "START",
    "nav.dashboard": "MEIN DASHBOARD",
    "nav.training": "TRAINING",
    "nav.goals": "ZIELE",
    "nav.preferences": "EINSTELLUNGEN",
    "nav.settings": "VERWALTUNG",
    "profile.language": "Sprache",
    "profile.expand": "Panel erweitern",
    "profile.collapse": "Panel schließen",
    "profile.close": "Schließen"
  },
  ja: {
    "nav.home": "ホーム",
    "nav.dashboard": "マイダッシュボード",
    "nav.training": "トレーニング",
    "nav.goals": "目標",
    "nav.preferences": "設定",
    "nav.settings": "管理設定",
    "profile.language": "言語",
    "profile.expand": "パネルを展開",
    "profile.collapse": "パネルを閉じる",
    "profile.close": "閉じる"
  },
  zh: {
    "nav.home": "首页",
    "nav.dashboard": "我的仪表盘",
    "nav.training": "训练",
    "nav.goals": "目标",
    "nav.preferences": "偏好设置",
    "nav.settings": "设置",
    "profile.language": "语言",
    "profile.expand": "展开面板",
    "profile.collapse": "关闭面板",
    "profile.close": "关闭"
  },
  sw: {
    "nav.home": "NYUMBANI",
    "nav.dashboard": "DASHIBODI YANGU",
    "nav.training": "MAZOEZI",
    "nav.goals": "MALENGO",
    "nav.preferences": "MAPENDELEO",
    "nav.settings": "MIPANGILIO",
    "profile.language": "Lugha",
    "profile.expand": "Panua paneli",
    "profile.collapse": "Funga paneli",
    "profile.close": "Funga"
  }
};

const providerDefinitions = {
  strava: {
    name: "Strava",
    mark: "S",
    status: "OAuth oficial funcionando",
    strategy: "Use Client ID, Client Secret e Redirect URI. Depois clique em Conectar Strava para autorizar read, activity:read e activity:read_all.",
    fields: [
      ["clientId", "Client ID"],
      ["clientSecret", "Client Secret", "password"],
      ["redirectUri", "Redirect URI"],
      ["scopes", "Scopes"]
    ],
    docs: "https://developers.strava.com/docs/authentication/"
  },
  garmin: {
    name: "Garmin Connect",
    mark: "G",
    status: "API oficial exige aprovação",
    strategy: "O caminho correto é o Garmin Connect Developer Program. Para atividades, solicite Activity API/Activity Export. Sem aprovação, não existe API pública oficial para puxar o Garmin Connect diretamente.",
    fields: [
      ["clientId", "Consumer Key / Client ID"],
      ["clientSecret", "Consumer Secret / Client Secret", "password"],
      ["redirectUri", "Redirect URI"],
      ["permissions", "Permissões solicitadas"],
      ["webhookUrl", "Webhook de notificação"],
      ["environment", "Ambiente"]
    ],
    docs: "https://developer.garmin.com/gc-developer-program/overview/"
  },
  coros: {
    name: "COROS",
    mark: "C",
    status: "Acesso restrito por aplicação",
    strategy: "A COROS pede submissão de aplicação/API. Até aprovar, a alternativa prática é importar via Strava, TrainingPeaks, Intervals.icu ou arquivo FIT.",
    fields: [
      ["apiApplicationStatus", "Status da aplicação API"],
      ["partnerClientId", "Partner Client ID"],
      ["partnerClientSecret", "Partner Client Secret", "password"],
      ["redirectUri", "Redirect URI"],
      ["fallbackProvider", "Fallback de sincronização"],
      ["fallbackApiKey", "Fallback API Key", "password"]
    ],
    docs: "https://support.coros.com/hc/en-us/articles/17085887816340-Submitting-an-API-Application"
  },
  polar: {
    name: "Polar AccessLink",
    mark: "P",
    status: "OAuth oficial disponível",
    strategy: "Polar AccessLink usa Client ID/Secret, OAuth e depois registro do usuário para transações de exercícios. Histórico anterior ao consentimento pode ser limitado.",
    fields: [
      ["clientId", "Client ID"],
      ["clientSecret", "Client Secret", "password"],
      ["redirectUri", "Redirect URI"],
      ["accessToken", "Access Token manual", "password"],
      ["userId", "Polar User ID"]
    ],
    docs: "https://www.polar.com/accesslink-api/"
  },
  suunto: {
    name: "Suunto",
    mark: "SU",
    status: "Partner/API Zone",
    strategy: "Suunto API Zone usa OAuth e chave de assinatura para APIs em Azure API Management. A Workout API exige app aprovado.",
    fields: [
      ["clientId", "Client ID"],
      ["clientSecret", "Client Secret", "password"],
      ["redirectUri", "Redirect URI"],
      ["subscriptionKey", "Ocp-Apim-Subscription-Key", "password"],
      ["apiBaseUrl", "OAuth base URL"],
      ["workoutApiBaseUrl", "Workout API base URL"]
    ],
    docs: "https://apizone.suunto.com/apis"
  }
};

const weekdayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
const weekdayNamesMonday = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"];
const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const focusDistanceLabels = {
  800: "800 m",
  1500: "1500 m",
  3000: "3000 m",
  5000: "5000 m",
  10000: "10000 m",
  15000: "15 km",
  21000: "21 km",
  42000: "42 km"
};

const trainingTypeOptions = [
  "Treino",
  "Leve / base",
  "Regenerativo",
  "Recuperação",
  "Longo",
  "Longo progressivo",
  "Longo com variação",
  "Ritmo / tempo",
  "Limiar",
  "Progressivo",
  "Fartlek",
  "Intervalado curto",
  "Intervalado longo",
  "VO2 / intervalado",
  "Tiros curtos / strides",
  "Montanha / subida",
  "Técnica / educativos",
  "Fortalecimento",
  "Isometria",
  "Pliometria",
  "Mobilidade / alongamento",
  "Cross-training",
  "Prova",
  "Teste"
];

function trainingTypeOptionsHtml(selected = "Treino") {
  return trainingTypeOptions
    .map((option) => `<option value="${escapeHtml(option)}" ${option === selected ?"selected" : ""}>${escapeHtml(option)}</option>`)
    .join("");
}

function friendlyAiError(message = "") {
  const text = String(message || "");
  if (/request id|processing your request|help\.openai\.com/i.test(text)) {
    return "OpenAI temporariamente indisponível. O modelo local 11RUN foi aplicado.";
  }
  if (/401|api key|unauthorized|invalid/i.test(text)) return "API key inválida ou sem permissão para chamadas OpenAI.";
  if (/429|rate limit|quota/i.test(text)) return "Limite da OpenAI atingido. Tente novamente em instantes.";
  if (/model|404|400/i.test(text)) return "Modelo OpenAI indisponível para esta chave. Ajuste o modelo nas configurações.";
  return text || "Não foi possível concluir a análise externa. O modelo local 11RUN foi aplicado.";
}

const calendar = document.querySelector("#calendar");
const dialog = document.querySelector("#activityDialog");
const detail = document.querySelector("#activityDetail");
const shell = document.querySelector("#appShell");
const menuToggle = document.querySelector("#menuToggle");
const railBackdrop = document.querySelector("#railBackdrop");

function isSuperAdmin() {
  return state.currentUser?.role === "admin";
}

function canManageAthletes() {
  return ["admin", "manager", "coach"].includes(state.currentUser?.role);
}

function isMobileLayout() {
  return window.matchMedia("(max-width: 900px)").matches;
}

function setMenuOpen(open) {
  if (!shell) return;
  shell.classList.toggle("menu-open", open);
  if (menuToggle) menuToggle.setAttribute("aria-expanded", open ?"true" : "false");
}

function setRailCollapsed(collapsed) {
  if (!shell) return;
  shell.classList.toggle("rail-collapsed", collapsed);
  localStorage.setItem("railCollapsed", collapsed ?"1" : "0");
}

function toggleMenu() {
  if (!shell) return;
  if (isMobileLayout()) {
    setMenuOpen(!shell.classList.contains("menu-open"));
    return;
  }
  setRailCollapsed(!shell.classList.contains("rail-collapsed"));
}

function closeMobileMenu() {
  if (isMobileLayout()) setMenuOpen(false);
}

function isPanelCollapsed(key) {
  return Boolean(state.collapsedPanels?.[key]);
}

function setPanelCollapsed(key, collapsed) {
  state.collapsedPanels = state.collapsedPanels || {};
  state.collapsedPanels[key] = Boolean(collapsed);
  localStorage.setItem("collapsedPanels", JSON.stringify(state.collapsedPanels));
}

function mountCollapsibleSection(panel, key, label) {
  if (!panel) return;
  let content = panel.querySelector(":scope > .panel-collapse-content");
  if (!content) {
    content = document.createElement("div");
    content.className = "panel-collapse-content";
    const nodes = Array.from(panel.childNodes);
    nodes.forEach((node) => {
      if (node.nodeType === 1 && node.classList.contains("panel-collapse-control")) return;
      content.appendChild(node);
    });
    panel.appendChild(content);
  }
  let control = panel.querySelector(":scope > .panel-collapse-control");
  if (!control) {
    control = document.createElement("div");
    control.className = "panel-collapse-control";
    control.innerHTML = `
      <button class="panel-toggle-text" type="button" data-toggle-panel="${escapeHtml(key)}" aria-label="Alternar painel ${escapeHtml(label)}">
        <span class="kicker">${escapeHtml(label)}</span>
      </button>
      <button class="secondary-action compact" type="button" data-toggle-panel="${escapeHtml(key)}">${escapeHtml(t("profile.expand"))}</button>
    `;
    panel.insertBefore(control, panel.firstChild);
  }
  const collapsed = isPanelCollapsed(key);
  panel.classList.toggle("is-collapsed", collapsed);
  content.hidden = collapsed;
  const button = control.querySelector(`.secondary-action[data-toggle-panel="${key}"]`);
  if (button) button.textContent = collapsed ?t("profile.expand") : t("profile.collapse");
}

function applyPanelCollapse(panel, key, label) {
  mountCollapsibleSection(panel, key, label);
}

function t(key) {
  return translations[state.language]?.[key] || translations["pt-BR"][key] || key;
}

function applyI18n() {
  document.documentElement.lang = state.language;
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
}

const controlIconPaths = {
  month: `<rect x="3" y="4" width="18" height="17" rx="2"></rect><path d="M8 2v4M16 2v4M3 10h18"></path>`,
  quarter: `<path d="M4 5h16M4 12h16M4 19h16"></path><path d="M8 5v14M14 5v14"></path>`,
  semester: `<path d="M4 6h16v12H4z"></path><path d="M8 6v12M12 6v12M16 6v12"></path>`,
  year: `<circle cx="12" cy="12" r="8"></circle><path d="M12 4v16M4 12h16"></path>`,
  athlete: `<circle cx="12" cy="8" r="3.2"></circle><path d="M5 20c1.3-3.6 4-5.4 7-5.4s5.7 1.8 7 5.4"></path>`,
  coach: `<path d="M4 19V5l8-2 8 2v14"></path><path d="M8 11h8M8 15h5"></path>`,
  team: `<circle cx="8" cy="9" r="2.5"></circle><circle cx="16" cy="9" r="2.5"></circle><path d="M4 20c.8-3.1 2.4-4.6 4-4.6s3.2 1.5 4 4.6M12 20c.8-3.1 2.4-4.6 4-4.6s3.2 1.5 4 4.6"></path>`,
  admin: `<path d="M12 3l7 3v5c0 4.6-2.8 7.9-7 10-4.2-2.1-7-5.4-7-10V6l7-3z"></path><path d="M9 12l2 2 4-5"></path>`,
  single: `<path d="M12 3v18"></path><path d="M7 8h10M7 16h10"></path>`,
  week: `<rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M3 10h18M8 14h.01M12 14h.01M16 14h.01"></path>`,
  audio: `<path d="M12 4v16"></path><path d="M8 8v8M16 8v8M4 11v2M20 11v2"></path>`,
  workout: `<path d="M6 19V5"></path><path d="M18 19V5"></path><path d="M3 9h3M18 9h3M3 15h3M18 15h3M8 12h8"></path>`
};

function controlIconSvg(key) {
  return `<svg class="control-icon" viewBox="0 0 24 24" aria-hidden="true">${controlIconPaths[key] || controlIconPaths.single}</svg>`;
}

function enhanceSystemControls() {
  const controls = [
    ...document.querySelectorAll("[data-calendar-view]"),
    ...document.querySelectorAll("[data-admin-mode]"),
    ...document.querySelectorAll("[data-workout-mode]"),
    ...document.querySelectorAll("[data-open-workout-builder]")
  ];
  controls.forEach((button) => {
    if (button.dataset.controlEnhanced === "1") return;
    const label = button.textContent.trim();
    const key = button.dataset.calendarView
      || button.dataset.adminMode
      || button.dataset.workoutMode
      || (button.matches("[data-open-workout-builder]") ? "workout" : "single");
    button.dataset.controlEnhanced = "1";
    button.classList.add("system-control-button");
    button.innerHTML = `${controlIconSvg(key)}<span>${escapeHtml(label)}</span>`;
  });
}

async function api(path, options = {}) {
  const scopedPaths = ["/api/integrations", "/api/activities", "/api/goals", "/api/sync", "/api/strava/auth", "/api/strava/test", "/api/strava/enrich", "/api/ai/projection", "/api/ai/test"];
  const shouldScopeAthlete = scopedPaths.some((prefix) => path.startsWith(prefix));
  const athleteHeaders = shouldScopeAthlete && state.selectedAthleteId ?{ "X-Athlete-Id": state.selectedAthleteId } : {};
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...athleteHeaders, ...(options.headers || {}) },
    ...options
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Erro HTTP ${response.status}`);
  return payload;
}

function showLogin(message = "") {
  document.querySelector("#loginScreen").hidden = false;
  document.querySelector("#appShell").hidden = true;
  document.querySelector("#loginMessage").textContent = message;
}

function showApp() {
  document.querySelector("#loginScreen").hidden = true;
  document.querySelector("#appShell").hidden = false;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function dateKey(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function startOfWeek(date) {
  return addDays(date, -date.getDay());
}

function startOfMondayWeek(date) {
  return addDays(date, -((date.getDay() + 6) % 7));
}

function setView(view) {
  if (view === "settings" && !canManageAthletes()) view = "athlete";
  state.view = view;
  document.querySelectorAll("[data-view]").forEach((section) => section.classList.toggle("is-visible", section.dataset.view === view));
  document.querySelectorAll("[data-view-link]").forEach((link) => link.classList.toggle("is-active", link.dataset.viewLink === view));
  if (view === "athlete") editCurrentUserProfile();
  if (view === "dashboard") renderDashboard();
  if (view === "home") renderHomeMotivation();
  location.hash = view === "training" ?"treinamentos" : view === "goals" ?"objetivos" : view === "athlete" ?"preferencias" : view === "settings" ?"configuracoes" : view === "dashboard" ?"dashboard" : "home";
  closeMobileMenu();
}

function viewFromHash(hash) {
  if (hash === "treinamentos") return "training";
  if (hash === "objetivos") return "goals";
  if (hash === "dashboard") return "dashboard";
  if (hash === "configuracoes" || hash === "configuracao") return "settings";
  if (hash === "atleta" || hash === "preferencias") return "athlete";
  return "home";
}

function syncCalendarViewButtons() {
  document.querySelectorAll("[data-calendar-view]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.calendarView === state.calendarView);
  });
}

function normalizeDateKey(value) {
  if (value instanceof Date) return dateKey(value);
  const text = String(value || "").trim();
  const isoDate = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoDate) return isoDate[1];
  const brDate = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (brDate) return `${brDate[3]}-${brDate[2].padStart(2, "0")}-${brDate[1].padStart(2, "0")}`;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ?"" : dateKey(parsed);
}

function normalizeActivity(activity) {
  return {
    ...activity,
    date: normalizeDateKey(activity.date)
  };
}

function visibleActivities() {
  return state.activities
    .map(normalizeActivity)
    .filter((activity) => activity.date)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

function activityDate(activity) {
  const normalized = normalizeDateKey(activity.date);
  if (!normalized) return null;
  const [year, month, day] = normalized.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ?null : date;
}

function periodRange(view = state.calendarView, cursor = state.cursor) {
  const base = new Date(cursor);
  if (view === "week") {
    const start = startOfWeek(base);
    return { start, end: addDays(start, 6), days: 7, unit: "day", label: "Semana" };
  }
  if (view === "day") {
    const start = addDays(base, -13);
    return { start, end: base, days: 14, unit: "day", label: "Ultimos 14 dias" };
  }
  if (view === "quarter") {
    const quarterStartMonth = Math.floor(base.getMonth() / 3) * 3;
    const start = new Date(base.getFullYear(), quarterStartMonth, 1);
    const weeks = 12;
    const end = addDays(start, weeks * 7 - 1);
    return {
      start,
      end,
      days: weeks,
      unit: "week",
      label: `Trimestre ${Math.floor(quarterStartMonth / 3) + 1}/${base.getFullYear()}`
    };
  }
  if (view === "semester") {
    const semesterStartMonth = base.getMonth() < 6 ?0 : 6;
    const start = new Date(base.getFullYear(), semesterStartMonth, 1);
    const weeks = 24;
    const end = addDays(start, weeks * 7 - 1);
    return {
      start,
      end,
      days: weeks,
      unit: "week",
      label: `Semestre ${semesterStartMonth === 0 ?1 : 2}/${base.getFullYear()}`
    };
  }
  if (view === "year") {
    const start = new Date(base.getFullYear(), 0, 1);
    const weeks = 48;
    const end = addDays(start, weeks * 7 - 1);
    return {
      start,
      end,
      days: weeks,
      unit: "week",
      label: `${base.getFullYear()}`
    };
  }
  const start = new Date(base.getFullYear(), base.getMonth(), 1);
  const end = new Date(base.getFullYear(), base.getMonth() + 1, 0);
  return { start, end, days: end.getDate(), unit: "day", label: `${monthNames[base.getMonth()]} ${base.getFullYear()}` };
}

function hasActivitiesInCurrentRange() {
  const activities = visibleActivities();
  if (!activities.length) return false;
  if (state.calendarView === "month") {
    return activities.some((activity) => {
      const date = activityDate(activity);
      return date && date.getFullYear() === state.cursor.getFullYear() && date.getMonth() === state.cursor.getMonth();
    });
  }
  if (state.calendarView === "week") {
    const start = startOfWeek(state.cursor);
    const end = addDays(start, 6);
    return activities.some((activity) => {
      const date = activityDate(activity);
      return date && date >= start && date <= end;
    });
  }
  if (state.calendarView === "quarter" || state.calendarView === "semester") {
    const range = periodRange();
    return activities.some((activity) => {
      const date = activityDate(activity);
      return date && date >= range.start && date <= range.end;
    });
  }
  if (state.calendarView === "year") {
    return activities.some((activity) => {
      const date = activityDate(activity);
      return date && date.getFullYear() === state.cursor.getFullYear();
    });
  }
  return activities.some((activity) => activity.date === dateKey(state.cursor));
}

function parseDistanceKm(distance) {
  const match = String(distance || "").replace(",", ".").match(/[\d.]+/);
  return match ?Number(match[0]) : 0;
}

function parseDurationSeconds(duration) {
  const text = String(duration || "").trim();
  if (!text || text === "--") return 0;
  const parts = text.split(":").map((part) => Number(part));
  if (parts.some((part) => !Number.isFinite(part))) return 0;
  if (parts.length === 2) return (parts[0] * 60) + parts[1];
  if (parts.length === 3) return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
  return 0;
}

function formatDurationSeconds(totalSeconds) {
  const value = Math.max(0, Math.round(Number(totalSeconds || 0)));
  if (!value) return "--";
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const seconds = value % 60;
  if (hours) return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function activityDistanceMeters(activity) {
  return Number(activity.distanceMeters || 0) || parseDistanceKm(activity.distance) * 1000;
}

function activityMovingSeconds(activity) {
  return Number(activity.movingTimeSeconds || activity.elapsedTimeSeconds || 0) || parseDurationSeconds(activity.duration);
}

function isRunningActivity(activity) {
  const type = String(activity.type || "").toLowerCase();
  return !type || type.includes("run") || type.includes("corrida");
}

function activitiesSince(days) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - days + 1);
  return visibleActivities().filter((activity) => {
    const date = activityDate(activity);
    return date && date >= start;
  });
}

function formatKm(value) {
  if (!value) return "--";
  return `${value.toFixed(value >= 10 ?1 : 2)} km`;
}

function projectTime(seconds, fromMeters, toMeters) {
  if (!seconds || !fromMeters || !toMeters) return 0;
  return seconds * Math.pow(toMeters / fromMeters, 1.06);
}

function collectFocusPerformances(athlete) {
  const targetMeters = Number(athlete?.focusDistanceM || 0);
  if (!targetMeters) return { targetMeters: 0, candidates: [], direct: [] };
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 90);
  const candidates = [];
  const direct = [];

  visibleActivities()
    .filter((activity) => isRunningActivity(activity))
    .filter((activity) => {
      const date = activityDate(activity);
      return date && date >= start;
    })
    .forEach((activity) => {
      const date = activityDate(activity);
      const efforts = Array.isArray(activity.bestEfforts) ?activity.bestEfforts : [];
      efforts.forEach((effort) => {
        const distanceMeters = Number(effort.distanceMeters || 0);
        const seconds = Number(effort.movingTimeSeconds || effort.elapsedTimeSeconds || 0);
        if (!distanceMeters || !seconds) return;
        const ratio = distanceMeters / targetMeters;
        const projectedSeconds = projectTime(seconds, distanceMeters, targetMeters);
        const item = {
          source: "best effort Strava",
          activity,
          date,
          distanceMeters,
          seconds,
          projectedSeconds
        };
        if (Math.abs(ratio - 1) <= 0.05) direct.push(item);
        if (ratio >= 0.35 && ratio <= 2.5) candidates.push(item);
      });

      const distanceMeters = activityDistanceMeters(activity);
      const seconds = activityMovingSeconds(activity);
      if (!distanceMeters || !seconds) return;
      const ratio = distanceMeters / targetMeters;
      const item = {
        source: "atividade",
        activity,
        date,
        distanceMeters,
        seconds,
        projectedSeconds: projectTime(seconds, distanceMeters, targetMeters)
      };
      if (Math.abs(ratio - 1) <= 0.08) direct.push(item);
      if (ratio >= 0.35 && ratio <= 2.5) candidates.push(item);
    });

  candidates.sort((a, b) => a.projectedSeconds - b.projectedSeconds);
  direct.sort((a, b) => a.seconds - b.seconds);
  return { targetMeters, candidates, direct };
}

function renderFocusProjection() {
  const target = document.querySelector("#focusProjection");
  if (!target) return;
  const athlete = getActiveAthlete();
  const focusMeters = Number(athlete?.focusDistanceM || 0);
  if (!athlete || !focusMeters) {
    target.innerHTML = `
      <div class="focus-projection-empty">
        <span>Prova foco</span>
        <strong>Defina a prova foco do atleta</strong>
        <p>Informe distância, tempo alvo e data no cadastro para ativar a projeção.</p>
      </div>
    `;
    mountCollapsibleSection(target, "focusProjection", "Projeção da prova foco");
    return;
  }

  const { candidates, direct } = collectFocusPerformances(athlete);
  const manualBest = Number(athlete.bestTimeSeconds || 0);
  const bestDirect = direct[0];
  const bestCandidate = candidates[0];
  const baselineSeconds = manualBest || bestDirect?.seconds || bestCandidate?.projectedSeconds || 0;
  const projectedSeconds = bestCandidate?.projectedSeconds || baselineSeconds;
  const targetSeconds = Number(athlete.targetTimeSeconds || 0);
  const gapSeconds = targetSeconds && projectedSeconds ?Math.round(projectedSeconds - targetSeconds) : 0;
  const gapLabel = !targetSeconds ?"sem alvo" : gapSeconds <= 0 ?`${formatDurationSeconds(Math.abs(gapSeconds))} abaixo do alvo` : `${formatDurationSeconds(gapSeconds)} acima do alvo`;
  const bestRecentLabel = bestDirect
    ?`${formatDurationSeconds(bestDirect.seconds)} em ${bestDirect.activity.title}`
    : manualBest
      ?`${formatDurationSeconds(manualBest)} informado manualmente`
      : "sem marca recente";
  const recentTimesLabel = direct.length
    ?direct.slice(0, 3).map((item) => formatDurationSeconds(item.seconds)).join(" / ")
    : "sem tempos importados";
  const dateLabel = athlete.targetDate
    ?new Date(`${athlete.targetDate}T00:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
    : "data não definida";

  target.innerHTML = `
    <div class="focus-projection-head">
      <div>
        <p class="kicker">Projeção da prova foco</p>
        <h3>${escapeHtml(focusDistanceLabels[focusMeters] || `${focusMeters} m`)}</h3>
      </div>
      <strong>${escapeHtml(projectedSeconds ?formatDurationSeconds(projectedSeconds) : "--")}</strong>
    </div>
    <div class="focus-projection-grid">
      <div><span>Tempo alvo</span><strong>${escapeHtml(targetSeconds ?formatDurationSeconds(targetSeconds) : "--")}</strong><p>${escapeHtml(dateLabel)}</p></div>
      <div><span>Diferença</span><strong>${escapeHtml(gapLabel)}</strong><p>comparado com a projeção atual</p></div>
      <div><span>Melhor 90 dias</span><strong>${escapeHtml(bestRecentLabel)}</strong><p>${escapeHtml(`tempos: ${recentTimesLabel}`)}</p></div>
      <div><span>Modelo</span><strong>Riegel + 11TSS</strong><p>corridas reais e best efforts do Strava</p></div>
    </div>
  `;
  mountCollapsibleSection(target, "focusProjection", "Projeção da prova foco");
}

function collect3000Tests(athlete) {
  const manual = Array.isArray(athlete?.tests3000) ?athlete.tests3000 : [];
  const fromManual = manual
    .filter((test) => test.timeSeconds)
    .map((test) => ({
      date: test.date ?new Date(`${test.date}T00:00:00`) : null,
      seconds: Number(test.timeSeconds),
      source: `Manual: ${test.notes || "teste 3000"}`,
      origin: "Manual",
      title: test.notes || "Teste de 3000 m",
      details: "Cadastro manual"
    }));
  const flaggedActivities = visibleActivities()
    .filter((activity) => isRunningActivity(activity) && activity.is3000Test)
    .map((activity) => ({
      date: activityDate(activity),
      seconds: parseDurationSeconds(activity.duration),
      source: `Strava: ${activity.title}`,
      origin: "Strava",
      title: activity.title || "Teste de 3000 m",
      details: `${activity.distance || "--"} · ${activity.duration || "--"} · ${activity.description || "atividade importada"}`
    }))
    .filter((test) => test.seconds);
  const fromActivities = visibleActivities()
    .filter((activity) => isRunningActivity(activity))
    .flatMap((activity) => {
      const efforts = Array.isArray(activity.bestEfforts) ?activity.bestEfforts : [];
      return efforts
        .filter((effort) => Math.abs(Number(effort.distanceMeters || 0) - 3000) <= 80)
        .map((effort) => ({
          date: activityDate(activity),
          seconds: Number(effort.movingTimeSeconds || effort.elapsedTimeSeconds || 0),
          source: `Strava auto: ${activity.title}`,
          origin: "Strava auto",
          title: activity.title || "Teste de 3000 m",
          details: `${activity.distance || "--"} · ${activity.duration || "--"} · melhor esforço importado`
        }));
    })
    .filter((test) => test.seconds);
  const ranked = [...flaggedActivities, ...fromManual, ...fromActivities]
    .sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));
  const selected = [];
  const dedupe = new Set();
  for (const item of ranked) {
    const key = `${item.date ?dateKey(item.date) : "nd"}-${Math.round(Number(item.seconds || 0))}`;
    if (dedupe.has(key)) continue;
    dedupe.add(key);
    selected.push(item);
    if (selected.length >= 3) break;
  }
  return selected;
}

function buildFocusModel(athlete) {
  const focusMeters = Number(athlete?.focusDistanceM || 0);
  const targetSeconds = Number(athlete?.targetTimeSeconds || 0);
  const targetDate = athlete?.targetDate ?new Date(`${athlete.targetDate}T00:00:00`) : null;
  const { candidates, direct } = collectFocusPerformances(athlete);
  const tests3000 = collect3000Tests(athlete);
  const manualBest = Number(athlete?.bestTimeSeconds || 0);
  const bestCandidate = candidates[0];
  const directBest = direct[0];
  const projectedFromActivity = bestCandidate?.projectedSeconds || directBest?.seconds || 0;
  const projectedFromTest = tests3000[0]?.seconds && focusMeters ?projectTime(tests3000[0].seconds, 3000, focusMeters) : 0;
  const currentSeconds = Math.round(projectedFromActivity && projectedFromTest
    ?(projectedFromActivity * 0.35) + (projectedFromTest * 0.65)
    : projectedFromActivity || projectedFromTest || manualBest || 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysToRace = targetDate ?Math.max(0, Math.round((targetDate - today) / 86400000)) : 0;
  const recent90 = activitiesSince(90).filter(isRunningActivity);
  const recent30 = activitiesSince(30).filter(isRunningActivity);
  const recent14 = activitiesSince(14).filter(isRunningActivity);
  const weeklySessions = recent90.length / Math.max(1, 90 / 7);
  const volume90 = recent90.reduce((sum, activity) => sum + parseDistanceKm(activity.distance), 0);
  const volume30 = recent30.reduce((sum, activity) => sum + parseDistanceKm(activity.distance), 0);
  const volumeTrend = volume90 ?(volume30 * 3) / volume90 : 0;
  const consistency = Math.min(1, weeklySessions / 5);
  const freshness = recent14.length ?Math.min(1, recent14.length / 8) : 0.18;
  const testSignal = tests3000.length ?Math.min(1, tests3000.length / 3) : 0;
  const history = athleteHistoryText(athlete).toLowerCase();
  const measuredVo2 = (Array.isArray(athlete?.historyTimeline) ?athlete.historyTimeline : [])
    .filter((entry) => entry.type === "vo2" && Number(entry.vo2 || 0) > 0)
    .sort((a, b) => String(b.startDate || "").localeCompare(String(a.startDate || "")))[0];
  const riskPenalty = /(les|dor|inflama|fadiga|cansa|viagem|pausa|doente|posterior)/i.test(history) ?12 : 0;
  const chronology = buildChronologicalPerformanceAnalysis(athlete, tests3000);
  const gapPercent = targetSeconds && currentSeconds ?((currentSeconds - targetSeconds) / currentSeconds) * 100 : 0;
  const weeks = daysToRace / 7;
  const realisticGain = Math.max(0, weeks * (0.45 + consistency * 0.45 + testSignal * 0.18));
  const loadScore = (consistency * 28) + (Math.min(1.25, volumeTrend) * 18) + (freshness * 14) + (testSignal * 12);
  const probability = targetSeconds && currentSeconds
    ?Math.round(Math.max(4, Math.min(96, 54 + loadScore + realisticGain - Math.max(0, gapPercent) * 5.2 - riskPenalty + chronology.probabilityModifier)))
    : 0;
  const status = !targetSeconds || !currentSeconds ?"Dados insuficientes" : probability >= 72 ?"Alta viabilidade" : probability >= 45 ?"Viabilidade moderada" : "Alvo agressivo";
  const requiredGain = targetSeconds && currentSeconds ?Math.max(0, currentSeconds - targetSeconds) : 0;
  const requiredPerWeek = weeks && requiredGain ?requiredGain / weeks : 0;
  return {
    focusMeters,
    targetSeconds,
    currentSeconds,
    targetDate,
    daysToRace,
    probability,
    status,
    requiredGain,
    requiredPerWeek,
    tests3000,
    volume30,
    weeklySessions,
    historyRisk: riskPenalty > 0
  };
}

function renderFocusRoadmap() {
  const target = document.querySelector("#focusRoadmap");
  if (!target) return;
  const athlete = getActiveAthlete();
  const model = buildFocusModel(athlete);
  if (!athlete || !model.focusMeters || !model.targetSeconds || !model.targetDate) {
    target.innerHTML = `
      <div class="focus-projection-empty">
        <span>Caminho até a prova</span>
        <strong>Configure prova foco, tempo alvo e data</strong>
        <p>A projeção usa 11TSS, volume, consistência, testes de 3000 m e histórico do atleta.</p>
      </div>
    `;
    mountCollapsibleSection(target, "focusRoadmap", "Rota preditiva até a prova");
    return;
  }
  const width = 920;
  const height = 118;
  const pad = { left: 42, right: 38, top: 20, bottom: 28 };
  const startY = 38;
  const targetY = 78;
  const endX = width - pad.right;
  const startX = pad.left;
  const todayX = model.daysToRace ?startX + Math.min(1, Math.max(0, 0)) * (endX - startX) : startX;
  const targetLabel = model.targetDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  const aiText = state.aiProjection?.text || "A análise preditiva considera carga 11TSS, distribuição de intensidade, regularidade, recência dos testes de 3000 m e histórico clínico/operacional informado.";
  target.innerHTML = `
    <div class="roadmap-head">
      <div>
        <p class="kicker">Rota preditiva até a prova</p>
        <h3>${escapeHtml(focusDistanceLabels[model.focusMeters] || `${model.focusMeters} m`)}: projeção atual para tempo alvo</h3>
      </div>
      <div class="probability-badge"><strong>${model.probability || "--"}%</strong><span>probabilidade</span></div>
    </div>
    <div class="roadmap-grid">
      <div class="roadmap-metric"><span>Projeção atual</span><strong>${escapeHtml(formatDurationSeconds(model.currentSeconds))}</strong><p>${escapeHtml(model.status)}</p></div>
      <div class="roadmap-metric"><span>Tempo alvo</span><strong>${escapeHtml(formatDurationSeconds(model.targetSeconds))}</strong><p>${escapeHtml(targetLabel)} - ${model.daysToRace} dias</p></div>
      <div class="roadmap-metric"><span>Ganho necessário</span><strong>${escapeHtml(formatDurationSeconds(model.requiredGain))}</strong><p>${escapeHtml(formatDurationSeconds(model.requiredPerWeek))} por semana</p></div>
      <div class="roadmap-metric"><span>Base recente</span><strong>${escapeHtml(formatKm(model.volume30))}</strong><p>${model.weeklySessions.toFixed(1)} sessões/semana ${model.historyRisk ?"- atenção ao histórico" : ""}</p></div>
    </div>
    <div class="roadmap-chart">
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Caminho preditivo ate a prova">
        <line x1="${startX}" y1="${targetY}" x2="${endX}" y2="${targetY}" />
        <path class="roadmap-required" d="M ${startX} ${startY} C ${width * 0.38} ${startY + 8}, ${width * 0.62} ${targetY - 10}, ${endX} ${targetY}" />
        <path class="roadmap-current" d="M ${startX} ${startY} C ${width * 0.28} ${startY + 2}, ${width * 0.42} ${startY + 10}, ${width * 0.52} ${startY + 14}" />
        <circle cx="${startX}" cy="${startY}" r="3" fill="#ff4b0b" />
        <circle cx="${endX}" cy="${targetY}" r="3" fill="#f3efe8" />
        <text x="${startX}" y="${height - 10}" text-anchor="start">Hoje - ${escapeHtml(formatDurationSeconds(model.currentSeconds))}</text>
        <text x="${endX}" y="${height - 10}" text-anchor="end">${escapeHtml(targetLabel)} - ${escapeHtml(formatDurationSeconds(model.targetSeconds))}</text>
      </svg>
    </div>
    <p class="roadmap-ai">${escapeHtml(aiText)}</p>
    <div class="roadmap-actions"><button class="secondary-action compact" type="button" data-refresh-ai>Atualizar análise IA</button></div>
  `;
  mountCollapsibleSection(target, "focusRoadmap", "Rota preditiva até a prova");
}

function goalAsAthlete(goal) {
  const athlete = getActiveAthlete() || {};
  const raceDate = normalizeDateKey(goal.raceDate);
  return {
    ...athlete,
    focusDistanceM: goal.distanceM,
    targetTimeSeconds: goal.targetTimeSeconds,
    targetTime: goal.targetTime,
    targetDate: raceDate,
    bestTimeSeconds: 0
  };
}

function isPastGoal(goal) {
  const raceKey = normalizeDateKey(goal.raceDate);
  const raceDate = raceKey ?new Date(`${raceKey}T00:00:00`) : null;
  if (!raceDate || Number.isNaN(raceDate.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return raceDate < today;
}

function goalDateLabel(goal) {
  if (!goal.raceDate) return "data não definida";
  return new Date(`${goal.raceDate}T00:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function goalDateLabel(goal) {
  const raceKey = normalizeDateKey(goal.raceDate);
  if (!raceKey) return "data nao definida";
  return new Date(`${raceKey}T00:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function goalResultPerformance(goal) {
  const targetMeters = Number(goal.distanceM || 0);
  const raceKey = normalizeDateKey(goal.raceDate);
  if (!raceKey || !targetMeters) return null;
  const candidates = [];
  visibleActivities()
    .filter((activity) => normalizeDateKey(activity.date) === raceKey && isRunningActivity(activity))
    .forEach((activity) => {
      const efforts = Array.isArray(activity.bestEfforts) ?activity.bestEfforts : [];
      efforts.forEach((effort) => {
        const distanceMeters = Number(effort.distanceMeters || 0);
        const seconds = Number(effort.movingTimeSeconds || effort.elapsedTimeSeconds || 0);
        if (distanceMeters && seconds && Math.abs(distanceMeters / targetMeters - 1) <= 0.06) {
          candidates.push({ seconds, title: activity.title, source: "best effort Strava" });
        }
      });
      const distanceMeters = activityDistanceMeters(activity);
      const seconds = activityMovingSeconds(activity);
      if (distanceMeters && seconds && Math.abs(distanceMeters / targetMeters - 1) <= 0.08) {
        candidates.push({ seconds, title: activity.title, source: "atividade importada" });
      }
    });
  return candidates.sort((a, b) => a.seconds - b.seconds)[0] || null;
}

function goalProjectionProtocol(goal, model, actualSeconds = 0) {
  const current = Number(actualSeconds || model.currentSeconds || 0);
  const target = Number(goal.targetTimeSeconds || model.targetSeconds || 0);
  if (!current || !target) return null;
  const weeks = Math.max(0.5, Number(model.daysToRace || 0) / 7);
  const consistency = Math.min(1, Number(model.weeklySessions || 0) / 5);
  const testSignal = Math.min(1, Number(model.tests3000?.length || 0) / 3);
  const riskFactor = model.historyRisk ?0.72 : 1;
  const conservativeRate = (0.0018 + consistency * 0.0014 + testSignal * 0.0004) * riskFactor;
  const challengingRate = (0.0055 + consistency * 0.003 + testSignal * 0.001) * riskFactor;
  const conservativeEnd = current * (1 - Math.min(0.045, weeks * conservativeRate));
  const challengingEnd = current * (1 - Math.min(0.12, weeks * challengingRate));
  const requiredGain = Math.max(0, current - target);
  const conservativeGain = Math.max(0, current - conservativeEnd);
  const challengingGain = Math.max(conservativeGain + 1, current - challengingEnd);
  let probability = 0;
  if (!requiredGain) {
    probability = 94;
  } else if (requiredGain <= conservativeGain) {
    probability = 78 + (1 - requiredGain / Math.max(1, conservativeGain)) * 16;
  } else if (requiredGain <= challengingGain) {
    probability = 38 + (1 - ((requiredGain - conservativeGain) / Math.max(1, challengingGain - conservativeGain))) * 40;
  } else {
    probability = Math.max(4, 38 - ((requiredGain - challengingGain) / current) * 420);
  }
  const rounded = Math.round(Math.max(4, Math.min(94, probability)));
  return {
    current,
    target,
    conservativeEnd,
    challengingEnd,
    conservativeGain: Math.round(conservativeGain),
    challengingGain: Math.round(challengingGain),
    probability: rounded,
    status: rounded >= 78 ?"Dentro da faixa conservadora" : rounded >= 38 ?"Possivel, mas desafiador" : "Acima da faixa tangivel"
  };
}

function goalProjectionRoute(goal, model, actualSeconds = 0) {
  const protocol = goalProjectionProtocol(goal, model, actualSeconds);
  if (!protocol) return `<div class="goal-route-empty">Dados insuficientes para gerar a escala preditiva.</div>`;
  const { current, target, conservativeEnd, challengingEnd, conservativeGain, challengingGain } = protocol;
  const width = 620;
  const height = 132;
  const pad = { left: 58, right: 26, top: 16, bottom: 28 };
  const values = [current, target, challengingEnd, conservativeEnd].filter(Boolean);
  const fastest = Math.min(...values);
  const slowest = Math.max(...values);
  const spread = Math.max(20, slowest - fastest);
  const minYValue = Math.max(1, fastest - spread * 0.18);
  const maxYValue = slowest + spread * 0.18;
  const x = (ratio) => pad.left + ratio * (width - pad.left - pad.right);
  const y = (seconds) => pad.top + ((seconds - minYValue) / Math.max(1, maxYValue - minYValue)) * (height - pad.top - pad.bottom);
  const curve = (end) => `M ${x(0).toFixed(1)} ${y(current).toFixed(1)} C ${x(0.32).toFixed(1)} ${y(current - (current - end) * 0.28).toFixed(1)}, ${x(0.66).toFixed(1)} ${y(current - (current - end) * 0.72).toFixed(1)}, ${x(1).toFixed(1)} ${y(end).toFixed(1)}`;
  const ticks = Array.from({ length: 4 }, (_, index) => {
    const value = minYValue + ((maxYValue - minYValue) * index / 3);
    return { value, y: y(value) };
  }).reverse();
  const targetY = y(target);
  const currentY = y(current);
  const challengingY = y(challengingEnd);
  const conservativeY = y(conservativeEnd);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const raceKey = normalizeDateKey(goal.raceDate);
  const raceDate = raceKey ?new Date(`${raceKey}T00:00:00`) : addDays(today, Number(model.daysToRace || 0));
  const dateLabel = (date) => date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  const timelineTicks = [0, 0.33, 0.66, 1].map((ratio) => ({
    ratio,
    x: x(ratio),
    label: ratio === 0 ?`Hoje ${dateLabel(today)}` : ratio === 1 ?`Meta ${dateLabel(raceDate)}` : dateLabel(addDays(today, Math.round(Number(model.daysToRace || 0) * ratio)))
  }));
  return `
    <div class="goal-route">
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Rota preditiva com escala de tempo">
        ${ticks.map((tick) => `
          <line class="goal-route-grid" x1="${pad.left}" y1="${tick.y.toFixed(1)}" x2="${width - pad.right}" y2="${tick.y.toFixed(1)}"></line>
          <text class="goal-route-y" x="${pad.left - 10}" y="${(tick.y + 4).toFixed(1)}" text-anchor="end">${escapeHtml(formatDurationSeconds(tick.value))}</text>
        `).join("")}
        <line class="goal-route-axis" x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${height - pad.bottom}"></line>
        <line class="goal-route-axis" x1="${pad.left}" y1="${height - pad.bottom}" x2="${width - pad.right}" y2="${height - pad.bottom}"></line>
        ${timelineTicks.map((tick) => `
          <line class="goal-route-time-tick" x1="${tick.x.toFixed(1)}" y1="${height - pad.bottom}" x2="${tick.x.toFixed(1)}" y2="${height - pad.bottom + 5}"></line>
          <text class="goal-route-label" x="${tick.x.toFixed(1)}" y="${height - 8}" text-anchor="${tick.ratio === 0 ?"start" : tick.ratio === 1 ?"end" : "middle"}">${escapeHtml(tick.label)}</text>
        `).join("")}
        <line class="goal-route-target" x1="${pad.left}" y1="${targetY.toFixed(1)}" x2="${width - pad.right}" y2="${targetY.toFixed(1)}"></line>
        <path class="goal-route-optimistic" d="${curve(challengingEnd)}"></path>
        <path class="goal-route-conservative" d="${curve(conservativeEnd)}"></path>
        <circle class="goal-route-now" cx="${x(0).toFixed(1)}" cy="${currentY.toFixed(1)}" r="2.7"></circle>
        <circle class="goal-route-target-dot" cx="${x(1).toFixed(1)}" cy="${targetY.toFixed(1)}" r="3.2"></circle>
        <circle class="goal-route-optimistic-dot" cx="${x(1).toFixed(1)}" cy="${challengingY.toFixed(1)}" r="2.4"></circle>
        <circle class="goal-route-conservative-dot" cx="${x(1).toFixed(1)}" cy="${conservativeY.toFixed(1)}" r="2.4"></circle>
        <text class="goal-route-tag" x="${width - pad.right}" y="${Math.max(16, targetY - 8).toFixed(1)}" text-anchor="end">Objetivo ${escapeHtml(formatDurationSeconds(target))}</text>
      </svg>
      <div class="goal-route-legend">
        <span><i class="is-target"></i>Linha do objetivo</span>
        <span><i class="is-conservative"></i>Conservadora mais possivel: ${escapeHtml(formatDurationSeconds(conservativeGain))}</span>
        <span><i class="is-optimistic"></i>Possivel e desafiadora: ${escapeHtml(formatDurationSeconds(challengingGain))}</span>
      </div>
    </div>
  `;
}

function renderGoalCard(goal, resultMode = false) {
  const model = buildFocusModel(goalAsAthlete(goal));
  const detectedResult = resultMode ?goalResultPerformance(goal) : null;
  const actualSeconds = Number(goal.actualTimeSeconds || 0) || detectedResult?.seconds || 0;
  const referenceSeconds = actualSeconds || model.currentSeconds;
  const targetSeconds = Number(goal.targetTimeSeconds || 0);
  const gap = targetSeconds && referenceSeconds ?Math.round(referenceSeconds - targetSeconds) : 0;
  const gapLabel = !targetSeconds || !referenceSeconds
    ?"sem comparativo"
    : gap <= 0
      ?`${formatDurationSeconds(Math.abs(gap))} abaixo do objetivo`
      : `${formatDurationSeconds(gap)} acima do objetivo`;
  const protocol = goalProjectionProtocol(goal, model, resultMode && actualSeconds ?actualSeconds : 0);
  const protocolProbability = protocol?.probability || 0;
  const analysis = resultMode
    ?actualSeconds
      ?`Resultado ${detectedResult ?`detectado em ${detectedResult.title}` : "registrado"}: ${gapLabel}.`
      : "Data da prova vencida. Registre o resultado para gerar a análise versus objetivo."
    : `${protocol?.status || "Dados insuficientes"} - ${protocolProbability || 0}% pela faixa tangivel.`;
  return `
    <article class="goal-card ${resultMode ?"goal-card-result" : ""}">
      <div class="goal-card-head">
        <div>
          <span>${escapeHtml(focusDistanceLabels[goal.distanceM] || `${goal.distanceM} m`)}</span>
          <h4>${escapeHtml(goal.title)}</h4>
          <p>${escapeHtml(goalDateLabel(goal))}</p>
        </div>
        <strong>${escapeHtml(formatDurationSeconds(resultMode && actualSeconds ?actualSeconds : model.currentSeconds))}</strong>
      </div>
      <div class="goal-metrics">
        <div><span>Tempo alvo</span><strong>${escapeHtml(formatDurationSeconds(targetSeconds))}</strong></div>
        <div><span>Diferença</span><strong>${escapeHtml(gapLabel)}</strong></div>
        <div><span>Probabilidade tangivel</span><strong>${protocolProbability || "--"}%</strong></div>
        <div><span>Ganho necessário</span><strong>${escapeHtml(formatDurationSeconds(model.requiredGain))}</strong></div>
      </div>
      ${goalProjectionRoute(goal, model, resultMode && actualSeconds ?actualSeconds : 0)}
      <p class="goal-analysis">${escapeHtml(analysis)}</p>
      ${goal.notes ?`<p class="goal-notes">${escapeHtml(goal.notes)}</p>` : ""}
      ${!resultMode ?`
        <div class="goal-card-actions">
          <button class="secondary-action compact" type="button" data-edit-goal="${escapeHtml(goal.id)}">Editar</button>
          <button class="danger-action compact" type="button" data-delete-goal="${escapeHtml(goal.id)}">Excluir</button>
        </div>
      ` : ""}
    </article>
  `;
}

function renderGoals() {
  applyPanelCollapse(document.querySelector("#goalForm"), "goalForm", "Novo objetivo", "Adicionar prova foco");
  const activeTarget = document.querySelector("#goalList");
  const resultTarget = document.querySelector("#goalResults");
  if (!activeTarget || !resultTarget) return;
  const goals = Array.isArray(state.goals) ?state.goals : [];
  const active = goals.filter((goal) => !isPastGoal(goal));
  const results = goals.filter(isPastGoal).reverse();
  activeTarget.innerHTML = active.length
    ?active.map((goal) => renderGoalCard(goal)).join("")
    : `<div class="empty-state">Nenhum objetivo ativo. Adicione uma prova foco para gerar a rota preditiva.</div>`;
  resultTarget.innerHTML = results.length
    ?results.map((goal) => renderGoalCard(goal, true)).join("")
    : `<div class="empty-state">Objetivos vencidos aparecerão aqui com a análise do resultado versus meta.</div>`;
}

function setGoalMessage(message, error = false) {
  const target = document.querySelector("#goalMessage");
  if (!target) return;
  target.textContent = message;
  target.classList.toggle("is-error", error);
}

async function saveGoal(event) {
  event.preventDefault();
  if (!state.selectedAthleteId) {
    setGoalMessage("Selecione um atleta antes de criar objetivos.", true);
    return;
  }
  const form = event.currentTarget;
  const body = Object.fromEntries(new FormData(form).entries());
  const goalId = String(body.goalId || "").trim();
  delete body.goalId;
  body.raceDate = normalizeDateKey(body.raceDate);
  if (!body.raceDate) {
    setGoalMessage("Informe uma data valida para a prova.", true);
    return;
  }
  if (!window.confirm(goalId ?"Confirmar alteração deste objetivo?" :"Confirmar criação deste objetivo?")) return;
  try {
    setGoalMessage("Salvando objetivo...");
    const payload = await api(goalId ?`/api/goals/${encodeURIComponent(goalId)}` : "/api/goals", {
      method: goalId ?"PUT" : "POST",
      body: JSON.stringify(body)
    });
    state.goals = payload.goals || [];
    form.reset();
    if (form.goalId) form.goalId.value = "";
    renderGoals();
    renderDashboard();
    setGoalMessage(goalId ?"Objetivo atualizado." :"Objetivo salvo.");
  } catch (error) {
    setGoalMessage(error.message || "Não foi possível salvar o objetivo.", true);
  }
}

function editGoal(goalId) {
  const goal = (state.goals || []).find((item) => String(item.id) === String(goalId));
  const form = document.querySelector("#goalForm");
  if (!goal || !form) return;
  if (form.goalId) form.goalId.value = goal.id;
  if (form.title) form.title.value = goal.title || "";
  if (form.distanceM) form.distanceM.value = goal.distanceM || "";
  if (form.targetTime) form.targetTime.value = goal.targetTime || formatDurationSeconds(goal.targetTimeSeconds);
  if (form.raceDate) form.raceDate.value = normalizeDateKey(goal.raceDate);
  if (form.notes) form.notes.value = goal.notes || "";
  if (isPanelCollapsed("goalForm")) {
    setPanelCollapsed("goalForm", false);
    renderGoals();
  }
  form.scrollIntoView({ behavior: "smooth", block: "start" });
  setGoalMessage("Editando objetivo.");
}

async function removeGoal(goalId) {
  if (!window.confirm("Confirmar exclusao deste objetivo?")) return;
  try {
    setGoalMessage("Excluindo objetivo...");
    const payload = await api(`/api/goals/${encodeURIComponent(goalId)}`, { method: "DELETE" });
    state.goals = payload.goals || [];
    renderGoals();
    renderDashboard();
    setGoalMessage("Objetivo excluido.");
  } catch (error) {
    setGoalMessage(error.message || "Nao foi possivel excluir o objetivo.", true);
  }
}

function renderAthleteFocusHistory() {
  const target = document.querySelector("#athleteFocusHistory");
  if (!target) return;
  const athlete = getActiveAthlete();
  const tests = collect3000Tests(athlete);
  const times = tests.map((item) => `
    <strong>${escapeHtml(formatDurationSeconds(item.seconds))}</strong>
    <small>${escapeHtml(item.title || item.source || "teste")} · ${escapeHtml(item.date ?item.date.toLocaleDateString("pt-BR") : "")} · ${escapeHtml(item.origin || "Manual")}</small>
  `).join("");
  target.innerHTML = `
    <span>Últimos 3 testes de 3000 m (flag/manual/auto)</span>
    <div>${times || "<p>Nenhum teste de 3000 m disponível.</p>"}</div>
  `;
}

function render3000ActivityPicker() {
  const picker = document.querySelector("#activity3000Picker");
  if (!picker) return;
  const activities = state.activities
    .filter((activity) => isRunningActivity(activity))
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  if (!activities.length) {
    picker.innerHTML = `<option value="">Importe atividades antes de selecionar</option>`;
    picker.disabled = true;
    return;
  }
  picker.disabled = false;
  picker.innerHTML = [
    `<option value="">Selecione uma atividade importada</option>`,
    ...activities.map((activity) => {
      const date = activity.date ?new Date(`${activity.date}T00:00:00`).toLocaleDateString("pt-BR") : "";
      const marked = activity.is3000Test ?" - marcado" : "";
      return `<option value="${escapeHtml(activity.id)}">${escapeHtml(date)} - ${escapeHtml(activity.distance || "")} - ${escapeHtml(activity.title)}${marked}</option>`;
    })
  ].join("");
}

function renderTrainingInsights() {
  const target = document.querySelector("#trainingInsights");
  if (!target) return;

  const last30 = activitiesSince(30);
  const last7 = activitiesSince(7);
  if (!last30.length) {
    target.innerHTML = `
      <article><span>Distribuição</span><strong>Sem dados</strong><p>Importe atividades reais do atleta selecionado.</p></article>
      <article><span>Risco</span><strong>Sem dados</strong><p>A avaliação depende do histórico importado.</p></article>
      <article><span>Próxima ação</span><strong>Conectar fonte</strong><p>Conecte Strava ou outra plataforma antes de gerar recomendações.</p></article>
    `;
    return;
  }

  const activityScore = (activity) => Number(activity.analysis?.aggressionScore || activity.load || 0);
  const easy = last30.filter((activity) => activityScore(activity) < 45).length;
  const moderate = last30.filter((activity) => activityScore(activity) >= 45 && activityScore(activity) < 75).length;
  const hard = last30.filter((activity) => activityScore(activity) >= 75).length;
  const km30 = last30.reduce((sum, activity) => sum + parseDistanceKm(activity.distance), 0);
  const km7 = last7.reduce((sum, activity) => sum + parseDistanceKm(activity.distance), 0);
  const weeklyAverage = km30 / 4.285;
  const ratio = weeklyAverage ?km7 / weeklyAverage : 0;
  const risk = ratio > 1.35 ?"Alto" : ratio < 0.55 ?"Baixa carga" : "Controlado";
  const action = risk === "Alto" ?"Reduzir carga" : risk === "Baixa carga" ?"Retomar volume" : "Manter progressão";
  const detail = risk === "Alto"
    ?"A semana atual está acima da média recente."
    : risk === "Baixa carga"
      ?"A semana atual está abaixo da média recente."
      : "A semana está compatível com o histórico recente.";

  target.innerHTML = `
    <article><span>Distribuição</span><strong>${easy} / ${moderate} / ${hard}</strong><p>Leve, moderado e intenso nos últimos 30 dias.</p></article>
    <article><span>Risco</span><strong>${escapeHtml(risk)}</strong><p>${escapeHtml(detail)}</p></article>
    <article><span>Próxima ação</span><strong>${escapeHtml(action)}</strong><p>Baseado em ${last30.length} atividades importadas.</p></article>
  `;
}

function renderDashboard() {
  const highlightTarget = document.querySelector("#dashboardHighlights");
  const testTarget = document.querySelector("#dashboardTests");
  const typeTarget = document.querySelector("#dashboardTypes");
  const goalTarget = document.querySelector("#dashboardGoals");
  const vo2Target = document.querySelector("#dashboardVo2");
  if (!highlightTarget || !testTarget || !typeTarget || !goalTarget || !vo2Target) return;
  return renderDashboardModern(highlightTarget, testTarget, typeTarget, goalTarget, vo2Target);

  const recent = activitiesSince(30).filter(isRunningActivity);
  const week = activitiesSince(7).filter(isRunningActivity);
  const volume30 = recent.reduce((sum, activity) => sum + parseDistanceKm(activity.distance), 0);
  const tss30 = recent.reduce((sum, activity) => sum + activityTss(activity), 0);
  const bestLoad = [...recent].sort((a, b) => activityTss(b) - activityTss(a))[0];
  const athlete = getActiveAthlete();
  const tests = collect3000Tests(athlete);
  const types = recent.reduce((acc, activity) => {
    const key = activity.trainingType || activity.feedback?.trainingType || "Treino";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const activeGoals = (state.goals || []).filter((goal) => !isPastGoal(goal));

  highlightTarget.innerHTML = `
    <article class="dashboard-metric-card"><span>Volume 30 dias</span><strong>${escapeHtml(formatKm(volume30))}</strong><p>${recent.length} atividades importadas</p></article>
    <article class="dashboard-metric-card"><span>Volume semanal</span><strong>${escapeHtml(formatKm(week.reduce((sum, activity) => sum + parseDistanceKm(activity.distance), 0)))}</strong><p>${week.length} sessões nos últimos 7 dias</p></article>
    <article class="dashboard-metric-card"><span>11TSS 30 dias</span><strong>${Math.round(tss30)}</strong><p>Carga acumulada recente</p></article>
    <article class="dashboard-metric-card"><span>Destaque</span><strong>${escapeHtml(bestLoad?.title || "--")}</strong><p>${bestLoad ?`${activityTss(bestLoad)} 11TSS` : "Sem atividade recente"}</p></article>
  `;

  testTarget.innerHTML = tests.length
    ?tests.map((test, index) => `
      <article class="timeline-card">
        <span>Teste ${index + 1}</span>
        <strong>${escapeHtml(formatDurationSeconds(test.seconds))}</strong>
        <p>${escapeHtml(test.source || "teste 3000 m")}</p>
        <small>${escapeHtml(test.date ?test.date.toLocaleDateString("pt-BR") : "sem data")}</small>
      </article>
    `).join("")
    : `<div class="empty-state">Nenhum teste de 3000 m marcado ou importado.</div>`;

  typeTarget.innerHTML = Object.keys(types).length
    ?Object.entries(types).map(([type, count]) => `<article class="type-pill"><span>${escapeHtml(type)}</span><strong>${count}</strong></article>`).join("")
    : `<div class="empty-state">Classifique treinos para alimentar a distribuição.</div>`;

  goalTarget.innerHTML = activeGoals.length
    ?activeGoals.slice(0, 4).map((goal) => {
      const model = buildFocusModel(goalAsAthlete(goal));
      return `<article class="dashboard-goal-card"><span>${escapeHtml(focusDistanceLabels[goal.distanceM] || `${goal.distanceM} m`)}</span><strong>${escapeHtml(goal.title)}</strong><p>${model.probability || "--"}% - ${escapeHtml(goalDateLabel(goal))}</p></article>`;
    }).join("")
    : `<div class="empty-state">Crie objetivos para acompanhar status e rota preditiva.</div>`;
}

function profileLanguageOptions() {
  return Object.entries(languageOptions)
    .map(([value, label]) => `<option value="${escapeHtml(value)}" ${value === state.language ?"selected" : ""}>${escapeHtml(label)}</option>`)
    .join("");
}

function openProfileDialog() {
  const target = document.querySelector("#profileDialogContent");
  const modal = document.querySelector("#profileDialog");
  const athlete = getActiveAthlete();
  if (!target || !modal) return;
  target.innerHTML = `
    <section class="modal-panel is-compact" id="profileModalPanel">
      <div class="section-title">
        <span>Preferências</span>
        <h3>Meu perfil</h3>
      </div>
      <div class="profile-summary">
        <strong>${escapeHtml(athlete?.name || state.currentUser?.name || "Usuário")}</strong>
        <p>${escapeHtml(formatAthleteMeta(athlete))}</p>
      </div>
      <label class="credential-field">
        <span>${escapeHtml(t("profile.language"))}</span>
        <select id="languageSelect">${profileLanguageOptions()}</select>
      </label>
      <div class="modal-expanded-content">
        <p>E-mail: ${escapeHtml(athlete?.email || state.currentUser?.email || "--")}</p>
        <p>Equipe: ${escapeHtml(athlete?.teamName || "Não tenho")}</p>
        <p>Treinador: ${escapeHtml(athlete?.coachName || "Não tenho")}</p>
      </div>
      <div class="provider-actions">
        <button class="secondary-action compact" type="button" data-expand-profile>${escapeHtml(t("profile.expand"))}</button>
      </div>
    </section>
  `;
  modal.showModal();
}

function openHistoryDialog() {
  const target = document.querySelector("#historyDialogContent");
  const modal = document.querySelector("#historyDialog");
  const tests = collect3000Tests(getActiveAthlete());
  if (!target || !modal) return;
  target.innerHTML = `
    <section class="modal-panel">
      <div class="section-title">
        <span>Histórico</span>
        <h3>Últimos 3 testes de 3000 m</h3>
      </div>
      <div class="timeline-list">
        ${tests.length ?tests.map((test) => `
          <article class="timeline-card">
            <span>${escapeHtml(test.origin || "Manual")}</span>
            <strong>${escapeHtml(formatDurationSeconds(test.seconds))}</strong>
            <p>${escapeHtml(test.title || "Teste de 3000 m")}</p>
            <small>${escapeHtml(test.details || "")}</small>
            <small>${escapeHtml(test.date ?test.date.toLocaleDateString("pt-BR") : "sem data")}</small>
          </article>
        `).join("") : `<div class="empty-state">Nenhum teste de 3000 m disponível.</div>`}
      </div>
    </section>
  `;
  modal.showModal();
}

function workoutRows(count) {
  return Array.from({ length: count }, (_, index) => `
    <div class="workout-row" data-workout-row>
      <label class="credential-field"><span>Data</span><input name="date" type="date" /></label>
      <label class="credential-field"><span>Título</span><input name="title" placeholder="Treino ${index + 1}" /></label>
      <label class="credential-field"><span>Distância</span><input name="distance" placeholder="8 km" /></label>
      <label class="credential-field"><span>Descrição</span><input name="description" placeholder="Objetivo, ritmo, observações" /></label>
      <label class="credential-field"><span>Tipo</span><select name="trainingType">${trainingTypeOptionsHtml("Treino")}</select></label>
    </div>
  `).join("");
}

function addDaysToInputDate(value, days) {
  const base = value ?new Date(`${value}T00:00:00`) : new Date();
  if (Number.isNaN(base.getTime())) return dateKey(new Date());
  base.setDate(base.getDate() + days);
  return dateKey(base);
}

function syncWorkoutDates() {
  const form = document.querySelector("#workoutBuilderForm");
  if (!form || form.dataset.mode === "audio") return;
  const rows = Array.from(form.querySelectorAll("[data-workout-row]"));
  if (!rows.length) return;
  const startInput = form.elements.startDate;
  const endInput = form.elements.endDate;
  const startDate = startInput?.value || dateKey(new Date());
  if (startInput && !startInput.value) startInput.value = startDate;
  rows.forEach((row, index) => {
    const dateInput = row.querySelector('input[name="date"]');
    if (dateInput) dateInput.value = addDaysToInputDate(startDate, index);
  });
  if (endInput) endInput.value = addDaysToInputDate(startDate, rows.length - 1);
}

function openWorkoutDialog() {
  const target = document.querySelector("#workoutDialogContent");
  const modal = document.querySelector("#workoutDialog");
  if (!target || !modal) return;
  target.innerHTML = `
    <section class="modal-panel">
      <div class="section-title">
        <span>Treinamentos</span>
        <h3>Adicionar treino</h3>
      </div>
      <div class="segmented workout-mode-switch">
        <button class="is-active" type="button" data-workout-mode="single">Avulso</button>
        <button type="button" data-workout-mode="week">Semana</button>
        <button type="button" data-workout-mode="month">Mês</button>
        <button type="button" data-workout-mode="audio">Áudio</button>
      </div>
      <form id="workoutBuilderForm" class="workout-builder-form" data-mode="single">
        <div class="workout-range">
          <label class="credential-field"><span>Data de início</span><input name="startDate" type="date" /></label>
          <label class="credential-field"><span>Data de fim</span><input name="endDate" type="date" /></label>
        </div>
        <div id="workoutRows" class="workout-day-list">${workoutRows(1)}</div>
        <div id="audioWorkoutArea" class="audio-workout-area" hidden>
          <label class="credential-field wide-field">
            <span>Áudio ou transcrição</span>
            <textarea name="audioNotes" rows="4" placeholder="Arquitetura preparada para transcrição. Por enquanto, cole ou descreva o treino para salvar como rascunho estruturado."></textarea>
          </label>
        </div>
        <button class="primary-action compact" type="submit">Salvar treino</button>
        <p class="form-message" id="workoutBuilderMessage"></p>
      </form>
    </section>
  `;
  modal.showModal();
  enhanceSystemControls();
  applyWorkoutMode("single");
}

function applyWorkoutMode(mode) {
  const form = document.querySelector("#workoutBuilderForm");
  const rows = document.querySelector("#workoutRows");
  const audio = document.querySelector("#audioWorkoutArea");
  if (!form || !rows || !audio) return;
  form.dataset.mode = mode;
  document.querySelectorAll("[data-workout-mode]").forEach((button) => button.classList.toggle("is-active", button.dataset.workoutMode === mode));
  const count = mode === "week" ?7 : mode === "month" ?30 : 1;
  rows.hidden = mode === "audio";
  audio.hidden = mode !== "audio";
  rows.innerHTML = workoutRows(count);
  syncWorkoutDates();
}

async function saveManualWorkout(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const mode = form.dataset.mode || "single";
  if (!window.confirm(mode === "week" ?"Confirmar criação da semana de treinos?" : mode === "month" ?"Confirmar criação do mês de treinos?" : "Confirmar cadastro deste treino?")) return;
  const message = document.querySelector("#workoutBuilderMessage");
  const rows = Array.from(form.querySelectorAll("[data-workout-row]"));
  const activities = mode === "audio"
    ?[{ date: form.elements.startDate?.value || dateKey(new Date()), title: "Treino por áudio", description: form.elements.audioNotes?.value || "Entrada preparada para transcrição futura.", trainingType: "Treino" }]
    : rows.map((row) => Object.fromEntries(new FormData(row).entries())).filter((item) => item.date || item.title || item.description);
  if (!activities.length) {
    if (message) message.textContent = "Informe pelo menos um treino.";
    return;
  }
  try {
    if (message) message.textContent = "Salvando treinos...";
    const payload = await api("/api/activities/manual", {
      method: "POST",
      body: JSON.stringify({ mode, activities })
    });
    state.activities = payload.activities || [];
    renderCalendar();
    renderDashboard();
    if (message) message.textContent = "Treinos salvos.";
  } catch (error) {
    if (message) message.textContent = error.message || "Não foi possível salvar os treinos.";
  }
}

function activityTss(activity) {
  return Number(activity.analysis?.tss || activity.load || 0);
}

function dashboardSeries(days = 90) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - days + 1);
  const rows = Array.from({ length: days }, (_, index) => {
    const date = addDays(start, index);
    return {
      date,
      label: String(date.getDate()).padStart(2, "0"),
      volume: 0,
      tss: 0,
      count: 0
    };
  });
  visibleActivities()
    .filter(isRunningActivity)
    .forEach((activity) => {
      const date = activityDate(activity);
      if (!date || date < start) return;
      const index = Math.floor((date.getTime() - start.getTime()) / 86400000);
      if (!rows[index]) return;
      rows[index].volume += parseDistanceKm(activity.distance);
      rows[index].tss += activityTss(activity);
      rows[index].count += 1;
    });
  return rows;
}

function svgPolyline(points) {
  return points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
}

function dashboardTrendSvg(series) {
  const width = 1040;
  const height = 270;
  const pad = { top: 44, right: 34, bottom: 54, left: 38 };
  const maxVolume = Math.max(1, ...series.map((item) => item.volume));
  const maxTss = Math.max(1, ...series.map((item) => item.tss));
  const xFor = (index) => pad.left + (index * (width - pad.left - pad.right) / Math.max(1, series.length - 1));
  const yForVolume = (value) => height - pad.bottom - ((value / maxVolume) * (height - pad.top - pad.bottom));
  const yForTss = (value) => height - pad.bottom - ((value / maxTss) * (height - pad.top - pad.bottom));
  const volumePoints = series.map((item, index) => ({ x: xFor(index), y: yForVolume(item.volume) }));
  const tssPoints = series.map((item, index) => ({ x: xFor(index), y: yForTss(item.tss) }));
  const activeCount = series.filter((item) => item.count).length;
  if (!activeCount) return `<div class="empty-state">Importe atividades para ativar o centro visual.</div>`;
  const monthGroups = series.reduce((groups, item, index) => {
    const key = item.date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    const current = groups[groups.length - 1];
    if (!current || current.key !== key) {
      groups.push({ key, start: index, end: index });
    } else {
      current.end = index;
    }
    return groups;
  }, []);
  const monthTicks = monthGroups
    .map((group) => {
      const x = (xFor(group.start) + xFor(group.end)) / 2;
      return `<text class="dash-month-label" x="${x.toFixed(1)}" y="19" text-anchor="middle">${escapeHtml(group.key.toUpperCase())}</text>`;
    })
    .join("");
  const dayTicks = series
    .map((item, index) => {
      const strong = index === 0 || index === series.length - 1 || item.date.getDate() === 1;
      return `<text class="dash-day-label${strong ? " is-strong" : ""}" x="${xFor(index).toFixed(1)}" y="${height - 16}" text-anchor="middle">${escapeHtml(item.label)}</text>`;
    })
    .join("");
  const nodes = volumePoints
    .filter((_, index) => series[index].count)
    .map((point) => `<circle class="dash-node" cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="1.8"></circle>`)
    .join("");
  return `
    <svg class="dashboard-trend-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Volume e 11TSS dos ultimos 90 dias">
      <defs>
        <filter id="dashGlow">
          <feGaussianBlur stdDeviation="0.35" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      ${monthTicks}
      ${[0.25, 0.5, 0.75].map((ratio) => `<line class="dash-grid" x1="${pad.left}" x2="${width - pad.right}" y1="${pad.top + ratio * (height - pad.top - pad.bottom)}" y2="${pad.top + ratio * (height - pad.top - pad.bottom)}"></line>`).join("")}
      <polyline class="dash-line dash-line-volume" pathLength="1" points="${svgPolyline(volumePoints)}"></polyline>
      <polyline class="dash-line dash-line-tss" pathLength="1" points="${svgPolyline(tssPoints)}"></polyline>
      ${nodes}
      ${dayTicks}
    </svg>
  `;
}

function dashboardMiniBars(series) {
  const max = Math.max(1, ...series.map((item) => item.volume + item.tss / 100));
  return `
    <div class="dashboard-barcode" aria-label="Pulso de carga recente">
      ${series.slice(-18).map((item) => {
        const size = 18 + ((item.volume + item.tss / 100) / max) * 82;
        return `<span style="--bar:${size.toFixed(0)}%"></span>`;
      }).join("")}
    </div>
  `;
}

function formatPace(secondsPerKm) {
  if (!secondsPerKm || !Number.isFinite(secondsPerKm)) return "--";
  return `${formatDurationSeconds(secondsPerKm)}/km`;
}

function paceRange(basePace, minFactor, maxFactor) {
  return `${formatPace(basePace * minFactor)} - ${formatPace(basePace * maxFactor)}`;
}

function dashboardObjectiveDistance(athlete) {
  const activeGoals = (state.goals || [])
    .filter((goal) => !isPastGoal(goal))
    .map((goal) => ({
      distanceM: Number(goal.distanceM || 0),
      dateKey: normalizeDateKey(goal.raceDate)
    }))
    .filter((goal) => goal.distanceM && goal.dateKey)
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  return activeGoals[0]?.distanceM || Number(athlete?.focusDistanceM || 0) || 5000;
}

function trainingMixForDistance(distanceM) {
  if (distanceM <= 1500) {
    return [
      ["Base leve", 45],
      ["Ritmo / limiar", 20],
      ["VO2 e intervalos", 25],
      ["Tecnica / forca", 10]
    ];
  }
  if (distanceM <= 5000) {
    return [
      ["Base leve", 55],
      ["Ritmo / limiar", 20],
      ["VO2 e intervalos", 15],
      ["Longo controlado", 10]
    ];
  }
  if (distanceM <= 10000) {
    return [
      ["Base leve", 60],
      ["Limiar / tempo", 20],
      ["VO2 e intervalos", 10],
      ["Longo controlado", 10]
    ];
  }
  if (distanceM <= 21000) {
    return [
      ["Base leve", 65],
      ["Limiar / tempo", 18],
      ["Longo controlado", 12],
      ["VO2 e intervalos", 5]
    ];
  }
  return [
    ["Base leve", 70],
    ["Limiar / tempo", 15],
    ["Longo controlado", 12],
    ["VO2 e intervalos", 3]
  ];
}

function dashboardTestSvg(tests, athlete) {
  if (!tests.length) return `<div class="empty-state">Nenhum teste de 3000 m marcado ou importado.</div>`;
  const lastTest = latest3000Test(tests);
  if (!lastTest?.seconds) return `<div class="empty-state">Marque um teste de 3000 m para calcular parametros.</div>`;
  const basePace = Number(lastTest.seconds) / 3;
  const projectionTargets = [
    ["1000 m", 1000],
    ["1500 m", 1500],
    ["5 km", 5000],
    ["10 km", 10000],
    ["21 km", 21097.5],
    ["42 km", 42195]
  ];
  const zones = [
    ["Regenerativo", paceRange(basePace, 1.55, 1.75), "recuperacao e volume facil"],
    ["Leve / base", paceRange(basePace, 1.35, 1.55), "rodagem sustentavel"],
    ["Ritmo / tempo", paceRange(basePace, 1.14, 1.25), "controle aerobio forte"],
    ["Limiar", paceRange(basePace, 1.08, 1.14), "blocos progressivos"],
    ["VO2 / intervalado", paceRange(basePace, 0.98, 1.05), "series curtas e medias"]
  ];
  const objectiveDistance = dashboardObjectiveDistance(athlete);
  const mix = trainingMixForDistance(objectiveDistance);
  const objectiveLabel = focusDistanceLabels[objectiveDistance] || `${Math.round(objectiveDistance / 1000)} km`;

  return `
    <div class="test-params">
      <article class="test-base-card">
        <span>Teste base</span>
        <strong>${escapeHtml(formatDurationSeconds(lastTest.seconds))}</strong>
        <p>${escapeHtml(lastTest.date ?lastTest.date.toLocaleDateString("pt-BR") : "sem data")} - ritmo ${escapeHtml(formatPace(basePace))}</p>
      </article>
      <div class="test-projection-grid">
        ${projectionTargets.map(([label, meters]) => {
          const seconds = projectTime(lastTest.seconds, 3000, meters);
          return `
            <article class="test-param-card">
              <span>${escapeHtml(label)}</span>
              <strong>${escapeHtml(formatDurationSeconds(seconds))}</strong>
              <p>${escapeHtml(formatPace(seconds / (meters / 1000)))}</p>
            </article>
          `;
        }).join("")}
      </div>
      <div class="test-param-columns">
        <section class="test-zone-panel">
          <div class="test-param-title">
            <span>Zonas e ritmos sugeridos</span>
            <strong>Riegel + pace 3000m</strong>
          </div>
          <div class="test-zone-list">
            ${zones.map(([name, range, note]) => `
              <article>
                <div><strong>${escapeHtml(name)}</strong><p>${escapeHtml(note)}</p></div>
                <span>${escapeHtml(range)}</span>
              </article>
            `).join("")}
          </div>
        </section>
        <section class="test-zone-panel">
          <div class="test-param-title">
            <span>Distribuicao recomendada</span>
            <strong>${escapeHtml(objectiveLabel)}</strong>
          </div>
          <div class="test-mix-list">
            ${mix.map(([name, pct]) => `
              <article>
                <div><span>${escapeHtml(name)}</span><strong>${pct}%</strong></div>
                <i style="--pct:${pct}%"></i>
              </article>
            `).join("")}
          </div>
        </section>
      </div>
    </div>
  `;
}

function dashboardTypeChart(types) {
  const entries = Object.entries(types)
    .map(([type, stats]) => ({
      type,
      count: Number(stats.count || 0),
      volume: Number(stats.volume || 0),
      tss: Number(stats.tss || 0),
      seconds: Number(stats.seconds || 0),
      paceKm: stats.paceDistance ?Number(stats.seconds || 0) / Number(stats.paceDistance || 1) : 0
    }))
    .sort((a, b) => b.count - a.count);
  if (!entries.length) return `<div class="empty-state">Classifique treinos para alimentar a distribuicao.</div>`;
  const total = entries.reduce((sum, item) => sum + item.count, 0) || 1;
  const maxCount = Math.max(1, ...entries.map((item) => item.count));
  const maxVolume = Math.max(1, ...entries.map((item) => item.volume));
  const dominant = entries[0];
  return `
    <div class="type-insights">
      <div class="type-summary-strip">
        <article>
          <span>Sessoes</span>
          <strong>${total}</strong>
          <p>${escapeHtml(entries.length)} tipos classificados</p>
        </article>
        <article>
          <span>Tipo dominante</span>
          <strong>${escapeHtml(dominant.type)}</strong>
          <p>${Math.round((dominant.count / total) * 100)}% das sessoes</p>
        </article>
        <article>
          <span>Ritmo medio do lider</span>
          <strong>${escapeHtml(formatPace(dominant.paceKm))}</strong>
          <p>${escapeHtml(formatKm(dominant.volume))} acumulados</p>
        </article>
      </div>
      <div class="type-insight-list">
        ${entries.map((item) => {
          const pct = (item.count / total) * 100;
          const volumePct = (item.volume / maxVolume) * 100;
          const countPct = (item.count / maxCount) * 100;
          return `
          <article class="type-insight-card" style="--pct:${pct.toFixed(0)}%;--vol:${volumePct.toFixed(0)}%;--count:${countPct.toFixed(0)}%;">
            <div class="type-insight-head">
              <div>
                <span>${escapeHtml(item.type)}</span>
                <strong>${item.count} sessoes</strong>
              </div>
              <em>${pct.toFixed(0)}%</em>
            </div>
            <div class="type-insight-meter"><i></i></div>
            <div class="type-insight-metrics">
              <span><b>${escapeHtml(formatPace(item.paceKm))}</b> ritmo medio</span>
              <span><b>${escapeHtml(formatKm(item.volume))}</b> volume</span>
              <span><b>${Math.round(item.tss)}</b> 11TSS</span>
            </div>
          </article>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

function dashboardGoalProbability(goal, model) {
  const probability = Math.max(0, Math.min(100, Number(model.probability || 0)));
  const targetLabel = model.targetSeconds ?formatDurationSeconds(model.targetSeconds) : "--";
  const projectionLabel = model.currentSeconds ?formatDurationSeconds(model.currentSeconds) : "--";
  const gainLabel = model.requiredGain ?formatDurationSeconds(model.requiredGain) : "no alvo";
  const weekLabel = model.requiredPerWeek ?`${formatDurationSeconds(model.requiredPerWeek)}/sem` : "--";
  const analysis = String(state.dashboardAnalysis?.athleteId || "") === String(getActiveAthlete()?.id || "")
    ?state.dashboardAnalysis
    : null;
  const isRunning = analysis?.status === "running";
  const analysisLabel = analysis?.generatedAt
    ?isRunning
      ?"Recalculando com IA..."
      : `Recalculado ${new Date(analysis.generatedAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`
    : "Clique em Recalcular para reprocessar a cronologia";
  return `
    <article class="dashboard-goal-card ${isRunning ?"is-recalculating" : ""}">
      <div class="goal-probability-copy">
        <span>${escapeHtml(focusDistanceLabels[goal.distanceM] || `${goal.distanceM} m`)}</span>
        <strong>${escapeHtml(goal.title)}</strong>
        <p>${escapeHtml(goalDateLabel(goal))} - ${model.daysToRace || "--"} dias</p>
        <div class="goal-probability-grid">
          <small><b>${escapeHtml(targetLabel)}</b> alvo</small>
          <small><b>${escapeHtml(projectionLabel)}</b> projecao</small>
          <small><b>${escapeHtml(gainLabel)}</b> ganho</small>
          <small><b>${escapeHtml(weekLabel)}</b> ritmo</small>
        </div>
        <p class="goal-analysis-stamp">${isRunning ?`<i class="mini-loader" aria-hidden="true"></i>` : ""}${escapeHtml(analysisLabel)}</p>
      </div>
      <div class="goal-probability-visual">
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <circle class="goal-ring-base" cx="60" cy="60" r="45"></circle>
          <circle class="goal-ring-progress" cx="60" cy="60" r="45" style="--goal:${probability}"></circle>
          <text x="60" y="65" text-anchor="middle">${probability || "--"}%</text>
        </svg>
        <span>${escapeHtml(model.status || "Dados insuficientes")}</span>
      </div>
    </article>`;
}

function estimateVo2From3000(athlete, tests) {
  const lastTest = latest3000Test(tests);
  if (!lastTest?.seconds) return null;
  const chronology = buildChronologicalPerformanceAnalysis(athlete, tests);
  const velocity = 3000 / (Number(lastTest.seconds) / 60);
  const oxygenCost = -4.6 + (0.182258 * velocity) + (0.000104 * velocity * velocity);
  const minutes = Number(lastTest.seconds) / 60;
  const effortFraction = 0.8 + (0.1894393 * Math.exp(-0.012778 * minutes)) + (0.2989558 * Math.exp(-0.1932605 * minutes));
  const testVo2 = oxygenCost / effortFraction;
  const recent90 = activitiesSince(90).filter(isRunningActivity);
  const recent30 = activitiesSince(30).filter(isRunningActivity);
  const recent14 = activitiesSince(14).filter(isRunningActivity);
  const volume90 = recent90.reduce((sum, activity) => sum + parseDistanceKm(activity.distance), 0);
  const volume30 = recent30.reduce((sum, activity) => sum + parseDistanceKm(activity.distance), 0);
  const tss30 = recent30.reduce((sum, activity) => sum + activityTss(activity), 0);
  const weeklySessions = recent90.length / Math.max(1, 90 / 7);
  const weeklyVolume = volume90 / Math.max(1, 90 / 7);
  const consistency = Math.min(1, weeklySessions / 5);
  const volumeModifier = Math.max(-1.2, Math.min(2.2, (weeklyVolume - 35) / 18));
  const loadModifier = Math.max(-0.8, Math.min(1.2, (tss30 / 4 - 260) / 260));
  const freshnessModifier = recent14.length ?Math.min(0.9, recent14.length / 12) : -0.7;
  const history = athleteHistoryText(athlete).toLowerCase();
  const measuredVo2 = (Array.isArray(athlete?.historyTimeline) ?athlete.historyTimeline : [])
    .filter((entry) => entry.type === "vo2" && Number(entry.vo2 || 0) > 0)
    .sort((a, b) => String(b.startDate || "").localeCompare(String(a.startDate || "")))[0];
  const riskHistory = history.replace(/sem dor/g, "");
  const riskHits = (riskHistory.match(/les|dor|inflama|fadiga|cansa|pausa|doente|panturrilha|posterior/g) || []).length;
  const boostHits = (history.match(/consist|regular|sem dor|evolu|volume|teste controlado|progress/g) || []).length;
  const historyModifier = Math.max(-3.2, Math.min(1.8, (boostHits * 0.25) - (riskHits * 0.42) + chronology.historyModifier));
  const trainingModifier = (consistency * 1.4) + volumeModifier + loadModifier + freshnessModifier;
  const estimatedFromPerformance = testVo2 + trainingModifier + historyModifier;
  const measuredAge = chronology.vo2Age ?? 999;
  const measuredWeight = measuredVo2 ?Math.max(0.14, Math.min(0.45, 0.45 - measuredAge / 520)) : 0;
  const estimated = Math.max(20, Math.min(85, measuredVo2 ?(estimatedFromPerformance * (1 - measuredWeight)) + (Number(measuredVo2.vo2) * measuredWeight) : estimatedFromPerformance));
  const confidence = Math.round(Math.max(45, Math.min(94, 58 + tests.length * 8 + consistency * 16 + (recent90.length ?10 : 0) - riskHits * 3 - Math.max(0, chronology.testAge || 0) / 24)));
  return {
    estimated,
    testVo2,
    trainingModifier,
    historyModifier,
    confidence,
    lastTest,
    weeklySessions,
    weeklyVolume,
    volume30,
    riskHits,
    boostHits,
    measuredVo2: measuredVo2 ?Number(measuredVo2.vo2) : 0,
    chronology
  };
}

function athleteHistoryText(athlete) {
  const timeline = (Array.isArray(athlete?.historyTimeline) ?athlete.historyTimeline : []).map(normalizeHistoryEntry);
  const timelineText = timeline.map((entry) => [
    entry.startDate,
    entry.endDate,
    entry.time,
    entry.type,
    entry.title,
    entry.description,
    entry.originalContent,
    entry.tags?.join(" "),
    entry.importance,
    entry.relation,
    entry.vo2 ?`VO2 ${entry.vo2}` : "",
    entry.weightKg ?`peso ${entry.weightKg}` : "",
    entry.heartRate ?`FC ${entry.heartRate}` : "",
    entry.power ?`potencia ${entry.power}` : "",
    entry.pace ?`ritmo ${entry.pace}` : "",
    entry.sleepHours ?`sono ${entry.sleepHours}` : "",
    entry.perceivedEffort ?`esforco ${entry.perceivedEffort}` : "",
    entry.painScore !== "" && entry.painScore != null ?`dor ${entry.painScore}` : ""
  ].filter(Boolean).join(" ")).join(" ");
  return `${athlete?.historyNotes || ""} ${timelineText}`.trim();
}

function eventDateFromKey(key) {
  const normalized = normalizeDateKey(key);
  if (!normalized) return null;
  const date = new Date(`${normalized}T00:00:00`);
  return Number.isNaN(date.getTime()) ?null : date;
}

function daysSinceDate(date, now = new Date()) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((today - target) / 86400000));
}

function chronologyWeight(date) {
  const age = daysSinceDate(date);
  if (age === null) return 0.2;
  return Math.max(0.12, Math.exp(-age / 115));
}

function buildChronologicalPerformanceAnalysis(athlete, tests = collect3000Tests(athlete)) {
  const historyEntries = (Array.isArray(athlete?.historyTimeline) ?athlete.historyTimeline : []).map(normalizeHistoryEntry);
  const events = [];
  tests.forEach((test) => {
    if (!test?.date) return;
    events.push({
      date: test.date,
      type: "3000",
      label: `Teste 3000 ${formatDurationSeconds(test.seconds)}`,
      weight: chronologyWeight(test.date),
      seconds: Number(test.seconds || 0)
    });
  });
  historyEntries.forEach((entry) => {
    const date = eventDateFromKey(entry.startDate || entry.endDate);
    if (!date) return;
    events.push({
      date,
      type: entry.type === "vo2" ?"vo2" : "historico",
      label: [entry.title, entry.description, entry.originalContent, entry.tags?.join(" "), entry.vo2 ?`VO2 ${entry.vo2}` : "", entry.painScore !== "" ?`dor ${entry.painScore}` : ""].filter(Boolean).join(" - "),
      weight: chronologyWeight(date),
      vo2: Number(entry.vo2 || 0),
      importance: entry.importance,
      relation: entry.relation,
      possibleImpact: entry.possibleImpact
    });
  });
  activitiesSince(180).filter(isRunningActivity).forEach((activity) => {
    const date = eventDateFromKey(activity.date);
    if (!date) return;
    events.push({
      date,
      type: "treino",
      label: activity.title || "Treino importado",
      weight: chronologyWeight(date),
      distanceKm: parseDistanceKm(activity.distance),
      tss: activityTss(activity)
    });
  });
  events.sort((a, b) => a.date - b.date);

  const text = [athleteHistoryText(athlete), events.map((event) => event.label).join(" ")].join(" ").toLowerCase();
  const riskText = text.replace(/sem dor/g, "");
  const riskMatches = riskText.match(/les|dor|inflama|fadiga|cansa|pausa|parad|doente|panturrilha|posterior|retorno/g) || [];
  const positiveMatches = text.match(/consist|regular|sem dor|evolu|volume|controlado|progress|forte|base/g) || [];
  const riskScore = events
    .filter((event) => /les|dor|inflama|fadiga|cansa|pausa|parad|doente|panturrilha|posterior|retorno/i.test(event.label))
    .reduce((sum, event) => sum + event.weight, riskMatches.length ?riskMatches.length * 0.08 : 0);
  const positiveScore = events
    .filter((event) => /consist|regular|sem dor|evolu|volume|controlado|progress|forte|base/i.test(event.label))
    .reduce((sum, event) => sum + event.weight, positiveMatches.length ?positiveMatches.length * 0.06 : 0);

  const recent30 = activitiesSince(30).filter(isRunningActivity);
  const previous30 = activitiesBetweenDays(60, 31).filter(isRunningActivity);
  const volume30 = recent30.reduce((sum, activity) => sum + parseDistanceKm(activity.distance), 0);
  const previousVolume30 = previous30.reduce((sum, activity) => sum + parseDistanceKm(activity.distance), 0);
  const trendRatio = previousVolume30 ?volume30 / previousVolume30 : volume30 ?1.08 : 0;
  const latestTest = latest3000Test(tests);
  const latestVo2 = events.filter((event) => event.type === "vo2" && event.vo2 > 0).sort((a, b) => b.date - a.date)[0] || null;
  const testAge = daysSinceDate(latestTest?.date);
  const vo2Age = daysSinceDate(latestVo2?.date);
  const stalePenalty = (testAge !== null && testAge > 90 ?Math.min(4, (testAge - 90) / 45) : 0)
    + (vo2Age !== null && vo2Age > 120 ?Math.min(2.5, (vo2Age - 120) / 80) : 0);
  const trainingTrendModifier = Math.max(-2.2, Math.min(2.2, (trendRatio - 1) * 2.4));
  const historyModifier = Math.max(-3.2, Math.min(2.2, positiveScore * 0.7 - riskScore * 1.25 - stalePenalty * 0.35));
  const probabilityModifier = Math.round(Math.max(-18, Math.min(12, trainingTrendModifier * 3 + historyModifier * 4)));
  const summary = [
    latestTest ?`ultimo 3000 em ${latestTest.date.toLocaleDateString("pt-BR")} (${formatDurationSeconds(latestTest.seconds)})` : "sem teste de 3000 registrado",
    latestVo2 ?`VO2 medido ${latestVo2.vo2} em ${latestVo2.date.toLocaleDateString("pt-BR")}` : "sem VO2 medido",
    `${recent30.length} treinos nos ultimos 30 dias`,
    trendRatio ?`tendencia de volume ${(trendRatio * 100).toFixed(0)}% vs 30 dias anteriores` : "sem tendencia recente",
    riskScore > 0.5 ?"historico recente exige prudencia" : "sem alerta cronologico dominante"
  ].join(". ");
  return {
    generatedAt: new Date().toISOString(),
    events: events.slice(-36),
    latestVo2,
    latestTest,
    testAge,
    vo2Age,
    riskScore,
    positiveScore,
    trendRatio,
    trainingTrendModifier,
    historyModifier,
    probabilityModifier,
    summary
  };
}

function buildPerformanceDossier(athlete = getActiveAthlete()) {
  const tests = collect3000Tests(athlete);
  const chronology = buildChronologicalPerformanceAnalysis(athlete, tests);
  const recent90 = activitiesSince(90).filter(isRunningActivity);
  const recent30 = activitiesSince(30).filter(isRunningActivity);
  const previous30 = activitiesBetweenDays(60, 31).filter(isRunningActivity);
  const volume90 = recent90.reduce((sum, activity) => sum + parseDistanceKm(activity.distance), 0);
  const volume30 = recent30.reduce((sum, activity) => sum + parseDistanceKm(activity.distance), 0);
  const previousVolume30 = previous30.reduce((sum, activity) => sum + parseDistanceKm(activity.distance), 0);
  const tss90 = recent90.reduce((sum, activity) => sum + activityTss(activity), 0);
  const hardSessions = recent90.filter((activity) => activityTss(activity) >= 85 || /interval|tiro|forte|prova|teste/i.test(activity.trainingType || activity.title || "")).length;
  const entries = (Array.isArray(athlete?.historyTimeline) ?athlete.historyTimeline : []).map(normalizeHistoryEntry);
  const riskEntries = entries.filter((entry) => entry.tags?.includes("risco") || entry.type === "pain");
  const positiveEntries = entries.filter((entry) => entry.tags?.includes("evolucao"));
  const vo2Entries = entries.filter((entry) => entry.type === "vo2" && Number(entry.vo2 || 0) > 0);
  const latestTest = latest3000Test(tests);
  const vo2 = estimateVo2From3000(athlete, tests);
  const weeklyVolume = volume90 / Math.max(1, 90 / 7);
  const weeklySessions = recent90.length / Math.max(1, 90 / 7);
  const volumeTrend = previousVolume30 ?((volume30 - previousVolume30) / previousVolume30) * 100 : 0;
  const fatigueScore = Math.max(0, Math.min(100,
    (hardSessions / Math.max(1, recent90.length)) * 35
    + Math.max(0, volumeTrend) * 0.45
    + riskEntries.length * 8
    + entries.filter((entry) => /fadiga|cansa|sono ruim|dor/i.test(`${entry.title} ${entry.description}`)).length * 7
  ));
  const injuryRisk = Math.max(0, Math.min(100, riskEntries.length * 16 + Math.max(0, volumeTrend - 20) * 0.7 + (fatigueScore > 65 ?18 : 0)));
  const confidence = Math.round(Math.max(42, Math.min(94, 52 + tests.length * 7 + vo2Entries.length * 6 + Math.min(20, recent90.length / 2) - riskEntries.length * 2)));
  const diagnosis = fatigueScore > 70
    ? "Carga e sinais subjetivos sugerem cautela antes de intensificar."
    : injuryRisk > 55
      ? "Há sinais relevantes de risco físico que precisam moderar as projeções."
      : positiveEntries.length || volumeTrend > 5
        ? "Momento com sinais de evolução, desde que a recuperação acompanhe a carga."
        : "Momento neutro, dependente de consistência e novos marcadores objetivos.";
  return {
    generatedAt: new Date().toISOString(),
    athleteName: athlete?.name || "Atleta",
    entries,
    chronology,
    tests,
    latestTest,
    vo2,
    metrics: {
      volume90,
      volume30,
      previousVolume30,
      weeklyVolume,
      weeklySessions,
      tss90,
      hardSessions,
      volumeTrend,
      fatigueScore,
      injuryRisk,
      confidence
    },
    sections: {
      evolution: positiveEntries.slice(-5).map((entry) => entry.title),
      risks: riskEntries.slice(-6).map((entry) => `${entry.startDate}: ${entry.title}`),
      physiology: vo2Entries.slice(-4).map((entry) => `${entry.startDate}: VO2 ${entry.vo2}`),
      subjective: entries.filter((entry) => ["sensation", "recovery", "pain"].includes(entry.type)).slice(-6).map((entry) => `${entry.startDate}: ${entry.title}`)
    },
    diagnosis
  };
}

function renderHistoryDossier(action = "dossier") {
  const athlete = { ...(getActiveAthlete() || {}), historyTimeline: state.historyTimelineDraft };
  const dossier = buildPerformanceDossier(athlete);
  const m = dossier.metrics;
  const heading = {
    dossier: "Dossiê cronológico gerado",
    deep: "Análise profunda",
    projection: "Projeção contextual",
    alerts: "Alertas inteligentes",
    compare: "Comparação de períodos"
  }[action] || "Dossiê cronológico";
  const alerts = [
    m.fatigueScore > 70 ? "Risco de fadiga acumulada alto: reduzir densidade de intensidade e observar sono/dor." : "",
    m.injuryRisk > 55 ? "Risco de lesão relevante: há registros de dor/lesão combinados com carga recente." : "",
    m.volumeTrend > 25 ? "Progressão de carga agressiva nos últimos 30 dias." : "",
    m.weeklySessions < 3 ? "Consistência semanal baixa para projeções competitivas confiáveis." : "",
    dossier.sections.evolution.length ? "Sinais positivos de evolução registrados no histórico." : ""
  ].filter(Boolean);
  const projection = dossier.vo2
    ?`VO2 estimado ${dossier.vo2.estimated.toFixed(1)} com confiança ${dossier.vo2.confidence}%, calibrado pelo último 3000${dossier.latestTest ?` (${formatDurationSeconds(dossier.latestTest.seconds)})` : ""}, carga recente e registros subjetivos.`
    : "Sem teste de 3000 suficiente para calibrar projeção fisiológica.";
  state.historyTimelineOutput = `
    <article class="history-dossier">
      <div class="section-title">
        <span>${escapeHtml(heading)}</span>
        <h3>${escapeHtml(dossier.athleteName)}</h3>
      </div>
      <div class="history-dossier-grid">
        <small><b>${dossier.entries.length}</b> registros estruturados</small>
        <small><b>${escapeHtml(formatKm(m.volume90))}</b> volume 90 dias</small>
        <small><b>${m.weeklySessions.toFixed(1)}</b> sessões/semana</small>
        <small><b>${Math.round(m.fatigueScore)}%</b> fadiga</small>
        <small><b>${Math.round(m.injuryRisk)}%</b> risco lesão</small>
        <small><b>${m.confidence}%</b> confiança</small>
      </div>
      <p><b>Diagnóstico:</b> ${escapeHtml(dossier.diagnosis)}</p>
      <p><b>Projeção:</b> ${escapeHtml(projection)}</p>
      <p><b>Comparação 30 dias:</b> ${escapeHtml(formatKm(m.volume30))} agora vs ${escapeHtml(formatKm(m.previousVolume30))} no período anterior (${m.volumeTrend.toFixed(0)}%).</p>
      <p><b>Alertas:</b> ${escapeHtml(alerts.join(" ") || "Nenhum alerta crítico no dossiê atual.")}</p>
      <p><b>Próximas ações:</b> ${escapeHtml(m.injuryRisk > 55 ? "priorizar recuperação, registrar dor diariamente e evitar novo pico de carga." : "manter registros após treinos-chave, atualizar VO2/3000 e comparar blocos semelhantes.")}</p>
    </article>
  `;
  renderHistoryTimelineEditor();
}

function activitiesBetweenDays(fromDaysAgo, toDaysAgo) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = addDays(today, -fromDaysAgo);
  const end = addDays(today, -toDaysAgo);
  return visibleActivities().filter((activity) => {
    const date = eventDateFromKey(activity.date);
    return date && date >= start && date <= end;
  });
}

function dashboardVo2Panel(athlete, tests) {
  const vo2 = estimateVo2From3000(athlete, tests);
  const dashboardAnalysis = String(state.dashboardAnalysis?.athleteId || "") === String(athlete?.id || "")
    ?state.dashboardAnalysis
    : null;
  const isRunning = dashboardAnalysis?.status === "running";
  if (!vo2) {
    return `
      <aside class="dashboard-vo2-panel">
        <div class="vo2-panel-head">
          <span>VO2 estimado</span>
          <strong>--</strong>
        </div>
        <p>Marque um teste de 3000 m para cruzar performance, treinos recentes e histórico do perfil.</p>
      </aside>
    `;
  }
  const riskLabel = vo2.riskHits ?`${vo2.riskHits} alerta(s) no histórico` : "histórico sem alerta forte";
  const analysisText = dashboardAnalysis?.aiText || vo2.chronology.summary;
  const analysisMeta = dashboardAnalysis?.generatedAt
    ?isRunning
      ?"Recalculando análise fisiológica"
      : `Recalculado em ${new Date(dashboardAnalysis.generatedAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`
    : "Aguardando recalculo manual com IA";
  return `
    <aside class="dashboard-vo2-panel ${isRunning ?"is-recalculating" : ""}">
      <div class="vo2-panel-head">
        <div>
          <span>VO2 estimado</span>
          <strong>${vo2.estimated.toFixed(1)}</strong>
          <p>ml/kg/min - confiança ${vo2.confidence}%</p>
        </div>
        <svg viewBox="0 0 140 70" aria-hidden="true">
          <path d="M8 58 C30 12, 48 50, 67 28 S103 38, 132 10"></path>
          <circle cx="${Math.min(132, Math.max(8, 8 + (vo2.estimated - 35) * 2.25)).toFixed(1)}" cy="28" r="5"></circle>
        </svg>
      </div>
      <div class="vo2-source-grid">
        <article><span>Teste 3000</span><strong>${vo2.testVo2.toFixed(1)}</strong><p>${escapeHtml(formatDurationSeconds(vo2.lastTest.seconds))}</p></article>
        <article><span>Treinos</span><strong>${vo2.trainingModifier >= 0 ?"+" : ""}${vo2.trainingModifier.toFixed(1)}</strong><p>${escapeHtml(formatKm(vo2.weeklyVolume))}/sem</p></article>
        <article><span>Histórico</span><strong>${vo2.historyModifier >= 0 ?"+" : ""}${vo2.historyModifier.toFixed(1)}</strong><p>${escapeHtml(vo2.measuredVo2 ?`VO2 medido ${vo2.measuredVo2}` : riskLabel)}</p></article>
      </div>
      <div class="vo2-context-list">
        <span><b>${vo2.weeklySessions.toFixed(1)}</b> sessões/semana nos últimos 90 dias</span>
        <span><b>${escapeHtml(formatKm(vo2.volume30))}</b> volume dos últimos 30 dias</span>
        <span><b>${vo2.boostHits}</b> sinal(is) positivos no histórico cronológico</span>
      </div>
      <div class="vo2-ai-analysis">
        <span>${isRunning ?`<i class="mini-loader" aria-hidden="true"></i>` : ""}${escapeHtml(analysisMeta)}</span>
        <p>${escapeHtml(analysisText)}</p>
      </div>
    </aside>
  `;
}

function buildHomeMotivation() {
  const athlete = getActiveAthlete();
  const activeGoals = (state.goals || []).filter((goal) => !isPastGoal(goal));
  const nextGoal = activeGoals
    .map((goal) => ({ goal, raceKey: normalizeDateKey(goal.raceDate) }))
    .filter((item) => item.raceKey)
    .sort((a, b) => a.raceKey.localeCompare(b.raceKey))[0]?.goal;
  const recent = activitiesSince(30).filter(isRunningActivity);
  const volume30 = recent.reduce((sum, activity) => sum + parseDistanceKm(activity.distance), 0);
  const tests = collect3000Tests(athlete);
  const lastTest = latest3000Test(tests);
  const athleteName = athlete?.name || state.currentUser?.name || "atleta";
  const goalText = nextGoal
    ?`${nextGoal.title || focusDistanceLabels[nextGoal.distanceM] || "próxima prova"} em ${goalDateLabel(nextGoal)}`
    : "o próximo objetivo";
  const baseText = recent.length
    ?`${formatKm(volume30)} nos últimos 30 dias`
    : "a base que começa hoje";
  const testText = lastTest
    ?`último 3000 m em ${formatDurationSeconds(lastTest.seconds)}`
    : "primeiro teste de 3000 m ainda por registrar";
  const options = [
    `${athleteName}, transforme ${baseText} em direção clara para ${goalText}.`,
    `O ciclo já deixou pistas: ${baseText}, ${testText}. Hoje é sobre consistência inteligente.`,
    `Treine com precisão: cada sessão recente aproxima ${goalText} de um plano executável.`,
    `Use o histórico como bússola. ${testText}; o próximo passo é consolidar ${baseText}.`,
    `O objetivo não pede pressa, pede leitura. ${goalText} começa no treino bem feito de hoje.`
  ];
  return options[Math.floor(Math.random() * options.length)];
}

function renderHomeMotivation() {
  const target = document.querySelector("#homeMotivation");
  if (!target) return;
  target.textContent = buildHomeMotivation();
}

function latest3000Test(tests) {
  return [...tests]
    .filter((test) => test.date instanceof Date && !Number.isNaN(test.date.getTime()))
    .sort((a, b) => b.date - a.date)[0] || tests[0] || null;
}

function renderDashboardModern(highlightTarget, testTarget, typeTarget, goalTarget, vo2Target) {
  const recent = activitiesSince(90).filter(isRunningActivity);
  const volume90 = recent.reduce((sum, activity) => sum + parseDistanceKm(activity.distance), 0);
  const tss90 = recent.reduce((sum, activity) => sum + activityTss(activity), 0);
  const monthlyAverage = volume90 / 3;
  const weeklyAverage = volume90 / (90 / 7);
  const tssAverage = tss90 / 3;
  const series = dashboardSeries(90);
  const athlete = getActiveAthlete();
  const tests = collect3000Tests(athlete);
  const lastTest = latest3000Test(tests);
  const types = recent.reduce((acc, activity) => {
    const key = activity.trainingType || activity.feedback?.trainingType || "Treino";
    const distanceKm = parseDistanceKm(activity.distance);
    const seconds = activityMovingSeconds(activity);
    if (!acc[key]) acc[key] = { count: 0, volume: 0, tss: 0, seconds: 0, paceDistance: 0 };
    acc[key].count += 1;
    acc[key].volume += distanceKm;
    acc[key].tss += activityTss(activity);
    if (distanceKm > 0 && seconds > 0) {
      acc[key].seconds += seconds;
      acc[key].paceDistance += distanceKm;
    }
    return acc;
  }, {});
  const activeGoals = (state.goals || []).filter((goal) => !isPastGoal(goal));

  highlightTarget.innerHTML = `
    <div class="dashboard-cockpit">
      <div class="dashboard-orbit" aria-hidden="true">
        <span></span><span></span><span></span>
        <strong>${Math.round(tss90)}</strong>
        <small>11TSS</small>
      </div>
      <div class="dashboard-trend">
        <div class="dashboard-legend">
          <span><i class="legend-volume"></i>Volume</span>
          <span><i class="legend-tss"></i>11TSS</span>
        </div>
        ${dashboardTrendSvg(series)}
      </div>
      <div class="dashboard-metrics">
        <article class="dashboard-metric-card"><span>Volume mensal médio</span><strong>${escapeHtml(formatKm(monthlyAverage))}</strong><p>${recent.length} atividades nos últimos 90 dias</p></article>
        <article class="dashboard-metric-card"><span>Volume semanal médio</span><strong>${escapeHtml(formatKm(weeklyAverage))}</strong><p>Média calculada em 90 dias</p></article>
        <article class="dashboard-metric-card"><span>11TSS médio</span><strong>${Math.round(tssAverage)}</strong><p>Média mensal dos últimos 90 dias</p></article>
        <article class="dashboard-metric-card"><span>Último teste de 3000</span><strong>${escapeHtml(lastTest ?formatDurationSeconds(lastTest.seconds) : "--")}</strong><p>${escapeHtml(lastTest ?`${lastTest.title || lastTest.source || "3000 m"} - ${lastTest.date ?lastTest.date.toLocaleDateString("pt-BR") : "sem data"}` : "Nenhum teste registrado")}</p></article>
      </div>
    </div>
  `;

  testTarget.innerHTML = dashboardTestSvg(tests, athlete);
  typeTarget.innerHTML = dashboardTypeChart(types);
  goalTarget.innerHTML = activeGoals.length
    ?`
      <div class="goal-probability-list">
        ${activeGoals.slice(0, 4).map((goal) => {
          const model = buildFocusModel(goalAsAthlete(goal));
          return dashboardGoalProbability(goal, model);
        }).join("")}
      </div>
    `
    : `<div class="empty-state">Crie objetivos para acompanhar status e rota preditiva.</div>`;
  vo2Target.innerHTML = dashboardVo2Panel(athlete, tests);
}

function chartRange() {
  return periodRange();
}

function aggregatePerformanceSeries() {
  const range = chartRange();
  const series = Array.from({ length: range.days }, (_, index) => {
    const date = range.unit === "week" ?addDays(range.start, index * 7) : addDays(range.start, index);
    const end = range.unit === "week" ?new Date(Math.min(addDays(date, 6).getTime(), range.end.getTime())) : date;
    return {
      date,
      end,
      key: dateKey(date),
      label: range.unit === "week"
        ?`S${String(index + 1).padStart(2, "0")}`
        : state.calendarView === "month"
          ?String(date.getDate()).padStart(2, "0")
          : `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`,
      volume: 0,
      tss: 0,
      count: 0
    };
  });
  visibleActivities().forEach((activity) => {
    const date = activityDate(activity);
    if (!date || date < range.start || date > range.end) return;
    const index = range.unit === "week"
      ?Math.floor((date - range.start) / 604800000)
      : Math.round((date - range.start) / 86400000);
    const item = series[index];
    if (!item) return;
    item.volume += parseDistanceKm(activity.distance);
    item.tss += activityTss(activity);
    item.count += 1;
  });
  return { ...range, series };
}

function linePath(points) {
  return points.map((point, index) => `${index ?"L" : "M"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
}

function renderPerformanceChart() {
  const target = document.querySelector("#performanceChart");
  if (!target) return;
  const panel = document.querySelector(".performance-chart-panel");
  const collapsed = isPanelCollapsed("performanceChart");
  if (panel) panel.classList.toggle("is-collapsed", collapsed);
  const toggle = document.querySelector('[data-toggle-panel="performanceChart"]');
  if (toggle) toggle.textContent = collapsed ?t("profile.expand") : t("profile.collapse");
  if (collapsed) {
    target.innerHTML = "";
    return;
  }

  const { series, label, unit } = aggregatePerformanceSeries();
  const width = 920;
  const height = 132;
  const padding = { top: 16, right: 30, bottom: 26, left: 38 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const maxVolume = Math.max(1, ...series.map((item) => item.volume));
  const maxTss = Math.max(1, ...series.map((item) => item.tss));
  const totalVolume = series.reduce((sum, item) => sum + item.volume, 0);
  const totalTss = series.reduce((sum, item) => sum + item.tss, 0);
  const totalSessions = series.reduce((sum, item) => sum + item.count, 0);
  const hasData = totalSessions > 0;
  const denominator = Math.max(series.length - 1, 1);
  const xFor = (index) => padding.left + (index / denominator) * chartWidth;
  const yVolume = (value) => padding.top + chartHeight - (value / maxVolume) * chartHeight;
  const yTss = (value) => padding.top + chartHeight - (value / maxTss) * chartHeight;
  const volumePoints = series.map((item, index) => ({ x: xFor(index), y: yVolume(item.volume) }));
  const tssPoints = series.map((item, index) => ({ x: xFor(index), y: yTss(item.tss) }));
  const volumeArea = hasData
    ?`${linePath(volumePoints)} L ${volumePoints[volumePoints.length - 1].x.toFixed(1)} ${padding.top + chartHeight} L ${volumePoints[0].x.toFixed(1)} ${padding.top + chartHeight} Z`
    : "";
  const grid = [0, 0.25, 0.5, 0.75, 1].map((step) => {
    const y = padding.top + chartHeight - (step * chartHeight);
    return `<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" />`;
  }).join("");
  const labels = series
    .map((item, index) => {
      const originalIndex = series.indexOf(item);
      const anchor = index === 0 ?"start" : index === series.length - 1 ?"end" : "middle";
      return `<text x="${xFor(originalIndex)}" y="${height - 12}" text-anchor="${anchor}">${escapeHtml(item.label)}</text>`;
    }).join("");
  const points = series.filter((item) => item.count).map((item, index) => {
    const originalIndex = series.indexOf(item);
    return `<circle cx="${xFor(originalIndex)}" cy="${yTss(item.tss)}" r="1.5"><title>${escapeHtml(item.label)} - ${item.volume.toFixed(1)} km - 11TSS ${Math.round(item.tss)}</title></circle>`;
  }).join("");
  const todayKey = dateKey(new Date());
  const today = new Date();
  const todayIndex = unit === "week"
    ?series.findIndex((item) => today >= item.date && today <= item.end)
    : series.findIndex((item) => item.key === todayKey);
  const todayMarker = todayIndex >= 0
    ?`<g class="today-marker">
        <line x1="${xFor(todayIndex)}" y1="${padding.top}" x2="${xFor(todayIndex)}" y2="${padding.top + chartHeight}" />
        <text x="${xFor(todayIndex) + 6}" y="${padding.top + 11}">Hoje</text>
      </g>`
    : "";

  target.innerHTML = `
    <div class="chart-stats">
      <div><span>Período</span><strong>${escapeHtml(label)}</strong></div>
      <div><span>Volume</span><strong>${escapeHtml(formatKm(totalVolume))}</strong></div>
      <div><span>11TSS</span><strong>${Math.round(totalTss)}</strong></div>
      <div><span>Sessões</span><strong>${totalSessions}</strong></div>
    </div>
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Gráfico de volume e 11TSS">
      <defs>
        <linearGradient id="volumeFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="#ff4b0b" stop-opacity="0.07" />
          <stop offset="100%" stop-color="#ff4b0b" stop-opacity="0" />
        </linearGradient>
        <filter id="chartGlow">
          <feGaussianBlur stdDeviation="0.65" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g class="chart-grid">${grid}</g>
      ${hasData ?`<path class="volume-area" d="${volumeArea}" />` : ""}
      ${hasData ?`<path class="volume-line" d="${linePath(volumePoints)}" />` : ""}
      ${hasData ?`<path class="tss-line" d="${linePath(tssPoints)}" />` : ""}
      ${todayMarker}
      <g class="tss-points">${points}</g>
      <text x="${padding.left}" y="16">km</text>
      <text x="${width - padding.right}" y="16" text-anchor="end">11TSS</text>
      <g class="chart-labels">${labels}</g>
    </svg>
    ${hasData ?"" : `<p class="chart-empty">Importe atividades do Strava para visualizar a evolução de volume e 11TSS.</p>`}
  `;
}

function renderActivity(activity) {
  const analysis = activity.analysis || {};
  const feedback = activity.feedback || {};
  const performancePercent = feedback.performancePercent || feedback.performance || "";
  const painScore = feedback.painScore ?? feedback.pain ?? "";
  const painNumber = Number(painScore);
  const painClass = painScore === "" || Number.isNaN(painNumber)
    ?""
    : painNumber <= 3
      ?"pain-low"
      : painNumber <= 6
        ?"pain-mid"
        : "pain-high";
  const analysisLine = analysis.tss
    ?`<em>${escapeHtml(analysis.standard || "11TSS Advance")} ${escapeHtml(analysis.tss)} - agressão ${escapeHtml(analysis.aggressionScore || "--")} - ${escapeHtml(analysis.characteristic || "")}</em>`
    : "";
  const feedbackLine = `<small class="activity-feedback"><span>Execução ${escapeHtml(performancePercent || "--")}%</span><span class="${painClass}">Dor ${escapeHtml(painScore === "" ?"—" : painScore)}/10</span></small>`;
  const trainingType = activity.trainingType || feedback.trainingType || "";
  return `
    <button class="activity" data-activity-id="${escapeHtml(activity.id)}" data-source="${escapeHtml(activity.source)}">
      <strong>${escapeHtml(activity.title)}</strong>
      <span>${escapeHtml(activity.source)} - ${escapeHtml(activity.distance)} - ${escapeHtml(activity.description)}</span>
      ${analysisLine}
      ${trainingType ?`<small class="activity-type">${escapeHtml(trainingType)}</small>` : ""}
      ${feedbackLine}
    </button>
  `;
}

function numericSelectOptions(start, end, step, selectedValue, suffix = "") {
  const selected = String(selectedValue ?? "");
  const emptySelected = selected === "" ?"selected" : "";
  const options = [`<option value="" ${emptySelected}>Selecionar</option>`];
  for (let value = start; value <= end; value += step) {
    const textValue = String(value);
    options.push(`<option value="${textValue}" ${selected === textValue ?"selected" : ""}>${textValue}${suffix}</option>`);
  }
  return options.join("");
}

function renderDayCell(date, muted = false) {
  const today = new Date();
  const key = dateKey(date);
  const dayActivities = visibleActivities().filter((activity) => activity.date === key);
  return `
    <div class="day ${muted ?"is-muted" : ""} ${sameDay(date, today) ?"is-today" : ""}">
      <div class="day-number">${date.getDate().toString().padStart(2, "0")}</div>
      ${dayActivities.map(renderActivity).join("")}
    </div>
  `;
}

function renderPeriodMonth(monthDate) {
  const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
  const activities = visibleActivities().filter((activity) => {
    const date = activityDate(activity);
    return date && date >= monthStart && date <= monthEnd;
  });
  const volume = activities.reduce((sum, activity) => sum + parseDistanceKm(activity.distance), 0);
  const tss = activities.reduce((sum, activity) => sum + activityTss(activity), 0);
  const list = activities.length
    ?activities.slice(0, 8).map(renderActivity).join("")
    : `<p class="period-empty">Sem atividades importadas neste mês.</p>`;

  return `
    <section class="period-month">
      <div class="period-month-head">
        <div>
          <span>${monthNames[monthDate.getMonth()]} ${monthDate.getFullYear()}</span>
          <strong>${activities.length} sessões</strong>
        </div>
        <div class="period-month-stats">
          <span>${escapeHtml(formatKm(volume))}</span>
          <span>${Math.round(tss)} 11TSS</span>
        </div>
      </div>
      <div class="period-activities">${list}</div>
    </section>
  `;
}

function renderPeriodWeek(start, end, index) {
  const activities = visibleActivities().filter((activity) => {
    const date = activityDate(activity);
    return date && date >= start && date <= end;
  });
  const volume = activities.reduce((sum, activity) => sum + parseDistanceKm(activity.distance), 0);
  const tss = activities.reduce((sum, activity) => sum + activityTss(activity), 0);
  return `
    <article class="period-week">
      <div class="period-week-head">
        <strong>Semana ${String(index + 1).padStart(2, "0")}</strong>
        <span>${escapeHtml(start.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }))} - ${escapeHtml(end.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }))}</span>
      </div>
      <div class="period-month-stats">
        <span>${activities.length} sessões</span>
        <span>${escapeHtml(formatKm(volume))}</span>
        <span>${Math.round(tss)} 11TSS</span>
      </div>
      <div class="period-activities">${activities.length ?activities.slice(0, 4).map(renderActivity).join("") : `<p class="period-empty">Sem atividades nesta semana.</p>`}</div>
    </article>
  `;
}

function renderPeriodCalendar() {
  const range = periodRange();
  const gridStart = startOfMondayWeek(range.start);
  const weekStarts = Array.from({ length: range.days }, (_, index) => addDays(gridStart, index * 7));
  calendar.style.setProperty("--period-weeks", weekStarts.length);
  const header = `<div class="month-grid-corner"></div>` + weekStarts.map((weekStart, index) => renderMonthWeekHeader(weekStart, index)).join("");
  const rows = weekdayNamesMonday.map((weekday, index) => `
    <div class="month-day-label">${weekday}</div>
    ${weekStarts.map((weekStart) => renderDayCell(addDays(weekStart, index))).join("")}
  `).join("");
  calendar.innerHTML = header + rows;
  document.querySelector("#calendarEyebrow").textContent = range.label;
  document.querySelector("#calendarTitle").textContent = hasActivitiesInCurrentRange()
    ?"Bloco de performance"
    : "Sem atividades neste período";
}

function renderMonthWeekHeader(weekStart, index) {
  const weekEnd = addDays(weekStart, 6);
  const periodLabel = `${String(weekStart.getDate()).padStart(2, "0")}/${String(weekStart.getMonth() + 1).padStart(2, "0")} a ${String(weekEnd.getDate()).padStart(2, "0")}/${String(weekEnd.getMonth() + 1).padStart(2, "0")}`;
  const weekActivities = visibleActivities().filter((activity) => {
    const date = activityDate(activity);
    return date && date >= weekStart && date <= weekEnd;
  });
  const volume = weekActivities.reduce((sum, activity) => sum + parseDistanceKm(activity.distance), 0);
  const tss = weekActivities.reduce((sum, activity) => sum + activityTss(activity), 0);
  const executions = weekActivities
    .map((activity) => Number(activity.feedback?.performancePercent || 0))
    .filter((value) => Number.isFinite(value) && value > 0);
  const execution = executions.length
    ?`${Math.round(executions.reduce((sum, value) => sum + value, 0) / executions.length)}%`
    :"--%";
  return `
    <div class="month-week-header">
      <strong>Semana ${index + 1} <small>${escapeHtml(periodLabel)}</small></strong>
      <div class="month-week-stats">
        <span>${volume.toFixed(1)} km</span>
        <span>${Math.round(tss)} 11TSS</span>
        <span>${execution} exec.</span>
      </div>
    </div>
  `;
}

function renderCalendar() {
  syncCalendarViewButtons();
  const cursor = state.cursor;
  const calendarClass = state.calendarView === "quarter" || state.calendarView === "semester" || state.calendarView === "year" ?"calendar-period" : `calendar-${state.calendarView}`;
  calendar.className = `calendar ${calendarClass} calendar-${state.calendarView}`;
  const activities = visibleActivities();

  if (state.calendarView === "month") {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    const weekStarts = [];
    for (let day = startOfMondayWeek(first); day <= end || day.getMonth() === cursor.getMonth(); day = addDays(day, 7)) {
      weekStarts.push(new Date(day));
      if (weekStarts.length >= 6) break;
    }
    calendar.style.setProperty("--month-weeks", weekStarts.length);
    const header = `<div class="month-grid-corner"></div>` + weekStarts.map((weekStart, index) => renderMonthWeekHeader(weekStart, index)).join("");
    const rows = weekdayNamesMonday.map((weekday, index) => `
      <div class="month-day-label">${weekday}</div>
      ${weekStarts.map((weekStart) => {
        const day = addDays(weekStart, index);
        return renderDayCell(day);
      }).join("")}
    `).join("");
    calendar.innerHTML = header + rows;
    document.querySelector("#calendarEyebrow").textContent = `${monthNames[cursor.getMonth()]} ${cursor.getFullYear()}`;
    document.querySelector("#calendarTitle").textContent = activities.length && !hasActivitiesInCurrentRange()
      ?`${activities.length} atividades importadas fora deste mês`
      : "Bloco de performance";
  }

  if (state.calendarView === "week") {
    const start = startOfWeek(cursor);
    const cells = [];
    for (let i = 0; i < 7; i += 1) cells.push(renderDayCell(addDays(start, i)));
    const end = addDays(start, 6);
    calendar.innerHTML = weekdayNames.map((day) => `<div class="weekday">${day}</div>`).join("") + cells.join("");
    document.querySelector("#calendarEyebrow").textContent = `${start.getDate()}-${end.getDate()} ${monthNames[end.getMonth()]} ${end.getFullYear()}`;
    document.querySelector("#calendarTitle").textContent = activities.length && !hasActivitiesInCurrentRange()
      ?`${activities.length} atividades importadas fora desta semana`
      : "Microciclo semanal";
  }

  if (state.calendarView === "day") {
    calendar.innerHTML = renderDayCell(cursor);
    document.querySelector("#calendarEyebrow").textContent = `${cursor.getDate()} ${monthNames[cursor.getMonth()]} ${cursor.getFullYear()}`;
    document.querySelector("#calendarTitle").textContent = activities.length && !hasActivitiesInCurrentRange()
      ?`${activities.length} atividades importadas em outras datas`
      : "Detalhe do dia";
  }
  if (state.calendarView === "quarter" || state.calendarView === "semester" || state.calendarView === "year") {
    renderPeriodCalendar();
  }
  renderFocusProjection();
  renderFocusRoadmap();
  renderAthleteFocusHistory();
  renderPerformanceChart();
  render3000ActivityPicker();
  renderGoals();
}

function openActivity(activityId) {
  const activity = visibleActivities().find((item) => String(item.id) === String(activityId));
  if (!activity) return;
  const analysis = activity.analysis || {};
  const feedback = activity.feedback || {};
  const perceivedExertion = activity.perceivedExertion ?? feedback.perceivedExertion ?? "";
  const trainingType = activity.trainingType || feedback.trainingType || "Treino";
  const external = activity.externalUrl ?`<a class="detail-link" href="${escapeHtml(activity.externalUrl)}" target="_blank" rel="noreferrer">Abrir atividade original</a>` : "";
  const analysisPanel = analysis.tss ?`
    <div class="analysis-panel">
      <span class="kicker">${escapeHtml(analysis.standard || "11TSS Advance")}</span>
      <h4>${escapeHtml(analysis.characteristic || "Característica do treino")}</h4>
      <p>${escapeHtml(analysis.note || "")}</p>
      <div class="detail-grid analysis-grid">
        <div><span class="metric-label">TSS estimado</span><strong>${escapeHtml(analysis.tss)}</strong></div>
        <div><span class="metric-label">Agressão</span><strong>${escapeHtml(analysis.aggressionScore)}</strong></div>
        <div><span class="metric-label">Variação de ritmo</span><strong>${escapeHtml(analysis.splitVariability || "--")}</strong></div>
        <div><span class="metric-label">Pace mais forte</span><strong>${escapeHtml(analysis.fastestPace || "--")}</strong></div>
      </div>
      <p class="analysis-caption">Esforço relativo Strava: ${escapeHtml(analysis.relativeEffort || "--")} - IF por FC: ${escapeHtml(analysis.intensityFactor || "--")} - Splits: ${escapeHtml(analysis.splitCount || 0)}</p>
    </div>
  ` : "";
  const testFlagButton = `
    <button class="secondary-action compact" type="button" data-flag-3000-activity="${escapeHtml(activity.id)}" data-flag-enabled="${activity.is3000Test ?"0" : "1"}">
      ${activity.is3000Test ?"Remover dos testes 3000 m" : "Marcar como teste 3000 m"}
    </button>
  `;
  detail.innerHTML = `
    <div class="detail">
      <span class="kicker">${escapeHtml(activity.source)} - ${escapeHtml(activity.type)}</span>
      <h3>${escapeHtml(activity.title)}</h3>
      <p>${escapeHtml(activity.description)}</p>
      <div class="detail-grid">
        <div><span class="metric-label">Distância</span><strong>${escapeHtml(activity.distance)}</strong></div>
        <div><span class="metric-label">Tempo</span><strong>${escapeHtml(activity.duration)}</strong></div>
        <div><span class="metric-label">Pace</span><strong>${escapeHtml(activity.pace)}</strong></div>
        <div><span class="metric-label">Carga</span><strong>${escapeHtml(activity.load)}</strong></div>
      </div>
      ${analysisPanel}
      <div class="activity-feedback-form">
        <label class="credential-field wide-field">
          <span>Descrição do treino</span>
          <textarea name="description" rows="3">${escapeHtml(activity.description || "")}</textarea>
        </label>
        <label class="credential-field">
          <span>Tipo de treino</span>
          <select name="trainingType">
            ${trainingTypeOptionsHtml(trainingType)}
          </select>
        </label>
        <label class="credential-field">
          <span>Grau de percepção de esforço</span>
          <select name="perceivedExertion">
            ${numericSelectOptions(1, 10, 1, perceivedExertion)}
          </select>
        </label>
        <label class="credential-field">
          <span>Desempenho em %</span>
          <select name="performancePercent">
            ${numericSelectOptions(10, 100, 10, feedback.performancePercent || "", "%")}
          </select>
        </label>
        <label class="credential-field">
          <span>Dores / lesões</span>
          <select name="painScore">
            ${numericSelectOptions(1, 10, 1, feedback.painScore ?? "")}
          </select>
        </label>
        <button class="secondary-action compact" type="button" data-save-activity-feedback="${escapeHtml(activity.id)}">Salvar percepção</button>
      </div>
      <div class="provider-actions">${testFlagButton}</div>
      ${external}
    </div>
  `;
  dialog.showModal();
}

async function saveActivityFeedback(activityId) {
  const wrapper = detail.querySelector(".activity-feedback-form");
  if (!wrapper) return;
  if (!window.confirm("Confirmar alteração deste treino?")) return;
  const performancePercent = wrapper.querySelector('[name="performancePercent"]')?.value || "";
  const painScore = wrapper.querySelector('[name="painScore"]')?.value || "";
  const perceivedExertion = wrapper.querySelector('[name="perceivedExertion"]')?.value || "";
  const trainingType = wrapper.querySelector('[name="trainingType"]')?.value || "Treino";
  const description = wrapper.querySelector('[name="description"]')?.value || "";
  try {
    const payload = await api("/api/activities/feedback", {
      method: "POST",
      body: JSON.stringify({ activityId, performancePercent, painScore, perceivedExertion, trainingType, description })
    });
    state.activities = payload.activities || [];
    renderCalendar();
    renderDashboard();
    if (dialog.open) openActivity(activityId);
    setLog(["Percepção da atividade salva."]);
  } catch (error) {
    setLog([error.message || "Não foi possível salvar a percepção da atividade."], true);
    window.alert(error.message || "Não foi possível salvar a percepção da atividade.");
  }
}

async function setActivity3000Flag(activityId, enabled) {
  if (!window.confirm(enabled ?"Confirmar marcação como teste de 3000 m?" :"Confirmar remoção dos testes de 3000 m?")) return;
  try {
    const payload = await api("/api/activities/flag-3000-test", {
      method: "POST",
      body: JSON.stringify({ activityId, enabled })
    });
    state.activities = payload.activities || [];
    renderCalendar();
    renderAthleteFocusHistory();
    render3000ActivityPicker();
    renderFocusRoadmap();
    renderGoals();
    renderDashboard();
    if (dialog.open) openActivity(activityId);
    setLog([enabled ?"Atividade marcada como teste de 3000 m." :"Atividade removida dos testes de 3000 m."]);
    setAthleteMessage(enabled ?"Teste de 3000 m vinculado à atividade." :"Teste de 3000 m removido da atividade.");
  } catch (error) {
    setLog([error.message || "Não foi possível atualizar o teste de 3000 m."], true);
    window.alert(error.message || "Não foi possível atualizar o teste de 3000 m.");
  }
}

function renderProviders() {
  const list = document.querySelector("#providerList");
  if (!list) return;
  list.innerHTML = Object.entries(providerDefinitions).map(([key, definition]) => {
    const integration = state.integrations[key] || {};
    const credentials = integration.credentials || {};
    const hasStoredToken = integration.token?.access_token === "stored" || integration.token?.refresh_token === "stored";
    const isConnected = Boolean(integration.connected || hasStoredToken);
    const connected = isConnected ?"Conectado" : "Não conectado";
    const scope = String(integration.token?.scope || "");
    const stravaScopeWarning = key === "strava" && isConnected && !scope.split(/[,\s]+/).some((item) => item === "activity:read" || item === "activity:read_all")
      ?`<p class="provider-warning">Reconecte aprovando activity:read ou activity:read_all para importar atividades.</p>`
      : "";
    const fields = definition.fields.map(([field, label, type = "text"]) => `
      <label class="credential-field">
        <span>${escapeHtml(label)}</span>
        <input type="${type}" name="${escapeHtml(field)}" value="${escapeHtml(credentials[field] || "")}" />
      </label>
    `).join("");
    const stravaActions = key === "strava" ?`
      <div class="provider-actions">
        <button class="primary-action compact" data-save-provider="${key}" type="button">Salvar credenciais</button>
        <button class="secondary-action compact" data-connect-strava type="button">Conectar Strava</button>
        <button class="secondary-action compact" data-test-strava type="button">Testar Strava</button>
      </div>
    ` : `
      <div class="provider-actions">
        <button class="primary-action compact" data-save-provider="${key}" type="button">Salvar credenciais</button>
      </div>
    `;
    const athlete = integration.athlete ?`<p class="provider-athlete">Atleta autorizado: ${escapeHtml(integration.athlete.firstname || "")} ${escapeHtml(integration.athlete.lastname || "")}</p>` : "";
    return `
      <form class="provider-card provider-form" data-provider="${key}">
        <div class="provider-mark">${escapeHtml(definition.mark)}</div>
        <div class="provider-body">
          <div class="provider-heading">
            <div>
              <small>${escapeHtml(definition.status)}</small>
              <h4>${escapeHtml(definition.name)}</h4>
            </div>
            <label class="provider-toggle">
              <input type="checkbox" name="enabled" ${integration.enabled ?"checked" : ""} />
              Ativo
            </label>
          </div>
          <p>${escapeHtml(definition.strategy)}</p>
          <p class="provider-state">${connected} para ${escapeHtml(getActiveAthlete()?.name || "o atleta selecionado")} - <a href="${definition.docs}" target="_blank" rel="noreferrer">docs oficiais</a></p>
          ${stravaScopeWarning}
          ${athlete}
          <div class="credential-grid">${fields}</div>
          ${stravaActions}
        </div>
      </form>
    `;
  }).join("");
  applyPanelCollapse(document.querySelector("#dashboardIntegrations"), "dashboardIntegrations", "Importação de plataformas");
}

function getActiveAthlete() {
  return state.athletes.find((athlete) => String(athlete.id) === String(state.selectedAthleteId)) || state.athletes[0] || null;
}

function formatAthleteMeta(athlete) {
  if (!athlete) return "Cadastre um atleta para personalizar o painel.";
  const items = [];
  if (athlete.teamName) items.push(athlete.teamName);
  if (athlete.coachName) items.push(`Treinador: ${athlete.coachName}`);
  if (athlete.age) items.push(`${athlete.age} anos`);
  if (athlete.weightKg) items.push(`${athlete.weightKg} kg`);
  if (athlete.heightCm) items.push(`${athlete.heightCm} cm`);
  return items.length ?items.join(" - ") : athlete.email || "Perfil de atleta cadastrado.";
}

function renderAthleteIdentity() {
  const athlete = getActiveAthlete();
  const name = athlete?.name || "Atleta não cadastrado";
  const sidebarName = document.querySelector("#sidebarAthleteName");
  const activeName = document.querySelector("#activeAthleteName");
  const activeMeta = document.querySelector("#activeAthleteMeta");
  if (sidebarName) sidebarName.textContent = name;
  if (activeName) activeName.textContent = name;
  if (activeMeta) activeMeta.textContent = formatAthleteMeta(athlete);
  renderAthleteFocusHistory();
}

function renderPermissions() {
  const manageable = canManageAthletes();
  const admin = isSuperAdmin();
  document.querySelectorAll(".manager-only").forEach((item) => {
    item.hidden = !manageable;
  });
  document.querySelectorAll(".athlete-list-panel").forEach((item) => {
    item.hidden = !manageable;
  });
  document.querySelectorAll(".admin-only").forEach((item) => {
    item.hidden = !admin;
  });
  document.querySelectorAll(".admin-only-field").forEach((item) => {
    item.hidden = true;
  });
  const submit = document.querySelector("#athleteSubmitButton");
  if (submit) submit.textContent = "Salvar meu perfil";
}

function getCurrentUserAthlete() {
  return state.athletes.find((athlete) => String(athlete.id) === String(state.currentUser?.id)) || null;
}

async function editCurrentUserProfile() {
  const currentAthlete = getCurrentUserAthlete();
  if (!currentAthlete) return;
  const changedAthlete = String(state.selectedAthleteId) !== String(currentAthlete.id);
  state.selectedAthleteId = currentAthlete.id;
  syncSelectedAthlete();
  renderAthleteSelector();
  renderAthleteIdentity();
  editAthlete(currentAthlete.id, { profileMode: true });
  if (!changedAthlete) return;
  try {
    const [integrations, activities, goals] = await Promise.all([
      api("/api/integrations"),
      api("/api/activities"),
      api("/api/goals")
    ]);
    state.integrations = integrations;
    state.activities = activities;
    state.goals = goals;
    renderProviders();
    renderCalendar();

    renderTrainingInsights();
  } catch (error) {
    setLog([error.message], true);
  }
}

function renderAiSettings() {
  const form = document.querySelector("#aiSettingsForm");
  if (!form || !isSuperAdmin()) return;
  const settings = state.appSettings || {};
  form.elements.openaiApiKey.value = settings.openaiApiKey || (settings.hasOpenaiApiKey ?SECRET_MASK : "");
  form.elements.openaiModel.value = settings.openaiModel || "gpt-4.1-mini";
  form.elements.openaiEnabled.checked = Boolean(settings.openaiEnabled);
}

function syncSelectedAthlete() {
  if (state.currentUser?.role === "athlete") {
    state.selectedAthleteId = state.currentUser.id;
  }
  if (state.athletes.length && !state.athletes.some((athlete) => String(athlete.id) === String(state.selectedAthleteId))) {
    state.selectedAthleteId = state.athletes[0].id;
  }
  if (!state.athletes.length) state.selectedAthleteId = "";
  if (state.selectedAthleteId) localStorage.setItem("selectedAthleteId", state.selectedAthleteId);
  else localStorage.removeItem("selectedAthleteId");
}

function uniqueByName(items) {
  const map = new Map();
  items.forEach((item) => {
    const name = String(item?.name || item || "").trim();
    if (name && !map.has(name.toLowerCase())) map.set(name.toLowerCase(), { name });
  });
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

function getDirectoryTeams() {
  const explicit = Array.isArray(state.directory?.teams) ?state.directory.teams : [];
  const fromAthletes = state.athletes.map((athlete) => athlete.teamName).filter(Boolean);
  return uniqueByName([...explicit, ...fromAthletes]);
}

function getDirectoryCoaches() {
  const explicit = Array.isArray(state.directory?.coaches) ?state.directory.coaches : [];
  const fromAthletes = state.athletes
    .filter((athlete) => athlete.role === "coach" || athlete.coachEmail)
    .map((athlete) => ({
      name: athlete.role === "coach" ?athlete.name : athlete.coachName,
      email: athlete.role === "coach" ?athlete.email : athlete.coachEmail
    }));
  const map = new Map();
  [...explicit, ...fromAthletes].forEach((coach) => {
    const email = String(coach?.email || "").trim().toLowerCase();
    if (email && !map.has(email)) map.set(email, { name: coach?.name || email, email });
  });
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

function fillSelectOptions(select, options, currentValue = "", emptyLabel = "Não tenho", valueKey = "name", labelFn = null) {
  if (!select) return;
  const value = String(currentValue || "");
  select.innerHTML = `<option value="">${emptyLabel}</option>${options.map((option) => {
    const optionValue = String(option[valueKey] || "");
    const label = labelFn ?labelFn(option) : optionValue;
    return `<option value="${escapeHtml(optionValue)}">${escapeHtml(label)}</option>`;
  }).join("")}`;
  select.value = value;
}

function renderDirectoryOptions(athlete = null) {
  const teams = getDirectoryTeams();
  const coaches = getDirectoryCoaches();
  fillSelectOptions(document.querySelector("#teamNameSelect"), teams, athlete?.teamName || "");
  fillSelectOptions(document.querySelector("#adminTeamNameSelect"), teams);
  fillSelectOptions(
    document.querySelector("#coachEmailSelect"),
    coaches,
    athlete?.coachEmail || "",
    "Não tenho",
    "email",
    (coach) => `${coach.name} - ${coach.email}`
  );
  fillSelectOptions(
    document.querySelector("#adminCoachEmailSelect"),
    coaches,
    "",
    "Não tenho",
    "email",
    (coach) => `${coach.name} - ${coach.email}`
  );
}

function renderAthleteSelector() {
  const selector = document.querySelector("#adminAthleteSelector");
  if (!selector) return;
  selector.innerHTML = state.athletes.length
    ?state.athletes.map((athlete) => `<option value="${escapeHtml(athlete.id)}">${escapeHtml(athlete.name)}</option>`).join("")
    : `<option value="">Nenhum atleta</option>`;
  selector.value = state.selectedAthleteId || "";
  selector.disabled = !state.athletes.length;
}

function renderAthletes() {
  const list = document.querySelector("#athleteList");
  if (!list) return;
  const search = (document.querySelector("#athleteFilterSearch")?.value || "").trim().toLowerCase();
  const role = document.querySelector("#athleteFilterRole")?.value || "";
  const team = (document.querySelector("#athleteFilterTeam")?.value || "").trim().toLowerCase();
  const coach = (document.querySelector("#athleteFilterCoach")?.value || "").trim().toLowerCase();
  const teamRows = (state.directory.teams || []).map((teamItem) => {
    const profile = teamItem.profile_data || teamItem.profileData || {};
    return {
      id: `team-${teamItem.id || teamItem.name}`,
      role: "manager",
      roleLabel: "Equipe",
      name: teamItem.name,
      email: profile.email || "",
      whatsapp: profile.whatsapp || "",
      teamName: teamItem.name,
      coachName: "",
      profileData: profile,
      isTeamRecord: true
    };
  });
  const rows = [...state.athletes, ...teamRows];
  const filtered = rows.filter((athlete) => {
    const haystack = [athlete.name, athlete.email, athlete.teamName, athlete.coachName, athlete.whatsapp, athlete.roleLabel]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (search && !haystack.includes(search)) return false;
    if (role && athlete.role !== role) return false;
    if (team && !String(athlete.teamName || "").toLowerCase().includes(team)) return false;
    if (coach && !String(athlete.coachName || athlete.coachEmail || "").toLowerCase().includes(coach)) return false;
    return true;
  });
  if (!rows.length) {
    list.innerHTML = `<p class="empty-state">Nenhum cadastro encontrado.</p>`;
    return;
  }
  if (!filtered.length) {
    list.innerHTML = `<p class="empty-state">Nenhum cadastro corresponde aos filtros.</p>`;
    return;
  }
  list.innerHTML = filtered.map((athlete) => {
    const isExpanded = String(athlete.id) === String(state.expandedAdminUserId);
    const profile = athlete.profileData || {};
    const coachDetails = athlete.role === "coach" ?`
          <p><strong>Formação:</strong> ${escapeHtml(profile.education || "--")}</p>
          <p><strong>Especialidades:</strong> ${escapeHtml(profile.skills || "--")}</p>
          <p><strong>Experiência:</strong> ${escapeHtml(profile.experience || "--")}</p>
          <p><strong>Certificações:</strong> ${escapeHtml(profile.certifications || "--")}</p>
    ` : "";
    const teamDetails = athlete.isTeamRecord ?`
          <p><strong>Institucional:</strong> ${escapeHtml(profile.institutionalNotes || "--")}</p>
          <p><strong>Local:</strong> ${escapeHtml(profile.location || "--")}</p>
    ` : "";
    const request = profile.relationshipRequest || {};
    const requestDetails = request.teamName || request.coachEmail ?`
          <p><strong>Solicitação:</strong> ${escapeHtml(request.teamName || "sem equipe")} / ${escapeHtml(request.coachName || request.coachEmail || "sem treinador")}</p>
          <button class="secondary-action compact" type="button" data-approve-relationship="${escapeHtml(athlete.id)}">Aprovar solicitação</button>
    ` : "";
    return `
    <article class="athlete-list-row ${String(athlete.id) === String(state.selectedAthleteId) ?"is-selected" : ""}">
      <button class="athlete-row-main" type="button" data-toggle-admin-user="${escapeHtml(athlete.id)}" aria-expanded="${isExpanded ? "true" : "false"}">
        <strong>${escapeHtml(athlete.name)}</strong>
        <span>${escapeHtml(athlete.email)}</span>
        <span>${escapeHtml(athlete.roleLabel || "Atleta")}</span>
        <span>${escapeHtml(athlete.teamName || "Sem equipe")}</span>
        <span>${athlete.role === "athlete" ?escapeHtml(athlete.coachName || "Sem treinador") : "--"}</span>
        <span>${escapeHtml(athlete.whatsapp || "WhatsApp não informado")}</span>
      </button>
      ${athlete.isTeamRecord ? "" : `<div class="athlete-item-actions">
        <button class="secondary-action compact" type="button" data-edit-athlete="${escapeHtml(athlete.id)}">Editar</button>
        <button class="danger-action" type="button" data-delete-athlete="${escapeHtml(athlete.id)}">Excluir</button>
      </div>`}
      ${isExpanded ?`
        <div class="athlete-row-details">
          <p><strong>Perfil:</strong> ${escapeHtml(athlete.roleLabel || athlete.role || "Atleta")}</p>
          <p><strong>Dados:</strong> ${escapeHtml(athlete.age || "--")} anos - ${escapeHtml(athlete.weightKg || "--")} kg - ${escapeHtml(athlete.heightCm || "--")} cm</p>
          <p><strong>Equipe:</strong> ${escapeHtml(athlete.teamName || "Não tenho")}</p>
          ${athlete.role === "athlete" ?`<p><strong>Treinador:</strong> ${escapeHtml(athlete.coachName || "Não tenho")}</p>` : ""}
          ${coachDetails}
          ${teamDetails}
          ${requestDetails}
        </div>
      ` : ""}
    </article>
  `;
  }).join("");
}

function setLog(items, isError = false) {
  const log = document.querySelector("#syncLog");
  log.classList.toggle("is-error", isError);
  log.innerHTML = items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function setSyncLoading(active, title = "Importando atividades", text = "Atualizando dados do atleta.", progress = "") {
  state.syncing = active;
  const overlay = document.querySelector("#syncOverlay");
  const titleTarget = document.querySelector("#syncLoaderTitle");
  const textTarget = document.querySelector("#syncLoaderText");
  const kickerTarget = document.querySelector("#syncLoaderKicker");
  if (overlay) overlay.hidden = !active;
  if (titleTarget) titleTarget.textContent = title;
  if (textTarget) textTarget.textContent = text;
  if (kickerTarget) kickerTarget.textContent = progress || "Sincronização";
  document.querySelectorAll("#syncSelected, [data-import-demo]").forEach((button) => {
    button.disabled = active;
    button.classList.toggle("is-loading", active);
  });
}

async function enrichStravaDescriptions() {
  let updated = 0;
  let remaining = Number.POSITIVE_INFINITY;
  for (let batch = 1; batch <= 30 && remaining > 0; batch += 1) {
    setSyncLoading(true, "Puxando descrições do Strava", `Lote ${batch}: buscando descrições completas sem travar o servidor.`, updated ?`${updated} descrições atualizadas` : "Detalhando atividades");
    const payload = await api("/api/strava/enrich", {
      method: "POST",
      body: JSON.stringify({ limit: 8 })
    });
    updated += Number(payload.updated || 0);
    remaining = Number(payload.remaining || 0);
    state.activities = payload.activities || state.activities;
    renderCalendar();

    renderTrainingInsights();
    if (!payload.updated || !remaining) break;
  }
  return { updated, remaining: Number.isFinite(remaining) ?remaining : 0 };
}

function setAthleteMessage(message, isError = false) {
  const target = document.querySelector("#athleteMessage");
  if (!target) return;
  target.classList.toggle("is-error", isError);
  target.textContent = message;
}

function resetAthleteForm(message = "") {
  const form = document.querySelector("#athleteForm");
  if (!form) return;
  form.reset();
  state.historyTimelineDraft = [];
  state.historyTimelineOutput = "";
  renderHistoryTimelineEditor([]);
  renderTests3000Editor([]);
  render3000ActivityPicker();
  state.editingAthleteId = "";
  const submit = document.querySelector("#athleteSubmitButton");
  const cancel = document.querySelector("#cancelAthleteEdit");
  if (submit) submit.textContent = "Salvar atleta";
  if (cancel) cancel.hidden = true;
  if (message) setAthleteMessage(message);
}

function historyTimelineRowTemplate(entry = {}) {
  const type = entry.type || "context";
  return `
    <article class="history-entry-row">
      <label class="credential-field">
        <span>Tipo</span>
        <select data-history-type>
          <option value="context" ${type === "context" ?"selected" : ""}>Registro cronológico</option>
          <option value="vo2" ${type === "vo2" ?"selected" : ""}>Teste de VO2</option>
        </select>
      </label>
      <label class="credential-field">
        <span>Início</span>
        <input type="date" data-history-start value="${escapeHtml(entry.startDate || "")}" />
      </label>
      <label class="credential-field">
        <span>Fim</span>
        <input type="date" data-history-end value="${escapeHtml(entry.endDate || "")}" />
      </label>
      <label class="credential-field">
        <span>Título / evento</span>
        <input data-history-title value="${escapeHtml(entry.title || "")}" placeholder="Ex.: Parado por lesão, retorno progressivo, bloco de base..." />
      </label>
      <label class="credential-field">
        <span>Descrição / contexto</span>
        <textarea data-history-description rows="2" placeholder="Detalhes relevantes para análise futura da IA.">${escapeHtml(entry.description || "")}</textarea>
      </label>
      <label class="credential-field">
        <span>VO2 medido</span>
        <input data-history-vo2 type="number" step="0.1" min="1" value="${escapeHtml(entry.vo2 || "")}" placeholder="ml/kg/min" />
      </label>
      <button class="danger-action compact" type="button" data-remove-history-entry>Remover</button>
    </article>
  `;
}

function renderHistoryTimelineEditor(entries = []) {
  const target = document.querySelector("#historyTimelineList");
  if (!target) return;
  const cleanEntries = Array.isArray(entries) ?entries : [];
  target.innerHTML = cleanEntries.length
    ?cleanEntries.map((entry) => historyTimelineRowTemplate(entry)).join("")
    : historyTimelineRowTemplate({});
}

function historyRecordTypeLabel(type) {
  return {
    context: "Registro",
    training: "Treino",
    sensation: "Sensação",
    pain: "Dor / lesão",
    recovery: "Recuperação",
    nutrition: "Nutrição",
    competition: "Competição",
    test: "Teste físico",
    vo2: "Teste de VO2",
    weight: "Peso",
    routine: "Rotina"
  }[type] || "Registro";
}

function inferHistoryRecord(raw = {}) {
  const content = [raw.type, raw.title, raw.description, raw.originalContent].filter(Boolean).join(" ").toLowerCase();
  const type = raw.type && raw.type !== "context" ?raw.type
    : /vo2/.test(content) ? "vo2"
    : /3000|teste|cooper|time trial|prova controlada/.test(content) ? "test"
    : /compet|campeonato|prova|corrida oficial/.test(content) ? "competition"
    : /dor|les|incômodo|incomodo|panturrilha|posterior|joelho|tend/.test(content) ? "pain"
    : /sono|recuper|descanso|fadiga|cansa/.test(content) ? "recovery"
    : /peso|kg|massa/.test(content) ? "weight"
    : /aliment|suplement|creatina|carbo|prote/.test(content) ? "nutrition"
    : /treino|rodagem|interval|tiro|longão|longo|ritmo|pace|km/.test(content) ? "training"
    : /ansiedade|motiva|confiança|sensação|leve|pesado/.test(content) ? "sensation"
    : /viagem|trabalho|rotina|mudança/.test(content) ? "routine"
    : "context";
  const tags = new Set(Array.isArray(raw.tags) ?raw.tags : []);
  [
    ["performance", /ritmo|pace|tempo|prova|teste|3000|5000|vo2|potência|potencia/],
    ["saude", /dor|les|sono|fadiga|doente|inflama|recuper/],
    ["carga", /volume|km|tss|longão|longo|interval|treino/],
    ["evolucao", /melhor|evolu|progress|recorde|forte|consist/],
    ["risco", /dor|les|fadiga|queda|parad|cansa|panturrilha/],
    ["rotina", /sono|aliment|viagem|trabalho|rotina|suplement/]
  ].forEach(([tag, pattern]) => {
    if (pattern.test(content)) tags.add(tag);
  });
  const importance = /les|dor forte|parad|vo2|recorde|melhor marca|compet|prova|teste/.test(content) ? "alta"
    : /fadiga|sono|peso|ritmo|volume|cansa|desconforto/.test(content) ? "média"
    : "normal";
  const relation = [
    /ritmo|pace|tempo|prova|teste|vo2|potência|potencia/.test(content) ? "performance" : "",
    /dor|les|fadiga|sono|recuper|doente/.test(content) ? "saúde/fadiga" : "",
    /melhor|evolu|progress|consist|volume/.test(content) ? "evolução" : ""
  ].filter(Boolean).join(", ") || "contexto";
  const possibleImpact = importance === "alta"
    ? "Pode alterar projeções, risco e leitura de resposta ao treino."
    : relation.includes("saúde")
      ? "Pode indicar necessidade de ajuste de carga e recuperação."
      : relation.includes("performance")
        ? "Ajuda a calibrar projeções e comparação de treinos similares."
        : "Serve como contexto para análises futuras.";
  return { type, tags: [...tags], importance, relation, possibleImpact };
}

function normalizeHistoryEntry(entry = {}) {
  const inferred = inferHistoryRecord(entry);
  const startDate = normalizeDateKey(entry.startDate || entry.date) || dateKey(new Date());
  return {
    id: entry.id || `hist-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type: inferred.type,
    startDate,
    endDate: normalizeDateKey(entry.endDate) || "",
    time: String(entry.time || "").trim().slice(0, 5),
    title: String(entry.title || entry.event || historyRecordTypeLabel(inferred.type)).trim().slice(0, 140),
    description: String(entry.description || entry.originalContent || "").trim().slice(0, 2400),
    originalContent: String(entry.originalContent || entry.description || entry.title || "").trim().slice(0, 2600),
    vo2: entry.vo2 === "" || entry.vo2 == null ?"" : Number(entry.vo2),
    weightKg: entry.weightKg === "" || entry.weightKg == null ?"" : Number(entry.weightKg),
    heartRate: entry.heartRate === "" || entry.heartRate == null ?"" : Number(entry.heartRate),
    power: entry.power === "" || entry.power == null ?"" : Number(entry.power),
    pace: String(entry.pace || "").trim().slice(0, 16),
    sleepHours: entry.sleepHours === "" || entry.sleepHours == null ?"" : Number(entry.sleepHours),
    perceivedEffort: entry.perceivedEffort === "" || entry.perceivedEffort == null ?"" : Number(entry.perceivedEffort),
    painScore: entry.painScore === "" || entry.painScore == null ?"" : Number(entry.painScore),
    tags: inferred.tags,
    importance: inferred.importance,
    relation: inferred.relation,
    possibleImpact: inferred.possibleImpact,
    createdAt: entry.createdAt || new Date().toISOString()
  };
}

function sortHistoryEntries(entries) {
  return [...entries].sort((a, b) => {
    const dateDiff = String(a.startDate || "").localeCompare(String(b.startDate || ""));
    if (dateDiff) return dateDiff;
    return String(a.time || "").localeCompare(String(b.time || ""));
  });
}

function historyEntryMatchesFilter(entry, filter) {
  if (!filter || filter === "all") return true;
  if (filter === "analysis") return ["performance", "saude", "carga", "evolucao", "risco"].some((tag) => entry.tags?.includes(tag));
  if (filter === "training") return entry.type === "training" || entry.tags?.includes("carga");
  if (filter === "test") return entry.type === "test" || entry.type === "vo2";
  if (filter === "pain") return entry.type === "pain" || entry.tags?.includes("risco");
  return entry.type === filter;
}

function historyRecordComposerTemplate() {
  return `
    <div class="history-composer">
      <div class="history-composer-grid">
        <label class="credential-field"><span>Data</span><input type="date" data-history-new-date value="${escapeHtml(dateKey(new Date()))}" /></label>
        <label class="credential-field"><span>Hora</span><input type="time" data-history-new-time /></label>
        <label class="credential-field">
          <span>Tipo</span>
          <select data-history-new-type>
            <option value="context">Automático / registro livre</option>
            <option value="training">Treino</option>
            <option value="sensation">Sensação</option>
            <option value="pain">Dor / lesão</option>
            <option value="recovery">Recuperação / sono</option>
            <option value="nutrition">Alimentação / suplementação</option>
            <option value="competition">Competição</option>
            <option value="test">Teste físico</option>
            <option value="vo2">Teste de VO2</option>
            <option value="weight">Peso</option>
            <option value="routine">Mudança de rotina</option>
          </select>
        </label>
        <label class="credential-field"><span>Título curto</span><input data-history-new-title placeholder="Ex.: Voltei a correr, teste de VO2, dor na panturrilha" /></label>
      </div>
      <label class="credential-field wide-field">
        <span>Registro cronológico</span>
        <textarea data-history-new-content rows="4" placeholder="Descreva qualquer fato relevante: treino, sensação, dor, peso, FC, potência, ritmo, sono, alimentação, prova, teste, rotina ou observação subjetiva."></textarea>
      </label>
      <div class="history-metric-grid">
        <label class="credential-field"><span>VO2</span><input data-history-new-vo2 type="number" min="1" max="100" step="0.1" placeholder="ml/kg/min" /></label>
        <label class="credential-field"><span>Peso</span><input data-history-new-weight type="number" min="1" step="0.1" placeholder="kg" /></label>
        <label class="credential-field"><span>FC média</span><input data-history-new-hr type="number" min="1" placeholder="bpm" /></label>
        <label class="credential-field"><span>Potência</span><input data-history-new-power type="number" min="1" placeholder="W" /></label>
        <label class="credential-field"><span>Ritmo</span><input data-history-new-pace placeholder="min/km" /></label>
        <label class="credential-field"><span>Sono</span><input data-history-new-sleep type="number" min="0" max="24" step="0.1" placeholder="h" /></label>
        <label class="credential-field"><span>Esforço</span><select data-history-new-rpe><option value="">--</option>${Array.from({ length: 10 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join("")}</select></label>
        <label class="credential-field"><span>Dor</span><select data-history-new-pain><option value="">--</option>${Array.from({ length: 11 }, (_, i) => `<option value="${i}">${i}</option>`).join("")}</select></label>
      </div>
      <div class="history-actions">
        <button class="primary-action compact" type="button" data-save-history-record>Salvar registro</button>
        <button class="secondary-action compact" type="button" data-history-action="dossier">Gerar dossiê</button>
        <button class="secondary-action compact" type="button" data-history-action="deep">Gerar análise profunda</button>
        <button class="secondary-action compact" type="button" data-history-action="projection">Gerar projeção</button>
        <button class="secondary-action compact" type="button" data-history-action="alerts">Ver alertas</button>
        <button class="secondary-action compact" type="button" data-history-action="compare">Comparar períodos</button>
      </div>
    </div>
  `;
}

function historyRecordCard(entry) {
  const metrics = [
    entry.vo2 ?`VO2 ${entry.vo2}` : "",
    entry.weightKg ?`${entry.weightKg} kg` : "",
    entry.heartRate ?`FC ${entry.heartRate}` : "",
    entry.power ?`${entry.power} W` : "",
    entry.pace ?`ritmo ${entry.pace}` : "",
    entry.sleepHours ?`sono ${entry.sleepHours}h` : "",
    entry.perceivedEffort ?`RPE ${entry.perceivedEffort}/10` : "",
    entry.painScore !== "" && entry.painScore != null ?`dor ${entry.painScore}/10` : ""
  ].filter(Boolean);
  return `
    <details class="history-record-card" data-history-id="${escapeHtml(entry.id)}">
      <summary>
        <div>
          <span>${escapeHtml(entry.startDate.split("-").reverse().join("/"))}${entry.time ?` ${escapeHtml(entry.time)}` : ""} · ${escapeHtml(historyRecordTypeLabel(entry.type))}</span>
          <strong>${escapeHtml(entry.title || "Registro cronológico")}</strong>
          <p>${escapeHtml(entry.description || entry.originalContent || "")}</p>
        </div>
        <button class="danger-action compact" type="button" data-remove-history-entry="${escapeHtml(entry.id)}">Remover</button>
      </summary>
      <div class="history-record-meta">
        <small><b>Tags</b>${escapeHtml((entry.tags || []).join(", ") || "contexto")}</small>
        <small><b>Importância</b>${escapeHtml(entry.importance)}</small>
        <small><b>Relação</b>${escapeHtml(entry.relation)}</small>
        <small><b>Impacto futuro</b>${escapeHtml(entry.possibleImpact)}</small>
        ${metrics.length ?`<small><b>Métricas</b>${escapeHtml(metrics.join(" · "))}</small>` : ""}
      </div>
    </details>
  `;
}

function historyGroupedList(entries) {
  const groups = entries.reduce((acc, entry) => {
    const month = entry.startDate?.slice(0, 7) || "sem-data";
    if (!acc[month]) acc[month] = [];
    acc[month].push(entry);
    return acc;
  }, {});
  return Object.entries(groups).map(([month, items]) => `
    <section class="history-month-group">
      <h4>${escapeHtml(month === "sem-data" ? "Sem data" : new Date(`${month}-01T00:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }))}</h4>
      <div>${items.map((entry) => historyRecordCard(entry)).join("")}</div>
    </section>
  `).join("") || `<div class="empty-state">Nenhum registro cronológico salvo ainda.</div>`;
}

function renderHistoryTimelineEditor(entries = state.historyTimelineDraft) {
  const target = document.querySelector("#historyTimelineList");
  if (!target) return;
  if (entries !== state.historyTimelineDraft) {
    state.historyTimelineDraft = sortHistoryEntries((Array.isArray(entries) ?entries : []).map(normalizeHistoryEntry));
  }
  const filter = state.historyTimelineFilter || "all";
  const filtered = state.historyTimelineDraft.filter((entry) => historyEntryMatchesFilter(entry, filter));
  target.innerHTML = `
    ${historyRecordComposerTemplate()}
    <div class="history-toolbar">
      <label class="credential-field">
        <span>Filtrar linha do tempo</span>
        <select data-history-filter>
          <option value="all" ${filter === "all" ?"selected" : ""}>Todos</option>
          <option value="training" ${filter === "training" ?"selected" : ""}>Treino</option>
          <option value="test" ${filter === "test" ?"selected" : ""}>Teste</option>
          <option value="pain" ${filter === "pain" ?"selected" : ""}>Dor / risco</option>
          <option value="competition" ${filter === "competition" ?"selected" : ""}>Competição</option>
          <option value="recovery" ${filter === "recovery" ?"selected" : ""}>Recuperação</option>
          <option value="analysis" ${filter === "analysis" ?"selected" : ""}>Relevantes para análise</option>
        </select>
      </label>
      <div class="history-counter"><strong>${filtered.length}</strong><span>registros exibidos de ${state.historyTimelineDraft.length}</span></div>
    </div>
    <div class="history-output" id="historyAnalysisOutput">${state.historyTimelineOutput || ""}</div>
    <div class="history-saved-list">${historyGroupedList(filtered)}</div>
  `;
}

function test3000RowTemplate(test = {}, index = 1) {
  return `
    <article class="test3000-row">
      <label class="credential-field">
        <span>Teste ${index} - data</span>
        <input data-test3000-date type="date" value="${escapeHtml(test.date || "")}" />
      </label>
      <label class="credential-field">
        <span>Teste ${index} - tempo</span>
        <input data-test3000-time placeholder="mm:ss" value="${escapeHtml(test.time || "")}" />
      </label>
      <label class="credential-field">
        <span>Observação</span>
        <input data-test3000-notes value="${escapeHtml(test.notes || "")}" />
      </label>
      <button class="danger-action compact" type="button" data-remove-3000-test>Remover</button>
    </article>
  `;
}

function renderTests3000Editor(tests = []) {
  const target = document.querySelector("#tests3000List");
  if (!target) return;
  const cleanTests = Array.isArray(tests) ?tests : [];
  const visibleTests = cleanTests.length ?cleanTests : [{}];
  target.innerHTML = visibleTests.map((test, index) => test3000RowTemplate(test, index + 1)).join("");
}

function readHistoryTimelineForm(form) {
  const pending = readHistoryComposer(form);
  const entries = pending ?[...state.historyTimelineDraft, pending] : state.historyTimelineDraft;
  return sortHistoryEntries(entries.map(normalizeHistoryEntry));
}

function readHistoryComposer(scope = document) {
  const content = scope.querySelector("[data-history-new-content]")?.value?.trim() || "";
  const title = scope.querySelector("[data-history-new-title]")?.value?.trim() || "";
  const hasMetric = [
    "[data-history-new-vo2]",
    "[data-history-new-weight]",
    "[data-history-new-hr]",
    "[data-history-new-power]",
    "[data-history-new-pace]",
    "[data-history-new-sleep]",
    "[data-history-new-rpe]",
    "[data-history-new-pain]"
  ].some((selector) => scope.querySelector(selector)?.value);
  if (!content && !title && !hasMetric) return null;
  return normalizeHistoryEntry({
    startDate: scope.querySelector("[data-history-new-date]")?.value || dateKey(new Date()),
    time: scope.querySelector("[data-history-new-time]")?.value || "",
    type: scope.querySelector("[data-history-new-type]")?.value || "context",
    title,
    description: content,
    originalContent: content,
    vo2: scope.querySelector("[data-history-new-vo2]")?.value || "",
    weightKg: scope.querySelector("[data-history-new-weight]")?.value || "",
    heartRate: scope.querySelector("[data-history-new-hr]")?.value || "",
    power: scope.querySelector("[data-history-new-power]")?.value || "",
    pace: scope.querySelector("[data-history-new-pace]")?.value || "",
    sleepHours: scope.querySelector("[data-history-new-sleep]")?.value || "",
    perceivedEffort: scope.querySelector("[data-history-new-rpe]")?.value || "",
    painScore: scope.querySelector("[data-history-new-pain]")?.value || ""
  });
}

function readTests3000Form(form) {
  return [...form.querySelectorAll(".test3000-row")].map((row) => ({
    date: row.querySelector("[data-test3000-date]")?.value || "",
    time: row.querySelector("[data-test3000-time]")?.value || "",
    notes: row.querySelector("[data-test3000-notes]")?.value || ""
  }));
}

function readAthleteForm(form) {
  const body = Object.fromEntries(new FormData(form).entries());
  const coachSelect = form.elements.coachEmail;
  const coachOption = coachSelect?.selectedOptions?.[0];
  if (coachOption && coachSelect.value) body.coachName = coachOption.textContent.split(" - ")[0];
  if (state.currentUser?.role === "athlete") {
    body.profileData = {
      relationshipRequest: {
        teamName: body.teamName || "",
        coachName: body.coachName || "",
        coachEmail: body.coachEmail || "",
        requestedAt: new Date().toISOString()
      }
    };
    delete body.teamName;
    delete body.coachName;
    delete body.coachEmail;
  }
  body.historyTimeline = readHistoryTimelineForm(form);
  body.tests3000 = readTests3000Form(form);
  if (!isSuperAdmin()) delete body.role;
  return body;
}

function editAthlete(athleteId, options = {}) {
  const athlete = state.athletes.find((item) => String(item.id) === String(athleteId));
  const form = document.querySelector("#athleteForm");
  if (!athlete || !form) return;
  state.editingAthleteId = athlete.id;
  renderDirectoryOptions(athlete);
  form.elements.name.value = athlete.name || "";
  form.elements.email.value = athlete.email || "";
  form.elements.age.value = athlete.age || "";
  form.elements.weightKg.value = athlete.weightKg || "";
  form.elements.heightCm.value = athlete.heightCm || "";
  form.elements.whatsapp.value = athlete.whatsapp || "";
  form.elements.teamName.value = athlete.teamName || "";
  if (form.elements.coachName) form.elements.coachName.value = athlete.coachName || "";
  if (form.elements.coachEmail) form.elements.coachEmail.value = athlete.coachEmail || "";
  if (form.elements.focusDistanceM) form.elements.focusDistanceM.value = athlete.focusDistanceM || "";
  if (form.elements.targetTime) form.elements.targetTime.value = athlete.targetTime || "";
  if (form.elements.targetDate) form.elements.targetDate.value = athlete.targetDate || "";
  if (form.elements.bestTime) form.elements.bestTime.value = athlete.bestTime || "";
  if (form.elements.role) form.elements.role.value = athlete.role || "athlete";
  if (form.elements.historyNotes) form.elements.historyNotes.value = athlete.historyNotes || "";
  renderHistoryTimelineEditor(athlete.historyTimeline || []);
  render3000ActivityPicker();
  const tests = Array.isArray(athlete.tests3000) ?athlete.tests3000 : [];
  renderTests3000Editor(tests);
  form.elements.password.value = "";
  const submit = document.querySelector("#athleteSubmitButton");
  const cancel = document.querySelector("#cancelAthleteEdit");
  if (submit) submit.textContent = options.profileMode ?"Salvar meu perfil" : "Atualizar atleta";
  if (cancel) cancel.hidden = Boolean(options.profileMode);
  setAthleteMessage(options.profileMode ?"" : `Editando ${athlete.name}.`);
}

async function deleteAthlete(athleteId) {
  const athlete = state.athletes.find((item) => String(item.id) === String(athleteId));
  if (!athlete) return;
  if (!window.confirm(`Excluir o atleta ${athlete.name}?Esta ação remove integrações e atividades importadas deste atleta.`)) return;
  try {
    setAthleteMessage("Excluindo atleta...");
    const payload = await api(`/api/athletes/${encodeURIComponent(athlete.id)}`, { method: "DELETE" });
    state.athletes = payload.athletes || [];
    if (String(state.selectedAthleteId) === String(athlete.id)) state.selectedAthleteId = state.athletes[0]?.id || "";
    syncSelectedAthlete();
    state.integrations = state.selectedAthleteId ?await api("/api/integrations") : {};
    state.activities = state.selectedAthleteId ?await api("/api/activities") : [];
    state.goals = state.selectedAthleteId ?await api("/api/goals") : [];
    renderAthletes();
    renderAthleteSelector();
    renderAthleteIdentity();
    renderProviders();
    renderCalendar();

    renderTrainingInsights();
    resetAthleteForm(`Atleta ${athlete.name} excluído.`);
  } catch (error) {
    setAthleteMessage(error.message, true);
    setLog([error.message], true);
  }
}

async function saveProvider(provider) {
  if (!state.selectedAthleteId) {
    setLog(["Cadastre e selecione um atleta antes de salvar integrações."], true);
    return false;
  }
  const form = document.querySelector(`[data-provider="${provider}"]`);
  const credentials = {};
  form.querySelectorAll("input[name]:not([name='enabled'])").forEach((input) => {
    const value = input.value.trim();
    if (value === SECRET_MASK) return;
    credentials[input.name] = value;
  });
  const enabled = form.querySelector("input[name='enabled']").checked;
  state.integrations = await api("/api/integrations", {
    method: "POST",
    body: JSON.stringify({ provider, enabled, credentials })
  });
  renderProviders();
  setLog([`${providerDefinitions[provider].name}: credenciais salvas localmente.`]);
  return true;
}

async function runSync() {
  if (state.syncing) return;
  if (!state.selectedAthleteId) {
    setLog(["Cadastre e selecione um atleta antes de importar atividades."], true);
    return;
  }
  const days = document.querySelector("#importWindow").value;
  const providers = [...document.querySelectorAll(".provider-form input[name='enabled']:checked")]
    .map((input) => input.closest(".provider-form").dataset.provider);
  let detailResult = { updated: 0, remaining: 0 };
  try {
    setSyncLoading(true, "Importando atividades", `Sincronizando últimos ${days} dias com as fontes ativas.`, "Conectando");
    setLog([`Sincronizando últimos ${days} dias...`]);
    const payload = await api("/api/sync", {
      method: "POST",
      body: JSON.stringify({ days, providers })
    });
    state.activities = payload.activities || [];
    renderCalendar();

    renderTrainingInsights();
    if (providers.includes("strava") && state.activities.length) {
      detailResult = await enrichStravaDescriptions();
    }
    setLog([
      payload.imported
        ?`Importadas/atualizadas: ${payload.imported} atividades reais.`
        : `Nenhuma atividade nova retornada pelas fontes no intervalo de ${days} dias.`,
      state.activities.length ?`Total no banco para este atleta: ${state.activities.length}.` : "Nenhuma atividade salva para este atleta.",
      detailResult.updated ?`Descrições completas atualizadas: ${detailResult.updated}.` : "Descrições já estavam atualizadas ou não retornaram detalhe adicional.",
      detailResult.remaining ?`Descrições pendentes: ${detailResult.remaining}. Clique novamente para continuar.` : "Descrições sincronizadas em lotes.",
      ...(payload.warnings || []),
      "Calendário atualizado."
    ]);
  } catch (error) {
    setLog([error.message], true);
  } finally {
    setSyncLoading(false);
  }
}

async function testStrava() {
  if (!state.selectedAthleteId) {
    setLog(["Selecione um atleta antes de testar o Strava."], true);
    return;
  }
  try {
    setLog(["Testando conexão real com o Strava..."]);
    const payload = await api("/api/strava/test");
    const athlete = payload.athlete || {};
    const name = [athlete.firstname, athlete.lastname].filter(Boolean).join(" ") || athlete.username || "atleta Strava";
    setLog([`Strava conectado para ${name}. Escopos: ${payload.scope || "não informado"}.`]);
    state.integrations = await api("/api/integrations");
    renderProviders();
  } catch (error) {
    setLog([error.message], true);
  }
}

async function saveAthlete(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const body = readAthleteForm(form);
  const editingId = state.currentUser?.id || state.editingAthleteId || state.selectedAthleteId;
  setAthleteMessage("Atualizando meu perfil...");
  try {
    const payload = await api(editingId ?`/api/athletes/${encodeURIComponent(editingId)}` : "/api/athletes", {
      method: editingId ?"PUT" : "POST",
      body: JSON.stringify(body)
    });
    state.athletes = payload.athletes || [];
    state.selectedAthleteId = payload.athlete.id;
    syncSelectedAthlete();
    await refreshDirectory();
    renderAthletes();
    renderAthleteSelector();
    renderAthleteIdentity();
    renderCalendar();
    editAthlete(payload.athlete.id, { profileMode: true });
    setAthleteMessage(`Perfil de ${payload.athlete.name} atualizado com sucesso.`);
    setLog([`Perfil de ${payload.athlete.name} salvo com sucesso.`]);
  } catch (error) {
    setAthleteMessage(error.message, true);
    setLog([error.message], true);
  }
}

function setAdminMessage(message, isError = false) {
  const target = document.querySelector("#adminMessage");
  if (!target) return;
  target.classList.toggle("is-error", isError);
  target.textContent = message;
}

async function refreshDirectory() {
  try {
    state.directory = await api("/api/directory");
  } catch {
    state.directory = { teams: [], coaches: [] };
  }
  renderDirectoryOptions(getCurrentUserAthlete());
}

function renderAdminMode() {
  const isTeam = state.adminMode === "team";
  const isCoach = state.adminMode === "coach";
  const isAdminMode = state.adminMode === "admin";
  document.querySelectorAll("[data-admin-mode]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.adminMode === state.adminMode);
  });
  const title = document.querySelector("#adminFormTitle");
  if (title) {
    const action = state.editingAdminUserId ?"Editar" : "Adicionar";
    title.textContent = state.adminMode === "admin" ?`${action} super admin` : state.adminMode === "coach" ?`${action} treinador` : state.adminMode === "team" ?`${action} equipe` : `${action} atleta`;
  }
  const userForm = document.querySelector("#adminUserForm");
  const teamForm = document.querySelector("#teamForm");
  if (userForm) {
    userForm.hidden = isTeam;
    if (userForm.elements.role) userForm.elements.role.value = isAdminMode ?"admin" : state.adminMode === "coach" ?"coach" : "athlete";
  }
  document.querySelectorAll(".admin-athlete-field").forEach((field) => {
    field.hidden = isCoach || isTeam || isAdminMode;
  });
  document.querySelectorAll(".admin-team-link-field").forEach((field) => {
    field.hidden = isTeam || isAdminMode;
  });
  document.querySelectorAll(".admin-coach-field").forEach((field) => {
    field.hidden = !isCoach;
  });
  if (teamForm) teamForm.hidden = !isTeam;
  const submit = userForm?.querySelector('button[type="submit"]');
  if (submit) submit.textContent = state.editingAdminUserId ?"Atualizar cadastro" : "Salvar cadastro";
}

function editAdminUser(athleteId) {
  const athlete = state.athletes.find((item) => String(item.id) === String(athleteId));
  const form = document.querySelector("#adminUserForm");
  if (!athlete || !form) return;
  state.editingAdminUserId = athlete.id;
  state.adminMode = athlete.role === "admin" ?"admin" : athlete.role === "coach" ?"coach" : "athlete";
  renderAdminMode();
  const profile = athlete.profileData || {};
  if (form.elements.role) form.elements.role.value = athlete.role === "admin" ?"admin" : athlete.role === "coach" ?"coach" : "athlete";
  form.elements.name.value = athlete.name || "";
  form.elements.email.value = athlete.email || "";
  form.elements.password.value = "";
  form.elements.whatsapp.value = athlete.whatsapp || "";
  if (form.elements.teamName) form.elements.teamName.value = athlete.teamName || "";
  if (form.elements.coachEmail) form.elements.coachEmail.value = athlete.coachEmail || "";
  if (form.elements.focusDistanceM) form.elements.focusDistanceM.value = athlete.focusDistanceM || "";
  if (form.elements.education) form.elements.education.value = profile.education || "";
  if (form.elements.skills) form.elements.skills.value = profile.skills || "";
  if (form.elements.experience) form.elements.experience.value = profile.experience || "";
  if (form.elements.certifications) form.elements.certifications.value = profile.certifications || "";
  setAdminMessage(`Editando ${athlete.name}.`);
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function saveAdminUser(event) {
  event.preventDefault();
  if (!canManageAthletes()) return;
  const form = event.currentTarget;
  const body = Object.fromEntries(new FormData(form).entries());
  const coachSelect = form.elements.coachEmail;
  const coachOption = coachSelect?.selectedOptions?.[0];
  if (coachOption && coachSelect.value) body.coachName = coachOption.textContent.split(" - ")[0];
  if (state.adminMode === "admin") {
    body.role = "admin";
    body.teamName = "";
    body.coachEmail = "";
    body.focusDistanceM = "";
    body.profileData = {};
  }
  if (state.adminMode === "coach") {
    body.role = "coach";
    body.coachEmail = "";
    body.focusDistanceM = "";
    body.profileData = {
      education: body.education || "",
      skills: body.skills || "",
      experience: body.experience || "",
      certifications: body.certifications || ""
    };
  }
  try {
    const editingId = state.editingAdminUserId;
    setAdminMessage(editingId ?"Atualizando cadastro..." : "Salvando cadastro...");
    const payload = await api(editingId ?`/api/athletes/${editingId}` : "/api/athletes", {
      method: editingId ?"PUT" : "POST",
      body: JSON.stringify(body)
    });
    state.athletes = payload.athletes || [];
    await refreshDirectory();
    renderAthletes();
    renderAthleteSelector();
    renderAthleteIdentity();
    renderCalendar();
    form.reset();
    state.editingAdminUserId = "";
    renderAdminMode();
    setAdminMessage(`${payload.athlete.name} ${editingId ?"atualizado" : "cadastrado"} com sucesso.`);
  } catch (error) {
    setAdminMessage(error.message, true);
  }
}

async function approveRelationshipRequest(athleteId) {
  const athlete = state.athletes.find((item) => String(item.id) === String(athleteId));
  const request = athlete?.profileData?.relationshipRequest;
  if (!athlete || !request) return;
  try {
    setAdminMessage("Aprovando solicitação...");
    const body = {
      ...athlete,
      teamName: request.teamName || athlete.teamName || "",
      coachName: request.coachName || athlete.coachName || "",
      coachEmail: request.coachEmail || athlete.coachEmail || "",
      profileData: {
        ...(athlete.profileData || {}),
        relationshipRequest: null,
        relationshipApprovedAt: new Date().toISOString()
      }
    };
    const payload = await api(`/api/athletes/${encodeURIComponent(athlete.id)}`, {
      method: "PUT",
      body: JSON.stringify(body)
    });
    state.athletes = payload.athletes || [];
    await refreshDirectory();
    renderAthletes();
    renderAthleteSelector();
    renderAthleteIdentity();
    setAdminMessage("Solicitação aprovada.");
  } catch (error) {
    setAdminMessage(error.message, true);
  }
}

async function saveTeam(event) {
  event.preventDefault();
  if (!canManageAthletes()) return;
  const form = event.currentTarget;
  const body = Object.fromEntries(new FormData(form).entries());
  try {
    setAdminMessage("Salvando equipe...");
    const payload = await api("/api/teams", {
      method: "POST",
      body: JSON.stringify(body)
    });
    state.directory = payload.directory || state.directory;
    renderDirectoryOptions(getCurrentUserAthlete());
    renderAthletes();
    form.reset();
    setAdminMessage(`Equipe ${payload.team.name} cadastrada com sucesso.`);
  } catch (error) {
    setAdminMessage(error.message, true);
  }
}

async function loadSettings() {
  if (!isSuperAdmin()) {
    state.appSettings = null;
    renderPermissions();
    return;
  }
  try {
    state.appSettings = await api("/api/settings");
    renderAiSettings();
  } catch (error) {
    const target = document.querySelector("#aiSettingsMessage");
    if (target) target.textContent = error.message;
  }
  renderPermissions();
}

async function saveAiSettings(event) {
  event.preventDefault();
  if (!isSuperAdmin()) return;
  const form = event.currentTarget;
  const body = Object.fromEntries(new FormData(form).entries());
  body.openaiEnabled = form.elements.openaiEnabled.checked;
  try {
    state.appSettings = await api("/api/settings", {
      method: "POST",
      body: JSON.stringify(body)
    });
    renderAiSettings();
    document.querySelector("#aiSettingsMessage").textContent = "Configuração de IA salva.";
  } catch (error) {
    document.querySelector("#aiSettingsMessage").textContent = error.message;
  }
}

async function testOpenAiSettings() {
  if (!isSuperAdmin()) return;
  const target = document.querySelector("#aiSettingsMessage");
  if (target) target.textContent = "Testando IA configurada...";
  try {
    const result = await api("/api/ai/test", { method: "POST", body: JSON.stringify({}) });
    if (target) target.textContent = `IA operacional (${result.model}): ${result.text}`;
  } catch (error) {
    if (target) target.textContent = `Falha no teste da IA: ${error.message}`;
  }
}

function setDashboardRecalcBusy(isBusy) {
  document.querySelectorAll("[data-recalculate-dashboard]").forEach((button) => {
    button.disabled = isBusy;
    button.classList.toggle("is-loading", isBusy);
    button.textContent = isBusy ? "Analisando..." : "Recalcular";
  });
}

function compactActivityForAi(activity) {
  return {
    date: activity.date,
    title: activity.title,
    type: activity.trainingType || activity.feedback?.trainingType || "",
    distanceKm: Number(parseDistanceKm(activity.distance).toFixed(2)),
    seconds: activityMovingSeconds(activity),
    pace: activityMovingSeconds(activity) && parseDistanceKm(activity.distance)
      ?formatPace(activityMovingSeconds(activity) / parseDistanceKm(activity.distance))
      : "",
    tss: activityTss(activity),
    perceivedEffort: activity.feedback?.perceivedEffort || "",
    painScore: activity.feedback?.painScore ?? "",
    performancePercent: activity.feedback?.performancePercent || ""
  };
}

function compactAthleteForAi(athlete, tests, localAnalysis) {
  return {
    id: athlete.id,
    name: athlete.name,
    age: athlete.age,
    weightKg: athlete.weightKg,
    heightCm: athlete.heightCm,
    focusDistanceM: athlete.focusDistanceM,
    targetTimeSeconds: athlete.targetTimeSeconds,
    targetDate: athlete.targetDate,
    tests3000: tests.map((test) => ({
      date: test.date instanceof Date ?test.date.toISOString().slice(0, 10) : test.date,
      seconds: test.seconds,
      source: test.source || test.origin || test.title || ""
    })),
    historyTimeline: (athlete.historyTimeline || []).map((entry) => ({
      date: entry.startDate,
      time: entry.time || "",
      type: entry.type,
      title: entry.title,
      description: entry.description || entry.originalContent || "",
      vo2: entry.vo2 || "",
      weightKg: entry.weightKg || "",
      painScore: entry.painScore ?? "",
      perceivedEffort: entry.perceivedEffort || "",
      tags: entry.tags || [],
      importance: entry.importance || "",
      relation: entry.relation || ""
    })).slice(-80),
    chronologySummary: localAnalysis.summary
  };
}

async function refreshAiProjection() {
  const athlete = getActiveAthlete();
  if (!athlete) return;
  const model = buildFocusModel(athlete);
  state.aiProjection = { text: "Analisando com IA..." };
  renderFocusRoadmap();
  try {
    state.aiProjection = await api("/api/ai/projection", {
      method: "POST",
      body: JSON.stringify({ athlete, model, activities: activitiesSince(90).slice(-60) })
    });
  } catch (error) {
    state.aiProjection = { text: `IA indisponível: ${friendlyAiError(error.message)}` };
  }
  renderFocusRoadmap();
}

async function recalculateDashboardAnalysis() {
  const athlete = getActiveAthlete();
  if (!athlete) return;
  const tests = collect3000Tests(athlete);
  const localAnalysis = buildChronologicalPerformanceAnalysis(athlete, tests);
  setDashboardRecalcBusy(true);
  state.dashboardAnalysis = {
    ...localAnalysis,
    athleteId: athlete.id,
    status: "running",
    aiText: "Etapa 1/3: dossiê cronológico montado. Etapa 2/3: enviando testes, VO2, linha do tempo e carga recente para a IA."
  };
  renderDashboard();
  try {
    const model = buildFocusModel(athlete);
    state.dashboardAnalysis = {
      ...state.dashboardAnalysis,
      aiText: "Etapa 2/3: IA do sistema interpretando histórico, fadiga, evolução e riscos antes de atualizar os resultados."
    };
    renderDashboard();
    const aiProjection = await api("/api/ai/projection", {
      method: "POST",
      body: JSON.stringify({
        athleteId: athlete.id,
        athlete: compactAthleteForAi(athlete, tests, localAnalysis),
        model,
        chronology: {
          summary: localAnalysis.summary,
          probabilityModifier: localAnalysis.probabilityModifier,
          historyModifier: localAnalysis.historyModifier,
          trainingTrendModifier: localAnalysis.trainingTrendModifier,
          riskScore: localAnalysis.riskScore,
          positiveScore: localAnalysis.positiveScore,
          events: localAnalysis.events.map((event) => ({
            date: event.date instanceof Date ?event.date.toISOString().slice(0, 10) : event.date,
            type: event.type,
            label: event.label,
            weight: event.weight,
            vo2: event.vo2 || ""
          }))
        },
        activities: activitiesSince(180).filter(isRunningActivity).slice(-60).map(compactActivityForAi)
      })
    });
    state.dashboardAnalysis = {
      ...localAnalysis,
      athleteId: athlete.id,
      status: aiProjection?.ok ? "ready" : "local",
      aiText: aiProjection?.text || "A IA respondeu, mas sem texto interpretável. Modelo local aplicado.",
      aiModel: aiProjection?.model || "modelo local 11RUN"
    };
  } catch (error) {
    state.dashboardAnalysis = {
      ...localAnalysis,
      athleteId: athlete.id,
      status: "local",
      aiText: `${friendlyAiError(error.message)} Modelo local aplicado com cronologia: ${localAnalysis.summary}`,
      aiModel: "modelo local 11RUN"
    };
  } finally {
    setDashboardRecalcBusy(false);
  }
  renderDashboard();
}

async function loadAppVersion() {
  const versionTarget = document.querySelector("#appVersion");
  if (!versionTarget) return;
  try {
    const health = await api("/api/health");
    const rawVersion = String(health.version || APP_VERSION_FALLBACK).trim();
    const version = rawVersion.length > 12 ?rawVersion.slice(0, 12) : rawVersion;
    versionTarget.textContent = `deploy ${version}`;
  } catch {
    versionTarget.textContent = `deploy ${APP_VERSION_FALLBACK}`;
  }
}

async function boot() {
  const initialHash = location.hash.replace("#", "").split("?")[0];
  const status = new URLSearchParams(location.hash.split("?")[1] || "");
  try {
    if (status.get("athlete")) {
      state.selectedAthleteId = status.get("athlete");
      localStorage.setItem("selectedAthleteId", state.selectedAthleteId);
    }
    const session = await api("/api/me");
    state.currentUser = session.user;
    if (!state.currentUser) {
      showLogin();
      return;
    }
    showApp();
    state.athletes = await api("/api/athletes");
    syncSelectedAthlete();
    await refreshDirectory();
    state.integrations = await api("/api/integrations");
    state.activities = await api("/api/activities");
    state.goals = await api("/api/goals");
    await loadSettings();
  } catch (error) {
    if (error.message === "Login obrigatório.") showLogin();
    else {
      showApp();
      renderPermissions();
      renderProviders();
      renderAthletes();
      renderAthleteSelector();
      renderAthleteIdentity();
      renderCalendar();

      renderTrainingInsights();
      renderDashboard();
      applyI18n();
      setLog([`Erro ao carregar dados do banco: ${error.message}`], true);
      setView(viewFromHash(initialHash));
    }
    return;
  }

  setView(viewFromHash(initialHash));
  renderPermissions();
  renderProviders();
  renderAthletes();
  renderAthleteSelector();
  renderAthleteIdentity();
  renderCalendar();

  renderTrainingInsights();
  renderDashboard();
  applyI18n();
  enhanceSystemControls();
  renderDirectoryOptions(getCurrentUserAthlete());
  renderAdminMode();
  if (state.view === "athlete") editCurrentUserProfile();

  if (status.get("strava") === "connected") setLog(["Strava conectado. Clique em Importar e atualizar para puxar as atividades reais."]);
  if (status.get("strava") === "error") setLog([`Erro Strava: ${status.get("message") || "falha na autorização."}`], true);
  if (status.get("strava") === "state_error") setLog(["Erro Strava: estado OAuth inválido ou expirado. Clique em Conectar Strava novamente."], true);
}

if (shell && localStorage.getItem("railCollapsed") === "1") setRailCollapsed(true);
if (menuToggle) menuToggle.addEventListener("click", toggleMenu);
if (railBackdrop) railBackdrop.addEventListener("click", () => setMenuOpen(false));
window.addEventListener("resize", () => {
  if (!isMobileLayout()) setMenuOpen(false);
});

document.querySelectorAll("[data-view-link]").forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    setView(link.dataset.viewLink);
  });
});

document.querySelectorAll("[data-view-button]").forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.viewButton));
});

document.querySelectorAll("[data-calendar-view]").forEach((button) => {
  button.addEventListener("click", () => {
    state.calendarView = button.dataset.calendarView;
    syncCalendarViewButtons();
    renderCalendar();
  });
});

document.querySelectorAll("[data-period-shift]").forEach((button) => {
  button.addEventListener("click", () => {
    const direction = Number(button.dataset.periodShift);
    const next = new Date(state.cursor);
    if (state.calendarView === "month") next.setMonth(next.getMonth() + direction);
    if (state.calendarView === "week") next.setDate(next.getDate() + direction * 7);
    if (state.calendarView === "day") next.setDate(next.getDate() + direction);
    if (state.calendarView === "quarter") next.setMonth(next.getMonth() + direction * 3);
    if (state.calendarView === "semester") next.setMonth(next.getMonth() + direction * 6);
    if (state.calendarView === "year") next.setFullYear(next.getFullYear() + direction);
    state.cursor = next;
    renderCalendar();
  });
});

document.querySelector("#loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const body = Object.fromEntries(new FormData(form).entries());
  try {
    const payload = await api("/api/login", {
      method: "POST",
      body: JSON.stringify(body)
    });
    state.currentUser = payload.user;
    form.reset();
    await boot();
  } catch (error) {
    showLogin(error.message);
  }
});

document.querySelector("#adminAthleteSelector")?.addEventListener("change", async (event) => {
  state.selectedAthleteId = event.currentTarget.value;
  syncSelectedAthlete();
  renderAthleteIdentity();
  try {
    const [integrations, activities, goals] = await Promise.all([
      api("/api/integrations"),
      api("/api/activities"),
      api("/api/goals")
    ]);
    state.integrations = integrations;
    state.activities = activities;
    state.goals = goals;
    renderProviders();
    renderCalendar();

    renderTrainingInsights();
    const athlete = getActiveAthlete();
    setLog([`Atleta selecionado: ${athlete?.name || "nenhum"}. Integrações e calendário atualizados.`]);
  } catch (error) {
    setLog([error.message], true);
  }
});

calendar.addEventListener("click", (event) => {
  const activityButton = event.target.closest("[data-activity-id]");
  if (activityButton) openActivity(activityButton.dataset.activityId);
});

document.addEventListener("click", async (event) => {
  const panelToggle = event.target.closest("[data-toggle-panel]");
  if (panelToggle) {
    const key = panelToggle.dataset.togglePanel;
    setPanelCollapsed(key, !isPanelCollapsed(key));
    if (key === "goalForm") {
      renderGoals();
      return;
    }
    if (key === "dashboardIntegrations") {
      renderProviders();
      return;
    }
    renderCalendar();
    return;
  }
  if (event.target.closest("#openProfileModal")) {
    openProfileDialog();
    return;
  }
  if (event.target.closest("#openHistoryModal")) {
    openHistoryDialog();
    return;
  }
  const closeDialogButton = event.target.closest("[data-close-dialog]");
  if (closeDialogButton) {
    const dialog = closeDialogButton.closest("dialog");
    dialog?.close();
    return;
  }
  if (event.target.closest("[data-expand-profile]")) {
    const panel = document.querySelector("#profileModalPanel");
    const button = event.target.closest("[data-expand-profile]");
    const expanded = !panel?.classList.contains("is-expanded");
    panel?.classList.toggle("is-expanded", expanded);
    if (button) button.textContent = expanded ? t("profile.collapse") : t("profile.expand");
    return;
  }
  if (event.target.closest("[data-open-workout-builder]")) {
    openWorkoutDialog();
    return;
  }
  const workoutModeButton = event.target.closest("[data-workout-mode]");
  if (workoutModeButton) {
    applyWorkoutMode(workoutModeButton.dataset.workoutMode);
    return;
  }
  const editButton = event.target.closest("[data-edit-athlete]");
  if (editButton) {
    event.preventDefault();
    event.stopPropagation();
    if (state.view === "settings") {
      editAdminUser(editButton.dataset.editAthlete);
    } else {
      editAthlete(editButton.dataset.editAthlete);
    }
    return;
  }
  const deleteButton = event.target.closest("[data-delete-athlete]");
  if (deleteButton) {
    event.preventDefault();
    event.stopPropagation();
    await deleteAthlete(deleteButton.dataset.deleteAthlete);
    return;
  }
  const adminUserToggle = event.target.closest("[data-toggle-admin-user]");
  if (adminUserToggle) {
    const id = adminUserToggle.dataset.toggleAdminUser;
    state.expandedAdminUserId = String(state.expandedAdminUserId) === String(id) ?"" : id;
    renderAthletes();
    return;
  }
  const saveButton = event.target.closest("[data-save-provider]");
  if (saveButton) {
    await saveProvider(saveButton.dataset.saveProvider);
    return;
  }
  if (event.target.closest("[data-connect-strava]")) {
    const saved = await saveProvider("strava");
    if (!saved) return;
    const athleteParam = state.selectedAthleteId ?`?athlete=${encodeURIComponent(state.selectedAthleteId)}` : "";
    window.location.href = `/api/strava/auth${athleteParam}`;
    return;
  }
  if (event.target.closest("[data-test-strava]")) {
    await testStrava();
    return;
  }
  if (event.target.closest("[data-test-openai]")) {
    await testOpenAiSettings();
    return;
  }
  if (event.target.closest("[data-refresh-ai]")) {
    await refreshAiProjection();
    return;
  }
  if (event.target.closest("[data-recalculate-dashboard]")) {
    await recalculateDashboardAnalysis();
    return;
  }
  const editGoalButton = event.target.closest("[data-edit-goal]");
  if (editGoalButton) {
    event.preventDefault();
    editGoal(editGoalButton.dataset.editGoal);
    return;
  }
  const deleteGoalButton = event.target.closest("[data-delete-goal]");
  if (deleteGoalButton) {
    event.preventDefault();
    await removeGoal(deleteGoalButton.dataset.deleteGoal);
    return;
  }
  const approveRelationshipButton = event.target.closest("[data-approve-relationship]");
  if (approveRelationshipButton) {
    event.preventDefault();
    await approveRelationshipRequest(approveRelationshipButton.dataset.approveRelationship);
    return;
  }
  if (event.target.closest("[data-save-history-record]")) {
    const record = readHistoryComposer(document);
    if (!record) {
      setAthleteMessage("Preencha o registro cronológico antes de salvar.", true);
      return;
    }
    state.historyTimelineDraft = sortHistoryEntries([...state.historyTimelineDraft, record]);
    state.historyTimelineOutput = "";
    renderHistoryTimelineEditor();
    setAthleteMessage("Registro cronológico salvo na linha do tempo. Clique em Salvar meu perfil para gravar no banco.");
    return;
  }
  const historyAction = event.target.closest("[data-history-action]");
  if (historyAction) {
    event.preventDefault();
    renderHistoryDossier(historyAction.dataset.historyAction);
    return;
  }
  if (event.target.closest("#addHistoryEntry")) {
    const list = document.querySelector("#historyTimelineList");
    if (list) list.insertAdjacentHTML("beforeend", historyTimelineRowTemplate({}));
    return;
  }
  if (event.target.closest("#addVo2Test")) {
    const list = document.querySelector("#historyTimelineList");
    if (list) list.insertAdjacentHTML("beforeend", historyTimelineRowTemplate({ type: "vo2", title: "Teste de VO2" }));
    return;
  }
  if (event.target.closest("#add3000Test")) {
    const list = document.querySelector("#tests3000List");
    const count = list?.querySelectorAll(".test3000-row").length || 0;
    if (list) list.insertAdjacentHTML("beforeend", test3000RowTemplate({}, count + 1));
    return;
  }
  if (event.target.closest("#flagSelected3000")) {
    const picker = document.querySelector("#activity3000Picker");
    const activityId = picker?.value || "";
    if (!activityId) {
      setAthleteMessage("Selecione uma atividade importada para marcar como teste de 3000 m.", true);
      return;
    }
    await setActivity3000Flag(activityId, true);
    return;
  }
  if (event.target.closest("[data-remove-history-entry]")) {
    const removeButton = event.target.closest("[data-remove-history-entry]");
    const recordId = removeButton?.dataset.removeHistoryEntry || "";
    if (recordId) {
      state.historyTimelineDraft = state.historyTimelineDraft.filter((entry) => String(entry.id) !== String(recordId));
      state.historyTimelineOutput = "";
      renderHistoryTimelineEditor();
      setAthleteMessage("Registro removido da linha do tempo. Clique em Salvar meu perfil para gravar a alteração.");
      return;
    }
    const row = event.target.closest(".history-entry-row");
    if (row) row.remove();
    return;
  }
  if (event.target.closest("[data-remove-3000-test]")) {
    const row = event.target.closest(".test3000-row");
    const list = document.querySelector("#tests3000List");
    if (row) row.remove();
    if (list && !list.querySelector(".test3000-row")) {
      list.innerHTML = test3000RowTemplate({}, 1);
    }
    return;
  }
  const testFlagButton = event.target.closest("[data-flag-3000-activity]");
  if (testFlagButton) {
    event.preventDefault();
    event.stopPropagation();
    const activityId = testFlagButton.getAttribute("data-flag-3000-activity") || testFlagButton.dataset.flag3000Activity;
    const enabled = (testFlagButton.getAttribute("data-flag-enabled") || testFlagButton.dataset.flagEnabled) === "1";
    if (!activityId) {
      setLog(["Não foi possível identificar a atividade para marcar o teste de 3000 m."], true);
      return;
    }
    await setActivity3000Flag(activityId, enabled);
    return;
  }
  const feedbackButton = event.target.closest("[data-save-activity-feedback]");
  if (feedbackButton) {
    event.preventDefault();
    event.stopPropagation();
    await saveActivityFeedback(feedbackButton.dataset.saveActivityFeedback);
    return;
  }
});

document.addEventListener("change", (event) => {
  if (event.target?.id === "languageSelect") {
    state.language = event.target.value || "pt-BR";
    localStorage.setItem("appLanguage", state.language);
    applyI18n();
    const expandButton = document.querySelector("[data-expand-profile]");
    const expanded = document.querySelector("#profileModalPanel")?.classList.contains("is-expanded");
    if (expandButton) expandButton.textContent = expanded ? t("profile.collapse") : t("profile.expand");
  }
  if (event.target?.closest("#workoutBuilderForm") && ["startDate", "endDate"].includes(event.target.name)) {
    syncWorkoutDates();
  }
  if (event.target?.matches("[data-history-filter]")) {
    state.historyTimelineFilter = event.target.value || "all";
    renderHistoryTimelineEditor();
  }
});

document.addEventListener("submit", async (event) => {
  if (event.target?.id === "workoutBuilderForm") {
    await saveManualWorkout(event);
  }
});

document.querySelector("#coachEmailSelect")?.addEventListener("change", (event) => {
  const option = event.currentTarget.selectedOptions?.[0];
  const form = document.querySelector("#athleteForm");
  if (form?.elements.coachName) {
    form.elements.coachName.value = event.currentTarget.value && option ?option.textContent.split(" - ")[0] : "";
  }
});

document.querySelectorAll("[data-admin-mode]").forEach((button) => {
  button.addEventListener("click", () => {
    state.editingAdminUserId = "";
    document.querySelector("#adminUserForm")?.reset();
    state.adminMode = button.dataset.adminMode;
    setAdminMessage("");
    renderAdminMode();
  });
});

document.querySelector("#syncSelected")?.addEventListener("click", runSync);
document.querySelector("[data-import-demo]")?.addEventListener("click", runSync);
document.querySelector("#athleteForm")?.addEventListener("submit", saveAthlete);
document.querySelector("#goalForm")?.addEventListener("submit", saveGoal);
document.querySelector("#adminUserForm")?.addEventListener("submit", saveAdminUser);
document.querySelector("#teamForm")?.addEventListener("submit", saveTeam);
["#athleteFilterSearch", "#athleteFilterTeam", "#athleteFilterCoach"].forEach((selector) => {
  document.querySelector(selector)?.addEventListener("input", renderAthletes);
});
document.querySelector("#athleteFilterRole")?.addEventListener("change", renderAthletes);
document.querySelector("#aiSettingsForm")?.addEventListener("submit", saveAiSettings);
document.querySelector("#cancelAthleteEdit")?.addEventListener("click", () => resetAthleteForm("Edição cancelada."));

loadAppVersion();
renderHistoryTimelineEditor([]);
boot();
