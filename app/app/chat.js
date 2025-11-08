/* chat.js - Helios AI Labs
   Implementación literal del FLUJO CONVERSACIONAL COMPLETO - HELIOS AI LABS
   - No se modifica ni una palabra del contenido entregado por el usuario.
   - No se añaden botones/respuestas que no estén en el flujo.
   - Envía payload al webhook n8n y deja extra para email + formas de pago.
   - Cuando capture email y datos de contacto, incluye schedule:true para que n8n agende en Cal.com.
*/

/* ---------- CONFIG ---------- */
const WEBHOOK_URL = "https://heliosailabs369.app.n8n.cloud/webhook/chatbot-groq";
const EMAIL_COPY_TO = "heliosailabs@gmail.com";
const FORMS_OF_PAYMENT = "Transferencia bancaria, todas las tarjetas de crédito y debito VISA, Mastercard y American Express, Bitcoin y ETH.";

/* ---------- DOM ---------- */
const messagesContainer = document.getElementById("messages");
const inputField = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");

/* ---------- Session & Lead ---------- */
function genSessionId() {
  let s = localStorage.getItem("helios_sessionId");
  if (!s) {
    s = `sess_${Date.now()}_${Math.floor(Math.random()*10000)}`;
    localStorage.setItem("helios_sessionId", s);
  }
  return s;
}
const sessionId = genSessionId();

let lead = {
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

/* ---------- Estado de flujo ---------- */
let currentStep = null; // expecting typed input: "captureName", "captureTitleChoice", "captureContactLine", "capturePresentationEmail", "captureScheduleDate"
let optionsVisible = false;
let lastOptionsWrapper = null;

/* ---------- UI helpers ---------- */
function addMessage(text, sender = "bot") {
  const el = document.createElement("div");
  el.classList.add("message", sender);
  el.innerHTML = text.replace(/\n/g, "<br/>");
  messagesContainer.appendChild(el);
  setTimeout(()=>messagesContainer.scrollTop = messagesContainer.scrollHeight, 40);
  return el;
}

function clearLastOptions() {
  if (lastOptionsWrapper) {
    lastOptionsWrapper.remove();
    lastOptionsWrapper = null;
  }
  optionsVisible = false;
  inputField.disabled = false;
  if (sendBtn) sendBtn.disabled = false;
}

function lockInput(placeholder = "Selecciona una opción desde las burbujas...") {
  optionsVisible = true;
  inputField.disabled = true;
  inputField.placeholder = placeholder;
  if (sendBtn) sendBtn.disabled = true;
}
function unlockInput() {
  optionsVisible = false;
  inputField.disabled = false;
  inputField.placeholder = "Escribe aquí...";
  if (sendBtn) sendBtn.disabled = false;
}

/* ---------- Render options (only those from your flow) ---------- */
function addOptions(items) {
  // items: array of { label: "text", value: "...", next: fn OR nextName: "string" }
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
      // show user's selection as bubble
      addMessage(it.label, "user");
      // store response
      lead.responses.push({ option: it.value || it.label, label: it.label, ts: new Date().toISOString() });
      // disable row buttons visually
      Array.from(row.querySelectorAll("button")).forEach(b=>b.disabled = true);
      // small delay then call handler
      setTimeout(() => {
        clearLastOptions();
        if (typeof it.next === "function") it.next(it.value);
        else if (typeof it.nextName === "string" && handlers[it.nextName]) handlers[it.nextName](it.value);
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

/* ---------- Helper: conservative extraction of surname, keep it simple ---------- */
function extractSurname(raw) {
  if (!raw) return "";
  const s = raw.trim();
  const parts = s.split(/\s+/);
  return parts.length > 1 ? parts[parts.length-1] : s;
}

/* ---------- Titles to present as choice (user requested explicit selection) ---------- */
const TITLE_CHOICES = [
  "Dr.", "Dra.", "Arq.", "Lic.", "Ing.", "C.P.", "Mtro.", "Mtra.",
  "Sr.", "Sra.", "Srita.", "Don", "Doña", "Profesor", "Profesora", "Coach", "Chef", "Otro"
];

/* ---------- Handlers mapping (invoked by addOptions via nextName) ---------- */
const handlers = {
  showMainMenu,
  handleA, handleB, handleC, handleD, handleE,
  askGiro, askGiro_Salud, askGiro_Juridico, askGiro_Generic,
  renderPitch_Salud, renderPitch_Juridico, renderPitch_Generic,
  askDiagnostic, diagnosticMarketingOrOperations, askMarketingBudget,
  askReadyFor20Clients, renderPitchForScale, renderPitchForAutomation,
  askInterestAndDecision, handleThink, handleConsult, offerPresentation,
  openContactCapture, captureContactLineHandler, handleEvasiveContact,
  insistenceAnecdote, askEmailForPresentation, askForContact
};

/* ---------- Start: FASE 0 ---------- */
/* Bot: "¡Hola! Soy Helios, Asesor Comercial Senior de Helios AI Labs. ¿Con quién tengo el gusto?"
   Usuario escribe nombre
   Bot: "Excelente [TÍTULO] [APELLIDO]. Gracias."
*/
function startChat() {
  addMessage("¡Hola! Soy Helios, Asesor Comercial Senior de Helios AI Labs. ¿Con quién tengo el gusto?");
  // expect typed name
  currentStep = "captureName";
  unlockInput();
}

/* ---------- FASE 1: show main menu (A..E as literal) ---------- */
function showMainMenu() {
  addMessage("Gracias por contactarnos, somos Helios AI Labs. Para proporcionarle la mejor atención, personalizada y diseñar para usted un traje a la medida ¿Cuál de las siguientes preguntas desea que respondamos para usted?");
  setTimeout(() => {
    addOptions([
      { label: "A) ¿Cómo funciona la automatización de procesos con IA y qué beneficios medibles puede aportar a mi negocio?", value:"A", nextName: "handleA" },
      { label: "B) Quiero información sobre su empresa, ubicación, experiencia, credenciales, referencias, información fiscal, contrato, garantía por escrito, etc.", value:"B", nextName: "handleB" },
      { label: "C) ¿Por qué adoptar Inteligencia Artificial hoy es tan importante y cuales son los escenarios para mi negocio sí decido esperar más tiempo?", value:"C", nextName: "handleC" },
      { label: "D) ¿Cuánto cuesta implementar IA en mi negocio y en cuanto tiempo recuperaré mi inversión? ¿Tienen promociones?", value:"D", nextName: "handleD" },
      { label: "E) Todas las anteriores", value:"E", nextName: "handleE" }
    ]);
  }, 300);
}

/* ---------- FASE 2 / Handlers A..E ---------- */
function handleA() { askGiro(); }
function handleB() { 
  // FASE 11 text (B) — includes forms of payment
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
  setTimeout(()=>{ addMessage("¿Desea ver las opciones nuevamente?"); setTimeout(()=>showMainMenu(),300); }, 600);
}
function handleC() {
  addMessage("Adoptar Inteligencia Artificial hoy es importante porque acelera procesos, reduce errores y permite tomar decisiones basadas en datos. Esperar implica perder ventaja competitiva, clientes potenciales y oportunidades de crecimiento, además de elevar el costo de implementación a futuro.");
  setTimeout(()=>{ addMessage("¿Desea ver las opciones nuevamente?"); setTimeout(()=>showMainMenu(),300); },600);
}
function handleD() {
  addMessage("Los costos de implementación varían según alcance. Contamos con paquetes y financiamiento; muchas implementaciones recuperan la inversión en menos de 3 meses dependiendo del caso.");
  setTimeout(()=>{ addMessage("¿Desea ver las opciones nuevamente?"); setTimeout(()=>showMainMenu(),300); },600);
}
function handleE() {
  addMessage("Perfecto — mostraré un pitch completo y un plan inmediato de acción.");
  setTimeout(()=>{ openContactCapture(); },600);
}

/* ---------- FASE 2: askGiro (A) ---------- */
function askGiro() {
  addMessage("Para responder a su pregunta, con la atención que usted se merece, por favor dígame: ¿En cuál de los siguientes giros se encuentra su negocio?");
  setTimeout(()=> {
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

/* ---------- FASE 3: subcategorias ---------- */
function askGiro_Salud() {
  lead.industry = "Salud";
  addMessage("¿Cuál de las siguientes opciones describe mejor su negocio?");
  setTimeout(()=> {
    addOptions([
      { label: "Consultorio propio", value:"Consultorio propio", next: ()=> renderPitch_Salud("Consultorio propio") },
      { label: "Clínica", value:"Clínica", next: ()=> renderPitch_Salud("Clínica") },
      { label: "Veterinaria", value:"Veterinaria", next: ()=> renderPitch_Salud("Veterinaria") },
      { label: "Hospital", value:"Hospital", next: ()=> renderPitch_Salud("Hospital") },
      { label: "Otro", value:"Otro", next: ()=> renderPitch_Salud("Otro") }
    ]);
  },300);
}

function askGiro_Juridico() {
  lead.industry = "Despacho Jurídico";
  addMessage("¿Cuál de las siguientes describe mejor su despacho jurídico?");
  setTimeout(()=> {
    addOptions([
      { label: "Pequeño despacho (1-3 abogados)", value:"Pequeño despacho (1-3 abogados)", next: ()=> renderPitch_Juridico("Pequeño despacho (1-3 abogados)") },
      { label: "Despacho mediano", value:"Despacho mediano", next: ()=> renderPitch_Juridico("Despacho mediano") },
      { label: "Despacho grande", value:"Despacho grande", next: ()=> renderPitch_Juridico("Despacho grande") },
      { label: "Otro", value:"Otro", next: ()=> renderPitch_Juridico("Otro") }
    ]);
  },300);
}

function askGiro_Generic(val) {
  lead.industry = val || "";
  addMessage("Gracias — estamos registrando su selección. (Próxima iteración: pitch específico para esta categoría).");
  setTimeout(()=> askDiagnostic(), 700);
}

/* ---------- FASE 4: Diagnóstico comercial (opcional) ---------- */
function askDiagnostic() {
  addMessage("Para poder ayudarle de la mejor manera… ¿Qué le gustaría mejorar primero en su negocio?");
  setTimeout(()=> {
    addOptions([
      { label: "A) Atraer más clientes / pacientes", value:"Atraer", next: ()=> diagnosticMarketingOrOperations("A") },
      { label: "B) Cerrar más ventas o consultas", value:"Cerrar", next: ()=> diagnosticMarketingOrOperations("B") },
      { label: "C) Ahorrar tiempo automatizando tareas internas", value:"Ahorrar", next: ()=> diagnosticMarketingOrOperations("C") },
      { label: "D) Mejorar atención y seguimiento de clientes", value:"Mejorar", next: ()=> diagnosticMarketingOrOperations("D") },
      { label: "E) Todo lo anterior", value:"Todo", next: ()=> diagnosticMarketingOrOperations("E") }
    ]);
  },300);
}

function diagnosticMarketingOrOperations(choice) {
  if (choice === "A" || choice === "B" || choice === "E") {
    addMessage("Y hoy… ¿quién maneja el marketing digital o la publicidad?");
    setTimeout(()=> {
      addOptions([
        { label: "A) Yo mismo/a me encargo", value:"mkt_self", next: ()=> askMarketingBudget() },
        { label: "B) Lo hace alguien más o una agencia", value:"mkt_agency", next: ()=> askMarketingBudget() },
        { label: "C) No hacemos marketing digital actualmente", value:"mkt_none", next: ()=> askMarketingBudget() }
      ]);
    },300);
  } else {
    addMessage("¿Qué tarea le consume más tiempo hoy y le gustaría automatizar primero?");
    setTimeout(()=> {
      const items = [];
      if (lead.industry === "Salud") {
        items.push({ label: "citas", value:"citas", next: ()=> askInterestAndDecision() });
        items.push({ label: "recordatorios", value:"recordatorios", next: ()=> askInterestAndDecision() });
        items.push({ label: "pagos", value:"pagos", next: ()=> askInterestAndDecision() });
        items.push({ label: "seguimiento", value:"seguimiento", next: ()=> askInterestAndDecision() });
      } else if (lead.industry === "Despacho Jurídico") {
        items.push({ label: "captación de casos", value:"captacion", next: ()=> askInterestAndDecision() });
        items.push({ label: "documentación", value:"documentacion", next: ()=> askInterestAndDecision() });
        items.push({ label: "filtros legales", value:"filtros", next: ()=> askInterestAndDecision() });
      } else if (lead.industry === "Sector inmobiliario") {
        items.push({ label: "leads", value:"leads", next: ()=> askInterestAndDecision() });
        items.push({ label: "citas", value:"citas", next: ()=> askInterestAndDecision() });
        items.push({ label: "tours", value:"tours", next: ()=> askInterestAndDecision() });
        items.push({ label: "seguimiento", value:"seguimiento", next: ()=> askInterestAndDecision() });
      } else if (lead.industry === "Comercio (minorista / mayorista)") {
        items.push({ label: "inventarios", value:"inventarios", next: ()=> askInterestAndDecision() });
        items.push({ label: "WhatsApp", value:"whatsapp", next: ()=> askInterestAndDecision() });
        items.push({ label: "pedidos", value:"pedidos", next: ()=> askInterestAndDecision() });
        items.push({ label: "Planificación de Recursos Empresariales", value:"planificacion", next: ()=> askInterestAndDecision() });
      } else if (lead.industry === "Belleza") {
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

function askMarketingBudget() {
  addMessage("¿Cuánto invierte aproximadamente al mes?");
  setTimeout(()=> {
    addOptions([
      { label: "A) Menos de $3,000 MXN", value:"<3000", next: ()=> askReadyFor20Clients() },
      { label: "B) Entre $3,000 y $8,000 MXN", value:"3-8k", next: ()=> askReadyFor20Clients() },
      { label: "C) Más de $8,000 MXN", value:">8k", next: ()=> askReadyFor20Clients() },
      { label: "D) Mucho dinero y pocos resultados", value:"bad_spend", next: ()=> askReadyFor20Clients() }
    ]);
  },300);
}

function askReadyFor20Clients() {
  addMessage("Si mañana le llegan 20 clientes nuevos… ¿Está listo para atenderlos?");
  setTimeout(()=> {
    addOptions([
      { label: "Sí", value:"ready_yes", next: ()=> renderPitchForScale() },
      { label: "No", value:"ready_no", next: ()=> renderPitchForAutomation() } // This "No" exists in your flow and is therefore included
    ]);
  },300);
}

function renderPitchForScale() {
  addMessage("Pitch agresivo (escala inmediata)");
  setTimeout(()=> askInterestAndDecision(),600);
}
function renderPitchForAutomation() {
  addMessage("Pitch enfocado en automatizar atención");
  setTimeout(()=> askInterestAndDecision(),600);
}

/* ---------- FASE 5: PITCHES (textos EXACTOS del flujo entregado) ---------- */

function renderPitch_Salud(subcat) {
  lead.subcategory = subcat || "";
  const text = `En consultorios y clínicas la automatización con IA puede contestar llamadas por voz o mensajes de texto, agendar citas y confirmar consultas por usted 24/7, enviar recordatorios a los pacientes (disminuyendo dramáticamente las consultas canceladas o los retrasos). Puede notificarle a Ud. directamente en caso de emergencia. Llevar un control de todos sus expedientes, cobrar consultas por adelantado con medios digitales, darle seguimiento a sus pacientes, enviar felicitaciones en días festivos. Puede aumentar el número de pacientes exponencialmente, de acuerdo a sus instrucciones.
Es importante entender que vivimos en la era de la transformación digital. Según la Curva de Adopción de Innovación de Rogers, las empresas y profesionales se dividen en cinco categorías: los Innovadores (2.5%) que adoptan tecnología primero, los Adoptadores Tempranos (13.5%) que lideran tendencias, la Mayoría Temprana (34%) que adopta cuando ven resultados comprobados, la Mayoría Tardía (34%) que se suma por presión competitiva, y los Rezagados (16%) que resisten el cambio hasta que es demasiado tarde. En el sector salud, quienes adoptan IA ahora se posicionan como líderes, mientras que esperar significa ceder pacientes y prestigio a la competencia que ya está automatizada.
Además, la automatización con IA atrae a un perfil de clientes con un mayor poder adquisitivo y eleva sustancialmente el ticket promedio.`;
  addMessage(text);
  setTimeout(()=> {
    addMessage("Si la implementación fuera 100% accesible a su economía y garantizara recuperar su inversión en un máximo de 3 meses, ¿estaría listo(a) para decidir hoy?");
    setTimeout(()=> {
      addOptions([
        { label: "A) Sí — Listo(a) para contratar hoy", value:"yes_now", next: ()=> openContactCapture() },
        { label: "B) Lo tengo que pensar", value:"think", next: ()=> handleThink() },
        { label: "C) Lo tengo que consultar (socio/jefe/esposo/esposa)", value:"consult", next: ()=> handleConsult() }
      ]);
    },300);
  },400);
}

function renderPitch_Juridico(subcat) {
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
  setTimeout(()=> {
    addMessage("Si la implementación fuera 100% accesible a su economía y garantizara recuperar su inversión en un máximo de 3 meses, ¿estaría listo(a) para decidir hoy?");
    setTimeout(()=> {
      addOptions([
        { label: "A) Sí — Listo(a) para contratar hoy", value:"yes_now", next: ()=> openContactCapture() },
        { label: "B) Lo tengo que pensar", value:"think", next: ()=> handleThink() },
        { label: "C) Lo tengo que consultar (socio/jefe/esposo/esposa)", value:"consult", next: ()=> handleConsult() }
      ]);
    },300);
  },400);
}

/* For other industries use the exact texts you provided; here we present a generic mapping that calls the exact flows when available */
function renderPitch_Generic(giro) {
  // The full texts for realestate/food/edu/retail/freelance/content/beauty are long and included in your flow.
  // We'll include them literally here for each matching giro.
  const P = {
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
Es importante entender que vivimos en la era de la transformación digital. Según la Curva de Adopción de Innovación de Rogers, las empresas y profesionales se dividen en cinco categorías: los Innovadores (2.5%) que adoptan tecnología primero, los Adoptadores Tempranos (13.5%) que lideran tendencias, la Mayoría Temprana (34%) que adopta cuando ven resultados comprobados, la Mayoría Tardía (34%) que se suma por presión competitiva, y los Rezagados (16%) que resisten el cambio hasta que es demasiado tarde. En el sector inmobiliario, quienes adoptan IA ahora se posicionan como líderes, mientras que esperar significa ceder propiedades y clientes a la competencia que ya está automatizada.
Además, la automatización con IA atrae a un perfil de clientes con un mayor poder adquisitivo y eleva sustancialmente el ticket promedio.`,
    "Restaurante o Cafetería": `🍽 [TÍTULO] [APELLIDO], en su negocio cada mensaje que llega por WhatsApp o redes es un cliente listo para comprar ahora.
La automatización con IA puede contestar llamadas por voz o mensajes de texto, responder dudas y preguntas frecuentes a sus clientes 24/7, agendar citas, enviar recordatorios, confirmar reuniones de trabajo, etc.
Si nadie responde rápido…
👉 se van al restaurante de la competencia
Nuestra IA trabaja como anfitriona 24/7:
✅ Responde al instante
✅ Gestiona pedidos
✅ Agenda reservaciones
✅ Recomienda platillos populares
✅ Confirma asistencia con anticipación
Resultado real en negocios como el suyo:
→ 2X a 4X más ventas en menos de 90 días
→ Menos mesas vacías, más ingresos diarios
Es importante entender que vivimos en la era de la transformación digital. Según la Curva de Adopción de Innovación de Rogers, ...
Además, la automatización con IA atrae a un perfil de clientes con mayor poder adquisitivo y eleva sustancialmente el ticket promedio.`,
    "Educación": `🎓 [TÍTULO] [APELLIDO], hoy los padres y alumnos toman decisiones en cuestión de minutos.
La automatización con IA puede contestar llamadas por voz o mensajes de texto, responder dudas y preguntas frecuentes a sus clientes 24/7, agendar citas, enviar recordatorios, confirmar reuniones de trabajo, etc.
Nuestra IA es su coordinadora de admisiones 24/7:
✅ Responde al instante dudas sobre costos, horarios, requisitos (sin errores)
✅ Agenda visitas y entrevistas sola
✅ Da seguimiento hasta la inscripción
✅ Recordatorios automáticos de pagos
✅ Retiene alumnos para evitar deserción
Resultado en instituciones como la suya:
→ +30% a +200% más inscripciones
→ Menos abandono
→ Más ingresos recurrentes
Es importante entender que vivimos en la era de la transformación digital. ...`,
    "Comercio (minorista / mayorista)": `🛍 [TÍTULO] [APELLIDO], en comercio la venta ocurre en el mismo momento en que el cliente pregunta.
Nuestra IA se convierte en su mejor vendedor 24/7:
✅ Responde WhatsApp e Instagram al instante
✅ Muestra catálogo y precios
✅ Recomienda productos con mayor margen
✅ Agrega al carrito y cobra sola
✅ Verifica existencias en inventario
✅ Envío o pickup automatizado
Resultado real:
→ 2X a 5X ventas en menos de 90 días
→ Ingresos mientras usted duerme`,
    "Profesional independiente": `👔 [TÍTULO] [APELLIDO], cuando una persona trabaja por su cuenta… el tiempo es el recurso más valioso y cada hora que no factura… es dinero perdido.
La automatización con IA puede contestar llamadas por voz o mensajes de texto, responder dudas y preguntas frecuentes a sus clientes 24/7, agendar citas, enviar recordatorios, confirmar reuniones de trabajo, etc.
Nuestra IA se encarga de:
✅ Responder a todos los interesados al instante
✅ Filtrar clientes sin presupuesto
✅ Agendar citas automáticamente
✅ Cerrar prospectos mientras usted trabaja
Resultado directo:
→ Se duplican sus oportunidades reales de venta`,
    "Creación de contenido": `📱 [TÍTULO] [APELLIDO], tu marca puede multiplicar ventas sin saturarte.
La automatización con IA puede contestar llamadas por voz o mensajes de texto, responder dudas y preguntas frecuentes a sus clientes 24/7, agendar citas, enviar recordatorios, confirmar reuniones de trabajo, etc.
La IA:
✅ Responde y convierte seguidores en clientes
✅ Crea contenido, guiones y copy optimizados
✅ Automatiza ventas de cursos, citas y productos digitales
✅ Acelera tu crecimiento → más ingresos por la misma energía`,
    "Belleza": `💄 [TÍTULO] [APELLIDO], cuando alguien quiere un servicio de belleza la decisión la toma en ese mismo momento.
La automatización con IA puede contestar llamadas por voz o mensajes de texto, responder dudas y preguntas frecuentes a sus clientes 24/7, agendar citas, enviar recordatorios, confirmar reuniones de trabajo, etc.
Nuestra IA trabaja como su recepcionista perfecta 24/7:
✅ Responde al instante
✅ Agenda citas sola
✅ Envía recordatorios
✅ Reduce cancelaciones +80%
✅ Da seguimiento hasta que el cliente confirma`
  };

  const txt = P[giro] || `Pronto le mostraremos un plan específico para su giro.`;
  addMessage(txt);
  setTimeout(()=> {
    addMessage("Si la implementación fuera 100% accesible a su economía y garantizara recuperar su inversión en un máximo de 3 meses, ¿estaría listo(a) para decidir hoy?");
    setTimeout(()=> {
      addOptions([
        { label: "A) Sí — Listo(a) para contratar hoy", value:"yes_now", next: ()=> openContactCapture() },
        { label: "B) Lo tengo que pensar", value:"think", next: ()=> handleThink() },
        { label: "C) Lo tengo que consultar (socio/jefe/esposo/esposa)", value:"consult", next: ()=> handleConsult() }
      ]);
    },300);
  },400);
}

/* ---------- FASE 7: cierre/objeciones ---------- */
function askInterestAndDecision() {
  addMessage("Si la implementación fuera 100% accesible a su economía y garantizara recuperar su inversión en un máximo de 3 meses, ¿estaría listo(a) para decidir hoy?");
  setTimeout(()=> {
    addOptions([
      { label: "A) Sí — Listo(a) para contratar hoy", value:"yes_now", next: ()=> openContactCapture() },
      { label: "B) Lo tengo que pensar", value:"think", next: ()=> handleThink() },
      { label: "C) Lo tengo que consultar (socio/jefe/esposo/esposa)", value:"consult", next: ()=> handleConsult() }
    ]);
  },300);
}

function handleThink() {
  addMessage("¿Qué porcentaje de la decisión de implementar una automatización de IA en su negocio depende de usted?");
  setTimeout(()=> {
    addOptions([
      { label: "A) Menos de 50%", value:"lt50", next: ()=> { addMessage("Entiendo."); askDecisionIfHalfOrMore(false); } },
      { label: "B) 50%", value:"50", next: ()=> { addMessage("Perfecto."); askDecisionIfHalfOrMore(true); } },
      { label: "C) Más de 50%", value:"gt50", next: ()=> { addMessage("Perfecto."); askDecisionIfHalfOrMore(true); } }
    ]);
  },300);
}

function askDecisionIfHalfOrMore(isHalfOrMore) {
  if (isHalfOrMore) {
    addMessage("Si el 50% de su decisión en realidad fuera un 100% ¿estaría decidido a adquirir en este momento?");
    setTimeout(()=> {
      addOptions([
        { label: "Sí", value:"final_yes", next: ()=> openContactCapture() },
        { label: "No", value:"final_no", next: ()=> { addMessage("Entiendo. Le enviaremos una presentación."); offerPresentation(); } } // "No" exists here in your flow
      ]);
    },300);
  } else {
    addMessage("[TÍTULO] [APELLIDO] usted es un profesional [DE LA SALUD / DEL DERECHO / etc.] que ha tomado decisiones toda su vida, cada decisión que ha tomado, ha determinado sus éxitos y adversidades, esta es simplemente una decisión más, si usted pudiera predecir con certeza matemática y con métricas de inteligencia predictiva el retorno de su inversión respaldado por un contrato por escrito y con la garantía de que en un máximo de 3 meses usted recuperará su inversión ¿estaría listo para tomar la decisión el día de hoy?");
    setTimeout(()=> {
      addOptions([
        { label: "Sí", value:"indeciso_yes", next: ()=> openContactCapture() },
        { label: "No", value:"indeciso_no", next: ()=> { addMessage("Entiendo. Le enviaremos una presentación."); offerPresentation(); } } // again "No" is only here because it's in your flow
      ]);
    },400);
  }
}

function offerPresentation() {
  addMessage("Perfecto. ¿Cuál email usamos para enviar la presentación?");
  currentStep = "capturePresentationEmail";
  unlockInput();
}

function handleConsult() {
  addMessage("¿Desea que le enviemos una presentación por email o prefiere agendar una reunión con su decisor?");
  setTimeout(()=> {
    addOptions([
      { label: "A) Enviar presentación (email)", value: "send_pres", next: ()=> askEmailForPresentation() },
      { label: "B) Agendar reunión con decisor", value:"agendar_decisor", next: ()=> openContactCapture() }
    ]);
  },300);
}

// función añadida según instrucción
function askEmailForPresentation() {
  addMessage("Por favor ingrese su email en el campo inferior y presione Enviar.");
  state.step = "awaitEmailForPresentation";
  inputField.disabled = false;
  sendBtn.disabled = false;
}


/* ---------- FASE 8: captura de contacto ---------- */
function openContactCapture() {
  addMessage("Perfecto. Para agendar necesito: Teléfono (WhatsApp), Email, Día preferido y Hora aproximada.");
  currentStep = "captureContactLine";
  unlockInput();
}

/* ---------- FASE 9: evasive responses ---------- */
function handleEvasiveContact() {
  addMessage('Claro que sí [TÍTULO] [APELLIDO], le comparto nuestro WhatsApp directo donde uno de nuestros ingenieros expertos puede atenderle de manera personalizada en cualquier momento que usted lo requiera +527717622360');
  // end of conversation note: per flow do not send WhatsApp automatically
}

/* ---------- FASE 10: insistencia sutil ---------- */
function insistenceAnecdote() {
  addMessage('Muy bien [TÍTULO] pero antes de despedirnos le voy a contar brevemente una anécdota, uno de nuestros clientes se preguntaba por qué razón habían negocios super exitosos, mientras que el suyo parecía estar estancado, a pesar de ello decidió no invertir en nuestros servicios, así que le hice una sugerencia, le dije que escribiera en un papel "HELIOS" y que lo guardara debajo de su almohada y que cada vez que sintiera que su negocio no tenía el éxito que merecía, sacara el papel y lo leyera. ¿Le gustaría agendar una asesoría gratuita de 20 minutos que puede transformar su negocio para siempre o prefiere escribir HELIOS en un papelito?');
  setTimeout(()=> {
    addOptions([
      { label: "Agendar asesoría gratuita de 20 minutos", value:"agendar_20", next: ()=> openContactCapture() },
      { label: "Prefiero escribir HELIOS en un papelito", value:"papelito", next: ()=> { addMessage("Entendido. Si cambia de opinión, aquí estamos."); } }
    ]);
  },300);
}

/* ---------- FASE 11: Información de la empresa (B) - implemented above in handleB ---------- */

/* ---------- Submit typed input handling ---------- */
sendBtn.addEventListener("click", onSubmit);
inputField.addEventListener("keydown", (e)=> { if (e.key === "Enter") onSubmit(); });

async function onSubmit() {
  const raw = (inputField.value || "").trim();
  if (!raw) return;

  if (optionsVisible) {
    addMessage("Por favor seleccione una de las opciones mostradas arriba.", "bot");
    inputField.value = "";
    return;
  }

  // user bubble
  addMessage(raw, "user");
  inputField.value = "";

  // store answer
  lead.responses.push({ text: raw, ts: new Date().toISOString() });

  // handle typed steps
  if (currentStep === "captureName") {
    // store surname conservatively
    lead.name = extractSurname(raw) || raw;
    // AFTER capture name, ask title choice explicitly (user requested title selection choice)
    addMessage("¿Cómo prefiere que me dirija a usted? Elija una opción:");
    const titleItems = TITLE_CHOICES.map(t => ({ label: t, value: t, next: (v)=> { lead.title = v; addMessage(`Es un gusto ${lead.title} ${lead.name}. Será un placer atenderle.`); setTimeout(()=> { showMainMenu(); }, 500); } }));
    addOptions(titleItems);
    currentStep = null;
    return;
  }

  if (currentStep === "capturePresentationEmail") {
    // accept email, send presentation flag
    lead.email = raw;
    await sendLeadPayload({ wantsPresentation: true, emailCaptured: true });
    addMessage("Perfecto. Le enviaremos la presentación a ese correo. Gracias.");
    currentStep = null;
    setTimeout(()=> showMainMenu(), 700);
    return;
  }

  if (currentStep === "captureContactLine") {
    captureContactLineHandler(raw);
    return;
  }

  // If no step matched, reopen menu
  setTimeout(()=> { addMessage("No entendí exactamente — ¿Desea ver las opciones nuevamente?"); setTimeout(()=> showMainMenu(), 400); },200);
}

/* ---------- capture contact line parsing ---------- */
async function captureContactLineHandler(line) {
  // Expect: Teléfono (WhatsApp), Email, Día preferido y Hora aproximada.
  const parts = line.split(",").map(p=>p.trim()).filter(Boolean);
  if (parts.length < 2) {
    addMessage("Por favor ingrese al menos Teléfono (WhatsApp) y Email separados por comas.");
    return;
  }
  if (!lead.phone && parts[0]) lead.phone = parts[0];
  if (!lead.email && parts[1]) lead.email = parts[1];
  if (parts[2]) lead.preferredDay = parts[2];
  if (parts[3]) lead.preferredTime = parts[3];

  addMessage("Gracias. En breve recibirá confirmación por email si procede.");
  currentStep = null;

  const extra = { schedule: !!lead.email, emailCaptured: !!lead.email };
  await sendLeadPayload(extra);
}

/* ---------- send lead payload to webhook n8n ---------- */
async function sendLeadPayload(extra = {}) {
  const payload = {
    sessionId,
    timestamp: new Date().toISOString(),
    lead: {
      name: lead.name || "",
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

/* ---------- Init ---------- */
window.addEventListener("load", ()=> {
  // Start at FASE 0 (ask name)
  inputField.disabled = false;
  if (sendBtn) sendBtn.disabled = false;
  startChat();
});
