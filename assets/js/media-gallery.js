document.addEventListener('DOMContentLoaded', () => {
  const postContent = document.querySelector('.post-content');
  if (!postContent) return;

  // 1. Group consecutive media elements
  const childNodes = Array.from(postContent.children);
  const mediaGroups = [];
  let currentGroup = [];

  childNodes.forEach(node => {
    let isMediaBlock = false;
    let mediaInNode = [];
    
    if (node.tagName === 'P' || node.tagName === 'FIGURE' || node.tagName === 'DIV') {
      const allChildren = Array.from(node.childNodes);
      const elements = Array.from(node.children);
      
      const hasTextContent = allChildren.some(child => {
        return child.nodeType === Node.TEXT_NODE && child.textContent.trim().length > 0;
      });
      
      const onlyMedia = elements.every(el => {
        if (el.tagName === 'IMG' || el.tagName === 'VIDEO') return true;
        if (el.tagName === 'A' && el.children.length === 1 && (el.children[0].tagName === 'IMG' || el.children[0].tagName === 'VIDEO')) return true;
        if (el.tagName === 'BR') return true;
        return false;
      });

      if (!hasTextContent && elements.length > 0 && onlyMedia) {
        isMediaBlock = true;
        elements.forEach(el => {
          if (el.tagName === 'IMG' || el.tagName === 'VIDEO') mediaInNode.push(el);
          else if (el.tagName === 'A') mediaInNode.push(el.children[0]);
        });
      }
    } else if (node.tagName === 'IMG' || node.tagName === 'VIDEO') {
      isMediaBlock = true;
      mediaInNode.push(node);
    }

    if (isMediaBlock && mediaInNode.length > 0) {
      currentGroup.push({ node, media: mediaInNode });
    } else {
      if (currentGroup.length > 0) {
        mediaGroups.push(currentGroup);
        currentGroup = [];
      }
    }
  });

  if (currentGroup.length > 0) {
    mediaGroups.push(currentGroup);
  }

  // 2. Initialize Lightbox State
  let allMediaArray = []; // Flat array of all media items across the post for next/prev
  let currentLightboxIndex = -1;

  // 3. Process Groups into Galleries
  mediaGroups.forEach(group => {
    let allMediaInGroup = [];
    group.forEach(g => allMediaInGroup.push(...g.media));
    
    // Add all to global media array and assign indices
    allMediaInGroup.forEach(media => {
      media.dataset.lightboxIndex = allMediaArray.length;
      allMediaArray.push(media);
    });

    if (allMediaInGroup.length > 1) {
      // Create Gallery UI
      const gallery = document.createElement('div');
      gallery.className = 'md3-gallery';
      
      const mainView = document.createElement('div');
      mainView.className = 'gallery-main-view';
      
      const thumbnails = document.createElement('div');
      thumbnails.className = 'gallery-thumbnails';
      
      let activeIndex = 0;

      const renderMainView = (index) => {
        mainView.innerHTML = '';
        const srcMedia = allMediaInGroup[index];
        const clone = srcMedia.cloneNode(true);
        clone.removeAttribute('width');
        clone.removeAttribute('height');
        
        // Setup click to open lightbox
        clone.style.cursor = 'zoom-in';
        clone.addEventListener('click', () => {
          openLightbox(parseInt(srcMedia.dataset.lightboxIndex));
        });

        if (clone.tagName === 'VIDEO') {
          clone.controls = true;
        }
        mainView.appendChild(clone);
        
        // Update thumbnails
        Array.from(thumbnails.children).forEach((thumb, i) => {
          if (i === index) thumb.classList.add('active');
          else thumb.classList.remove('active');
        });
      };

      allMediaInGroup.forEach((media, i) => {
        const thumbWrapper = document.createElement('div');
        thumbWrapper.className = 'gallery-thumbnail-item';
        const thumbClone = media.cloneNode(true);
        thumbClone.removeAttribute('controls');
        
        thumbWrapper.appendChild(thumbClone);
        if (media.tagName === 'VIDEO') {
          const playIcon = document.createElement('span');
          playIcon.className = 'material-symbols-outlined play-indicator';
          playIcon.textContent = 'play_circle';
          thumbWrapper.appendChild(playIcon);
        }

        thumbWrapper.addEventListener('click', () => renderMainView(i));
        thumbnails.appendChild(thumbWrapper);
      });

      renderMainView(activeIndex);
      gallery.appendChild(mainView);
      gallery.appendChild(thumbnails);

      // Insert gallery before the first node, then remove original nodes
      const firstNode = group[0].node;
      firstNode.parentNode.insertBefore(gallery, firstNode);
      group.forEach(g => {
        if (g.node.parentNode) g.node.parentNode.removeChild(g.node);
      });
    } else if (allMediaInGroup.length === 1) {
      // Standalone media: just attach lightbox click
      const media = allMediaInGroup[0];
      media.style.cursor = 'zoom-in';
      media.addEventListener('click', (e) => {
        // Prevent default if it's a link
        if (media.parentElement.tagName === 'A') e.preventDefault();
        openLightbox(parseInt(media.dataset.lightboxIndex));
      });
    }
  });

  // 4. Lightbox DOM & Logic
  if (allMediaArray.length === 0) return;

  const lightbox = document.createElement('div');
  lightbox.className = 'md3-lightbox';
  lightbox.innerHTML = `
    <div class="lightbox-backdrop"></div>
    <div class="lightbox-toolbar">
      <button class="icon-btn zoom-out-btn" title="缩小"><span class="material-symbols-outlined">zoom_out</span></button>
      <button class="icon-btn zoom-reset-btn" title="还原"><span class="material-symbols-outlined">search</span></button>
      <button class="icon-btn zoom-in-btn" title="放大"><span class="material-symbols-outlined">zoom_in</span></button>
      <button class="icon-btn close-btn" title="关闭"><span class="material-symbols-outlined">close</span></button>
    </div>
    <button class="nav-btn prev-btn"><span class="material-symbols-outlined">arrow_back_ios_new</span></button>
    <button class="nav-btn next-btn"><span class="material-symbols-outlined">arrow_forward_ios</span></button>
    <div class="lightbox-content-container">
      <div class="lightbox-content-wrapper"></div>
    </div>
  `;
  document.body.appendChild(lightbox);

  const contentWrapper = lightbox.querySelector('.lightbox-content-wrapper');
  const prevBtn = lightbox.querySelector('.prev-btn');
  const nextBtn = lightbox.querySelector('.next-btn');

  let scale = 1;
  let translateX = 0;
  let translateY = 0;
  let isDragging = false;
  let startX = 0;
  let startY = 0;

  function updateTransform() {
    contentWrapper.style.transform = \`translate(\${translateX}px, \${translateY}px) scale(\${scale})\`;
  }

  function resetZoom() {
    scale = 1; translateX = 0; translateY = 0;
    updateTransform();
  }

  function openLightbox(index) {
    if (index < 0 || index >= allMediaArray.length) return;
    currentLightboxIndex = index;
    const media = allMediaArray[index];
    
    contentWrapper.innerHTML = '';
    const clone = media.cloneNode(true);
    clone.removeAttribute('width');
    clone.removeAttribute('height');
    if (clone.tagName === 'VIDEO') clone.controls = true;
    contentWrapper.appendChild(clone);
    
    lightbox.classList.add('open');
    document.body.style.overflow = 'hidden';
    
    prevBtn.style.display = currentLightboxIndex > 0 ? 'flex' : 'none';
    nextBtn.style.display = currentLightboxIndex < allMediaArray.length - 1 ? 'flex' : 'none';
    
    resetZoom();
  }

  function closeLightbox() {
    lightbox.classList.remove('open');
    document.body.style.overflow = '';
    contentWrapper.innerHTML = '';
  }

  lightbox.querySelector('.close-btn').addEventListener('click', closeLightbox);
  lightbox.querySelector('.lightbox-backdrop').addEventListener('click', closeLightbox);
  
  prevBtn.addEventListener('click', () => openLightbox(currentLightboxIndex - 1));
  nextBtn.addEventListener('click', () => openLightbox(currentLightboxIndex + 1));
  
  lightbox.querySelector('.zoom-in-btn').addEventListener('click', () => { scale = Math.min(scale * 1.5, 5); updateTransform(); });
  lightbox.querySelector('.zoom-out-btn').addEventListener('click', () => { scale = Math.max(scale / 1.5, 0.2); updateTransform(); });
  lightbox.querySelector('.zoom-reset-btn').addEventListener('click', resetZoom);

  // Mouse Pan & Zoom
  const container = lightbox.querySelector('.lightbox-content-container');
  
  container.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomIntensity = 0.1;
    const wheel = e.deltaY < 0 ? 1 : -1;
    scale = Math.max(0.2, Math.min(5, scale + (wheel * zoomIntensity * scale)));
    updateTransform();
  }, { passive: false });

  container.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.clientX - translateX;
    startY = e.clientY - translateY;
    container.style.cursor = 'grabbing';
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    translateX = e.clientX - startX;
    translateY = e.clientY - startY;
    updateTransform();
  });

  window.addEventListener('mouseup', () => {
    isDragging = false;
    container.style.cursor = 'default';
  });

  // Touch support for panning
  container.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      isDragging = true;
      startX = e.touches[0].clientX - translateX;
      startY = e.touches[0].clientY - translateY;
    }
  });

  window.addEventListener('touchmove', (e) => {
    if (!isDragging || e.touches.length !== 1) return;
    translateX = e.touches[0].clientX - startX;
    translateY = e.touches[0].clientY - startY;
    updateTransform();
  }, { passive: false });

  window.addEventListener('touchend', () => {
    isDragging = false;
  });

  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    if (!lightbox.classList.contains('open')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') openLightbox(currentLightboxIndex - 1);
    if (e.key === 'ArrowRight') openLightbox(currentLightboxIndex + 1);
  });
});
