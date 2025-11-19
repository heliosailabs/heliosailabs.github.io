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
        items.push({ label:
          /* ---------- sendLeadPayload() - Con alternativas gratuitas ---------- */
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

  // ====== OPCIÓN 1: TELEGRAM BOT (RECOMENDADO - 100% GRATIS) ======
  // 1. Crea un bot en Telegram con @BotFather
  // 2. Obtén el token del bot
  // 3. Obtén tu Chat ID (envía mensaje al bot y ve https://api.telegram.org/bot<TOKEN>/getUpdates)
  // 4. Descomenta y configura:
  
  /*
  const TELEGRAM_BOT_TOKEN = "TU_BOT_TOKEN_AQUI";
  const TELEGRAM_CHAT_ID = "TU_CHAT_ID_AQUI";
  
  const telegramMessage = `
🆕 NUEVO LEAD - Helios AI Labs
━━━━━━━━━━━━━━━━━━━━
👤 Nombre: ${lead.fullName || 'N/A'}
📧 Email: ${lead.email || 'N/A'}
📱 Teléfono: ${lead.phone || 'N/A'}
🏢 Industria: ${lead.industry || 'N/A'}
📊 Subcategoría: ${lead.subcategory || 'N/A'}
📅 Día preferido: ${lead.preferredDay || 'N/A'}
⏰ Hora preferida: ${lead.preferredTime || 'N/A'}
🎯 Nivel de interés: ${lead.interestLevel || 'N/A'}
💰 Presupuesto marketing: ${lead.marketingBudget || 'N/A'}
━━━━━━━━━━━━━━━━━━━━
🆔 Session: ${sessionId}
⏱️ ${new Date().toLocaleString('es-MX')}
  `.trim();

  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: telegramMessage,
        parse_mode: "HTML"
      })
    });
    
    if (res.ok) {
      lead.lastSentHash = currentHash;
      lead.lastSentAt = Date.now();
      console.info("[helios][info] Lead sent successfully via Telegram");
      addMessage("✅ ¡Listo! Hemos enviado la información correctamente.", "bot");
      if (endSession) {
        conversationEnded = true;
        addMessage("Gracias por contactarnos. En breve recibirá confirmación por email.", "bot");
      } else {
        addPendingTimeout(() => showMainMenu(), 1000);
      }
      return true;
    }
  } catch(e) {
    console.error("[helios][error] Telegram send failed:", e);
  }
  */

  // ====== OPCIÓN 2: DISCORD WEBHOOK (100% GRATIS) ======
  // 1. Crea un servidor de Discord
  // 2. Ve a Server Settings > Integrations > Webhooks > New Webhook
  // 3. Copia la Webhook URL
  // 4. Descomenta y configura:
  
  /*
  const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/TU_WEBHOOK_URL";
  
  const discordEmbed = {
    embeds: [{
      title: "🆕 Nuevo Lead - Helios AI Labs",
      color: 0x00ff00,
      fields: [
        { name: "👤 Nombre", value: lead.fullName || 'N/A', inline: true },
        { name: "📧 Email", value: lead.email || 'N/A', inline: true },
        { name: "📱 Teléfono", value: lead.phone || 'N/A', inline: true },
        { name: "🏢 Industria", value: lead.industry || 'N/A', inline: true },
        { name: "📊 Subcategoría", value: lead.subcategory || 'N/A', inline: true },
        { name: "📅 Día", value: lead.preferredDay || 'N/A', inline: true },
        { name: "⏰ Hora", value: lead.preferredTime || 'N/A', inline: true },
        { name: "💰 Presupuesto", value: lead.marketingBudget || 'N/A', inline: true }
      ],
      footer: { text: `Session: ${sessionId}` },
      timestamp: new Date().toISOString()
    }]
  };

  try {
    const res = await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(discordEmbed)
    });
    
    if (res.ok) {
      lead.lastSentHash = currentHash;
      lead.lastSentAt = Date.now();
      console.info("[helios][info] Lead sent successfully via Discord");
      addMessage("✅ ¡Listo! Hemos enviado la información correctamente.", "bot");
      if (endSession) {
        conversationEnded = true;
        addMessage("Gracias por contactarnos. En breve recibirá confirmación por email.", "bot");
      } else {
        addPendingTimeout(() => showMainMenu(), 1000);
      }
      return true;
    }
  } catch(e) {
    console.error("[helios][error] Discord send failed:", e);
  }
  */

  // ====== OPCIÓN 3: GOOGLE SHEETS (GRATIS - REQUIERE GOOGLE APPS SCRIPT) ======
  // 1. Crea una Google Sheet
  // 2. Ve a Extensions > Apps Script
  // 3. Pega este código:
  /*
    function doPost(e) {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
      const data = JSON.parse(e.postData.contents);
      
      sheet.appendRow([
        new Date(),
        data.sessionId,
        data.fullName,
        data.email,
        data.phone,
        data.industry,
        data.subcategory,
        data.preferredDay,
        data.preferredTime,
        data.marketingBudget,
        JSON.stringify(data.responses)
      ]);
      
      return ContentService.createTextOutput(JSON.stringify({success: true}))
        .setMimeType(ContentService.MimeType.JSON);
    }
  */
  // 4. Deploy as Web App > Anyone can access
  // 5. Copia la URL y descomenta:
  
  /*
  const GOOGLE_SCRIPT_URL = "TU_GOOGLE_APPS_SCRIPT_URL";
  
  try {
    const res = await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    
    if (res.ok) {
      lead.lastSentHash = currentHash;
      lead.lastSentAt = Date.now();
      console.info("[helios][info] Lead sent successfully to Google Sheets");
      addMessage("✅ ¡Listo! Hemos enviado la información correctamente.", "bot");
      if (endSession) {
        conversationEnded = true;
        addMessage("Gracias por contactarnos. En breve recibirá confirmación por email.", "bot");
      } else {
        addPendingTimeout(() => showMainMenu(), 1000);
      }
      return true;
    }
  } catch(e) {
    console.error("[helios][error] Google Sheets send failed:", e);
  }
  */

  // ====== OPCIÓN 4: EMAIL DIRECTO VIA FORMSPREE (GRATIS - 50 envíos/mes) ======
  // 1. Ve a https://formspree.io
  // 2. Crea una cuenta gratuita
  // 3. Crea un nuevo form y obtén el endpoint
  // 4. Descomenta:
  
  /*
  const FORMSPREE_ENDPOINT = "https://formspree.io/f/TU_FORM_ID";
  
  try {
    const res = await fetch(FORMSPREE_ENDPOINT, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        email: EMAIL_COPY_TO,
        subject: `Nuevo Lead: ${lead.fullName}`,
        message: `
          NUEVO LEAD - Helios AI Labs
          =============================
          Nombre: ${lead.fullName}
          Email: ${lead.email}
          Teléfono: ${lead.phone}
          Industria: ${lead.industry}
          Subcategoría: ${lead.subcategory}
          Día preferido: ${lead.preferredDay}
          Hora preferida: ${lead.preferredTime}
          
          Session ID: ${sessionId}
          Timestamp: ${new Date().toLocaleString('es-MX')}
        `
      })
    });
    
    if (res.ok) {
      lead.lastSentHash = currentHash;
      lead.lastSentAt = Date.now();
      console.info("[helios][info] Lead sent successfully via Formspree");
      addMessage("✅ ¡Listo! Hemos enviado la información correctamente.", "bot");
      if (endSession) {
        conversationEnded = true;
        addMessage("Gracias por contactarnos. En breve recibirá confirmación por email.", "bot");
      } else {
        addPendingTimeout(() => showMainMenu(), 1000);
      }
      return true;
    }
  } catch(e) {
    console.error("[helios][error] Formspree send failed:", e);
  }
  */

  // ====== FALLBACK: Si todas las opciones fallan o están deshabilitadas ======
  // Guarda en localStorage como backup y muestra mensaje al usuario
  try {
    const leadsBackup = JSON.parse(localStorage.getItem("helios_leads_backup") || "[]");
    leadsBackup.push(payload);
    localStorage.setItem("helios_leads_backup", JSON.stringify(leadsBackup));
    console.warn("[helios][warn] Lead saved to localStorage backup");
  } catch(e) {
    console.error("[helios][error] Failed to save to localStorage:", e);
  }

  addMessage("⚠️ Sistema de notificaciones temporalmente no disponible. Sus datos se han guardado localmente. Por favor contacte por WhatsApp: +52 771 762 2360", "bot");
  if (endSession) conversationEnded = true;
  
  return false;
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
  btn.style.cursor = "pointer";
  btn.addEventListener("click", resetConversation);
  document.body.appendChild(btn);
}

/* ---------- Helper: Ver leads guardados en localStorage ---------- */
function showBackupLeads() {
  try {
    const backup = localStorage.getItem("helios_leads_backup");
    if (backup) {
      const leads = JSON.parse(backup);
      console.table(leads);
      console.info(`[helios][info] ${leads.length} leads en backup. Usa clearBackupLeads() para limpiar.`);
      return leads;
    } else {
      console.info("[helios][info] No hay leads en backup.");
      return [];
    }
  } catch(e) {
    console.error("[helios][error] Error reading backup:", e);
    return [];
  }
}

function clearBackupLeads() {
  localStorage.removeItem("helios_leads_backup");
  console.info("[helios][info] Backup de leads limpiado.");
}

// Exponer funciones globales para debugging
window.helios = {
  showBackupLeads,
  clearBackupLeads,
  resetConversation,
  lead: () => lead
};

/* ---------- Init on DOM ready ---------- */
document.addEventListener("DOMContentLoaded", () => {
  if (!window.__helios_initialized) {
    window.__helios_initialized = true;
    console.info("[helios][init] DOM ready, initializing chatbot...");
    console.info("[helios][init] Funciones disponibles en consola: window.helios.showBackupLeads(), window.helios.clearBackupLeads()");
    injectRestartButton();
    startChat();
  }
});

/* ---------- End of PART 2/2 ---------- */ 
