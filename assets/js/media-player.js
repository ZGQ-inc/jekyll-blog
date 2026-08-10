document.addEventListener('DOMContentLoaded', () => {
  const mediaElements = document.querySelectorAll('.article-content video, .article-content audio');

  mediaElements.forEach(media => {
    if (!media.hasAttribute('controls')) return;
    if (media.classList.contains('md3-custom-player')) return;

    media.removeAttribute('controls');
    media.classList.add('md3-custom-player');

    const isVideo = media.tagName === 'VIDEO';

    const wrapper = document.createElement('div');
    wrapper.className = `md3-media-player ${isVideo ? 'md3-media-video' : 'md3-media-audio'}`;
    media.parentNode.insertBefore(wrapper, media);
    
    let audioBody;
    if (!isVideo) {
      media.style.display = 'none';
      wrapper.appendChild(media);

      const coverUrl = media.dataset.cover;
      const title = media.dataset.title || '未知曲目';
      const artist = media.dataset.artist || '未知艺术家';
      const album = media.dataset.album || '';

      const coverDiv = document.createElement('div');
      coverDiv.className = 'audio-cover';
      if (coverUrl) {
        coverDiv.innerHTML = `<img src="${coverUrl}" alt="Cover">`;
      } else {
        coverDiv.innerHTML = `<div class="audio-cover-placeholder"><span class="material-symbols-outlined">music_note</span></div>`;
      }
      wrapper.appendChild(coverDiv);

      audioBody = document.createElement('div');
      audioBody.className = 'audio-body';

      const headerDiv = document.createElement('div');
      headerDiv.className = 'audio-header';
      headerDiv.innerHTML = `
        <div class="audio-title">${title}</div>
        <div class="audio-artist">${artist}${album ? ' · ' + album : ''}</div>
      `;
      audioBody.appendChild(headerDiv);
      wrapper.appendChild(audioBody);
    } else {
      wrapper.appendChild(media);
    }

    const controls = document.createElement('div');
    controls.className = 'media-controls';
    
    const playBtn = document.createElement('button');
    playBtn.className = 'media-btn play-btn';
    playBtn.title = '播放';
    playBtn.innerHTML = '<span class="material-symbols-outlined">play_arrow</span>';

    const timeDisplay = document.createElement('div');
    timeDisplay.className = 'media-time';
    timeDisplay.textContent = '00:00 / 00:00';

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

    const volumeBtn = document.createElement('button');
    volumeBtn.className = 'media-btn volume-btn';
    volumeBtn.title = '静音/恢复';
    volumeBtn.innerHTML = '<span class="material-symbols-outlined">volume_up</span>';

    controls.appendChild(playBtn);
    controls.appendChild(progressContainer);
    controls.appendChild(timeDisplay);
    controls.appendChild(volumeBtn);

    let fullscreenBtn;
    if (isVideo) {
      fullscreenBtn = document.createElement('button');
      fullscreenBtn.className = 'media-btn fullscreen-btn';
      fullscreenBtn.title = '全屏';
      fullscreenBtn.innerHTML = '<span class="material-symbols-outlined">fullscreen</span>';
      controls.appendChild(fullscreenBtn);
      wrapper.appendChild(controls);
    } else {
      audioBody.appendChild(controls);
    }

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

    volumeBtn.addEventListener('click', () => {
      media.muted = !media.muted;
      if (media.muted || media.volume === 0) {
        volumeBtn.innerHTML = '<span class="material-symbols-outlined">volume_off</span>';
      } else {
        volumeBtn.innerHTML = '<span class="material-symbols-outlined">volume_up</span>';
      }
    });

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

    if (isVideo) {
      let hideControlsTimeout;
      const showControls = () => {
        wrapper.classList.remove('hide-controls');
        clearTimeout(hideControlsTimeout);
        if (isPlaying) {
          hideControlsTimeout = setTimeout(() => {
            wrapper.classList.add('hide-controls');
          }, 2500);
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
