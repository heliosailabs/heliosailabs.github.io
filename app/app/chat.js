// /app/chat.js - Versión depurada y estable de Helios AI Labs (mantiene textos intactos)
window.addEventListener("DOMContentLoaded", () => {
  /* ---------- Config ---------- */
  const WEBHOOK_URL = "https://heliosailabs369.app.n8n.cloud/webhook/chatbot-groq";
  const EMAIL_COPY_TO = "heliosailabs@gmail.com";
  const FORMS_OF_PAYMENT =
    "Transferencia bancaria, todas las tarjetas de crédito y débito VISA, Mastercard y American Express, Bitcoin y ETH.";

  /* ---------- DOM ---------- */
  const messagesContainer = document.getElementById("messages");
  const inputField = document.getElementById("userInput");
  const sendBtn = document.getElementById("sendBtn");

  if (!messagesContainer || !inputField || !sendBtn) {
    console.error("Missing DOM elements: ensure there are #messages, #userInput and #sendBtn in the HTML.");
    return;
  }

  /* ---------- Session & lead ---------- */
  function genSessionId() {
    let s = localStorage.getItem("helios_sessionId");
    if (!s) {
      s = `sess_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
      localStorage.setItem("helios_sessionId", s);
    }
    return s;
  }
  const sessionId = genSessionId();

  const lead = {
    name: "",
    title: "",
    gender: "",
    industry: "",
    subcategory: "",
    marketingBudget: "",
    decisionPower: "",
    interestLevel: "",
    phone: "",
    email: "",
    preferredDay: "",
    preferredTime: "",
    responses: []
  };

  /* ---------- State ---------- */
  let currentStep = null;
  let optionsVisible = false;
  let lastOptionsWrapper = null;

  /* ---------- UI helpers ---------- */
  function addMessage(text, sender = "bot") {
    const el = document.createElement("div");
    el.classList.add("message", sender);
    el.innerHTML = String(text).replace(/\n/g, "<br/>");
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
    inputField.placeholder = "Escribe aquí...";
  }

  function lockInput(placeholder = "Selecciona una opción...") {
    optionsVisible = true;
    inputField.disabled = true;
    sendBtn.disabled = true;
    inputField.placeholder = placeholder;
  }

  function unlockInput() {
    optionsVisible = false;
    inputField.disabled = false;
    sendBtn.disabled = false;
    inputField.placeholder = "Escribe aquí...";
  }

  function addOptions(items) {
    clearLastOptions();
    const wrapper = document.createElement("div");
    wrapper.classList.add("message", "bot");
    const row = document.createElement("div");
    row.classList.add("option-row");

    items.forEach(it => {
      const btn = document.createElement("button");
      btn.classList.add("option-btn");
      btn.type = "button";
      btn.innerText = it.label;
      btn.addEventListener("click", () => {
        addMessage(it.label, "user");
        lead.responses.push({ option: it.value || it.label, label: it.label, ts: new Date().toISOString() });
        Array.from(row.querySelectorAll("button")).forEach(b => (b.disabled = true));
        setTimeout(() => {
          clearLastOptions();
          if (typeof it.next === "function") it.next(it.value);
        }, 180);
      });
      row.appendChild(btn);
    });

    wrapper.appendChild(row);
    messagesContainer.appendChild(wrapper);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    lastOptionsWrapper = wrapper;
    lockInput();
  }

  /* ---------- small utils ---------- */
  function extractCleanName(raw) {
    if (!raw) return "";
    let name = raw.trim();
    name = name.replace(/^(yo\s+)?(soy|me llamo|mi nombre es)\s+/i, "");
    name = name.replace(/\s+/g, " ").trim();
    return name;
  }

  const TITLE_CHOICES = [
    "Dr.", "Dra.", "Arq.", "Lic.", "Ing.", "C.P.", "Mtro.", "Mtra.",
    "Sr.", "Sra.", "Srita.", "Don", "Doña", "Profesor", "Profesora", "Coach", "Chef", "Otro"
  ];

  /* ---------- FLOW ---------- */
  function startChat() {
    addMessage("¡Hola! Soy Helios, Asesor Comercial Senior de Helios AI Labs. ¿Con quién tengo el gusto?");
    currentStep = "captureName";
    unlockInput();
  }

  function showMainMenu() {
    addMessage("Gracias por contactarnos, somos Helios AI Labs. Para proporcionarle la mejor atención, personalizada y diseñar para usted un traje a la medida ¿Cuál de las siguientes preguntas desea que respondamos para usted?");
    setTimeout(() => {
      addOptions([
        { label: "A) ¿Cómo funciona la automatización de procesos con IA y qué beneficios medibles puede aportar a mi negocio?", value: "A", next: () => handleA() },
        { label: "B) Quiero información sobre su empresa...", value: "B", next: () => handleB() },
        { label: "C) ¿Por qué adoptar Inteligencia Artificial hoy es tan importante y cuales son los escenarios para mi negocio sí decido esperar más tiempo?", value: "C", next: () => handleC() },
        { label: "D) ¿Cuánto cuesta implementar IA en mi negocio y en cuanto tiempo recuperaré mi inversión? ¿Tienen promociones?", value: "D", next: () => handleD() },
        { label: "E) Todas las anteriores", value: "E", next: () => handleE() }
      ]);
    }, 300);
  }

  /* ---------- Handlers ---------- */
  function handleA() { askGiro(); }
  function handleB() {
    const text = `Nombre comercial: Helios AI Labs.
Todos nuestros servicios... 
Formas de pago: ${FORMS_OF_PAYMENT}.`;
    addMessage(text);
    setTimeout(() => showMainMenu(), 1000);
  }
  function handleC() {
    addMessage("Adoptar Inteligencia Artificial hoy es importante porque acelera procesos...");
    setTimeout(() => showMainMenu(), 1000);
  }
  function handleD() {
    addMessage("Los costos de implementación varían según alcance...");
    setTimeout(() => showMainMenu(), 1000);
  }
  function handleE() {
    addMessage("Perfecto, puedo mostrarle un plan de acción inmediato y agendar una asesoría gratuita de diagnóstico.");
    setTimeout(() => openContactCapture(), 700);
  }

  function askGiro() {
    addMessage("Para responder a su pregunta, con la atención que usted se merece, por favor dígame: ¿En cuál de los siguientes giros se encuentra su negocio?");
    setTimeout(() => {
      addOptions([
        { label: "A) Salud", value: "Salud", next: () => renderPitch_Salud() },
        { label: "B) Despacho Jurídico", value: "Jurídico", next: () => renderPitch_Juridico() },
        { label: "C) Profesional independiente", value: "Profesional independiente", next: () => renderPitch_Generic("Profesional independiente") }
      ]);
    }, 300);
  }

  /* ---------- PITCHES ---------- */
  function renderPitch_Salud() {
    const text = `En consultorios y clínicas la automatización con IA puede contestar llamadas por voz o mensajes de texto, agendar citas y confirmar consultas 24/7...
Además, la automatización con IA atrae a un perfil de clientes con un mayor poder adquisitivo y eleva sustancialmente el ticket promedio.`;
    addMessage(text);
    setTimeout(() => askInterestAndDecision(), 500);
  }

  function renderPitch_Juridico() {
    const text = `⚖ [TÍTULO] [APELLIDO], en su profesión la confianza, velocidad y resultados lo son todo.
La automatización con IA puede contestar llamadas...`;
    addMessage(text);
    setTimeout(() => askInterestAndDecision(), 500);
  }

  function renderPitch_Generic() {
    const text = `👔 [TÍTULO] [APELLIDO], cuando una persona trabaja por su cuenta… el tiempo es el recurso más valioso...`;
    addMessage(text);
    setTimeout(() => askInterestAndDecision(), 500);
  }

  /* ---------- DECISION ---------- */
  function askInterestAndDecision() {
    addMessage("Si la implementación fuera 100% accesible a su economía y garantizara recuperar su inversión en un máximo de 3 meses, ¿estaría listo(a) para decidir hoy?");
    setTimeout(() => {
      addOptions([
        { label: "A) Sí — Listo(a) para contratar hoy", next: () => openContactCapture() },
        { label: "B) Lo tengo que pensar", next: () => handleThink() },
        { label: "C) Lo tengo que consultar (socio/jefe/esposo/esposa)", next: () => handleConsult() }
      ]);
    }, 400);
  }

  function handleThink() {
    addMessage("¿Qué porcentaje de la decisión depende de usted?");
    setTimeout(() => {
      addOptions([
        { label: "Menos de 50%", next: () => offerPresentation() },
        { label: "50% o más", next: () => offerPresentation() }
      ]);
    }, 400);
  }

  function handleConsult() {
    addMessage("¿Desea que le enviemos una presentación por email o prefiere agendar una reunión con su decisor?");
    setTimeout(() => {
      addOptions([
        { label: "Enviar presentación", next: () => askEmailForPresentation() },
        { label: "Agendar reunión", next: () => openContactCapture() }
      ]);
    }, 400);
  }

  function offerPresentation() {
    addMessage("Perfecto. ¿Cuál email usamos para enviar la presentación?");
    currentStep = "capturePresentationEmail";
    unlockInput();
  }

  function askEmailForPresentation() {
    addMessage("Ingrese su email en el campo inferior y presione Enviar.");
    currentStep = "capturePresentationEmail";
    unlockInput();
  }

  function openContactCapture() {
    addMessage("Perfecto. Para agendar necesito: Teléfono (WhatsApp), Email, Día preferido y Hora aproximada.");
    currentStep = "captureContactLine";
    unlockInput();
  }

  /* ---------- Input ---------- */
  sendBtn.addEventListener("click", onSubmit);
  inputField.addEventListener("keydown", e => e.key === "Enter" && onSubmit());

  async function onSubmit() {
    const raw = (inputField.value || "").trim();
    if (!raw) return;

    if (optionsVisible) {
      addMessage("Por favor seleccione una de las opciones mostradas arriba.", "bot");
      inputField.value = "";
      return;
    }

    addMessage(raw, "user");
    inputField.value = "";
    lead.responses.push({ text: raw, ts: new Date().toISOString() });

    if (currentStep === "captureName") {
      lead.name = extractCleanName(raw);
      addMessage("¿Cómo prefiere que me dirija a usted? Elija una opción:");
      const titleItems = TITLE_CHOICES.map(t => ({
        label: t,
        value: t,
        next: v => {
          lead.title = v;
          addMessage(`Excelente ${lead.title} ${lead.name}. Gracias.`);
          setTimeout(() => showMainMenu(), 500);
        }
      }));
      addOptions(titleItems);
      currentStep = null;
      return;
    }

    if (currentStep === "capturePresentationEmail") {
      lead.email = raw;
      addMessage("Perfecto — le enviaremos la presentación a ese correo. Gracias.");
      await sendLeadPayload({ wantsPresentation: true });
      currentStep = null;
      setTimeout(() => showMainMenu(), 1000);
      return;
    }

    if (currentStep === "captureContactLine") {
      const parts = raw.split(",").map(s => s.trim()).filter(Boolean);
      if (parts.length < 2) {
        addMessage("Por favor ingrese al menos Teléfono (WhatsApp) y Email separados por comas.");
        return;
      }
      lead.phone = parts[0];
      lead.email = parts[1];
      lead.preferredDay = parts[2] || "";
      lead.preferredTime = parts[3] || "";
      addMessage("📨 Información enviada correctamente a Helios AI Labs.");
      await sendLeadPayload({ schedule: true });
      currentStep = null;
      return;
    }
  }

  /* ---------- send webhook ---------- */
  async function sendLeadPayload(extra = {}) {
    if (!lead.email && !lead.phone) return; // evita envíos vacíos

    const payload = {
      sessionId,
      timestamp: new Date().toISOString(),
      lead,
      extra: { emailCopyTo: EMAIL_COPY_TO, formsOfPayment: FORMS_OF_PAYMENT, ...extra }
    };

    addMessage("Enviando información y preparando confirmación...", "bot");
    try {
      const res = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      addMessage("✅ ¡Listo! Hemos enviado la información. En breve recibirá confirmación por email.", "bot");
    } catch (err) {
      console.error("Webhook send error:", err);
      addMessage("⚠️ No pudimos enviar la información al servidor. Por favor contacte vía WhatsApp: +52 771 762 2360", "bot");
    }
  }

  startChat();
});
