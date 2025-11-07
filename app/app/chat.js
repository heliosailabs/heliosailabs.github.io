/* chat.js - Helios AI Labs - versión mejorada 2025
   Dark mode + UX optimizado + conexión n8n */

const WEBHOOK_URL = "https://heliosailabs369.app.n8n.cloud/webhook/chatbot-groq";

const messagesContainer = document.getElementById("messages");
const inputField = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");

/* -------------------- SESIÓN -------------------- */
function genSessionId() {
  let s = localStorage.getItem("helios_sessionId");
  if (!s) {
    s = `sess_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    localStorage.setItem("helios_sessionId", s);
  }
  return s;
}
const sessionId = genSessionId();

/* -------------------- LEAD DATA -------------------- */
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

/* -------------------- UI HELPERS -------------------- */
function addMessage(text, sender = "bot") {
  const el = document.createElement("div");
  el.classList.add("message", sender);
  el.innerHTML = text.replace(/\n/g, "<br/>");
  messagesContainer.appendChild(el);
  setTimeout(() => {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }, 120);
  return el;
}

function addOptions(options) {
  const wrapper = document.createElement("div");
  wrapper.classList.add("message", "bot");
  const content = document.createElement("div");
  if (options.prompt) content.innerHTML = options.prompt;
  wrapper.appendChild(content);

  const row = document.createElement("div");
  row.classList.add("option-row");

  options.items.forEach(opt => {
    const btn = document.createElement("button");
    btn.classList.add("option-btn");
    btn.innerText = opt.label;
    btn.onclick = () => {
      addMessage(opt.label, "user");
      leadData.responses.push({
        option: opt.value,
        label: opt.label,
        ts: new Date().toISOString()
      });
      setTimeout(() => handleUserChoice(opt.value, opt.next), 200);
    };
    row.appendChild(btn);
  });

  wrapper.appendChild(row);
  messagesContainer.appendChild(wrapper);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

/* -------------------- FLUJO PRINCIPAL -------------------- */

function startChat() {
  addMessage("¡Hola! Soy <b>Helios</b>, Asesor Comercial Senior de Helios AI Labs.<br>¿Cómo te llamas (por ejemplo: Dra. Pérez)?");
  currentStep = receiveName;
}

/* nombre */
function receiveName() {
  currentStep = null;
  addMessage("Perfecto, mucho gusto.", "bot");
  setTimeout(() => askFirstQuestion(), 600);
}

/* menú principal */
function askFirstQuestion() {
  addMessage("Para ofrecerte atención personalizada, ¿qué deseas conocer primero?");
  addOptions({
    items: [
      { label: "Cómo la IA ayuda a mi negocio", value: "A", next: askIndustry },
      { label: "Información de la empresa y garantías", value: "B", next: companyInfo },
      { label: "Por qué adoptar IA ahora", value: "C", next: pitchWhyNow },
      { label: "Costos y ROI (rangos)", value: "D", next: pitchROI },
      { label: "Todas las anteriores (quiero asesoría)", value: "E", next: askIndustryHotLead }
    ]
  });
}

/* industrias */
function askIndustry() {
  addMessage("¿En cuál de estos giros está tu negocio?");
  addOptions({
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

/* elección de industria */
function pickIndustry(val) {
  selectedIndustry = val;
  leadData.industry = val;
  renderIndustryPitch(val);
}

/* mensajes personalizados por industria */
function renderIndustryPitch(ind) {
  const pitches = {
    salud: "👨‍⚕️ En consultorios y clínicas, la IA permite agendado 24/7, recordatorios, filtrado de pacientes y aumento del ticket promedio.",
    juridico: "⚖️ En despachos, la IA filtra casos, automatiza seguimientos y eleva el valor de cada cliente.",
    realestate: "🏡 En inmobiliarias, la IA filtra propiedades aptas, valida documentación y atrae compradores calificados.",
    foods: "🍽️ Para restaurantes, automatizamos pedidos, reservaciones y recomendaciones que aumentan el ticket promedio.",
    edu: "🎓 En instituciones educativas, automatizamos inscripciones, recordatorios y captación de alumnos.",
    retail: "🛍️ En comercio y retail, IA para ventas 24/7, control de inventario y cobro automático.",
    beauty: "💄 En salones y spas, la IA agenda, recuerda y promueve servicios personalizados que llenan la agenda.",
    freelance: "👔 Para profesionales independientes, la IA filtra clientes, agenda citas y cobra anticipos automáticamente.",
    other: "🚀 La IA puede transformar tu negocio: menos tareas repetitivas y más ingresos."
  };
  addMessage(`${pitches[ind] || pitches.other}<br><br>¿Te gustaría una asesoría gratuita de 20 min para ver números concretos?`);
  setTimeout(() => askInterestAndDecision(), 900);
}

/* interés y decisión */
function askInterestAndDecision() {
  addMessage("Si la implementación fuera 100% accesible y garantizara recuperar tu inversión en 3 meses, ¿estarías listo para decidir hoy?");
  addOptions({
    items: [
      { label: "Sí, listo para contratar hoy", value: "yes_now", next: openContactCapture },
      { label: "Lo tengo que pensar", value: "think", next: handleThink },
      { label: "Debo consultarlo con alguien", value: "consult", next: handleConsult }
    ]
  });
}

function handleThink() {
  addMessage("Entiendo. ¿Qué porcentaje de la decisión depende de ti?");
  addOptions({
    items: [
      { label: "Menos del 50%", value: "auth_lt50", next: offerPresentation },
      { label: "50% o más", value: "auth_gte50", next: offerPresentation }
    ]
  });
}

function handleConsult() {
  addMessage("¿Deseas que te enviemos una presentación por correo o prefieres agendar una reunión con tu socio/jefe?");
  addOptions({
    items: [
      { label: "Enviar presentación por email", value: "send_pres", next: askForEmailToSendPres },
      { label: "Agendar reunión", value: "agendar_decisor", next: openContactCapture }
    ]
  });
}

function offerPresentation() {
  addMessage("Perfecto. ¿A qué email te enviamos la presentación?");
  currentStep = receiveEmailToSendPresentation;
}

function askForEmailToSendPres() {
  addMessage("Por favor ingresa tu correo electrónico debajo y presiona Enviar.");
  currentStep = receiveEmailToSendPresentation;
}

/* captura de contacto completo */
function openContactCapture() {
  addMessage("Perfecto. Para agendar necesito: <br><b>Nombre, Teléfono (WhatsApp) y Email</b>.<br>Ejemplo:<br><i>Dra. Pérez, +52 1 771 123 4567, correo@ejemplo.com</i>");
  currentStep = receiveContactLine;
}

/* -------------------- INPUT Y RUTEO -------------------- */
inputField.addEventListener("keydown", e => {
  if (e.key === "Enter") submitText();
});
sendBtn.addEventListener("click", submitText);

async function submitText() {
  const text = inputField.value.trim();
  if (!text) return;
  addMessage(text, "user");
  inputField.value = "";

  leadData.responses.push({ text, ts: new Date().toISOString() });

  if (currentStep === receiveName) {
    leadData.name = text;
    addMessage(`Excelente ${leadData.name}. Gracias.`);
    currentStep = null;
    setTimeout(() => askFirstQuestion(), 800);
    return;
  }

  if (currentStep === receiveEmailToSendPresentation) {
    leadData.email = text;
    await sendLeadToWebhook({ wantsPresentation: true });
    addMessage("Perfecto — te enviaremos la presentación a ese correo. Gracias.");
    currentStep = null;
    setTimeout(() => askFirstQuestion(), 1000);
    return;
  }

  if (currentStep === receiveContactLine) {
    const parts = text.split(",").map(s => s.trim());
    leadData.name = leadData.name || parts[0] || "";
    leadData.phone = parts[1] || "";
    leadData.email = parts[2] || "";
    addMessage("Gracias. En breve recibirás confirmación por correo.");
    currentStep = null;
    await sendLeadToWebhook();
    return;
  }

  if (currentStep) {
    const fn = currentStep;
    currentStep = null;
    try { fn(); } catch (e) { console.error(e); }
    return;
  }

  setTimeout(() => askFirstQuestion(), 500);
}

/* manejar selección por botones */
function handleUserChoice(value, next) {
  if (typeof next === "function") {
    next(value);
    return;
  }
  askFirstQuestion();
}

/* -------------------- ENVÍO AL WEBHOOK -------------------- */
async function sendLeadToWebhook(extra = {}) {
  const payload = {
    sessionId,
    source: "web_chat_app",
    timestamp: new Date().toISOString(),
    lead: { ...leadData },
    extra
  };

  addMessage("Enviando información y preparando confirmación...", "bot");

  try {
    const r = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!r.ok) throw new Error("Error de red");
    addMessage("✅ ¡Listo! Hemos enviado la información. En breve recibirás confirmación por email.", "bot");
  } catch (err) {
    console.error("Send error:", err);
    addMessage("⚠️ No pudimos enviar la información al servidor.<br>Por favor contacta vía WhatsApp: <b>+52 771 762 2360</b>", "bot");
  }
}

/* -------------------- INICIO -------------------- */
startChat();
