// app/chat.js - Helios AI Labs (definitive corrected version)
// Includes: 8 fixes integrated, verbose logs (English technical), 3s reading pauses,
// robust name parsing, interpolation of [TÍTULO] [APELLIDO], safe HTML sanitization,
// flexible contact parsing, pendingTimeouts management, webhook POST with confirmation.

// Logging helper (verbose, technical English)
const HLOG = {
  info: (...args) => console.log("[helios][info]", ...args),
  warn: (...args) => console.warn("[helios][warn]", ...args),
  error: (...args) => console.error("[helios][error]", ...args),
  debug: (...args) => console.debug("[helios][debug]", ...args)
};

window.addEventListener("DOMContentLoaded", () => {
  HLOG.info("Session initializing...");

  /* ---------- Config ---------- */
  const WEBHOOK_URL = "https://heliosailabs369.app.n8n.cloud/webhook/chatbot-groq"; // POST endpoint expected
  const EMAIL_COPY_TO = "heliosailabs@gmail.com";
  const FORMS_OF_PAYMENT = "Transferencia bancaria, todas las tarjetas de crédito y debito VISA, Mastercard y American Express, Crypto (Bitcoin, ETH).";

  /* ---------- DOM ---------- */
  const messagesContainer = document.getElementById("messages");
  const inputField = document.getElementById("userInput");
  const sendBtn = document.getElementById("sendBtn");

  if (!messagesContainer || !inputField || !sendBtn) {
    HLOG.error("Missing DOM elements. Ensure #messages, #userInput, #sendBtn exist.");
    return;
  }

  /* ---------- Session & lead ---------- */
  function genSessionId(){
    let s = localStorage.getItem("helios_sessionId");
    if(!s){
      s = `sess_${Date.now()}_${Math.floor(Math.random()*10000)}`;
      localStorage.setItem("helios_sessionId", s);
    }
    return s;
  }
  const sessionId = genSessionId();
  HLOG.info("Session initialized", { sessionId });

  const lead = {
    fullName: "",
    givenName: "",
    surname: "",
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
    responses: [],
    sent: false // prevent duplicate sends; set true only after confirmed success
  };

  /* ---------- State ---------- */
  let currentStep = null; // "captureName", "capturePresentationEmail", "captureContactLine", null
  let optionsVisible = false;
  let lastOptionsWrapper = null;
  // pending timeouts to avoid overlapping async flows
  const pendingTimeouts = [];

  /* ---------- Utilities ---------- */
  function addPendingTimeout(fn, delay){
    const t = setTimeout(fn, delay);
    pendingTimeouts.push(t);
    return t;
  }
  function clearPendingTimeouts(){
    HLOG.debug("Clearing pending timeouts", pendingTimeouts.length);
    while(pendingTimeouts.length) {
      const t = pendingTimeouts.pop();
      try { clearTimeout(t); } catch(e) { /* ignore */ }
    }
  }

  // sanitize text to prevent HTML injection (escape)
  function escapeHtml(unsafe){
    if (unsafe === null || unsafe === undefined) return "";
    return String(unsafe)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // interpolates [TÍTULO] [APELLIDO] etc. and falls back if missing
  function interpolateLeadData(text){
    let out = String(text || "");
    const fallbackTitle = lead.title || "Cliente";
    const fallbackSurname = lead.surname || (lead.givenName ? lead.givenName : "Cliente");
    out = out.replaceAll("[TÍTULO]", escapeHtml(fallbackTitle));
    out = out.replaceAll("[APELLIDO]", escapeHtml(fallbackSurname));
    out = out.replaceAll("${TÍTULO}", escapeHtml(fallbackTitle));
    out = out.replaceAll("${APELLIDO}", escapeHtml(fallbackSurname));
    // support ${TÍTULO} ${APELLIDO} used in some snippets
    out = out.replaceAll("${TÍTULO} ${APELLIDO}", `${escapeHtml(fallbackTitle)} ${escapeHtml(fallbackSurname)}`);
    return out;
  }

  // add message with interpolation + sanitization. sender = "bot" | "user"
  function addMessage(rawText, sender = "bot"){
    const text = interpolateLeadData(rawText);
    const safe = escapeHtml(text);
    const el = document.createElement("div");
    el.classList.add("message", sender === "user" ? "user" : "bot");
    el.innerHTML = safe.replace(/\n/g, "<br/>");
    messagesContainer.appendChild(el);
    HLOG.debug("Added message", { sender, text: text.slice(0,200) });
    setTimeout(()=> messagesContainer.scrollTop = messagesContainer.scrollHeight, 40);
    return el;
  }

  // same as addMessage but delayed by 3s for reading flow (and track timeout)
  function addMessageDelayed(rawText, sender = "bot", delay = 3000){
    return addPendingTimeout(()=> addMessage(rawText, sender), delay);
  }

  function clearLastOptions(){
    if (lastOptionsWrapper){
      try { lastOptionsWrapper.remove(); } catch(e) {}
      lastOptionsWrapper = null;
    }
    optionsVisible = false;
    inputField.disabled = false;
    sendBtn.disabled = false;
    // restore placeholder gracefully
    inputField.placeholder = inputField.dataset.lastPlaceholder || "Escribe aquí...";
  }

  function lockInput(placeholder = "Selecciona una opción desde las burbujas..."){
    optionsVisible = true;
    inputField.disabled = true;
    sendBtn.disabled = true;
    // save last placeholder to avoid abrupt flash
    inputField.dataset.lastPlaceholder = inputField.placeholder;
    inputField.placeholder = placeholder;
  }

  function unlockInput(placeholder){
    optionsVisible = false;
    inputField.disabled = false;
    sendBtn.disabled = false;
    inputField.placeholder = placeholder || inputField.dataset.lastPlaceholder || "Escribe aquí...";
  }

  function addOptions(items){
    // items: array of { label, value, next: fn }
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
        Array.from(row.querySelectorAll("button")).forEach(b => b.disabled = true);
        // small delay before next to allow UX
        addPendingTimeout(() => {
          clearLastOptions();
          try {
            if (typeof it.next === "function") it.next(it.value);
            else HLOG.warn("Option has no next function", it);
          } catch(err){
            HLOG.error("Error executing option handler", err);
            addMessage("Se produjo un error interno. Intentemos de nuevo.", "bot");
            showMainMenu();
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

  /* ---------- Name parsing helpers ---------- */
  // remove common leading phrases and titles, return object { fullName, givenName, surname }
  function parseName(raw){
    if(!raw) return { fullName: "", givenName: "", surname: "" };
    let s = String(raw).trim();

    // Lowercase for checks but preserve original for output
    const lower = s.toLowerCase();

    // Patterns to remove (spanish & variants)
    const prefixes = [
      /^soy\s+(el|la)\s+/i,
      /^soy\s+/i,
      /^me llamo\s+/i,
      /^mi nombre es\s+/i,
      /^buenas\s+(noches|tardes|dias)\s*,?\s*(soy\s+)?/i,
      /^buenos\s+(dias|días|tardes|noches)\s*,?\s*(soy\s+)?/i,
      /^hola[,!\s]+(soy\s+)?/i,
      /^muy\s+(buenas|buenas)\s*,?\s*(soy\s+)?/i
    ];
    prefixes.forEach(rx => { s = s.replace(rx, ""); });

    // Remove connecting commas and extra spaces
    s = s.replace(/\s{2,}/g, " ").trim();
    // Remove trailing punctuation
    s = s.replace(/^[,:;\-]+\s*/, "").replace(/\s*[,:;.\-]+$/, "");

    // If contains known title at start (e.g., "Dra. Ana Perez"), remove for name extraction — we'll ask title separately anyway
    const titleRx = /^(dr\.|dra\.|lic\.|licenciada|licenciado|sr\.|sra\.|prof\.|profesora|profesor|prof\.a|ing\.|arq\.|cp\.)\s*/i;
    s = s.replace(titleRx, "").trim();

    // Keep fullName as provided (post-clean)
    const parts = s.split(/\s+/).filter(Boolean);
    let given = "", sur = "";
    if (parts.length === 0) { given = ""; sur = ""; }
    else if (parts.length === 1) { given = parts[0]; sur = parts[0]; }
    else {
      // given = all but last, surname = last — preserves compound given names
      sur = parts[parts.length - 1];
      given = parts.slice(0, parts.length - 1).join(" ");
    }
    const full = (given && sur) ? (given + " " + sur) : s;
    return { fullName: full, givenName: given, surname: sur };
  }

  /* ---------- Title choices ---------- */
  const TITLE_CHOICES = [
    "Dr.", "Dra.", "Arq.", "Lic.", "Ing.", "C.P.", "Mtro./Mtra.",
    "Sr.", "Sra.", "Srita.", "Don", "Doña", "Profesor", "Profesora", "Coach", "Chef", "Otro"
  ];

  /* ---------- Flow (literal) ---------- */

  // FASE 0 - greeting & capture name
  function startChat(){
    HLOG.info("Chatbot initialized and awaiting user input");
    addMessage("¡Hola! Soy Helios, Asesor Comercial Senior de Helios AI Labs. ¿Con quién tengo el gusto?");
    currentStep = "captureName";
    unlockInput();
  }

  // FASE 1 - main menu (A..E)
  function showMainMenu(){
    clearPendingTimeouts(); // avoid overlapping blocks
    addMessageDelayed("Gracias por contactarnos, somos Helios AI Labs. Para proporcionarle la mejor atención, personalizada y diseñar para usted un traje a la medida ¿Cuál de las siguientes preguntas desea que respondamos para usted?", "bot", 3000);
    // show options after pause
    addPendingTimeout(()=> {
      addOptions([
        { label: "A) ¿Cómo funciona la automatización de procesos con IA y qué beneficios medibles puede aportar a mi negocio?", value: "A", next: () => handleA() },
        { label: "B) Quiero información sobre su empresa, ubicación, experiencia, credenciales, referencias, información fiscal, contrato, garantía por escrito, etc.", value: "B", next: () => handleB() },
        { label: "C) ¿Por qué adoptar Inteligencia Artificial hoy es tan importante y cuales son los escenarios para mi negocio sí decido esperar más tiempo?", value: "C", next: () => handleC() },
        { label: "D) ¿Cuánto cuesta implementar IA en mi negocio y en cuanto tiempo recuperaré mi inversión? ¿Tienen promociones?", value: "D", next: () => handleD() },
        { label: "E) Todas las anteriores", value: "E", next: () => handleE() }
      ]);
    }, 3000 + 250);
  }

  /* ---------- Handlers A..E (note suppressMenu flag for batch operations) ---------- */
  function handleA(suppressMenu = false){ HLOG.info("Handler A invoked", { suppressMenu }); askGiro(); if(!suppressMenu) addPendingTimeout(()=> showMainMenu(), 8000); }
  function handleB(suppressMenu = false){
    HLOG.info("Handler B invoked", { suppressMenu });
    const text = `Nombre comercial: Helios AI Labs.
Todos nuestros servicios de automatización con Inteligencia Artificial, desarrollo de Software y diseño de aplicaciones son facturados inmediatamente.
Ciudad / dirección:

Corporativo Matriz: Río Lerma 232 piso 23 Col. Cuauhtémoc, Alcaldía Cuauhtémoc, CP 06500, CDMX.
Sucursal Pachuca: Av. Revolución 300 Col. Periodista, CP 42060, Pachuca de Soto, Hidalgo.

Años de experiencia / trayectoria breve: 22 años de experiencia en el sector empresarial mexicano y estadounidense. Actualmente contamos con proyectos en desarrollo en Silicon Valley, Monterrey NL, Panamá, Panamá, Pachuca, Hidalgo y la Ciudad de México.
Garantía por escrito: Nuestro contrato está avalado por PROFECO y cuenta con todas las garantías de ley. Adicionalmente contamos con una garantía por escrito (incluida en el contrato), que protege a cada uno de nuestros clientes / inversores, para no pagar cuota mensual hasta recuperar su inversión inicial de "set up", en un plazo máximo de 3 meses. Todo ello con métricas y monitoreo de resultados 24/7 con Inteligencia Artificial.
Credenciales / certificaciones: n8n, make, zapier, Python, ML, Deep learning, Data science, Master Generative AI, LLMs & NLP JHU's, etc.
Todos nuestros clientes están protegidos con la más avanzada tecnología en cyberseguridad y sus identidades, información y proyectos, protegidos por "A non-disclosure agreement" (NDA) o contrato de confidencialidad.
Contacto directo con nuestros expertos y asistencia técnica 24/7 por WhatsApp: +52 771 762 2360

Formas de pago: ${FORMS_OF_PAYMENT}.`;
    addMessageDelayed(text, "bot", 3000);
    if(!suppressMenu) addPendingTimeout(()=> { addMessage("¿Desea ver las opciones nuevamente?"); addPendingTimeout(()=> showMainMenu(), 300); }, 7000);
  }
  function handleC(suppressMenu = false){
    HLOG.info("Handler C invoked", { suppressMenu });
    addMessageDelayed("Adoptar Inteligencia Artificial hoy es importante porque acelera procesos, reduce errores y permite tomar decisiones basadas en datos. Esperar implica perder ventaja competitiva, clientes potenciales y oportunidades de crecimiento, además de elevar el costo de implementación a futuro.", "bot", 3000);
    if(!suppressMenu) addPendingTimeout(()=> { addMessage("¿Desea ver las opciones nuevamente?"); addPendingTimeout(()=> showMainMenu(), 300); }, 7000);
  }
  function handleD(suppressMenu = false){
    HLOG.info("Handler D invoked", { suppressMenu });
    addMessageDelayed("Los costos de implementación varían según alcance. Contamos con paquetes y financiamiento; muchas implementaciones recuperan la inversión en menos de 3 meses dependiendo del caso.", "bot", 3000);
    if(!suppressMenu) addPendingTimeout(()=> { addMessage("¿Desea ver las opciones nuevamente?"); addPendingTimeout(()=> showMainMenu(), 300); }, 7000);
  }

  // E = "All of the above" -> show A,B,C,D sequentially but suppress their own menu returns, then show plan and offer scheduling
  function handleE(){
    HLOG.info("Handler E (All of the above) invoked - sequentializing A-D");
    clearPendingTimeouts();
    // call A-D with suppressMenu true so they don't each call showMainMenu
    handleA(true);
    handleB(true);
    handleC(true);
    handleD(true);
    // after total duration show combined closure and menu
    // estimate each block ~7s, so wait 12s before menu to allow reading
    addPendingTimeout(()=> {
      addMessage("Perfecto, puedo mostrarle un plan de acción inmediato y agendar una asesoría gratuita de diagnóstico.", "bot");
      addPendingTimeout(()=> openContactCapture(), 3000);
      // after offering contact we eventually show menu if needed (openContactCapture will wait for user)
    }, 12000);
  }

  /* ---------- A -> askGiro ---------- */
  function askGiro(){
    addMessage("Para responder a su pregunta, con la atención que usted se merece, por favor dígame: ¿En cuál de los siguientes giros se encuentra su negocio?", "bot");
    addPendingTimeout(()=> {
      addOptions([
        { label: "A) Salud", value:"Salud", next: ()=> askGiro_Salud() },
        { label: "B) Despacho Jurídico", value:"Despacho Jurídico", next: ()=> askGiro_Juridico() },
        { label: "C) Restaurante o Cafetería", value:"Restaurante o Cafetería", next: ()=> askGiro_Generic("Restaurante o Cafetería") },
        { label: "D) Sector inmobiliario", value:"Sector inmobiliario", next: ()=> askGiro_Generic("Sector inmobiliario") },
        { label: "E) Educación", value:"Educación", next: ()=> askGiro_Generic("Educación") },
        { label: "F) Creación de contenido", value:"Creación de contenido", next: ()=> askGiro_Generic("Creación de contenido") },
        { label: "G) Comercio (minorista / mayorista)", value:"Comercio (minorista / mayorista)", next: ()=> askGiro_Generic("Comercio (minorista / mayorista)") },
        { label: "H) Profesional independiente", value:"Profesional independiente", next: ()=> askGiro_Generic("Profesional independiente") },
        { label: "I) Belleza", value:"Belleza", next: ()=> askGiro_Generic("Belleza") },
        { label: "J) Otro", value:"Otro", next: ()=> askGiro_Generic("Otro") }
      ]);
    }, 3000);
  }

  /* ---------- FASE 3: subcategorias ---------- */
  function askGiro_Salud(){
    lead.industry = "Salud";
    addMessage("¿Cuál de las siguientes opciones describe mejor su negocio?", "bot");
    addPendingTimeout(()=> {
      addOptions([
        { label: "Consultorio propio", value:"Consultorio propio", next: ()=> renderPitch_Salud("Consultorio propio") },
        { label: "Clínica", value:"Clínica", next: ()=> renderPitch_Salud("Clínica") },
        { label: "Veterinaria", value:"Veterinaria", next: ()=> renderPitch_Salud("Veterinaria") },
        { label: "Hospital", value:"Hospital", next: ()=> renderPitch_Salud("Hospital") },
        { label: "Otro", value:"Otro", next: ()=> renderPitch_Salud("Otro") }
      ]);
    }, 3000);
  }

  function askGiro_Juridico(){
    lead.industry = "Despacho Jurídico";
    addMessage("¿Cuál de las siguientes describe mejor su despacho jurídico?", "bot");
    addPendingTimeout(()=> {
      addOptions([
        { label: "Pequeño despacho (1-3 abogados)", value:"Pequeño despacho (1-3 abogados)", next: ()=> renderPitch_Juridico("Pequeño despacho (1-3 abogados)") },
        { label: "Despacho mediano", value:"Despacho mediano", next: ()=> renderPitch_Juridico("Despacho mediano") },
        { label: "Despacho grande", value:"Despacho grande", next: ()=> renderPitch_Juridico("Despacho grande") },
        { label: "Otro", value:"Otro", next: ()=> renderPitch_Juridico("Otro") }
      ]);
    }, 3000);
  }

  function askGiro_Generic(val){
    lead.industry = val || "";
    addMessage("Gracias — estamos registrando su selección. (Próxima iteración: pitch específico para esta categoría).", "bot");
    addPendingTimeout(()=> askDiagnostic(), 700);
  }

  /* ---------- DIAGNOSTIC ---------- */
  function askDiagnostic(){
    addMessage("Para poder ayudarle de la mejor manera… ¿Qué le gustaría mejorar primero en su negocio?", "bot");
    addPendingTimeout(()=> {
      addOptions([
        { label: "A) Atraer más clientes / pacientes", value:"Atraer", next: ()=> diagnosticMarketingOrOperations("A") },
        { label: "B) Cerrar más ventas o consultas", value:"Cerrar", next: ()=> diagnosticMarketingOrOperations("B") },
        { label: "C) Ahorrar tiempo automatizando tareas internas", value:"Ahorrar", next: ()=> diagnosticMarketingOrOperations("C") },
        { label: "D) Mejorar atención y seguimiento de clientes", value:"Mejorar", next: ()=> diagnosticMarketingOrOperations("D") },
        { label: "E) Todo lo anterior", value:"Todo", next: ()=> diagnosticMarketingOrOperations("E") }
      ]);
    }, 3000);
  }

  function diagnosticMarketingOrOperations(choice){
    HLOG.debug("diagnosticMarketingOrOperations", { choice, industry: lead.industry });
    if(choice === "A" || choice === "B" || choice === "E"){
      addMessage("Y hoy… ¿quién maneja el marketing digital o la publicidad?", "bot");
      addPendingTimeout(()=> {
        addOptions([
          { label: "A) Yo mismo/a me encargo", value:"mkt_self", next: ()=> askMarketingBudget() },
          { label: "B) Lo hace alguien más o una agencia", value:"mkt_agency", next: ()=> askMarketingBudget() },
          { label: "C) No hacemos marketing digital actualmente", value:"mkt_none", next: ()=> askMarketingBudget() }
        ]);
      }, 3000);
    } else {
      addMessage("¿Qué tarea le consume más tiempo hoy y le gustaría automatizar primero?", "bot");
      addPendingTimeout(()=> {
        const items = [];
        if(lead.industry === "Salud"){
          items.push({ label: "citas", value:"citas", next: ()=> askInterestAndDecision() });
          items.push({ label: "recordatorios", value:"recordatorios", next: ()=> askInterestAndDecision() });
          items.push({ label: "pagos", value:"pagos", next: ()=> askInterestAndDecision() });
          items.push({ label: "seguimiento", value:"seguimiento", next: ()=> askInterestAndDecision() });
        } else if(lead.industry === "Despacho Jurídico"){
          items.push({ label: "captación de casos", value:"captacion", next: ()=> askInterestAndDecision() });
          items.push({ label: "documentación", value:"documentacion", next: ()=> askInterestAndDecision() });
          items.push({ label: "filtros legales", value:"filtros", next: ()=> askInterestAndDecision() });
        } else if(lead.industry === "Sector inmobiliario"){
          items.push({ label: "leads", value:"leads", next: ()=> askInterestAndDecision() });
          items.push({ label: "citas", value:"citas", next: ()=> askInterestAndDecision() });
          items.push({ label: "tours", value:"tours", next: ()=> askInterestAndDecision() });
          items.push({ label: "seguimiento", value:"seguimiento", next: ()=> askInterestAndDecision() });
        } else if(lead.industry === "Comercio (minorista / mayorista)"){
          items.push({ label: "inventarios", value:"inventarios", next: ()=> askInterestAndDecision() });
          items.push({ label: "WhatsApp", value:"whatsapp", next: ()=> askInterestAndDecision() });
          items.push({ label: "pedidos", value:"pedidos", next: ()=> askInterestAndDecision() });
          items.push({ label: "Planificación de Recursos EmpresariaLes", value:"planificacion", next: ()=> askInterestAndDecision() });
        } else if(lead.industry === "Belleza"){
          items.push({ label: "agenda", value:"agenda", next: ()=> askInterestAndDecision() });
          items.push({ label: "promociones automáticas", value:"promos", next: ()=> askInterestAndDecision() });
          items.push({ label: "reseñas", value:"reseñas", next: ()=> askInterestAndDecision() });
        } else {
          items.push({ label: "Automatizar tareas internas", value:"ops_generic", next: ()=> askInterestAndDecision() });
        }
        addOptions(items);
      }, 3000);
    }
  }

  function askMarketingBudget(){
    addMessage("¿Cuánto invierte aproximadamente al mes?", "bot");
    addPendingTimeout(()=> {
      addOptions([
        { label: "A) Menos de $3,000 MXN", value:"<3000", next: ()=> askReadyFor20Clients() },
        { label: "B) Entre $3,000 y $8,000 MXN", value:"3-8k", next: ()=> askReadyFor20Clients() },
        { label: "C) Más de $8,000 MXN", value:">8k", next: ()=> askReadyFor20Clients() },
        { label: "D) Mucho dinero y pocos resultados", value:"bad_spend", next: ()=> askReadyFor20Clients() }
      ]);
    }, 3000);
  }

  function askReadyFor20Clients(){
    addMessage("Si mañana le llegan 20 clientes nuevos… ¿Está listo para atenderlos?", "bot");
    addPendingTimeout(()=> {
      addOptions([
        { label: "Sí", value:"ready_yes", next: ()=> renderPitchForScale() },
        { label: "No", value:"ready_no", next: ()=> renderPitchForAutomation() }
      ]);
    }, 3000);
  }

  function renderPitchForScale(){ addMessageDelayed("Pitch agresivo (escala inmediata)", "bot", 3000); addPendingTimeout(()=> askInterestAndDecision(), 6000); }
  function renderPitchForAutomation(){ addMessageDelayed("Pitch enfocado en automatizar atención", "bot", 3000); addPendingTimeout(()=> askInterestAndDecision(), 6000); }

  /* ---------- PITCHES (literal texts unchanged) ---------- */
  function renderPitch_Salud(subcat){
    lead.subcategory = subcat || "";
    const text = `En consultorios y clínicas la automatización con IA puede contestar llamadas por voz o mensajes de texto, agendar citas y confirmar consultas por usted 24/7, enviar recordatorios a los pacientes (disminuyendo dramáticamente las consultas canceladas o los retrasos). Puede notificarle a Ud. directamente en caso de emergencia. Llevar un control de todos sus expedientes, cobrar consultas por adelantado con medios digitales, darle seguimiento a sus pacientes, enviar felicitaciones en días festivos. Puede aumentar el número de pacientes exponencialmente, de acuerdo a sus instrucciones.
Es importante entender que vivimos en la era de la transformación digital. Según la Curva de Adopción de Innovación de Rogers, las empresas y profesionales se dividen en cinco categorías: los Innovadores (2.5%) que adoptan tecnología primero, los Adoptadores Tempranos (13.5%) que lideran tendencias, la Mayoría Temprana (34%) que adopta cuando ven resultados comprobados, la Mayoría Tardía (34%) que se suma por presión competitiva, y los Rezagados (16%) que resisten el cambio hasta que es demasiado tarde. En el sector salud, quienes adoptan IA ahora se posicionan como líderes, mientras que esperar significa ceder pacientes y prestigio a la competencia que ya está automatizada.
Además, la automatización con IA atrae a un perfil de clientes con un mayor poder adquisitivo y eleva sustancialmente el ticket promedio.`;
    addMessageDelayed(text, "bot", 3000);
    addPendingTimeout(()=> {
      addMessage("Si la implementación fuera 100% accesible a su economía y garantizara recuperar su inversión en un máximo de 3 meses, ¿estaría listo(a) para decidir hoy?", "bot");
      addPendingTimeout(()=> {
        addOptions([
          { label: "A) Sí — Listo(a) para contratar hoy", value:"yes_now", next: ()=> openContactCapture() },
          { label: "B) Lo tengo que pensar", value:"think", next: ()=> handleThink() },
          { label: "C) Lo tengo que consultar (socio/jefe/esposo/esposa)", value:"consult", next: ()=> handleConsult() }
        ]);
      }, 3000);
    }, 7000);
  }

  function renderPitch_Juridico(subcat){
    lead.subcategory = subcat || "";
    const text = `⚖ [TÍTULO] [APELLIDO], en su profesión la confianza, velocidad y resultados lo son todo.
La automatización con IA puede contestar llamadas por voz o mensajes de texto, responder dudas y preguntas frecuentes a sus clientes 24/7, agendar citas, enviar recordatorios, confirmar reuniones de trabajo, etc.
Con IA puede lograr:
✅ Más casos sin invertir más tiempo
✅ Filtro automático de prospectos con capacidad económica real
✅ Respuestas legales 24/7 con seguimiento de clientes
✅ Control total de expedientes y fechas críticas
✅ Ventas consultivas con storytelling legal
✅ Casos mejor pagados — honorarios más altos
📌 Usted se enfoca en ganar…
La IA se encarga de llenar su despacho.
Es importante entender que vivimos en la era de la transformación digital. Según la Curva de Adopción de Innovación de Rogers, las empresas y profesionales se dividen en cinco categorías: los Innovadores (2.5%) que adoptan tecnología primero, los Adoptadores Tempranos (13.5%) que lideran tendencias, la Mayoría Temprana (34%) que adopta cuando ven resultados comprobados, la Mayoría Tardía (34%) que se suma por presión competitiva, y los Rezagados (16%) que resisten el cambio hasta que es demasiado tarde. En el sector jurídico, quienes adoptan IA ahora se posicionan como líderes, mientras que esperar significa ceder casos y prestigio a la competencia que ya está automatizada.
Además, la automatización con IA atrae a un perfil de clientes con mayor poder adquisitivo y eleva sustancialmente el ticket promedio.`;
    addMessageDelayed(text, "bot", 3000);
    addPendingTimeout(()=> {
      addMessage("Si la implementación fuera 100% accesible a su economía y garantizara recuperar su inversión en un máximo de 3 meses, ¿estaría listo(a) para decidir hoy?", "bot");
      addPendingTimeout(()=> {
        addOptions([
          { label: "A) Sí — Listo(a) para contratar hoy", value:"yes_now", next: ()=> openContactCapture() },
          { label: "B) Lo tengo que pensar", value:"think", next: ()=> handleThink() },
          { label: "C) Lo tengo que consultar (socio/jefe/esposo/esposa)", value:"consult", next: ()=> handleConsult() }
        ]);
      }, 3000);
    }, 7000);
  }

  // Generic mapping (texts preserved); for brevity other renderPitch_Generic entries follow same pattern
  function renderPitch_Generic(giro){
    lead.subcategory = giro || "";
    const mapTexts = {
      "Sector inmobiliario": `🏡 [TÍTULO] [APELLIDO], hoy el 95% de las personas buscan propiedades en internet.
La automatización con IA puede contestar llamadas por voz o mensajes de texto, responder dudas y preguntas frecuentes a sus clientes 24/7, agendar citas, enviar recordatorios, confirmar reuniones de trabajo, etc.
Si escriben y nadie responde de inmediato…
👉 Se van con otro agente
Nuestra IA trabaja como su co-closer 24/7:
✅ Responde al instante por WhatsApp & redes
✅ Agenda visitas y videollamadas sola
✅ Filtra clientes con presupuesto real
✅ Envía recordatorios hasta confirmar
✅ Da seguimiento post-visita
Además, la IA también filtra las mejores propiedades para obtener exclusividad y que solamente aquellas propiedades que tengan todos los documentos en regla y estén listas para ser vendidas llegarán al agente / broker, etc. ahorrándole mucho tiempo dado que no perderá tiempo en propiedades irregulares o con status legal incierto.
Resultado en agencias como la suya:
→ 300% más clientes calificados
→ 3X cierres en 90 días
Además, la automatización con IA atrae a un perfil de clientes con un mayor poder adquisitivo y eleva sustancialmente el ticket promedio.`,
      "Restaurante o Cafetería": `🍽 [TÍTULO] [APELLIDO], en su negocio cada mensaje que llega por WhatsApp o redes es un cliente listo para comprar ahora.
Nuestra IA trabaja como anfitriona 24/7:
✅ Responde al instante
✅ Gestiona pedidos
✅ Agenda reservaciones
✅ Recomienda platillos populares
✅ Confirma asistencia con anticipación
Resultado real en negocios como el suyo:
→ 2X a 4X más ventas en menos de 90 días
→ Menos mesas vacías, más ingresos diarios
Además, la automatización con IA atrae a un perfil de clientes con mayor poder adquisitivo y eleva sustancialmente el ticket promedio.`,
      "Educación": `🎓 [TÍTULO] [APELLIDO], hoy los padres y alumnos toman decisiones en cuestión de minutos.
Nuestra IA es su coordinadora de admisiones 24/7:
✅ Responde al instante dudas sobre costos, horarios, requisitos (sin errores)
✅ Agenda visitas y entrevistas sola
✅ Da seguimiento hasta la inscripción
✅ Recordatorios automáticos de pagos
✅ Retiene alumnos para evitar deserción
Resultado en instituciones como la suya:
→ +30% a +200% más inscripciones
→ Menos abandono
→ Más ingresos recurrentes`,
      "Comercio (minorista / mayorista)": `🛍 [TÍTULO] [APELLIDO], en comercio la venta ocurre en el mismo momento en que el cliente pregunta.
Nuestra IA se convierte en su mejor vendedor 24/7:
✅ Responde WhatsApp e Instagram al instante
✅ Muestra catálogo y precios
✅ Recomienda productos con mayor margen
✅ Agrega al carrito y cobra sola
✅ Verifica existencias en inventario
✅ Envío o pickup automatizado
Resultado real:
→ 2X a 5X ventas en menos de 90 días`,
      "Profesional independiente": `👔 [TÍTULO] [APELLIDO], cuando una persona trabaja por su cuenta… el tiempo es el recurso más valioso y cada hora que no factura… es dinero perdido.
Nuestra IA se encarga de:
✅ Responder a todos los interesados al instante
✅ Filtrar clientes sin presupuesto
✅ Agendar citas automáticamente
✅ Cerrar prospectos mientras usted trabaja`,
      "Creación de contenido": `📱 [TÍTULO] [APELLIDO], tu marca puede multiplicar ventas sin saturarte.
La automatización con IA puede contestar llamadas por voz o mensajes de texto, responder dudas y preguntas frecuentes a sus clientes 24/7, agendar citas, enviar recordatorios, confirmar reuniones de trabajo, etc.
La IA:
✅ Responde y convierte seguidores en clientes
✅ Crea contenido, guiones y copy optimizados
✅ Automatiza ventas de cursos, citas y productos digitales`,
      "Belleza": `💄 [TÍTULO] [APELLIDO], cuando alguien quiere un servicio de belleza la decisión la toma en ese mismo momento.
Nuestra IA trabaja como su recepcionista perfecta 24/7:
✅ Responde al instante
✅ Agenda citas sola
✅ Envía recordatorios
✅ Reduce cancelaciones +80%
✅ Da seguimiento hasta que el cliente confirma`
    };

    const txt = mapTexts[giro] || `Pronto le mostraremos un plan específico para su giro.`;
    addMessageDelayed(txt, "bot", 3000);
    addPendingTimeout(()=> {
      addMessage("Si la implementación fuera 100% accesible a su economía y garantizara recuperar su inversión en un máximo de 3 meses, ¿estaría listo(a) para decidir hoy?", "bot");
      addPendingTimeout(()=> {
        addOptions([
          { label: "A) Sí — Listo(a) para contratar hoy", value:"yes_now", next: ()=> openContactCapture() },
          { label: "B) Lo tengo que pensar", value:"think", next: ()=> handleThink() },
          { label: "C) Lo tengo que consultar (socio/jefe/esposo/esposa)", value:"consult", next: ()=> handleConsult() }
        ]);
      }, 3000);
    }, 7000);
  }

  /* ---------- FASE 7: closure / objections ---------- */
  function askInterestAndDecision(){
    addMessage("Si la implementación fuera 100% accesible a su economía y garantizara recuperar su inversión en un máximo de 3 meses, ¿estaría listo(a) para decidir hoy?", "bot");
    addPendingTimeout(()=> {
      addOptions([
        { label: "A) Sí — Listo(a) para contratar hoy", value:"yes_now", next: ()=> openContactCapture() },
        { label: "B) Lo tengo que pensar", value:"think", next: ()=> handleThink() },
        { label: "C) Lo tengo que consultar (socio/jefe/esposo/esposa)", value:"consult", next: ()=> handleConsult() }
      ]);
    }, 3000);
  }

  function handleThink(){
    addMessage("¿Qué porcentaje de la decisión de implementar una automatización de IA en su negocio depende de usted?", "bot");
    addPendingTimeout(()=> {
      addOptions([
        { label: "A) Menos de 50%", value:"lt50", next: ()=> { lead.decisionPower = "lt50"; addMessage("Entiendo."); askDecisionIfHalfOrMore(false); } },
        { label: "B) 50%", value:"50", next: ()=> { lead.decisionPower = "50"; addMessage("Perfecto."); askDecisionIfHalfOrMore(true); } },
        { label: "C) Más de 50%", value:"gt50", next: ()=> { lead.decisionPower = "gt50"; addMessage("Perfecto."); askDecisionIfHalfOrMore(true); } }
      ]);
    }, 3000);
  }

  function askDecisionIfHalfOrMore(isHalfOrMore){
    if(isHalfOrMore){
      addMessage("Si el 50% de su decisión en realidad fuera un 100% ¿estaría decidido a adquirir en este momento?", "bot");
      addPendingTimeout(()=> {
        addOptions([
          { label: "Sí", value:"final_yes", next: ()=> { lead.decisionPower = lead.decisionPower || "50+"; openContactCapture(); } },
          { label: "No", value:"final_no", next: ()=> { addMessage("Entiendo. Le enviaremos una presentación."); offerPresentation(); } }
        ]);
      }, 3000);
    } else {
      addMessage("[TÍTULO] [APELLIDO] usted es un profesional que ha tomado decisiones toda su vida, cada decisión que ha tomado, ha determinado sus éxitos y adversidades, esta es simplemente una decisión más. Si usted pudiera predecir con certeza matemática y con métricas de inteligencia predictiva el retorno de su inversión, respaldado por un contrato por escrito y con la garantía de que en un máximo de 3 meses usted recuperará su inversión ¿estaría listo para tomar la decisión el día de hoy?", "bot");
      addPendingTimeout(()=> {
        addOptions([
          { label: "Sí", value:"indeciso_yes", next: ()=> { lead.decisionPower = "lt50_final_yes"; openContactCapture(); } },
          { label: "No", value:"indeciso_no", next: ()=> { addMessage("Entiendo. Le enviaremos una presentación."); offerPresentation(); } }
        ]);
      }, 4000);
    }
  }

  function offerPresentation(){
    addMessage("Perfecto. ¿Cuál email usamos para enviar la presentación?", "bot");
    currentStep = "capturePresentationEmail";
    unlockInput();
  }

  function handleConsult(){
    addMessage("¿Desea que le enviemos una presentación por email o prefiere agendar una reunión con su decisor?", "bot");
    addPendingTimeout(()=> {
      addOptions([
        { label: "A) Enviar presentación (email)", value:"send_pres", next: ()=> askEmailForPresentation() },
        { label: "B) Agendar reunión con decisor", value:"agendar_decisor", next: ()=> openContactCapture() }
      ]);
    }, 3000);
  }

  function askEmailForPresentation(){
    addMessage("Por favor ingrese su email en el campo inferior y presione Enviar.", "bot");
    currentStep = "capturePresentationEmail";
    unlockInput();
  }

  /* ---------- FASE 8: contact capture (flexible parsing) ---------- */
  function openContactCapture(){
    addMessage("Perfecto. Para agendar necesito: Teléfono (WhatsApp), Email, Día preferido y Hora aproximada.", "bot");
    currentStep = "captureContactLine";
    unlockInput();
  }

  // flexible contact parser: accepts commas, newline, " y ", or just tokens
  function parseContactLine(line){
    const raw = String(line || "").trim();
    HLOG.debug("parseContactLine input", raw);
    // try to extract email
    const emailRx = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
    const emailMatch = raw.match(emailRx);
    let email = emailMatch ? emailMatch[1] : "";

    // remove email from remaining for phone search
    let remaining = raw;
    if(email){
      remaining = remaining.replace(email, " ");
    }

    // phone regex: international or local common patterns, allow spaces/dashes
    const phoneRx = /(\+?\d[\d\s\-]{6,20}\d)/;
    const phoneMatch = remaining.match(phoneRx);
    let phone = phoneMatch ? phoneMatch[1].replace(/\s+/g, " ").trim() : "";

    // try to find day/time phrases by splitting by commas/newlines and removing phone/email pieces
    const parts = raw.split(/,|\n|;/).map(p=>p.trim()).filter(Boolean);
    // prioritize parts without phone or email
    const others = parts.filter(p => !p.includes(email) && !p.includes(phone));
    let day = others[0] || "";
    let time = others[1] || "";

    // fallback: attempt split by " " after removing email/phone
    if(!day && remaining.trim()){
      const tokens = remaining.split(/\s{2,}| y |\/|-/).map(t=>t.trim()).filter(Boolean);
      day = tokens[0] || "";
      time = tokens[1] || "";
    }

    return { phone, email, day, time };
  }

  function handleEvasiveContact(){
    addMessage('Claro que sí [TÍTULO] [APELLIDO], le comparto nuestro WhatsApp directo donde uno de nuestros ingenieros expertos puede atenderle de manera personalizada en cualquier momento que usted lo requiera: +52 771 762 2360', "bot");
    // no automatic sending
  }

  function insistenceAnecdote(){
    addMessage('Muy bien [TÍTULO], pero antes de despedirnos le voy a contar brevemente una anécdota... ¿Le gustaría agendar una asesoría gratuita de 20 minutos que puede transformar su negocio para siempre o prefiere escribir HELIOS en un papelito?', "bot");
    addPendingTimeout(()=> {
      addOptions([
        { label: "Agendar asesoría gratuita de 20 minutos", value:"agendar_20", next: ()=> openContactCapture() },
        { label: "Prefiero escribir HELIOS en un papelito", value:"papelito", next: ()=> { addMessage("Entendido. Si cambia de opinión, aquí estamos."); } }
      ]);
    }, 3000);
  }

  /* ---------- Input handling (submit) ---------- */
  sendBtn.addEventListener("click", onSubmit);
  inputField.addEventListener("keydown", (e) => { if (e.key === "Enter") onSubmit(); });

  async function onSubmit(){
    const raw = (inputField.value || "").trim();
    if(!raw) return;

    if(optionsVisible){
      addMessage("Por favor seleccione una de las opciones mostradas arriba.", "bot");
      inputField.value = "";
      return;
    }

    // show user bubble
    addMessage(raw, "user");
    inputField.value = "";
    lead.responses.push({ text: raw, ts: new Date().toISOString() });

    // typed step handling
    if(currentStep === "captureName"){
      // parse name robustly
      const parsed = parseName(raw);
      lead.fullName = parsed.fullName;
      lead.givenName = parsed.givenName;
      lead.surname = parsed.surname;
      HLOG.info("Name captured", { fullName: lead.fullName, given: lead.givenName, surname: lead.surname });
      // explicitly ask title choice
      addMessage("¿Cómo prefiere que me dirija a usted? Elija una opción:", "bot");
      const titleItems = TITLE_CHOICES.map(t => ({ label: t, value: t, next: (v) => {
        lead.title = v;
        HLOG.info("Title selected", { title: v });
        addMessage(`Excelente ${lead.title} ${lead.surname}. Gracias.`, "bot");
        currentStep = null;
        // after a short pause show main menu
        addPendingTimeout(()=> showMainMenu(), 700);
      }}));
      addPendingTimeout(()=> addOptions(titleItems), 3000);
      currentStep = null;
      return;
    }

    if(currentStep === "capturePresentationEmail"){
      // validate email-ish
      const emailRx = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
      const m = raw.match(emailRx);
      if(!m){
        addMessage("No detecté un email válido. Por favor ingrese su correo (ej. correo@ejemplo.com).", "bot");
        return;
      }
      lead.email = m[1];
      HLOG.info("Presentation email captured", { email: lead.email });
      const ok = await sendLeadPayload({ wantsPresentation: true, emailCaptured: true });
      if(ok){
        addMessage("Perfecto — le enviaremos la presentación a ese correo. Gracias.", "bot");
      } else {
        addMessage("Perfecto — hemos guardado su email y intentaremos enviar la presentación. Mientras tanto, su información está segura.", "bot");
      }
      currentStep = null;
      addPendingTimeout(()=> showMainMenu(), 700);
      return;
    }

    if(currentStep === "captureContactLine"){
      const parsed = parseContactLine(raw);
      HLOG.info("Contact line parsed", parsed);
      if(!parsed.phone && !parsed.email){
        addMessage("Por favor ingrese al menos Teléfono (WhatsApp) y Email o al menos uno de ellos separados por comas.", "bot");
        return;
      }
      // assign if missing
      if(parsed.phone) lead.phone = lead.phone || parsed.phone;
      if(parsed.email) lead.email = lead.email || parsed.email;
      if(parsed.day) lead.preferredDay = parsed.day;
      if(parsed.time) lead.preferredTime = parsed.time;
      addMessage("Gracias. En breve recibirá confirmación por email si procede.", "bot");
      currentStep = null;
      const extra = { schedule: !!lead.email, emailCaptured: !!lead.email };
      const ok = await sendLeadPayload(extra);
      if(!ok){
        addMessage("⚠️ No pudimos enviar la información al servidor. Su lead queda guardado localmente y puede contactarnos por WhatsApp: +52 771 762 2360", "bot");
      }
      return;
    }

    // fallback: reopen menu
    addMessage("No entendí exactamente — ¿Desea ver las opciones nuevamente?", "bot");
    addPendingTimeout(()=> showMainMenu(), 400);
  }

  /* ---------- send lead payload (POST) ---------- */
  async function sendLeadPayload(extra = {}){
    HLOG.info("Preparing lead payload", { leadSnapshot: { name: lead.fullName, email: lead.email, phone: lead.phone } });
    // prevent duplicate sends: only proceed if changed or not yet sent
    if(lead.sent){
      HLOG.warn("Lead already marked as sent; skipping duplicate send.");
      return true;
    }

    const payload = {
      sessionId,
      timestamp: new Date().toISOString(),
      lead: {
        fullName: lead.fullName || "",
        givenName: lead.givenName || "",
        surname: lead.surname || "",
        title: lead.title || "",
        gender: lead.gender || "",
        industry: lead.industry || "",
        subcategory: lead.subcategory || "",
        marketingBudget: lead.marketingBudget || "",
        decisionPower: lead.decisionPower || "",
        interestLevel: lead.interestLevel || "",
        phone: lead.phone || "",
        email: lead.email || "",
        preferredDay: lead.preferredDay || "",
        preferredTime: lead.preferredTime || "",
        responses: lead.responses || []
      },
      extra: {
        emailCopyTo: EMAIL_COPY_TO,
        formsOfPayment: FORMS_OF_PAYMENT,
        ...extra
      }
    };

    addMessage("Enviando información y preparando confirmación...", "bot");
    HLOG.info("Sending payload to webhook (POST)", { url: WEBHOOK_URL, payloadSummary: { sessionId: payload.sessionId, email: payload.lead.email } });

    try {
      const res = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      HLOG.debug("Webhook response status", res.status);
      if(!res.ok){
        // read body if available for diagnostic
        let text = "";
        try { text = await res.text(); } catch(e) { text = "<no body>"; }
        HLOG.error("Webhook returned non-OK status", { status: res.status, body: text });
        // do NOT mark lead.sent true
        return false;
      }
      // optionally parse JSON
      let j = null;
      try { j = await res.json(); } catch(e) { j = null; }
      HLOG.info("Webhook returned success", j);
      // mark as sent only after success
      lead.sent = true;
      addMessage("✅ ¡Listo! Hemos enviado la información. En breve recibirá confirmación por email.", "bot");
      return true;
    } catch(err){
      HLOG.error("Error sending payload to webhook (network or CORS)", err);
      return false;
    }
  }

  /* ---------- Init ---------- */
  unlockInput();
  startChat();
});
