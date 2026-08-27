document.addEventListener('DOMContentLoaded', function() {
  const dialog = document.getElementById('calendarDialog');
  if (!dialog) return;

  const monthDisplay = document.getElementById('calMonthDisplay');
  const daysGrid = document.getElementById('calDaysGrid') || document.getElementById('calDaysGridCurrent');
  const prevBtn = document.getElementById('calPrevMonth');
  const nextBtn = document.getElementById('calNextMonth');
  
  let currentYear, currentMonth;
  
  // Collect all dates that have posts on the current page
  const postDates = new Set();
  document.querySelectorAll('.timeline-header').forEach(header => {
    if (header.dataset.date) {
      postDates.add(header.dataset.date);
    }
  });

  function initCalendar() {
    const now = new Date();
    currentYear = now.getFullYear();
    currentMonth = now.getMonth();
    
    if (postDates.size > 0) {
      const sortedDates = Array.from(postDates).sort().reverse();
      const latestDate = new Date(sortedDates[0]);
      if (!isNaN(latestDate.getTime())) {
        currentYear = latestDate.getFullYear();
        currentMonth = latestDate.getMonth();
      }
    }
    renderCalendar(0);
  }

  function renderGrid(gridEl, year, month) {
    if (!gridEl) return;
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

  function renderCalendar(direction = 0) {
    if (monthDisplay) {
      monthDisplay.textContent = currentYear + '年 ' + (currentMonth + 1) + '月';
    }
    
    renderGrid(daysGrid, currentYear, currentMonth);
    
    // Lightweight non-blocking CSS animation for instant visual feedback
    if (direction !== 0 && daysGrid && typeof daysGrid.animate === 'function') {
      daysGrid.animate([
        { transform: `translateX(${direction > 0 ? '14px' : '-14px'})`, opacity: 0.5 },
        { transform: 'translateX(0)', opacity: 1 }
      ], {
        duration: 110,
        easing: 'cubic-bezier(0.2, 0, 0, 1)'
      });
    }
  }

  function changeMonth(delta) {
    currentMonth += delta;
    if (currentMonth < 0) {
      currentMonth = 11;
      currentYear--;
    } else if (currentMonth > 11) {
      currentMonth = 0;
      currentYear++;
    }
    renderCalendar(delta);
  }

  // Instant response to clicks without waiting for animations
  if (prevBtn) {
    prevBtn.addEventListener('click', (e) => {
      e.preventDefault();
      changeMonth(-1);
    });
  }
  
  if (nextBtn) {
    nextBtn.addEventListener('click', (e) => {
      e.preventDefault();
      changeMonth(1);
    });
  }

  // Touch swipe support on mobile
  if (daysGrid && daysGrid.parentElement) {
    let touchStartX = 0;
    let touchStartY = 0;
    
    daysGrid.parentElement.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
      touchStartY = e.changedTouches[0].screenY;
    }, { passive: true });
    
    daysGrid.parentElement.addEventListener('touchend', (e) => {
      const diffX = e.changedTouches[0].screenX - touchStartX;
      const diffY = e.changedTouches[0].screenY - touchStartY;
      if (Math.abs(diffX) > 40 && Math.abs(diffX) > Math.abs(diffY) * 1.5) {
        if (diffX > 0) {
          changeMonth(-1);
        } else {
          changeMonth(1);
        }
      }
    }, { passive: true });
  }

  function jumpToDate(dateStr) {
    closeCalendarDialog();
    
    if (window.blogPagination && window.blogPagination.isInitialized) {
      window.blogPagination.jumpToDate(dateStr);
      return;
    }

    const header = document.querySelector('.timeline-header[data-date="' + dateStr + '"]');
    if (!header) return;

    const timelineBtn = document.querySelector('button[data-view="timeline"]');
    const switchNeeded = timelineBtn && !timelineBtn.classList.contains('active');
    if (switchNeeded) {
      timelineBtn.click();
    }

    // Wait for view layout reflow before scrolling
    setTimeout(() => {
      header.scrollIntoView({ behavior: 'smooth', block: 'start' });
      
      // MD3 Pulse highlight
      header.animate([
        { background: 'color-mix(in srgb, var(--md-sys-color-primary-container) 85%, transparent)', borderRadius: '12px', paddingLeft: '12px' },
        { background: 'transparent', borderRadius: '', paddingLeft: '' }
      ], { duration: 2000, easing: 'cubic-bezier(0.2, 0, 0, 1)' });
    }, switchNeeded ? 120 : 20);
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
    openBtn.addEventListener('click', window.openCalendarDialog);
  }
  
  document.querySelectorAll('.calendar-jump-trigger').forEach(trigger => {
    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.openCalendarDialog();
      const dateParts = trigger.dataset.date ? trigger.dataset.date.split('-') : [];
      if (dateParts.length >= 2) {
        currentYear = parseInt(dateParts[0], 10);
        currentMonth = parseInt(dateParts[1], 10) - 1;
        renderCalendar(0);
      }
    });
  });
});
