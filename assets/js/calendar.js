document.addEventListener('DOMContentLoaded', function() {
  const dialog = document.getElementById('calendarDialog');
  if (!dialog) return;

  const monthDisplay = document.getElementById('calMonthDisplay');
  const daysGrid = document.getElementById('calDaysGrid');
  const prevBtn = document.getElementById('calPrevMonth');
  const nextBtn = document.getElementById('calNextMonth');
  
  let currentYear, currentMonth;
  
  // Collect all dates that have posts on the current page
  const postDates = new Set();
  document.querySelectorAll('.timeline-header').forEach(header => {
    postDates.add(header.dataset.date);
  });

  function initCalendar() {
    const now = new Date();
    currentYear = now.getFullYear();
    currentMonth = now.getMonth();
    
    // If there are posts, start the calendar at the most recent post's month
    if (postDates.size > 0) {
      const sortedDates = Array.from(postDates).sort().reverse();
      const latestDate = new Date(sortedDates[0]);
      if (!isNaN(latestDate)) {
        currentYear = latestDate.getFullYear();
        currentMonth = latestDate.getMonth();
      }
    }
    renderCalendar(false);
  }

  function renderCalendar(animate = true) {
    daysGrid.innerHTML = '';
    monthDisplay.textContent = currentYear + '\u5E74 ' + (currentMonth + 1) + '\u6708';
    
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    
    let currentSlot = 0;
    
    // Empty slots before first day
    for (let i = 0; i < firstDayIndex; i++) {
      const empty = document.createElement('div');
      daysGrid.appendChild(empty);
      currentSlot++;
    }
    
    // Days
    for (let i = 1; i <= daysInMonth; i++) {
      const btn = document.createElement('button');
      btn.className = 'cal-day-btn';
      btn.textContent = i;
      
      const mStr = String(currentMonth + 1).padStart(2, '0');
      const dStr = String(i).padStart(2, '0');
      const dateStr = currentYear + '-' + mStr + '-' + dStr;
      
      if (postDates.has(dateStr)) {
        btn.classList.add('has-posts');
        btn.addEventListener('click', () => jumpToDate(dateStr));
      } else {
        btn.disabled = true;
      }
      
      daysGrid.appendChild(btn);
      currentSlot++;
    }
    
    // Empty slots after last day to reach 42 (6 rows exactly)
    const totalSlots = 42;
    for (let i = currentSlot; i < totalSlots; i++) {
      const empty = document.createElement('div');
      daysGrid.appendChild(empty);
    }
    
    if (animate) {
      daysGrid.animate([
        { opacity: 0, transform: 'scale(0.98)' },
        { opacity: 1, transform: 'scale(1)' }
      ], {
        duration: 250,
        easing: 'cubic-bezier(0.2, 0, 0, 1)'
      });
    }
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
    currentMonth--;
    if (currentMonth < 0) { currentMonth = 11; currentYear--; }
    renderCalendar(true);
  });
  
  nextBtn.addEventListener('click', () => {
    currentMonth++;
    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    renderCalendar(true);
  });

    let swipeStartX = 0;
  let swipeEndX = 0;

  daysGrid.addEventListener('touchstart', (e) => {
    swipeStartX = e.changedTouches[0].screenX;
  }, {passive: true});

  daysGrid.addEventListener('touchend', (e) => {
    swipeEndX = e.changedTouches[0].screenX;
    handleCalendarSwipe();
  }, {passive: true});

  function handleCalendarSwipe() {
    const threshold = 50;
    if (swipeEndX < swipeStartX - threshold) {
      nextBtn.click();
    }
    if (swipeEndX > swipeStartX + threshold) {
      prevBtn.click();
    }
  }

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
    openBtn.addEventListener('click',   let swipeStartX = 0;
  let swipeEndX = 0;

  daysGrid.addEventListener('touchstart', (e) => {
    swipeStartX = e.changedTouches[0].screenX;
  }, {passive: true});

  daysGrid.addEventListener('touchend', (e) => {
    swipeEndX = e.changedTouches[0].screenX;
    handleCalendarSwipe();
  }, {passive: true});

  function handleCalendarSwipe() {
    const threshold = 50;
    if (swipeEndX < swipeStartX - threshold) {
      nextBtn.click();
    }
    if (swipeEndX > swipeStartX + threshold) {
      prevBtn.click();
    }
  }

  window.openCalendarDialog);
  }
  
  document.querySelectorAll('.calendar-jump-trigger').forEach(trigger => {
    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
        let swipeStartX = 0;
  let swipeEndX = 0;

  daysGrid.addEventListener('touchstart', (e) => {
    swipeStartX = e.changedTouches[0].screenX;
  }, {passive: true});

  daysGrid.addEventListener('touchend', (e) => {
    swipeEndX = e.changedTouches[0].screenX;
    handleCalendarSwipe();
  }, {passive: true});

  function handleCalendarSwipe() {
    const threshold = 50;
    if (swipeEndX < swipeStartX - threshold) {
      nextBtn.click();
    }
    if (swipeEndX > swipeStartX + threshold) {
      prevBtn.click();
    }
  }

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

