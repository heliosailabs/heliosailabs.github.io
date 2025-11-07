/* ============================================================
   Helios ChatBot - Versión Paso 2 (Parcial)
   Flujo principal + 2 giros de ejemplo: Salud, Despacho Jurídico
   Preserva texto y orden tal como en el documento de Atenea.
   ============================================================ */

const WEBHOOK_URL = "https://heliosailabs369.app.n8n.cloud/webhook/chatbot-groq";

/* DOM refs */
const messagesContainer = document.getElementById("messages");
const inputField = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");

/* Session & lead */
function genSessionId() {
  let s = localStorage.getItem("helios_sessionId");
  if (!s) {
    s = `sess_${Date.now()}_${Math.floor(Math.random()*10000)}`;
    localStorage.setItem("helios_sessionId", s);
  }
  return s;
}
const sessionId = genSessionId();

let leadData = {
  name: null,
  phone: null,
  email: null,
  negocio: null,
  subcategory: null,
  decisionPower: null,
  interestLevel: null,
  responses: []
};

/* Control flow */
let currentStep = null; // can be a function or a keyword
let optionsVisible = false;
let lastOptionsWrapper = null;

/* ---------------- UI helpers ---------------- */
function addMessage(text, sender = "bot") {
  const el = document.createElement("div");
  el.classList.add("message", sender);
  el.innerHTML = text.replace(/\n/g, "<br/>");
  messagesContainer.appendChild(el);
  // small fade-in
  setTimeout(() => {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }, 80);
  return el;
}

/* lock/unlock input when options are visible */
function lockInput(placeholderText = "Selecciona una opción desde las burbujas...") {
  optionsVisible = true;
  inputField.disabled = true;
  inputField.placeholder = placeholderText;
  if (sendBtn) sendBtn.disabled = true;
}
function unlockInput() {
  optionsVisible = false;
  inputField.disabled = false;
  inputField.placeholder = "Escribe aquí...";
  if (sendBtn) sendBtn.disabled = false;
  lastOptionsWrapper = null;
}

/* ---------------- Options renderer (burbujas) ---------------- */
/*
  options: { prompt?: string, items: [{ label, value?, next }] }
  next can be a function reference or string mapping to a handler
*/
function addOptions(options) {
  const wrapper = document.createElement("div");
  wrapper.classList.add("message", "bot");

  if (options.prompt) {
    const promptEl = document.createElement("div");
    promptEl.innerHTML = options.prompt;
    wrapper.appendChild(promptEl);
  }

  const row = document.createElement("div");
  row.classList.add("option-row");

  options.items.forEach((opt, idx) => {
    const btn = document.createElement("button");
    btn.classList.add("option-btn");
    btn.type = "button";
    btn.innerText = opt.label; // PRESERVAR EXACTAMENTE texto

    btn.addEventListener("click", () => {
      // Visual: user message bubble with exact label
      addMessage(opt.label, "user");

      // Save response
      leadData.responses.push({ option: opt.value || opt.label, label: opt.label, ts: new Date().toISOString() });

      // Prevent double-clicks
      Array.from(row.querySelectorAll("button")).forEach(b => b.disabled = true);

      // Unlock input in case next step requires typed input (handlers decide)
      unlockInput();

      // Small delay for UX
      setTimeout(() => {
        if (typeof opt.next === "function") {
          try { opt.next(opt.value); } catch (e) { console.error(e); }
        } else if (typeof opt.next === "string") {
          // map string to handler if exists
          const mapping = {
            askGiro: askGiro,
            handleThink: handleThink,
            handleConsult: handleConsult,
            openContactCapture: openContactCapture,
            askForEmailToSendPres: askForEmailToSendPres,
            askInterestAndDecision: askInterestAndDecision,
            companyInfo: companyInfo,
            pitchWhyNow: pitchWhyNow,
            pitchROI: pitchROI,
            askIndustryHotLead: askIndustryHotLead
          };
          if (mapping[opt.next]) mapping[opt.next](opt.value);
          else askMainMenu();
        } else {
          askMainMenu();
        }
      }, 220);
    });

    row.appendChild(btn);
  });

  wrapper.appendChild(row);
  messagesContainer.appendChild(wrapper);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  lastOptionsWrapper = wrapper;
  lockInput();
}

/* ---------------- Basic flow handlers (texto exacto del documento) ---------------- */

/* START: saludo inicial (el documento con Atenea indicaba este flujo inicial) */
function startChat() {
  // Usamos texto del documento:
  addMessage("Gracias por contactarnos, somos Helios AI Labs. Para proporcionarle la mejor atención, personalizada y diseñar para usted un traje a la medida ¿Cual de las siguientes preguntas desea que respondamos para usted?");
  // presentamos opciones EXACTAS (A..E)
  setTimeout(() => {
    addOptions({
      items: [
        { label: "A) ¿Cómo funciona la automatización de procesos con IA y qué beneficios medibles puede aportar a mi negocio?", value: "A", next: askGiroFromA },
        { label: "B) Quiero información sobre su empresa, ubicación, experiencia, credenciales, referencias, información fiscal, contrato, garantía por escrito, etc.", value: "B", next: companyInfo },
        { label: "C) ¿Por qué adoptar Inteligencia Artificial hoy es tan importante y cuales son los escenarios para mi negocio sí decido esperar más tiempo?", value: "C", next: pitchWhyNow },
        { label: "D) ¿Cuanto cuesta implementar IA en mi negocio y en cuanto tiempo recuperaré mi inversión? ¿Tienen promociones?", value: "D", next: pitchROI },
        { label: "E) Todas las anteriores", value: "E", next: askIndustryHotLead }
      ]
    });
  }, 500);

  // After asking first menu, next user step is not typed: name still needed before addressing with title, so ask for name next?
  // According to doc, AFTER greeting bot should ask for name and then proceed. We'll ask for name first before main options.
  // But preserving sequence of doc: the doc shows initial question then proceed; to be safe we'll ask name first, then re-show the menu.
  setTimeout(() => {
    addMessage("¿Cómo se llama? (por ejemplo: Dra. Pérez)");
    currentStep = receiveName;
    unlockInput(); // allow name typing
  }, 1000);
}

/* HANDLE: receive name typed */
function receiveName() {
  // placeholder - actual processing is in submitText
  // kept for clarity
  currentStep = null;
}

/* When A chosen: ask giro (negocio) and subcategories */
function askGiroFromA() {
  addMessage("Para responder a su pregunta, con la atención que usted se merece, por favor digame: ¿En cual de los siguientes giros se encuentra su negocio?");
  // use 'negocio' wording as you specified
  setTimeout(() => {
    addOptions({
      items: [
        { label: "A) Salud", value: "salud", next: askGiroSalud },
        { label: "B) Despacho Juridico", value: "juridico", next: askGiroJuridico },
        { label: "C) Restaurante o Cafetería", value: "foods", next: askGiroGeneric },
        { label: "D) Sector inmobiliario", value: "realestate", next: askGiroGeneric },
        { label: "E) Educación", value: "edu", next: askGiroGeneric },
        { label: "F) Creación de contenido", value: "content", next: askGiroGeneric },
        { label: "G) Comercio (minorista / mayorista)", value: "retail", next: askGiroGeneric },
        { label: "H) Profesional independiente", value: "freelance", next: askGiroGeneric },
        { label: "I) Belleza", value: "beauty", next: askGiroGeneric },
        { label: "J) Otro", value: "other", next: askGiroGeneric }
      ]
    });
  }, 450);
}

/* Ejemplo GIRo: SALUD — subcategorías y pitch específico */
function askGiroSalud() {
  leadData.negocio = "Salud";
  addMessage("¿Cuál de las siguientes describe mejor su negocio en Salud?");
  setTimeout(() => {
    addOptions({
      items: [
        { label: "Consultorio propio", value: "consultorio", next: () => renderPitchFor('salud','consultorio') },
        { label: "Clinica", value: "clinica", next: () => renderPitchFor('salud','clinica') },
        { label: "Veterinaria", value: "veterinaria',", next: () => renderPitchFor('salud','veterinaria') },
        { label: "Hospital", value: "hospital", next: () => renderPitchFor('salud','hospital') },
        { label: "Otro", value: "otro_salud", next: () => renderPitchFor('salud','otro') }
      ]
    });
  }, 400);
}

/* Ejemplo GIRo: JURIDICO — subcategorías y pitch */
function askGiroJuridico() {
  leadData.negocio = "Despacho Juridico";
  addMessage("¿Cuál de las siguientes describe mejor su despacho jurídico?");
  setTimeout(() => {
    addOptions({
      items: [
        { label: "Pequeño despacho (1-3 abogados)", value: "small_despacho", next: () => renderPitchFor('juridico','small') },
        { label: "Despacho mediano", value: "med_despacho", next: () => renderPitchFor('juridico','med') },
        { label: "Despacho grande", value: "large_despacho", next: () => renderPitchFor('juridico','large') },
        { label: "Otro", value: "otro_juridico", next: () => renderPitchFor('juridico','otro') }
      ]
    });
  }, 400);
}

/* Generic placeholder for other giros (we keep text but not full content now) */
function askGiroGeneric(val) {
  leadData.negocio = val || "Otro";
  addMessage("Gracias — estamos registrando su selección. (Esta rama está en modo demostración; integraremos su pitch específico en la siguiente iteración).");
  setTimeout(() => askInterestAndDecision(), 1000);
}

/* ---------------- renderPitchFor: inserta un pitch demo conservando tono ---------------- */
function renderPitchFor(giro, subcat) {
  // Guardar subcategoria exacta
  leadData.subcategory = `${giro} / ${subcat}`;
  // Insertamos un pitch de ejemplo basado en el documento (texto resumido para demo)
  if (giro === 'salud') {
    addMessage("👨‍⚕️ En consultorios y clínicas, la IA permite agendado 24/7, recordatorios, filtrado de pacientes y aumentar ticket promedio. ¿Le interesaría que le agendemos una asesoría gratuita de 20 min para ver números concretos?");
  } else if (giro === 'juridico') {
    addMessage("⚖️ En despachos, la IA filtra casos, automatiza seguimientos y eleva el valor de cada cliente. ¿Le interesa agendar una asesoría gratuita de 20 min?");
  } else {
    addMessage("🚀 La IA puede transformar su negocio: menos trabajo repetitivo y más ingresos. ¿Le interesa agendar una asesoría gratuita de 20 min?");
  }

  setTimeout(() => {
    addOptions({
      items: [
        { label: "Sí — Listo para contratar hoy", value: "yes_now", next: openContactCapture },
        { label: "Lo tengo que pensar", value: "think", next: handleThink },
        { label: "Lo tengo que consultar (socio/jefe)", value: "consult", next: handleConsult }
      ]
    });
  }, 600);
}

/* ---------------- Decision flow (calificación) ---------------- */

function askInterestAndDecision() {
  addMessage("Si la implementación fuera 100% accesible y garantizara recuperar su inversión en 3 meses, ¿estaría listo para decidir hoy?");
  setTimeout(() => {
    addOptions({
      items: [
        { label: "Sí — Listo para contratar hoy", value: "yes_now", next: openContactCapture },
        { label: "Lo tengo que pensar", value: "think", next: handleThink },
        { label: "Lo tengo que consultar (socio/jefe)", value: "consult", next: handleConsult }
      ]
    });
  }, 350);
}

function handleThink() {
  addMessage("Entiendo. ¿Qué porcentaje de la decisión depende de usted?");
  setTimeout(() => {
    addOptions({
      items: [
        { label: "Menos del 50%", value: "auth_lt50", next: offerPresentation },
        { label: "50% o más", value: "auth_gte50", next: offerPresentation }
      ]
    });
  }, 350);
}

function handleConsult() {
  addMessage("¿Desea que le enviemos una presentación por email o prefiere agendar una reunión con su decisor?");
  setTimeout(() => {
    addOptions({
      items: [
        { label: "Enviar presentación (email)", value: "send_pres", next: askForEmailToSendPres },
        { label: "Agendar reunión con decisor", value: "agendar_decisor", next: openContactCapture }
      ]
    });
  }, 350);
}

function offerPresentation() {
  addMessage("Perfecto. ¿Cuál email usamos para enviar la presentación?");
  currentStep = "receiveEmailToSendPresentation";
  unlockInput();
}

function askForEmailToSendPres() {
  addMessage("Ingrese por favor su email en el campo inferior y presione Enviar.");
  currentStep = "receiveEmailToSendPresentation";
  unlockInput();
}

/* ---------------- Contact capture flow (texto libre) ---------------- */
function openContactCapture() {
  addMessage("Perfecto. Para agendar necesito: Nombre, Teléfono (WhatsApp) y Email. Escriba todo en una sola línea separados por comas.\nEj.: Dra. Pérez, +52 1 771 123 4567, correo@ejemplo.com");
  currentStep = "receiveContactLine";
  unlockInput();
}

/* ---------------- Company info / pitch handlers (texto exacto del documento) ---------------- */
function companyInfo() {
  addMessage("Nombre comercial: Helios AI Labs. Ciudad / dirección: Corporativo Matriz: Río Lerma 232 piso 23 Col. Cuauhtemoc, Alcaldía Cuauhtemoc, CP 06500, CDMX. Sucursal Pachuca: Av. Revolución 300 Col. Periodista, CP 42060, Pachuca de Soto, Hidalgo.\nAños de experiencia / trayectoria breve: 22 años de experiencia en el sector empresarial mexicano y estadounidense. Garantía por escrito: Nuestro contrato está avalado por PROFECO y cuenta con todas las garantías de ley. Adicionalmente contamos con una garantía por escrito (incluida en el contrato), que protege a cada uno de nuestros clientes / inversores, para no pagar cuota mensual hasta recuperar su inversión inicial de \"set up\", en un plazo máximo de 3 meses.");
  setTimeout(() => askMainMenuAfterInfo(), 1500);
}

function pitchWhyNow() {
  addMessage("Adoptar Inteligencia Artificial hoy es importante porque acelera procesos, reduce errores y permite tomar decisiones basadas en datos. Esperar implica perder ventaja competitiva y clientes potenciales.");
  setTimeout(() => askMainMenuAfterInfo(), 1500);
}

function pitchROI() {
  addMessage("Los costos de implementación varían según alcance. Contamos con paquetes y financiamiento; muchas implementaciones recuperan la inversión en menos de 3 meses dependiendo del caso.");
  setTimeout(() => askMainMenuAfterInfo(), 1500);
}

function askIndustryHotLead() {
  addMessage("Perfecto — mostraré un pitch completo y un plan inmediato de acción.");
  // For the demo we redirect to contact capture
  setTimeout(() => openContactCapture(), 900);
}

function askMainMenuAfterInfo() {
  setTimeout(() => {
    // re-open main question while keeping user flow
    startChat(); // Reuse start to re-show first menu and then name/question
  }, 300);
}

/* ---------------- Submit text handler (name, email, contact) ---------------- */
sendBtn.addEventListener("click", submitText);
inputField.addEventListener("keydown", (e) => { if (e.key === "Enter") submitText(); });

async function submitText() {
  const textRaw = inputField.value || "";
  const text = textRaw.trim();
  if (!text) return;

  // If options visible, tell user to click
  if (optionsVisible) {
    addMessage("Por favor selecciona una de las opciones mostradas arriba.", "bot");
    return;
  }

  // show user bubble
  addMessage(text, "user");
  inputField.value = "";

  // store
  leadData.responses.push({ text, ts: new Date().toISOString() });

  // handle currentStep
  if (currentStep === "receiveName") {
    // minimal, conservative name extraction, but preserve original in responses
    let maybe = extractNameConservative(text);
    leadData.name = maybe || text;
    addMessage(`Excelente ${leadData.name}. Gracias.`);
    currentStep = null;
    // after name we show main menu again
    setTimeout(() => {
      // show the initial menu exactly as in document
      addMessage("Para proporcionarle la mejor atención, personalizada y diseñar para usted un traje a la medida ¿Cual de las siguientes preguntas desea que respondamos para usted?");
      setTimeout(() => {
        addOptions({
          items: [
            { label: "A) ¿Cómo funciona la automatización de procesos con IA y qué beneficios medibles puede aportar a mi negocio?", value: "A", next: askGiroFromA },
            { label: "B) Quiero información sobre su empresa, ubicación, experiencia, credenciales, referencias, información fiscal, contrato, garantía por escrito, etc.", value: "B", next: companyInfo },
            { label: "C) ¿Por qué adoptar Inteligencia Artificial hoy es tan importante y cuales son los escenarios para mi negocio sí decido esperar más tiempo?", value: "C", next: pitchWhyNow },
            { label: "D) ¿Cuanto cuesta implementar IA en mi negocio y en cuanto tiempo recuperaré mi inversión? ¿Tienen promociones?", value: "D", next: pitchROI },
            { label: "E) Todas las anteriores", value: "E", next: askIndustryHotLead }
          ]
        });
      }, 400);
    }, 600);
    return;
  }

  if (currentStep === "receiveEmailToSendPresentation") {
    leadData.email = text;
    await sendLeadToWebhook({ wantsPresentation: true });
    addMessage("Perfecto — le enviaremos la presentación a ese correo. Gracias.");
    currentStep = null;
    setTimeout(() => startChat(), 1000);
    return;
  }

  if (currentStep === "receiveContactLine") {
    const parts = text.split(",").map(s => s.trim());
    leadData.name = leadData.name || (parts[0] || "");
    leadData.phone = parts[1] || "";
    leadData.email = parts[2] || "";
    addMessage("Gracias. En breve recibirá confirmación por email si procede.");
    currentStep = null;
    await sendLeadToWebhook();
    return;
  }

  // fallback: if no step and no options visible, reopen menu
  setTimeout(() => {
    addMessage("No entendí exactamente — ¿Desea ver las opciones nuevamente?");
    setTimeout(() => startChat(), 600);
  }, 300);
}

/* conservative name extraction (very minimal) */
function extractNameConservative(t) {
  if (!t) return "";
  let s = t.trim();
  s = s.replace(/^(hola|buenos días|buenas tardes|buenas noches)[,!\.\s]*/i, "");
  const m = s.match(/^(soy|me llamo|mi nombre es)\s+(.*)/i);
  if (m && m[2]) {
    return m[2].split(/[.,]/)[0].trim().replace(/^(el|la)\s+/i, "");
  }
  // if the text is a short phrase (<4 words) we accept it as name
  const words = s.split(/\s+/);
  if (words.length <= 4) return s.split(/[.,]/)[0].trim();
  return "";
}

/* ---------------- Webhook / send lead ---------------- */
async function sendLeadToWebhook(extra = {}) {
  const payload = {
    sessionId,
    source: "web_chat_app",
    timestamp: new Date().toISOString(),
    lead: {
      name: leadData.name || "",
      phone: leadData.phone || "",
      email: leadData.email || "",
      negocio: leadData.negocio || "",
      subcategory: leadData.subcategory || "",
      decisionPower: leadData.decisionPower || "",
      interestLevel: leadData.interestLevel || "",
      responses: leadData.responses || []
    },
    extra
  };

  addMessage("Enviando información y preparando confirmación...", "bot");

  try {
    const r = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!r.ok) throw new Error("error");
    addMessage("✅ ¡Listo! Hemos enviado la información. En breve recibirá confirmación por email.", "bot");
  } catch (err) {
    console.error("Send error:", err);
    addMessage("⚠️ No pudimos enviar la información al servidor. Por favor contacte vía WhatsApp: +52 771 762 2360", "bot");
  }
}

/* ---------------- Utilities / compatibility ---------------- */
/* Keep a safe mapping in case other code calls handleThink/handleConsult */
function handleConsult() { handleConsult; } // noop placeholder if referenced
function handleThink() { handleThink; } // noop placeholder if referenced

/* ---------------- Init ---------------- */
startChat();
