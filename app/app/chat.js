/* app/chat.js - Helios AI Labs
   PART 1/2 - Paste this block first, then paste PART 2/2 immediately after.
   - Verbose technical logs in English
   - Pauses: READ_PAUSE_MS between blocks (3s)
   - All user-provided pitch texts preserved verbatim
   - Multiple fixes integrated: pendingTimeouts, sanitize+interpolate, name parsing, contact parsing, suppressMenu, conversationEnded, lead.lastSentHash, AbortController usage (sendLeadPayload in part 2)
*/

/* ---------- CONFIG ---------- */
const WEBHOOK_URL = "https://heliosailabs369.app.n8n.cloud/webhook/chatbot-groq";
const EMAIL_COPY_TO = "heliosailabs@gmail.com";
const FORMS_OF_PAYMENT = "Transferencia bancaria, todas las tarjetas de crédito y debito VISA, Mastercard y American Express, Bitcoin y ETH.";
const READ_PAUSE_MS = 3000; // 3 seconds pause for reading blocks
const FETCH_TIMEOUT_MS = 10000; // used in sendLeadPayload (part 2) via AbortController
const FETCH_RETRY = 1; // number of retries on network failure

/* ---------- DOM bindings ---------- */
const messagesContainer = document.getElementById("messages");
const inputField = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");

if (!messagesContainer || !inputField || !sendBtn) {
  console.error("[helios][fatal] Missing DOM elements. Ensure #messages, #userInput and #sendBtn exist.");
  throw new Error("Missing required DOM elements");
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
console.log("[helios][info] Session initialized", { sessionId });

let lead = {
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
  lastSentHash: null,
  lastSentAt: null,
  sent: false
};

/* ---------- State flags ---------- */
let currentStep = null; // "captureName", "capturePresentationEmail", "captureContactLine", null
let optionsVisible = false;
let lastOptionsWrapper = null;
let pendingTimeouts = [];
let conversationEnded = false;
let suppressMenu = false; // used when handleE runs combined content

/* ---------- Helper: pending timeouts management ---------- */
function addPendingTimeout(fn, ms){
  const id = setTimeout(() => {
    // remove id from pendingTimeouts once executed
    pendingTimeouts = pendingTimeouts.filter(t => t !== id);
    try { fn(); } catch(e){ console.error("[helios][error] addPendingTimeout handler threw:", e); }
  }, ms);
  pendingTimeouts.push(id);
  return id;
}
function clearPendingTimeouts(){
  pendingTimeouts.forEach(clearTimeout);
  pendingTimeouts = [];
  console.debug("[helios][debug] cleared pendingTimeouts");
}

/* ---------- Helper: HTML escape & interpolation ---------- */
function escapeHtml(str){
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function interpolateLeadData(text){
  if (!text) return "";
  const fallbackTitle = lead.title || "Cliente";
  const fallbackSurname = lead.surname || lead.givenName || "Cliente";
  // simple placeholder replacements; preserve original capitalization
  return String(text)
    .replace(/\[TÍTULO\]|\[TITULO\]/g, escapeHtml(fallbackTitle))
    .replace(/\[APELLIDO\]/g, escapeHtml(fallbackSurname))
    .replace(/\$\\{TÍTULO\\\}/g, escapeHtml(fallbackTitle)) // unlikely, but safe
    .replace(/\$\{TÍTULO\}/g, escapeHtml(fallbackTitle))
    .replace(/\$\{APELLIDO\}/g, escapeHtml(fallbackSurname));
}

/* ---------- UI helpers ---------- */
function addMessage(rawText, sender = "bot"){
  // interpolate and escape; bot messages may include placeholders
  const processed = sender === "bot" ? interpolateLeadData(rawText) : escapeHtml(rawText);
  const el = document.createElement("div");
  el.classList.add("message", sender);
  // safe: using innerHTML because we escaped variables and text
  el.innerHTML = processed.replace(/\n/g, "<br/>");
  messagesContainer.appendChild(el);
  // accessibility: announce to screen readers
  messagesContainer.setAttribute("aria-live", "polite");
  setTimeout(()=> messagesContainer.scrollTop = messagesContainer.scrollHeight, 40);
  console.debug("[helios][debug] addMessage", { sender, preview: processed.slice(0,100) });
  return el;
}

function addMessageDelayed(text, sender="bot", delay = READ_PAUSE_MS){
  // wrapper to schedule message with pendingTimeouts
  return addPendingTimeout(()=> addMessage(text, sender), delay);
}

function clearLastOptions(){
  if (lastOptionsWrapper){
    lastOptionsWrapper.remove();
    lastOptionsWrapper = null;
  }
  optionsVisible = false;
  unlockInput();
}

/* ---------- Input locking helpers ---------- */
function lockInput(placeholder = "Selecciona una opción desde las burbujas..."){
  optionsVisible = true;
  inputField.disabled = true;
  sendBtn.disabled = true;
  inputField.placeholder = placeholder;
  inputField.classList.add("disabled");
  console.debug("[helios][debug] input locked");
}
function unlockInput(){
  optionsVisible = false;
  inputField.disabled = false;
  sendBtn.disabled = false;
  inputField.placeholder = "Escribe aquí...";
  inputField.classList.remove("disabled");
  console.debug("[helios][debug] input unlocked");
}

/* ---------- Options renderer (buttons) ---------- */
function addOptions(items){
  // items: [{ label: "...", value: "...", next: function }, ...]
  clearLastOptions();
  const wrapper = document.createElement("div");
  wrapper.classList.add("message", "bot");
  const row = document.createElement("div");
  row.classList.add("option-row");

  items.forEach(it => {
    const btn = document.createElement("button");
    btn.classList.add("option-btn");
    btn.type = "button";
    btn.innerText = it.label; // keep literal text
    btn.addEventListener("click", () => {
      addMessage(it.label, "user");
      lead.responses.push({ option: it.value || it.label, label: it.label, ts: new Date().toISOString() });
      Array.from(row.querySelectorAll("button")).forEach(b => b.disabled = true);
      // small delay then call handler
      addPendingTimeout(() => {
        clearLastOptions();
        try {
          if (typeof it.next === "function") it.next(it.value);
          else console.warn("[helios][warn] option has no next function", it);
        } catch(e){
          console.error("[helios][error] option handler threw:", e);
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
  console.debug("[helios][debug] addOptions rendered", items.map(i=>i.label));
}

/* ---------- Name parsing (robust) ---------- */
const NAME_CONNECTORS = ["de","del","la","las","los","y"];
function parseName(raw){
  if(!raw) return { full: "", given: "", surname: "" };
  let s = String(raw).trim();
  // normalize phrases like "soy", "me llamo", "buenas noches soy", etc.
  s = s.replace(/^(buenas\s*(noches|tardes|días|dias)|buenos\s*(días|dias)|hola|holá)\s*/i, "");
  s = s.replace(/^(soy|me llamo|mi nombre es)\s*/i, "");
  s = s.replace(/[.,;!¿?]+/g, " ");
  s = s.replace(/\s+/g, " ").trim();

  // If begins with title like "Dr." "Dra." "Lic." remove it for name parts; but keep title separately
  const titlePattern = /^(Dr\.|Dra\.|Dr|Dra|Lic\.|Lic|Ing\.|Ing|Sr\.|Sra\.|Profesor|Profesora|Prof\.|Mtro\.|Mtra\.|Arq\.|Arq)/i;
  let titleMatch = s.match(titlePattern);
  if (titleMatch){
    // store candidate title if user didn't give explicit later
    const t = titleMatch[0].replace(/\.$/,"");
    if (!lead.title) lead.title = t;
    s = s.replace(titlePattern, "").trim();
  }

  const parts = s.split(/\s+/);
  if (parts.length === 0) return { full: raw, given: raw, surname: raw };

  // attempt to construct surname preserving connectors (de la, del, etc.)
  let surname = parts[parts.length - 1];
  if (parts.length >= 2){
    const penult = parts[parts.length - 2].toLowerCase();
    if (NAME_CONNECTORS.includes(penult)){
      // include connector with surname: e.g., "del Río"
      surname = `${parts[parts.length - 2]} ${surname}`;
      // remove last two from given
      parts.splice(parts.length - 2, 2);
    } else {
      parts.splice(parts.length - 1, 1); // remove surname from parts
    }
  } else {
    // single token name
    parts.splice(0, 1); // leave parts empty
  }
  const given = parts.join(" ").trim();

  const full = (given ? (given + " ") : "") + surname;
  console.debug("[helios][debug] parseName", { raw, full, given, surname });
  return { full, given: given || surname, surname: surname || given || full };
}

/* ---------- Contact parsing (flexible) ---------- */
function parseContactLine(raw){
  if(!raw) return {};
  let s = String(raw).trim();
  // replace newlines with commas to unify
  s = s.replace(/\r?\n/g, ",").replace(/\s+y\s+/gi, ",");
  // split by comma
  const parts = s.split(",").map(p => p.trim()).filter(Boolean);

  // heuristics: find email first, then phone, then day/time
  let email = "";
  let phone = "";
  let preferredDay = "";
  let preferredTime = "";

  for (let i = 0; i < parts.length; i++){
    const p = parts[i];
    const maybeEmail = p.match(/[^\s@]+@[^\s@]+\.[^\s@]+/);
    if (maybeEmail && !email) {
      email = maybeEmail[0].toLowerCase();
      continue;
    }
    const phoneCandidate = p.match(/(\+?\d[\d\s\-().]{6,}\d)/);
    if (phoneCandidate && !phone){
      phone = normalizePhone(phoneCandidate[0]);
      continue;
    }
    // heuristics for day/time (e.g., "Sabado 9 de noviembre a la 1 de la tarde", "viernes, 3pm")
    if (!preferredDay && /lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo|lunes|monday|tuesday|wednesday|thursday|friday|saturday|sunday|am|pm|:\d{2}/i.test(p)){
      // simple put into day/time fields
      if (/am|pm|:\d{2}|hora|h|a la/i.test(p)) preferredTime = p;
      else preferredDay = p;
      continue;
    }
    // otherwise if leftover and phone empty try to extract digits-only
    if (!phone){
      const digits = (p.match(/\d/g)||[]).join("");
      if (digits.length >= 7 && digits.length <= 15){
        phone = normalizePhone(digits);
        continue;
      }
    }
  }

  // fallback: if parts length 1 and contains both phone and email separated by space
  if (!email && !phone && parts.length === 1){
    const p = parts[0];
    const maybeEmail = p.match(/[^\s@]+@[^\s@]+\.[^\s@]+/);
    if (maybeEmail) email = maybeEmail[0];
    const phoneCandidate = p.match(/(\+?\d[\d\s\-().]{6,}\d)/);
    if (phoneCandidate) phone = normalizePhone(phoneCandidate[0]);
  }

  console.debug("[helios][debug] parseContactLine result", { email, phone, preferredDay, preferredTime });
  return { email, phone, preferredDay, preferredTime };
}

/* ---------- Phone normalization ---------- */
function normalizePhone(raw){
  if(!raw) return "";
  let s = String(raw).trim();
  // keep + and digits only (and spaces will be removed)
  s = s.replace(/[^\d+]/g, "");
  // If it's 10 digits and likely Mexican local number, add +52
  const digits = s.replace(/\D/g,"");
  if (!s.startsWith("+") && digits.length === 10){
    s = "+52" + digits;
  }
  // ensure + prefix for international formatting if missing
  if (!s.startsWith("+")) s = "+" + digits;
  return s;
}

/* ---------- Compute payload hash to prevent duplicate sends ---------- */
function computePayloadHash(obj){
  try {
    const str = JSON.stringify(obj);
    // simple hash: djb2
    let hash = 5381;
    for (let i = 0; i < str.length; i++){
      hash = ((hash << 5) + hash) + str.charCodeAt(i);
      hash = hash & 0xFFFFFFFF;
    }
    return "h" + (hash >>> 0).toString(16);
  } catch(e){
    console.error("[helios][error] computePayloadHash failed", e);
    return null;
  }
}

/* ---------- Titles choices (literal) ---------- */
const TITLE_CHOICES = [
  "Dr.", "Dra.", "Arq.", "Lic.", "Ing.", "C.P.", "Mtro.", "Mtra.",
  "Sr.", "Sra.", "Srita.", "Don", "Doña", "Profesor", "Profesora", "Coach", "Chef", "Otro"
];

/* ---------- FLOW (literal content preserved) ---------- */

/* -- Start / greeting -- */
function startChat(){
  if (conversationEnded){
    console.debug("[helios][info] conversationEnded=true, startChat suppressed");
    return;
  }
  clearPendingTimeouts();
  addMessage("¡Hola! Soy Helios, Asesor Comercial Senior de Helios AI Labs. ¿Con quién tengo el gusto?");
  currentStep = "captureName";
  unlockInput();
  console.log("[helios][info] Chatbot initialized and awaiting user input");
}

/* -- Main menu (A..E) -- */
function showMainMenu(){
  if (conversationEnded) {
    console.debug("[helios][info] showMainMenu suppressed because conversationEnded");
    return;
  }
  clearPendingTimeouts();
  clearLastOptions();
  addMessage("Gracias por contactarnos, somos Helios AI Labs. Para proporcionarle la mejor atención, personalizada y diseñar para usted un traje a la medida ¿Cuál de las siguientes preguntas desea que respondamos para usted?");
  addPendingTimeout(()=> {
    addOptions([
      { label: "A) ¿Cómo funciona la automatización de procesos con IA y qué beneficios medibles puede aportar a mi negocio?", value: "A", next: () => handleA() },
      { label: "B) Quiero información sobre su empresa, ubicación, experiencia, credenciales, referencias, información fiscal, contrato, garantía por escrito, etc.", value: "B", next: () => handleB() },
      { label: "C) ¿Por qué adoptar Inteligencia Artificial hoy es tan importante y cuales son los escenarios para mi negocio sí decido esperar más tiempo?", value: "C", next: () => handleC() },
      { label: "D) ¿Cuánto cuesta implementar IA en mi negocio y en cuanto tiempo recuperaré mi inversión? ¿Tienen promociones?", value: "D", next: () => handleD() },
      { label: "E) Todas las anteriores", value: "E", next: () => handleE() }
    ]);
  }, 300);
}

/* ---------- Handlers A..E (with suppressMenu flag support) ---------- */
function handleA(suppress = false){
  clearPendingTimeouts();
  clearLastOptions();
  console.debug("[helios][debug] handleA called", { suppress });
  addMessage("Para responder a su pregunta, con la atención que usted se merece, por favor dígame: ¿En cuál de los siguientes giros se encuentra su negocio?");
  addPendingTimeout(()=> askGiro(), READ_PAUSE_MS);
  if (!suppress){
    addPendingTimeout(()=> showMainMenu(), READ_PAUSE_MS * 4);
  }
}
function handleB(suppress = false){
  clearPendingTimeouts();
  clearLastOptions();
  console.debug("[helios][debug] handleB called", { suppress });
  const text = `Nombre comercial: Helios AI Labs.
Todos nuestros servicios de automatización con Inteligencia Artificial, desarrollo de Software y diseño de aplicaciones son facturados inmediatamente. (Esto incluye contrataciones pagadas con Crypto, medios digitales, transferencias, pago en efectivo).
Ciudad / dirección:

Corporativo Matriz: Río Lerma 232 piso 23 Col. Cuauhtémoc, Alcaldía Cuauhtémoc, CP 06500, CDMX.
Sucursal Pachuca: Av. Revolución 300 Col. Periodista, CP 42060, Pachuca de Soto, Hidalgo.

Años de experiencia / trayectoria breve: 22 años de experiencia en el sector empresarial mexicano y estadounidense. Actualmente contamos con proyectos en desarrollo en Silicon Valley, Monterrey NL, Panamá, Panamá, Pachuca, Hidalgo y la Ciudad de México, somos una empresa familiar de inventores, genios de la tecnología, nerds, filósofos, artistas y expertos en Inteligencia Artificial y machine learning. Todos los proyectos que usted adquiere nos ayudan a fomentar la educación de jóvenes en la ciudad de Pachuca donde estamos implementando una academia sin costo (totalmente gratuita), destinada a elevar exponencialmente la educación tecnológica en México e impulsar el talento de los nuevos genios informáticos, de la mano de grandes exponentes en materia de Inteligencia Artificial en todo el mundo.
Garantía por escrito: Nuestro contrato está avalado por PROFECO y cuenta con todas las garantías de ley. Adicionalmente contamos con una garantía por escrito (incluida en el contrato), que protege a cada uno de nuestros clientes / inversores, para no pagar cuota mensual hasta recuperar su inversión inicial de "set up", en un plazo máximo de 3 meses. Todo ello con métricas y monitoreo de resultados 24/7 con Inteligencia Artificial. Todos nuestros servicios cuentan con asesoría especializada permanente, asistencia técnica, manuales de usuario y escalabilidad de nuevas tecnologías mientras sus negocios crecen exponencialmente.
Credenciales / certificaciones: n8n, make, zapier, Python, ML, Deep learning, Data science, Master Generative AI, LLMs & NLP JHU's, etc. Contamos con un equipo de expertos en automatización de procesos con Inteligencia Artificial y más de 1000 proyectos en conjunto realizados con éxito y colaboradores en todo el mundo. Asesoramos academias de IA y ofrecemos consultorías a instituciones privadas y gubernamentales en materia de cyber seguridad.
Todos nuestros clientes están protegidos con la más avanzada tecnología en cyberseguridad y sus identidades, información y proyectos, protegidos por "A non-disclosure agreement" (NDA) o contrato de confidencialidad.
Contacto directo con nuestros expertos y asistencia técnica 24/7 por WhatsApp: +527717622360

Formas de pago: ${FORMS_OF_PAYMENT}.`;
  addMessage(text);
  if (!suppress){
    addPendingTimeout(()=> {
      addMessage("¿Desea ver las opciones nuevamente?");
      addPendingTimeout(()=> showMainMenu(), 300);
    }, READ_PAUSE_MS);
  }
}
function handleC(suppress = false){
  clearPendingTimeouts();
  clearLastOptions();
  console.debug("[helios][debug] handleC called", { suppress });
  addMessage("Adoptar Inteligencia Artificial hoy es importante porque acelera procesos, reduce errores y permite tomar decisiones basadas en datos. Esperar implica perder ventaja competitiva, clientes potenciales y oportunidades de crecimiento, además de elevar el costo de implementación a futuro.");
  if (!suppress){
    addPendingTimeout(()=> { addMessage("¿Desea ver las opciones nuevamente?"); addPendingTimeout(()=> showMainMenu(), 300); }, READ_PAUSE_MS);
  }
}
function handleD(suppress = false){
  clearPendingTimeouts();
  clearLastOptions();
  console.debug("[helios][debug] handleD called", { suppress });
  addMessage("Los costos de implementación varían según alcance. Contamos con paquetes y financiamiento; muchas implementaciones recuperan la inversión en menos de 3 meses dependiendo del caso.");
  if (!suppress){
    addPendingTimeout(()=> { addMessage("¿Desea ver las opciones nuevamente?"); addPendingTimeout(()=> showMainMenu(), 300); }, READ_PAUSE_MS);
  }
}

/* ---------- handleE: "Todas las anteriores" - sequential with suppressMenu usage ---------- */
function handleE(){
  console.debug("[helios][debug] handleE called - playing full sequence");
  clearPendingTimeouts();
  lockInput("Leyendo, por favor espere..."); // lock while sequence plays
  // sequentially call handlers with suppress=true to avoid each re-showing menu
  handleA(true);
  addPendingTimeout(()=> handleB(true), READ_PAUSE_MS * 2);
  addPendingTimeout(()=> handleC(true), READ_PAUSE_MS * 4);
  addPendingTimeout(()=> handleD(true), READ_PAUSE_MS * 6);
  // after sequence, open contact capture
  addPendingTimeout(()=> {
    unlockInput();
    openContactCapture();
  }, READ_PAUSE_MS * 8 + 300);
}

/* ---------- A -> askGiro (all industries included) ---------- */
function askGiro(){
  if (conversationEnded) return;
  clearPendingTimeouts();
  clearLastOptions();
  addMessage("Para responder a su pregunta, con la atención que usted se merece, por favor dígame: ¿En cuál de los siguientes giros se encuentra su negocio?");
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
  }, 300);
}

/* ---------- Subcategories - Salud and Jurídico as examples; generic uses full pitch mapping ---------- */
function askGiro_Salud(){
  lead.industry = "Salud";
  addMessage("¿Cuál de las siguientes opciones describe mejor su negocio?");
  addPendingTimeout(()=> {
    addOptions([
      { label: "Consultorio propio", value:"Consultorio propio", next: ()=> renderPitch_Salud("Consultorio propio") },
      { label: "Clínica", value:"Clínica", next: ()=> renderPitch_Salud("Clínica") },
      { label: "Veterinaria", value:"Veterinaria", next: ()=> renderPitch_Salud("Veterinaria") },
      { label: "Hospital", value:"Hospital", next: ()=> renderPitch_Salud("Hospital") },
      { label: "Otro", value:"Otro", next: ()=> renderPitch_Salud("Otro") }
    ]);
  }, 260);
}
function askGiro_Juridico(){
  lead.industry = "Despacho Jurídico";
  addMessage("¿Cuál de las siguientes describe mejor su despacho jurídico?");
  addPendingTimeout(()=> {
    addOptions([
      { label: "Pequeño despacho (1-3 abogados)", value:"Pequeño despacho (1-3 abogados)", next: ()=> renderPitch_Juridico("Pequeño despacho (1-3 abogados)") },
      { label: "Despacho mediano", value:"Despacho mediano", next: ()=> renderPitch_Juridico("Despacho mediano") },
      { label: "Despacho grande", value:"Despacho grande", next: ()=> renderPitch_Juridico("Despacho grande") },
      { label: "Otro", value:"Otro", next: ()=> renderPitch_Juridico("Otro") }
    ]);
  }, 260);
}

/* ---------- Diagnostic, marketing, budgets, readiness flow (keeps literal text) ---------- */
function askDiagnostic(){
  addMessage("Para poder ayudarle de la mejor manera… ¿Qué le gustaría mejorar primero en su negocio?");
  addPendingTimeout(()=> {
    addOptions([
      { label: "A) Atraer más clientes / pacientes", value:"Atraer", next: ()=> diagnosticMarketingOrOperations("A") },
      { label: "B) Cerrar más ventas o consultas", value:"Cerrar", next: ()=> diagnosticMarketingOrOperations("B") },
      { label: "C) Ahorrar tiempo automatizando tareas internas", value:"Ahorrar", next: ()=> diagnosticMarketingOrOperations("C") },
      { label: "D) Mejorar atención y seguimiento de clientes", value:"Mejorar", next: ()=> diagnosticMarketingOrOperations("D") },
      { label: "E) Todo lo anterior", value:"Todo", next: ()=> diagnosticMarketingOrOperations("E") }
    ]);
  }, 300);
}

function diagnosticMarketingOrOperations(choice){
  if(choice === "A" || choice === "B" || choice === "E"){
    addMessage("Y hoy… ¿quién maneja el marketing digital o la publicidad?");
    addPendingTimeout(()=> {
      addOptions([
        { label: "A) Yo mismo/a me encargo", value:"mkt_self", next: ()=> askMarketingBudget() },
        { label: "B) Lo hace alguien más o una agencia", value:"mkt_agency", next: ()=> askMarketingBudget() },
        { label: "C) No hacemos marketing digital actualmente", value:"mkt_none", next: ()=> askMarketingBudget() }
      ]);
    }, 300);
  } else {
    addMessage("¿Qué tarea le consume más tiempo hoy y le gustaría automatizar primero?");
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
        items.push({ label: "Planificación de Recursos Empresariales", value:"planificacion", next: ()=> askInterestAndDecision() });
      } else if(lead.industry === "Belleza"){
        items.push({ label: "agenda", value:"agenda", next: ()=> askInterestAndDecision() });
        items.push({ label: "promociones automáticas", value:"promos", next: ()=> askInterestAndDecision() });
        items.push({ label: "reseñas", value:"reseñas", next: ()=> askInterestAndDecision() });
      } else {
        items.push({ label: "Automatizar tareas internas", value:"ops_generic", next: ()=> askInterestAndDecision() });
      }
      addOptions(items);
    },300);
  }
}

function askMarketingBudget(){
  addMessage("¿Cuánto invierte aproximadamente al mes?");
  addPendingTimeout(()=> {
    addOptions([
      { label: "A) Menos de $3,000 MXN", value:"<3000", next: ()=> askReadyFor20Clients() },
      { label: "B) Entre $3,000 y $8,000 MXN", value:"3-8k", next: ()=> askReadyFor20Clients() },
      { label: "C) Más de $8,000 MXN", value:">8k", next: ()=> askReadyFor20Clients() },
      { label: "D) Mucho dinero y pocos resultados", value:"bad_spend", next: ()=> askReadyFor20Clients() }
    ]);
  },300);
}

function askReadyFor20Clients(){
  addMessage("Si mañana le llegan 20 clientes nuevos… ¿Está listo para atenderlos?");
  addPendingTimeout(()=> {
    addOptions([
      { label: "Sí", value:"ready_yes", next: ()=> renderPitchForScale() },
      { label: "No", value:"ready_no", next: ()=> renderPitchForAutomation() } // "No" is in your flow
    ]);
  },300);
}

function renderPitchForScale(){ addMessage("Pitch agresivo (escala inmediata)"); addPendingTimeout(()=> askInterestAndDecision(), 600); }
function renderPitchForAutomation(){ addMessage("Pitch enfocado en automatizar atención"); addPendingTimeout(()=> askInterestAndDecision(), 600); }

/* ---------- PITCHES (literal texts preserved) ---------- */
function renderPitch_Salud(subcat){
  lead.subcategory = subcat || "";
  const text = `En consultorios y clínicas la automatización con IA puede contestar llamadas por voz o mensajes de texto, agendar citas y confirmar consultas por usted 24/7, enviar recordatorios a los pacientes (disminuyendo dramáticamente las consultas canceladas o los retrasos). Puede notificarle a Ud. directamente en caso de emergencia. Llevar un control de todos sus expedientes, cobrar consultas por adelantado con medios digitales, darle seguimiento a sus pacientes, enviar felicitaciones en días festivos. Puede aumentar el número de pacientes exponencialmente, de acuerdo a sus instrucciones.
Es importante entender que vivimos en la era de la transformación digital. Según la Curva de Adopción de Innovación de Rogers, las empresas y profesionales se dividen en cinco categorías: los Innovadores (2.5%) que adoptan tecnología primero, los Adoptadores Tempranos (13.5%) que lideran tendencias, la Mayoría Temprana (34%) que adopta cuando ven resultados comprobados, la Mayoría Tardía (34%) que se suma por presión competitiva, y los Rezagados (16%) que resisten el cambio hasta que es demasiado tarde. En el sector salud, quienes adoptan IA ahora se posicionan como líderes, mientras que esperar significa ceder pacientes y prestigio a la competencia que ya está automatizada.
Además, la automatización con IA atrae a un perfil de clientes con un mayor poder adquisitivo y eleva sustancialmente el ticket promedio.`;
  addMessage(text);
  addPendingTimeout(()=> {
    addMessage("Si la implementación fuera 100% accesible a su economía y garantizara recuperar su inversión en un máximo de 3 meses, ¿estaría listo(a) para decidir hoy?");
    addPendingTimeout(()=> {
      addOptions([
        { label: "A) Sí — Listo(a) para contratar hoy", value:"yes_now", next: ()=> openContactCapture() },
        { label: "B) Lo tengo que pensar", value:"think", next: ()=> handleThink() },
        { label: "C) Lo tengo que consultar (socio/jefe/esposo/esposa)", value:"consult", next: ()=> handleConsult() }
      ]);
    },300);
  }, READ_PAUSE_MS);
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
Además, la automatización con IA atrae a un perfil de clientes con un mayor poder adquisitivo y eleva sustancialmente el ticket promedio.`;
  addMessage(text);
  addPendingTimeout(()=> {
    addMessage("Si la implementación fuera 100% accesible a su economía y garantizara recuperar su inversión en un máximo de 3 meses, ¿estaría listo(a) para decidir hoy?");
    addPendingTimeout(()=> {
      addOptions([
        { label: "A) Sí — Listo(a) para contratar hoy", value:"yes_now", next: ()=> openContactCapture() },
        { label: "B) Lo tengo que pensar", value:"think", next: ()=> handleThink() },
        { label: "C) Lo tengo que consultar (socio/jefe/esposo/esposa)", value:"consult", next: ()=> handleConsult() }
      ]);
    },300);
  }, READ_PAUSE_MS);
}

/* Generic mapping for other industries (literal texts preserved) */
function renderPitch_Generic(giro){
  lead.subcategory = giro || "";
  const map = {
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
Es importante entender que vivimos en la era de la transformación digital. ...`,
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
...`,
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
  const txt = map[giro] || `Pronto le mostraremos un plan específico para su giro.`;
  addMessage(txt);
  addPendingTimeout(()=> {
    addMessage("Si la implementación fuera 100% accesible a su economía y garantizara recuperar su inversión en un máximo de 3 meses, ¿estaría listo(a) para decidir hoy?");
    addPendingTimeout(()=> {
      addOptions([
        { label: "A) Sí — Listo(a) para contratar hoy", value:"yes_now", next: ()=> openContactCapture() },
        { label: "B) Lo tengo que pensar", value:"think", next: ()=> handleThink() },
        { label: "C) Lo tengo que consultar (socio/jefe/esposo/esposa)", value:"consult", next: ()=> handleConsult() }
      ]);
    },300);
  }, READ_PAUSE_MS);
}

/* ---------- CLOSURE / objections ---------- */
function askInterestAndDecision(){
  addMessage("Si la implementación fuera 100% accesible a su economía y garantizara recuperar su inversión en un máximo de 3 meses, ¿estaría listo(a) para decidir hoy?");
  addPendingTimeout(()=> {
    addOptions([
      { label: "A) Sí — Listo(a) para contratar hoy", value:"yes_now", next: ()=> openContactCapture() },
      { label: "B) Lo tengo que pensar", value:"think", next: ()=> handleThink() },
      { label: "C) Lo tengo que consultar (socio/jefe/esposo/esposa)", value:"consult", next: ()=> handleConsult() }
    ]);
  },300);
}

function handleThink(){
  addMessage("¿Qué porcentaje de la decisión de implementar una automatización de IA en su negocio depende de usted?");
  addPendingTimeout(()=> {
    addOptions([
      { label: "A) Menos de 50%", value:"lt50", next: ()=> { addMessage("Entiendo."); askDecisionIfHalfOrMore(false); } },
      { label: "B) 50%", value:"50", next: ()=> { addMessage("Perfecto."); askDecisionIfHalfOrMore(true); } },
      { label: "C) Más de 50%", value:"gt50", next: ()=> { addMessage("Perfecto."); askDecisionIfHalfOrMore(true); } }
    ]);
  },300);
}

function askDecisionIfHalfOrMore(isHalfOrMore){
  if(isHalfOrMore){
    addMessage("Si el 50% de su decisión en realidad fuera un 100% ¿estaría decidido a adquirir en este momento?");
    addPendingTimeout(()=> {
      addOptions([
        { label: "Sí", value:"final_yes", next: ()=> openContactCapture() },
        { label: "No", value:"final_no", next: ()=> { addMessage("Entiendo. Le enviaremos una presentación."); offerPresentation(); } }
      ]);
    },300);
  } else {
    addMessage("[TÍTULO] [APELLIDO] usted es un profesional [DE LA SALUD / DEL DERECHO / etc.] que ha tomado decisiones toda su vida, cada decisión que ha tomado, ha determinado sus éxitos y adversidades, esta es simplemente una decisión más, si usted pudiera predecir con certeza matemática y con métricas de inteligencia predictiva el retorno de su inversión respaldado por un contrato por escrito y con la garantía de que en un máximo de 3 meses usted recuperará su inversión ¿estaría listo para tomar la decisión el día de hoy?");
    addPendingTimeout(()=> {
      addOptions([
        { label: "Sí", value:"indeciso_yes", next: ()=> openContactCapture() },
        { label: "No", value:"indeciso_no", next: ()=> { addMessage("Entiendo. Le enviaremos una presentación."); offerPresentation(); } }
      ]);
    },400);
  }
}

function offerPresentation(){
  addMessage("Perfecto. ¿Cuál email usamos para enviar la presentación?");
  currentStep = "capturePresentationEmail";
  unlockInput();
}

function handleConsult(){
  addMessage("¿Desea que le enviemos una presentación por email o prefiere agendar una reunión con su decisor?");
  addPendingTimeout(()=> {
    addOptions([
      { label: "A) Enviar presentación (email)", value:"send_pres", next: ()=> askEmailForPresentation() },
      { label: "B) Agendar reunión con decisor", value:"agendar_decisor", next: ()=> openContactCapture() }
    ]);
  },300);
}

function askEmailForPresentation(){
  addMessage("Ingrese por favor su email en el campo inferior y presione Enviar.");
  currentStep = "capturePresentationEmail";
  unlockInput();
}

/* ---------- Contact capture ---------- */
function openContactCapture(){
  addMessage("Perfecto. Para agendar necesito: Teléfono (WhatsApp), Email, Día preferido y Hora aproximada.");
  currentStep = "captureContactLine";
  unlockInput();
}

/* ---------- Evasive handling & insistence anecdote (literal) ---------- */
function handleEvasiveContact(){
  addMessage('Claro que sí [TÍTULO] [APELLIDO], le comparto nuestro WhatsApp directo donde uno de nuestros ingenieros expertos puede atenderle de manera personalizada en cualquier momento que usted lo requiera +527717622360');
}

function insistenceAnecdote(){
  addMessage('Muy bien [TÍTULO] pero antes de despedirnos le voy a contar brevemente una anécdota, uno de nuestros clientes se preguntaba por qué razón habían negocios super exitosos, mientras que el suyo parecía estar estancado, a pesar de ello decidió no invertir en nuestros servicios, así que le hice una sugerencia, le dije que escribiera en un papel "HELIOS" y que lo guardara debajo de su almohada y que cada vez que sintiera que su negocio no tenía el éxito que merecía, sacara el papel y lo leyera. ¿Le gustaría agendar una asesoría gratuita de 20 minutos que puede transformar su negocio para siempre o prefiere escribir HELIOS en un papelito?');
  addPendingTimeout(()=> {
    addOptions([
      { label: "Agendar asesoría gratuita de 20 minutos", value:"agendar_20", next: ()=> openContactCapture() },
      { label: "Prefiero escribir HELIOS en un papelito", value:"papelito", next: ()=> { addMessage("Entendido. Si cambia de opinión, aquí estamos."); } }
    ]);
  },300);
}

/* ---------- Submit typed input handling ---------- */
sendBtn.addEventListener("click", onSubmit);
inputField.addEventListener("keydown", (e) => { if (e.key === "Enter") onSubmit(); });

async function onSubmit(){
  const raw = (inputField.value || "").trim();
  if(!raw) return;

  if (conversationEnded){
    addMessage("La sesión ha finalizado. Por favor refresque la página para iniciar una nueva conversación.", "bot");
    inputField.value = "";
    return;
  }

  if(optionsVisible){
    addMessage("Por favor seleccione una de las opciones mostradas arriba.", "bot");
    inputField.value = "";
    return;
  }

  // store typed user bubble
  addMessage(raw, "user");
  inputField.value = "";
  lead.responses.push({ text: raw, ts: new Date().toISOString() });
  console.debug("[helios][debug] onSubmit user input", raw.slice(0,120));

  // typed steps
  if (currentStep === "captureName"){
    // robust parse and store both given and surname
    const parsed = parseName(raw);
    lead.fullName = parsed.full;
    lead.givenName = parsed.given;
    lead.surname = parsed.surname;
    // ask explicit title choice
    addMessage("¿Cómo prefiere que me dirija a usted? Elija una opción:");
    const titleItems = TITLE_CHOICES.map(t => ({ label: t, value: t, next: (v) => {
      lead.title = v;
      // say greeting using chosen title and surname (if surname duplicates given, show only once)
      const displaySurname = (lead.surname === lead.givenName) ? lead.surname : lead.surname;
      addMessage(`Excelente ${lead.title} ${displaySurname}. Gracias.`);
      // small pause then show main menu
      addPendingTimeout(()=> showMainMenu(), 500);
    }}));
    addOptions(titleItems);
    currentStep = null;
    return;
  }

  if (currentStep === "capturePresentationEmail"){
    const emailCandidate = raw.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailCandidate)){
      addMessage("Por favor ingrese un correo electrónico válido.", "bot");
      return;
    }
    lead.email = emailCandidate;
    // send presentation request via webhook (implementation in part 2)
    try {
      await sendLeadPayload({ wantsPresentation: true, emailCaptured: true }, true); // endSession=true
      addMessage("Perfecto — le enviaremos la presentación a ese correo. Gracias.");
    } catch(e){
      console.error("[helios][error] sendLeadPayload failed (presentation email):", e);
      addMessage("⚠️ Hubo un problema enviando la presentación. Puede escribirnos por WhatsApp: +52 771 762 2360", "bot");
    }
    currentStep = null;
    // after sending, do not immediately reopen menu if endSession set in sendLeadPayload (part 2 handles conversationEnded)
    return;
  }

  if (currentStep === "captureContactLine"){
    // flexible parse of contact line
    const parsed = parseContactLine(raw);
    if (!parsed.email && !parsed.phone){
      addMessage("Por favor ingrese al menos Teléfono (WhatsApp) y Email separados por comas (o en texto libre).", "bot");
      return;
    }
    if (!lead.phone && parsed.phone) lead.phone = parsed.phone;
    if (!lead.email && parsed.email) lead.email = parsed.email;
    if (parsed.preferredDay) lead.preferredDay = parsed.preferredDay;
    if (parsed.preferredTime) lead.preferredTime = parsed.preferredTime;

    addMessage("Gracias. En breve recibirá confirmación por email si procede.");
    currentStep = null;

    // schedule sending payload; sendLeadPayload implemented in Part 2
    try {
      await sendLeadPayload({ schedule: !!lead.email, emailCaptured: !!lead.email }, true); // endSession true => will close session
    } catch(e){
      console.error("[helios][error] sendLeadPayload failed (contact capture):", e);
      addMessage("⚠️ No pudimos enviar la información al servidor. Por favor contacte vía WhatsApp: +52 771 762 2360", "bot");
    }
    return;
  }

  // fallback: reopen menu
  addPendingTimeout(()=> {
    addMessage("No entendí exactamente — ¿Desea ver las opciones nuevamente?");
    addPendingTimeout(()=> showMainMenu(), 400);
  }, 200);
}

/* ---------- End of PART 1/2 ----------
   -> PART 2/2 will include:
      - sendLeadPayload implementation (POST with AbortController, retry, verbose logs, lastSentHash logic, endSession handling)
      - functions to reset conversation, restart, init call (startChat())
      - any remaining glue code
*//* ---------- sendLeadPayload() ---------- */
async function sendLeadPayload(extra = {}, endSession = false) {
  if (conversationEnded) {
    console.debug("[helios][info] sendLeadPayload aborted: conversationEnded");
    return false;
  }

  const payload = {
    sessionId,
    timestamp: new Date().toISOString(),
    ...lead,
    ...extra
  };

  const currentHash = computePayloadHash(payload);
  if (lead.lastSentHash === currentHash) {
    console.info("[helios][info] Duplicate payload detected, skipping send.");
    return false;
  }

  // AbortController for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let attempt = 0;
  let success = false;
  let responseStatus = null;
  let responseText = null;

  while (attempt <= FETCH_RETRY && !success) {
    try {
      console.debug(`[helios][debug] Sending payload attempt ${attempt + 1}/${FETCH_RETRY + 1}`, payload);
      const res = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      responseStatus = res.status;
      try {
        responseText = await res.text();
      } catch (_) {
        responseText = "[no body]";
      }

      console.debug("[helios][debug] Webhook response:", responseStatus, responseText);

      if (res.ok) {
        success = true;
        lead.lastSentHash = currentHash;
        lead.lastSentAt = Date.now();
        console.info("[helios][info] Payload successfully sent", { status: responseStatus });
      } else {
        console.warn("[helios][warn] Non-OK HTTP response", { status: responseStatus });
      }
    } catch (err) {
      console.error(`[helios][error] fetch error on attempt ${attempt + 1}:`, err);
      if (err.name === "AbortError") {
        console.error("[helios][error] Fetch aborted due to timeout", { timeout: FETCH_TIMEOUT_MS });
      }
    }
    attempt++;
    if (!success && attempt <= FETCH_RETRY) {
      await new Promise(r => setTimeout(r, 1200)); // simple retry delay
    }
  }

  clearTimeout(timeoutId);

  if (success) {
    addMessage("✅ ¡Listo! Hemos enviado la información correctamente.", "bot");
    if (endSession) {
      conversationEnded = true;
      addMessage("Gracias por contactarnos. En breve recibirá confirmación por email.", "bot");
    } else {
      addPendingTimeout(() => showMainMenu(), 1000);
    }
    return true;
  } else {
    addMessage("⚠️ No se pudo enviar la información al servidor. Intente más tarde o contacte soporte.", "bot");
    if (endSession) conversationEnded = true;
    console.error("[helios][error] sendLeadPayload failed after retries", { responseStatus, responseText });
    return false;
  }
}

/* ---------- Reset conversation ---------- */
function resetConversation() {
  clearPendingTimeouts();
  lead = {
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
    lastSentHash: null,
    lastSentAt: null,
    sent: false
  };
  conversationEnded = false;
  currentStep = null;
  clearLastOptions();
  messagesContainer.innerHTML = "";
  console.info("[helios][info] Conversation reset.");
  addMessage("🌀 Nueva conversación iniciada. ¡Hola! Soy Helios, Asesor Comercial Senior de Helios AI Labs. ¿Con quién tengo el gusto?");
  currentStep = "captureName";
  unlockInput();
}

/* ---------- Optional Restart Button (for UX) ---------- */
function injectRestartButton() {
  const btn = document.createElement("button");
  btn.id = "restartBtn";
  btn.innerText = "🔄 Nueva conversación";
  btn.style.position = "fixed";
  btn.style.bottom = "10px";
  btn.style.right = "10px";
  btn.style.padding = "6px 10px";
  btn.style.fontSize = "14px";
  btn.style.zIndex = "9999";
  btn.addEventListener("click", resetConversation);
  document.body.appendChild(btn);
}

/* ---------- Init on DOM ready ---------- */
document.addEventListener("DOMContentLoaded", () => {
  if (!window.__helios_initialized) {
    window.__helios_initialized = true;
    console.info("[helios][init] DOM ready, initializing chatbot...");
    injectRestartButton();
    startChat();
  }
});

/* ---------- End of PART 2/2 ---------- */
