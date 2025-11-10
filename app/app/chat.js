/* ==========================================================
   Helios AI Labs - chat.js FINAL BUILD
   ==========================================================
   ✔ Webhook seguro + retry + timeout
   ✔ Limpieza total de timeouts y opciones duplicadas
   ✔ safeShowMainMenu centralizado
   ✔ Flags suppressMenu / conversationEnded
   ✔ “Dra. del Campo” correcto
   ✔ Botón Nueva conversación fijo (UX mejorada)
   ========================================================== */

/* ---------- CONFIG ---------- */
const WEBHOOK_URL = "https://heliosailabs369.app.n8n.cloud/webhook/chatbot-groq";
const EMAIL_COPY_TO = "heliosailabs@gmail.com";
const FORMS_OF_PAYMENT = "Transferencia bancaria, todas las tarjetas de crédito y débito VISA, Mastercard y American Express, Bitcoin y ETH.";
const READ_PAUSE_MS = 3000;
const FETCH_TIMEOUT_MS = 10000;
const FETCH_RETRY = 1;

/* ---------- DOM bindings ---------- */
const messagesContainer = document.getElementById("messages");
const inputField = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
if (!messagesContainer || !inputField || !sendBtn) {
  console.error("[helios][fatal] Missing DOM elements.");
  throw new Error("Missing required DOM elements");
}

/* ---------- Session ---------- */
function genSessionId() {
  let s = localStorage.getItem("helios_sessionId");
  if (!s) {
    s = `sess_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    localStorage.setItem("helios_sessionId", s);
  }
  return s;
}
const sessionId = genSessionId();
console.log("[helios][info] Session initialized", { sessionId });

/* ---------- Lead & State ---------- */
let lead = {
  fullName: "", givenName: "", surname: "", title: "", gender: "",
  industry: "", subcategory: "", marketingBudget: "", decisionPower: "",
  interestLevel: "", phone: "", email: "", preferredDay: "", preferredTime: "",
  responses: [], lastSentHash: null, lastSentAt: null, sent: false
};
let currentStep = null;
let optionsVisible = false;
let lastOptionsWrapper = null;
let pendingTimeouts = [];
let conversationEnded = false;
let suppressMenu = false;

/* ---------- Helpers ---------- */
function addPendingTimeout(fn, ms) {
  const id = setTimeout(() => {
    pendingTimeouts = pendingTimeouts.filter(t => t !== id);
    try { fn(); } catch (e) { console.error("[helios][error] Timeout fn:", e); }
  }, ms);
  pendingTimeouts.push(id);
  return id;
}
function clearPendingTimeouts() {
  pendingTimeouts.forEach(clearTimeout);
  pendingTimeouts = [];
  console.debug("[helios][debug] Cleared pendingTimeouts");
}
function escapeHtml(str) {
  if (str == null) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
function interpolateLeadData(text) {
  if (!text) return "";
  const t = lead.title || "Cliente";
  const s = lead.surname || lead.givenName || "Cliente";
  return String(text)
    .replace(/\[TÍTULO\]|\[TITULO\]/g, escapeHtml(t))
    .replace(/\[APELLIDO\]/g, escapeHtml(s))
    .replace(/\$\{TÍTULO\}/g, escapeHtml(t))
    .replace(/\$\{APELLIDO\}/g, escapeHtml(s));
}
function addMessage(rawText, sender = "bot") {
  const processed = sender === "bot" ? interpolateLeadData(rawText) : escapeHtml(rawText);
  const el = document.createElement("div");
  el.classList.add("message", sender);
  el.innerHTML = processed.replace(/\n/g, "<br/>");
  messagesContainer.appendChild(el);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  console.debug("[helios][debug] addMessage", { sender, preview: processed.slice(0, 100) });
  return el;
}
function addMessageDelayed(text, sender = "bot", delay = READ_PAUSE_MS) {
  return addPendingTimeout(() => addMessage(text, sender), delay);
}
function clearLastOptions() {
  if (lastOptionsWrapper) lastOptionsWrapper.remove();
  lastOptionsWrapper = null;
  optionsVisible = false;
  unlockInput();
}
function lockInput(placeholder = "Selecciona una opción desde las burbujas...") {
  optionsVisible = true;
  inputField.disabled = true;
  sendBtn.disabled = true;
  inputField.placeholder = placeholder;
  inputField.classList.add("disabled");
}
function unlockInput() {
  optionsVisible = false;
  inputField.disabled = false;
  sendBtn.disabled = false;
  inputField.placeholder = "Escribe aquí...";
  inputField.classList.remove("disabled");
}

/* ---------- Options ---------- */
function addOptions(items) {
  clearLastOptions();
  const wrapper = document.createElement("div");
  wrapper.classList.add("message", "bot");
  const row = document.createElement("div");
  row.classList.add("option-row");

  items.forEach(it => {
    const btn = document.createElement("button");
    btn.classList.add("option-btn");
    btn.type = "button";
    btn.innerText = it.label;
    btn.addEventListener("click", () => {
      addMessage(it.label, "user");
      lead.responses.push({ option: it.value || it.label, label: it.label, ts: new Date().toISOString() });
      Array.from(row.querySelectorAll("button")).forEach(b => b.disabled = true);
      addPendingTimeout(() => {
        clearLastOptions();
        try { if (typeof it.next === "function") it.next(it.value); }
        catch (e) { console.error("[helios][error] option handler:", e); }
      }, 180);
    });
    row.appendChild(btn);
  });

  wrapper.appendChild(row);
  messagesContainer.appendChild(wrapper);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  lastOptionsWrapper = wrapper;
  lockInput();
  console.debug("[helios][debug] addOptions rendered", items.map(i => i.label));
}

/* ---------- Parsing ---------- */
const NAME_CONNECTORS = ["de", "del", "la", "las", "los", "y"];
function parseName(raw) {
  if (!raw) return { full: "", given: "", surname: "" };
  let s = String(raw).trim()
    .replace(/^(hola|holá|buenas|buenos)\s+[^\s]+/i, "")
    .replace(/^(soy|me llamo|mi nombre es)\s*/i, "")
    .replace(/[.,;!¿?]+/g, " ")
    .replace(/\s+/g, " ").trim();

  const titlePattern = /^(Dr\.?|Dra\.?|Lic\.?|Ing\.?|Sr\.?|Sra\.?|Profesor|Profesora|Mtro\.?|Mtra\.?|Arq\.?)/i;
  const titleMatch = s.match(titlePattern);
  if (titleMatch) {
    if (!lead.title) lead.title = titleMatch[0].replace(/\.$/, "");
    s = s.replace(titlePattern, "").trim();
  }

  const parts = s.split(/\s+/);
  let surname = parts.pop() || "";
  if (parts.length && NAME_CONNECTORS.includes(parts[parts.length - 1].toLowerCase())) {
    surname = parts.pop() + " " + surname;
  }
  const given = parts.join(" ");
  const full = (given ? given + " " : "") + surname;
  return { full, given: given || surname, surname: surname || given || full };
}

/* ---------- Menú seguro ---------- */
function safeShowMainMenu(delay = 500) {
  if (conversationEnded) return;
  clearPendingTimeouts();
  clearLastOptions();
  addPendingTimeout(() => showMainMenu(), delay);
}

/* ---------- Menú principal ---------- */
function showMainMenu() {
  if (conversationEnded) return;
  clearPendingTimeouts();
  clearLastOptions();
  addMessage("Gracias por contactarnos, somos Helios AI Labs. Para proporcionarle la mejor atención personalizada ¿Cuál de las siguientes preguntas desea que respondamos para usted?");
  addPendingTimeout(() => {
    addOptions([
      { label: "A) ¿Cómo funciona la automatización de procesos con IA y qué beneficios medibles puede aportar a mi negocio?", value: "A", next: () => handleA() },
      { label: "B) Quiero información sobre su empresa, ubicación, experiencia, referencias, garantía, etc.", value: "B", next: () => handleB() },
      { label: "C) ¿Por qué adoptar Inteligencia Artificial hoy es importante?", value: "C", next: () => handleC() },
      { label: "D) ¿Cuánto cuesta implementar IA y en cuánto tiempo recupero la inversión?", value: "D", next: () => handleD() },
      { label: "E) Todas las anteriores", value: "E", next: () => handleE() }
    ]);
  }, 300);
}

/* ---------- Handlers A..E ---------- */
function handleA(suppressMenu = false) {
  if (conversationEnded) return;
  clearPendingTimeouts();
  clearLastOptions();
  addMessage("Para responder a su pregunta con la atención que usted merece, por favor dígame: ¿En cuál de los siguientes giros se encuentra su negocio?");
  addPendingTimeout(() => askGiro(), READ_PAUSE_MS);
  if (!suppressMenu) safeShowMainMenu(READ_PAUSE_MS * 4);
}
function handleB(suppressMenu = false) {
  if (conversationEnded) return;
  clearPendingTimeouts();
  clearLastOptions();
  addMessage(`Nombre comercial: Helios AI Labs.
Todos nuestros servicios de automatización con Inteligencia Artificial, desarrollo de software y diseño de aplicaciones son facturados inmediatamente.
Formas de pago: ${FORMS_OF_PAYMENT}.`);
  if (!suppressMenu) safeShowMainMenu(READ_PAUSE_MS);
}
function handleC(suppressMenu = false) {
  if (conversationEnded) return;
  clearPendingTimeouts();
  clearLastOptions();
  addMessage("Adoptar Inteligencia Artificial hoy es importante porque acelera procesos, reduce errores y permite tomar decisiones basadas en datos.");
  if (!suppressMenu) safeShowMainMenu(READ_PAUSE_MS);
}
function handleD(suppressMenu = false) {
  if (conversationEnded) return;
  clearPendingTimeouts();
  clearLastOptions();
  addMessage("Los costos de implementación varían según el alcance. Muchas empresas recuperan su inversión en menos de 3 meses.");
  if (!suppressMenu) safeShowMainMenu(READ_PAUSE_MS);
}
function handleE() {
  if (conversationEnded) return;
  console.debug("[helios][debug] handleE sequence");
  clearPendingTimeouts();
  clearLastOptions();
  lockInput("Leyendo, por favor espere...");
  handleA(true);
  addPendingTimeout(() => handleB(true), READ_PAUSE_MS * 2);
  addPendingTimeout(() => handleC(true), READ_PAUSE_MS * 4);
  addPendingTimeout(() => handleD(true), READ_PAUSE_MS * 6);
  addPendingTimeout(() => { unlockInput(); openContactCapture(); }, READ_PAUSE_MS * 8);
}

/* ---------- Flujo inicial ---------- */
function startChat() {
  if (conversationEnded) return;
  clearPendingTimeouts();
  addMessage("¡Hola! Soy Helios, Asesor Comercial Senior de Helios AI Labs. ¿Con quién tengo el gusto?");
  currentStep = "captureName";
  unlockInput();
  console.log("[helios][info] Chatbot initialized and awaiting user input");
}

/* ---------- Contact capture ---------- */
function openContactCapture() {
  addMessage("Perfecto. Para agendar necesito: Teléfono (WhatsApp), Email, Día preferido y Hora aproximada.");
  currentStep = "captureContactLine";
  unlockInput();
}

/* ---------- Envío de datos ---------- */
async function sendLeadPayload(extra = {}, endSession = false) {
  if (conversationEnded) return false;
  const payload = { sessionId, timestamp: new Date().toISOString(), ...lead, ...extra };
  const currentHash = computePayloadHash(payload);
  if (lead.lastSentHash === currentHash) {
    console.info("[helios][info] Duplicate payload skipped.");
    return false;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let attempt = 0, success = false, responseStatus = null, responseText = null;

  while (attempt <= FETCH_RETRY && !success) {
    try {
      console.debug(`[helios][debug] Sending payload attempt ${attempt + 1}/${FETCH_RETRY + 1}`, payload);
      const res = await fetch(WEBHOOK_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload), signal: controller.signal
      });
      responseStatus = res.status; responseText = await res.text();
      if (res.ok) {
        success = true; lead.lastSentHash = currentHash; lead.lastSentAt = Date.now();
        console.info("[helios][info] Payload successfully sent", { status: responseStatus });
      } else console.warn("[helios][warn] Non-OK response", { status: responseStatus });
    } catch (err) {
      console.error(`[helios][error] Fetch error attempt ${attempt + 1}:`, err);
      if (err.name === "AbortError") console.error("[helios][error] Fetch aborted (timeout)", { timeout: FETCH_TIMEOUT_MS });
    }
    attempt++; if (!success && attempt <= FETCH_RETRY) await new Promise(r => setTimeout(r, 1200));
  }
  clearTimeout(timeoutId);

  if (success) {
    addMessage("✅ ¡Listo! Hemos enviado la información correctamente.", "bot");
    if (endSession) {
      conversationEnded = true;
      addMessage("Gracias por contactarnos. En breve recibirá confirmación por email.", "bot");
    } else safeShowMainMenu(1000);
    return true;
  } else {
    addMessage("⚠️ No se pudo enviar la información al servidor. Intente más tarde o contacte soporte.", "bot");
    if (endSession) conversationEnded = true;
    console.error("[helios][error] sendLeadPayload failed", { responseStatus, responseText });
    return false;
  }
}

/* ---------- Hash util ---------- */
function computePayloadHash(obj) {
  try {
    const str = JSON.stringify(obj); let hash = 5381;
    for (let i = 0; i < str.length; i++) hash = ((hash << 5) + hash) + str.charCodeAt(i);
    return "h" + (hash >>> 0).toString(16);
  } catch (e) { console.error("[helios][error] computePayloadHash", e); return null; }
}

/* ---------- Reset / Restart ---------- */
function resetConversation() {
  clearPendingTimeouts();
  lead = { fullName: "", givenName: "", surname: "", title: "", gender: "", industry: "", subcategory: "", marketingBudget: "", decisionPower: "", interestLevel: "", phone: "", email: "", preferredDay: "", preferredTime: "", responses: [], lastSentHash: null, lastSentAt: null, sent: false };
  conversationEnded = false; currentStep = null;
  clearLastOptions(); messagesContainer.innerHTML = "";
  addMessage("🌀 Nueva conversación iniciada. ¡Hola! Soy Helios, Asesor Comercial Senior de Helios AI Labs. ¿Con quién tengo el gusto?");
  currentStep = "captureName"; unlockInput();
}
function injectRestartButton() {
  const btn = document.createElement("button");
  btn.id = "restartBtn";
  btn.innerText = "🔄 Nueva conversación";
  btn.style.position = "fixed";
  btn.style.bottom = "10px";
  btn.style.right = "10px";
  btn.style.padding = "6px 10px";
  btn.style.fontSize = "14px";
  btn.style.zIndex = "9999";
  btn.addEventListener("click", resetConversation);
  document.body.appendChild(btn);
}

/* ---------- DOM Ready ---------- */
document.addEventListener("DOMContentLoaded", () => {
  if (!window.__helios_initialized) {
    window.__helios_initialized = true;
    console.info("[helios][init] DOM ready, initializing chatbot...");
    injectRestartButton();
    startChat();
  }
});
