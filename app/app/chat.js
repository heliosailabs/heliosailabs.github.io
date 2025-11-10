// /app/chat.js — versión final revisada por Helios AI Labs

window.addEventListener("DOMContentLoaded", () => {
  /* ---------- CONFIG ---------- */
  const WEBHOOK_URL = "https://heliosailabs369.app.n8n.cloud/webhook/chatbot-groq";
  const EMAIL_COPY_TO = "heliosailabs@gmail.com";
  const FORMS_OF_PAYMENT =
    "Transferencia bancaria, todas las tarjetas de crédito y débito VISA, Mastercard y American Express, Bitcoin y ETH.";

  /* ---------- DOM ---------- */
  const messagesContainer = document.getElementById("messages");
  const inputField = document.getElementById("userInput");
  const sendBtn = document.getElementById("sendBtn");

  if (!messagesContainer || !inputField || !sendBtn) {
    console.error("Faltan elementos del DOM (#messages, #userInput, #sendBtn).");
    return;
  }

  /* ---------- SESSION ---------- */
  function genSessionId() {
    let s = localStorage.getItem("helios_sessionId");
    if (!s) {
      s = `sess_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
      localStorage.setItem("helios_sessionId", s);
    }
    return s;
  }
  const sessionId = genSessionId();

  /* ---------- LEAD DATA ---------- */
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

  /* ---------- STATE ---------- */
  let currentStep = null;
  let optionsVisible = false;
  let lastOptionsWrapper = null;

  /* ---------- UI HELPERS ---------- */
  function addMessage(text, sender = "bot") {
    const el = document.createElement("div");
    el.classList.add("message", sender);
    el.innerHTML = String(text).replace(/\n/g, "<br/>");
    messagesContainer.appendChild(el);
    setTimeout(() => {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }, 40);
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
          try {
            if (typeof it.next === "function") it.next(it.value);
          } catch (e) {
            console.error(e);
          }
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

  /* ---------- UTILIDADES ---------- */
  function cleanUserName(raw) {
    if (!raw) return "";
    let name = raw
      .trim()
      .replace(/^yo\s+soy\s+/i, "")
      .replace(/^soy\s+/i, "")
      .replace(/^me\s+llamo\s+/i, "")
      .replace(/^mi\s+nombre\s+es\s+/i, "")
      .replace(/\b(el|la|los|las|de|del)\b/gi, "")
      .replace(/\b(sr\.?|sra\.?|srta\.?|don|doña|lic\.?|dra\.?|dr\.?|ing\.?|arq\.?|mtro\.?|mtra\.?|prof\.?|coach|chef)\b/gi, "")
      .trim();
    return name.replace(/\s{2,}/g, " ");
  }

  const TITLE_CHOICES = [
    "Sr.", "Sra.", "Dr.", "Dra.", "Lic.", "Ing.", "Arq.",
    "C.P.", "Mtro.", "Mtra.", "Prof.", "Chef", "Coach", "Otro"
  ];

  /* ---------- FLUJO PRINCIPAL ---------- */
  function startChat() {
    addMessage("¡Hola! Soy Helios, Asesor Comercial Senior de Helios AI Labs. ¿Con quién tengo el gusto?");
    currentStep = "captureName";
    inputField.focus();
  }

  function showMainMenu() {
    addMessage(
      "Gracias por contactarnos, somos Helios AI Labs. Para proporcionarle la mejor atención personalizada y diseñar para usted un traje a la medida ¿Cuál de las siguientes preguntas desea que respondamos para usted?"
    );
    setTimeout(() => {
      addOptions([
        {
          label: "A) ¿Cómo funciona la automatización de procesos con IA y qué beneficios medibles puede aportar a mi negocio?",
          value: "A",
          next: () => askIndustry()
        },
        {
          label: "B) Información sobre su empresa, ubicación, experiencia, credenciales, contrato y garantía por escrito.",
          value: "B",
          next: () => handleInfo()
        },
        {
          label: "C) ¿Por qué adoptar Inteligencia Artificial hoy es tan importante y qué pasa si espero más tiempo?",
          value: "C",
          next: () => handleAdopt()
        },
        {
          label: "D) Costos, promociones y ROI.",
          value: "D",
          next: () => handleROI()
        },
        { label: "E) Todas las anteriores", value: "E", next: () => handleAll() }
      ]);
    }, 400);
  }

  /* ---------- HANDLERS ---------- */
  function handleInfo() {
    const text = `
📄 Nombre comercial: Helios AI Labs
🏢 Corporativo Matriz: Río Lerma 232, Piso 23, Col. Cuauhtémoc, Alcaldía Cuauhtémoc, CP 06500, CDMX
Sucursal Pachuca: Av. Revolución 300, Col. Periodista, CP 42060, Pachuca de Soto, Hidalgo

💼 Experiencia:
22 años en el sector empresarial mexicano y estadounidense. 
Proyectos en Silicon Valley, Monterrey, Panamá, Pachuca y CDMX.

✅ Garantía:
Contrato avalado por PROFECO, con garantía escrita para NO pagar cuota mensual hasta recuperar la inversión inicial de set up en un máximo de 3 meses.
Incluye métricas y monitoreo 24/7 con IA.

🤝 Acuerdo de confidencialidad:
Todos los clientes están protegidos mediante un *Non-Disclosure Agreement (NDA)*.

💳 Formas de pago:
${FORMS_OF_PAYMENT}

📞 Contacto directo:
WhatsApp 24/7: +52 771 762 2360
`;
    addMessage(text);
  }

  function handleAdopt() {
    addMessage(
      "La adopción de IA redefine los negocios. Los adoptadores tempranos obtienen ventaja competitiva masiva. Esperar significa perder clientes y aumentar costos de entrada."
    );
  }

  function handleROI() {
    addMessage(`
📊 Recuperación típica de inversión: 60 a 90 días.
✅ Garantía escrita por PROFECO.
🎁 Promociones actuales: 3 meses sin intereses con todas las tarjetas de crédito bancarias, en el pago inicial de Implementación "Set up".`);
  }

  function handleAll() {
    addMessage("Perfecto, puedo mostrarle un plan de acción inmediato y agendar una asesoría gratuita de diagnóstico.");
    setTimeout(() => openContactCapture(), 800);
  }

  /* ---------- INDUSTRIAS ---------- */
  function askIndustry() {
    addMessage("Excelente. Para responder a su pregunta, ¿en cuál de los siguientes giros se encuentra su negocio?");
    setTimeout(() => {
      addOptions([
        { label: "A) Salud", value: "Salud", next: () => askSub("Salud") },
        { label: "B) Jurídico", value: "Jurídico", next: () => askSub("Jurídico") },
        { label: "C) Restaurante / Cafetería", value: "Restaurante", next: () => askSub("Restaurante") },
        { label: "D) Inmobiliario", value: "Inmobiliario", next: () => askSub("Inmobiliario") },
        { label: "E) Educación", value: "Educación", next: () => askSub("Educación") },
        { label: "F) Contenido / Creativo", value: "Contenido", next: () => askSub("Contenido") },
        { label: "G) Comercio", value: "Comercio", next: () => askSub("Comercio") },
        { label: "H) Profesional Independiente", value: "Independiente", next: () => askSub("Independiente") },
        { label: "I) Belleza / Spa", value: "Belleza", next: () => askSub("Belleza") },
        { label: "J) Otro", value: "Otro", next: () => askSub("Otro") }
      ]);
    }, 400);
  }

  function askSub(ind) {
    lead.industry = ind;
    addMessage(`Perfecto ${lead.title ? lead.title : ""} ${lead.name}.`);
    // Aquí podrías llamar el pitch adecuado.
  }

  /* ---------- CONTACTO ---------- */
  function openContactCapture() {
    addMessage("Perfecto. Para agendar necesito: Teléfono (WhatsApp), Email, Día preferido y Hora aproximada.");
    currentStep = "captureContactLine";
    inputField.disabled = false;
  }

  /* ---------- ENVÍO ---------- */
  async function sendLeadPayload(extra = {}) {
    const payload = {
      sessionId,
      timestamp: new Date().toISOString(),
      lead: { ...lead },
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
      addMessage("📨 Información enviada correctamente a Helios AI Labs.", "bot");
    } catch (err) {
      console.error("Error al enviar:", err);
      addMessage("⚠️ No pudimos enviar la información al servidor. Por favor contacte vía WhatsApp: +52 771 762 2360", "bot");
    }
  }

  /* ---------- ENTRADA USUARIO ---------- */
  sendBtn.addEventListener("click", onSubmit);
  inputField.addEventListener("keydown", e => {
    if (e.key === "Enter") onSubmit();
  });

  async function onSubmit() {
    const raw = (inputField.value || "").trim();
    if (!raw) return;

    if (optionsVisible) {
      addMessage("Por favor, seleccione una opción.", "bot");
      inputField.value = "";
      return;
    }

    addMessage(raw, "user");
    inputField.value = "";

    if (currentStep === "captureName") {
      const clean = cleanUserName(raw);
      lead.name = clean || raw;
      addMessage("¿Cómo prefiere que me dirija a usted? Elija una opción:");
      addOptions(
        TITLE_CHOICES.map(t => ({
          label: t,
          value: t,
          next: val => {
            lead.title = val;
            addMessage(`Excelente ${lead.title} ${lead.name}. Gracias.`);
            setTimeout(() => showMainMenu(), 500);
          }
        }))
      );
      currentStep = null;
      return;
    }

    if (currentStep === "captureContactLine") {
      const parts = raw.split(",").map(s => s.trim());
      if (parts.length < 2) {
        addMessage("Por favor, ingrese al menos Teléfono y Email separados por coma.");
        return;
      }
      [lead.phone, lead.email, lead.preferredDay, lead.preferredTime] = parts;
      await sendLeadPayload({ schedule: true });
      currentStep = null;
      return;
    }
  }

  /* ---------- INIT ---------- */
  startChat();
});
