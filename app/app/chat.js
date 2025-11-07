/* chat.js - Helios AI Labs - versión final */
const WEBHOOK_URL = "https://heliosailabs369.app.n8n.cloud/webhook/chatbot-groq"; // tu webhook n8n
const messagesContainer = document.getElementById("messages");
const inputField = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");

// modal fields
const contactModal = document.getElementById("contact-modal");
const modalName = document.getElementById("modal-name");
const modalPhone = document.getElementById("modal-phone");
const modalEmail = document.getElementById("modal-email");
const modalCancel = document.getElementById("modal-cancel");
const modalSend = document.getElementById("modal-send");

function genSessionId() {
  let s = localStorage.getItem("helios_sessionId");
  if (!s) {
    s = `sess_${Date.now()}_${Math.floor(Math.random()*10000)}`;
    localStorage.setItem("helios_sessionId", s);
  }
  return s;
}
const sessionId = genSessionId();

// UTIL: render message
function addMessage(text, sender = "bot") {
  const message = document.createElement("div");
  message.classList.add("message", sender);
  message.innerHTML = text;
  messagesContainer.appendChild(message);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// UTIL: render options (buttons)
function addOptions(options) {
  const wrapper = document.createElement("div");
  wrapper.classList.add("message", "bot");
  options.forEach(opt => {
    const btn = document.createElement("button");
    btn.classList.add("option-btn");
    btn.innerText = opt.label;
    btn.onclick = () => handleUserChoice(opt.value, opt.next);
    wrapper.appendChild(btn);
  });
  messagesContainer.appendChild(wrapper);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

/* ----------------- FLUJO ----------------- */
let selectedIndustry = null;
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

/* Inicio */
function startChat() {
  addMessage("¡Hola! Soy Helios, Asesor Comercial Senior de Helios AI Labs. ¿Con quién tengo el gusto?");
  currentStep = askFirstQuestion;
}

/* Pregunta 1 - Calificación inicial */
function askFirstQuestion() {
  addMessage("Para ofrecerle una atención personalizada: ¿Qué desea saber primero?");
  addOptions([
    { label: "Cómo la IA ayuda a mi negocio", value: "A", next: askIndustry },
    { label: "Información de la empresa y garantías", value: "B", next: companyInfo },
    { label: "Por qué adoptar IA ahora", value: "C", next: pitchWhyNow },
    { label: "Costos y ROI (rangos)", value: "D", next: pitchROI },
    { label: "Todas las anteriores (quiero asesoría)", value: "E", next: askIndustryHotLead }
  ]);
}

/* Pregunta 2 - Industria */
function askIndustry() {
  addMessage("¿En qué giro se encuentra su negocio?");
  addOptions([
    { label: "Salud", value: "salud", next: finishIndustry },
    { label: "Jurídico", value: "juridico", next: finishIndustry },
    { label: "Restaurante / Cafetería", value: "foods", next: finishIndustry },
    { label: "Inmobiliario", value: "realestate", next: finishIndustry },
    { label: "Educación", value: "edu", next: finishIndustry },
    { label: "Contenido / Creativo", value: "content", next: finishIndustry },
    { label: "Comercio Retail / Mayorista", value: "retail", next: finishIndustry },
    { label: "Profesional Independiente", value: "freelance", next: finishIndustry },
    { label: "Belleza / Estética / Spa", value: "beauty", next: finishIndustry },
    { label: "Otro", value: "other", next: finishIndustry }
  ]);
}

function finishIndustry(value) {
  // value argument not used here (we supply selectedIndustry in handleUserChoice)
  addMessage("Perfecto. Gracias. Ahora le mostraré cómo la IA puede transformar su sector...");
  setTimeout(() => pitchIndustry(selectedIndustry), 800);
}

/* PITCHES por INDUSTRIA (ya integrados) */
function pitchIndustry(ind) {
  switch (ind) {
    case "salud":
      addMessage(`
👨‍⚕️ ${leadData.name || "Doctor"}, los pacientes hoy exigen respuesta inmediata.
Con IA usted obtendrá:
✅ Respuestas 24/7, agendado automático, recordatorios,
✅ Menos cancelaciones, pacientes mejor pagados y ticket promedio mayor.
`);
      break;
    case "juridico":
      addMessage(`
⚖️ ${leadData.name || "Licenciado"}, la velocidad en respuesta genera confianza.
Con IA: filtros de prospectos, agenda automatizada, seguimiento legal y mayor cierre de casos.
`);
      break;
    case "realestate":
      addMessage(`
🏡 ${leadData.name || "Agente"}, la IA le ayuda a captar propiedades premium, verificar documentación y entregar solo leads listos para vender.
`);
      break;
    case "foods":
      addMessage(`
🍽️ Automatice pedidos, reservaciones y aumente ticket con recomendaciones automáticas. Menos mesas vacías, más ingresos.
`);
      break;
    case "edu":
      addMessage(`
🎓 Automatice inscripciones, recordatorios de pago y retención de alumnos. Más inscripciones con menos esfuerzo.
`);
      break;
    case "retail":
      addMessage(`
🛍️ Vende 24/7: catálogo, inventario en tiempo real, cobro automático y recuperación de carritos abandonados.
`);
      break;
    case "beauty":
      addMessage(`
💄 Agenda llena: reservas automáticas, recordatorios y promociones personalizadas que aumentan recurrencia.
`);
      break;
    case "freelance":
      addMessage(`
👔 Mantenga su negocio abierto 24/7: filtrado de clientes, agendado y cobro anticipado.
`);
      break;
    default:
      addMessage("🚀 La IA aumenta ingresos y elimina tareas repetitivas. Vamos a lo práctico.");
  }
  setTimeout(() => askInterestAndDecision(), 900);
}

/* Pregunta de interés y poder de decisión (cierre disfrazado) */
function askInterestAndDecision() {
  addMessage("Si la implementación fuera 100% accesible y garantizada para recuperar inversión en 3 meses, ¿estaría listo para decidir hoy?");
  addOptions([
    { label: "Sí — Listo para contratar hoy", value: "yes_now", next: openContactModal },
    { label: "Lo tengo que pensar", value: "think", next: handleThink },
    { label: "Lo tengo que consultar (socio/jefe)", value: "consult", next: handleConsult }
  ]);
}

/* Si dice "Sí" abrimos modal para captura completa y posterior envío */
function openContactModal() {
  // show modal
  contactModal.classList.remove("hidden");
}

/* Si piensa o consulta -> seguir estrategia */
function handleThink() {
  addMessage("Perfecto, entiendo. ¿Qué porcentaje de la decisión depende de usted?");
  addOptions([
    { label: "Menos del 50%", value: "auth_lt50", next: handleLess50 },
    { label: "50% o más", value: "auth_gte50", next: handleGte50 }
  ]);
}
function handleConsult() {
  addMessage("Entiendo. ¿Prefiere que le envíe una presentación por email para que la comparta con su equipo o prefiere agendar directamente una reunión con quien decide?");
  addOptions([
    { label: "Enviar presentación (email)", value: "send_pres", next: requestEmailForDoc },
    { label: "Agendar reunión con decisor", value: "agendar_decisor", next: openContactModal }
  ]);
}

function handleLess50() {
  addMessage("Perfecto. ¿Quiere que coordinemos una reunión con su decisor para que juntos tomen la decisión?");
  addOptions([
    { label: "Sí, coordina la reunión", value: "coord_meet", next: openContactModal },
    { label: "Prefiero enviar info y que ellos me contacten", value: "send_info", next: requestEmailForDoc }
  ]);
}

function handleGte50() {
  addMessage("Genial. Si fuera 100% accesible para usted, ¿decidiría hoy?");
  addOptions([
    { label: "Sí ✅", value: "decide_today", next: openContactModal },
    { label: "Aún no ❌", value: "still_no", next: requestEmailForDoc }
  ]);
}

/* requestEmailForDoc - pide email si vamos a enviar presentación */
function requestEmailForDoc() {
  addMessage("Perfecto. ¿Cuál es el email donde le envío la presentación?");
  // allow typing email in input
  currentStep = receiveTypedEmailForDoc;
}

/* receive typed email for doc */
function receiveTypedEmailForDoc() {
  currentStep = null; // avoid double-calls
  // rely on submitText to push message
}

/* Cuando el usuario dice que quiere WhatsApp fallback */
function shareWhatsapp() {
  addMessage("De acuerdo. Nuestro WhatsApp directo para contacto inmediato:\n👉 +52 771 762 2360\n¡Estamos para servirle!");
}

/* Company info and misc */
function companyInfo() {
  addMessage(`📍 Helios AI Labs
Helios AI Labs — 22 años de experiencia. Contratos facturados. Garantie PROFECO. Más info en nuestra página.`);
}
function pitchWhyNow() {
  addMessage("La adopción de IA ya está moviendo el mercado. Las empresas que esperan pierden cuota de mercado.");
}
function pitchROI() {
  addMessage("La inversión se recupera típicamente en 60-90 días con automatizaciones enfocadas en ingresos y eficiencia.");
}

/* ----------------- EVENTOS Y ENVIO ----------------- */

/* modal actions */
modalCancel.onclick = () => {
  contactModal.classList.add("hidden");
  addMessage("No hay problema. Le dejo nuestro WhatsApp por si cambia de opinión:\n+52 771 762 2360");
};
modalSend.onclick = () => {
  const name = modalName.value.trim();
  const phone = modalPhone.value.trim();
  const email = modalEmail.value.trim();
  if (!email || !phone) {
    alert("Por favor ingrese teléfono y correo para agendar.");
    return;
  }
  leadData.name = name || leadData.name || "";
  leadData.phone = phone;
  leadData.email = email;
  leadData.industry = selectedIndustry;
  contactModal.classList.add("hidden");
  addMessage(`¡Perfecto ${leadData.name || ""}! En breve le llegará la confirmación a ${leadData.email}.`);
  // Enviar al webhook
  sendLeadToWebhook();
};

/* Captura de texto manual (input) */
inputField.addEventListener("keydown", e => {
  if (e.key === "Enter") submitText();
});
sendBtn.onclick = submitText;

function submitText() {
  const text = inputField.value.trim();
  if (!text) return;
  addMessage(text, "user");
  inputField.value = "";
  leadData.responses.push(text);

  // routing when currentStep expects typed input
  if (currentStep === receiveTypedEmailForDoc) {
    // treat text as email
    leadData.email = text;
    addMessage("Perfecto — Le enviaré la presentación al correo indicado.");
    // send lead but mark as doc request
    sendLeadToWebhook({ wantsPresentation: true });
    currentStep = askFirstQuestion;
    setTimeout(() => askFirstQuestion(), 600);
    return;
  }

  // default: continue current step
  if (currentStep) currentStep();
}

/* handleUserChoice - central router for option buttons */
function handleUserChoice(value, nextFn) {
  // store responses
  leadData.responses.push({ option: value, timestamp: Date.now() });

  // special: when selecting industry we need to save it
  const industryValues = ["salud","juridico","foods","realestate","edu","content","retail","freelance","beauty","other"];
  if (industryValues.includes(value)) {
    selectedIndustry = value;
    leadData.industry = value;
  }

  // call next function (some nextFns are function references)
  if (typeof nextFn === "function") {
    nextFn(value);
  } else {
    // fallback
    askFirstQuestion();
  }
}

/* build payload and POST to webhook n8n */
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

  // show spinner message
  addMessage("Enviando sus datos de contacto y preparando la confirmación...", "bot");

  fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })
  .then(r => {
    if (!r.ok) throw new Error("Error al enviar al servidor");
    addMessage("¡Listo! Hemos enviado la información. En breve recibirá confirmación por email.", "bot");
  })
  .catch(err => {
    console.error(err);
    addMessage("Hubo un error al enviar. Por favor use nuestro WhatsApp: +52 771 762 2360", "bot");
  });
}

/* estado inicial */
let currentStep = null;
startChat();
currentStep = askFirstQuestion;

