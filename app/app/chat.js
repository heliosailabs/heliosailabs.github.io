const messagesContainer = document.getElementById("messages");
const inputField = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");

function addMessage(text, sender = "bot") {
  const message = document.createElement("div");
  message.classList.add("message", sender);
  message.innerHTML = text;
  messagesContainer.appendChild(message);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Renderizar opciones clicables
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

// Flujo inicial
function startChat() {
  addMessage("¡Hola! Soy Helios, el agente inteligente de Helios AI Labs. ¿Con quién tengo el gusto?");
  currentStep = askFirstQuestion;
}

function askFirstQuestion() {
  addMessage("Para brindarte la mejor atención: ¿Qué información deseas?");
  addOptions([
    { label: "A) ¿Cómo funciona la IA para mi negocio?", value: "A", next: askIndustry },
    { label: "B) Información de la empresa", value: "B", next: companyInfo },
    { label: "C) ¿Por qué adoptar IA hoy?", value: "C", next: pitchWhyNow },
    { label: "D) Costos y ROI", value: "D", next: pitchROI },
    { label: "E) Todas las anteriores", value: "E", next: askIndustryHotLead }
  ]);
}

function askIndustry() {
  addMessage("¿En qué giro se encuentra tu negocio?");
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

function finishIndustry() {
  addMessage("Perfecto. Gracias por la información. ✅\nAhora te presentaré cómo la IA transforma tu sector en 2025...");
  setTimeout(() => pitchIndustry(), 1200);
}

// ---------------- PITCH TEMPORAL (Placeholder) ----------------
function pitchIndustry() {
  addMessage("⚠️ PITCH PERSONALIZADO EN CONSTRUCCIÓN ⚠️\n🧠💰 Aquí va el discurso matador según el giro elegido.");
  setTimeout(() => askCloseQuestion(), 1500);
}

// ---------------- CIERRE ----------------
function askCloseQuestion() {
  addMessage("De 1 a 10 ¿qué tan listo estás para implementar IA en tu negocio y triplicar ingresos en 90 días?");
  addOptions([
    { label: "9 - 10 ✅ Listo para invertir", value: "hot", next: askContact },
    { label: "5 - 8 🤔 Lo tengo que pensar", value: "warm", next: askAuthorityCheck },
    { label: "1 - 4 ❄️ Curioso/no es prioridad", value: "cold", next: shareWhatsapp }
  ]);
}

function askAuthorityCheck() {
  addMessage("¿Qué porcentaje de la decisión depende de ti?");
  addOptions([
    { label: "Menos del 50%", value: "lowAuth", next: shareWhatsapp },
    { label: "50% o más", value: "medAuth", next: pitchMidAuthority }
  ]);
}

function pitchMidAuthority() {
  addMessage("Cada decisión que tomas impulsa tu éxito… y esta puede ser la que cambie tu negocio para siempre.\n📌 Si fuera totalmente accesible para ti… ¿decidirías hoy?");
  addOptions([
    { label: "Sí ✅", value: "yesDeal", next: askContact },
    { label: "No ❌", value: "noDeal", next: shareWhatsapp }
  ]);
}

function askContact() {
  addMessage("¡Excelente! 🚀\nSolo necesito tu email y teléfono para agendar tu asesoría personalizada:");
}

// Si NO es decisor o no está listo
function shareWhatsapp() {
  addMessage("Perfecto. Te dejo nuestro WhatsApp directo:\n👉 +52 771 762 2360\n📌 Escríbenos cuando estés listo.\n¡Que tengas un excelente día! ☀️");
}

function companyInfo() {
  addMessage("📍 Helios AI Labs\nInnovación con ROI garantizado.\n(Información completa de empresa vendrá aquí)");
}

function pitchWhyNow() {
  addMessage("🌎 La adopción de IA ya está redefiniendo los negocios en México…\n(Sección en construcción)");
}

function pitchROI() {
  addMessage("📊 Recupera tu inversión en máximo 90 días.\n(Más información pronto)");
}

// Captura de texto manual
inputField.addEventListener("keydown", e => {
  if (e.key === "Enter") submitText();
});
sendBtn.onclick = submitText;

function submitText() {
  const text = inputField.value.trim();
  if (!text) return;
  addMessage(text, "user");
  inputField.value = "";
  if (currentStep) currentStep();
}

let currentStep = null;

// Inicio
startChat();

