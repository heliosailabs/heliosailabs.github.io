/* chat.js - Helios AI Labs - Final (Dark mode, ask name first) */

const WEBHOOK_URL = "https://heliosailabs369.app.n8n.cloud/webhook/chatbot-groq";

const messagesContainer = document.getElementById("messages");
const inputField = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");

// session
function genSessionId() {
  let s = localStorage.getItem("helios_sessionId");
  if (!s) {
    s = `sess_${Date.now()}_${Math.floor(Math.random()*10000)}`;
    localStorage.setItem("helios_sessionId", s);
  }
  return s;
}
const sessionId = genSessionId();

// lead data holder
let leadData = {
  name: null,
  phone: null,
  email: null,
  industry: null,
  subcategory: null,
  focus: null,
  decisionPower: null,
  interestLevel: null,
  responses: []
};

let currentStep = null;
let selectedIndustry = null;

// UI helpers
function addMessage(text, sender = "bot") {
  const el = document.createElement("div");
  el.classList.add("message", sender);
  // allow basic newline support
  el.innerHTML = text.replace(/\n/g, "<br/>");
  messagesContainer.appendChild(el);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  return el;
}

function addOptions(options) {
  const wrapper = document.createElement("div");
  wrapper.classList.add("message", "bot");
  const content = document.createElement("div");
  content.innerHTML = options.prompt || "";
  wrapper.appendChild(content);

  const row = document.createElement("div");
  row.classList.add("option-row");

  options.items.forEach(opt => {
    const btn = document.createElement("button");
    btn.classList.add("option-btn");
    btn.innerText = opt.label;
    btn.onclick = () => {
      // push visual user bubble
      addMessage(opt.label, "user");
      // store response
      leadData.responses.push({ option: opt.value, label: opt.label, ts: new Date().toISOString() });
      // small delay for UX
      setTimeout(() => handleUserChoice(opt.value, opt.next), 220);
    };
    row.appendChild(btn);
  });

  wrapper.appendChild(row);
  messagesContainer.appendChild(wrapper);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

/* ---------------- FLOW ---------------- */

function startChat() {
  // ask for name first (3A)
  addMessage("¡Hola! Soy Helios, Asesor Comercial Senior de Helios AI Labs. Para dirigirnos correctamente, ¿cómo te llamas (ej. Dra. Pérez)?");
  currentStep = receiveName;
}

// receive name typed
function receiveName() {
  currentStep = null; // avoid reentry
  addMessage("Perfecto, mucho gusto.", "bot");
  // set next step to show first menu
  setTimeout(() => askFirstQuestion(), 500);
}

// main menu
function askFirstQuestion() {
  addMessage("Para ofrecerle una atención personalizada: ¿qué desea conocer primero?");
  addOptions({
    prompt: "",
    items: [
      { label: "Cómo la IA ayuda a mi negocio", value: "A", next: askIndustry },
      { label: "Información de la empresa y garantías", value: "B", next: companyInfo },
      { label: "Por qué adoptar IA ahora", value: "C", next: pitchWhyNow },
      { label: "Costos y ROI (rangos)", value: "D", next: pitchROI },
      { label: "Todas las anteriores (quiere asesoría)", value: "E", next: askIndustryHotLead }
    ]
  });
}

// industry selection
function askIndustry() {
  addMessage("¿En cuál de estos giros está su negocio?");
  addOptions({
    prompt: "",
    items: [
      { label: "Salud", value: "salud", next: pickIndustry },
      { label: "Jurídico", value: "juridico", next: pickIndustry },
      { label: "Restaurante / Cafetería", value: "foods", next: pickIndustry },
      { label: "Inmobiliario", value: "realestate", next: pickIndustry },
      { label: "Educación", value: "edu", next: pickIndustry },
      { label: "Contenido / Creativo", value: "content", next: pickIndustry },
      { label: "Comercio / Retail", value: "retail", next: pickIndustry },
      { label: "Profesional Independiente", value: "freelance", next: pickIndustry },
      { label: "Belleza / Spa", value: "beauty", next: pickIndustry },
      { label: "Otro", value: "other", next: pickIndustry }
    ]
  });
}

// user chose industry
function pickIndustry(val) {
  selectedIndustry = val;
  leadData.industry = val;
  // show pitch specific
  renderIndustryPitch(val);
}

// industry pitches
function renderIndustryPitch(ind) {
  switch(ind) {
    case "salud":
      addMessage("👨‍⚕️ En consultorios y clínicas, la IA permite agendado 24/7, recordatorios, filtrado de pacientes y aumentar ticket promedio. ¿Le interesaría que le agendemos una asesoría gratuita de 20 min para ver números concretos?");
      break;
    case "juridico":
      addMessage("⚖️ En despachos, la IA filtra casos, automatiza seguimientos y eleva el valor de cada cliente. ¿Le interesa agendar una asesoría gratuita de 20 min?");
      break;
    case "realestate":
      addMessage("🏡 En inmobiliarias, la IA filtra propiedades aptas, valida documentación y trae compradores con capacidad. ¿Le interesa que lo agendemos?");
      break;
    case "foods":
      addMessage("🍽️ Para restaurantes, automatizamos pedidos, reservaciones y recomendaciones que aumentan ticket promedio. ¿Le interesa agendar?");
      break;
    case "edu":
      addMessage("🎓 Para instituciones educativas, automatizamos inscripciones y recordatorios de pago. ¿Le interesa agendar?");
      break;
    case "retail":
      addMessage("🛍️ E-commerce y tiendas: ventas 24/7, control de inventario y cobro automático. ¿Le interesa agendar?");
      break;
    case "beauty":
      addMessage("💄 Para centros de belleza: reservas, recordatorios y promociones personalizadas que llenan agenda. ¿Le interesa agendar?");
      break;
    case "freelance":
      addMessage("👔 Para profesionales independientes: filtrar clientes, agendar y cobrar anticipos. ¿Le interesa agendar?");
      break;
    default:
      addMessage("🚀 La IA puede transformar su negocio: menos trabajo repetitivo y más ingresos. ¿Le interesa agendar una asesoría?");
  }
  // ask close disguised
  setTimeout(() => askInterestAndDecision(), 900);
}

// interest + decision
function askInterestAndDecision() {
  addMessage("Si la implementación fuera 100% accesible y garantizara recuperar su inversión en 3 meses, ¿estaría listo para decidir hoy?");
  addOptions({
    prompt: "",
    items: [
      { label: "Sí — Listo para contratar hoy", value: "yes_now", next: openContactCapture },
      { label: "Lo tengo que pensar", value: "think", next: handleThink },
      { label: "Lo tengo que consultar (socio/jefe)", value: "consult", next: handleConsult }
    ]
  });
}

function handleThink() {
  addMessage("Entiendo. ¿Qué porcentaje de la decisión depende de usted?");
  addOptions({
    prompt: "",
    items: [
      { label: "Menos del 50%", value: "auth_lt50", next: offerPresentation },
      { label: "50% o más", value: "auth_gte50", next: offerPresentation }
    ]
  });
}

function handleConsult() {
  addMessage("¿Desea que le enviemos una presentación por email o prefiere agendar una reunión con su decisor?");
  addOptions({
    prompt: "",
    items: [
      { label: "Enviar presentación (email)", value: "send_pres", next: askForEmailToSendPres },
      { label: "Agendar reunión con decisor", value: "agendar_decisor", next: openContactCapture }
    ]
  });
}

function offerPresentation() {
  addMessage("Perfecto. ¿Cuál email usamos para enviar la presentación?");
  currentStep = receiveEmailToSendPresentation;
}

function askForEmailToSendPres() {
  addMessage("Ingrese por favor su email en el campo inferior y presione Enviar.");
  currentStep = receiveEmailToSendPresentation;
}

function receiveEmailToSendPresentation() {
  // expects typed input (submitText will handle)
  // value will be captured in submitText
  // after capture, we will send lead w/ wantsPresentation flag
}

/* Contact capture flow (opens small input mode using main input) */
function openContactCapture() {
  addMessage("Perfecto. Para agendar necesito: Nombre, Teléfono (WhatsApp) y Email. Escriba todo en una sola línea separados por comas.\nEj.: Dra. Pérez, +52 1 771 123 4567, correo@ejemplo.com");
  currentStep = receiveContactLine;
}

function receiveContactLine() {
  // handled in submitText
}

/* submitText handler */
inputField.addEventListener("keydown", e => {
  if (e.key === "Enter") submitText();
});
sendBtn.addEventListener("click", submitText);

function submitText() {
  const text = inputField.value.trim();
  if (!text) return;
  // show user message
  addMessage(text, "user");
  inputField.value = "";

  // store textual reply
  leadData.responses.push({ text, ts: new Date().toISOString() });

  // Routing according to currentStep
  if (currentStep === receiveName) {
    // first-time name entry
    leadData.name = text;
    currentStep = null;
    addMessage(`Excelente ${leadData.name}. Gracias.`);
    setTimeout(() => askFirstQuestion(), 700);
    return;
  }

  if (currentStep === receiveEmailToSendPresentation) {
    leadData.email = text;
    // send lead with wantsPresentation flag
    sendLeadToWebhook({ wantsPresentation: true });
    addMessage("Perfecto — le enviaremos la presentación a ese email. Gracias.");
    currentStep = null;
    setTimeout(() => askFirstQuestion(), 900);
    return;
  }

  if (currentStep === receiveContactLine) {
    // parse line: name, phone, email
    const parts = text.split(",").map(s=>s.trim());
    leadData.name = leadData.name || parts[0] || "";
    leadData.phone = parts[1] || "";
    leadData.email = parts[2] || "";
    currentStep = null;
    addMessage("Gracias. En breve recibirá confirmación por email si procede.");
    // send lead
    sendLeadToWebhook();
    return;
  }

  // default behaviour: if no special step, continue menu
  if (currentStep) {
    const fn = currentStep;
    currentStep = null;
    try { fn(); } catch(e){ console.error(e); }
    return;
  }

  // fallback: re-open main menu
  setTimeout(() => askFirstQuestion(), 500);
}

/* handle user selection from option buttons */
function handleUserChoice(value, next) {
  // this function is referenced by addOptions' buttons
  // note: we already added the user bubble and stored response there earlier
  // route to next step
  if (typeof next === "function") {
    next(value);
    return;
  }
  // fallback: main menu
  askFirstQuestion();
}

/* build payload and send to webhook */
function sendLeadToWebhook(extra = {}) {
  const payload = {
    sessionId,
    source: "web_chat_app",
    timestamp: new Date().toISOString(),
    lead: {
      name: leadData.name || "",
      phone: leadData.phone || "",
      email: leadData.email || "",
      industry: leadData.industry || "",
      subcategory: leadData.subcategory || "",
      focus: leadData.focus || "",
      decisionPower: leadData.decisionPower || "",
      interestLevel: leadData.interestLevel || "",
      responses: leadData.responses || []
    },
    extra
  };

  addMessage("Enviando información y preparando confirmación...", "bot");

  fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })
  .then(r => {
    if (!r.ok) throw new Error("error");
    addMessage("¡Listo! Hemos enviado la información. En breve recibirá confirmación por email.", "bot");
  })
  .catch(err => {
    console.error("Send error:", err);
    addMessage("No pudimos enviar la información al servidor. Por favor contacte vía WhatsApp: +52 771 762 2360", "bot");
  });
}

/* start */
startChat();
currentStep = receiveName;

