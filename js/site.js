// Scroll-to-top + navbar scroll effect
const scrollBtn = document.getElementById('scrollTop');
const mainNav = document.getElementById('mainNav');

window.addEventListener('scroll', () => {
  const y = window.scrollY;
  if (scrollBtn) scrollBtn.classList.toggle('visible', y > 120);
  if (mainNav) mainNav.classList.toggle('scrolled', y > 40);
});

if (scrollBtn) {
  scrollBtn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

// Active nav link on scroll via IntersectionObserver
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.cc-navbar .nav-link');

if (sections.length && navLinks.length) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        navLinks.forEach(link => {
          link.classList.toggle('active', link.getAttribute('href') === '#' + entry.target.id);
        });
      }
    });
  }, { rootMargin: '-40% 0px -40% 0px' });

  sections.forEach(s => observer.observe(s));
}
