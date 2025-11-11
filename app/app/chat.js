// ===============================================================
// Helios AI Labs Chatbot - Final Version (Part 1/2)
// Includes guards for async safety, full logging, interpolation fixes
// ===============================================================

document.addEventListener("DOMContentLoaded", () => {
  console.info("[helios][info] Chatbot DOM fully loaded and initializing...");

  const READ_PAUSE_MS = 3000;
  let conversationEnded = false;
  let pendingTimeouts = [];
  let currentStep = null;
  const messagesContainer = document.getElementById("messages");
  const userInput = document.getElementById("userInput");
  const sendBtn = document.getElementById("sendBtn");

  const lead = {
    title: "",
    given: "",
    surname: "",
    fullName: "",
    email: "",
    phone: "",
    preferredDay: "",
    preferredTime: "",
    sent: false
  };

  // ===== Utility: timeout tracking =====
  function addPendingTimeout(fn, delay) {
    const t = setTimeout(fn, delay);
    pendingTimeouts.push(t);
    return t;
  }

  function clearPendingTimeouts() {
    console.debug("[helios][debug] Clearing all pending timeouts:", pendingTimeouts.length);
    pendingTimeouts.forEach(clearTimeout);
    pendingTimeouts = [];
  }

  // ===== Utility: DOM/UI helpers =====
  function clearLastOptions() {
    document.querySelectorAll(".options").forEach(opt => opt.remove());
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  function interpolateLeadData(text) {
    return text
      .replace(/\[TÍTULO\]/g, lead.title || "Profesional")
      .replace(/\[APELLIDO\]/g, lead.surname || "")
      .replace(/\[NOMBRE\]/g, lead.given || lead.fullName || "Cliente");
  }

  function addMessage(text, sender = "bot") {
    if (conversationEnded) return;
    const message = document.createElement("div");
    message.className = sender === "bot" ? "message bot" : "message user";
    message.innerHTML = escapeHtml(interpolateLeadData(text));
    messagesContainer.appendChild(message);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  function addMessageDelayed(text, delay = READ_PAUSE_MS) {
    addPendingTimeout(() => addMessage(text, "bot"), delay);
  }

  function lockInput(placeholder) {
    userInput.disabled = true;
    sendBtn.disabled = true;
    if (placeholder) userInput.placeholder = placeholder;
  }

  function unlockInput(placeholder) {
    userInput.disabled = false;
    sendBtn.disabled = false;
    userInput.placeholder = placeholder || "Escribe aquí...";
  }

  // ===== Webhook POST =====
  async function sendLeadPayload(extra = {}, endSession = false) {
    const payload = { ...lead, ...extra, timestamp: new Date().toISOString() };
    console.debug("[helios][debug] Preparing POST payload", payload);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const res = await fetch("https://heliosailabs369.app.n8n.cloud/webhook/chatbot-groq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (!res.ok) {
        const body = await res.text();
        console.error("[helios][error] Webhook returned error:", res.status, body);
        addMessage("⚠️ Error al enviar la información. Intente de nuevo más tarde.", "bot");
        if (endSession) conversationEnded = true;
        return false;
      }

      console.info("[helios][info] Webhook POST successful:", res.status);
      addMessage("✅ ¡Listo! Hemos enviado la información.", "bot");
      if (endSession) {
        conversationEnded = true;
        addMessage("Gracias por contactarnos. En breve recibirá confirmación por email.", "bot");
        return true;
      } else {
        addPendingTimeout(showMainMenu, 1000);
      }
    } catch (err) {
      console.error("[helios][error] fetch() failed:", err);
      addMessage("❌ Error de conexión con el servidor.", "bot");
      if (endSession) conversationEnded = true;
      return false;
    }
  }

  // ===== Flow core =====
  function startChat() {
    if (conversationEnded) {
      addMessage("La sesión ha finalizado. Por favor recargue para iniciar otra conversación.", "bot");
      return;
    }
    addMessage("¡Hola! Soy Helios, Asesor Comercial Senior de Helios AI Labs. ¿Con quién tengo el gusto?");
    currentStep = "captureName";
    unlockInput();
  }

  function showMainMenu() {
    if (conversationEnded) {
      console.debug("[helios][info] showMainMenu() blocked — conversationEnded");
      return;
    }
    clearPendingTimeouts();
    clearLastOptions();
    console.debug("[helios][debug] Displaying main menu");
    addMessage("Gracias por contactarnos, somos Helios AI Labs. Para proporcionarle la mejor atención, personalizada y diseñar para usted un traje a la medida ¿Cuál de las siguientes preguntas desea que respondamos para usted?");
    addPendingTimeout(() => {
      addOptions([
        "A) ¿Cómo funciona la automatización de procesos con IA y qué beneficios medibles puede aportar a mi negocio?",
        "B) Quiero información sobre su empresa, ubicación, experiencia, credenciales, referencias, información fiscal, contrato, garantía por escrito, etc.",
        "C) ¿Por qué adoptar Inteligencia Artificial hoy es tan importante y cuales son los escenarios para mi negocio sí decido esperar más tiempo?",
        "D) ¿Cuánto cuesta implementar IA en mi negocio y en cuanto tiempo recuperaré mi inversión? ¿Tienen promociones?",
        "E) Todas las anteriores"
      ]);
    }, READ_PAUSE_MS);
  }

  // ===== Input & options =====
  function addOptions(options) {
    const container = document.createElement("div");
    container.className = "options";
    options.forEach(opt => {
      const btn = document.createElement("button");
      btn.textContent = opt;
      btn.onclick = () => handleOption(opt);
      container.appendChild(btn);
    });
    messagesContainer.appendChild(container);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  async function handleOption(opt) {
    if (conversationEnded) return;
    addMessage(opt, "user");
    if (opt.startsWith("A")) return handleA();
    if (opt.startsWith("B")) return handleB();
    if (opt.startsWith("C")) return handleC();
    if (opt.startsWith("D")) return handleD();
    if (opt.startsWith("E")) return handleE();
  }

  // ===============================================================
  // END OF PART 1/2 — Next block continues with handleA–E, askGiro, 
  // input handling, and conversation closing.
  // ===============================================================
// ===============================================================
// Helios AI Labs Chatbot - Final Version (Part 2/2)
// Includes guards for handleA–E, askGiro, and conversation handling
// ===============================================================

  // ===== Question Handlers =====

  function handleA(suppress = false) {
    clearPendingTimeouts();
    clearLastOptions();
    if (conversationEnded) return;

    console.debug("[helios][debug] handleA() called", { suppress });
    addMessage("Para responder a su pregunta, con la atención que usted se merece, por favor dígame: ¿En cuál de los siguientes giros se encuentra su negocio?");
    addPendingTimeout(() => askGiro(), READ_PAUSE_MS);
    if (!suppress) {
      addPendingTimeout(() => showMainMenu(), READ_PAUSE_MS * 4);
    }
  }

  function handleB(suppress = false) {
    clearPendingTimeouts();
    clearLastOptions();
    if (conversationEnded) return;

    console.debug("[helios][debug] handleB() called", { suppress });
    addMessageDelayed("Nombre comercial: Helios AI Labs.", READ_PAUSE_MS);
    addMessageDelayed("Todos nuestros servicios de automatización con Inteligencia Artificial, desarrollo de Software y diseño de aplicaciones son facturados inmediatamente.", READ_PAUSE_MS * 2);
    addMessageDelayed("Ciudad / dirección:\n\nCorporativo Matriz: Río Lerma 232 piso 23 Col. Cuauhtémoc, Alcaldía Cuauhtémoc, CP 06500, CDMX.\nSucursal Pachuca: Av. Revolución 300 Col. Periodista, CP 42060, Pachuca de Soto, Hidalgo.", READ_PAUSE_MS * 3);
    addMessageDelayed("Años de experiencia / trayectoria breve: 22 años de experiencia en el sector empresarial mexicano y estadounidense.", READ_PAUSE_MS * 4);
    if (!suppress) addPendingTimeout(showMainMenu, READ_PAUSE_MS * 6);
  }

  function handleC(suppress = false) {
    clearPendingTimeouts();
    clearLastOptions();
    if (conversationEnded) return;

    console.debug("[helios][debug] handleC() called", { suppress });
    addMessageDelayed("Adoptar Inteligencia Artificial hoy es importante porque acelera procesos, reduce errores y permite tomar decisiones basadas en datos.", READ_PAUSE_MS);
    addMessageDelayed("Esperar implica perder ventaja competitiva, clientes potenciales y oportunidades de crecimiento, además de elevar el costo de implementación a futuro.", READ_PAUSE_MS * 2);
    if (!suppress) addPendingTimeout(showMainMenu, READ_PAUSE_MS * 5);
  }

  function handleD(suppress = false) {
    clearPendingTimeouts();
    clearLastOptions();
    if (conversationEnded) return;

    console.debug("[helios][debug] handleD() called", { suppress });
    addMessageDelayed("Los costos de implementación varían según el alcance del proyecto.", READ_PAUSE_MS);
    addMessageDelayed("Contamos con paquetes y financiamiento; muchas implementaciones recuperan la inversión en menos de 3 meses dependiendo del caso.", READ_PAUSE_MS * 2);
    if (!suppress) addPendingTimeout(showMainMenu, READ_PAUSE_MS * 4);
  }

  async function handleE() {
    clearPendingTimeouts();
    clearLastOptions();
    if (conversationEnded) return;

    console.debug("[helios][debug] handleE() called");
    handleA(true);
    handleB(true);
    handleC(true);
    handleD(true);
    addPendingTimeout(() => {
      addMessage("Perfecto, puedo mostrarle un plan de acción inmediato y agendar una asesoría gratuita de diagnóstico.");
      addPendingTimeout(openContactCapture, READ_PAUSE_MS);
    }, READ_PAUSE_MS * 8);
  }

  // ===== Ask Business Type =====
  function askGiro() {
    if (conversationEnded) return;
    clearPendingTimeouts();
    clearLastOptions();

    console.debug("[helios][debug] askGiro() executed");
    addMessage("Para responder a su pregunta, con la atención que usted se merece, por favor seleccione el giro que mejor describe su negocio:");

    addPendingTimeout(() => {
      addOptions([
        "A) Salud",
        "B) Jurídico",
        "C) Educación",
        "D) Comercio",
        "E) Industria",
        "F) Servicios",
        "G) Otro"
      ]);
    }, READ_PAUSE_MS);
  }

  // ===== Open Contact Capture =====
  function openContactCapture() {
    if (conversationEnded) return;
    clearPendingTimeouts();
    clearLastOptions();

    console.debug("[helios][debug] openContactCapture() initialized");
    addMessage("Perfecto. Para agendar necesito: Teléfono (WhatsApp), Email, Día preferido y Hora aproximada.");
    currentStep = "captureContact";
    unlockInput("Ejemplo: +52 5551234567, contacto@empresa.com");
  }

  // ===== Input handling =====
  async function onSubmit() {
    if (conversationEnded) {
      addMessage("La sesión ha finalizado. Por favor recargue la página para iniciar una nueva conversación.", "bot");
      return;
    }

    const input = userInput.value.trim();
    if (!input) return;
    addMessage(input, "user");
    userInput.value = "";

    if (currentStep === "captureName") {
      parseName(input);
      addPendingTimeout(() => {
        addMessage(`¿Cómo prefiere que me dirija a usted? Elija una opción:`);
        addPendingTimeout(() => addOptions(["Lic.", "Dr.", "Dra.", "Ing.", "Mtro.", "Mtra.", "Otro"]), READ_PAUSE_MS);
      }, READ_PAUSE_MS);
      currentStep = "captureTitle";
      return;
    }

    if (currentStep === "captureTitle") {
      lead.title = input.replace(/\W+/g, "").trim();
      addMessageDelayed(`Excelente ${lead.title} ${lead.surname}. Gracias.`, READ_PAUSE_MS);
      addPendingTimeout(showMainMenu, READ_PAUSE_MS * 2);
      currentStep = "mainMenu";
      return;
    }

    if (currentStep === "captureContact") {
      parseContact(input);
      await sendLeadPayload({}, true);
      return;
    }
  }

  function parseName(raw) {
    const text = raw.toLowerCase().replace(/^hola|buenas|soy|me llamo/gi, "").trim();
    const parts = text.split(/\s+/);
    const connectors = ["de", "del", "la", "las", "los"];
    let surname = parts.pop() || "";
    if (connectors.includes(parts[parts.length - 1])) surname = `${parts.pop()} ${surname}`;
    const given = parts.join(" ");
    lead.given = given.replace(/\b\w/g, c => c.toUpperCase());
    lead.surname = surname.replace(/\b\w/g, c => c.toUpperCase());
    lead.fullName = `${lead.given} ${lead.surname}`.trim();
    console.debug("[helios][debug] Parsed name:", lead);
  }

  function parseContact(raw) {
    const lower = raw.trim().toLowerCase();
    const emailMatch = lower.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/);
    if (emailMatch) lead.email = emailMatch[0];

    const phoneMatch = lower.replace(lead.email || "", "").match(/\+?\d[\d\s-]{7,15}/);
    if (phoneMatch) {
      lead.phone = phoneMatch[0].replace(/[^\d+]/g, "");
      if (lead.phone.length === 10 && !lead.phone.startsWith("+")) lead.phone = "+52" + lead.phone;
    }

    console.debug("[helios][debug] Parsed contact:", lead);
  }

  // ===== Event bindings =====
  sendBtn.addEventListener("click", onSubmit);
  userInput.addEventListener("keypress", e => { if (e.key === "Enter") onSubmit(); });

  // ===== Start =====
  console.info("[helios][info] Chatbot initialized and awaiting user input");
  startChat();
});
// ===============================================================
// END OF FILE chat.js (Part 2/2)
// ===============================================================
