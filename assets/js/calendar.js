document.addEventListener('DOMContentLoaded', function() {
  const dialog = document.getElementById('calendarDialog');
  if (!dialog) return;

  const monthDisplay = document.getElementById('calMonthDisplay');
  const scrollContainer = document.getElementById('calDaysScroll');
  const prevGrid = document.getElementById('calDaysGridPrev');
  const currGrid = document.getElementById('calDaysGridCurrent');
  const nextGrid = document.getElementById('calDaysGridNext');
  const prevBtn = document.getElementById('calPrevMonth');
  const nextBtn = document.getElementById('calNextMonth');
  
  let currentYear, currentMonth;
  let isUpdatingScroll = false;
  
  // Collect all dates that have posts on the current page
  const postDates = new Set();
  document.querySelectorAll('.timeline-header').forEach(header => {
    postDates.add(header.dataset.date);
  });

  function initCalendar() {
    const now = new Date();
    currentYear = now.getFullYear();
    currentMonth = now.getMonth();
    
    if (postDates.size > 0) {
      const sortedDates = Array.from(postDates).sort().reverse();
      const latestDate = new Date(sortedDates[0]);
      if (!isNaN(latestDate)) {
        currentYear = latestDate.getFullYear();
        currentMonth = latestDate.getMonth();
      }
    }
    renderCalendar();
  }

  function renderGrid(gridEl, year, month) {
    gridEl.innerHTML = '';
    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    let currentSlot = 0;
    for (let i = 0; i < firstDayIndex; i++) {
      gridEl.appendChild(document.createElement('div'));
      currentSlot++;
    }
    
    for (let i = 1; i <= daysInMonth; i++) {
      const btn = document.createElement('button');
      btn.className = 'cal-day-btn';
      btn.textContent = i;
      
      const mStr = String(month + 1).padStart(2, '0');
      const dStr = String(i).padStart(2, '0');
      const dateStr = year + '-' + mStr + '-' + dStr;
      
      if (postDates.has(dateStr)) {
        btn.classList.add('has-posts');
        btn.addEventListener('click', () => jumpToDate(dateStr));
      } else {
        btn.disabled = true;
      }
      gridEl.appendChild(btn);
      currentSlot++;
    }
    
    const totalSlots = 42;
    for (let i = currentSlot; i < totalSlots; i++) {
      gridEl.appendChild(document.createElement('div'));
    }
  }

  function renderCalendar() {
    monthDisplay.textContent = currentYear + '\u5E74 ' + (currentMonth + 1) + '\u6708';
    
    let pY = currentYear, pM = currentMonth - 1;
    if (pM < 0) { pM = 11; pY--; }
    renderGrid(prevGrid, pY, pM);
    
    renderGrid(currGrid, currentYear, currentMonth);
    
    let nY = currentYear, nM = currentMonth + 1;
    if (nM > 11) { nM = 0; nY++; }
    renderGrid(nextGrid, nY, nM);
    
    isUpdatingScroll = true;
    scrollContainer.scrollTo({ left: scrollContainer.clientWidth, behavior: 'instant' });
    setTimeout(() => { isUpdatingScroll = false; }, 50);
  }

  function jumpToDate(dateStr) {
    closeCalendarDialog();
    
    const header = document.querySelector('.timeline-header[data-date="' + dateStr + '"]');
    if (header) {
      // Force switch to timeline view if not active
      const timelineBtn = document.querySelector('button[data-view="timeline"]');
      if (timelineBtn && !timelineBtn.classList.contains('active')) {
        timelineBtn.click();
        
        // Wait for transition before scrolling
        setTimeout(() => {
          header.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Highlight effect
          header.animate([
            { background: 'var(--md-sys-color-surface-variant)' },
            { background: 'transparent' }
          ], { duration: 1500, easing: 'ease-out' });
        }, 250);
      } else {
        header.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }


  prevBtn.addEventListener('click', () => {
    scrollContainer.scrollTo({ left: 0, behavior: 'smooth' });
  });
  
  nextBtn.addEventListener('click', () => {
    scrollContainer.scrollTo({ left: scrollContainer.clientWidth * 2, behavior: 'smooth' });
  });

  let scrollTimeout;
  scrollContainer.addEventListener('scroll', () => {
    if (isUpdatingScroll) return;
    
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      const itemWidth = scrollContainer.clientWidth;
      if (itemWidth === 0) return;
      
      const index = Math.round(scrollContainer.scrollLeft / itemWidth);
      if (index === 0) {
        currentMonth--;
        if (currentMonth < 0) { currentMonth = 11; currentYear--; }
        renderCalendar();
      } else if (index === 2) {
        currentMonth++;
        if (currentMonth > 11) { currentMonth = 0; currentYear++; }
        renderCalendar();
      }
    }, 150);
  }, {passive: true});

  window.openCalendarDialog = function() {
    initCalendar();
    dialog.classList.add('open');
    document.body.style.overflow = 'hidden';
  };

  window.closeCalendarDialog = function() {
    dialog.classList.remove('open');
    document.body.style.overflow = '';
  };

  // Bind trigger buttons
  const openBtn = document.getElementById('openCalendarBtn');
  if (openBtn) {
    openBtn.addEventListener('click', window.openCalendarDialog);
  }
  
  document.querySelectorAll('.calendar-jump-trigger').forEach(trigger => {
    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.openCalendarDialog();
      // Optionally could jump to that month immediately
      const dateParts = trigger.dataset.date.split('-');
      if (dateParts.length >= 2) {
        currentYear = parseInt(dateParts[0], 10);
        currentMonth = parseInt(dateParts[1], 10) - 1;
        renderCalendar(false);
      }
    });
  });
});


