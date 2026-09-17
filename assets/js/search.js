function initSearch() {
  var searchInput = document.getElementById('searchInput');
  if (!searchInput) return;

  var searchBar = document.getElementById('androidSearchBar') || searchInput.closest('.android-search-bar');
  var regexToggleBtn = document.getElementById('regexToggleBtn');
  var isRegexMode = false;
  var fuse = null;
  var searchIndex = [];
  var isFetching = false;
  var urlToItemMap = new Map();

  function normalizeUrl(url) {
    if (!url) return '';
    return url.replace(/^https?:\/\/[^\/]+/, '').replace(/\/$/, '').toLowerCase();
  }

  function countOccurrences(text, term) {
    if (!text || !term) return 0;
    var count = 0;
    var pos = text.indexOf(term);
    while (pos !== -1 && count < 10) {
      count++;
      pos = text.indexOf(term, pos + term.length);
    }
    return count;
  }

  function buildUrlMap() {
    urlToItemMap.clear();
    searchIndex.forEach(function(item) {
      if (item.url) {
        urlToItemMap.set(normalizeUrl(item.url), item);
      }
    });
  }

  function loadSearchIndex() {
    if (fuse || isFetching) return;
    isFetching = true;
    fetch('/search.json')
      .then(function(response) { return response.json(); })
      .then(function(data) {
        searchIndex = data;
        buildUrlMap();
        fuse = new Fuse(searchIndex, {
          keys: [
            { name: 'title', weight: 0.6 },
            { name: 'tags', weight: 0.3 },
            { name: 'content', weight: 0.1 }
          ],
          threshold: 0.3, // Strict threshold to prevent irrelevant match pollution
          ignoreLocation: true,
          includeScore: true
        });
        isFetching = false;
        if (searchInput.value.trim() !== '') {
          window.filterPosts();
        }
      })
      .catch(function(err) {
        console.error('Failed to load search index:', err);
        isFetching = false;
      });
  }

  // Make the entire search bar clickable to focus input
  if (searchBar) {
    searchBar.addEventListener('click', function(e) {
      if (!e.target.closest('#regexToggleBtn')) {
        searchInput.focus();
      }
    });
  }

  // Regex mode toggle button
  if (regexToggleBtn) {
    regexToggleBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      isRegexMode = !isRegexMode;
      regexToggleBtn.classList.toggle('active', isRegexMode);
      regexToggleBtn.setAttribute('aria-pressed', isRegexMode ? 'true' : 'false');
      window.filterPosts();
      searchInput.focus();
    });
  }

  searchInput.addEventListener('focus', loadSearchIndex);
  setTimeout(loadSearchIndex, 800); // Proactive index preload

  window.filterPosts = function() {
    var allCards = Array.from(document.querySelectorAll('.post-card'));
    var raw = searchInput.value.trim();
    var scoredCandidates = [];

    // Empty search query: restore everything
    if (!raw) {
      if (searchBar) searchBar.classList.remove('is-error');
      if (window.blogPagination && window.blogPagination.isInitialized) {
        window.blogPagination.setFilteredCards(allCards, false);
      } else {
        allCards.forEach(function(card) {
          card.style.display = '';
          card.style.order = '';
        });
      }
      return;
    }

    // 1. Regular Expression Mode
    if (isRegexMode) {
      var regex = null;
      try {
        regex = new RegExp(raw, 'i');
        if (searchBar) searchBar.classList.remove('is-error');
      } catch (err) {
        // Invalid regex: switch search bar to MD3 error red tone
        if (searchBar) searchBar.classList.add('is-error');
        if (window.blogPagination && window.blogPagination.isInitialized) {
          window.blogPagination.setFilteredCards([], true);
        } else {
          allCards.forEach(function(card) {
            card.style.display = 'none';
            card.style.order = '';
          });
        }
        return;
      }

      allCards.forEach(function(card) {
        var url = normalizeUrl(card.getAttribute('href'));
        var item = urlToItemMap.get(url);
        var title = (card.dataset.title || card.querySelector('.archive-title, .card-title')?.textContent || (item ? item.title : '')).trim();
        var tags = card.dataset.tags || (item ? item.tags : '') || '';
        var content = (item ? item.content : '') || '';

        var score = 0;
        if (regex.test(title)) {
          score = 1000;
        } else if (regex.test(tags)) {
          score = 600;
        } else if (content && regex.test(content)) {
          score = 300;
        }

        if (score > 0) {
          scoredCandidates.push({ card: card, score: score });
        }
      });

    } else {
      // Non-regex mode: clear error state
      if (searchBar) searchBar.classList.remove('is-error');

      // 2. English Double Quotes Exact Match (Whole-Phrase / Whole-Word Match)
      var isQuoted = raw.length >= 2 && raw.startsWith('"') && raw.endsWith('"');
      if (isQuoted) {
        var term = raw.slice(1, -1).trim().toLowerCase();
        if (!term) {
          if (window.blogPagination && window.blogPagination.isInitialized) {
            window.blogPagination.setFilteredCards([], true);
          } else {
            allCards.forEach(function(card) {
              card.style.display = 'none';
              card.style.order = '';
            });
          }
          return;
        }

        allCards.forEach(function(card) {
          var url = normalizeUrl(card.getAttribute('href'));
          var item = urlToItemMap.get(url);
          var title = (card.dataset.title || card.querySelector('.archive-title, .card-title')?.textContent || (item ? item.title : '')).trim().toLowerCase();
          var tags = (card.dataset.tags || (item ? item.tags : '') || '').toLowerCase();
          var content = ((item ? item.content : '') || '').toLowerCase();

          var score = 0;
          if (title === term) {
            score = 1000;
          } else if (title.startsWith(term)) {
            score = 900;
          } else if (title.includes(term)) {
            score = 800;
          } else if (tags.includes(term)) {
            score = 600;
          } else if (content && content.includes(term)) {
            score = 400 + Math.min(50, countOccurrences(content, term) * 5);
          }

          // Strict match: NO fuzzy matches allowed when quoted
          if (score > 0) {
            scoredCandidates.push({ card: card, score: score });
          }
        });

      } else {
        // 3. Standard Search (Exact Match prioritized before Fuzzy Match)
        var q = raw.toLowerCase();
        var words = q.split(/\s+/).filter(Boolean);
        var scoredMap = new Map();

        // Pass A: Exact Title, Tag, and Content Matches
        allCards.forEach(function(card) {
          var url = normalizeUrl(card.getAttribute('href'));
          var item = urlToItemMap.get(url);
          var title = (card.dataset.title || card.querySelector('.archive-title, .card-title')?.textContent || (item ? item.title : '')).trim().toLowerCase();
          var tags = (card.dataset.tags || (item ? item.tags : '') || '').toLowerCase();
          var content = ((item ? item.content : '') || '').toLowerCase();

          var score = 0;
          if (title === q) {
            score = 1000;
          } else if (title.startsWith(q)) {
            score = 900;
          } else if (title.includes(q)) {
            score = 800;
          } else if (words.length > 1 && words.every(function(w) { return title.includes(w); })) {
            score = 700;
          } else if (tags === q) {
            score = 650;
          } else if (tags.includes(q)) {
            score = 600;
          } else if (content && content.includes(q)) {
            score = 400 + Math.min(50, countOccurrences(content, q) * 5);
          } else if (content && words.length > 1 && words.every(function(w) { return content.includes(w); })) {
            score = 300;
          }

          if (score > 0) {
            scoredMap.set(card, score);
          }
        });

        // Pass B: Fuzzy Matching via Fuse.js (Lower Priority: Score 50 ~ 100)
        if (fuse) {
          var fuseResults = fuse.search(q);
          var cardByUrl = new Map();
          allCards.forEach(function(card) {
            cardByUrl.set(normalizeUrl(card.getAttribute('href')), card);
          });

          fuseResults.forEach(function(r) {
            if (r.score !== undefined && r.score <= 0.3) {
              var card = cardByUrl.get(normalizeUrl(r.item.url));
              if (card && !scoredMap.has(card)) {
                // Fuzzy match score: strictly below exact matches (< 100)
                var fuzzyScore = Math.round((1.0 - r.score) * 100);
                scoredMap.set(card, Math.min(99, fuzzyScore));
              }
            }
          });
        } else {
          loadSearchIndex();
        }

        scoredMap.forEach(function(score, card) {
          scoredCandidates.push({ card: card, score: score });
        });
      }
    }

    // Sort strictly by relevance score descending
    scoredCandidates.sort(function(a, b) {
      return b.score - a.score;
    });

    var matchedCards = scoredCandidates.map(function(c) {
      return c.card;
    });

    // Render with Pagination and CSS order
    if (window.blogPagination && window.blogPagination.isInitialized) {
      window.blogPagination.setFilteredCards(matchedCards, true);
    } else {
      allCards.forEach(function(card) {
        var idx = matchedCards.indexOf(card);
        if (idx !== -1) {
          card.style.display = '';
          card.style.order = idx;
        } else {
          card.style.display = 'none';
          card.style.order = '';
        }
      });
      document.querySelectorAll('.timeline-header').forEach(function(header) {
        header.style.display = 'none';
      });
    }
  };

  searchInput.addEventListener('input', window.filterPosts);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSearch);
} else {
  initSearch();
}


