/* ==========================
   Helios AI Labs Chatbot vFinal
   ========================== */

const messagesContainer = document.getElementById("messages");
const inputField = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");

let lead = {
  name: "",
  title: "",
  industry: "",
  email: "",
  phone: "",
  responses: []
};

let currentStep = null;

/* ---------------------------
   UTILIDADES DE MENSAJES
--------------------------- */
function addMessage(text, sender = "bot") {
  const msg = document.createElement("div");
  msg.classList.add("message", sender);
  msg.innerHTML = text.replace(/\n/g, "<br>");
  messagesContainer.appendChild(msg);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function addOptions(options) {
  const wrapper = document.createElement("div");
  wrapper.classList.add("message", "bot", "option-row");
  options.forEach(opt => {
    const btn = document.createElement("button");
    btn.classList.add("option-btn");
    btn.innerText = opt.label;
    btn.onclick = () => handleChoice(opt.value, opt.next);
    wrapper.appendChild(btn);
  });
  messagesContainer.appendChild(wrapper);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

/* ---------------------------
   INICIO DEL CHAT
--------------------------- */
function startChat() {
  addMessage("¡Hola! 👋 Soy Helios, asesor inteligente de Helios AI Labs.<br>¿Con quién tengo el gusto?");
  currentStep = getName;
}

function getName() {
  const name = inputField.value.trim();
  if (!name) return;
  lead.name = name;
  addMessage(name, "user");
  inputField.value = "";
  addMessage("¿Cómo prefiere que me dirija a usted? Elija una opción 👇");
  addOptions([
    { label: "Sr.", value: "Sr.", next: askMainMenu },
    { label: "Sra.", value: "Sra.", next: askMainMenu },
    { label: "Dr./Dra.", value: "Dr.", next: askMainMenu },
    { label: "Lic.", value: "Lic.", next: askMainMenu },
    { label: "Ing.", value: "Ing.", next: askMainMenu },
    { label: "Arq.", value: "Arq.", next: askMainMenu },
    { label: "C.P.", value: "C.P.", next: askMainMenu },
    { label: "Mtro./Mtra.", value: "Mtro.", next: askMainMenu },
    { label: "Prof.", value: "Prof.", next: askMainMenu },
    { label: "Chef", value: "Chef", next: askMainMenu },
    { label: "Coach", value: "Coach", next: askMainMenu },
    { label: "Otro", value: "Otro", next: askMainMenu }
  ]);
}

function handleChoice(value, next) {
  lead.responses.push(value);
  lead.title = value;
  next();
}

/* ---------------------------
   MENÚ PRINCIPAL
--------------------------- */
function askMainMenu() {
  addMessage(`Perfecto ${lead.title} ${lead.name.split(" ")[1] || ""}, ¿qué información desea conocer?`);
  addOptions([
    { label: "A) ¿Cómo funciona la IA para mi negocio?", value: "A", next: askIndustry },
    { label: "B) Información de la empresa", value: "B", next: showCompanyInfo },
    { label: "C) ¿Por qué adoptar IA hoy?", value: "C", next: showWhyNow },
    { label: "D) Costos y ROI", value: "D", next: showROI },
    { label: "E) Todo", value: "E", next: askIndustry }
  ]);
}

/* ---------------------------
   GIROS DE NEGOCIO
--------------------------- */
function askIndustry() {
  addMessage("¿En qué giro se encuentra su negocio?");
  addOptions([
    { label: "Salud", value: "salud", next: () => showPitch("salud") },
    { label: "Jurídico", value: "juridico", next: () => showPitch("juridico") },
    { label: "Restaurante / Cafetería", value: "food", next: () => showPitch("food") },
    { label: "Inmobiliario", value: "realestate", next: () => showPitch("realestate") },
    { label: "Educación", value: "edu", next: () => showPitch("edu") },
    { label: "Contenido / Creativo", value: "content", next: () => showPitch("content") },
    { label: "Comercio / Retail", value: "retail", next: () => showPitch("retail") },
    { label: "Profesional Independiente", value: "freelance", next: () => showPitch("freelance") },
    { label: "Belleza / Spa", value: "beauty", next: () => showPitch("beauty") },
    { label: "Otro", value: "other", next: askContact }
  ]);
}

/* ---------------------------
   PITCHES DE VENTA
--------------------------- */
const pitches = {
  salud: `En consultorios y clínicas la automatización con IA puede contestar llamadas por voz o mensajes de texto, agendar citas y confirmar consultas 24/7, enviar recordatorios a los pacientes (disminuyendo cancelaciones), llevar un control de expedientes, cobrar consultas por adelantado, dar seguimiento y enviar felicitaciones.<br><br>Puede aumentar el número de pacientes exponencialmente y atraer pacientes con mayor poder adquisitivo, elevando sustancialmente el ticket promedio.<br><br>¿Si la implementación fuera 100% accesible a su economía y garantizara recuperar su inversión en un máximo de 3 meses, estaría listo(a) para decidir hoy?`,
  juridico: `Licenciado/a, en su profesión la confianza, velocidad y resultados lo son todo. Con IA puede lograr:<br>✅ Más casos sin invertir más tiempo<br>✅ Filtro automático de prospectos con capacidad económica real<br>✅ Control total de expedientes<br><br>Además, la automatización atrae clientes con mayor poder adquisitivo y eleva sustancialmente el ticket promedio.<br><br>¿Si la implementación fuera 100% accesible... decidiría hoy?`,
  realestate: `Agente Inmobiliario, la competencia es feroz. Con IA obtiene:<br>✅ Prospectos calificados<br>✅ Captación de propiedades premium<br>✅ Exclusividades listas para vender<br>✅ Citas automáticas<br><br>Además, la IA filtra propiedades con documentos en regla y evita perder tiempo con inmuebles irregulares.<br><br>¿Si la implementación fuera 100% accesible... decidiría hoy?`,
  food: `En su negocio, cada mensaje es una venta potencial. Nuestra IA trabaja 24/7:<br>✅ Responde al instante<br>✅ Agenda reservaciones<br>✅ Recomienda platillos<br><br>Además, atrae comensales con mayor poder adquisitivo y eleva el ticket promedio.<br><br>¿Si la implementación fuera 100% accesible... decidiría hoy?`,
  edu: `Director/a o Profesor/a, hoy los alumnos deciden rápido. Nuestra IA:<br>✅ Responde dudas sobre costos<br>✅ Agenda visitas<br>✅ Retiene alumnos<br><br>Atrae familias con mayor poder adquisitivo y eleva las colegiaturas promedio.<br><br>¿Si la implementación fuera 100% accesible... decidiría hoy?`,
  content: `Tu marca puede multiplicar ingresos sin saturarte. La IA:<br>✅ Convierte seguidores en clientes<br>✅ Crea contenido optimizado<br>✅ Automatiza ventas digitales<br><br>Además, atrae clientes con mayor poder adquisitivo y eleva tus ingresos por cliente.<br><br>¿Si la implementación fuera 100% accesible... decidirías hoy?`,
  retail: `En comercio la venta ocurre en segundos. La IA:<br>✅ Responde al instante<br>✅ Muestra catálogo<br>✅ Cobra sola<br><br>Además, la automatización atrae compradores con mayor poder adquisitivo y eleva sustancialmente el ticket promedio.<br><br>¿Si la implementación fuera 100% accesible... decidirías hoy?`,
  freelance: `Su tiempo es dinero. La IA:<br>✅ Consigue clientes premium<br>✅ Hace seguimiento sin esfuerzo<br>✅ Maximiza ingresos con agenda inteligente<br><br>Además, atrae clientes con mayor poder adquisitivo y eleva sus honorarios promedio.<br><br>¿Si la implementación fuera 100% accesible... decidiría hoy?`,
  beauty: `Cuando alguien busca un servicio de belleza, decide en minutos. La IA:<br>✅ Responde al instante<br>✅ Agenda citas sola<br>✅ Envía recordatorios y reduce cancelaciones<br><br>Además, atrae clientes con mayor poder adquisitivo y eleva el ticket promedio.<br><br>¿Si la implementación fuera 100% accesible... decidiría hoy?`
};

function showPitch(industry) {
  lead.industry = industry;
  addMessage(pitches[industry]);
  addOptions([
    { label: "✅ Sí", value: "yes", next: askContact },
    { label: "🤔 Lo tengo que pensar", value: "think", next: askAuthority },
    { label: "❄️ No es prioridad", value: "no", next: shareWhatsapp }
  ]);
}

/* ---------------------------
   AUTORIDAD Y CONTACTO
--------------------------- */
function askAuthority() {
  addMessage("¿Qué porcentaje de la decisión depende de usted?");
  addOptions([
    { label: "Menos del 50%", value: "low", next: shareWhatsapp },
    { label: "50% o más", value: "high", next: askContact }
  ]);
}

function askContact() {
  addMessage("¡Excelente! 🚀<br>Para agendar su asesoría gratuita necesito su email y teléfono:");
  currentStep = captureContact;
}

function captureContact() {
  const input = inputField.value.trim();
  if (!input) return;
  addMessage(input, "user");
  if (!lead.email) {
    lead.email = input;
    inputField.value = "";
    addMessage("Ahora, por favor escriba su número telefónico:");
  } else if (!lead.phone) {
    lead.phone = input;
    inputField.value = "";
    sendLeadData();
  }
}

/* ---------------------------
   ENVÍO DE DATOS A N8N + EMAIL
--------------------------- */
function sendLeadData() {
  fetch("https://heliosailabs369.app.n8n.cloud/webhook/chatbot-groq", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(lead)
  })
    .then(() => {
      addMessage("📨 Información enviada correctamente a Helios AI Labs. Un asesor se pondrá en contacto con usted en breve. 🙌");
    })
    .catch(() => {
      addMessage("⚠️ Hubo un error al enviar la información. Por favor, intente nuevamente.");
    });
}

function shareWhatsapp() {
  addMessage("Perfecto. Puede escribirnos directamente por WhatsApp: 👉 <b>+52 771 762 2360</b><br>¡Excelente día!");
}

/* ---------------------------
   CONTROL DE INPUT
--------------------------- */
sendBtn.onclick = submitText;
inputField.addEventListener("keydown", e => {
  if (e.key === "Enter") submitText();
});

function submitText() {
  if (!currentStep) return;
  currentStep();
}

/* ---------------------------
   INICIO
--------------------------- */
startChat();
