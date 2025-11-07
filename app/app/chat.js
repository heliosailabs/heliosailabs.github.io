/* Helios AI Labs - Chatbot Comercial Shark 🦈 */

const messagesContainer = document.getElementById("messages");
const inputField = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");

// ================= UTILIDADES =================

function addMessage(text, sender = "bot") {
  const message = document.createElement("div");
  message.classList.add("message", sender);
  message.innerHTML = text.replace(/\n/g, "<br>");
  messagesContainer.appendChild(message);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function addOptions(options) {
  const wrapper = document.createElement("div");
  wrapper.classList.add("message", "bot");

  options.forEach(opt => {
    const btn = document.createElement("button");
    btn.classList.add("option-btn");
    btn.innerText = opt.label;
    btn.onclick = () => opt.next();
    wrapper.appendChild(btn);
  });

  messagesContainer.appendChild(wrapper);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// ================= FLUJO =================

function startChat() {
  addMessage("¡Hola! 👋 Soy Helios, asesor inteligente de Helios AI Labs.\n¿Con quién tengo el gusto?");
  currentStep = askUserTitle;
}

function askUserTitle() {
  addMessage("¿Cómo prefiere que me dirija a usted? Elija una opción 👇");
  addOptions([
    { label: "Dr./Dra.", next: () => saveTitle("Dr.") },
    { label: "Lic.", next: () => saveTitle("Lic.") },
    { label: "Ing.", next: () => saveTitle("Ing.") },
    { label: "Arq.", next: () => saveTitle("Arq.") },
    { label: "C.P.", next: () => saveTitle("C.P.") },
    { label: "Otro", next: () => saveTitle("") }
  ]);
}

let userTitle = "";

function saveTitle(title) {
  userTitle = title;
  askMainQuestion();
}

function askMainQuestion() {
  addMessage(`${userTitle} Para brindarle la mejor atención:\n¿Qué información desea conocer?`);
  addOptions([
    {
      label: "A) ¿Cómo funciona la IA para mi negocio?",
      next: () => askIndustry()
    },
    {
      label: "B) Info de empresa",
      next: () => companyInfo()
    },
    {
      label: "C) ¿Por qué adoptar IA hoy?",
      next: () => pitchWhyNow()
    },
    {
      label: "D) Costos y ROI",
      next: () => pitchROI()
    },
    {
      label: "E) Todo",
      next: () => askIndustry(true)
    }
  ]);
}

// ============ Industria Selección ============

let fullPitchMode = false;

function askIndustry(everything = false) {
  fullPitchMode = everything;
  addMessage(`Perfecto ${userTitle}, ¿en qué giro se encuentra su negocio?`);
  addOptions([
    { label: "Salud", next: () => pitchIndustry("salud") },
    { label: "Jurídico", next: () => pitchIndustry("juridico") },
    { label: "Restaurante / Cafetería", next: () => pitchIndustry("foods") },
    { label: "Inmobiliario", next: () => pitchIndustry("realestate") },
    { label: "Educación", next: () => pitchIndustry("edu") },
    { label: "Contenido / Creativo", next: () => pitchIndustry("content") },
    { label: "Comercio", next: () => pitchIndustry("retail") },
    { label: "Profesional Independiente", next: () => pitchIndustry("freelance") },
    { label: "Belleza / Spa", next: () => pitchIndustry("beauty") },
    { label: "Otro", next: () => pitchIndustry("other") }
  ]);
}

// ============ PITCHS PERSONALIZADOS ============

function pitchIndustry(ind) {
  const pitch = {
    salud: `En consultorios y clínicas la automatización con IA puede contestar llamadas, agendar citas y confirmar consultas 24/7.\nLlevar expedientes, cobrar consultas por adelantado y dar seguimiento a casos.\nAdemás puede atraer pacientes de mayor poder adquisitivo y aumentar la cantidad de consultas sin aumentar su carga de trabajo.`,

    juridico: `La IA puede captar clientes 24/7, organizar expedientes, priorizar casos urgentes, automatizar contratos y aumentar clientes con mayor poder adquisitivo.\nUsted se enfoca en ganar casos, no en gestionar papeleo.`,

    foods: `La automatización atrae clientes de alto valor, toma pedidos online, confirma reservaciones, evita cancelaciones y aumenta el ticket promedio con ventas adicionales automáticas. Todo operando 24/7.`,

    realestate: `La IA puede generar clientes listos para comprar, filtrar prospectos por capacidad real de pago y conseguir propiedades exclusivas con documentación en regla. Usted se dedica solo a cerrar ventas.`,

    edu: `La IA atrae alumnos, automatiza inscripciones, pagos, recordatorios y seguimiento de padres y estudiantes.\nMejora la retención y multiplica ingresos sin aumentar personal.`,

    content: `La IA convierte audiencia en clientes, automatiza ventas mientras duerme, agenda sesiones y analiza comportamiento. Sus ingresos crecen sin aumentar su tiempo de trabajo.`,

    retail: `La IA automatiza ventas desde el primer contacto hasta el pago, recomienda productos y optimiza inventarios.\nSu tienda genera dinero 24/7, incluso mientras duerme.`,

    freelance: `La IA consigue clientes, organiza agenda, envía cotizaciones, cobra anticipos y gestiona proyectos.\nUsted deja de perseguir clientes: los clientes llegan a usted.`,

    beauty: `La IA llena su agenda, envía recordatorios, evita huecos, crea promociones inteligentes y fideliza clientes VIP.\nEleva el ticket promedio y los ingresos del negocio.`,

    other: `La IA automatiza tareas repetitivas, incrementa ingresos, reduce costos y le devuelve tiempo.\nSu negocio trabaja para usted, no usted para su negocio.`
  };

  addMessage(pitch[ind]);

  setTimeout(() => closingQuestion(), 1200);
}

// ============ CIERRE UNIVERSAL ============

function closingQuestion() {
  addMessage(
    "Si la implementación fuera 100% accesible a su economía y garantizara recuperar su inversión en un máximo de 3 meses…\n¿estaría listo(a) para decidir hoy?"
  );

  addOptions([
    { label: "✅ Sí", next: askContact },
    { label: "🤔 Lo tengo que pensar", next: askAuthorityCheck },
    { label: "❄️ No es prioridad", next: shareWhatsapp }
  ]);
}

function askAuthorityCheck() {
  addMessage("¿Qué porcentaje de la decisión depende de usted?");
  addOptions([
    { label: "Menos de 50%", next: shareWhatsapp },
    { label: "50% o más", next: pitchMotivation }
  ]);
}

function pitchMotivation() {
  addMessage(
    `${userTitle} Usted ha tomado decisiones importantes toda su vida.\nEsta es una decisión más…\nSi fuera 100% accesible para usted… ¿decidiría hoy?`
  );
  addOptions([
    { label: "Sí ✅", next: askContact },
    { label: "No ❌", next: shareWhatsapp }
  ]);
}

// ============ DATOS DE CONTACTO ============

function askContact() {
  addMessage(
    "¡Excelente! 🚀\nSolo necesito su email y teléfono para agendar su asesoría personalizada:"
  );
}

// ============ SALIDA FRÍA ============

function shareWhatsapp() {
  addMessage(
    "Perfecto. Le dejo nuestro WhatsApp directo:\n👉 +52 771 762 2360\n📌 Escríbanos cuando esté listo(a).\n¡Excelente día!"
  );
}

// ============ INFORMACIÓN DE EMPRESA ============

function companyInfo() {
  addMessage("📍 Helios AI Labs\nInnovación con ROI garantizado.\n[INFO EMPRESA AQUÍ]");
}

// ============ OTROS PITCH ADICIONALES ============

function pitchWhyNow() {
  addMessage("🌎 La IA redefine negocios en México.\nAdoptarla hoy es multiplicar ingresos y reducir costos.\nEsperar es perder mercado.");
}

function pitchROI() {
  addMessage("📊 Recupera su inversión en máximo 90 días.\nROI garantizado por contrato.\nConsultoría incluida.");
}

// ============ INPUT MANUAL ============

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

startChat();
