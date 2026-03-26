(function () {
  const PREFERRED_HOST = 'clovecircle.com';
  const LEGACY_GITHUB_HOST = 'lampofsocrates.github.io';
  const LEGACY_REPO_PREFIX = '/clove-circle';
  const COMMIT_API_URL = 'https://api.github.com/repos/lampofsocrates/clove-circle/commits?per_page=1';

  function toUrl(input) {
    if (input instanceof URL) {
      return new URL(input.toString());
    }

    if (typeof input === 'string') {
      return new URL(input);
    }

    if (input && typeof input.href === 'string') {
      return new URL(input.href);
    }

    throw new TypeError('A URL string or URL-like object is required.');
  }

  function normalizePathname(pathname) {
    if (pathname === LEGACY_REPO_PREFIX) {
      return '/';
    }

    if (pathname.startsWith(LEGACY_REPO_PREFIX + '/')) {
      return pathname.slice(LEGACY_REPO_PREFIX.length) || '/';
    }

    return pathname || '/';
  }

  function getCanonicalUrl(input) {
    const url = toUrl(input);

    if (
      url.hostname !== PREFERRED_HOST &&
      url.hostname !== 'www.' + PREFERRED_HOST &&
      url.hostname !== LEGACY_GITHUB_HOST
    ) {
      return url.toString();
    }

    url.protocol = 'https:';
    url.hostname = PREFERRED_HOST;
    url.pathname = normalizePathname(url.pathname);

    return url.toString();
  }

  function getPreferredUrl(input) {
    const url = toUrl(input);
    const canonicalUrl = getCanonicalUrl(url);

    return canonicalUrl === url.toString() ? null : canonicalUrl;
  }

  function ensureCanonicalLink(doc, href) {
    if (!doc || !doc.head) {
      return;
    }

    let link = doc.querySelector('link[rel="canonical"]');

    if (!link) {
      link = doc.createElement('link');
      link.setAttribute('rel', 'canonical');
      doc.head.appendChild(link);
    }

    link.setAttribute('href', href);
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      getCanonicalUrl,
      getPreferredUrl,
      normalizePathname,
    };
  }

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  const preferredUrl = getPreferredUrl(window.location);
  const canonicalUrl = getCanonicalUrl(window.location);

  ensureCanonicalLink(document, canonicalUrl);

  if (preferredUrl) {
    window.location.replace(preferredUrl);
    return;
  }

  // Keep the footer's "last updated" date in sync with the latest repository commit.
  fetch(COMMIT_API_URL)
    .then((response) => response.json())
    .then((data) => {
      const el = document.getElementById('last-updated');
      if (el && data[0]) {
        const date = new Date(data[0].commit.author.date);
        el.textContent = date.toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        });
      }
    })
    .catch(() => {});

  const scrollBtn = document.getElementById('scrollTop');
  const mainNav = document.getElementById('mainNav');

  window.addEventListener('scroll', () => {
    const offsetY = window.scrollY;
    if (scrollBtn) {
      scrollBtn.classList.toggle('visible', offsetY > 120);
    }
    if (mainNav) {
      mainNav.classList.toggle('scrolled', offsetY > 40);
    }
  });

  if (scrollBtn) {
    scrollBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  const revealEls = document.querySelectorAll('.cc-reveal');
  if (revealEls.length) {
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });

    revealEls.forEach((el) => revealObserver.observe(el));
  }

  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.cc-navbar .nav-link');

  if (sections.length && navLinks.length) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          navLinks.forEach((link) => {
            link.classList.toggle('active', link.getAttribute('href') === '#' + entry.target.id);
          });
        }
      });
    }, { rootMargin: '-40% 0px -40% 0px' });

    sections.forEach((section) => observer.observe(section));
  }
})();
