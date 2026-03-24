/**
 * reveal.js
 * Scroll-triggered fade-in animation using IntersectionObserver.
 */
export function initReveal() {
  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0, rootMargin: '0px 0px -40px 0px' }
  );

  document.querySelectorAll('.reveal').forEach(el => {
    el.classList.add('animate');
    observer.observe(el);
  });
}
