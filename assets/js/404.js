/**
 * 404 Interactive Matrix Digital Rain Engine
 * Material Design 3 Dynamic Color Integration
 * High-DPI support, smooth alpha-decay trails, and cursor interaction
 */
(function () {
  'use strict';

  var canvas = document.getElementById('matrixCanvas');
  if (!canvas) return;

  var ctx = canvas.getContext('2d');
  if (!ctx) return;

  var container = canvas.parentElement;

  // Authentic Matrix Character Set (Katakana, digits, terminal symbols, Latin)
  var chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZﾊﾐﾋｰｳｼﾅﾓﾆｻﾜﾂｵﾘｱﾎﾃﾏｹﾒｴｶｷﾑﾕﾗｾﾈｽﾀﾇﾍ$#&%*+-=<>~ΞΨ';
  var fontSize = 16;
  var columns = 0;
  var drops = [];
  var speeds = [];
  var depths = []; // 0: background dim, 1: foreground fast
  var width = 0;
  var height = 0;
  var animationId = null;
  var isRunning = false;
  var lastFrameTime = 0;
  var targetInterval = 38; // ~26 FPS authentic terminal scan rate

  var mouse = { x: -1000, y: -1000, active: false };

  // Theme color settings
  var colorConfig = {
    isDark: true,
    primary: '#0061a4',
    headColor: '#ffffff',
    trailColor: '#0061a4',
    dimColor: 'rgba(0, 97, 164, 0.35)',
    glowColor: '#0061a4',
    fadeAlpha: 0.12
  };

  function updateColors() {
    try {
      var computed = window.getComputedStyle(document.documentElement);
      var primary = computed.getPropertyValue('--md-sys-color-primary').trim();
      var isDark = document.documentElement.getAttribute('data-theme') === 'dark' ||
        (!document.documentElement.getAttribute('data-theme') &&
          window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);

      if (!primary) {
        primary = isDark ? '#9ecaff' : '#0061a4';
      }

      colorConfig.isDark = isDark;
      colorConfig.primary = primary;

      if (isDark) {
        colorConfig.headColor = '#ffffff';
        colorConfig.trailColor = primary;
        colorConfig.dimColor = primary;
        colorConfig.glowColor = primary;
        colorConfig.fadeAlpha = 0.11;
      } else {
        colorConfig.headColor = primary;
        colorConfig.trailColor = primary;
        colorConfig.dimColor = primary;
        colorConfig.glowColor = primary;
        colorConfig.fadeAlpha = 0.14;
      }
    } catch (e) {
      // Fallback
    }
  }

  function initRain() {
    var rect = container ? container.getBoundingClientRect() : { width: window.innerWidth, height: window.innerHeight };
    width = Math.ceil(rect.width) || window.innerWidth || 800;
    height = Math.ceil(rect.height) || window.innerHeight || 600;

    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    columns = Math.floor(width / fontSize);
    drops = [];
    speeds = [];
    depths = [];

    for (var i = 0; i < columns; i++) {
      // Random initial negative offsets so rain cascades in organically
      drops[i] = Math.floor(Math.random() * -50);
      var isForeground = Math.random() > 0.55;
      depths[i] = isForeground ? 1 : 0;
      speeds[i] = isForeground ? (0.95 + Math.random() * 0.45) : (0.65 + Math.random() * 0.3);
    }
  }

  function draw() {
    // 1. Transparent trail fade using destination-out
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0, 0, 0, ' + colorConfig.fadeAlpha + ')';
    ctx.fillRect(0, 0, width, height);

    // 2. Draw falling digital rain
    ctx.globalCompositeOperation = 'source-over';
    ctx.font = '600 ' + fontSize + 'px "Roboto Mono", "JetBrains Mono", Consolas, monospace';

    for (var i = 0; i < drops.length; i++) {
      var x = i * fontSize;
      var y = drops[i] * fontSize;

      var char = chars.charAt(Math.floor(Math.random() * chars.length));

      // Check proximity to cursor
      var distToMouse = Math.hypot(x - mouse.x, y - mouse.y);
      var isNearCursor = mouse.active && distToMouse < 90;

      if (y > 0 && y < height + 40) {
        if (isNearCursor) {
          // Cursor Interaction: Energized glow
          ctx.fillStyle = colorConfig.isDark ? '#ffffff' : colorConfig.primary;
          ctx.shadowColor = colorConfig.glowColor;
          ctx.shadowBlur = colorConfig.isDark ? 12 : 6;
          ctx.fillText(char, x, y);
          ctx.shadowBlur = 0;
        } else if (depths[i] === 1) {
          // Foreground Drop: Bright falling head
          ctx.fillStyle = colorConfig.headColor;
          if (colorConfig.isDark) {
            ctx.shadowColor = colorConfig.glowColor;
            ctx.shadowBlur = 8;
          }
          ctx.fillText(char, x, y);
          ctx.shadowBlur = 0;

          // Trailing companion character
          var trailChar = chars.charAt(Math.floor(Math.random() * chars.length));
          ctx.fillStyle = colorConfig.trailColor;
          ctx.globalAlpha = colorConfig.isDark ? 0.85 : 0.7;
          ctx.fillText(trailChar, x, y - fontSize);
          ctx.globalAlpha = 1.0;
        } else {
          // Background Drop: Soft, translucent depth layer
          ctx.fillStyle = colorConfig.dimColor;
          ctx.globalAlpha = colorConfig.isDark ? 0.45 : 0.35;
          ctx.fillText(char, x, y);
          ctx.globalAlpha = 1.0;
        }
      }

      // Reset drop when bottom is reached
      if (y > height && Math.random() > 0.975) {
        drops[i] = 0;
        depths[i] = Math.random() > 0.55 ? 1 : 0;
        speeds[i] = depths[i] === 1 ? (0.95 + Math.random() * 0.45) : (0.65 + Math.random() * 0.3);
      }

      drops[i] += speeds[i];
    }
  }

  function loop(timestamp) {
    if (!isRunning) return;

    if (!timestamp) timestamp = performance.now();
    var elapsed = timestamp - lastFrameTime;

    if (elapsed > targetInterval) {
      lastFrameTime = timestamp - (elapsed % targetInterval);
      draw();
    }

    animationId = requestAnimationFrame(loop);
  }

  function startAnimation() {
    if (isRunning) return;
    isRunning = true;
    lastFrameTime = performance.now();
    animationId = requestAnimationFrame(loop);
  }

  function stopAnimation() {
    isRunning = false;
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  }

  // Pointer Interaction (Scoped to container bounds)
  function handlePointer(clientX, clientY) {
    var rect = canvas.getBoundingClientRect();
    var relX = clientX - rect.left;
    var relY = clientY - rect.top;

    if (relX >= 0 && relX <= rect.width && relY >= 0 && relY <= rect.height) {
      mouse.x = relX;
      mouse.y = relY;
      mouse.active = true;
    } else {
      mouse.active = false;
    }
  }

  window.addEventListener('mousemove', function (e) {
    handlePointer(e.clientX, e.clientY);
  }, { passive: true });

  window.addEventListener('mouseleave', function () {
    mouse.active = false;
  });

  window.addEventListener('touchmove', function (e) {
    if (e.touches && e.touches.length > 0) {
      handlePointer(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, { passive: true });

  window.addEventListener('touchend', function () {
    mouse.active = false;
  });

  // Handle Resize
  var resizeTimer;
  function handleResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      initRain();
    }, 120);
  }

  if (window.ResizeObserver && container) {
    var ro = new ResizeObserver(handleResize);
    ro.observe(container);
  } else {
    window.addEventListener('resize', handleResize);
  }

  // Dynamic Theme Color Observers
  document.addEventListener('themechange', updateColors);

  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', updateColors);
  }

  var mo = new MutationObserver(function (mutations) {
    for (var k = 0; k < mutations.length; k++) {
      if (mutations[k].attributeName === 'data-theme' || mutations[k].attributeName === 'data-color') {
        updateColors();
        break;
      }
    }
  });
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-color'] });

  // Tab Visibility Lifecycle Management
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      stopAnimation();
    } else {
      updateColors();
      startAnimation();
    }
  });

  // Initialize
  updateColors();
  initRain();
  startAnimation();

  // Smooth entrance fade-in
  setTimeout(function () {
    canvas.style.opacity = '1';
  }, 150);

  // Clean-up on unload
  window.addEventListener('pagehide', stopAnimation);
})();
