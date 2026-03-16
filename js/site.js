// Last updated — fetch latest commit date from GitHub
fetch('https://api.github.com/repos/lampofsocrates/clove-circle/commits?per_page=1')
  .then(r => r.json())
  .then(data => {
    const el = document.getElementById('last-updated');
    if (el && data[0]) {
      const d = new Date(data[0].commit.author.date);
      el.textContent = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    }
  })
  .catch(() => {});

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

// Scroll-reveal: fade sections up on first scroll into view
const revealEls = document.querySelectorAll('.cc-reveal');
if (revealEls.length) {
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  revealEls.forEach(el => revealObserver.observe(el));
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
