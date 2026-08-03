document.addEventListener('DOMContentLoaded', () => {
  const mediaElements = document.querySelectorAll('.article-content video, .article-content audio');

  mediaElements.forEach(media => {
    // Only process elements that natively request controls
    if (!media.hasAttribute('controls')) return;
    if (media.classList.contains('md3-custom-player')) return;

    // Remove native controls
    media.removeAttribute('controls');
    media.classList.add('md3-custom-player');

    const isVideo = media.tagName === 'VIDEO';

    // Create wrapper
    const wrapper = document.createElement('div');
    wrapper.className = `md3-media-player ${isVideo ? 'md3-media-video' : 'md3-media-audio'}`;
    media.parentNode.insertBefore(wrapper, media);
    wrapper.appendChild(media);

    // Create controls container
    const controls = document.createElement('div');
    controls.className = 'media-controls';
    
    // Play/Pause Button
    const playBtn = document.createElement('button');
    playBtn.className = 'media-btn play-btn';
    playBtn.title = '播放';
    playBtn.innerHTML = '<span class="material-symbols-outlined">play_arrow</span>';

    // Time Display
    const timeDisplay = document.createElement('div');
    timeDisplay.className = 'media-time';
    timeDisplay.textContent = '00:00 / 00:00';

    // Progress Bar
    const progressContainer = document.createElement('div');
    progressContainer.className = 'media-progress-container';
    const progressTrack = document.createElement('div');
    progressTrack.className = 'media-progress-track';
    const progressFilled = document.createElement('div');
    progressFilled.className = 'media-progress-filled';
    const progressThumb = document.createElement('div');
    progressThumb.className = 'media-progress-thumb';
    
    progressTrack.appendChild(progressFilled);
    progressTrack.appendChild(progressThumb);
    progressContainer.appendChild(progressTrack);

    // Volume Button
    const volumeBtn = document.createElement('button');
    volumeBtn.className = 'media-btn volume-btn';
    volumeBtn.title = '静音/恢复';
    volumeBtn.innerHTML = '<span class="material-symbols-outlined">volume_up</span>';

    controls.appendChild(playBtn);
    controls.appendChild(progressContainer);
    controls.appendChild(timeDisplay);
    controls.appendChild(volumeBtn);

    // Fullscreen Button (Video only)
    let fullscreenBtn;
    if (isVideo) {
      fullscreenBtn = document.createElement('button');
      fullscreenBtn.className = 'media-btn fullscreen-btn';
      fullscreenBtn.title = '全屏';
      fullscreenBtn.innerHTML = '<span class="material-symbols-outlined">fullscreen</span>';
      controls.appendChild(fullscreenBtn);
    }

    wrapper.appendChild(controls);

    // --- Logic ---

    // Format time function
    const formatTime = (timeInSeconds) => {
      if (isNaN(timeInSeconds)) return '00:00';
      const m = Math.floor(timeInSeconds / 60).toString().padStart(2, '0');
      const s = Math.floor(timeInSeconds % 60).toString().padStart(2, '0');
      return `${m}:${s}`;
    };

    let isPlaying = false;

    const togglePlay = () => {
      if (media.paused) {
        media.play();
      } else {
        media.pause();
      }
    };

    playBtn.addEventListener('click', togglePlay);
    if (isVideo) {
      media.addEventListener('click', togglePlay);
    }

    media.addEventListener('play', () => {
      isPlaying = true;
      playBtn.innerHTML = '<span class="material-symbols-outlined">pause</span>';
      playBtn.title = '暂停';
      wrapper.classList.add('is-playing');
    });

    media.addEventListener('pause', () => {
      isPlaying = false;
      playBtn.innerHTML = '<span class="material-symbols-outlined">play_arrow</span>';
      playBtn.title = '播放';
      wrapper.classList.remove('is-playing');
    });

    // Update time and progress
    media.addEventListener('timeupdate', () => {
      const current = media.currentTime;
      const total = media.duration || 0;
      timeDisplay.textContent = `${formatTime(current)} / ${formatTime(total)}`;
      
      if (total > 0 && !isDraggingProgress) {
        const percent = (current / total) * 100;
        progressFilled.style.width = `${percent}%`;
        progressThumb.style.left = `${percent}%`;
      }
    });

    media.addEventListener('loadedmetadata', () => {
      timeDisplay.textContent = `${formatTime(media.currentTime)} / ${formatTime(media.duration)}`;
    });

    // Scrubbing (Dragging progress)
    let isDraggingProgress = false;

    const updateProgressFromEvent = (e) => {
      const rect = progressTrack.getBoundingClientRect();
      let pos = (e.clientX - rect.left) / rect.width;
      pos = Math.max(0, Math.min(1, pos)); // Clamp between 0 and 1
      
      progressFilled.style.width = `${pos * 100}%`;
      progressThumb.style.left = `${pos * 100}%`;
      
      if (media.duration) {
        media.currentTime = pos * media.duration;
      }
    };

    progressContainer.addEventListener('mousedown', (e) => {
      isDraggingProgress = true;
      updateProgressFromEvent(e);
      document.body.style.userSelect = 'none'; // Prevent text selection
    });

    window.addEventListener('mousemove', (e) => {
      if (isDraggingProgress) {
        updateProgressFromEvent(e);
      }
    });

    window.addEventListener('mouseup', () => {
      if (isDraggingProgress) {
        isDraggingProgress = false;
        document.body.style.userSelect = '';
      }
    });
    
    // Touch support for progress
    progressContainer.addEventListener('touchstart', (e) => {
      isDraggingProgress = true;
      updateProgressFromEvent(e.touches[0]);
    }, { passive: true });
    
    window.addEventListener('touchmove', (e) => {
      if (isDraggingProgress) {
        updateProgressFromEvent(e.touches[0]);
      }
    });
    
    window.addEventListener('touchend', () => {
      isDraggingProgress = false;
    });

    // Volume / Mute
    volumeBtn.addEventListener('click', () => {
      media.muted = !media.muted;
      if (media.muted || media.volume === 0) {
        volumeBtn.innerHTML = '<span class="material-symbols-outlined">volume_off</span>';
      } else {
        volumeBtn.innerHTML = '<span class="material-symbols-outlined">volume_up</span>';
      }
    });

    // Fullscreen
    if (isVideo) {
      const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
          if (wrapper.requestFullscreen) {
            wrapper.requestFullscreen();
          } else if (wrapper.webkitRequestFullscreen) {
            wrapper.webkitRequestFullscreen();
          }
        } else {
          if (document.exitFullscreen) {
            document.exitFullscreen();
          } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
          }
        }
      };

      fullscreenBtn.addEventListener('click', toggleFullscreen);
      media.addEventListener('dblclick', toggleFullscreen);

      document.addEventListener('fullscreenchange', () => {
        if (document.fullscreenElement === wrapper) {
          wrapper.classList.add('is-fullscreen');
          fullscreenBtn.innerHTML = '<span class="material-symbols-outlined">fullscreen_exit</span>';
        } else {
          wrapper.classList.remove('is-fullscreen');
          fullscreenBtn.innerHTML = '<span class="material-symbols-outlined">fullscreen</span>';
        }
      });
    }

    // Auto-hide controls for video when playing and mouse is still
    if (isVideo) {
      let hideControlsTimeout;
      const showControls = () => {
        wrapper.classList.remove('hide-controls');
        clearTimeout(hideControlsTimeout);
        if (isPlaying) {
          hideControlsTimeout = setTimeout(() => {
            wrapper.classList.add('hide-controls');
          }, 2500); // Hide after 2.5s of inactivity
        }
      };

      wrapper.addEventListener('mousemove', showControls);
      wrapper.addEventListener('mouseenter', showControls);
      wrapper.addEventListener('mouseleave', () => {
        if (isPlaying) wrapper.classList.add('hide-controls');
      });
      media.addEventListener('play', showControls);
      media.addEventListener('pause', showControls);
    }
  });
});
