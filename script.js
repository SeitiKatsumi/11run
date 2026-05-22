const state = {
  view: "home",
  calendarView: "month",
  cursor: new Date(),
  activities: [],
  integrations: {},
  athletes: [],
  selectedAthleteId: localStorage.getItem("selectedAthleteId") || "",
  currentUser: null,
  editingAthleteId: "",
  syncing: false
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

const calendar = document.querySelector("#calendar");
const dialog = document.querySelector("#activityDialog");
const detail = document.querySelector("#activityDetail");
const shell = document.querySelector("#appShell");
const menuToggle = document.querySelector("#menuToggle");
const railBackdrop = document.querySelector("#railBackdrop");

function isMobileLayout() {
  return window.matchMedia("(max-width: 900px)").matches;
}

function setMenuOpen(open) {
  if (!shell) return;
  shell.classList.toggle("menu-open", open);
  if (menuToggle) menuToggle.setAttribute("aria-expanded", open ? "true" : "false");
}

function setRailCollapsed(collapsed) {
  if (!shell) return;
  shell.classList.toggle("rail-collapsed", collapsed);
  localStorage.setItem("railCollapsed", collapsed ? "1" : "0");
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

async function api(path, options = {}) {
  const scopedPaths = ["/api/integrations", "/api/activities", "/api/sync", "/api/strava/auth", "/api/strava/test", "/api/strava/enrich"];
  const shouldScopeAthlete = scopedPaths.some((prefix) => path.startsWith(prefix));
  const athleteHeaders = shouldScopeAthlete && state.selectedAthleteId ? { "X-Athlete-Id": state.selectedAthleteId } : {};
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
  state.view = view;
  document.querySelectorAll("[data-view]").forEach((section) => section.classList.toggle("is-visible", section.dataset.view === view));
  document.querySelectorAll("[data-view-link]").forEach((link) => link.classList.toggle("is-active", link.dataset.viewLink === view));
  location.hash = view === "training" ? "treinamentos" : view === "settings" ? "configuracao" : view === "athlete" ? "atleta" : "home";
  closeMobileMenu();
}

function normalizeDateKey(value) {
  if (value instanceof Date) return dateKey(value);
  const text = String(value || "").trim();
  const isoDate = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoDate) return isoDate[1];
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? "" : dateKey(parsed);
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
  return Number.isNaN(date.getTime()) ? null : date;
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
    const semesterStartMonth = base.getMonth() < 6 ? 0 : 6;
    const start = new Date(base.getFullYear(), semesterStartMonth, 1);
    const end = new Date(base.getFullYear(), semesterStartMonth + 6, 0);
    return {
      start,
      end,
      days: Math.ceil((Math.round((end - start) / 86400000) + 1) / 7),
      unit: "week",
      label: `Semestre ${semesterStartMonth === 0 ? 1 : 2}/${base.getFullYear()}`
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
  return match ? Number(match[0]) : 0;
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
  return `${value.toFixed(value >= 10 ? 1 : 2)} km`;
}

function renderHeroMetrics() {
  const target = document.querySelector("#heroMetrics");
  if (!target) return;

  const last30 = activitiesSince(30);
  const last7 = activitiesSince(7);
  const km30 = last30.reduce((sum, activity) => sum + parseDistanceKm(activity.distance), 0);
  const km7 = last7.reduce((sum, activity) => sum + parseDistanceKm(activity.distance), 0);
  const averageWeeklyKm = km30 / 4.285;
  const trend = averageWeeklyKm ? Math.round((km7 / averageWeeklyKm) * 100) : 0;
  const status = !last30.length ? "Sem dados" : trend > 135 ? "Atenção" : trend < 55 ? "Baixa carga" : "Estável";
  const statusDetail = !last30.length ? "importe atividades" : `${trend}% da média recente`;

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
  const ratio = weeklyAverage ? km7 / weeklyAverage : 0;
  const risk = ratio > 1.35 ? "Alto" : ratio < 0.55 ? "Baixa carga" : "Controlado";
  const action = risk === "Alto" ? "Reduzir carga" : risk === "Baixa carga" ? "Retomar volume" : "Manter progressão";
  const detail = risk === "Alto"
    ? "A semana atual está acima da média recente."
    : risk === "Baixa carga"
      ? "A semana atual está abaixo da média recente."
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
    const date = range.unit === "week" ? addDays(range.start, index * 7) : addDays(range.start, index);
    const end = range.unit === "week" ? new Date(Math.min(addDays(date, 6).getTime(), range.end.getTime())) : date;
    return {
      date,
      end,
      key: dateKey(date),
      label: range.unit === "week"
        ? `S${String(index + 1).padStart(2, "0")}`
        : state.calendarView === "month"
          ? String(date.getDate()).padStart(2, "0")
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
      ? Math.floor((date - range.start) / 604800000)
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
  return points.map((point, index) => `${index ? "L" : "M"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
}

function renderPerformanceChart() {
  const target = document.querySelector("#performanceChart");
  if (!target) return;

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
    ? `${linePath(volumePoints)} L ${volumePoints[volumePoints.length - 1].x.toFixed(1)} ${padding.top + chartHeight} L ${volumePoints[0].x.toFixed(1)} ${padding.top + chartHeight} Z`
    : "";
  const grid = [0, 0.25, 0.5, 0.75, 1].map((step) => {
    const y = padding.top + chartHeight - (step * chartHeight);
    return `<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" />`;
  }).join("");
  const labels = series
    .map((item, index) => {
      const originalIndex = series.indexOf(item);
      const anchor = index === 0 ? "start" : index === series.length - 1 ? "end" : "middle";
      return `<text x="${xFor(originalIndex)}" y="${height - 12}" text-anchor="${anchor}">${escapeHtml(item.label)}</text>`;
    }).join("");
  const points = series.filter((item) => item.count).map((item, index) => {
    const originalIndex = series.indexOf(item);
    return `<circle cx="${xFor(originalIndex)}" cy="${yTss(item.tss)}" r="1.5"><title>${escapeHtml(item.label)} - ${item.volume.toFixed(1)} km - 11TSS ${Math.round(item.tss)}</title></circle>`;
  }).join("");
  const todayKey = dateKey(new Date());
  const today = new Date();
  const todayIndex = unit === "week"
    ? series.findIndex((item) => today >= item.date && today <= item.end)
    : series.findIndex((item) => item.key === todayKey);
  const todayMarker = todayIndex >= 0
    ? `<g class="today-marker">
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
      ${hasData ? `<path class="volume-area" d="${volumeArea}" />` : ""}
      ${hasData ? `<path class="volume-line" d="${linePath(volumePoints)}" />` : ""}
      ${hasData ? `<path class="tss-line" d="${linePath(tssPoints)}" />` : ""}
      ${todayMarker}
      <g class="tss-points">${points}</g>
      <text x="${padding.left}" y="16">km</text>
      <text x="${width - padding.right}" y="16" text-anchor="end">11TSS</text>
      <g class="chart-labels">${labels}</g>
    </svg>
    ${hasData ? "" : `<p class="chart-empty">Importe atividades do Strava para visualizar a evolucao de volume e 11TSS.</p>`}
  `;
}

function renderActivity(activity) {
  const analysis = activity.analysis || {};
  const analysisLine = analysis.tss
    ? `<em>${escapeHtml(analysis.standard || "11TSS Advance")} ${escapeHtml(analysis.tss)} - agressao ${escapeHtml(analysis.aggressionScore || "--")} - ${escapeHtml(analysis.characteristic || "")}</em>`
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
    <div class="day ${muted ? "is-muted" : ""} ${sameDay(date, today) ? "is-today" : ""}">
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
    ? activities.slice(0, 8).map(renderActivity).join("")
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

function renderPeriodCalendar() {
  const range = periodRange();
  const months = [];
  for (let date = new Date(range.start); date <= range.end; date.setMonth(date.getMonth() + 1)) {
    months.push(new Date(date.getFullYear(), date.getMonth(), 1));
  }
  calendar.innerHTML = months.map(renderPeriodMonth).join("");
  document.querySelector("#calendarEyebrow").textContent = range.label;
  document.querySelector("#calendarTitle").textContent = hasActivitiesInCurrentRange()
    ? "Resumo de performance"
    : "Sem atividades neste periodo";
}

function renderCalendar() {
  const cursor = state.cursor;
  const calendarClass = state.calendarView === "quarter" || state.calendarView === "semester" ? "calendar-period" : `calendar-${state.calendarView}`;
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
      ? `${activities.length} atividades importadas fora deste mês`
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
      ? `${activities.length} atividades importadas fora desta semana`
      : "Microciclo semanal";
  }

  if (state.calendarView === "day") {
    calendar.innerHTML = renderDayCell(cursor);
    document.querySelector("#calendarEyebrow").textContent = `${cursor.getDate()} ${monthNames[cursor.getMonth()]} ${cursor.getFullYear()}`;
    document.querySelector("#calendarTitle").textContent = activities.length && !hasActivitiesInCurrentRange()
      ? `${activities.length} atividades importadas em outras datas`
      : "Detalhe do dia";
  }
  if (state.calendarView === "quarter" || state.calendarView === "semester") {
    renderPeriodCalendar();
  }
  renderPerformanceChart();
}

function openActivity(activityId) {
  const activity = visibleActivities().find((item) => String(item.id) === String(activityId));
  if (!activity) return;
  const analysis = activity.analysis || {};
  const external = activity.externalUrl ? `<a class="detail-link" href="${escapeHtml(activity.externalUrl)}" target="_blank" rel="noreferrer">Abrir atividade original</a>` : "";
  const analysisPanel = analysis.tss ? `
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
      ${external}
    </div>
  `;
  dialog.showModal();
}

function renderProviders() {
  const list = document.querySelector("#providerList");
  if (!list) return;
  list.innerHTML = Object.entries(providerDefinitions).map(([key, definition]) => {
    const integration = state.integrations[key] || {};
    const credentials = integration.credentials || {};
    const hasStoredToken = integration.token?.access_token === "stored" || integration.token?.refresh_token === "stored";
    const isConnected = Boolean(integration.connected || hasStoredToken);
    const connected = isConnected ? "Conectado" : "Não conectado";
    const scope = String(integration.token?.scope || "");
    const stravaScopeWarning = key === "strava" && isConnected && !scope.split(/[,\s]+/).some((item) => item === "activity:read" || item === "activity:read_all")
      ? `<p class="provider-warning">Reconecte aprovando activity:read ou activity:read_all para importar atividades.</p>`
      : "";
    const fields = definition.fields.map(([field, label, type = "text"]) => `
      <label class="credential-field">
        <span>${escapeHtml(label)}</span>
        <input type="${type}" name="${escapeHtml(field)}" value="${escapeHtml(credentials[field] || "")}" />
      </label>
    `).join("");
    const stravaActions = key === "strava" ? `
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
    const athlete = integration.athlete ? `<p class="provider-athlete">Atleta autorizado: ${escapeHtml(integration.athlete.firstname || "")} ${escapeHtml(integration.athlete.lastname || "")}</p>` : "";
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
              <input type="checkbox" name="enabled" ${integration.enabled ? "checked" : ""} />
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
  return items.length ? items.join(" - ") : athlete.email || "Perfil de atleta cadastrado.";
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
}

function syncSelectedAthlete() {
  if (state.athletes.length && !state.athletes.some((athlete) => String(athlete.id) === String(state.selectedAthleteId))) {
    state.selectedAthleteId = state.athletes[0].id;
  }
  if (!state.athletes.length) state.selectedAthleteId = "";
  if (state.selectedAthleteId) localStorage.setItem("selectedAthleteId", state.selectedAthleteId);
  else localStorage.removeItem("selectedAthleteId");
}

function renderAthleteSelector() {
  const selector = document.querySelector("#athleteSelector");
  if (!selector) return;
  selector.innerHTML = state.athletes.length
    ? state.athletes.map((athlete) => `<option value="${escapeHtml(athlete.id)}">${escapeHtml(athlete.name)}</option>`).join("")
    : `<option value="">Nenhum atleta</option>`;
  selector.value = state.selectedAthleteId || "";
  selector.disabled = !state.athletes.length;
}

function renderAthletes() {
  const list = document.querySelector("#athleteList");
  if (!list) return;
  if (!state.athletes.length) {
    list.innerHTML = `<p class="empty-state">Nenhum atleta cadastrado ainda.</p>`;
    return;
  }
  list.innerHTML = state.athletes.map((athlete) => `
    <article class="athlete-list-item ${String(athlete.id) === String(state.selectedAthleteId) ? "is-selected" : ""}">
      <div>
        <strong>${escapeHtml(athlete.name)}</strong>
        <span>${escapeHtml(athlete.email)}</span>
      </div>
      <p>${escapeHtml(athlete.age || "--")} anos - ${escapeHtml(athlete.weightKg || "--")} kg - ${escapeHtml(athlete.heightCm || "--")} cm</p>
      <p>Equipe: ${escapeHtml(athlete.teamName || "não vinculada")}</p>
      <p>Treinador: ${escapeHtml(athlete.coachName || "não vinculado")}</p>
      <p>${escapeHtml(athlete.whatsapp || "WhatsApp não informado")}</p>
      <div class="athlete-item-actions">
        <button class="secondary-action compact" type="button" data-edit-athlete="${escapeHtml(athlete.id)}">Editar</button>
        <button class="danger-action" type="button" data-delete-athlete="${escapeHtml(athlete.id)}">Excluir</button>
      </div>
    </article>
  `).join("");
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
    setSyncLoading(true, "Puxando descrições do Strava", `Lote ${batch}: buscando descrições completas sem travar o servidor.`, updated ? `${updated} descrições atualizadas` : "Detalhando atividades");
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
  return { updated, remaining: Number.isFinite(remaining) ? remaining : 0 };
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
  state.editingAthleteId = "";
  const submit = document.querySelector("#athleteSubmitButton");
  const cancel = document.querySelector("#cancelAthleteEdit");
  if (submit) submit.textContent = "Salvar atleta";
  if (cancel) cancel.hidden = true;
  if (message) setAthleteMessage(message);
}

function editAthlete(athleteId) {
  const athlete = state.athletes.find((item) => String(item.id) === String(athleteId));
  const form = document.querySelector("#athleteForm");
  if (!athlete || !form) return;
  state.editingAthleteId = athlete.id;
  form.elements.name.value = athlete.name || "";
  form.elements.email.value = athlete.email || "";
  form.elements.age.value = athlete.age || "";
  form.elements.weightKg.value = athlete.weightKg || "";
  form.elements.heightCm.value = athlete.heightCm || "";
  form.elements.whatsapp.value = athlete.whatsapp || "";
  form.elements.teamName.value = athlete.teamName || "";
  form.elements.coachName.value = athlete.coachName || "";
  form.elements.coachEmail.value = athlete.coachEmail || "";
  form.elements.password.value = "";
  const submit = document.querySelector("#athleteSubmitButton");
  const cancel = document.querySelector("#cancelAthleteEdit");
  if (submit) submit.textContent = "Atualizar atleta";
  if (cancel) cancel.hidden = false;
  setAthleteMessage(`Editando ${athlete.name}.`);
}

async function deleteAthlete(athleteId) {
  const athlete = state.athletes.find((item) => String(item.id) === String(athleteId));
  if (!athlete) return;
  if (!window.confirm(`Excluir o atleta ${athlete.name}? Esta ação remove integrações e atividades importadas deste atleta.`)) return;
  try {
    setAthleteMessage("Excluindo atleta...");
    const payload = await api(`/api/athletes/${encodeURIComponent(athlete.id)}`, { method: "DELETE" });
    state.athletes = payload.athletes || [];
    if (String(state.selectedAthleteId) === String(athlete.id)) state.selectedAthleteId = state.athletes[0]?.id || "";
    syncSelectedAthlete();
    state.integrations = state.selectedAthleteId ? await api("/api/integrations") : {};
    state.activities = state.selectedAthleteId ? await api("/api/activities") : [];
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
        ? `Importadas/atualizadas: ${payload.imported} atividades reais.`
        : `Nenhuma atividade nova retornada pelas fontes no intervalo de ${days} dias.`,
      state.activities.length ? `Total no banco para este atleta: ${state.activities.length}.` : "Nenhuma atividade salva para este atleta.",
      detailResult.updated ? `Descrições completas atualizadas: ${detailResult.updated}.` : "Descrições já estavam atualizadas ou não retornaram detalhe adicional.",
      detailResult.remaining ? `Descrições pendentes: ${detailResult.remaining}. Clique novamente para continuar.` : "Descrições sincronizadas em lotes.",
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
  const body = Object.fromEntries(new FormData(form).entries());
  const editingId = state.editingAthleteId;
  setAthleteMessage(editingId ? "Atualizando atleta..." : "Salvando atleta...");
  try {
    const payload = await api(editingId ? `/api/athletes/${encodeURIComponent(editingId)}` : "/api/athletes", {
      method: editingId ? "PUT" : "POST",
      body: JSON.stringify(body)
    });
    state.athletes = payload.athletes || [];
    state.selectedAthleteId = payload.athlete.id;
    syncSelectedAthlete();
    renderAthletes();
    renderAthleteSelector();
    renderAthleteIdentity();
    resetAthleteForm(`Atleta ${payload.athlete.name} ${editingId ? "atualizado" : "cadastrado"} com sucesso.`);
    setLog([`Atleta ${payload.athlete.name} salvo com sucesso.`]);
  } catch (error) {
    setAthleteMessage(error.message, true);
    setLog([error.message], true);
  }
}

async function loadAppVersion() {
  const versionTarget = document.querySelector("#appVersion");
  if (!versionTarget) return;
  try {
    const health = await api("/api/health");
    const rawVersion = String(health.version || APP_VERSION_FALLBACK).trim();
    const version = rawVersion.length > 12 ? rawVersion.slice(0, 12) : rawVersion;
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
    state.integrations = await api("/api/integrations");
    state.activities = await api("/api/activities");
  } catch (error) {
    if (error.message === "Login obrigatório.") showLogin();
    else {
      showApp();
      renderProviders();
      renderAthletes();
      renderAthleteSelector();
      renderAthleteIdentity();
      renderCalendar();
      renderHeroMetrics();
      renderTrainingInsights();
      setLog([`Erro ao carregar dados do banco: ${error.message}`], true);
      if (initialHash === "treinamentos") setView("training");
      else if (initialHash === "atleta") setView("athlete");
      else if (initialHash === "configuracao") setView("settings");
      else setView("home");
    }
    return;
  }

  if (initialHash === "treinamentos") setView("training");
  else if (initialHash === "atleta") setView("athlete");
  else if (initialHash === "configuracao") setView("settings");
  else setView("home");
  renderProviders();
  renderAthletes();
  renderAthleteSelector();
  renderAthleteIdentity();
  renderCalendar();
  renderHeroMetrics();
  renderTrainingInsights();

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
    document.querySelectorAll("[data-calendar-view]").forEach((item) => item.classList.toggle("is-active", item === button));
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
    const [integrations, activities] = await Promise.all([
      api("/api/integrations"),
      api("/api/activities")
    ]);
    state.integrations = integrations;
    state.activities = activities;
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
  const saveButton = event.target.closest("[data-save-provider]");
  if (saveButton) {
    await saveProvider(saveButton.dataset.saveProvider);
    return;
  }
  if (event.target.closest("[data-connect-strava]")) {
    const saved = await saveProvider("strava");
    if (!saved) return;
    const athleteParam = state.selectedAthleteId ? `?athlete=${encodeURIComponent(state.selectedAthleteId)}` : "";
    window.location.href = `/api/strava/auth${athleteParam}`;
    return;
  }
  if (event.target.closest("[data-test-strava]")) {
    await testStrava();
  }
});

document.querySelector("#syncSelected").addEventListener("click", runSync);
document.querySelector("[data-import-demo]").addEventListener("click", runSync);
document.querySelector("#athleteForm").addEventListener("submit", saveAthlete);
document.querySelector("#cancelAthleteEdit").addEventListener("click", () => resetAthleteForm("Edição cancelada."));

loadAppVersion();
boot();
