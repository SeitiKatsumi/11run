const state = {
  view: "home",
  calendarView: "month",
  cursor: new Date(),
  activities: [],
  integrations: {},
  athletes: [],
  selectedAthleteId: localStorage.getItem("selectedAthleteId") || "",
  currentUser: null
};

const providerDefinitions = {
  strava: {
    name: "Strava",
    mark: "S",
    status: "OAuth oficial funcionando",
    strategy: "Use Client ID, Client Secret e Redirect URI. Depois clique em Conectar Strava para autorizar os escopos read e activity:read_all.",
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

async function api(path, options = {}) {
  const athleteHeaders = state.selectedAthleteId ? { "X-Athlete-Id": state.selectedAthleteId } : {};
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
  return date.toISOString().slice(0, 10);
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
}

function visibleActivities() {
  return [...state.activities].sort((a, b) => String(a.date).localeCompare(String(b.date)));
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
    const date = new Date(`${activity.date}T00:00:00`);
    return date >= start;
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

function renderActivity(activity) {
  return `
    <button class="activity" data-activity-id="${escapeHtml(activity.id)}" data-source="${escapeHtml(activity.source)}">
      <strong>${escapeHtml(activity.title)}</strong>
      <span>${escapeHtml(activity.source)} - ${escapeHtml(activity.distance)} - ${escapeHtml(activity.description)}</span>
    </button>
  `;
}

function renderDayCell(date, muted = false) {
  const today = new Date();
  const dayActivities = visibleActivities().filter((activity) => activity.date === dateKey(date));
  return `
    <div class="day ${muted ? "is-muted" : ""} ${sameDay(date, today) ? "is-today" : ""}">
      <div class="day-number">${date.getDate().toString().padStart(2, "0")}</div>
      ${dayActivities.map(renderActivity).join("")}
    </div>
  `;
}

function renderCalendar() {
  const cursor = state.cursor;
  calendar.className = `calendar calendar-${state.calendarView}`;

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
    document.querySelector("#calendarTitle").textContent = "Bloco de performance";
  }

  if (state.calendarView === "week") {
    const start = startOfWeek(cursor);
    const cells = [];
    for (let i = 0; i < 7; i += 1) cells.push(renderDayCell(addDays(start, i)));
    const end = addDays(start, 6);
    calendar.innerHTML = weekdayNames.map((day) => `<div class="weekday">${day}</div>`).join("") + cells.join("");
    document.querySelector("#calendarEyebrow").textContent = `${start.getDate()}-${end.getDate()} ${monthNames[end.getMonth()]} ${end.getFullYear()}`;
    document.querySelector("#calendarTitle").textContent = "Microciclo semanal";
  }

  if (state.calendarView === "day") {
    calendar.innerHTML = renderDayCell(cursor);
    document.querySelector("#calendarEyebrow").textContent = `${cursor.getDate()} ${monthNames[cursor.getMonth()]} ${cursor.getFullYear()}`;
    document.querySelector("#calendarTitle").textContent = "Detalhe do dia";
  }
}

function openActivity(activityId) {
  const activity = visibleActivities().find((item) => String(item.id) === String(activityId));
  if (!activity) return;
  const external = activity.externalUrl ? `<a class="detail-link" href="${escapeHtml(activity.externalUrl)}" target="_blank" rel="noreferrer">Abrir atividade original</a>` : "";
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
      ${external}
    </div>
  `;
  dialog.showModal();
}

function renderProviders() {
  const list = document.querySelector("#providerList");
  list.innerHTML = Object.entries(providerDefinitions).map(([key, definition]) => {
    const integration = state.integrations[key] || {};
    const credentials = integration.credentials || {};
    const connected = integration.connected ? "Conectado" : "Não conectado";
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
          <p class="provider-state">${connected} - <a href="${definition.docs}" target="_blank" rel="noreferrer">docs oficiais</a></p>
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
    <article class="athlete-list-item">
      <div>
        <strong>${escapeHtml(athlete.name)}</strong>
        <span>${escapeHtml(athlete.email)}</span>
      </div>
      <p>${escapeHtml(athlete.age || "--")} anos - ${escapeHtml(athlete.weightKg || "--")} kg - ${escapeHtml(athlete.heightCm || "--")} cm</p>
      <p>Equipe: ${escapeHtml(athlete.teamName || "não vinculada")}</p>
      <p>Treinador: ${escapeHtml(athlete.coachName || "não vinculado")}</p>
      <p>${escapeHtml(athlete.whatsapp || "WhatsApp não informado")}</p>
    </article>
  `).join("");
}

function setLog(items, isError = false) {
  const log = document.querySelector("#syncLog");
  log.classList.toggle("is-error", isError);
  log.innerHTML = items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

async function saveProvider(provider) {
  if (!state.selectedAthleteId) {
    setLog(["Cadastre e selecione um atleta antes de salvar integrações."], true);
    return false;
  }
  const form = document.querySelector(`[data-provider="${provider}"]`);
  const credentials = {};
  form.querySelectorAll("input[name]:not([name='enabled'])").forEach((input) => {
    credentials[input.name] = input.value.trim();
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
  if (!state.selectedAthleteId) {
    setLog(["Cadastre e selecione um atleta antes de importar atividades."], true);
    return;
  }
  const days = document.querySelector("#importWindow").value;
  const providers = [...document.querySelectorAll(".provider-form input[name='enabled']:checked")]
    .map((input) => input.closest(".provider-form").dataset.provider);
  try {
    setLog([`Sincronizando últimos ${days} dias...`]);
    const payload = await api("/api/sync", {
      method: "POST",
      body: JSON.stringify({ days, providers })
    });
    state.activities = payload.activities || [];
    renderCalendar();
    renderHeroMetrics();
    setLog([
      `Importadas/atualizadas: ${payload.imported} atividades reais.`,
      ...(payload.warnings || []),
      "Calendário atualizado."
    ]);
  } catch (error) {
    setLog([error.message], true);
  }
}

async function saveAthlete(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const body = Object.fromEntries(new FormData(form).entries());
  try {
    const payload = await api("/api/athletes", {
      method: "POST",
      body: JSON.stringify(body)
    });
    state.athletes = payload.athletes || [];
    state.selectedAthleteId = payload.athlete.id;
    syncSelectedAthlete();
    renderAthletes();
    renderAthleteSelector();
    renderAthleteIdentity();
    form.reset();
    setLog([`Atleta ${payload.athlete.name} salvo com sucesso.`]);
  } catch (error) {
    setLog([error.message], true);
  }
}

async function boot() {
  try {
    const session = await api("/api/me");
    state.currentUser = session.user;
    if (!state.currentUser) {
      showLogin();
      return;
    }
    showApp();
    state.athletes = await api("/api/athletes");
    syncSelectedAthlete();
    const [integrations, activities] = await Promise.all([
      api("/api/integrations"),
      api("/api/activities")
    ]);
    state.integrations = integrations;
    state.activities = activities;
  } catch (error) {
    showLogin(error.message === "Login obrigatório." ? "" : error.message);
    return;
  }

  const initialHash = location.hash.replace("#", "").split("?")[0];
  if (initialHash === "treinamentos") setView("training");
  if (initialHash === "atleta") setView("athlete");
  if (initialHash === "configuracao") setView("settings");
  renderProviders();
  renderAthletes();
  renderAthleteSelector();
  renderAthleteIdentity();
  renderCalendar();
  renderHeroMetrics();

  const status = new URLSearchParams(location.hash.split("?")[1] || "");
  if (status.get("strava") === "connected") setLog(["Strava conectado. Clique em Importar e atualizar para puxar as atividades reais."]);
  if (status.get("strava") === "error") setLog([`Erro Strava: ${status.get("message") || "falha na autorização."}`], true);
}

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
  }
});

document.querySelector("#syncSelected").addEventListener("click", runSync);
document.querySelector("[data-import-demo]").addEventListener("click", runSync);
document.querySelector("#athleteForm").addEventListener("submit", saveAthlete);

boot();
