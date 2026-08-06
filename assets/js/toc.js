document.addEventListener('DOMContentLoaded', () => {
  const articleContent = document.querySelector('.article-content');
  const tocContent = document.getElementById('tocContent');
  const tocDrawer = document.getElementById('tocDrawer');
  const tocOverlay = document.getElementById('tocOverlay');
  const topTocBtn = document.getElementById('topTocBtn');
  const pcTocBtn = document.getElementById('pcTocBtn');
  const tocCloseBtn = document.getElementById('tocCloseBtn');

  if (!articleContent || !tocContent || !tocDrawer) return;

  // 1. Generate TOC
  const headings = Array.from(articleContent.querySelectorAll('h2, h3'));
  
  if (headings.length === 0) {
    if (topTocBtn) topTocBtn.style.display = 'none';
    if (pcTocBtn) pcTocBtn.style.display = 'none';
    return;
  }

  const tocList = document.createElement('ul');
  tocList.className = 'toc-list';
  let hasValidItems = false;

  headings.forEach(heading => {
    if (!heading.id) return; // Kramdown generates IDs automatically
    
    hasValidItems = true;
    const listItem = document.createElement('li');
    listItem.className = `toc-item toc-level-${heading.tagName.toLowerCase()}`;
    
    const link = document.createElement('a');
    link.href = `#${heading.id}`;
    
    // Extract text ignoring the anchor copy icon
    link.textContent = Array.from(heading.childNodes)
      .filter(node => node.nodeType === Node.TEXT_NODE || (node.nodeType === Node.ELEMENT_NODE && !node.classList.contains('anchor-icon')))
      .map(node => node.textContent)
      .join('').trim();
      
    link.className = 'toc-link';
    
    // Smooth scroll and close drawer on mobile/click
    link.addEventListener('click', (e) => {
      e.preventDefault();
      history.pushState(null, null, link.hash);
      const target = document.getElementById(heading.id);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
      }
      
      // Close drawer on small screens if clicking a link
      if (window.innerWidth < 1025) {
        closeToc();
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

  // Show the TOC button since we have valid items
  if (topTocBtn) topTocBtn.style.display = 'inline-flex';
  if (pcTocBtn) pcTocBtn.style.display = 'flex';
  
  tocContent.appendChild(tocList);

  // 2. ScrollSpy using IntersectionObserver
  const tocLinks = document.querySelectorAll('.toc-link');
  let activeId = null;

  const observerOptions = {
    root: null,
    rootMargin: '-80px 0px -70% 0px', // Trigger slightly below the top app bar
    threshold: 0
  };

  const observer = new IntersectionObserver((entries) => {
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
          // Auto scroll TOC
          const listItem = link.parentElement;
          if (listItem.offsetTop > tocContent.scrollTop + tocContent.clientHeight || listItem.offsetTop < tocContent.scrollTop) {
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
    if (h.id) observer.observe(h);
  });

  // 3. TOC Drawer Toggle Logic
  function openToc() {
    tocDrawer.classList.add('open');
    if (pcTocBtn) pcTocBtn.classList.add('drawer-open');
    
    // Only show overlay and lock body scroll on small screens
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
      if (tocDrawer.classList.contains('open')) {
        closeToc();
      } else {
        openToc();
      }
    });
  }

  if (pcTocBtn) {
    pcTocBtn.addEventListener('click', () => {
      if (tocDrawer.classList.contains('open')) {
        closeToc();
      } else {
        openToc();
      }
    });
  }

  if (tocCloseBtn) {
    tocCloseBtn.addEventListener('click', closeToc);
  }

  if (tocOverlay) {
    tocOverlay.addEventListener('click', closeToc);
  }

  // Handle window resize logic for body scroll
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
});
