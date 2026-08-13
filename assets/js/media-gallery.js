document.addEventListener('DOMContentLoaded', () => {
  const postContent = document.querySelector('.article-content');
  if (!postContent) return;

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
        if (el.tagName === 'IMG') return true;
        if (el.tagName === 'A' && el.children.length === 1 && (el.children[0].tagName === 'IMG')) return true;
        if (el.tagName === 'BR') return true;
        return false;
      });

      if (!hasTextContent && elements.length > 0 && onlyMedia) {
        isMediaBlock = true;
        elements.forEach(el => {
          if (el.tagName === 'IMG') mediaInNode.push(el);
          else if (el.tagName === 'A') mediaInNode.push(el.children[0]);
        });
      }
    } else if (node.tagName === 'IMG') {
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

  let allMediaArray = [];
  let currentLightboxIndex = -1;

  mediaGroups.forEach(group => {
    let allMediaInGroup = [];
    group.forEach(g => allMediaInGroup.push(...g.media));
    
    allMediaInGroup.forEach(media => {
      media.dataset.lightboxIndex = allMediaArray.length;
      allMediaArray.push(media);
    });

    if (allMediaInGroup.length > 1) {
      const gallery = document.createElement('div');
      gallery.className = 'md3-gallery';
      
      const mainView = document.createElement('div');
      mainView.className = 'gallery-main-view';
      
      const thumbnails = document.createElement('div');
      thumbnails.className = 'gallery-thumbnails';
      
      let activeIndex = 0;

      // Populate mainView with all images
      allMediaInGroup.forEach((media, i) => {
        const clone = media.cloneNode(true);
        clone.removeAttribute('width');
        clone.removeAttribute('height');
        clone.style.cursor = 'zoom-in';
        clone.addEventListener('click', () => {
          openLightbox(parseInt(media.dataset.lightboxIndex));
        });
        mainView.appendChild(clone);
      });

      const updateActiveThumb = (index) => {
        if (activeIndex === index) return;
        activeIndex = index;
        const thumbChildren = Array.from(thumbnails.children);
        thumbChildren.forEach((thumb, i) => {
          if (i === index) thumb.classList.add('active');
          else thumb.classList.remove('active');
        });
        
        if (thumbChildren[index]) {
          thumbChildren[index].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
      };

      // Native scroll snap swipe tracking
      let scrollTimeout;
      mainView.addEventListener('scroll', () => {
        if (scrollTimeout) cancelAnimationFrame(scrollTimeout);
        scrollTimeout = requestAnimationFrame(() => {
          const itemWidth = mainView.clientWidth;
          if (itemWidth === 0) return;
          const index = Math.round(mainView.scrollLeft / itemWidth);
          updateActiveThumb(index);
        });
      }, {passive: true});

      allMediaInGroup.forEach((media, i) => {
        const thumbWrapper = document.createElement('div');
        thumbWrapper.className = 'gallery-thumbnail-item';
        if (i === 0) thumbWrapper.classList.add('active');
        const thumbClone = media.cloneNode(true);
        thumbClone.removeAttribute('controls');
        
        thumbWrapper.appendChild(thumbClone);

        thumbWrapper.addEventListener('click', () => {
          mainView.scrollTo({
            left: i * mainView.clientWidth,
            behavior: 'smooth'
          });
          updateActiveThumb(i);
        });
        thumbnails.appendChild(thumbWrapper);
      });

      thumbnails.addEventListener('wheel', (e) => {
        if (e.deltaY !== 0) {
          e.preventDefault();
          thumbnails.scrollLeft += e.deltaY;
        }
      });

      gallery.appendChild(mainView);
      gallery.appendChild(thumbnails);

      const firstNode = group[0].node;
      firstNode.parentNode.insertBefore(gallery, firstNode);
      group.forEach(g => {
        if (g.node.parentNode) g.node.parentNode.removeChild(g.node);
      });
    } else if (allMediaInGroup.length === 1) {
      const media = allMediaInGroup[0];
      media.style.cursor = 'zoom-in';
      media.addEventListener('click', (e) => {
        if (media.parentElement.tagName === 'A') e.preventDefault();
        openLightbox(parseInt(media.dataset.lightboxIndex));
      });
    }
  });

  document.querySelectorAll('.article-content img').forEach(media => {
    if (media.dataset.lightboxIndex !== undefined) return;
    if (media.closest('a')) return;
    
    media.style.cursor = 'zoom-in';
    media.dataset.lightboxIndex = allMediaArray.length;
    allMediaArray.push(media);
    
    media.addEventListener('click', (e) => {
      e.preventDefault();
      openLightbox(parseInt(media.dataset.lightboxIndex));
    });
  });

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
  let isPanDragging = false;
  let startX = 0;
  let startY = 0;

  function updateTransform() {
    contentWrapper.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
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
    clone.draggable = false;
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
  
  lightbox.querySelector('.lightbox-content-container').addEventListener('click', (e) => {
    if (isPanDragging) return;
    if (e.target.tagName === 'IMG') return;
    
    const wrapper = lightbox.querySelector('.lightbox-content-wrapper');
    if (e.target === e.currentTarget || e.target === wrapper) {
      closeLightbox();
    }
  });
  
  prevBtn.addEventListener('click', () => openLightbox(currentLightboxIndex - 1));
  nextBtn.addEventListener('click', () => openLightbox(currentLightboxIndex + 1));
  
  lightbox.querySelector('.zoom-in-btn').addEventListener('click', () => { scale = Math.min(scale * 1.5, 5); updateTransform(); });
  lightbox.querySelector('.zoom-out-btn').addEventListener('click', () => { scale = Math.max(scale / 1.5, 0.2); updateTransform(); });
  lightbox.querySelector('.zoom-reset-btn').addEventListener('click', resetZoom);

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
    isPanDragging = false;
    startX = e.clientX - translateX;
    startY = e.clientY - translateY;
    container.style.cursor = 'grabbing';
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const newX = e.clientX - startX;
    const newY = e.clientY - startY;
    if (Math.abs(newX - translateX) > 5 || Math.abs(newY - translateY) > 5) {
      isPanDragging = true;
    }
    translateX = newX;
    translateY = newY;
    updateTransform();
  });

  window.addEventListener('mouseup', () => {
    isDragging = false;
    container.style.cursor = 'default';
    setTimeout(() => { isPanDragging = false; }, 0);
  });

  let initialPinchDistance = null;
  let initialScale = 1;

  container.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      isDragging = true;
      isPanDragging = false;
      startX = e.touches[0].clientX - translateX;
      startY = e.touches[0].clientY - translateY;
    } else if (e.touches.length === 2) {
      isDragging = false;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      initialPinchDistance = Math.sqrt(dx * dx + dy * dy);
      initialScale = scale;
    }
  });

  window.addEventListener('touchmove', (e) => {
    if (!lightbox.classList.contains('open')) return;
    
    if (e.touches.length === 1 && isDragging) {
      const newX = e.touches[0].clientX - startX;
      const newY = e.touches[0].clientY - startY;
      if (Math.abs(newX - translateX) > 5 || Math.abs(newY - translateY) > 5) {
        isPanDragging = true;
      }
      translateX = newX;
      translateY = newY;
      updateTransform();
    } else if (e.touches.length === 2 && initialPinchDistance) {
      e.preventDefault();
      isPanDragging = true;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const currentDistance = Math.sqrt(dx * dx + dy * dy);
      const pinchRatio = currentDistance / initialPinchDistance;
      scale = Math.max(0.2, Math.min(5, initialScale * pinchRatio));
      updateTransform();
    }
  }, { passive: false });

  window.addEventListener('touchend', (e) => {
    if (e.touches.length === 0) {
      isDragging = false;
      initialPinchDistance = null;
      setTimeout(() => { isPanDragging = false; }, 0);
    }
  });

  document.addEventListener('keydown', (e) => {
    if (!lightbox.classList.contains('open')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') openLightbox(currentLightboxIndex - 1);
    if (e.key === 'ArrowRight') openLightbox(currentLightboxIndex + 1);
  });
});
