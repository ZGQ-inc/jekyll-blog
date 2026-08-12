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
    renderCalendar();
  }

  function renderCalendar() {
    daysGrid.innerHTML = '';
    monthDisplay.textContent = currentYear + '年 ' + (currentMonth + 1) + '月';
    
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    
    // Empty slots before first day
    for (let i = 0; i < firstDayIndex; i++) {
      const empty = document.createElement('div');
      daysGrid.appendChild(empty);
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
    renderCalendar();
  });
  
  nextBtn.addEventListener('click', () => {
    currentMonth++;
    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    renderCalendar();
  });

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
        renderCalendar();
      }
    });
  });
});
