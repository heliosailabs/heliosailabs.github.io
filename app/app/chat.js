/* Helios AI Labs - Chatbot vFix (titulo auto-detect + opciones múltiples) */
/* Pega todo esto en /app/chat.js */

const messagesContainer = document.getElementById("messages");
const inputField = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");

let lead = {
  name: "",
  title: "",
  industry: "",
  email: "",
  phone: "",
  responses: []
};

let state = {
  step: "start",         // 'start', 'awaitName', 'awaitTitleChoice', 'mainMenu', 'awaitEmail', 'awaitPhone', 'done'
  optionsVisible: false,
  lastOptionsWrapper: null
};

/* ---------- utility: add message & options ---------- */
function addMessage(text, sender = "bot") {
  const msg = document.createElement("div");
  msg.classList.add("message", sender);
  msg.innerHTML = text.replace(/\n/g, "<br>");
  messagesContainer.appendChild(msg);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  return msg;
}

function clearLastOptions() {
  if (state.lastOptionsWrapper) {
    state.lastOptionsWrapper.remove();
    state.lastOptionsWrapper = null;
  }
  state.optionsVisible = false;
  inputField.disabled = false;
  sendBtn.disabled = false;
}

function addOptions(items) {
  // items: [{ label, value, onSelect:function }]
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
    btn.onclick = () => {
      // render user's choice as a user bubble with exact label
      addMessage(it.label, "user");
      // store response
      lead.responses.push({ label: it.label, value: it.value || it.label, ts: new Date().toISOString() });
      // disable buttons visually
      Array.from(row.querySelectorAll("button")).forEach(b => b.disabled = true);
      // small delay for UX then call handler
      setTimeout(() => {
        clearLastOptions();
        if (it.onSelect) it.onSelect(it.value);
      }, 180);
    };
    row.appendChild(btn);
  });
  wrapper.appendChild(row);
  messagesContainer.appendChild(wrapper);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  state.lastOptionsWrapper = wrapper;
  state.optionsVisible = true;
  inputField.disabled = true;
  sendBtn.disabled = true;
}

/* ---------- title detection ---------- */
const TITLE_REGEX = /\b(Sr\.|Sra\.|Don|Doña|Dr\.|Dra\.|Lic\.|Ing\.|Arq\.|C\.P\.|C\.P|CP|Mtro\.|Mtra\.|Prof\.|Profa\.|Chef|Coach)\b/i;

function extractTitleFromText(text) {
  const m = text.match(TITLE_REGEX);
  if (!m) return null;
  // normalize (keep formatting like "Dra." or "Dr.")
  return m[0].replace(/\s+/g, "").trim();
}

function extractNameAfterTitle(text, title) {
  // remove greeting words
  let s = text.replace(/^(hola|buenos días|buenas tardes|buenas noches)[,!\.\s]*/i, "");
  // remove "soy" or "me llamo"
  s = s.replace(/\b(soy|me llamo|mi nombre es)\b/i, "").trim();
  // remove title token if present
  if (title) s = s.replace(new RegExp(title, "i"), "").trim();
  // return first two words as name fallback
  const parts = s.split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).join(" ") || s || "";
}

/* ---------- start flow ---------- */
function startChat() {
  addMessage("Gracias por contactarnos, somos Helios AI Labs. Para proporcionarle la mejor atención, personalizada y diseñar para usted un traje a la medida ¿Cuál de las siguientes preguntas desea que respondamos para usted?");
  // show menu choices after small pause
  setTimeout(() => {
    addOptions([
      { label: "A) ¿Cómo funciona la automatización de procesos con IA y qué beneficios medibles puede aportar a mi negocio?", value: "A", onSelect: () => openIndustryFlow("A") },
      { label: "B) Quiero información sobre su empresa, ubicación, experiencia, credenciales, referencias, información fiscal, contrato, garantía por escrito, etc.", value: "B", onSelect: () => openCompanyInfo() },
      { label: "C) ¿Por qué adoptar Inteligencia Artificial hoy es tan importante y cuáles son los escenarios para mi negocio si decido esperar más tiempo?", value: "C", onSelect: () => openWhyNow() },
      { label: "D) ¿Cuánto cuesta implementar IA en mi negocio y en cuánto tiempo recuperaré mi inversión? ¿Tienen promociones?", value: "D", onSelect: () => openROI() },
      { label: "E) Todas las anteriores", value: "E", onSelect: () => openIndustryFlow("E") }
    ]);
    // after showing options, ask for name capture so both can be done in parallel
    setTimeout(() => {
      addMessage("Para atenderle mejor, ¿podría indicarme su nombre (por ejemplo: 'Soy la Dra. Pérez' o 'Juan Pérez')?");
      state.step = "awaitName";
      inputField.disabled = false;
      sendBtn.disabled = false;
      inputField.focus();
    }, 220);
  }, 100);
}

/* ---------- handlers for main menu choices ---------- */
function openCompanyInfo() {
  // Show company details (keeps exact text from your document)
  addMessage(
    "Nombre comercial: Helios AI Labs<br><br>" +
    "Corporativo Matriz: Río Lerma 232, Piso 23, Col. Cuauhtémoc, Alcaldía Cuauhtémoc, CP 06500, CDMX.<br>" +
    "Sucursal Pachuca: Av. Revolución 300, Col. Periodista, CP 42060, Pachuca de Soto, Hidalgo.<br><br>" +
    "22 años de experiencia. Garantía por escrito avalada por PROFECO. Incluye Non-disclosure Agreement (Acuerdo de Confidencialidad).<br><br>" +
    "Formas de pago: Transferencia bancaria, Aceptamos todas las tarjetas de crédito bancarias, Crypto."
  );
  // after company info, show main menu again
  setTimeout(() => {
    startChat(); // reuse main menu prompt sequence
  }, 800);
}

function openWhyNow() {
  addMessage("La adopción de IA ya está redefiniendo los negocios en México y el mundo. Según la Curva de Adopción de Innovación de Rogers, estamos en el momento exacto donde los Early Adopters obtienen ventaja competitiva masiva. " +
    "Si espera, su competencia captura clientes y datos. ¿Le interesa que le muestre cómo aplicarlo a su negocio?");
  setTimeout(() => {
    startChat();
  }, 900);
}

function openROI() {
  addMessage("La inversión se divide en SET UP inicial y cuota mensual. Usted NO paga cuota mensual hasta recuperar set up (garantía por escrito). Recuperación típica: 60 a 90 días. ¿Desea una estimación personalizada?");
  setTimeout(() => startChat(), 900);
}

/* ---------- industry flow (user selected A/E or later) ---------- */
function openIndustryFlow(cameFrom) {
  // show industry selector
  addMessage("Excelente. Para responder a su pregunta, con la atención que usted se merece, por favor dígame: ¿En cuál de los siguientes giros se encuentra su negocio?");
  addOptions([
    { label: "A) Salud", value: "salud", onSelect: () => showGiroSub("salud") },
    { label: "B) Despacho Jurídico", value: "juridico", onSelect: () => showGiroSub("juridico") },
    { label: "C) Restaurante o Cafetería", value: "food", onSelect: () => showGiroSub("food") },
    { label: "D) Sector Inmobiliario", value: "realestate", onSelect: () => showGiroSub("realestate") },
    { label: "E) Educación", value: "edu", onSelect: () => showGiroSub("edu") },
    { label: "F) Creación de contenido", value: "content", onSelect: () => showGiroSub("content") },
    { label: "G) Comercio (minorista / mayorista)", value: "retail", onSelect: () => showGiroSub("retail") },
    { label: "H) Profesional independiente", value: "freelance", onSelect: () => showGiroSub("freelance") },
    { label: "I) Belleza", value: "beauty", onSelect: () => showGiroSub("beauty") },
    { label: "J) Otro", value: "other", onSelect: () => showGiroSub("other") }
  ]);
}

/* ---------- subcategory prompts and pitch mapping ---------- */
function showGiroSub(g) {
  lead.industry = g;
  // show subcategory options for some industries (salud, juridico, etc.)
  if (g === "salud") {
    addMessage("¿Cuál de las siguientes describe mejor su negocio en Salud?");
    addOptions([
      { label: "Consultorio propio", value: "consultorio", onSelect: () => renderPitchFor("salud", "consultorio") },
      { label: "Clínica", value: "clinica", onSelect: () => renderPitchFor("salud", "clinica") },
      { label: "Veterinaria", value: "veterinaria", onSelect: () => renderPitchFor("salud", "veterinaria") },
      { label: "Hospital", value: "hospital", onSelect: () => renderPitchFor("salud", "hospital") },
      { label: "Otro", value: "otro_salud", onSelect: () => renderPitchFor("salud", "otro") }
    ]);
    return;
  }
  if (g === "juridico") {
    addMessage("¿Cuál de las siguientes describe mejor su despacho jurídico?");
    addOptions([
      { label: "Penal", value: "penal", onSelect: () => renderPitchFor("juridico", "penal") },
      { label: "Familiar", value: "familiar", onSelect: () => renderPitchFor("juridico", "familiar") },
      { label: "Civil / Mercantil", value: "civil", onSelect: () => renderPitchFor("juridico", "civil") },
      { label: "Fiscal", value: "fiscal", onSelect: () => renderPitchFor("juridico", "fiscal") },
      { label: "Otro", value: "otro_juridico", onSelect: () => renderPitchFor("juridico", "otro") }
    ]);
    return;
  }
  // generic path for others: immediate pitch
  renderPitchFor(g, "general");
}

const PITCH_FULL = {
  salud: `En consultorios y clínicas la automatización con IA puede contestar llamadas por voz o mensajes de texto, agendar citas y confirmar consultas por usted 24/7, enviar recordatorios a los pacientes (disminuyendo dramáticamente las consultas canceladas o los retrasos).

Puede notificarle a Ud. directamente en caso de emergencia, llevar un control de todos sus expedientes, cobrar consultas por adelantado con medios digitales, darle seguimiento a sus pacientes y enviar felicitaciones en días festivos.

Puede aumentar el número de pacientes exponencialmente, de acuerdo a sus instrucciones.

Además, la automatización con IA atrae pacientes con mayor poder adquisitivo y eleva sustancialmente el ticket promedio.

Si la implementación fuera 100% accesible a su economía y garantizara recuperar su inversión en un máximo de 3 meses, ¿estaría listo(a) para decidir hoy?`,

  juridico: `Licenciado/a, en su profesión la confianza, velocidad y resultados lo son todo.

Con IA puede lograr:
✅ Más casos sin invertir más tiempo
✅ Filtro automático de prospectos con capacidad económica real
✅ Respuestas legales 24/7 con seguimiento de clientes
✅ Control total de expedientes y fechas críticas
✅ Ventas consultivas con storytelling legal
✅ Casos mejor pagados — honorarios más altos

Además, la automatización atrae clientes con mayor poder adquisitivo y eleva sustancialmente el ticket promedio.

Si la implementación fuera 100% accesible a su economía y garantizara recuperar su inversión en un máximo de 3 meses, ¿estaría listo(a) para decidir hoy?`,

  realestate: `Agente Inmobiliario, hoy la competencia es feroz y la información es oro.

Con IA usted obtiene:
✅ Prospectos calificados con capital para comprar
✅ Captación de propiedades premium
✅ Exclusividades que sí están listas para vender (documentos en regla)
✅ WhatsApp automatizado hasta el cierre
✅ Citas siempre en su calendario sin perseguir clientes
✅ Mayor ticket por operaciones de alto valor

Además, la automatización atrae compradores con mayor poder adquisitivo y eleva sustancialmente las comisiones promedio.

La IA también filtra las mejores propiedades para obtener exclusividad. Solamente aquellas propiedades que tengan todos los documentos en regla y estén listas para ser vendidas llegarán al agente/broker, ahorrándole mucho tiempo dado que no perderá tiempo en propiedades irregulares o con status legal incierto.

Si la implementación fuera 100% accesible a su economía y garantizara recuperar su inversión en un máximo de 3 meses, ¿estaría listo(a) para decidir hoy?`,

  food: `En su negocio, cada mensaje que llega por WhatsApp o redes es un cliente listo para comprar ahora.

Nuestra IA trabaja como anfitriona 24/7:
✅ Responde al instante
✅ Gestiona pedidos
✅ Agenda reservaciones
✅ Recomienda platillos populares
✅ Confirma asistencia con anticipación

Además, la automatización atrae comensales con mayor poder adquisitivo y eleva sustancialmente el ticket promedio.

Resultado real en negocios como el suyo:
→ 2X a 4X más ventas en menos de 90 días
→ Menos mesas vacías, más ingresos diarios

Si la implementación fuera 100% accesible a su economía y garantizara recuperar su inversión en un máximo de 3 meses, ¿estaría listo(a) para decidir hoy?`,

  edu: `Director/a, profesor/a o dueño de academia

Hoy los padres y alumnos toman decisiones en cuestión de minutos.

Nuestra IA es su coordinadora de admisiones 24/7:
✅ Responde al instante dudas sobre costos, horarios, requisitos (sin errores)
✅ Agenda visitas y entrevistas sola
✅ Da seguimiento hasta la inscripción
✅ Recordatorios automáticos de pagos
✅ Retiene alumnos para evitar deserción

Además, la automatización atrae familias con mayor poder adquisitivo y eleva sustancialmente las colegiaturas promedio.

Resultado en instituciones como la suya:
→ +30% a +200% más inscripciones
→ Menos abandono
→ Más ingresos recurrentes

Si la implementación fuera 100% accesible a su economía y garantizara recuperar su inversión en un máximo de 3 meses, ¿estaría listo(a) para decidir hoy?`,

  retail: `En comercio, la venta ocurre en el mismo momento en que el cliente pregunta.

Nuestra IA se convierte en su mejor vendedor 24/7:
✅ Responde WhatsApp e Instagram al instante
✅ Muestra catálogo y precios
✅ Recomienda productos con mayor margen
✅ Agrega al carrito y cobra sola
✅ Verifica existencias en inventario
✅ Envío o pickup automatizado

Además, la automatización atrae compradores con mayor poder adquisitivo y eleva sustancialmente el ticket promedio.

Resultado real:
→ 2X a 5X ventas en menos de 90 días
→ Ingresos mientras usted duerme

Si la implementación fuera 100% accesible a su economía y garantizara recuperar su inversión en un máximo de 3 meses, ¿estaría listo(a) para decidir hoy?`,

  content: `La IA convierte audiencia en clientes, automatiza ventas, genera contenido optimizado y permite monetizar sin aumentar la carga de trabajo.

Además, la automatización atrae clientes con mayor poder adquisitivo y eleva sus ingresos por cliente.

Si la implementación fuera 100% accesible a su economía y garantizara recuperar su inversión en un máximo de 3 meses, ¿estaría listo(a) para decidir hoy?`,

  freelance: `La IA consigue clientes, organiza agenda, envía cotizaciones, cobra anticipos y gestiona proyectos. Su tiempo se convierte en ingresos.

Además, la automatización atrae clientes con mayor poder adquisitivo y eleva sus honorarios promedio.

Si la implementación fuera 100% accesible a su economía y garantizara recuperar su inversión en un máximo de 3 meses, ¿estaría listo(a) para decidir hoy?`,

  beauty: `Cuando alguien quiere un servicio de belleza la decisión la toma en ese mismo momento.

Nuestra IA trabaja como su recepcionista perfecta 24/7:
✅ Responde al instante
✅ Agenda citas sola
✅ Envía recordatorios
✅ Reduce cancelaciones +80%
✅ Da seguimiento hasta que el cliente confirma

Además, la automatización atrae clientes con mayor poder adquisitivo y eleva sustancialmente el ticket promedio.

Si la implementación fuera 100% accesible a su economía y garantizara recuperar su inversión en un máximo de 3 meses, ¿estaría listo(a) para decidir hoy?`
};

function renderPitchFor(giro, subcat) {
  // render exact pitch from PITCH_FULL
  const text = PITCH_FULL[giro] || PITCH_FULL["other"] || "Pronto le mostraré un plan específico.";
  addMessage(text);
  // present choices
  addOptions([
    { label: "A) Sí — Listo para contratar hoy", value: "yes_now", onSelect: askForContact },
    { label: "B) Lo tengo que pensar", value: "think", onSelect: askAuthority },
    { label: "C) Lo tengo que consultar (socio/jefe/esposa)", value: "consult", onSelect: handleConsult }
  ]);
}

/* ---------- authority / consult flows ---------- */
function askAuthority() {
  addMessage("¿Qué porcentaje de la decisión depende de usted?");
  addOptions([
    { label: "Menos del 50%", value: "auth_lt50", onSelect: () => scheduleWithDecisor() },
    { label: "50% o más", value: "auth_gte50", onSelect: () => presentIndecisoPitch() }
  ]);
}

function handleConsult() {
  addMessage("¿Desea que le enviemos una presentación por email o prefiere agendar una reunión con su decisor?");
  addOptions([
    { label: "Enviar presentación (email)", value: "send_pres", onSelect: askEmailForPresentation },
    { label: "Agendar reunión con decisor", value: "agendar_decisor", onSelect: askForContact }
  ]);
}

function presentIndecisoPitch() {
  addMessage(`${lead.title} ${lead.name.split(" ")[0] || ""}, usted es un profesional que ha tomado decisiones toda su vida. Esta es simplemente una decisión más. Si usted pudiera predecir con certeza matemática y con métricas de inteligencia predictiva el retorno de su inversión, respaldado por un contrato por escrito y con la garantía de que en un máximo de 3 meses usted recuperará su inversión, ¿estaría listo para tomar la decisión el día de hoy?`);
  addOptions([
    { label: "Sí ✅", value: "ind_yes", onSelect: askForContact },
    { label: "No ❌", value: "ind_no", onSelect: shareWhatsapp }
  ]);
}

function scheduleWithDecisor() {
  addMessage("¿Qué día le gustaría que me pusiera en contacto con usted para coordinar una reunión virtual con los decisores finales?");
  currentAsk = "askDateForDecisor";
  state.step = "awaitFreeText"; // use normal input capture
  inputField.disabled = false;
  sendBtn.disabled = false;
}

function askEmailForPresentation() {
  addMessage("Ingrese por favor su email en el campo inferior y presione Enviar.");
  state.step = "awaitEmailForPresentation";
  inputField.disabled = false;
  sendBtn.disabled = false;
}

/* ---------- contact capture ---------- */
function askForContact() {
  addMessage("¡Excelente! 🚀 Para agendar su asesoría gratuita de 20 minutos necesito:\n📧 Email\n📱 Teléfono (WhatsApp)\n📅 Día preferido\n🕐 Hora aproximada\n\nEj.: correo@ejemplo.com, +52 771 123 4567, viernes, 3pm");
  state.step = "awaitContactLine";
  inputField.disabled = false;
  sendBtn.disabled = false;
}

function captureContactLine(text) {
  // parse simple "email, phone, day, time"
  const parts = text.split(",").map(s => s.trim()).filter(Boolean);
  if (parts.length >= 2) {
    // minimal validation
    if (!lead.email && parts[0].includes("@")) lead.email = parts[0];
    if (!lead.phone && parts[1]) lead.phone = parts[1];
    // optional day/time
    const extra = parts.slice(2).join(", ");
    lead.responses.push({ contact_extra: extra, ts: new Date().toISOString() });
    addMessage("Gracias. En breve recibirá confirmación por email si procede.");
    // send lead
    sendLeadData();
    state.step = "done";
    return;
  }
  addMessage("Por favor ingrese su Email y Teléfono separados por comas, por ejemplo: correo@ejemplo.com, +52 771 123 4567");
}

/* ---------- fallback share whatsapp ---------- */
function shareWhatsapp() {
  addMessage("Claro que sí. Le comparto nuestro WhatsApp directo: 👉 +52 771 762 2360\n\nUna pregunta final: ¿En el día de la reunión prefiere que lo atienda personalmente nuestro Director Comercial o uno de nuestros expertos humanos?");
  addOptions([
    { label: "Director Comercial", value: "dir", onSelect: () => addMessage("¡Es broma! 😄 Hablamos pronto. ¡Que tenga un excelente día!") },
    { label: "Experto humano", value: "expert", onSelect: () => addMessage("¡Es broma! 😄 Hablamos pronto. ¡Que tenga un excelente día!") }
  ]);
}

/* ---------- send lead to webhook & visible confirmation ---------- */
function sendLeadData() {
  const payload = {
    timestamp: new Date().toISOString(),
    lead: lead
  };
  // Send to n8n webhook
  fetch("https://heliosailabs369.app.n8n.cloud/webhook/chatbot-groq", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })
    .then(res => {
      // visible confirmation to user
      addMessage("📨 Información enviada correctamente a Helios AI Labs. Un asesor se pondrá en contacto con usted en breve.");
      // also push a minimal local log
      console.log("Lead sent:", payload);
    })
    .catch(err => {
      console.error("Send error:", err);
      addMessage("⚠️ Hubo un error al enviar la información al servidor. Por favor contacte vía WhatsApp: +52 771 762 2360");
    });
}

/* ---------- input handling ---------- */
inputField.addEventListener("keydown", (e) => {
  if (e.key === "Enter") onSubmitInput();
});
sendBtn.addEventListener("click", onSubmitInput);

function onSubmitInput() {
  const raw = inputField.value.trim();
  if (!raw) return;
  // If options visible, ask to choose from bubbles
  if (state.optionsVisible) {
    addMessage("Por favor seleccione una de las opciones que aparece en las burbujas.", "bot");
    inputField.value = "";
    return;
  }

  // show user message bubble
  addMessage(raw, "user");
  inputField.value = "";

  // step handlers
  if (state.step === "awaitName" || state.step === "start") {
    // try to detect title in raw
    const title = extractTitleFromText(raw);
    const nameCandidate = extractNameAfterTitle(raw, title);
    if (title) {
      lead.title = title;
      lead.name = nameCandidate || raw;
      // proceed to main menu options
      state.step = "mainMenu";
      setTimeout(() => askMainMenuAfterName(), 180);
      return;
    } else {
      // no title found -> assume user typed name or free text
      // if looks like a name (short), use as name and ask for title selection
      if (nameCandidate.split(/\s+/).length <= 4) {
        lead.name = nameCandidate || raw;
        // show title options
        addMessage(`Gracias ${lead.name}. ¿Cómo prefiere que me dirija a usted? Elija una opción:`);
        addOptions([
          { label: "Sr.", value: "Sr.", onSelect: (v) => { lead.title = v; askMainMenuAfterName(); } },
          { label: "Sra.", value: "Sra.", onSelect: (v) => { lead.title = v; askMainMenuAfterName(); } },
          { label: "Dr./Dra.", value: "Dr.", onSelect: (v) => { lead.title = v; askMainMenuAfterName(); } },
          { label: "Lic.", value: "Lic.", onSelect: (v) => { lead.title = v; askMainMenuAfterName(); } },
          { label: "Ing.", value: "Ing.", onSelect: (v) => { lead.title = v; askMainMenuAfterName(); } },
          { label: "Otro", value: "Otro", onSelect: (v) => { lead.title = v; askMainMenuAfterName(); } }
        ]);
        state.step = "awaitTitleChoice";
        return;
      } else {
        // long text, treat as question - go to main menu anyway
        lead.name = nameCandidate || raw;
        state.step = "mainMenu";
        setTimeout(() => askMainMenuAfterName(), 180);
        return;
      }
    }
  }

  // awaiting contact line parsing
  if (state.step === "awaitContactLine") {
    captureContactLine(raw);
    return;
  }

  // awaiting email for presentation
  if (state.step === "awaitEmailForPresentation") {
    // basic email check
    if (raw.includes("@")) {
      lead.email = raw;
      addMessage("Perfecto — le enviaremos la presentación a ese correo. Gracias.");
      sendLeadData();
      state.step = "done";
    } else {
      addMessage("Por favor ingrese un email válido.");
    }
    return;
  }

  // other fallback: ask main menu again
  addMessage("No entendí exactamente — ¿Desea ver las opciones nuevamente?");
  setTimeout(() => {
    startChat();
  }, 600);
}

/* ---------- helper to show main menu after we have name/title ---------- */
function askMainMenuAfterName() {
  // ensure title formatting (if Dr then show Dra if name includes female? we keep title literal)
  const titleStr = lead.title ? lead.title + " " : "";
  addMessage(`Excelente ${titleStr}${lead.name.split(" ")[0] || ""}. Para responder a su pregunta, con la atención que usted se merece, por favor dígame: ¿En cuál de los siguientes giros se encuentra su negocio?`);
  state.step = "mainMenu";
  // show industry options
  addOptions([
    { label: "A) Salud", value: "salud", onSelect: () => showGiroSub("salud") },
    { label: "B) Despacho Jurídico", value: "juridico", onSelect: () => showGiroSub("juridico") },
    { label: "C) Restaurante o Cafetería", value: "food", onSelect: () => showGiroSub("food") },
    { label: "D) Sector Inmobiliario", value: "realestate", onSelect: () => showGiroSub("realestate") },
    { label: "E) Educación", value: "edu", onSelect: () => showGiroSub("edu") },
    { label: "F) Creación de contenido", value: "content", onSelect: () => showGiroSub("content") },
    { label: "G) Comercio (minorista / mayorista)", value: "retail", onSelect: () => showGiroSub("retail") },
    { label: "H) Profesional independiente", value: "freelance", onSelect: () => showGiroSub("freelance") },
    { label: "I) Belleza / Spa", value: "beauty", onSelect: () => showGiroSub("beauty") },
    { label: "J) Otro", value: "other", onSelect: () => showGiroSub("other") }
  ]);
}

/* ---------- init ---------- */
window.addEventListener("load", () => {
  // lock input until prompt shows
  inputField.disabled = true;
  sendBtn.disabled = true;
  setTimeout(() => {
    startChat();
  }, 250);
});
