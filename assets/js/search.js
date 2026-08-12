document.addEventListener('DOMContentLoaded', function() {
  var searchInput = document.getElementById('searchInput');
  if (!searchInput) return;

  var fuse = null;
  var searchIndex = [];
  var isFetching = false;
  
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
    var cards = document.querySelectorAll('.post-card');
    var q = searchInput.value.trim().toLowerCase();
    var t = window.activeTag ? window.activeTag.toLowerCase() : null;

    if (q && fuse) {
      var results = fuse.search(q);
      var matchedUrls = new Set(results.map(r => r.item.url));
      
      cards.forEach(function(card) {
        var url = card.getAttribute('href');
        var tags = card.dataset.tags || '';
        
        var title = card.dataset.title || card.querySelector('.archive-title, .card-title')?.textContent.toLowerCase() || '';
        var fallbackMatch = title.includes(q) || tags.includes(q);
        
        var matchQ = matchedUrls.has(url) || fallbackMatch;
        var matchT = !t || tags.includes(t);
        
        card.style.display = (matchQ && matchT) ? '' : 'none';
      });
    } else {
      cards.forEach(function(card) {
        var title = card.dataset.title || card.querySelector('.archive-title, .card-title')?.textContent.toLowerCase() || '';
        var tags = card.dataset.tags || '';
        var matchQ = !q || title.includes(q) || tags.includes(q);
        var matchT = !t || tags.includes(t);
        
        card.style.display = (matchQ && matchT) ? '' : 'none';
      });
      if (q && !fuse) loadSearchIndex();
    }

    document.querySelectorAll('.timeline-header').forEach(function(header) {
      var dateStr = header.dataset.date;
      // Find all post-cards that belong to this date
      // We can check the meta-item data-date inside the card
      var cardsForDate = Array.from(document.querySelectorAll('.post-card')).filter(card => {
        var trigger = card.querySelector('.calendar-jump-trigger');
        return trigger && trigger.dataset.date === dateStr;
      });
      if (cardsForDate.length > 0) {
        var visibleItems = cardsForDate.filter(item => item.style.display !== 'none');
        header.style.display = visibleItems.length === 0 ? 'none' : '';
      }
    });
  };

  searchInput.addEventListener('input', window.filterPosts);
});
