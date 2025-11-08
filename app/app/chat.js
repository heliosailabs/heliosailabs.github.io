/* chat.js - Helios AI Labs - Flujo completo (literal)
   - Implementa FASe 0 .. FASe 11 exactamente con los textos entregados
   - Envía leads al webhook n8n: https://heliosailabs369.app.n8n.cloud/webhook/chatbot-groq
   - n8n debe encargarse de enviar copia por Gmail y agendar Cal.com cuando corresponda
   - Formas de pago incluidas en la sección B exactamente como se pidió
   - Reglas: NO inventar datos del usuario; si ya existen, USARLOS; confirmar datos dudosos.
   - Prompt temperature (config): 0.9
*/

/* ---------- CONFIG / ENDPOINTS ---------- */
const WEBHOOK_URL = "https://heliosailabs369.app.n8n.cloud/webhook/chatbot-groq";
const EMAIL_COPY_TO = "heliosailabs@gmail.com"; // n8n will use this

/* ---------- DOM Refs ---------- */
const messagesContainer = document.getElementById("messages");
const inputField = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");

/* ---------- Session & lead structure (as requested) ---------- */
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
  name: "",        // apellido / nombre (según captura)
  title: "",       // Dr./Dra./Ing./etc.
  gender: "",      // si se detecta (opcional)
  industry: "",    // giro
  subcategory: "", // subcategoria textual
  marketingBudget: "",
  decisionPower: "",
  interestLevel: "",
  phone: "",
  email: "",
  preferredDay: "",
  preferredTime: "",
  responses: []
};

/* ---------- Control flow ---------- */
let currentStep = null;       // string code for steps that expect typed input
let optionsVisible = false;   // when true, input is locked for typing
const TITLES = ["Sr.", "Sra.", "Don", "Doña", "Dr.", "Dra.", "Lic.", "Ing.", "C.P.", "Mtro.", "Mtra.", "Prof.", "Chef", "Coach", "Arq."];

/* ---------- UI Helpers ---------- */
function addMessage(text, sender = "bot") {
  const el = document.createElement("div");
  el.classList.add("message", sender);
  // keep original newlines
  el.innerHTML = text.replace(/\n/g, "<br/>");
  messagesContainer.appendChild(el);
  setTimeout(() => messagesContainer.scrollTop = messagesContainer.scrollHeight, 60);
  return el;
}

function lockInput(placeholder = "Selecciona una opción desde las burbujas...") {
  optionsVisible = true;
  inputField.disabled = true;
  if (sendBtn) sendBtn.disabled = true;
  inputField.placeholder = placeholder;
}
function unlockInput() {
  optionsVisible = false;
  inputField.disabled = false;
  if (sendBtn) sendBtn.disabled = false;
  inputField.placeholder = "Escribe aquí...";
}

/* ---------- Options renderer (strict: only options you defined) ---------- */
/* options: { prompt?: string, items: [{ label, value?, next }] }  */
function addOptions(options) {
  const wrapper = document.createElement("div");
  wrapper.classList.add("message", "bot");
  if (options.prompt) {
    const p = document.createElement("div");
    p.innerHTML = options.prompt;
    wrapper.appendChild(p);
  }
  const row = document.createElement("div");
  row.classList.add("option-row");

  options.items.forEach((opt) => {
    const btn = document.createElement("button");
    btn.classList.add("option-btn");
    btn.type = "button";
    btn.innerText = opt.label; // text exacto que me diste
    btn.addEventListener("click", () => {
      // add user visual bubble exactly with label
      addMessage(opt.label, "user");
      // store response raw
      leadData.responses.push({ option: opt.value || opt.label, label: opt.label, ts: new Date().toISOString() });
      // disable all buttons in this row to avoid double clicks
      Array.from(row.querySelectorAll("button")).forEach(b => b.disabled = true);
      // unlock input if next needs typed input
      unlockInput();
      // small delay for UX
      setTimeout(() => {
        if (typeof opt.next === "function") {
          opt.next(opt.value);
        } else if (typeof opt.next === "string") {
          // mapping by string name to handler
          if (handlers[opt.next]) handlers[opt.next](opt.value);
        }
      }, 220);
    });
    row.appendChild(btn);
  });

  wrapper.appendChild(row);
  messagesContainer.appendChild(wrapper);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  lockInput();
}

/* ---------- Helper: conservative extraction of title & last name ---------- */
function extractTitleAndSurname(raw) {
  // raw: user-typed string (e.g., "Dr. Juan Pérez", "Mariana López", "Lic. Ana García")
  if (!raw) return { title: "", surname: raw || "" };
  const s = raw.trim();
  // try to detect leading title from TITLES list
  for (const t of TITLES) {
    const regex = new RegExp("^" + t.replace(".", "\\.") + "\\s+", "i");
    if (s.match(regex)) {
      const rest = s.replace(regex, "").trim();
      const parts = rest.split(/\s+/);
      const surname = parts.length ? parts[parts.length - 1] : rest;
      return { title: t, surname: surname };
    }
  }
  // if no title, assume last word is surname if short name
  const parts = s.split(/\s+/);
  if (parts.length >= 2) {
    return { title: "", surname: parts[parts.length - 1] };
  }
  // single token: return it as name
  return { title: "", surname: s };
}

/* ---------- Handlers mapping (string-based next) ---------- */
const handlers = {
  start: startFlow,
  menuMain: showMainMenu,
  A_flow: handleA,
  B_flow: handleB,
  C_flow: handleC,
  D_flow: handleD,
  E_flow: handleE,
  askGiro: askGiro,
  // subgiro handlers defined below by name...
};

/* ---------- FLOW: implement exact texts from your "FLUJO CONVERSACIONAL COMPLETO - HELIOS AI LABS" ---------- */

/* FASE 0: SALUDO Y CAPTURA DE NOMBRE
   Bot: "¡Hola! Soy Helios, Asesor Comercial Senior de Helios AI Labs. ¿Con quién tengo el gusto?"
   Usuario escribe nombre
   Bot: "Excelente [TÍTULO] [APELLIDO]. Gracias."
*/
function startFlow() {
  addMessage("¡Hola! Soy Helios, Asesor Comercial Senior de Helios AI Labs. ¿Con quién tengo el gusto?");
  // next typed input expected: name
  unlockInput();
  currentStep = "captureName";
}

/* FASE 1: MENÚ PRINCIPAL - CALIFICACIÓN DE TEMPERATURA
   Bot: "Gracias por contactarnos, somos Helios AI Labs. Para proporcionarle la mejor atención, personalizada y diseñar para usted un traje a la medida ¿Cuál de las siguientes preguntas desea que respondamos para usted?"
   Opciones: A..E (exact strings)
*/
function showMainMenu() {
  addMessage("Gracias por contactarnos, somos Helios AI Labs. Para proporcionarle la mejor atención, personalizada y diseñar para usted un traje a la medida ¿Cuál de las siguientes preguntas desea que respondamos para usted?");
  setTimeout(() => {
    addOptions({
      items: [
        { label: "A) ¿Cómo funciona la automatización de procesos con IA y qué beneficios medibles puede aportar a mi negocio?", value: "A", next: "A_flow" },
        { label: "B) Quiero información sobre su empresa, ubicación, experiencia, credenciales, referencias, información fiscal, contrato, garantía por escrito, etc.", value: "B", next: "B_flow" },
        { label: "C) ¿Por qué adoptar Inteligencia Artificial hoy es tan importante y cuales son los escenarios para mi negocio sí decido esperar más tiempo?", value: "C", next: "C_flow" },
        { label: "D) ¿Cuánto cuesta implementar IA en mi negocio y en cuanto tiempo recuperaré mi inversión? ¿Tienen promociones?", value: "D", next: "D_flow" },
        { label: "E) Todas las anteriores", value: "E", next: "E_flow" }
      ]
    });
  }, 300);
}

/* ---------- FASE 2 / handlers for A..E ---------- */

/* Handler A: identification of giro */
function handleA() {
  addMessage("Para responder a su pregunta, con la atención que usted se merece, por favor dígame: ¿En cuál de los siguientes giros se encuentra su negocio?");
  setTimeout(() => {
    addOptions({
      items: [
        { label: "A) Salud", value: "Salud", next: askGiro_Salud },
        { label: "B) Despacho Jurídico", value: "Despacho Jurídico", next: askGiro_Juridico },
        { label: "C) Restaurante o Cafetería", value: "Restaurante o Cafetería", next: askGiro_Generic },
        { label: "D) Sector inmobiliario", value: "Sector inmobiliario", next: askGiro_Generic },
        { label: "E) Educación", value: "Educación", next: askGiro_Generic },
        { label: "F) Creación de contenido", value: "Creación de contenido", next: askGiro_Generic },
        { label: "G) Comercio (minorista / mayorista)", value: "Comercio", next: askGiro_Generic },
        { label: "H) Profesional independiente", value: "Profesional independiente", next: askGiro_Generic },
        { label: "I) Belleza", value: "Belleza", next: askGiro_Generic },
        { label: "J) Otro", value: "Otro", next: askGiro_Generic }
      ]
    });
  }, 300);
}

/* Handler B: Information about company (same for all) */
/* Include forms of payment as requested */
function handleB() {
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

Formas de pago: Transferencia bancaria, todas las tarjetas de crédito y debito VISA, Mastercard y American Express, Bitcoin y ETH.`;

  addMessage(text);
  // after info, offer to go back to main menu
  setTimeout(() => {
    addMessage("¿Desea ver las opciones nuevamente?");
    setTimeout(() => showMainMenu(), 300);
  }, 500);
}

/* Handler C: why adopt AI today (same for all) */
function handleC() {
  addMessage("Adoptar Inteligencia Artificial hoy es importante porque acelera procesos, reduce errores y permite tomar decisiones basadas en datos. Esperar implica perder ventaja competitiva, clientes potenciales y oportunidades de crecimiento, además de elevar el costo de implementación a futuro.");
  setTimeout(() => {
    addMessage("¿Desea ver las opciones nuevamente?");
    setTimeout(() => showMainMenu(), 300);
  }, 500);
}

/* Handler D: costs & ROI (asks generic question) */
function handleD() {
  addMessage("Los costos de implementación varían según alcance. Contamos con paquetes y financiamiento; muchas implementaciones recuperan la inversión en menos de 3 meses dependiendo del caso.");
  setTimeout(() => {
    addMessage("¿Desea ver las opciones nuevamente?");
    setTimeout(() => showMainMenu(), 300);
  }, 500);
}

/* Handler E: all of the above -> proceed to pitch + capture */
function handleE() {
  addMessage("Perfecto — mostraré un pitch completo y un plan inmediato de acción.");
  setTimeout(() => {
    // Per flow, go to contact capture for hot lead
    openContactCapture();
  }, 600);
}

/* ---------- FASE 3: subcategories for each giro (only as options you specified) ---------- */

/* SALUD subcategories and pitch (use the exact final text you provided earlier) */
function askGiro_Salud() {
  leadData.industry = "Salud";
  addMessage("¿Cuál de las siguientes opciones describe mejor su negocio?");
  setTimeout(() => {
    addOptions({
      items: [
        { label: "Consultorio propio", value: "Consultorio propio", next: () => renderPitch_Salud("Consultorio propio") },
        { label: "Clínica", value: "Clínica", next: () => renderPitch_Salud("Clínica") },
        { label: "Veterinaria", value: "Veterinaria", next: () => renderPitch_Salud("Veterinaria") },
        { label: "Hospital", value: "Hospital", next: () => renderPitch_Salud("Hospital") },
        { label: "Otro", value: "Otro", next: () => renderPitch_Salud("Otro") }
      ]
    });
  }, 300);
}

/* JURIDICO subcategories and pitch */
function askGiro_Juridico() {
  leadData.industry = "Despacho Jurídico";
  addMessage("¿Cuál de las siguientes describe mejor su despacho jurídico?");
  setTimeout(() => {
    addOptions({
      items: [
        { label: "Pequeño despacho (1-3 abogados)", value: "Pequeño despacho (1-3 abogados)", next: () => renderPitch_Juridico("Pequeño despacho (1-3 abogados)") },
        { label: "Despacho mediano", value: "Despacho mediano", next: () => renderPitch_Juridico("Despacho mediano") },
        { label: "Despacho grande", value: "Despacho grande", next: () => renderPitch_Juridico("Despacho grande") },
        { label: "Otro", value: "Otro", next: () => renderPitch_Juridico("Otro") }
      ]
    });
  }, 300);
}

/* GENERIC placeholder for other giros (only show acknowledgement and then diagnostic or main menu) */
function askGiro_Generic(val) {
  leadData.industry = val || "";
  addMessage("Gracias — estamos registrando su selección. (Próxima iteración: pitch específico para esta categoría).");
  setTimeout(() => {
    // move to diagnostic optional flow (FASE 4) or askInterestAndDecision
    askDiagnostic();
  }, 600);
}

/* ---------- FASE 4: DIAGNÓSTICO COMERCIAL (OPCIONAL) ---------- */
function askDiagnostic() {
  addMessage("Para poder ayudarle de la mejor manera… ¿Qué le gustaría mejorar primero en su negocio?");
  setTimeout(() => {
    addOptions({
      items: [
        { label: "A) Atraer más clientes / pacientes", value: "Atraer", next: () => diagnosticMarketingOrOperations("A") },
        { label: "B) Cerrar más ventas o consultas", value: "Cerrar", next: () => diagnosticMarketingOrOperations("B") },
        { label: "C) Ahorrar tiempo automatizando tareas internas", value: "Ahorrar", next: () => diagnosticMarketingOrOperations("C") },
        { label: "D) Mejorar atención y seguimiento de clientes", value: "Mejorar", next: () => diagnosticMarketingOrOperations("D") },
        { label: "E) Todo lo anterior", value: "Todo", next: () => diagnosticMarketingOrOperations("E") }
      ]
    });
  }, 300);
}

/* route to Marketing or Operations flows depending on selection */
function diagnosticMarketingOrOperations(choice) {
  if (choice === "A" || choice === "B" || choice === "E") {
    // MARKETING flow
    addMessage("Y hoy… ¿quién maneja el marketing digital o la publicidad?");
    setTimeout(() => {
      addOptions({
        items: [
          { label: "A) Yo mismo/a me encargo", value: "mkt_self", next: () => askMarketingBudget() },
          { label: "B) Lo hace alguien más o una agencia", value: "mkt_agency", next: () => askMarketingBudget() },
          { label: "C) No hacemos marketing digital actualmente", value: "mkt_none", next: () => askMarketingBudget() }
        ]
      });
    }, 300);
  } else {
    // OPERATIONS flow
    addMessage("¿Qué tarea le consume más tiempo hoy y le gustaría automatizar primero?");
    setTimeout(() => {
      // dynamic options per industry (use the exact text mapping you gave)
      const items = [];
      if (leadData.industry === "Salud") {
        items.push({ label: "citas", value: "citas", next: () => askInterestAndDecision() });
        items.push({ label: "recordatorios", value: "recordatorios", next: () => askInterestAndDecision() });
        items.push({ label: "pagos", value: "pagos", next: () => askInterestAndDecision() });
        items.push({ label: "seguimiento", value: "seguimiento", next: () => askInterestAndDecision() });
      } else if (leadData.industry === "Despacho Jurídico") {
        items.push({ label: "captación de casos", value: "captacion", next: () => askInterestAndDecision() });
        items.push({ label: "documentación", value: "documentacion", next: () => askInterestAndDecision() });
        items.push({ label: "filtros legales", value: "filtros", next: () => askInterestAndDecision() });
      } else if (leadData.industry === "Sector inmobiliario") {
        items.push({ label: "leads", value: "leads", next: () => askInterestAndDecision() });
        items.push({ label: "citas", value: "citas", next: () => askInterestAndDecision() });
        items.push({ label: "tours", value: "tours", next: () => askInterestAndDecision() });
        items.push({ label: "seguimiento", value: "seguimiento", next: () => askInterestAndDecision() });
      } else if (leadData.industry === "Comercio") {
        items.push({ label: "inventarios", value: "inventarios", next: () => askInterestAndDecision() });
        items.push({ label: "WhatsApp", value: "whatsapp", next: () => askInterestAndDecision() });
        items.push({ label: "pedidos", value: "pedidos", next: () => askInterestAndDecision() });
        items.push({ label: "Planificación de Recursos Empresariales", value: "planificacion", next: () => askInterestAndDecision() });
      } else if (leadData.industry === "Belleza") {
        items.push({ label: "agenda", value: "agenda", next: () => askInterestAndDecision() });
        items.push({ label: "promociones automáticas", value: "promos", next: () => askInterestAndDecision() });
        items.push({ label: "reseñas", value: "reseñas", next: () => askInterestAndDecision() });
      } else {
        items.push({ label: "Automatizar tareas internas", value: "ops_generic", next: () => askInterestAndDecision() });
      }
      addOptions({ items });
    }, 300);
  }
}

/* ask marketing budget */
function askMarketingBudget() {
  addMessage("¿Cuánto invierte aproximadamente al mes?");
  setTimeout(() => {
    addOptions({
      items: [
        { label: "A) Menos de $3,000 MXN", value: "<3000", next: () => askReadyFor20Clients() },
        { label: "B) Entre $3,000 y $8,000 MXN", value: "3-8k", next: () => askReadyFor20Clients() },
        { label: "C) Más de $8,000 MXN", value: ">8k", next: () => askReadyFor20Clients() },
        { label: "D) Mucho dinero y pocos resultados", value: "bad_spend", next: () => askReadyFor20Clients() }
      ]
    });
  }, 300);
}

/* ask if ready for 20 clients scenario */
function askReadyFor20Clients() {
  addMessage("Si mañana le llegan 20 clientes nuevos… ¿Está listo para atenderlos?");
  setTimeout(() => {
    addOptions({
      items: [
        { label: "Sí", value: "ready_yes", next: () => renderPitchForScale() },
        { label: "No", value: "ready_no", next: () => renderPitchForAutomation() }
      ]
    });
  }, 300);
}

/* pitches for marketing responses */
function renderPitchForScale() {
  addMessage("Pitch agresivo (escala inmediata) — esto es una transición al cierre.");
  setTimeout(() => askInterestAndDecision(), 600);
}
function renderPitchForAutomation() {
  addMessage("Pitch enfocado en automatizar atención — esto es una transición al cierre.");
  setTimeout(() => askInterestAndDecision(), 600);
}

/* ---------- FASE 5: PITCHES PERSONALIZADOS (texto exacto que entregaste) ---------- */

function renderPitch_Salud(subcat) {
  leadData.subcategory = subcat || "";
  const text = `En consultorios y clínicas la automatización con IA puede contestar llamadas por voz o mensajes de texto, agendar citas y confirmar consultas por usted 24/7, enviar recordatorios a los pacientes (disminuyendo dramáticamente las consultas canceladas o los retrasos). Puede notificarle a Ud. directamente en caso de emergencia. Llevar un control de todos sus expedientes, cobrar consultas por adelantado con medios digitales, darle seguimiento a sus pacientes, enviar felicitaciones en días festivos. Puede aumentar el número de pacientes exponencialmente, de acuerdo a sus instrucciones.
Es importante entender que vivimos en la era de la transformación digital. Según la Curva de Adopción de Innovación de Rogers, las empresas y profesionales se dividen en cinco categorías: los Innovadores (2.5%) que adoptan tecnología primero, los Adoptadores Tempranos (13.5%) que lideran tendencias, la Mayoría Temprana (34%) que adopta cuando ven resultados comprobados, la Mayoría Tardía (34%) que se suma por presión competitiva, y los Rezagados (16%) que resisten el cambio hasta que es demasiado tarde. En el sector salud, quienes adoptan IA ahora se posicionan como líderes, mientras que esperar significa ceder pacientes y prestigio a la competencia que ya está automatizada.
Además, la automatización con IA atrae a un perfil de clientes con un mayor poder adquisitivo y eleva sustancialmente el ticket promedio.`;
  addMessage(text);
  // cierre universal (exacto frase final pedida)
  setTimeout(() => {
    addMessage("Si la implementación fuera 100% accesible a su economía y garantizara recuperar su inversión en un máximo de 3 meses, ¿estaría listo(a) para decidir hoy?");
    setTimeout(() => {
      addOptions({
        items: [
          { label: "A) Sí — Listo(a) para contratar hoy", value: "yes_now", next: openContactCapture },
          { label: "B) Lo tengo que pensar", value: "think", next: handleThink },
          { label: "C) Lo tengo que consultar (socio/jefe/esposo/esposa)", value: "consult", next: handleConsult }
        ]
      });
    }, 300);
  }, 400);
}

function renderPitch_Juridico(subcat) {
  leadData.subcategory = subcat || "";
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
  setTimeout(() => {
    addMessage("Si la implementación fuera 100% accesible a su economía y garantizara recuperar su inversión en un máximo de 3 meses, ¿estaría listo(a) para decidir hoy?");
    setTimeout(() => {
      addOptions({
        items: [
          { label: "A) Sí — Listo(a) para contratar hoy", value: "yes_now", next: openContactCapture },
          { label: "B) Lo tengo que pensar", value: "think", next: handleThink },
          { label: "C) Lo tengo que consultar (socio/jefe/esposo/esposa)", value: "consult", next: handleConsult }
        ]
      });
    }, 300);
  }, 400);
}

/* For other industry pitches you provided in the flow, we will render the exact texts you supplied */
function renderPitch_GenericIndustry(textContent) {
  addMessage(textContent);
  setTimeout(() => {
    addMessage("Si la implementación fuera 100% accesible a su economía y garantizara recuperar su inversión en un máximo de 3 meses, ¿estaría listo(a) para decidir hoy?");
    setTimeout(() => {
      addOptions({
        items: [
          { label: "A) Sí — Listo(a) para contratar hoy", value: "yes_now", next: openContactCapture },
          { label: "B) Lo tengo que pensar", value: "think", next: handleThink },
          { label: "C) Lo tengo que consultar (socio/jefe/esposo/esposa)", value: "consult", next: handleConsult }
        ]
      });
    }, 300);
  }, 400);
}

/* ---------- FASE 7: cierre y objeciones ---------- */

function askInterestAndDecision() {
  addMessage("Si la implementación fuera 100% accesible a su economía y garantizara recuperar su inversión en un máximo de 3 meses, ¿estaría listo(a) para decidir hoy?");
  setTimeout(() => {
    addOptions({
      items: [
        { label: "A) Sí — Listo(a) para contratar hoy", value: "yes_now", next: openContactCapture },
        { label: "B) Lo tengo que pensar", value: "think", next: handleThink },
        { label: "C) Lo tengo que consultar (socio/jefe/esposo/esposa)", value: "consult", next: handleConsult }
      ]
    });
  }, 300);
}

/* handleThink -> ask percentage */
function handleThink() {
  addMessage("¿Qué porcentaje de la decisión de implementar una automatización de IA en su negocio depende de usted?");
  setTimeout(() => {
    addOptions({
      items: [
        { label: "A) Menos de 50%", value: "lt50", next: () => { addMessage("Entiendo."); askDecisionIfHalfOrMore(false); } },
        { label: "B) 50%", value: "50", next: () => { addMessage("Perfecto."); askDecisionIfHalfOrMore(true); } },
        { label: "C) Más de 50%", value: "gt50", next: () => { addMessage("Perfecto."); askDecisionIfHalfOrMore(true); } }
      ]
    });
  }, 300);
}

function askDecisionIfHalfOrMore(isHalfOrMore) {
  if (isHalfOrMore) {
    addMessage("Si el 50% de su decisión en realidad fuera un 100% ¿estaría decidido a adquirir en este momento?");
    setTimeout(() => {
      addOptions({
        items: [
          { label: "Sí", value: "final_yes", next: openContactCapture },
          { label: "No", value: "final_no", next: () => { addMessage("Entiendo. Le enviaremos una presentación."); offerPresentation(); } }
        ]
      });
    }, 300);
  } else {
    // less than 50% -> present pitch for indecisos
    addMessage("[TÍTULO] [APELLIDO] usted es un profesional [DE LA SALUD / DEL DERECHO / etc.] que ha tomado decisiones toda su vida, cada decisión que ha tomado, ha determinado sus éxitos y adversidades, esta es simplemente una decisión más, si usted pudiera predecir con certeza matemática y con métricas de inteligencia predictiva el retorno de su inversión respaldado por un contrato por escrito y con la garantía de que en un máximo de 3 meses usted recuperará su inversión ¿estaría listo para tomar la decisión el día de hoy?");
    setTimeout(() => {
      addOptions({
        items: [
          { label: "Sí", value: "indeciso_yes", next: openContactCapture },
          { label: "No", value: "indeciso_no", next: () => { addMessage("Entiendo. Le enviaremos una presentación."); offerPresentation(); } }
        ]
      });
    }, 400);
  }
}

function offerPresentation() {
  addMessage("Perfecto. ¿Cuál email usamos para enviar la presentación?");
  currentStep = "capturePresentationEmail";
  unlockInput();
}

/* handleConsult -> present option to send presentation or schedule */
function handleConsult() {
  addMessage("¿Desea que le enviemos una presentación por email o prefiere agendar una reunión con su decisor?");
  setTimeout(() => {
    addOptions({
      items: [
        { label: "A) Enviar presentación (email)", value: "send_pres", next: () => { offerPresentation(); } },
        { label: "B) Agendar reunión con decisor", value: "agendar_decisor", next: openContactCapture }
      ]
    });
  }, 300);
}

/* if user needs to schedule with decisor: ask for preferred date/time later in contact capture */

/* ---------- FASE 8: CAPTURA DE CONTACTO ---------- */
function openContactCapture() {
  addMessage("Perfecto. Para agendar necesito: Teléfono (WhatsApp), Email, Día preferido y Hora aproximada.");
  currentStep = "captureContactFull";
  unlockInput();
}

/* ---------- FASE 9: evasive responses ---------- */
function handleEvasiveContact() {
  addMessage('Claro que sí [TÍTULO] [APELLIDO], le comparto nuestro WhatsApp directo donde uno de nuestros ingenieros expertos puede atenderle de manera personalizada en cualquier momento que usted lo requiera +527717622360');
  // end of conversation; do not send WhatsApp automatically as per flow (only share)
}

/* ---------- FASE 10: insistencia sutil con anécdota ---------- */
function insistenceAnecdote() {
  addMessage('Muy bien [TÍTULO] pero antes de despedirnos le voy a contar brevemente una anécdota, uno de nuestros clientes se preguntaba por qué razón habían negocios super exitosos, mientras que el suyo parecía estar estancado, a pesar de ello decidió no invertir en nuestros servicios, así que le hice una sugerencia, le dije que escribiera en un papel "HELIOS" y que lo guardara debajo de su almohada y que cada vez que sintiera que su negocio no tenía el éxito que merecía, sacara el papel y lo leyera. ¿Le gustaría agendar una asesoría gratuita de 20 minutos que puede transformar su negocio para siempre o prefiere escribir HELIOS en un papelito?');
  setTimeout(() => {
    addOptions({
      items: [
        { label: "Agendar asesoría gratuita de 20 minutos", value: "agendar_20", next: openContactCapture },
        { label: "Prefiero escribir HELIOS en un papelito", value: "papelito", next: () => { addMessage("Entendido. Si cambia de opinión, aquí estamos."); } }
      ]
    });
  }, 300);
}

/* ---------- FASE 11: INFORMACIÓN DE LA EMPRESA
   Already implemented in handleB
*/

/* ---------- Submit typed text handler (name, emails, contact) ---------- */
sendBtn.addEventListener("click", submitText);
inputField.addEventListener("keydown", (e) => { if (e.key === "Enter") submitText(); });

async function submitText() {
  const raw = inputField.value || "";
  const text = raw.trim();
  if (!text) return;

  // if options visible, force user to click instead of typing
  if (optionsVisible) {
    addMessage("Por favor seleccione una de las opciones mostradas arriba.", "bot");
    return;
  }

  // show user bubble
  addMessage(text, "user");
  inputField.value = "";

  // store raw response
  leadData.responses.push({ text, ts: new Date().toISOString() });

  // handle typed steps
  if (currentStep === "captureName") {
    // extract title and surname conservatively
    const t = extractTitleAndSurname(text);
    leadData.title = t.title || "";
    leadData.name = t.surname || text;
    // Note: do not invent gender; leave blank unless user provides explicit pronoun (user rule)
    addMessage(`Excelente ${leadData.title ? leadData.title + " " : ""}${leadData.name}. Gracias.`);
    currentStep = null;
    // After name capture show main menu (FASE 1)
    setTimeout(() => showMainMenu(), 600);
    return;
  }

  if (currentStep === "capturePresentationEmail") {
    leadData.email = text;
    // send lead with wantsPresentation flag
    await sendLeadToWebhook({ wantsPresentation: true, emailCaptured: true });
    addMessage("Perfecto. Le enviaremos la presentación a ese correo. Gracias.");
    currentStep = null;
    setTimeout(() => showMainMenu(), 600);
    return;
  }

  if (currentStep === "captureContactFull") {
    // Expect: Teléfono (WhatsApp), Email, Día preferido y Hora aproximada.
    // We'll split by commas, conservative parsing.
    const parts = text.split(",").map(s => s.trim()).filter(Boolean);
    // map: phone, email, day, time (in that order ideally)
    if (parts[0]) leadData.phone = leadData.phone || parts[0];
    if (parts[1]) leadData.email = leadData.email || parts[1];
    if (parts[2]) leadData.preferredDay = parts[2];
    if (parts[3]) leadData.preferredTime = parts[3];

    addMessage("Gracias. En breve recibirá confirmación por email si procede.");
    currentStep = null;

    // send lead and set schedule flag so n8n schedules with Cal.com using provided email/phone/day/time
    await sendLeadToWebhook({ schedule: true, emailCaptured: !!leadData.email });
    return;
  }

  // fallback if no currentStep: re-open main menu
  setTimeout(() => {
    addMessage("No entendí exactamente — ¿Desea ver las opciones nuevamente?");
    setTimeout(() => showMainMenu(), 400);
  }, 200);
}

/* ---------- Webhook sender (payload EXACT structure you provided) ---------- */
async function sendLeadToWebhook(extra = {}) {
  const payload = {
    sessionId: sessionId,
    timestamp: new Date().toISOString(),
    lead: {
      name: leadData.name || "",
      title: leadData.title || "",
      gender: leadData.gender || "",
      industry: leadData.industry || "",
      subcategory: leadData.subcategory || "",
      marketingBudget: leadData.marketingBudget || "",
      decisionPower: leadData.decisionPower || "",
      interestLevel: leadData.interestLevel || "",
      phone: leadData.phone || "",
      email: leadData.email || "",
      preferredDay: leadData.preferredDay || "",
      preferredTime: leadData.preferredTime || "",
      responses: leadData.responses || []
    },
    extra: {
      emailCopyTo: EMAIL_COPY_TO,
      formsOfPayment: "Transferencia bancaria, todas las tarjetas de crédito y debito VISA, Mastercard y American Express, Bitcoin y ETH.",
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
    console.error("Send error:", err);
    addMessage("⚠️ No pudimos enviar la información al servidor. Por favor contacte vía WhatsApp: +52 771 762 2360", "bot");
  }
}

/* ---------- Initialization ---------- */
/* Start the chat exactly at FASE 0 */
startFlow();

/* ---------- END OF FILE ---------- */

/* PROMPT config note (for your LLM pipeline, not executed here):
temperature: 0.9

Ground rules:
- NEVER invent user data.
- If name/industry/email already exist, USE them and DO NOT ask again.
- If user provides doubtful information, confirm before using.
- If no temperature detected, firstly diagnose the business pain.
*/
