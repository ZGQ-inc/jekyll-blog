// Full-Text Search with Fuse.js
document.addEventListener('DOMContentLoaded', function() {
  var searchInput = document.getElementById('searchInput');
  if (!searchInput) return;

  var fuse = null;
  var searchIndex = [];
  var isFetching = false;
  
  // Lazy load search index on focus or first input
  function loadSearchIndex() {
    if (fuse || isFetching) return;
    isFetching = true;
    fetch('/search.json')
      .then(response => response.json())
      .then(data => {
        searchIndex = data;
        fuse = new Fuse(searchIndex, {
          keys: [
            { name: 'title', weight: 0.6 },
            { name: 'tags', weight: 0.3 },
            { name: 'content', weight: 0.1 }
          ],
          threshold: 0.4,
          ignoreLocation: true,
          includeScore: true
        });
        isFetching = false;
        // Trigger filter if user already typed something
        if (searchInput.value.trim() !== '') {
          window.filterPosts();
        }
      })
      .catch(err => {
        console.error('Failed to load search index:', err);
        isFetching = false;
      });
  }

  searchInput.addEventListener('focus', loadSearchIndex);
  
  window.filterPosts = function() {
    var cards = document.querySelectorAll('.post-card, .archive-post-item');
    var q = searchInput.value.trim().toLowerCase();
    var t = window.activeTag ? window.activeTag.toLowerCase() : null;

    if (q && fuse) {
      // Fuzzy search
      var results = fuse.search(q);
      // Map to URLs for fast lookup
      var matchedUrls = new Set(results.map(r => r.item.url));
      
      cards.forEach(function(card) {
        var url = card.getAttribute('href');
        var tags = card.dataset.tags || '';
        
        // Exact substring match as fallback just in case Fuse misses some obvious ones
        var title = card.dataset.title || card.querySelector('.archive-title, .card-title')?.textContent.toLowerCase() || '';
        var fallbackMatch = title.includes(q) || tags.includes(q);
        
        var matchQ = matchedUrls.has(url) || fallbackMatch;
        var matchT = !t || tags.includes(t);
        
        card.style.display = (matchQ && matchT) ? '' : 'none';
      });
    } else {
      // No search query, just filter by tag and normal substring
      cards.forEach(function(card) {
        var title = card.dataset.title || card.querySelector('.archive-title, .card-title')?.textContent.toLowerCase() || '';
        var tags = card.dataset.tags || '';
        var matchQ = !q || title.includes(q) || tags.includes(q);
        var matchT = !t || tags.includes(t);
        
        card.style.display = (matchQ && matchT) ? '' : 'none';
      });
      // If we need to load fuse because they typed something before focus
      if (q && !fuse) loadSearchIndex();
    }

    // Hide empty archive groups if present
    document.querySelectorAll('.md3-archive-group').forEach(function(group) {
      var items = group.querySelectorAll('.archive-post-item');
      if (items.length > 0) {
        var visibleItems = Array.from(items).filter(item => item.style.display !== 'none');
        group.style.display = visibleItems.length === 0 ? 'none' : '';
      }
    });
  };

  searchInput.addEventListener('input', window.filterPosts);
});
