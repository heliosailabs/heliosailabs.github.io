/* ============================================================
   Helios ChatBot - Versión base funcional
   Paso 1: Estructura + burbujas de opciones clicables
   ============================================================ */

console.log("Helios ChatBot cargado ✅");

const messagesContainer = document.getElementById("messages");
const inputField = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");

/* ====== Variables de control ====== */
let currentStep = null;
let optionsVisible = false;

/* ====== Mostrar mensajes ====== */
function addMessage(text, sender = "bot") {
  const el = document.createElement("div");
  el.classList.add("message", sender);
  el.innerHTML = text.replace(/\n/g, "<br>");
  messagesContainer.appendChild(el);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  return el;
}

/* ====== Bloqueo / desbloqueo de input ====== */
function lockInput(msg = "Selecciona una opción...") {
  inputField.disabled = true;
  sendBtn.disabled = true;
  inputField.placeholder = msg;
  optionsVisible = true;
}
function unlockInput() {
  inputField.disabled = false;
  sendBtn.disabled = false;
  inputField.placeholder = "Escribe aquí...";
  optionsVisible = false;
}

/* ====== Opciones clicables ====== */
function addOptions(options) {
  const wrapper = document.createElement("div");
  wrapper.classList.add("message", "bot");

  if (options.prompt) {
    const promptEl = document.createElement("div");
    promptEl.innerHTML = options.prompt;
    wrapper.appendChild(promptEl);
  }

  const row = document.createElement("div");
  row.classList.add("option-row");

  options.items.forEach(opt => {
    const btn = document.createElement("button");
    btn.classList.add("option-btn");
    btn.type = "button";
    btn.innerText = opt.label;

    btn.addEventListener("click", () => {
      addMessage(opt.label, "user");
      unlockInput();
      setTimeout(() => {
        if (typeof opt.next === "function") opt.next();
      }, 300);
    });

    row.appendChild(btn);
  });

  wrapper.appendChild(row);
  messagesContainer.appendChild(wrapper);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  lockInput();
}

/* ====== Flujo base de prueba ====== */
function startChat() {
  addMessage("👋 ¡Hola! Soy Helios, tu asesor inteligente.");
  setTimeout(() => askFirstQuestion(), 800);
}

function askFirstQuestion() {
  addMessage("¿Qué te gustaría hacer hoy?");
  addOptions({
    items: [
      { label: "Conocer los beneficios de la IA", next: askIndustry },
      { label: "Ver información de la empresa", next: showCompanyInfo },
      { label: "Agendar una asesoría", next: showContact }
    ]
  });
}

function askIndustry() {
  addMessage("¿En qué tipo de negocio estás interesado?");
  addOptions({
    items: [
      { label: "Salud", next: nextStep },
      { label: "Educación", next: nextStep },
      { label: "Comercio", next: nextStep },
      { label: "Otro", next: nextStep }
    ]
  });
}

function nextStep() {
  addMessage("Perfecto. Esta es solo una prueba de flujo. 💬");
  addMessage("Cuando confirmes que todo funciona, integramos el flujo real.");
  setTimeout(() => askFirstQuestion(), 2000);
}

function showCompanyInfo() {
  addMessage("Helios AI Labs es una empresa mexicana especializada en IA aplicada a negocios. 🚀");
  setTimeout(() => askFirstQuestion(), 2000);
}

function showContact() {
  addMessage("Por favor escribe tu nombre, teléfono y correo separados por comas.");
  unlockInput();
  currentStep = "contact";
}

/* ====== Envío manual (para pasos de texto libre) ====== */
function submitText() {
  const text = inputField.value.trim();
  if (!text) return;
  if (optionsVisible) {
    addMessage("Selecciona una opción de las burbujas, por favor.", "bot");
    return;
  }

  addMessage(text, "user");
  inputField.value = "";

  if (currentStep === "contact") {
    addMessage("Gracias, te contactaremos pronto. ✅");
    currentStep = null;
    setTimeout(() => askFirstQuestion(), 1500);
  }
}

/* ====== Listeners ====== */
sendBtn.addEventListener("click", submitText);
inputField.addEventListener("keydown", e => {
  if (e.key === "Enter") submitText();
});

/* ====== Iniciar ====== */
startChat();
