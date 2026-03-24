/**
 * timer.js
 * Live call-timer displayed on the hero call card.
 */
export function initTimer() {
  const el = document.getElementById('timer');
  if (!el) return;

  let seconds = 47;

  setInterval(() => {
    seconds++;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    el.textContent = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }, 1000);
}
