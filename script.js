/* =========================================================
   Felices 5 meses - funcionalidad
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

/**
 * Calcula una diferencia de calendario en meses completos y el tiempo restante.
 * Así, por ejemplo, el día 21 de cada mes suma exactamente un mes.
 */
function getElapsedTime(from, to) {
  let months =
    (to.getFullYear() - from.getFullYear()) * 12 +
    (to.getMonth() - from.getMonth());

  let anchorDate = new Date(from);
  anchorDate.setMonth(from.getMonth() + months);

  // Si todavía no se alcanzó el día equivalente del mes actual, corregimos.
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
  const now = new Date();
  const elapsed = getElapsedTime(startDate, now);

  Object.entries(elapsed).forEach(([unit, value]) => {
    if (counterElements[unit]) {
      counterElements[unit].textContent = value;
    }
  });
}

// Pintamos el primer resultado inmediatamente y luego cada segundo.
updateCounter();
window.setInterval(updateCounter, 1000);

// Revela los recuerdos suavemente cuando entran en la pantalla.
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
  // Fallback para navegadores antiguos.
  revealElements.forEach((element) => element.classList.add("is-visible"));
}

// Actualiza el año del pie de página sin tener que editarlo manualmente.
const currentYear = document.querySelector("#current-year");
if (currentYear) {
  currentYear.textContent = new Date().getFullYear();
}

