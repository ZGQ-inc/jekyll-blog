// ==============================================================================
// Material Design 3 Table of Contents (TOC) & ScrollSpy Module
// ==============================================================================

(function() {
  'use strict';

  let currentObserver = null;
  let buttonsBound = false;

  function bindDrawerControls() {
    if (buttonsBound) return;
    buttonsBound = true;

    const tocDrawer = document.getElementById('tocDrawer');
    const tocOverlay = document.getElementById('tocOverlay');
    const topTocBtn = document.getElementById('topTocBtn');
    const pcTocBtn = document.getElementById('pcTocBtn');
    const tocCloseBtn = document.getElementById('tocCloseBtn');

    if (!tocDrawer) return;

    function openToc() {
      tocDrawer.classList.add('open');
      if (pcTocBtn) pcTocBtn.classList.add('drawer-open');
      
      if (window.innerWidth <= 1024) {
        if (tocOverlay) tocOverlay.classList.add('visible');
        document.body.style.overflow = 'hidden';
      }
    }

    function closeToc() {
      tocDrawer.classList.remove('open');
      if (tocOverlay) tocOverlay.classList.remove('visible');
      if (pcTocBtn) pcTocBtn.classList.remove('drawer-open');
      document.body.style.overflow = '';
    }

    if (topTocBtn) {
      topTocBtn.addEventListener('click', () => {
        if (tocDrawer.classList.contains('open')) closeToc();
        else openToc();
      });
    }

    if (pcTocBtn) {
      pcTocBtn.addEventListener('click', () => {
        if (tocDrawer.classList.contains('open')) closeToc();
        else openToc();
      });
    }

    if (tocCloseBtn) {
      tocCloseBtn.addEventListener('click', closeToc);
    }

    if (tocOverlay) {
      tocOverlay.addEventListener('click', closeToc);
    }

    window.addEventListener('resize', () => {
      if (window.innerWidth >= 1025) {
        document.body.style.overflow = '';
        if (tocOverlay) tocOverlay.classList.remove('visible');
      } else {
        if (tocDrawer.classList.contains('open')) {
          document.body.style.overflow = 'hidden';
          if (tocOverlay) tocOverlay.classList.add('visible');
        }
      }
    });

    window.closeTocDrawer = closeToc;
    window.openTocDrawer = openToc;
  }

  function initTOC() {
    bindDrawerControls();

    const tocContent = document.getElementById('tocContent');
    const topTocBtn = document.getElementById('topTocBtn');
    const pcTocBtn = document.getElementById('pcTocBtn');
    if (!tocContent) return;

    // Disconnect any existing observer
    if (currentObserver) {
      currentObserver.disconnect();
      currentObserver = null;
    }

    // Locate active article container (handles normal posts and decrypted vault posts)
    const articleContent = document.querySelector(
      '#vaultDecryptedContent.vault-unlocked-content, .article-content:not([style*="display: none"]):not([style*="display:none"]), .article-content'
    );
    if (!articleContent) {
      if (topTocBtn) topTocBtn.style.display = 'none';
      if (pcTocBtn) pcTocBtn.style.display = 'none';
      return;
    }

    const headings = Array.from(articleContent.querySelectorAll('h2, h3'));
    if (headings.length === 0) {
      if (topTocBtn) topTocBtn.style.display = 'none';
      if (pcTocBtn) pcTocBtn.style.display = 'none';
      tocContent.innerHTML = '';
      return;
    }

    // Build TOC List
    tocContent.innerHTML = '';
    const tocList = document.createElement('ul');
    tocList.className = 'toc-list';
    let hasValidItems = false;

    headings.forEach(heading => {
      if (!heading.id) return;
      hasValidItems = true;

      const listItem = document.createElement('li');
      listItem.className = `toc-item toc-level-${heading.tagName.toLowerCase()}`;

      const link = document.createElement('a');
      link.href = `#${heading.id}`;
      link.textContent = Array.from(heading.childNodes)
        .filter(node => node.nodeType === Node.TEXT_NODE || (node.nodeType === Node.ELEMENT_NODE && !node.classList.contains('anchor-icon')))
        .map(node => node.textContent)
        .join('').trim();
      link.className = 'toc-link';

      link.addEventListener('click', (e) => {
        e.preventDefault();
        history.pushState(null, null, link.hash);
        const target = document.getElementById(heading.id);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth' });
        }
        if (window.innerWidth < 1025 && typeof window.closeTocDrawer === 'function') {
          window.closeTocDrawer();
        }
      });

      listItem.appendChild(link);
      tocList.appendChild(listItem);
    });

    if (!hasValidItems) {
      if (topTocBtn) topTocBtn.style.display = 'none';
      if (pcTocBtn) pcTocBtn.style.display = 'none';
      return;
    }

    if (topTocBtn) topTocBtn.style.display = 'inline-flex';
    if (pcTocBtn) pcTocBtn.style.display = 'flex';
    tocContent.appendChild(tocList);

    // ScrollSpy using IntersectionObserver
    const tocLinks = tocList.querySelectorAll('.toc-link');
    let activeId = null;

    const observerOptions = {
      root: null,
      rootMargin: '-80px 0px -70% 0px',
      threshold: 0
    };

    currentObserver = new IntersectionObserver((entries) => {
      let visibleHeadings = [];
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          visibleHeadings.push(entry.target.id);
        }
      });

      if (visibleHeadings.length > 0) {
        activeId = visibleHeadings[0];
      } else {
        entries.forEach(entry => {
          if (!entry.isIntersecting && entry.boundingClientRect.top < 0) {
            activeId = entry.target.id;
          }
        });
      }

      if (activeId) {
        tocLinks.forEach(link => {
          link.classList.remove('active');
          if (link.getAttribute('href') === `#${activeId}`) {
            link.classList.add('active');
            const listItem = link.parentElement;
            if (listItem && (listItem.offsetTop > tocContent.scrollTop + tocContent.clientHeight || listItem.offsetTop < tocContent.scrollTop)) {
              tocContent.scrollTo({
                top: listItem.offsetTop - tocContent.clientHeight / 2,
                behavior: 'smooth'
              });
            }
          }
        });
      }
    }, observerOptions);

    headings.forEach(h => {
      if (h.id) currentObserver.observe(h);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTOC);
  } else {
    initTOC();
  }

  window.initTOC = initTOC;
})();
