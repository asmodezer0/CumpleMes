/* =========================================================
   Felices 5 meses - contador, animaciones y fotos con Supabase
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
// Fotos persistentes usando Supabase Storage
// =========================================================

const SUPABASE_URL = "https://anaqfwlrkwibjufrbwup.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_dwrd7upQDa_t8TPMfcURZg_1ZImCzmy";
const SUPABASE_BUCKET = "memory-images";
const SUPABASE_STORAGE_URL = `${SUPABASE_URL}/storage/v1`;

const photoStatus = document.querySelector("#photo-status");

function setPhotoStatus(message, type = "") {
  if (!photoStatus) return;
  photoStatus.textContent = message;
  photoStatus.className = `photo-status ${type}`.trim();
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
  return blob;
}

function openPhotoPicker(event) {
  const memoryId = event.currentTarget.dataset.uploadButton;
  const input = document.querySelector(`[data-upload-input="${memoryId}"]`);
  input?.click();
}

function getPublicImageUrl(imagePath) {
  return `${SUPABASE_STORAGE_URL}/object/public/${SUPABASE_BUCKET}/${imagePath}`;
}

async function uploadMemoryImage(event) {
  const input = event.currentTarget;
  const memoryId = input.dataset.uploadInput;
  const file = input.files?.[0];

  if (!file) return;

  try {
    setPhotoStatus("Preparando y guardando la foto…");
    const imageBlob = await compressImage(file);
    const imagePath = `recuerdo-${memoryId}.jpg`;
    const response = await fetch(
      `${SUPABASE_STORAGE_URL}/object/${SUPABASE_BUCKET}/${imagePath}`,
      {
        method: "POST",
        headers: {
          apikey: SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
          "Content-Type": "image/jpeg",
          "x-upsert": "true",
          "cache-control": "3600",
        },
        body: imageBlob,
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || "Supabase rechazó la subida.");
    }

    const image = document.querySelector(`[data-memory-id="${memoryId}"]`);
    if (image) image.src = `${getPublicImageUrl(imagePath)}?v=${Date.now()}`;
    setPhotoStatus(
      "Foto guardada. Ya está disponible para todos los dispositivos.",
      "success"
    );
  } catch (error) {
    setPhotoStatus(`No se pudo guardar la foto: ${error.message}`, "error");
  } finally {
    input.value = "";
  }
}

document.querySelectorAll("[data-upload-button]").forEach((button) => {
  button.addEventListener("click", openPhotoPicker);
});
document.querySelectorAll("[data-upload-input]").forEach((input) => {
  input.addEventListener("change", uploadMemoryImage);
});

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

