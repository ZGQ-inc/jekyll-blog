document.addEventListener('DOMContentLoaded', () => {
  const articleContent = document.querySelector('.article-content');
  const tocContent = document.getElementById('tocContent');
  const tocSidebar = document.getElementById('tocSidebar');
  const toggleBtns = document.querySelectorAll('.toc-toggle-btn');
  const postLayout = document.querySelector('.post-layout-container');

  if (!articleContent || !tocContent || !tocSidebar) return;

  // 1. Generate TOC
  const headings = Array.from(articleContent.querySelectorAll('h2, h3'));
  
  if (headings.length === 0) {
    tocSidebar.style.display = 'none';
    toggleBtns.forEach(btn => btn.style.display = 'none');
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
    link.textContent = heading.innerText.trim();
    link.className = 'toc-link';
    
    // Smooth scroll
    link.addEventListener('click', (e) => {
      e.preventDefault();
      history.pushState(null, null, link.hash);
      const target = document.getElementById(heading.id);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });

    listItem.appendChild(link);
    tocList.appendChild(listItem);
  });

  if (!hasValidItems) {
    tocSidebar.style.display = 'none';
    toggleBtns.forEach(btn => btn.style.display = 'none');
    return;
  }

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

    // Determine the active heading (highest in the viewport)
    if (visibleHeadings.length > 0) {
      activeId = visibleHeadings[0];
    } else {
      // If scrolling up past a heading, active might be the one above it
      // For a robust scrollspy, we need a slightly different logic
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
          // Scroll the TOC itself if needed
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

  // 3. TOC Toggle Logic
  const TOC_PREF_KEY = 'md3_toc_hidden';
  
  function setTocState(isHidden) {
    if (isHidden) {
      postLayout.classList.add('toc-hidden');
      toggleBtns.forEach(btn => btn.classList.add('inactive'));
      localStorage.setItem(TOC_PREF_KEY, 'true');
    } else {
      postLayout.classList.remove('toc-hidden');
      toggleBtns.forEach(btn => btn.classList.remove('inactive'));
      localStorage.setItem(TOC_PREF_KEY, 'false');
    }
  }

  // Load initial state
  const isHiddenInit = localStorage.getItem(TOC_PREF_KEY) === 'true';
  setTocState(isHiddenInit);

  toggleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const currentlyHidden = postLayout.classList.contains('toc-hidden');
      setTocState(!currentlyHidden);
    });
  });
});
