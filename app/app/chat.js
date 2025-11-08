/* Helios AI Labs - Chatbot Comercial Shark 🦈 (VERSIÓN CORREGIDA) */

const messagesContainer = document.getElementById("messages");
const inputField = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");

// ================= DATOS DEL LEAD =================
let leadData = {
  name: null,
  title: null,      // Dr., Dra., Lic., etc.
  gender: null,     // "m" o "f"
  industry: null,
  email: null,
  phone: null,
  responses: []
};

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
    btn.onclick = () => {
      addMessage(opt.label, "user"); // Mostrar selección del usuario
      leadData.responses.push({ option: opt.label, ts: new Date().toISOString() });
      opt.next();
    };
    wrapper.appendChild(btn);
  });

  messagesContainer.appendChild(wrapper);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// ================= DETECCIÓN INTELIGENTE DE NOMBRE =================

function detectNameAndTitle(text) {
  const lowerText = text.toLowerCase();
  
  // Patrones de detección
  const patterns = [
    { regex: /(?:soy|me llamo|mi nombre es)\s+((?:dr\.|dra\.|lic\.|ing\.|arq\.|c\.?p\.|mtro\.|mtra\.|prof\.|profa\.|chef|coach|don|doña)\s+[\w\s]+)/i, extract: true },
    { regex: /(dr\.|dra\.|lic\.|ing\.|arq\.|c\.?p\.|mtro\.|mtra\.|prof\.|profa\.|chef|coach|don|doña)\s+([\w\s]+)/i, extract: true }
  ];

  for (let pattern of patterns) {
    const match = text.match(pattern.regex);
    if (match) {
      const fullName = match[1].trim();
      const titleMatch = fullName.match(/(dr\.|dra\.|lic\.|ing\.|arq\.|c\.?p\.|mtro\.|mtra\.|prof\.|profa\.|chef|coach|don|doña)/i);
      
      if (titleMatch) {
        const detectedTitle = titleMatch[1];
        const name = fullName.replace(detectedTitle, "").trim();
        
        // Determinar género
        const feminineTitles = ["dra.", "mtra.", "profa.", "doña"];
        const gender = feminineTitles.includes(detectedTitle.toLowerCase()) ? "f" : "m";
        
        return {
          name: name || fullName,
          title: detectedTitle.replace(".", ""),
          gender: gender
        };
      }
    }
  }
  
  // Si no hay título, extraer nombre simple
  const simpleMatch = text.match(/(?:soy|me llamo)\s+([\w\s]{2,30})/i);
  if (simpleMatch) {
    return {
      name: simpleMatch[1].trim(),
      title: null,
      gender: null
    };
  }
  
  return null;
}

// ================= FLUJO =================

function startChat() {
  addMessage("¡Hola! 👋 Soy Helios, asesor inteligente de Helios AI Labs.\n¿Con quién tengo el gusto?");
  currentStep = "receiveName";
}

// ================= MANEJO DE INPUT =================

inputField.addEventListener("keydown", e => {
  if (e.key === "Enter") submitText();
});
sendBtn.onclick = submitText;

function submitText() {
  const text = inputField.value.trim();
  if (!text) return;
  
  addMessage(text, "user");
  leadData.responses.push({ text, ts: new Date().toISOString() });
  inputField.value = "";

  // Routing según paso actual
  if (currentStep === "receiveName") {
    handleNameInput(text);
  } else if (currentStep === "receiveContact") {
    handleContactInput(text);
  }
}

function handleNameInput(text) {
  const detected = detectNameAndTitle(text);
  
  if (detected) {
    leadData.name = detected.name;
    leadData.title = detected.title;
    leadData.gender = detected.gender;
    
    currentStep = null;
    
    // Saludo personalizado
    const greeting = leadData.title 
      ? `Excelente ${leadData.title}${leadData.gender === "f" ? "a" : ""} ${leadData.name}. Gracias.`
      : `Excelente ${leadData.name}. Gracias.`;
    
    addMessage(greeting);
    
    setTimeout(() => askMainQuestion(), 800);
  } else {
    // Nombre sin título detectado
    leadData.name = text;
    askUserTitle();
  }
}

function handleContactInput(text) {
  // Parsear email y teléfono
  const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w+/);
  const phoneMatch = text.match(/\+?[\d\s()-]{10,}/);
  
  if (emailMatch) leadData.email = emailMatch[0];
  if (phoneMatch) leadData.phone = phoneMatch[0].replace(/\s/g, "");
  
  if (leadData.email && leadData.phone) {
    addMessage("¡Perfecto! En breve recibirá confirmación por email. Gracias por su confianza. 🚀");
    currentStep = null;
    // Aquí enviarías a webhook/n8n
  } else {
    addMessage("Por favor proporcione email y teléfono válidos.\nEj: correo@ejemplo.com, +52 771 123 4567");
  }
}

// ================= SELECCIÓN DE TÍTULO (si no detectó automáticamente) =================

function askUserTitle() {
  addMessage("¿Cómo prefiere que me dirija a usted? Elija una opción 👇");
  addOptions([
    { label: "Dr.", next: () => saveTitle("Dr", "m") },
    { label: "Dra.", next: () => saveTitle("Dra", "f") },
    { label: "Lic.", next: () => saveTitle("Lic", "m") },
    { label: "Ing.", next: () => saveTitle("Ing", "m") },
    { label: "Arq.", next: () => saveTitle("Arq", "m") },
    { label: "C.P.", next: () => saveTitle("CP", "m") },
    { label: "Sin título", next: () => saveTitle(null, null) }
  ]);
}

function saveTitle(title, gender) {
  leadData.title = title;
  leadData.gender = gender;
  askMainQuestion();
}

// ================= MENÚ PRINCIPAL =================

function askMainQuestion() {
  const address = leadData.title 
    ? `${leadData.title}${leadData.gender === "f" ? "a" : ""}.`
    : (leadData.name || "");
  
  addMessage(`${address} Para brindarle la mejor atención:\n¿Qué información desea conocer?`);
  addOptions([
    { label: "A) ¿Cómo funciona la IA para mi negocio?", next: () => askIndustry(false) },
    { label: "B) Info de empresa", next: () => companyInfo() },
    { label: "C) ¿Por qué adoptar IA hoy?", next: () => pitchWhyNow() },
    { label: "D) Costos y ROI", next: () => pitchROI() },
    { label: "E) Todo", next: () => askIndustry(true) }
  ]);
}

// ============ Industria Selección ============

let fullPitchMode = false;

function askIndustry(everything = false) {
  fullPitchMode = everything;
  
  const address = leadData.title 
    ? `${leadData.title}${leadData.gender === "f" ? "a" : ""},`
    : "";
  
  addMessage(`Perfecto ${address} ¿en qué giro se encuentra su negocio?`);
  addOptions([
    { label: "Salud", next: () => { leadData.industry = "salud"; pitchIndustry("salud"); } },
    { label: "Jurídico", next: () => { leadData.industry = "juridico"; pitchIndustry("juridico"); } },
    { label: "Restaurante / Cafetería", next: () => { leadData.industry = "foods"; pitchIndustry("foods"); } },
    { label: "Inmobiliario", next: () => { leadData.industry = "realestate"; pitchIndustry("realestate"); } },
    { label: "Educación", next: () => { leadData.industry = "edu"; pitchIndustry("edu"); } },
    { label: "Contenido / Creativo", next: () => { leadData.industry = "content"; pitchIndustry("content"); } },
    { label: "Comercio", next: () => { leadData.industry = "retail"; pitchIndustry("retail"); } },
    { label: "Profesional Independiente", next: () => { leadData.industry = "freelance"; pitchIndustry("freelance"); } },
    { label: "Belleza / Spa", next: () => { leadData.industry = "beauty"; pitchIndustry("beauty"); } },
    { label: "Otro", next: () => { leadData.industry = "other"; pitchIndustry("other"); } }
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
  const address = leadData.title 
    ? `${leadData.title}${leadData.gender === "f" ? "a" : ""}.`
    : "";
  
  addMessage(
    `${address} Usted ha tomado decisiones importantes toda su vida.\nEsta es una decisión más…\nSi fuera 100% accesible para usted… ¿decidiría hoy?`
  );
  addOptions([
    { label: "Sí ✅", next: askContact },  // ✅ CORREGIDO
    { label: "No ❌", next: shareWhatsapp }
  ]);
}

// ============ DATOS DE CONTACTO ============

function askContact() {
  addMessage(
    "¡Excelente! 🚀\nPara agendar su asesoría gratuita de 20 minutos, proporcione:\n\n📧 Email\n📱 Teléfono\n\nEj: correo@ejemplo.com, +52 771 123 4567"
  );
  currentStep = "receiveContact";
}

// ============ SALIDA FRÍA ============

function shareWhatsapp() {
  addMessage(
    "Perfecto. Le dejo nuestro WhatsApp directo:\n👉 +52 771 762 2360\n📌 Escríbanos cuando esté listo(a).\n¡Excelente día!"
  );
}

// ============ INFORMACIÓN DE EMPRESA ============

function companyInfo() {
  addMessage("📍 Helios AI Labs\n22 años de experiencia.\nGarantía PROFECO.\nRecuperación de inversión garantizada en máx. 90 días.");
  setTimeout(() => askMainQuestion(), 2000);
}

// ============ OTROS PITCH ADICIONALES ============

function pitchWhyNow() {
  addMessage("🌎 La IA redefine negocios en México.\nAdoptarla hoy es multiplicar ingresos y reducir costos.\nEsperar es perder mercado.");
  setTimeout(() => askMainQuestion(), 2000);
}

function pitchROI() {
  addMessage("📊 Recupera su inversión en máximo 90 días.\nROI garantizado por contrato.\nConsultoría incluida.");
  setTimeout(() => askMainQuestion(), 2000);
}

// ============ INICIO ============

let currentStep = null;
startChat();
