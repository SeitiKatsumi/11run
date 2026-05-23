const state = {
  view: "home",
  calendarView: "month",
  cursor: new Date(),
  activities: [],
  goals: [],
  integrations: {},
  directory: { teams: [], coaches: [] },
  athletes: [],
  selectedAthleteId: localStorage.getItem("selectedAthleteId") || "",
  currentUser: null,
  appSettings: null,
  aiProjection: null,
  editingAthleteId: "",
  adminMode: "athlete",
  expandedAdminUserId: "",
  syncing: false,
  collapsedPanels: (() => {
    const defaults = {
      focusProjection: true,
      focusRoadmap: true,
      performanceChart: true
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
const monthNames = ["Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
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
      <button class="secondary-action compact" type="button" data-toggle-panel="${escapeHtml(key)}">Expandir painel</button>
    `;
    panel.insertBefore(control, panel.firstChild);
  }
  const collapsed = isPanelCollapsed(key);
  panel.classList.toggle("is-collapsed", collapsed);
  content.hidden = collapsed;
  const button = control.querySelector(`.secondary-action[data-toggle-panel="${key}"]`);
  if (button) button.textContent = collapsed ?"Expandir painel" : "Ocultar painel";
}

async function api(path, options = {}) {
  const scopedPaths = ["/api/integrations", "/api/activities", "/api/goals", "/api/sync", "/api/strava/auth", "/api/strava/test", "/api/strava/enrich", "/api/ai/projection"];
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

function setView(view) {
  if (view === "settings" && !canManageAthletes()) view = "athlete";
  state.view = view;
  document.querySelectorAll("[data-view]").forEach((section) => section.classList.toggle("is-visible", section.dataset.view === view));
  document.querySelectorAll("[data-view-link]").forEach((link) => link.classList.toggle("is-active", link.dataset.viewLink === view));
  if (view === "athlete") editCurrentUserProfile();
  location.hash = view === "training" ?"treinamentos" : view === "goals" ?"objetivos" : view === "athlete" ?"dashboard" : view === "settings" ?"configuracoes" : "home";
  closeMobileMenu();
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
    const end = new Date(base.getFullYear(), quarterStartMonth + 3, 0);
    return {
      start,
      end,
      days: Math.ceil((Math.round((end - start) / 86400000) + 1) / 7),
      unit: "week",
      label: `Trimestre ${Math.floor(quarterStartMonth / 3) + 1}/${base.getFullYear()}`
    };
  }
  if (view === "semester") {
    const semesterStartMonth = base.getMonth() < 6 ?0 : 6;
    const start = new Date(base.getFullYear(), semesterStartMonth, 1);
    const end = new Date(base.getFullYear(), semesterStartMonth + 6, 0);
    return {
      start,
      end,
      days: Math.ceil((Math.round((end - start) / 86400000) + 1) / 7),
      unit: "week",
      label: `Semestre ${semesterStartMonth === 0 ?1 : 2}/${base.getFullYear()}`
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
      source: `MANUAL: ${test.notes || "teste 3000"}`
    }));
  const flaggedActivities = visibleActivities()
    .filter((activity) => isRunningActivity(activity) && activity.is3000Test)
    .map((activity) => ({
      date: activityDate(activity),
      seconds: parseDurationSeconds(activity.duration),
      source: `FLAG: ${activity.title}`
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
          source: `AUTO: ${activity.title}`
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
  const history = String(athlete?.historyNotes || "").toLowerCase();
  const riskPenalty = /(les|dor|inflama|fadiga|cansa|viagem|pausa|doente|posterior)/i.test(history) ?12 : 0;
  const gapPercent = targetSeconds && currentSeconds ?((currentSeconds - targetSeconds) / currentSeconds) * 100 : 0;
  const weeks = daysToRace / 7;
  const realisticGain = Math.max(0, weeks * (0.45 + consistency * 0.45 + testSignal * 0.18));
  const loadScore = (consistency * 28) + (Math.min(1.25, volumeTrend) * 18) + (freshness * 14) + (testSignal * 12);
  const probability = targetSeconds && currentSeconds
    ?Math.round(Math.max(4, Math.min(96, 54 + loadScore + realisticGain - Math.max(0, gapPercent) * 5.2 - riskPenalty)))
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
  return {
    ...athlete,
    focusDistanceM: goal.distanceM,
    targetTimeSeconds: goal.targetTimeSeconds,
    targetTime: goal.targetTime,
    targetDate: goal.raceDate,
    bestTimeSeconds: 0
  };
}

function isPastGoal(goal) {
  const raceDate = goal.raceDate ?new Date(`${goal.raceDate}T00:00:00`) : null;
  if (!raceDate || Number.isNaN(raceDate.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return raceDate < today;
}

function goalDateLabel(goal) {
  if (!goal.raceDate) return "data nao definida";
  return new Date(`${goal.raceDate}T00:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function goalResultPerformance(goal) {
  const targetMeters = Number(goal.distanceM || 0);
  if (!goal.raceDate || !targetMeters) return null;
  const raceKey = normalizeDateKey(goal.raceDate);
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
  const analysis = resultMode
    ?actualSeconds
      ?`Resultado ${detectedResult ?`detectado em ${detectedResult.title}` : "registrado"}: ${gapLabel}.`
      : "Data da prova vencida. Registre o resultado para gerar a analise versus objetivo."
    : `${model.status || "Dados insuficientes"} - ${model.probability || 0}% de probabilidade.`;
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
        <div><span>Probabilidade</span><strong>${model.probability || "--"}%</strong></div>
        <div><span>Ganho necessário</span><strong>${escapeHtml(formatDurationSeconds(model.requiredGain))}</strong></div>
      </div>
      <div class="goal-route">
        <svg viewBox="0 0 560 70" role="img" aria-label="Rota preditiva do objetivo">
          <line x1="18" y1="46" x2="542" y2="46"></line>
          <path d="M 18 22 C 150 26, 280 38, 542 46"></path>
          <circle cx="18" cy="22" r="3"></circle>
          <circle cx="542" cy="46" r="3"></circle>
        </svg>
      </div>
      <p class="goal-analysis">${escapeHtml(analysis)}</p>
      ${goal.notes ?`<p class="goal-notes">${escapeHtml(goal.notes)}</p>` : ""}
    </article>
  `;
}

function renderGoals() {
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
  try {
    setGoalMessage("Salvando objetivo...");
    const payload = await api("/api/goals", {
      method: "POST",
      body: JSON.stringify(body)
    });
    state.goals = payload.goals || [];
    form.reset();
    renderGoals();
    setGoalMessage("Objetivo salvo.");
  } catch (error) {
    setGoalMessage(error.message || "Nao foi possivel salvar o objetivo.", true);
  }
}

function renderAthleteFocusHistory() {
  const target = document.querySelector("#athleteFocusHistory");
  if (!target) return;
  const athlete = getActiveAthlete();
  const tests = collect3000Tests(athlete);
  const times = tests.map((item) => `
    <strong>${escapeHtml(formatDurationSeconds(item.seconds))}</strong>
    <small>${escapeHtml(item.source || "teste")} · ${escapeHtml(item.date ?item.date.toLocaleDateString("pt-BR") : "")}</small>
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

function renderHeroMetrics() {
  const target = document.querySelector("#heroMetrics");
  if (!target) return;

  const last30 = activitiesSince(30);
  const last7 = activitiesSince(7);
  const km30 = last30.reduce((sum, activity) => sum + parseDistanceKm(activity.distance), 0);
  const km7 = last7.reduce((sum, activity) => sum + parseDistanceKm(activity.distance), 0);
  const averageWeeklyKm = km30 / 4.285;
  const trend = averageWeeklyKm ?Math.round((km7 / averageWeeklyKm) * 100) : 0;
  const status = !last30.length ?"Sem dados" : trend > 135 ?"Atenção" : trend < 55 ?"Baixa carga" : "Estável";
  const statusDetail = !last30.length ?"importe atividades" : `${trend}% da média recente`;

  target.innerHTML = `
    <div><span>30 dias</span><strong>${escapeHtml(formatKm(km30))}</strong><small>${last30.length} sessões</small></div>
    <div><span>Semana</span><strong>${escapeHtml(formatKm(km7))}</strong><small>${last7.length} sessões</small></div>
    <div><span>Status</span><strong>${escapeHtml(status)}</strong><small>${escapeHtml(statusDetail)}</small></div>
  `;
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

function activityTss(activity) {
  return Number(activity.analysis?.tss || activity.load || 0);
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
  if (toggle) toggle.textContent = collapsed ?"Abrir" : "Fechar";
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
      <div><span>Periodo</span><strong>${escapeHtml(label)}</strong></div>
      <div><span>Volume</span><strong>${escapeHtml(formatKm(totalVolume))}</strong></div>
      <div><span>11TSS</span><strong>${Math.round(totalTss)}</strong></div>
      <div><span>Sessoes</span><strong>${totalSessions}</strong></div>
    </div>
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Grafico de volume e 11TSS">
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
    ${hasData ?"" : `<p class="chart-empty">Importe atividades do Strava para visualizar a evolucao de volume e 11TSS.</p>`}
  `;
}

function renderActivity(activity) {
  const analysis = activity.analysis || {};
  const analysisLine = analysis.tss
    ?`<em>${escapeHtml(analysis.standard || "11TSS Advance")} ${escapeHtml(analysis.tss)} - agressao ${escapeHtml(analysis.aggressionScore || "--")} - ${escapeHtml(analysis.characteristic || "")}</em>`
    : "";
  return `
    <button class="activity" data-activity-id="${escapeHtml(activity.id)}" data-source="${escapeHtml(activity.source)}">
      <strong>${escapeHtml(activity.title)}</strong>
      <span>${escapeHtml(activity.source)} - ${escapeHtml(activity.distance)} - ${escapeHtml(activity.description)}</span>
      ${analysisLine}
    </button>
  `;
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
    : `<p class="period-empty">Sem atividades importadas neste mes.</p>`;

  return `
    <section class="period-month">
      <div class="period-month-head">
        <div>
          <span>${monthNames[monthDate.getMonth()]} ${monthDate.getFullYear()}</span>
          <strong>${activities.length} sessoes</strong>
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
  const weeks = [];
  for (let date = new Date(range.start), index = 0; date <= range.end; date = addDays(date, 7), index += 1) {
    weeks.push(renderPeriodWeek(new Date(date), new Date(Math.min(addDays(date, 6).getTime(), range.end.getTime())), index));
  }
  calendar.innerHTML = `<div class="period-week-list">${weeks.join("")}</div>`;
  document.querySelector("#calendarEyebrow").textContent = range.label;
  document.querySelector("#calendarTitle").textContent = hasActivitiesInCurrentRange()
    ?"Semanas do ciclo"
    : "Sem atividades neste período";
}

function renderCalendar() {
  syncCalendarViewButtons();
  const cursor = state.cursor;
  const calendarClass = state.calendarView === "quarter" || state.calendarView === "semester" ?"calendar-period" : `calendar-${state.calendarView}`;
  calendar.className = `calendar ${calendarClass} calendar-${state.calendarView}`;
  const activities = visibleActivities();

  if (state.calendarView === "month") {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = startOfWeek(first);
    const cells = [];
    for (let i = 0; i < 42; i += 1) {
      const day = addDays(start, i);
      cells.push(renderDayCell(day, day.getMonth() !== cursor.getMonth()));
    }
    calendar.innerHTML = weekdayNames.map((day) => `<div class="weekday">${day}</div>`).join("") + cells.join("");
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
  if (state.calendarView === "quarter" || state.calendarView === "semester") {
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
  const external = activity.externalUrl ?`<a class="detail-link" href="${escapeHtml(activity.externalUrl)}" target="_blank" rel="noreferrer">Abrir atividade original</a>` : "";
  const analysisPanel = analysis.tss ?`
    <div class="analysis-panel">
      <span class="kicker">${escapeHtml(analysis.standard || "11TSS Advance")}</span>
      <h4>${escapeHtml(analysis.characteristic || "Caracteristica do treino")}</h4>
      <p>${escapeHtml(analysis.note || "")}</p>
      <div class="detail-grid analysis-grid">
        <div><span class="metric-label">TSS estimado</span><strong>${escapeHtml(analysis.tss)}</strong></div>
        <div><span class="metric-label">Agressao</span><strong>${escapeHtml(analysis.aggressionScore)}</strong></div>
        <div><span class="metric-label">Variacao de ritmo</span><strong>${escapeHtml(analysis.splitVariability || "--")}</strong></div>
        <div><span class="metric-label">Pace mais forte</span><strong>${escapeHtml(analysis.fastestPace || "--")}</strong></div>
      </div>
      <p class="analysis-caption">Esforco relativo Strava: ${escapeHtml(analysis.relativeEffort || "--")} - IF por FC: ${escapeHtml(analysis.intensityFactor || "--")} - Splits: ${escapeHtml(analysis.splitCount || 0)}</p>
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
      <div class="provider-actions">${testFlagButton}</div>
      ${external}
    </div>
  `;
  dialog.showModal();
}

async function setActivity3000Flag(activityId, enabled) {
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
    renderHeroMetrics();
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
  const selector = document.querySelector("#athleteSelector");
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
    return `
    <article class="athlete-list-row ${String(athlete.id) === String(state.selectedAthleteId) ?"is-selected" : ""}">
      <button class="athlete-row-main" type="button" data-toggle-admin-user="${escapeHtml(athlete.id)}" aria-expanded="${isExpanded ? "true" : "false"}">
        <strong>${escapeHtml(athlete.name)}</strong>
        <span>${escapeHtml(athlete.email)}</span>
        <span>${escapeHtml(athlete.roleLabel || "Atleta")}</span>
        <span>${escapeHtml(athlete.teamName || "Sem equipe")}</span>
        <span>${escapeHtml(athlete.coachName || "Sem treinador")}</span>
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
          <p><strong>Treinador:</strong> ${escapeHtml(athlete.coachName || "Não tenho")}</p>
          <p><strong>Formação:</strong> ${escapeHtml(profile.education || "--")}</p>
          <p><strong>Especialidades:</strong> ${escapeHtml(profile.skills || "--")}</p>
          <p><strong>Experiência:</strong> ${escapeHtml(profile.experience || "--")}</p>
          <p><strong>Certificações:</strong> ${escapeHtml(profile.certifications || "--")}</p>
          <p><strong>Institucional:</strong> ${escapeHtml(profile.institutionalNotes || "--")}</p>
          <p><strong>Local:</strong> ${escapeHtml(profile.location || "--")}</p>
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
    renderHeroMetrics();
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
  renderHistoryTimelineEditor([]);
  render3000ActivityPicker();
  state.editingAthleteId = "";
  const submit = document.querySelector("#athleteSubmitButton");
  const cancel = document.querySelector("#cancelAthleteEdit");
  if (submit) submit.textContent = "Salvar atleta";
  if (cancel) cancel.hidden = true;
  if (message) setAthleteMessage(message);
}

function historyTimelineRowTemplate(entry = {}) {
  return `
    <article class="history-entry-row">
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
        <input data-history-description value="${escapeHtml(entry.description || "")}" placeholder="Detalhes relevantes para análise futura da IA." />
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

function readHistoryTimelineForm(form) {
  const rows = [...form.querySelectorAll(".history-entry-row")];
  return rows.map((row) => ({
    startDate: row.querySelector("[data-history-start]")?.value || "",
    endDate: row.querySelector("[data-history-end]")?.value || "",
    title: row.querySelector("[data-history-title]")?.value || "",
    description: row.querySelector("[data-history-description]")?.value || ""
  }));
}

function readAthleteForm(form) {
  const body = Object.fromEntries(new FormData(form).entries());
  const coachSelect = form.elements.coachEmail;
  const coachOption = coachSelect?.selectedOptions?.[0];
  if (coachOption && coachSelect.value) body.coachName = coachOption.textContent.split(" - ")[0];
  body.historyTimeline = readHistoryTimelineForm(form);
  body.tests3000 = [1, 2, 3].map((index) => ({
    date: body[`test3000Date${index}`],
    time: body[`test3000Time${index}`],
    notes: body[`test3000Notes${index}`]
  }));
  [1, 2, 3].forEach((index) => {
    delete body[`test3000Date${index}`];
    delete body[`test3000Time${index}`];
    delete body[`test3000Notes${index}`];
  });
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
  form.elements.coachName.value = athlete.coachName || "";
  form.elements.coachEmail.value = athlete.coachEmail || "";
  if (form.elements.focusDistanceM) form.elements.focusDistanceM.value = athlete.focusDistanceM || "";
  if (form.elements.targetTime) form.elements.targetTime.value = athlete.targetTime || "";
  if (form.elements.targetDate) form.elements.targetDate.value = athlete.targetDate || "";
  if (form.elements.bestTime) form.elements.bestTime.value = athlete.bestTime || "";
  if (form.elements.role) form.elements.role.value = athlete.role || "athlete";
  if (form.elements.historyNotes) form.elements.historyNotes.value = athlete.historyNotes || "";
  renderHistoryTimelineEditor(athlete.historyTimeline || []);
  render3000ActivityPicker();
  const tests = Array.isArray(athlete.tests3000) ?athlete.tests3000 : [];
  [1, 2, 3].forEach((index) => {
    const test = tests[index - 1] || {};
    if (form.elements[`test3000Date${index}`]) form.elements[`test3000Date${index}`].value = test.date || "";
    if (form.elements[`test3000Time${index}`]) form.elements[`test3000Time${index}`].value = test.time || "";
    if (form.elements[`test3000Notes${index}`]) form.elements[`test3000Notes${index}`].value = test.notes || "";
  });
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
    renderHeroMetrics();
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
    renderHeroMetrics();
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
  document.querySelectorAll("[data-admin-mode]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.adminMode === state.adminMode);
  });
  const title = document.querySelector("#adminFormTitle");
  if (title) {
    title.textContent = state.adminMode === "coach" ?"Adicionar treinador" : state.adminMode === "team" ?"Adicionar equipe" : "Adicionar atleta";
  }
  const userForm = document.querySelector("#adminUserForm");
  const teamForm = document.querySelector("#teamForm");
  if (userForm) {
    userForm.hidden = isTeam;
    if (userForm.elements.role) userForm.elements.role.value = state.adminMode === "coach" ?"coach" : "athlete";
  }
  document.querySelectorAll(".admin-athlete-field").forEach((field) => {
    field.hidden = isCoach || isTeam;
  });
  document.querySelectorAll(".admin-coach-field").forEach((field) => {
    field.hidden = !isCoach;
  });
  if (teamForm) teamForm.hidden = !isTeam;
}

async function saveAdminUser(event) {
  event.preventDefault();
  if (!canManageAthletes()) return;
  const form = event.currentTarget;
  const body = Object.fromEntries(new FormData(form).entries());
  const coachSelect = form.elements.coachEmail;
  const coachOption = coachSelect?.selectedOptions?.[0];
  if (coachOption && coachSelect.value) body.coachName = coachOption.textContent.split(" - ")[0];
  if (state.adminMode === "coach") {
    body.role = "coach";
    body.teamName = "";
    body.coachEmail = "";
    body.profileData = {
      education: body.education || "",
      skills: body.skills || "",
      experience: body.experience || "",
      certifications: body.certifications || ""
    };
  }
  try {
    setAdminMessage("Salvando cadastro...");
    const payload = await api("/api/athletes", {
      method: "POST",
      body: JSON.stringify(body)
    });
    state.athletes = payload.athletes || [];
    await refreshDirectory();
    renderAthletes();
    renderAthleteSelector();
    renderAthleteIdentity();
    renderCalendar();
    form.reset();
    renderAdminMode();
    setAdminMessage(`${payload.athlete.name} cadastrado com sucesso.`);
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
    state.aiProjection = { text: `IA indisponível: ${error.message}` };
  }
  renderFocusRoadmap();
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
      renderHeroMetrics();
      renderTrainingInsights();
      setLog([`Erro ao carregar dados do banco: ${error.message}`], true);
      if (initialHash === "treinamentos") setView("training");
      else if (initialHash === "objetivos") setView("goals");
      else if (initialHash === "configuracoes" || initialHash === "configuracao") setView("settings");
      else if (initialHash === "atleta" || initialHash === "dashboard") setView("athlete");
      else setView("home");
    }
    return;
  }

  if (initialHash === "treinamentos") setView("training");
  else if (initialHash === "objetivos") setView("goals");
  else if (initialHash === "configuracoes" || initialHash === "configuracao") setView("settings");
  else if (initialHash === "atleta" || initialHash === "dashboard") setView("athlete");
  else setView("home");
  renderPermissions();
  renderProviders();
  renderAthletes();
  renderAthleteSelector();
  renderAthleteIdentity();
  renderCalendar();
  renderHeroMetrics();
  renderTrainingInsights();
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

document.querySelector("#athleteSelector").addEventListener("change", async (event) => {
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
    renderHeroMetrics();
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
    renderCalendar();
    return;
  }
  const editButton = event.target.closest("[data-edit-athlete]");
  if (editButton) {
    editAthlete(editButton.dataset.editAthlete);
    return;
  }
  const deleteButton = event.target.closest("[data-delete-athlete]");
  if (deleteButton) {
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
  if (event.target.closest("[data-refresh-ai]")) {
    await refreshAiProjection();
    return;
  }
  if (event.target.closest("#addHistoryEntry")) {
    const list = document.querySelector("#historyTimelineList");
    if (list) list.insertAdjacentHTML("beforeend", historyTimelineRowTemplate({}));
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
    const row = event.target.closest(".history-entry-row");
    const list = document.querySelector("#historyTimelineList");
    if (row) row.remove();
    if (list && !list.querySelector(".history-entry-row")) {
      list.innerHTML = historyTimelineRowTemplate({});
    }
    return;
  }
  const testFlagButton = event.target.closest("[data-flag-3000-activity]");
  if (testFlagButton) {
    const activityId = testFlagButton.getAttribute("data-flag-3000-activity") || testFlagButton.dataset.flag3000Activity;
    const enabled = (testFlagButton.getAttribute("data-flag-enabled") || testFlagButton.dataset.flagEnabled) === "1";
    if (!activityId) {
      setLog(["Não foi possível identificar a atividade para marcar o teste de 3000 m."], true);
      return;
    }
    await setActivity3000Flag(activityId, enabled);
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
