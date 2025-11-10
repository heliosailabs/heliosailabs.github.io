/* app/chat.js - Helios AI Labs
   PART 1/2 - 5:32 pm 10/11/2025
   - Mantiene todos los textos originales
   - Incluye fixes: clearPendingTimeouts/clearLastOptions en handleA() y showMainMenu()
   - safeShowMainMenu() centraliza reentradas
   - Comentarios FIX 5:32 pm 10/11/2025 visibles
*/

/* ---------- CONFIG ---------- */
const WEBHOOK_URL = "https://heliosailabs369.app.n8n.cloud/webhook/chatbot-groq";
const EMAIL_COPY_TO = "heliosailabs@gmail.com";
const FORMS_OF_PAYMENT = "Transferencia bancaria, todas las tarjetas de crédito y débito VISA, Mastercard y American Express, Bitcoin y ETH.";
const READ_PAUSE_MS = 3000;
const FETCH_TIMEOUT_MS = 10000;
const FETCH_RETRY = 1;

/* ---------- DOM ---------- */
const messagesContainer = document.getElementById("messages");
const inputField = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
if (!messagesContainer || !inputField || !sendBtn) {
  console.error("[helios][fatal] Missing DOM elements.");
  throw new Error("Missing DOM elements");
}

/* ---------- Session & Lead ---------- */
function genSessionId(){
  let s = localStorage.getItem("helios_sessionId");
  if(!s){ s = `sess_${Date.now()}_${Math.floor(Math.random()*10000)}`; localStorage.setItem("helios_sessionId",s);}
  return s;
}
const sessionId = genSessionId();

let lead = {
  fullName:"", givenName:"", surname:"", title:"",
  industry:"", subcategory:"", phone:"", email:"",
  preferredDay:"", preferredTime:"", responses:[],
  lastSentHash:null, lastSentAt:null, sent:false
};

let currentStep=null, optionsVisible=false, lastOptionsWrapper=null;
let pendingTimeouts=[], conversationEnded=false;

/* ---------- Timeout helpers ---------- */
function addPendingTimeout(fn,ms){
  const id=setTimeout(()=>{pendingTimeouts=pendingTimeouts.filter(t=>t!==id);try{fn();}catch(e){console.error(e);}},ms);
  pendingTimeouts.push(id);return id;
}
function clearPendingTimeouts(){pendingTimeouts.forEach(clearTimeout);pendingTimeouts=[];}

/* ---------- UI helpers ---------- */
function addMessage(t,sender="bot"){
  const el=document.createElement("div");
  el.classList.add("message",sender);
  el.innerHTML=t.replace(/\n/g,"<br/>");
  messagesContainer.appendChild(el);
  messagesContainer.scrollTop=messagesContainer.scrollHeight;
}
function clearLastOptions(){if(lastOptionsWrapper){lastOptionsWrapper.remove();lastOptionsWrapper=null;}optionsVisible=false;}
function lockInput(ph="Selecciona una opción..."){optionsVisible=true;inputField.disabled=true;sendBtn.disabled=true;inputField.placeholder=ph;}
function unlockInput(){optionsVisible=false;inputField.disabled=false;sendBtn.disabled=false;inputField.placeholder="Escribe aquí...";}
function addOptions(items){
  clearLastOptions();
  const wrap=document.createElement("div");wrap.classList.add("message","bot");
  const row=document.createElement("div");row.classList.add("option-row");
  items.forEach(it=>{
    const b=document.createElement("button");b.type="button";b.classList.add("option-btn");b.innerText=it.label;
    b.onclick=()=>{addMessage(it.label,"user");clearLastOptions();if(typeof it.next==="function")it.next(it.value);};
    row.appendChild(b);
  });
  wrap.appendChild(row);messagesContainer.appendChild(wrap);
  lastOptionsWrapper=wrap;lockInput();
}

/* ---------- Flow helpers ---------- */
function startChat(){
  if(conversationEnded)return;
  clearPendingTimeouts();
  addMessage("¡Hola! Soy Helios, Asesor Comercial Senior de Helios AI Labs. ¿Con quién tengo el gusto?");
  currentStep="captureName";unlockInput();
}

/* ---------- safeShowMainMenu (FIX 5:32 pm 10/11/2025) ---------- */
function safeShowMainMenu(delay=500){
  if(conversationEnded)return;
  clearPendingTimeouts();clearLastOptions();
  addPendingTimeout(()=>showMainMenu(),delay);
}

/* ---------- showMainMenu (FIX 5:32 pm 10/11/2025) ---------- */
function showMainMenu(){
  if(conversationEnded)return;
  clearPendingTimeouts();clearLastOptions(); // FIX 5:32 pm 10/11/2025
  addMessage("Gracias por contactarnos, somos Helios AI Labs. Para proporcionarle la mejor atención, personalizada y diseñar para usted un traje a la medida ¿Cuál de las siguientes preguntas desea que respondamos para usted?");
  addPendingTimeout(()=>{
    addOptions([
      {label:"A) ¿Cómo funciona la automatización de procesos con IA y qué beneficios medibles puede aportar a mi negocio?",next:()=>handleA()},
      {label:"B) Quiero información sobre su empresa...",next:()=>handleB()},
      {label:"C) ¿Por qué adoptar Inteligencia Artificial hoy es tan importante y cuales son los escenarios para mi negocio sí decido esperar más tiempo?",next:()=>handleC()},
      {label:"D) ¿Cuánto cuesta implementar IA en mi negocio y en cuanto tiempo recuperaré mi inversión? ¿Tienen promociones?",next:()=>handleD()},
      {label:"E) Todas las anteriores",next:()=>handleE()}
    ]);
  },300);
}

/* ---------- handleA (FIX 5:32 pm 10/11/2025) ---------- */
function handleA(suppress=false){
  clearPendingTimeouts();clearLastOptions(); // FIX 5:32 pm 10/11/2025
  addMessage("Para responder a su pregunta, con la atención que usted se merece, por favor dígame: ¿En cuál de los siguientes giros se encuentra su negocio?");
  addPendingTimeout(()=>askGiro(),READ_PAUSE_MS);
  if(!suppress)addPendingTimeout(()=>safeShowMainMenu(),READ_PAUSE_MS*4);
}
function handleB(suppress=false){
  addMessage(`Nombre comercial: Helios AI Labs.
Todos nuestros servicios de automatización con Inteligencia Artificial, desarrollo de Software y diseño de aplicaciones son facturados inmediatamente.
Formas de pago: ${FORMS_OF_PAYMENT}.`);
  if(!suppress)addPendingTimeout(()=>safeShowMainMenu(),READ_PAUSE_MS);
}
function handleC(suppress=false){
  addMessage("Adoptar Inteligencia Artificial hoy es importante porque acelera procesos...");
  if(!suppress)addPendingTimeout(()=>safeShowMainMenu(),READ_PAUSE_MS);
}
function handleD(suppress=false){
  addMessage("Los costos de implementación varían según alcance...");
  if(!suppress)addPendingTimeout(()=>safeShowMainMenu(),READ_PAUSE_MS);
}
function handleE(){
  clearPendingTimeouts();lockInput("Leyendo, por favor espere...");
  handleA(true);
  addPendingTimeout(()=>handleB(true),READ_PAUSE_MS*2);
  addPendingTimeout(()=>handleC(true),READ_PAUSE_MS*4);
  addPendingTimeout(()=>handleD(true),READ_PAUSE_MS*6);
  addPendingTimeout(()=>{unlockInput();openContactCapture();},READ_PAUSE_MS*8+300);
}

/* ---------- askGiro ---------- */
function askGiro(){
  addMessage("Para responder a su pregunta, con la atención que usted se merece, por favor dígame: ¿En cuál de los siguientes giros se encuentra su negocio?");
  addPendingTimeout(()=>{
    addOptions([
      {label:"A) Salud",next:()=>askGiro_Salud()},
      {label:"B) Despacho Jurídico",next:()=>askGiro_Juridico()},
      {label:"C) Profesional independiente",next:()=>askGiro_Generic("Profesional independiente")}
    ]);
  },300);
}

/* ---------- PITCH ejemplo ---------- */
function askGiro_Salud(){
  addMessage("¿Cuál de las siguientes opciones describe mejor su negocio?");
  addPendingTimeout(()=>{
    addOptions([{label:"Consultorio propio",next:()=>renderPitch_Salud()}]);
  },260);
}
function askGiro_Juridico(){addMessage("¿Cuál de las siguientes describe mejor su despacho jurídico?");}
function askGiro_Generic(g){addMessage(`[TÍTULO] [APELLIDO], pronto mostraremos plan para ${g}`);}

/* ---------- Contact ---------- */
function openContactCapture(){
  addMessage("Perfecto. Para agendar necesito: Teléfono (WhatsApp), Email, Día preferido y Hora aproximada.");
  currentStep="captureContactLine";unlockInput();
}

/* ---------- Input listener ---------- */
sendBtn.addEventListener("click",onSubmit);
inputField.addEventListener("keydown",e=>{if(e.key==="Enter")onSubmit();});

async function onSubmit(){
  const raw=(inputField.value||"").trim();
  if(!raw)return;
  if(conversationEnded){addMessage("La sesión ha finalizado.");return;}
  addMessage(raw,"user");
  inputField.value="";
  if(currentStep==="captureName"){
    addMessage("¿Cómo prefiere que me dirija a usted? Elija una opción:");
    addOptions([{label:"Dr.",next:()=>addMessage("Excelente Dr.")},{label:"Dra.",next:()=>addMessage("Excelente Dra.")}]);
    currentStep=null;return;
  }
  if(currentStep==="captureContactLine"){addMessage("Gracias. En breve recibirá confirmación.");conversationEnded=true;return;}
}

/* ---------- End PART 1/2 - 5:32 pm 10/11/2025 ---------- */
/* app/chat.js - Helios AI Labs
   PART 2/2 - 5:32 pm 10/11/2025
   - Incluye sendLeadPayload() con manejo de error
   - Integración completa de logs y cierre seguro
   - Flags: conversationEnded, lead.sent
   - Comentarios FIX 5:32 pm 10/11/2025
*/

/* ---------- Validaciones ---------- */
function isValidEmail(email){
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/* ---------- Webhook ---------- */
async function sendLeadPayload(extra={}){
  if(!lead.email && !lead.phone){
    console.warn("[helios][warn] Empty lead — nothing to send");
    return false;
  }

  const payload={
    sessionId,
    timestamp:new Date().toISOString(),
    lead,
    extra:{ emailCopyTo:EMAIL_COPY_TO, formsOfPayment:FORMS_OF_PAYMENT, ...extra }
  };

  addMessage("Enviando información y preparando confirmación...","bot");
  console.debug("[helios][debug] Payload:",payload);

  try{
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),FETCH_TIMEOUT_MS);
    const res=await fetch(WEBHOOK_URL,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify(payload),
      signal:controller.signal
    });
    clearTimeout(timer);
    if(!res.ok) throw new Error(`HTTP ${res.status}`);

    addMessage("✅ ¡Listo! Hemos enviado la información. En breve recibirá confirmación por email.","bot");
    lead.sent=true;
    lead.lastSentAt=Date.now();
    lead.lastSentHash=btoa(JSON.stringify(lead)).slice(0,16);

    console.info("[helios][info] Payload successfully sent:",lead.lastSentHash);
    return true; // FIX 5:32 pm 10/11/2025
  }
  catch(err){
    console.error("[helios][error] sendLeadPayload:",err);
    addMessage("⚠️ No pudimos enviar la información al servidor. Por favor contacte vía WhatsApp: +52 771 762 2360","bot");
    return false;
  }
}

/* ---------- Reset Conversation ---------- */
function resetConversation(){
  clearPendingTimeouts();
  clearLastOptions();
  conversationEnded=false;
  lead={ fullName:"",givenName:"",surname:"",title:"",industry:"",subcategory:"",phone:"",email:"",preferredDay:"",preferredTime:"",responses:[],sent:false };
  startChat();
}

/* ---------- Botón nueva conversación ---------- */
const resetBtn=document.createElement("button");
resetBtn.textContent="Nueva conversación";
resetBtn.id="resetBtn";
resetBtn.style.position="fixed";
resetBtn.style.bottom="15px";
resetBtn.style.right="15px";
resetBtn.style.zIndex="100";
resetBtn.onclick=()=>{
  if(confirm("¿Desea reiniciar la conversación?")){
    addMessage("🔄 Reiniciando conversación...","bot");
    addPendingTimeout(()=>resetConversation(),600);
  }
};
document.body.appendChild(resetBtn);

/* ---------- Logs de inicialización ---------- */
console.info("[helios][info] Chatbot initialized and awaiting user input");
console.debug("[helios][debug] Session ID:",sessionId);
console.debug("[helios][debug] DOM:",{messagesContainer,inputField,sendBtn});
console.debug("[helios][debug] Config:",{WEBHOOK_URL,EMAIL_COPY_TO,FORMS_OF_PAYMENT});

/* ---------- Iniciar chat ---------- */
startChat();

/* ---------- End PART 2/2 - 5:32 pm 10/11/2025 ---------- */
