// app/chat.js - Helios AI Labs (final, with fixes & verbose logs)
// - Keep all pitch texts EXACTLY as provided by user.
// - Verbose logs (English technical).
// - Pauses of ~3000ms between long text blocks.
// - Fixes: pendingTimeouts, name parsing, interpolation, contact parsing, lead.sent handling, placeholder flicker, sanitize HTML.

window.addEventListener("DOMContentLoaded", () => {
  /* ---------- Config ---------- */
  const WEBHOOK_URL = "https://heliosailabs369.app.n8n.cloud/webhook/chatbot-groq";
  const EMAIL_COPY_TO = "heliosailabs@gmail.com";
  const FORMS_OF_PAYMENT = "Transferencia bancaria, todas las tarjetas de crédito y debito VISA, Mastercard y American Express, Bitcoin y ETH.";
  const READ_PAUSE_MS = 3000; // 3 seconds pause for longer blocks

  /* ---------- DOM ---------- */
  const messagesContainer = document.getElementById("messages");
  const inputField = document.getElementById("userInput");
  const sendBtn = document.getElementById("sendBtn");

  if (!messagesContainer || !inputField || !sendBtn) {
    console.error("Fatal: Required DOM elements missing (#messages, #userInput, #sendBtn). Aborting.");
    return;
  }

  /* ---------- Logging helpers (verbose, English technical) ---------- */
  function logDebug(msg, obj) { console.debug("[helios][debug]", msg, obj || ""); }
  function logInfo(msg, obj) { console.info("[helios][info]", msg, obj || ""); }
  function logError(msg, obj) { console.error("[helios][error]", msg, obj || ""); }

  /* ---------- Session & lead ---------- */
  function genSessionId(){
    let s = localStorage.getItem("helios_sessionId");
    if(!s){
      s = `sess_${Date.now()}_${Math.floor(Math.random()*10000)}`;
      localStorage.setItem("helios_sessionId", s);
    }
    return s;
  }
  const sessionId = genSessionId();
  logInfo("Session initialized", { sessionId });

  const lead = {
    fullName: "",
    givenName: "",
    surname: "",
    nameRaw: "",
    title: "",
    gender: "",
    industry: "",
    subcategory: "",
    marketingBudget: "",
    decisionPower: "",
    interestLevel: "",
    phone: "",
    email: "",
    preferredDay: "",
    preferredTime: "",
    responses: [],
    sent: false // mark when payload successfully sent
  };

  /* ---------- State & pending timeouts ---------- */
  let currentStep = null;
  let optionsVisible = false;
  let lastOptionsWrapper = null;
  const pendingTimeouts = [];

  function clearPendingTimeouts() {
    logDebug("Clearing pending timeouts", pendingTimeouts.length);
    while(pendingTimeouts.length) {
      const t = pendingTimeouts.pop();
      try { clearTimeout(t); } catch(e){/*ignore*/ }
    }
  }

  /* ---------- UI helpers ---------- */
  function sanitizeForHTML(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function interpolateLeadData(text) {
    if (!text) return "";
    let out = String(text);
    const title = lead.title || "Cliente";
    const surname = lead.surname || lead.givenName || "Cliente";
    out = out.replaceAll("[TÍTULO]", title).replaceAll("[APELLIDO]", surname);
    return out;
  }

  function addMessage(text, sender = "bot", opts = {}) {
    const delay = opts.delay || 0;
    const id = setTimeout(() => {
      const interpolated = interpolateLeadData(text);
      const safe = sanitizeForHTML(interpolated);
      const el = document.createElement("div");
      el.classList.add("message", sender);
      el.innerHTML = safe.replace(/\n/g, "<br/>");
      messagesContainer.appendChild(el);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
      logDebug("Rendered message", { sender, preview: safe.slice(0,200) });
    }, delay);
    pendingTimeouts.push(id);
    return id;
  }

  function clearLastOptions() {
    if (lastOptionsWrapper) {
      try { lastOptionsWrapper.remove(); } catch(e) { console.warn("Failed to remove options wrapper", e); }
      lastOptionsWrapper = null;
    }
    optionsVisible = false;
    inputField.disabled = false;
    sendBtn.disabled = false;
    inputField.placeholder = inputField.dataset.lastPlaceholder || "Escribe aquí...";
    logDebug("Cleared last options");
  }

  function lockInput(placeholder = "Selecciona una opción desde las burbujas...") {
    optionsVisible = true;
    inputField.disabled = true;
    sendBtn.disabled = true;
    if (placeholder) {
      inputField.dataset.lastPlaceholder = inputField.placeholder || "";
      inputField.placeholder = placeholder;
    }
    logDebug("Input locked", { placeholder });
  }

  function unlockInput(preferred = "Escribe aquí...") {
    optionsVisible = false;
    inputField.disabled = false;
    sendBtn.disabled = false;
    inputField.placeholder = preferred || (inputField.dataset.lastPlaceholder || "Escribe aquí...");
    logDebug("Input unlocked", { placeholder: inputField.placeholder });
  }

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
        setTimeout(() => {
          clearLastOptions();
          try {
            if (typeof it.next === "function") it.next(it.value);
          } catch(err) {
            logError("Option handler threw", { err });
          }
        }, 180);
      });
      row.appendChild(btn);
    });

    wrapper.appendChild(row);
    messagesContainer.appendChild(wrapper);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    lastOptionsWrapper = wrapper;
    lockInput();
    logDebug("Options rendered", { count: items.length, preview: items.map(i => i.label).slice(0,5) });
  }

  /* ---------- Name parsing helpers ---------- */
  function parseNameInput(raw) {
    logDebug("Parsing name input", { raw });
    if (!raw) return { fullName: "", givenName: "", surname: "", nameRaw: "" };

    let s = String(raw).trim();
    s = s.replace(/^hola[,:\s]*/i, "");
    s = s.replace(/^(buenas noches|buenas tardes|buenos días)[,:\s]*/i, "");
    s = s.replace(/^(soy|me llamo|mi nombre es|soy el|soy la|me llamo el|me llamo la)\s+/i, "");
    s = s.replace(/^[,:\s]+|[,:\s]+$/g, "");

    const titleTokens = ["dr","dra","lic","ing","prof","profa","profesor","profesora","sr","sra","srita","c.p","cp","mtra","mtro","coach","chef","arq","doña","don"];
    s = s.split(/\s+/).filter(part => {
      const normalized = part.toLowerCase().replace(/\./g,"").replace(/[,]/g,"");
      return !titleTokens.includes(normalized);
    }).join(" ");

    const parts = s.split(/\s+/).filter(Boolean);
    const surname = parts.length > 1 ? parts[parts.length - 1] : parts[0] || "";
    const given = parts.length > 1 ? parts.slice(0, -1).join(" ") : parts[0] || "";

    const result = { fullName: s, givenName: given, surname, nameRaw: raw };
    logDebug("Name parsed", result);
    return result;
  }

  /* ---------- Contact parsing ---------- */
  function parseContactLine(raw) {
    logDebug("parseContactLine input", raw);
    const txt = String(raw || "").trim();
    const emailMatch = txt.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    const email = emailMatch ? emailMatch[0] : null;
    let remaining = txt;
    if (email) remaining = remaining.replace(email, " ");
    const phoneMatch = remaining.match(/(\+?\d[\d\s\-\(\)]{6,})/);
    let phone = null;
    if (phoneMatch) {
      phone = phoneMatch[0].replace(/[^\d+]/g, "");
      const digitsOnly = phone.replace(/\D/g, "");
      if (digitsOnly.length < 7) phone = null;
    }
    let leftover = remaining.replace(phoneMatch ? phoneMatch[0] : "", " ").trim();
    leftover = leftover.replace(/[,\s]+/g, " ").trim();
    let preferredDay = null, preferredTime = null;
    if (leftover) {
      const timeMatch = leftover.match(/(\d{1,2}[:h]\d{0,2}\s*(am|pm)?|\d{1,2}\s*(am|pm)|mañana|tarde|noche)/i);
      if (timeMatch) {
        preferredTime = timeMatch[0].trim();
        preferredDay = leftover.replace(timeMatch[0], "").trim() || null;
      } else {
        preferredDay = leftover.trim();
      }
    }
    const parsed = { email, phone, preferredDay, preferredTime };
    logDebug("parseContactLine result", parsed);
    return parsed;
  }

  /* ---------- send payload (webhook) ---------- */
  async function sendLeadPayload(extra = {}) {
    if (lead.sent) {
      logInfo("Payload suppressed: lead.sent already true (prevent duplicate).");
      addMessage("📨 Información enviada correctamente a Helios AI Labs.", "bot");
      return true;
    }

    const payload = {
      sessionId,
      timestamp: new Date().toISOString(),
      lead,
      extra: {
        emailCopyTo: EMAIL_COPY_TO,
        formsOfPayment: FORMS_OF_PAYMENT,
        ...extra
      }
    };

    logInfo("Attempting webhook POST", { webhook: WEBHOOK_URL, payloadPreview: { lead: { givenName: lead.givenName, surname: lead.surname, email: lead.email, phone: lead.phone } } });
    addMessage("Enviando información y preparando confirmación...", "bot");

    try {
      const res = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        logError("Webhook returned non-OK status", { status: res.status });
        throw new Error(`HTTP ${res.status}`);
      }
      lead.sent = true;
      logInfo("Webhook POST succeeded", { status: res.status });
      addMessage("✅ ¡Listo! Hemos enviado la información. En breve recibirá confirmación por email.", "bot");
      addMessage("📨 Información enviada correctamente a Helios AI Labs.", "bot");
      return true;
    } catch (err) {
      console.error("[ERROR] sendLeadPayload:", err);
      addMessage("⚠️ Error sending data. Please check connection or contact support.", "bot");
      return false;
    }
  }

  /* ---------- Init ---------- */
  inputField.disabled = false;
  sendBtn.disabled = false;
  inputField.placeholder = inputField.dataset.lastPlaceholder || "Escribe aquí...";
  logInfo("Chatbot initialized and awaiting user input");
  addMessage("¡Hola! Soy Helios, Asesor Comercial Senior de Helios AI Labs. ¿Con quién tengo el gusto?");
  currentStep = "captureName";
  unlockInput();
});
