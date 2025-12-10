
// ===== Config =====
const API_BASE = "https://asistente.ponganos10.online"; // backend
const INVOKE_URL = `${API_BASE}/agent/invoke`;
const GMAIL_URL  = `${API_BASE}/gmail/send`;
const CAL_URL    = `${API_BASE}/calendar/event`;
const AUTH_GOOGLE_URL = `${API_BASE}/auth/google`;

// ===== Estado de UI =====
const els = {
  messages: document.getElementById("messages"),
  input: document.getElementById("input"),
  send: document.getElementById("send"),
  status: document.getElementById("status"),
  btnGoogle: document.getElementById("btn-google"),
  btnReset: document.getElementById("btn-reset"),
  openEmail: document.getElementById("open-email"),
  emailModal: document.getElementById("email-modal"),
  emailForm: document.getElementById("email-form"),
  emailTo: document.getElementById("email-to"),
  emailSubject: document.getElementById("email-subject"),
  emailBody: document.getElementById("email-body"),
  closeEmail: document.getElementById("close-email"),
  openCalendar: document.getElementById("open-calendar"),
  calModal: document.getElementById("calendar-modal"),
  calForm: document.getElementById("calendar-form"),
  calSummary: document.getElementById("cal-summary"),
  calDescription: document.getElementById("cal-description"),
  calStart: document.getElementById("cal-start"),
  calEnd: document.getElementById("cal-end"),
  closeCalendar: document.getElementById("close-calendar"),
};

const sessionId = getOrCreateSessionId();
let sending = false;

// ===== Eventos =====
els.send.addEventListener("click", sendMessage);
els.input.addEventListener("keydown", (e) => { if (e.key === "Enter") sendMessage(); });
els.btnGoogle.addEventListener("click", () => window.location.href = AUTH_GOOGLE_URL);
els.btnReset.addEventListener("click", resetConversation);
els.openEmail.addEventListener("click", () => els.emailModal.showModal());
els.closeEmail.addEventListener("click", () => els.emailModal.close());
els.emailForm.addEventListener("submit", sendEmail);

els.openCalendar.addEventListener("click", () => { prefillCalendarTimes(); els.calModal.showModal(); });
els.closeCalendar.addEventListener("click", () => els.calModal.close());
els.calForm.addEventListener("submit", createEvent);

// ===== Funciones =====
function getOrCreateSessionId() {
  const k = "agent_session_id";
  let id = localStorage.getItem(k);
  if (!id) {
    id = "angel|" + Math.random().toString(36).slice(2, 10);
    localStorage.setItem(k, id);
  }
  return id;
}

function appendMessage(role, text) {
  const li = document.createElement("li");
  li.className = `msg ${role}`;
  li.innerHTML = `<div class="bubble">${escapeHtml(text)}</div><div class="meta">${role === "user" ? "Tú" : "Agente"}</div>`;
  els.messages.appendChild(li);
  els.messages.scrollTop = els.messages.scrollHeight;
}

function setStatus(text) { els.status.textContent = text || ""; }

function resetConversation() {
  localStorage.removeItem("agent_session_id");
  const newId = getOrCreateSessionId();
  setStatus(`Nueva sesión: ${newId}`);
  els.messages.innerHTML = "";
}

async function sendMessage() {
  const text = els.input.value.trim();
  if (!text || sending) return;
  sending = true;
  els.input.value = "";
  appendMessage("user", text);
  setStatus("Pensando…");

  try {
    const res = await fetch(INVOKE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Si no usas cookies, puedes omitir credentials:
      // credentials: "include",
      body: JSON.stringify({ session_id: sessionId, input: text }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
    appendMessage("ai", data.output || "[Sin respuesta]");
  } catch (err) {
    appendMessage("ai", "⚠️ Error al invocar el agente: " + err.message);
  } finally {
    sending = false;
    setStatus("");
  }
}

async function sendEmail(e) {
  e.preventDefault();
  const payload = {
    to: els.emailTo.value.trim(),
    subject: els.emailSubject.value.trim(),
    body: els.emailBody.value.trim(),
  };
  if (!payload.to || !payload.subject || !payload.body) return;

  setStatus("Enviando correo…");
  try {
    const res = await fetch(GMAIL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include", // si el backend usa cookies tras OAuth
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
    appendMessage("ai", `✅ Correo enviado a ${payload.to}`);
    els.emailModal.close();
    els.emailForm.reset();
  } catch (err) {
    appendMessage("ai", "⚠️ Error al enviar correo: " + err.message);
  } finally {
    setStatus("");
  }
}

async function createEvent(e) {
  e.preventDefault();
  const startISO = localDateTimeToISO(els.calStart.value);
  const endISO   = localDateTimeToISO(els.calEnd.value);
  const payload = {
    summary: els.calSummary.value.trim(),
    description: els.calDescription.value.trim(),
    start_datetime: startISO,
    end_datetime: endISO,
    timezone: "America/Mazatlan", // puedes ajustar
  };
  if (!payload.summary || !payload.start_datetime || !payload.end_datetime) return;

  setStatus("Creando evento…");
  try {
    const res = await fetch(CAL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
    appendMessage("ai", `✅ Evento creado: ${payload.summary} (${payload.start_datetime} → ${payload.end_datetime})`);
    els.calModal.close();
    els.calForm.reset();
  } catch (err) {
    appendMessage("ai", "⚠️ Error al crear evento: " + err.message);
  } finally {
    setStatus("");
  }
}

// ===== Utilidades =====
function escapeHtml(s) { return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function prefillCalendarTimes() {
  const now = new Date();
  const in1h = new Date(now.getTime() + 60*60*1000);
  els.calStart.value = toLocalDatetimeValue(now);
  els.calEnd.value   = toLocalDatetimeValue(in1h);
}

function toLocalDatetimeValue(d) {
  const pad = n => String(n).padStart(2,'0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localDateTimeToISO(localValue) {
  // Convierte "yyyy-MM-ddTHH:mm" a ISO y agrega offset local
  const d = new Date(localValue);
  const tz = -d.getTimezoneOffset();
  const sign = tz >= 0 ? "+" : "-";
  const hh = String(Math.floor(Math.abs(tz)/60)).padStart(2,"0");
  const mm = String(Math.abs(tz)%60).padStart(2,"0");
  return `${d.toISOString().slice(0,19)}${sign}${hh}:${mm}`;
}
