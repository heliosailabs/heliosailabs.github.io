/* chat.js - Helios AI Labs
   Implementación literal del FLUJO CONVERSACIONAL COMPLETO - HELIOS AI LABS
   - No se modifica ni una palabra del contenido entregado por el usuario.
   - No se añaden botones/respuestas que no estén en el flujo.
   - Envía payload al webhook n8n y copia a email.
*/

/* ---------- CONFIG ---------- */
const WEBHOOK_URL = "https://heliosailabs369.app.n8n.cloud/webhook/chatbot-groq";
const EMAIL_COPY_TO = "heliosailabs@gmail.com";
const FORMS_OF_PAYMENT = "Transferencia bancaria, todas las tarjetas de crédito y débito VISA, Mastercard y American Express, Bitcoin y ETH.";

/* ---------- DOM ---------- */
const messagesContainer = document.getElementById("messages");
const inputField = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");

/* ---------- Session & Lead ---------- */
function genSessionId() {
  let s = localStorage.getItem("helios_sessionId");
  if (!s) {
    s = `sess_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    localStorage.setItem("helios_sessionId", s);
  }
  return s;
}
const sessionId = genSessionId();

let lead = {
  name: "",
  title: "",
  industry: "",
  subcategory: "",
  phone: "",
  email: "",
  preferredDay: "",
  preferredTime: "",
  responses: []
};

let currentStep = null;
let optionsVisible = false;
let lastOptionsWrapper = null;

/* ---------- UI helpers ---------- */
function addMessage(text, sender = "bot") {
  const el = document.createElement("div");
  el.classList.add("message", sender);
  el.innerHTML = text.replace(/\n/g, "<br/>");
  messagesContainer.appendChild(el);
  setTimeout(() => (messagesContainer.scrollTop = messagesContainer.scrollHeight), 40);
  return el;
}

function clearLastOptions() {
  if (lastOptionsWrapper) {
    lastOptionsWrapper.remove();
    lastOptionsWrapper = null;
  }
  optionsVisible = false;
  inputField.disabled = false;
  sendBtn.disabled = false;
}

function lockInput() {
  optionsVisible = true;
  inputField.disabled = true;
  sendBtn.disabled = true;
}

function unlockInput() {
  optionsVisible = false;
  inputField.disabled = false;
  sendBtn.disabled = false;
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
    btn.innerText = it.label;
    btn.addEventListener("click", () => {
      addMessage(it.label, "user");
      lead.responses.push({ option: it.value || it.label, ts: new Date().toISOString() });
      Array.from(row.querySelectorAll("button")).forEach(b => (b.disabled = true));
      setTimeout(() => {
        clearLastOptions();
        if (typeof it.next === "function") it.next(it.value);
      }, 150);
    });
    row.appendChild(btn);
  });

  wrapper.appendChild(row);
  messagesContainer.appendChild(wrapper);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  lastOptionsWrapper = wrapper;
  lockInput();
}

/* ---------- Flow ---------- */
function startChat() {
  addMessage("¡Hola! Soy Helios, Asesor Comercial Senior de Helios AI Labs. ¿Con quién tengo el gusto?");
  currentStep = "captureName";
  unlockInput();
}

const TITLE_CHOICES = [
  "Dr.", "Dra.", "Arq.", "Lic.", "Ing.", "C.P.", "Mtro.", "Mtra.",
  "Sr.", "Sra.", "Srita.", "Don", "Doña", "Profesor", "Profesora", "Coach", "Chef", "Otro"
];

function showMainMenu() {
  addMessage("Para proporcionarle la mejor atención personalizada y diseñar para usted un traje a la medida, ¿Cuál de las siguientes preguntas desea que respondamos para usted?");
  setTimeout(() => {
    addOptions([
      { label: "A) ¿Cómo funciona la automatización de procesos con IA y qué beneficios medibles puede aportar a mi negocio?", value: "A", next: () => askGiro() },
      { label: "B) Información sobre la empresa, ubicación, experiencia, credenciales, referencias, información fiscal, contrato y garantías", value: "B", next: () => handleCompanyInfo() },
      { label: "C) ¿Por qué adoptar Inteligencia Artificial hoy es tan importante y cuáles son los escenarios para mi negocio si decido esperar?", value: "C", next: () => handleAdoptNow() },
      { label: "D) Costos, ROI y promociones actuales", value: "D", next: () => handleCosts() },
      { label: "E) Todas las anteriores", value: "E", next: () => handleAll() }
    ]);
  }, 400);
}

/* ---------- Questions & Handlers ---------- */
function askGiro() {
  addMessage("Para responder a su pregunta, con la atención que usted se merece, por favor dígame: ¿En cuál de los siguientes giros se encuentra su negocio?");
  setTimeout(() => {
    addOptions([
      { label: "A) Salud", value: "Salud", next: () => renderPitch_Salud() },
      { label: "B) Despacho Jurídico", value: "Jurídico", next: () => renderPitch_Juridico() },
      { label: "C) Profesional independiente", value: "Profesional", next: () => renderPitch_Profesional() }
    ]);
  }, 400);
}

function renderPitch_Salud() {
  const text = `En consultorios y clínicas la automatización con IA puede contestar llamadas por voz o mensajes de texto, agendar citas y confirmar consultas por usted 24/7, enviar recordatorios a los pacientes (disminuyendo dramáticamente las consultas canceladas o los retrasos). Puede notificarle a Ud. directamente en caso de emergencia. Llevar un control de todos sus expedientes, cobrar consultas por adelantado con medios digitales, darle seguimiento a sus pacientes, enviar felicitaciones en días festivos. Puede aumentar el número de pacientes exponencialmente, de acuerdo a sus instrucciones.\n\nSi la implementación fuera 100% accesible a su economía y garantizara recuperar su inversión en un máximo de 3 meses, ¿estaría listo(a) para decidir hoy?`;
  addMessage(text);
  setTimeout(() => {
    addOptions([
      { label: "✅ Sí", next: () => openContactCapture() },
      { label: "🤔 Lo tengo que pensar", next: () => handleThink() },
      { label: "❌ No es prioridad", next: () => handleNo() }
    ]);
  }, 400);
}

function renderPitch_Juridico() {
  const text = `⚖ En su profesión la confianza, velocidad y resultados lo son todo. La automatización con IA puede contestar llamadas por voz o mensajes de texto, responder dudas y preguntas frecuentes a sus clientes 24/7, agendar citas, enviar recordatorios, confirmar reuniones de trabajo, etc.\n\n✅ Más casos sin invertir más tiempo\n✅ Filtro automático de prospectos con capacidad económica real\n✅ Control total de expedientes y fechas críticas\n✅ Casos mejor pagados — honorarios más altos\n\nSi la implementación fuera 100% accesible a su economía y garantizara recuperar su inversión en un máximo de 3 meses, ¿estaría listo(a) para decidir hoy?`;
  addMessage(text);
  setTimeout(() => {
    addOptions([
      { label: "✅ Sí", next: () => openContactCapture() },
      { label: "🤔 Lo tengo que pensar", next: () => handleThink() },
      { label: "❌ No es prioridad", next: () => handleNo() }
    ]);
  }, 400);
}

function renderPitch_Profesional() {
  const text = `La IA consigue clientes, organiza agenda, envía cotizaciones, cobra anticipos y gestiona proyectos. Su tiempo se convierte en ingresos.\n\nAdemás, la automatización atrae clientes con mayor poder adquisitivo y eleva sus honorarios promedio.\n\nSi la implementación fuera 100% accesible a su economía y garantizara recuperar su inversión en un máximo de 3 meses, ¿estaría listo(a) para decidir hoy?`;
  addMessage(text);
  setTimeout(() => {
    addOptions([
      { label: "✅ Sí", next: () => openContactCapture() },
      { label: "🤔 Lo tengo que pensar", next: () => handleThink() },
      { label: "❌ No es prioridad", next: () => handleNo() }
    ]);
  }, 400);
}

/* ---------- Other Options ---------- */
function handleCompanyInfo() {
  addMessage(`Nombre comercial: Helios AI Labs.\nGarantías: Contrato avalado por PROFECO con garantía por escrito y NDA (Acuerdo de Confidencialidad).\n\nFormas de pago: ${FORMS_OF_PAYMENT}\n\n🎁 Promociones actuales: 3 meses sin intereses con todas las tarjetas de crédito bancarias, en el pago inicial de Implementación "Set up".`);
  setTimeout(showMainMenu, 1000);
}

function handleAdoptNow() {
  addMessage("Adoptar Inteligencia Artificial hoy es vital para no perder ventaja competitiva, reducir errores y mejorar eficiencia. Esperar solo incrementa los costos y retrasa resultados.");
  setTimeout(showMainMenu, 800);
}

function handleCosts() {
  addMessage("Los costos dependen del alcance del proyecto. Garantizamos retorno de inversión en máximo 3 meses. 🎁 Promociones actuales: 3 meses sin intereses con tarjetas de crédito bancarias.");
  setTimeout(showMainMenu, 800);
}

function handleAll() {
  addMessage("Perfecto, puedo mostrarle un plan de acción inmediato y agendar una asesoría gratuita de diagnóstico.");
  setTimeout(openContactCapture, 700);
}

/* ---------- Cierre ---------- */
function handleThink() {
  addMessage("¿Qué porcentaje de la decisión depende de usted?");
  setTimeout(() => {
    addOptions([
      { label: "Menos de 50%", next: () => openContactCapture() },
      { label: "50% o más", next: () => openContactCapture() }
    ]);
  }, 400);
}

function handleNo() {
  addMessage("Entendido. Le comparto nuestro WhatsApp directo: 👉 +52 771 762 2360\n📌 Escríbanos cuando esté listo(a). ¡Excelente día!");
}

function openContactCapture() {
  addMessage("Perfecto. Para agendar necesito: Teléfono (WhatsApp), Email, Día preferido y Hora aproximada.");
  currentStep = "captureContact";
  unlockInput();
}

/* ---------- Input Handling ---------- */
sendBtn.addEventListener("click", onSubmit);
inputField.addEventListener("keydown", e => { if (e.key === "Enter") onSubmit(); });

async function onSubmit() {
  const raw = inputField.value.trim();
  if (!raw) return;

  addMessage(raw, "user");
  inputField.value = "";

  if (optionsVisible) return;

  if (currentStep === "captureName") {
    lead.name = raw;
    addMessage(`¿Cómo prefiere que me dirija a usted? Elija una opción:`);
    const opts = TITLE_CHOICES.map(t => ({
      label: t,
      next: () => {
        lead.title = t;
        addMessage(`Excelente ${lead.title} ${lead.name}. Gracias.`);
        setTimeout(showMainMenu, 600);
      }
    }));
    addOptions(opts);
    currentStep = null;
    return;
  }

  if (currentStep === "captureContact") {
    const parts = raw.split(/[, ]+/).filter(Boolean);
    if (parts.length >= 2) {
      lead.phone = parts[0];
      lead.email = parts[1];
      if (parts[2]) lead.preferredDay = parts[2];
      if (parts[3]) lead.preferredTime = parts[3];
      addMessage("📨 Información enviada correctamente a Helios AI Labs.");
      await sendLeadPayload();
      currentStep = null;
    } else {
      addMessage("Por favor ingrese Teléfono y Email, separados por espacio o coma.");
    }
  }
}

/* ---------- Send Lead to Webhook ---------- */
async function sendLeadPayload() {
  const payload = {
    sessionId,
    timestamp: new Date().toISOString(),
    lead,
    extra: { emailCopyTo: EMAIL_COPY_TO, formsOfPayment: FORMS_OF_PAYMENT }
  };

  try {
    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    addMessage("✅ ¡Listo! En breve recibirá confirmación por email.");
  } catch (err) {
    console.error("Webhook error:", err);
    addMessage("⚠️ No pudimos enviar la información al servidor. Por favor contacte vía WhatsApp: +52 771 762 2360");
  }
}

/* ---------- Init ---------- */
window.addEventListener("load", () => startChat());
