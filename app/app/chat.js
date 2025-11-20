/* app/chat.js - Helios AI Labs - ARCHIVO COMPLETO
   - Verbose technical logs in English
   - Pauses: READ_PAUSE_MS between blocks (3s)
   - All user-provided pitch texts preserved verbatim
*/

/* ---------- CONFIG ---------- */
const WEBHOOK_URL = "https://heliosailabs369.app.n8n.cloud/webhook/chatbot-groq";
const EMAIL_COPY_TO = "heliosailabs@gmail.com";
const FORMS_OF_PAYMENT = "Transferencia bancaria, todas las tarjetas de crédito y debito VISA, Mastercard y American Express, Bitcoin y ETH.";
const READ_PAUSE_MS = 3000;
const FETCH_TIMEOUT_MS = 10000;
const FETCH_RETRY = 1;

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
  fullName: "", givenName: "", surname: "", title: "", gender: "",
  industry: "", subcategory: "", marketingBudget: "", decisionPower: "",
  interestLevel: "", phone: "", email: "", preferredDay: "", preferredTime: "",
  responses: [], lastSentHash: null, lastSentAt: null, sent: false
};

/* ---------- State flags ---------- */
let currentStep = null;
let optionsVisible = false;
let lastOptionsWrapper = null;
let pendingTimeouts = [];
let conversationEnded = false;
let suppressMenu = false;

/* ---------- Helper: pending timeouts management ---------- */
function addPendingTimeout(fn, ms){
  const id = setTimeout(() => {
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
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function interpolateLeadData(text){
  if (!text) return "";
  const fallbackTitle = lead.title || "Cliente";
  const fallbackSurname = lead.surname || lead.givenName || "Cliente";
  return String(text)
    .replace(/\[TÍTULO\]|\[TITULO\]/g, escapeHtml(fallbackTitle))
    .replace(/\[APELLIDO\]/g, escapeHtml(fallbackSurname))
    .replace(/\$\{TÍTULO\}/g, escapeHtml(fallbackTitle))
    .replace(/\$\{APELLIDO\}/g, escapeHtml(fallbackSurname));
}

/* ---------- UI helpers ---------- */
function addMessage(rawText, sender = "bot"){
  const processed = sender === "bot" ? interpolateLeadData(rawText) : escapeHtml(rawText);
  const el = document.createElement("div");
  el.classList.add("message", sender);
  el.innerHTML = processed.replace(/\n/g, "<br/>");
  messagesContainer.appendChild(el);
  messagesContainer.setAttribute("aria-live", "polite");
  setTimeout(()=> messagesContainer.scrollTop = messagesContainer.scrollHeight, 40);
  console.debug("[helios][debug] addMessage", { sender, preview: processed.slice(0,100) });
  return el;
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
  s = s.replace(/^(buenas\s*(noches|tardes|días|dias)|buenos\s*(días|dias)|hola|holá)\s*/i, "");
  s = s.replace(/^(soy|me llamo|mi nombre es)\s*/i, "");
  s = s.replace(/[.,;!¿?]+/g, " ");
  s = s.replace(/\s+/g, " ").trim();

  const titlePattern = /^(Dr\.|Dra\.|Dr|Dra|Lic\.|Lic|Ing\.|Ing|Sr\.|Sra\.|Profesor|Profesora|Prof\.|Mtro\.|Mtra\.|Arq\.|Arq)/i;
  let titleMatch = s.match(titlePattern);
  if (titleMatch){
    const t = titleMatch[0].replace(/\.$/,"");
    if (!lead.title) lead.title = t;
    s = s.replace(titlePattern, "").trim();
  }

  const parts = s.split(/\s+/);
  if (parts.length === 0) return { full: raw, given: raw, surname: raw };

  let surname = parts[parts.length - 1];
  if (parts.length >= 2){
    const penult = parts[parts.length - 2].toLowerCase();
    if (NAME_CONNECTORS.includes(penult)){
      surname = `${parts[parts.length - 2]} ${surname}`;
      parts.splice(parts.length - 2, 2);
    } else {
      parts.splice(parts.length - 1, 1);
    }
  } else {
    parts.splice(0, 1);
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
  s = s.replace(/\r?\n/g, ",").replace(/\s+y\s+/gi, ",");
  const parts = s.split(",").map(p => p.trim()).filter(Boolean);

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
    if (!preferredDay && /lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo|lunes|monday|tuesday|wednesday|thursday|friday|saturday|sunday|am|pm|:\d{2}/i.test(p)){
      if (/am|pm|:\d{2}|hora|h|a la/i.test(p)) preferredTime = p;
      else preferredDay = p;
      continue;
    }
    if (!phone){
      const digits = (p.match(/\d/g)||[]).join("");
      if (digits.length >= 7 && digits.length <= 15){
        phone = normalizePhone(digits);
        continue;
      }
    }
  }

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
  s = s.replace(/[^\d+]/g, "");
  const digits = s.replace(/\D/g,"");
  if (!s.startsWith("+") && digits.length === 10){
    s = "+52" + digits;
  }
  if (!s.startsWith("+")) s = "+" + digits;
  return s;
}

/* ---------- Compute payload hash ---------- */
function computePayloadHash(obj){
  try {
    const str = JSON.stringify(obj);
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

/* ---------- Titles choices ---------- */
const TITLE_CHOICES = [
  "Dr.", "Dra.", "Arq.", "Lic.", "Ing.", "C.P.", "Mtro.", "Mtra.",
  "Sr.", "Sra.", "Srita.", "Don", "Doña", "Profesor", "Profesora", "Coach", "Chef", "Otro"
];

/* ---------- Start / greeting ---------- */
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

/* ---------- Main menu ---------- */
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

/* ---------- Handlers A..E ---------- */
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

function handleE(){
  console.debug("[helios][debug] handleE called - playing full sequence");
  clearPendingTimeouts();
  lockInput("Leyendo, por favor espere...");
  handleA(true);
  addPendingTimeout(()=> handleB(true), READ_PAUSE_MS * 2);
  addPendingTimeout(()=> handleC(true), READ_PAUSE_MS * 4);
  addPendingTimeout(()=> handleD(true), READ_PAUSE_MS * 6);
  addPendingTimeout(()=> {
    unlockInput();
    openContactCapture();
  }, READ_PAUSE_MS * 8 + 300);
}

/* ---------- askGiro ---------- */
function askGiro(){
  if (conversationEnded) return;
  clearPendingTimeouts();
  clearLastOptions();
  addMessage("Para responder a su pregunta, con la atención que usted se merece, por favor dígame: ¿En cuál de los siguientes giros se encuentra su negocio?");
  addPendingTimeout(()=> {
    addOptions([
      { label: "A) Salud", value:"Salud", next: ()=> askGiro_Salud() },
      { label: "B) Despacho Jurídico", value:"Despacho Jurídico", next: ()=> askGiro_Juridico() },
      { label: "C) Restaurante o Cafetería", value:"Restaurante o Cafetería", next: ()=> renderPitch_Generic("Restaurante o Cafetería") },
      { label: "D) Sector inmobiliario", value:"Sector inmobiliario", next: ()=> renderPitch_Generic("Sector inmobiliario") },
      { label: "E) Educación", value:"Educación", next: ()=> renderPitch_Generic("Educación") },
      { label: "F) Creación de contenido", value:"Creación de contenido", next: ()=> renderPitch_Generic("Creación de contenido") },
      { label: "G) Comercio (minorista / mayorista)", value:"Comercio (minorista / mayorista)", next: ()=> renderPitch_Generic("Comercio (minorista / mayorista)") },
      { label: "H) Profesional independiente", value:"Profesional independiente", next: ()=> renderPitch_Generic("Profesional independiente") },
      { label: "I) Belleza", value:"Belleza", next: ()=> renderPitch_Generic("Belleza") },
      { label: "J) Otro", value:"Otro", next: ()=> renderPitch_Generic("Otro") }
    ]);
  }, 300);
}

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

/* ---------- Pitches ---------- */
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

function renderPitch_Generic(giro){
  lead.subcategory = giro || "";
  const pitches = {
    "Sector inmobiliario": "🏡 [TÍTULO] [APELLIDO], hoy el 95% de las personas buscan propiedades en internet...",
    "Restaurante o Cafetería": "🍽 [TÍTULO] [APELLIDO], en su negocio cada mensaje que llega por WhatsApp o redes es un cliente listo para comprar ahora...",
    "Educación": "🎓 [TÍTULO] [APELLIDO], hoy los padres y alumnos toman decisiones en cuestión de minutos...",
    "Comercio (minorista / mayorista)": "🛍 [TÍTULO] [APELLIDO], en comercio la venta ocurre en el mismo momento en que el cliente pregunta...",
    "Profesional independiente": "👔 [TÍTULO] [APELLIDO], cuando una persona trabaja por su cuenta… el tiempo es el recurso más valioso...",
    "Creación de contenido": "📱 [TÍTULO] [APELLIDO], tu marca puede multiplicar ventas sin saturarte...",
    "Belleza": "💄 [TÍTULO] [APELLIDO], cuando alguien quiere un servicio de belleza la decisión la toma en ese mismo momento..."
  };
  const txt = pitches[giro] || "Pronto le mostraremos un plan específico para su giro.";
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

/* ---------- Objections ---------- */
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
    addMessage("[TÍTULO] [APELLIDO] usted es un profesional que ha tomado decisiones toda su vida. Si usted pudiera predecir con certeza matemática el retorno de su inversión respaldado por un contrato por escrito y con la garantía de que en un máximo de 3 meses usted recuperará su inversión ¿estaría listo para tomar la decisión el día de hoy?");
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
      { label: "A) Enviar presentación (email)", value:"send_pres", next: ()=> offerPresentation() },
      { label: "B) Agendar reunión con decisor", value:"agendar_decisor", next: ()=> openContactCapture() }
    ]);
  },300);
}

/* ---------- Contact capture ---------- */
function openContactCapture(){
  addMessage("Perfecto. Para agendar necesito: Teléfono (WhatsApp), Email, Día preferido y Hora aproximada.");
  currentStep = "captureContactLine";
  unlockInput();
}

/* ---------- Submit handler ---------- */
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

  addMessage(raw, "user");
  inputField.value = "";
  lead.responses.push({ text: raw, ts: new Date().toISOString() });
  console.debug("[helios][debug] onSubmit user input", raw.slice(0,120));

  if (currentStep === "captureName"){
    const parsed = parseName(raw);
    lead.fullName = parsed.full;
    lead.givenName = parsed.given;
    lead.surname = parsed.surname;
    addMessage("¿Cómo prefiere que me dirija a usted? Elija una opción:");
    const titleItems = TITLE_CHOICES.map(t => ({ label: t, value: t, next: (v) => {
      lead.title = v;
      const displaySurname = (lead.surname === lead.givenName) ? lead.surname : lead.surname;
      addMessage(`Excelente ${lead.title} ${displaySurname}. Gracias.`);
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
    try {
      const success = await sendLeadPayload({ wantsPresentation: true, emailCaptured: true }, true);
      if (success) {
        addMessage("Perfecto — le enviaremos la presentación a ese correo. Gracias.");
      }
    } catch(e){
      console.error("[helios][error] sendLeadPayload failed (presentation email):", e);
    }
    currentStep = null;
    return;
  }

  if (currentStep === "captureContactLine"){
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

    try {
      await sendLeadPayload({ schedule: !!lead.email, emailCaptured: !!lead.email }, true);
    } catch(e){
      console.error("[helios][error] sendLeadPayload failed (contact capture):", e);
      addMessage("⚠️ No pudimos enviar la información al servidor. Por favor contacte vía WhatsApp: +52 771 762 2360", "bot");
    }
    return;
  }

  addPendingTimeout(()=> {
    addMessage("No entendí exactamente — ¿Desea ver las opciones nuevamente?");
    addPendingTimeout(()=> showMainMenu(), 400);
  }, 200);
}

/* ---------- sendLeadPayload ---------- */
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

  try {
    const leadsBackup = JSON.parse(localStorage.getItem("helios_leads_backup") || "[]");
    leadsBackup.push(payload);
    localStorage.setItem("helios_leads_backup", JSON.stringify(leadsBackup));
    console.info("[helios][info] Lead saved to localStorage backup");
    
    lead.lastSentHash = currentHash;
    lead.lastSentAt = Date.now();
    
    addMessage("✅ ¡Listo! Hemos guardado la información correctamente.", "bot");
    if (endSession) {
      conversationEnded = true;
      addMessage("Gracias por contactarnos. En breve recibirá confirmación.", "bot");
    } else {
      addPendingTimeout(() => showMainMenu(), 1000);
    }
    return true;
  } catch(e) {
    console.error("[helios][error] Failed to save lead:", e);
    addMessage("⚠️ No pudimos guardar la información. Por favor contacte por WhatsApp: +52 771 762 2360", "bot");
    if (endSession) conversationEnded = true;
    return false;
  }
}

/* ---------- Reset conversation ---------- */
function resetConversation() {
  clearPendingTimeouts();
  lead = {
    fullName: "", givenName: "", surname: "", title: "", gender: "",
    industry: "", subcategory: "", marketingBudget: "", decisionPower: "",
    interestLevel: "", phone: "", email: "", preferredDay: "", preferredTime: "",
    responses: [], lastSentHash: null, lastSentAt: null, sent: false
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

/* ---------- Restart Button ---------- */
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

/* ---------- Helper functions ---------- */
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

window.helios = {
  showBackupLeads,
  clearBackupLeads,
  resetConversation,
  lead: () => lead
};

/* ---------- Init ---------- */
document.addEventListener("DOMContentLoaded", () => {
  if (!window.__helios_initialized) {
    window.__helios_initialized = true;
    console.info("[helios][init] DOM ready, initializing chatbot...");
    console.info("[helios][init] Para ver leads guardados: window.helios.showBackupLeads()");
    injectRestartButton();
    startChat();
  }
});

/* ---------- FIN DEL ARCHIVO ---------- */
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
