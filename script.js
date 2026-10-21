/* =========================================================
   Felices 5 meses - contador, animaciones y editor de fotos
   ========================================================= */

// Fecha de inicio: 21 de junio de 2026 a las 00:00 (hora local del dispositivo).
const startDate = new Date(2026, 5, 21, 0, 0, 0);

const counterElements = {
  months: document.querySelector("#months"),
  days: document.querySelector("#days"),
  hours: document.querySelector("#hours"),
  minutes: document.querySelector("#minutes"),
  seconds: document.querySelector("#seconds"),
};

/** Calcula meses completos y el tiempo restante desde una fecha de inicio. */
function getElapsedTime(from, to) {
  let months =
    (to.getFullYear() - from.getFullYear()) * 12 +
    (to.getMonth() - from.getMonth());

  let anchorDate = new Date(from);
  anchorDate.setMonth(from.getMonth() + months);

  if (anchorDate > to) {
    months -= 1;
    anchorDate = new Date(from);
    anchorDate.setMonth(from.getMonth() + months);
  }

  let remainingMilliseconds = Math.max(0, to - anchorDate);
  const millisecondsPerSecond = 1000;
  const millisecondsPerMinute = millisecondsPerSecond * 60;
  const millisecondsPerHour = millisecondsPerMinute * 60;
  const millisecondsPerDay = millisecondsPerHour * 24;

  const days = Math.floor(remainingMilliseconds / millisecondsPerDay);
  remainingMilliseconds %= millisecondsPerDay;
  const hours = Math.floor(remainingMilliseconds / millisecondsPerHour);
  remainingMilliseconds %= millisecondsPerHour;
  const minutes = Math.floor(remainingMilliseconds / millisecondsPerMinute);
  remainingMilliseconds %= millisecondsPerMinute;
  const seconds = Math.floor(remainingMilliseconds / millisecondsPerSecond);

  return { months, days, hours, minutes, seconds };
}

function updateCounter() {
  const elapsed = getElapsedTime(startDate, new Date());

  Object.entries(elapsed).forEach(([unit, value]) => {
    if (counterElements[unit]) counterElements[unit].textContent = value;
  });
}

updateCounter();
window.setInterval(updateCounter, 1000);

// =========================================================
// Editor persistente usando GitHub Contents API
// =========================================================

// El token se introduce en la página y permanece solo en memoria.
// Nunca lo guardamos en el repositorio, localStorage ni sessionStorage.
const GITHUB_REPOSITORY = "asmodezer0/CumpleMes";
const GITHUB_BRANCH = "main";
const GITHUB_API_BASE = "https://api.github.com";
const GITHUB_PAGES_BASE = "https://asmodezer0.github.io/CumpleMes";
const IMAGE_MANIFEST_PATH = "images.json";
const RAW_MANIFEST_URL =
  "https://raw.githubusercontent.com/asmodezer0/CumpleMes/main/images.json";

let githubToken = "";

const editorForm = document.querySelector("#editor-form");
const tokenInput = document.querySelector("#github-token");
const editorStatus = document.querySelector("#editor-status");
const memoryImages = [...document.querySelectorAll("[data-memory-id]")];

function setEditorStatus(message, type = "") {
  if (!editorStatus) return;
  editorStatus.textContent = message;
  editorStatus.className = `editor-status ${type}`.trim();
}

function githubHeaders() {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${githubToken}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

function githubFileUrl(path) {
  return `${GITHUB_API_BASE}/repos/${GITHUB_REPOSITORY}/contents/${path}`;
}

async function getGitHubFile(path) {
  const response = await fetch(
    `${githubFileUrl(path)}?ref=${encodeURIComponent(GITHUB_BRANCH)}`,
    { headers: githubHeaders() }
  );

  if (response.status === 404) return null;
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || "No se pudo consultar GitHub.");
  }

  return response.json();
}

async function upsertGitHubFile(path, base64Content, message) {
  const currentFile = await getGitHubFile(path);
  const body = {
    message,
    content: base64Content,
    branch: GITHUB_BRANCH,
  };

  if (currentFile?.sha) body.sha = currentFile.sha;

  const response = await fetch(githubFileUrl(path), {
    method: "PUT",
    headers: { ...githubHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || "GitHub rechazó la subida.");
  }

  return response.json();
}

function encodeBase64Utf8(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary);
}

function decodeBase64Utf8(value) {
  const cleanValue = value.replace(/\s/g, "");
  const binary = atob(cleanValue);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
    reader.readAsDataURL(blob);
  });
}

// Reduce el tamaño de la foto para que la subida sea rápida y segura.
async function compressImage(file) {
  const objectUrl = URL.createObjectURL(file);
  const image = await new Promise((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error("El archivo no parece una imagen válida."));
    element.src = objectUrl;
  });

  const maxDimension = 1600;
  const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(objectUrl);

  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.84)
  );

  if (!blob) throw new Error("No se pudo preparar la imagen.");
  return blobToBase64(blob);
}

async function activateEditor(event) {
  event.preventDefault();
  const candidateToken = tokenInput?.value.trim();

  if (!candidateToken) {
    setEditorStatus("Introduce tu token de GitHub para activar la edición.", "error");
    return;
  }

  githubToken = candidateToken;
  setEditorStatus("Comprobando acceso al repositorio…");

  try {
    const response = await fetch(
      `${GITHUB_API_BASE}/repos/${GITHUB_REPOSITORY}`,
      { headers: githubHeaders() }
    );

    if (!response.ok) throw new Error("El token no tiene acceso a este repositorio.");

    document.body.classList.add("editor-enabled");
    if (tokenInput) tokenInput.value = "";
    setEditorStatus(
      "Edición activada. Ahora puedes elegir una foto en cualquiera de los recuerdos.",
      "success"
    );
  } catch (error) {
    githubToken = "";
    setEditorStatus(error.message, "error");
  }
}

async function updateManifest(memoryId, imagePath) {
  const currentManifest = await getGitHubFile(IMAGE_MANIFEST_PATH);
  let manifest = {};

  if (currentManifest?.content) {
    manifest = JSON.parse(decodeBase64Utf8(currentManifest.content));
  }

  manifest[String(memoryId)] = imagePath;
  await upsertGitHubFile(
    IMAGE_MANIFEST_PATH,
    encodeBase64Utf8(`${JSON.stringify(manifest, null, 2)}\n`),
    `Update memory image manifest ${memoryId}`
  );
}

async function uploadMemoryImage(event) {
  const input = event.currentTarget;
  const memoryId = input.dataset.uploadInput;
  const file = input.files?.[0];

  if (!file) return;
  if (!githubToken) {
    setEditorStatus("Activa primero el modo edición.", "error");
    input.value = "";
    return;
  }

  try {
    setEditorStatus("Preparando y subiendo la foto…");
    const base64Image = await compressImage(file);
    const imagePath = `images/recuerdo-${memoryId}.jpg`;

    await upsertGitHubFile(
      imagePath,
      base64Image,
      `Update memory image ${memoryId}`
    );
    await updateManifest(memoryId, imagePath);

    const image = document.querySelector(`[data-memory-id="${memoryId}"]`);
    if (image) image.src = `${GITHUB_PAGES_BASE}/${imagePath}?v=${Date.now()}`;
    setEditorStatus(
      "Foto guardada. GitHub Pages la publicará para todos en unos segundos.",
      "success"
    );
  } catch (error) {
    setEditorStatus(`No se pudo guardar la foto: ${error.message}`, "error");
  } finally {
    input.value = "";
  }
}

async function loadImageManifest() {
  try {
    const response = await fetch(`${RAW_MANIFEST_URL}?v=${Date.now()}`);
    if (!response.ok) return;
    const manifest = await response.json();

    Object.entries(manifest).forEach(([memoryId, imagePath]) => {
      const image = document.querySelector(`[data-memory-id="${memoryId}"]`);
      if (image && imagePath && !imagePath.startsWith("foto-")) {
        image.src = `${GITHUB_PAGES_BASE}/${imagePath}?v=${Date.now()}`;
      }
    });
  } catch {
    // Si el manifiesto no está disponible, se mantienen las rutas de ejemplo.
  }
}

editorForm?.addEventListener("submit", activateEditor);
document.querySelectorAll("[data-upload-input]").forEach((input) => {
  input.addEventListener("change", uploadMemoryImage);
});
loadImageManifest();

// =========================================================
// Apariciones al hacer scroll y pequeños detalles de la página
// =========================================================

const revealElements = document.querySelectorAll(".reveal");

if ("IntersectionObserver" in window) {
  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.14 }
  );

  revealElements.forEach((element) => revealObserver.observe(element));
} else {
  revealElements.forEach((element) => element.classList.add("is-visible"));
}

const currentYear = document.querySelector("#current-year");
if (currentYear) currentYear.textContent = new Date().getFullYear();

