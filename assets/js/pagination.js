/**
 * MD3 Client-Side Blog Pagination & Cross-Page Jump Manager
 * Supports: Homepage (_posts), Tags page, Categories page
 * Handles: Live Search sync, Date jumps, Tag jumps, Category jumps, URL state (?page=X)
 */
class BlogPaginationManager {
  constructor() {
    this.itemsPerPage = 24;
    this.currentPage = 1;
    this.allCards = [];
    this.filteredCards = [];
    this.galleryContainer = null;
    this.bottomIsland = null;
    this.pageInfo = null;
    this.statusInfo = null;
    this.btnPrev = null;
    this.btnNext = null;
    this.btnTop = null;
    this.isInitialized = false;
  }

  init() {
    // Find the main gallery container on the page
    this.galleryContainer = document.getElementById('postGallery') ||
                           document.getElementById('tagPostGallery') ||
                           document.getElementById('catPostGallery') ||
                           document.querySelector('.gallery-container');
    if (!this.galleryContainer) return;

    this.allCards = Array.from(this.galleryContainer.querySelectorAll('.post-card'));
    if (!this.allCards.length) return;

    this.filteredCards = [...this.allCards];
    this.bottomIsland = document.getElementById('bottomIsland');
    this.pageInfo = document.getElementById('pageInfo');
    this.statusInfo = document.getElementById('statusInfo');
    this.btnPrev = document.getElementById('btnPrev');
    this.btnNext = document.getElementById('btnNext');
    this.btnTop = document.getElementById('btnIslandTop');

    // Read ?page= from URL params
    const params = new URLSearchParams(window.location.search);
    if (params.has('page')) {
      const p = parseInt(params.get('page'), 10);
      if (!isNaN(p) && p >= 1) {
        this.currentPage = p;
      }
    }

    // Bind event listeners
    if (this.btnPrev) this.btnPrev.addEventListener('click', () => this.prevPage());
    if (this.btnNext) this.btnNext.addEventListener('click', () => this.nextPage());
    if (this.btnTop) this.btnTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    window.addEventListener('popstate', () => {
      const pParams = new URLSearchParams(window.location.search);
      this.currentPage = parseInt(pParams.get('page'), 10) || 1;
      this.render({ scroll: false });
    });

    window.addEventListener('hashchange', () => {
      if (window.location.hash && window.location.hash.length > 1) {
        this.jumpToAnchor(window.location.hash);
      }
    });

    this.isInitialized = true;
    this.render({ scroll: false });

    // If initial URL has a hash (or preserved in window._initialHash), handle hash jump after render
    const initialHash = window._initialHash || window.location.hash;
    if (initialHash && initialHash.length > 1) {
      setTimeout(() => {
        this.jumpToAnchor(initialHash);
      }, 80);
      setTimeout(() => {
        this.jumpToAnchor(initialHash);
      }, 350);
    }
  }

  get totalPages() {
    return Math.ceil(this.filteredCards.length / this.itemsPerPage) || 1;
  }

  render(options = { scroll: true }) {
    if (!this.isInitialized) return;

    if (this.currentPage > this.totalPages) {
      this.currentPage = this.totalPages;
    }
    if (this.currentPage < 1) {
      this.currentPage = 1;
    }

    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;

    const visibleSet = new Set(this.filteredCards.slice(startIndex, endIndex));

    // Update post card display
    this.allCards.forEach(card => {
      if (visibleSet.has(card)) {
        card.style.display = '';
        card.classList.add('animate-fade-in-up');
      } else {
        card.style.display = 'none';
      }
    });

    // Update timeline headers visibility
    const headers = this.galleryContainer.querySelectorAll('.timeline-header');
    headers.forEach(header => {
      const dateStr = header.dataset.date;
      const tagStr = header.dataset.tag;
      const catStr = header.dataset.cat;
      const headerId = header.id;

      // Check if any visible post belongs to this header
      let hasVisiblePost = false;
      for (const card of visibleSet) {
        if (dateStr && card.querySelector(`.calendar-jump-trigger[data-date="${dateStr}"]`)) {
          hasVisiblePost = true;
          break;
        }
        if (tagStr && card.dataset.tag === tagStr) {
          hasVisiblePost = true;
          break;
        }
        if (catStr && card.dataset.cat === catStr) {
          hasVisiblePost = true;
          break;
        }
        // General check: if card is next sibling under this header
        if (!dateStr && !tagStr && !catStr) {
          let prev = card.previousElementSibling;
          while (prev) {
            if (prev === header) { hasVisiblePost = true; break; }
            if (prev.classList.contains('timeline-header')) break;
            prev = prev.previousElementSibling;
          }
          if (hasVisiblePost) break;
        }
      }

      header.style.display = hasVisiblePost ? '' : 'none';
    });

    // Update Bottom Island
    if (this.bottomIsland) {
      if (this.filteredCards.length === 0) {
        this.bottomIsland.style.display = 'none';
      } else {
        this.bottomIsland.style.display = 'flex';
        if (this.pageInfo) this.pageInfo.innerText = `${this.currentPage} / ${this.totalPages}`;
        if (this.statusInfo) this.statusInfo.innerText = `共 ${this.filteredCards.length} 篇`;
        if (this.btnPrev) this.btnPrev.disabled = (this.currentPage === 1);
        if (this.btnNext) this.btnNext.disabled = (this.currentPage === this.totalPages);
      }
    }

    // Sync URL ?page=
    const url = new URL(window.location);
    if (this.currentPage > 1) {
      url.searchParams.set('page', this.currentPage);
    } else {
      url.searchParams.delete('page');
    }
    window.history.replaceState(null, '', url.toString());

    if (options.scroll) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.render({ scroll: true });
    }
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.render({ scroll: true });
    }
  }

  goToPage(p, options = { scroll: true }) {
    this.currentPage = parseInt(p, 10) || 1;
    this.render(options);
  }

  setFilteredCards(cards) {
    this.filteredCards = cards;
    this.currentPage = 1;
    this.render({ scroll: false });
  }

  // Cross-page Jump to Date
  jumpToDate(dateStr) {
    if (!this.isInitialized) return;

    let targetIndex = -1;
    for (let i = 0; i < this.filteredCards.length; i++) {
      const card = this.filteredCards[i];
      const trigger = card.querySelector(`.calendar-jump-trigger[data-date="${dateStr}"]`);
      if (trigger) {
        targetIndex = i;
        break;
      }
    }

    if (targetIndex === -1) {
      for (let i = 0; i < this.allCards.length; i++) {
        const card = this.allCards[i];
        const trigger = card.querySelector(`.calendar-jump-trigger[data-date="${dateStr}"]`);
        if (trigger) {
          const searchInput = document.getElementById('searchInput');
          if (searchInput) searchInput.value = '';
          this.filteredCards = [...this.allCards];
          targetIndex = i;
          break;
        }
      }
    }

    if (targetIndex === -1) return;

    const targetPage = Math.floor(targetIndex / this.itemsPerPage) + 1;
    this.goToPage(targetPage, { scroll: false });

    // Switch view mode if needed
    const timelineBtn = document.querySelector('button[data-view="timeline"]');
    if (timelineBtn && !timelineBtn.classList.contains('active')) {
      timelineBtn.click();
    }

    const doScrollToHeader = () => {
      const header = document.querySelector(`.timeline-header[data-date="${dateStr}"]`);
      if (header) {
        header.style.display = '';
        const main = document.querySelector('.main-content') || document.querySelector('main');
        if (main) main.style.transform = 'none';
        const rect = header.getBoundingClientRect();
        const topOffset = rect.top + (window.pageYOffset || document.documentElement.scrollTop) - 84;
        window.scrollTo({ top: Math.max(0, topOffset), behavior: 'smooth' });
        header.animate([
          { background: 'color-mix(in srgb, var(--md-sys-color-primary-container) 85%, transparent)', borderRadius: '12px', paddingLeft: '12px' },
          { background: 'transparent', borderRadius: '', paddingLeft: '' }
        ], { duration: 2000, easing: 'cubic-bezier(0.2, 0, 0, 1)' });
      }
    };

    setTimeout(doScrollToHeader, 60);
    setTimeout(doScrollToHeader, 280);
  }

  // Cross-page Jump to Tag or Category anchor (#slug)
  jumpToAnchor(hash) {
    if (!this.isInitialized || !hash || hash === '#') return;
    const rawId = hash.startsWith('#') ? hash.substring(1) : hash;
    let targetId = rawId;
    try { targetId = decodeURIComponent(rawId); } catch (err) {}

    let headerEl = document.getElementById(targetId) || document.getElementById(rawId);
    if (!headerEl) {
      const allHeaders = this.galleryContainer ? this.galleryContainer.querySelectorAll('.timeline-header') : document.querySelectorAll('.timeline-header');
      for (const h of allHeaders) {
        if (h.id === targetId || h.id === rawId || h.dataset.tag === targetId || h.dataset.cat === targetId || h.dataset.tag === rawId || h.dataset.cat === rawId) {
          headerEl = h;
          break;
        }
      }
    }

    if (!headerEl) return;

    let firstCard = null;
    let curr = headerEl.nextElementSibling;
    while (curr) {
      if (curr.classList.contains('post-card')) {
        firstCard = curr;
        break;
      }
      if (curr.classList.contains('timeline-header')) break;
      curr = curr.nextElementSibling;
    }

    if (firstCard) {
      const targetIndex = this.filteredCards.indexOf(firstCard);
      if (targetIndex !== -1) {
        const targetPage = Math.floor(targetIndex / this.itemsPerPage) + 1;
        if (this.currentPage !== targetPage) {
          this.goToPage(targetPage, { scroll: false });
        }
      }
    }

    const doScrollToAnchor = () => {
      headerEl.style.display = '';
      const main = document.querySelector('.main-content') || document.querySelector('main');
      if (main) main.style.transform = 'none';
      const rect = headerEl.getBoundingClientRect();
      const topOffset = rect.top + (window.pageYOffset || document.documentElement.scrollTop) - 84;
      window.scrollTo({ top: Math.max(0, topOffset), behavior: 'smooth' });
      try { history.replaceState(null, null, '#' + targetId); } catch (e) {}
      if (window._originalScrollRestoration !== undefined && 'scrollRestoration' in history) {
        setTimeout(() => { history.scrollRestoration = window._originalScrollRestoration; }, 1000);
      }
      headerEl.animate([
        { background: 'color-mix(in srgb, var(--md-sys-color-primary-container) 85%, transparent)', borderRadius: '12px', paddingLeft: '12px' },
        { background: 'transparent', borderRadius: '', paddingLeft: '' }
      ], { duration: 2000, easing: 'cubic-bezier(0.2, 0, 0, 1)' });
    };

    setTimeout(doScrollToAnchor, 60);
    setTimeout(doScrollToAnchor, 280);
  }
}

window.blogPagination = new BlogPaginationManager();

document.addEventListener('DOMContentLoaded', () => {
  window.blogPagination.init();
});
