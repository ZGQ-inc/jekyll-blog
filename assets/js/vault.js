/**
 * ZGQ Blog Vault & Access Control Module
 * End-to-End Build-Time Encryption, Web Crypto AES-256-GCM, Zero-Knowledge PBKDF2 Challenge,
 * Material Design 3 Integration, 180-Day Challenge Session & 30-Day Bot Token Management.
 */

(function () {
  'use strict';

  function getVaultSalt() {
    var el = document.getElementById('vaultData');
    return (el && el.getAttribute('data-salt')) || '';
  }
  var VAULT_PBKDF2_ITERATIONS = 100000;
  var STORAGE_KEY = 'zgq_vault_auth';
  var COOKIE_NAME = 'zgq_vault_auth';
  var THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  var ONE_HUNDRED_EIGHTY_DAYS_MS = 180 * 24 * 60 * 60 * 1000;

  /* ==========================================================================
     Cookie & LocalStorage Helpers
     ========================================================================== */

  function setCookie(name, value, days) {
    var expires = '';
    if (days) {
      var date = new Date();
      date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
      expires = '; expires=' + date.toUTCString();
    }
    document.cookie = name + '=' + encodeURIComponent(value) + expires + '; path=/; SameSite=Lax';
  }

  function getCookie(name) {
    var nameEQ = name + '=';
    var ca = document.cookie.split(';');
    for (var i = 0; i < ca.length; i++) {
      var c = ca[i];
      while (c.charAt(0) === ' ') c = c.substring(1, c.length);
      if (c.indexOf(nameEQ) === 0) return decodeURIComponent(c.substring(nameEQ.length, c.length));
    }
    return null;
  }

  function deleteCookie(name) {
    document.cookie = name + '=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT; SameSite=Lax';
  }

  function triggerVaultUnlocked() {
    document.documentElement.classList.add('vault-unlocked');
    window.dispatchEvent(new CustomEvent('vaultUnlocked'));
  }

  function saveAuthData(keyHex, expiresAt) {
    var exp = expiresAt || (Date.now() + ONE_HUNDRED_EIGHTY_DAYS_MS);
    var data = {
      key: keyHex,
      expires: exp
    };
    var jsonStr = JSON.stringify(data);
    try {
      localStorage.setItem(STORAGE_KEY, jsonStr);
    } catch (e) {}
    var days = Math.max(1, Math.ceil((exp - Date.now()) / (24 * 60 * 60 * 1000)));
    setCookie(COOKIE_NAME, jsonStr, days);
    triggerVaultUnlocked();
    return data;
  }

  window.isVaultUnlocked = function() {
    var data = loadAuthData();
    return !!(data && data.key && (!data.expires || Date.now() < data.expires));
  };

  function loadAuthData() {
    var data = null;
    try {
      var local = localStorage.getItem(STORAGE_KEY);
      if (local) data = JSON.parse(local);
    } catch (e) {}

    if (!data) {
      var c = getCookie(COOKIE_NAME);
      if (c) {
        try {
          data = JSON.parse(c);
        } catch (e) {}
      }
    }

    if (data && data.expires) {
      if (Date.now() > data.expires) {
        clearAuthData();
        return null;
      }
      return data;
    }
    return null;
  }

  function clearAuthData() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
    deleteCookie(COOKIE_NAME);
  }

  /* ==========================================================================
     Crypto Utilities (Web Crypto API)
     ========================================================================== */

  function hexToBytes(hex) {
    var bytes = new Uint8Array(hex.length / 2);
    for (var i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
  }

  function bytesToHex(bytes) {
    return Array.from(bytes).map(function (b) {
      return b.toString(16).padStart(2, '0');
    }).join('');
  }

  function base64ToBytes(base64) {
    var binStr = window.atob(base64);
    var bytes = new Uint8Array(binStr.length);
    for (var i = 0; i < binStr.length; i++) {
      bytes[i] = binStr.charCodeAt(i);
    }
    return bytes;
  }

  function base64UrlDecode(str) {
    var base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    return decodeURIComponent(escape(window.atob(base64)));
  }

  async function deriveKeyFromAnswers(answersString) {
    var enc = new TextEncoder();
    var keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      enc.encode(answersString),
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );

    var derivedBits = await window.crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: enc.encode(getVaultSalt()),
        iterations: VAULT_PBKDF2_ITERATIONS,
        hash: 'SHA-256'
      },
      keyMaterial,
      256
    );

    return bytesToHex(new Uint8Array(derivedBits));
  }

  async function decryptVaultPayload(ivHex, cipherBase64, keyHex) {
    var keyBytes = hexToBytes(keyHex);
    var ivBytes = hexToBytes(ivHex);
    var cipherBytes = base64ToBytes(cipherBase64);

    var cryptoKey = await window.crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    var decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: ivBytes
      },
      cryptoKey,
      cipherBytes
    );

    var dec = new TextDecoder('utf-8');
    return dec.decode(decryptedBuffer);
  }

  /* ==========================================================================
     Hash & Query Token Parser (Method 1: Telegram Bot Token)
     ========================================================================== */

  function processUrlHashToken() {
    var rawParam = window.location.hash || window.location.search || window._initialHash || '';
    if (!rawParam || rawParam.indexOf('access_token=') === -1) {
      return null;
    }

    var match = rawParam.match(/access_token=([^&#]+)/);
    if (!match) return null;

    var tokenStr = match[1];
    var keyHex = null;
    var expiresAt = Date.now() + THIRTY_DAYS_MS;

    try {
      // Format 1: Base64URL-encoded JSON { k: keyHex, exp: timestamp, ... }
      if (tokenStr.indexOf('.') !== -1 || tokenStr.length > 64) {
        var decoded = base64UrlDecode(tokenStr);
        var parsed = JSON.parse(decoded);
        if (parsed.k) keyHex = parsed.k;
        else if (parsed.key) keyHex = parsed.key;
        if (parsed.exp) expiresAt = parsed.exp;
      } else if (tokenStr.length === 64) {
        // Format 2: Direct 64-char hex key
        keyHex = tokenStr;
      }
    } catch (e) {
      // Fallback: Check if 64-char hex
      if (tokenStr.length === 64) keyHex = tokenStr;
    }

    if (keyHex) {
      saveAuthData(keyHex, expiresAt);
      // Clean URL search & hash smoothly without reloading
      if (history.replaceState) {
        var cleanSearch = window.location.search.replace(/[?&]access_token=[^&#]+/, '').replace(/^&/, '?');
        if (cleanSearch === '?') cleanSearch = '';
        history.replaceState(null, null, window.location.pathname + cleanSearch);
      }
      return keyHex;
    }
    return null;
  }

  /* ==========================================================================
     Restricted Post Decryption & Lock Screen Flow
     ========================================================================= */

  async function tryUnlockPage(keyHex) {
    var vaultDataEl = document.getElementById('vaultData');
    var lockScreenEl = document.getElementById('vaultLockScreen');
    var decryptedEl = document.getElementById('vaultDecryptedContent');

    if (!vaultDataEl || !decryptedEl) return false;

    var ivHex = vaultDataEl.getAttribute('data-iv');
    var cipher = vaultDataEl.getAttribute('data-cipher');

    if (!ivHex || !cipher) return false;

    try {
      var html = await decryptVaultPayload(ivHex, cipher, keyHex);
      decryptedEl.innerHTML = html;
      decryptedEl.style.display = 'block';
      decryptedEl.classList.add('vault-unlocked-content');

      if (lockScreenEl) {
        lockScreenEl.style.display = 'none';
      }

      // Re-trigger syntax highlighting / MathJax if needed
      if (window.MathJax && window.MathJax.typesetPromise) {
        window.MathJax.typesetPromise([decryptedEl]).catch(function () {});
      }

      // Show comment card and discussions
      var discussCard = document.getElementById('tgDiscussCard');
      if (discussCard) discussCard.style.display = 'flex';

      var commentsSection = document.getElementById('commentsSection');
      if (commentsSection) commentsSection.style.display = 'block';

      if (typeof window.loadTgComments === 'function') {
        window.loadTgComments(false);
      }

      return true;
    } catch (e) {
      console.warn('[Vault] Decryption failed with key:', e);
      return false;
    }
  }

  /* ==========================================================================
     Cloudflare Turnstile Verification
     ========================================================================== */

  var turnstileToken = null;
  var turnstileWidgetId = null;

  function initTurnstile() {
    var container = document.getElementById('vaultTurnstile');
    if (!container) return;

    var sitekey = container.getAttribute('data-sitekey') || '1x00000000000000000000AA';
    var isDark = document.documentElement.getAttribute('data-theme') !== 'light';

    function renderWidget() {
      if (window.turnstile && typeof window.turnstile.render === 'function') {
        try {
          container.innerHTML = '';
          turnstileWidgetId = window.turnstile.render(container, {
            sitekey: sitekey,
            theme: isDark ? 'dark' : 'light',
            callback: function (token) {
              turnstileToken = token;
              var errorBanner = document.getElementById('vaultErrorBanner');
              if (errorBanner) errorBanner.style.display = 'none';
            },
            'expired-callback': function () {
              turnstileToken = null;
            },
            'error-callback': function () {
              turnstileToken = null;
            }
          });
        } catch (e) {
          console.warn('[Vault] Turnstile render error:', e);
        }
      } else {
        setTimeout(renderWidget, 250);
      }
    }

    renderWidget();

    document.addEventListener('themechange', function (e) {
      if (window.turnstile && turnstileWidgetId !== null) {
        var darkNow = (e.detail && typeof e.detail.isDark === 'boolean')
          ? e.detail.isDark
          : (document.documentElement.getAttribute('data-theme') !== 'light');
        try {
          window.turnstile.reset(turnstileWidgetId);
          turnstileToken = null;
          container.innerHTML = '';
          turnstileWidgetId = window.turnstile.render(container, {
            sitekey: sitekey,
            theme: darkNow ? 'dark' : 'light',
            callback: function (token) {
              turnstileToken = token;
            }
          });
        } catch (err) {}
      }
    });
  }

  function setupChallengeForm() {
    var form = document.getElementById('vaultChallengeForm');
    var submitBtn = document.getElementById('vaultSubmitBtn');
    var errorBanner = document.getElementById('vaultErrorBanner');
    var card = document.querySelector('.vault-card');

    if (!form || !submitBtn) return;

    submitBtn.addEventListener('click', async function (e) {
      e.preventDefault();

      if (errorBanner) errorBanner.style.display = 'none';

      // 1. Verify Cloudflare Turnstile token to prevent automated brute-forcing
      if (!turnstileToken) {
        if (errorBanner) {
          errorBanner.innerHTML = '<span class="material-symbols-outlined">verified_user</span><span>请先完成 Cloudflare Turnstile 人机安全验证后再提交答案。</span>';
          errorBanner.style.display = 'flex';
        }
        if (card) {
          card.classList.remove('shake');
          void card.offsetWidth;
          card.classList.add('shake');
        }
        return;
      }

      var answers = [];
      var isComplete = true;

      for (var i = 1; i <= 10; i++) {
        var input = document.getElementById('vault_q' + i);
        var val = input ? input.value.trim() : '';
        if (!val) {
          isComplete = false;
          if (input) input.focus();
          break;
        }
        answers.push(val);
      }

      if (!isComplete) {
        if (errorBanner) {
          errorBanner.innerHTML = '<span class="material-symbols-outlined">error</span><span>请先填写全部 10 道题目后再进行校验。</span>';
          errorBanner.style.display = 'flex';
        }
        if (card) {
          card.classList.remove('shake');
          void card.offsetWidth;
          card.classList.add('shake');
        }
        return;
      }

      submitBtn.disabled = true;
      var originalText = submitBtn.textContent;
      submitBtn.innerHTML = '<span class="md3-circular-progress" style="width:18px;height:18px;margin-right:8px;vertical-align:middle;display:inline-block;"></span> 零知识计算中...';

      try {
        var combinedString = answers.join(':');
        var derivedKeyHex = await deriveKeyFromAnswers(combinedString);

        var success = await tryUnlockPage(derivedKeyHex);
        if (success) {
          saveAuthData(derivedKeyHex, Date.now() + ONE_HUNDRED_EIGHTY_DAYS_MS);
          if (window.showToast) {
            window.showToast('挑战成功！解密密钥已派生，文章已解锁（180 天长效有效）');
          }
        } else {
          throw new Error('Verification failed');
        }
      } catch (err) {
        // Reset Turnstile on failed attempt to prevent rapid brute-forcing
        if (window.turnstile && turnstileWidgetId !== null) {
          try {
            window.turnstile.reset(turnstileWidgetId);
            turnstileToken = null;
          } catch (te) {}
        }

        if (errorBanner) {
          errorBanner.innerHTML = '<span class="material-symbols-outlined">gpp_bad</span><span>哈希校验不匹配，答案有误，请重新检查解答。</span>';
          errorBanner.style.display = 'flex';
        }
        if (card) {
          card.classList.remove('shake');
          void card.offsetWidth;
          card.classList.add('shake');
        }
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    });
  }

  /* ==========================================================================
     About Page Status Badge
     ========================================================================== */

  function updateAboutPageStatus() {
    var container = document.getElementById('vaultAboutStatus');
    if (!container) return;

    var auth = loadAuthData();

    if (auth && auth.key) {
      var remainingMs = auth.expires - Date.now();
      var days = Math.max(0, Math.floor(remainingMs / (1000 * 60 * 60 * 24)));
      var hours = Math.max(0, Math.floor((remainingMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)));

      container.innerHTML =
        '<div class="vault-status-card unlocked">' +
          '<span class="material-symbols-outlined status-icon">lock_open</span>' +
          '<div class="status-info">' +
            '<div class="status-title">🛡️ 受限文章已解锁</div>' +
            '<p class="status-desc">本地授权有效，剩余时间：<strong>' + days + ' 天 ' + hours + ' 小时</strong>（网页答题解锁享 180 天长效访问，Bot 凭证享 30 天访问）</p>' +
          '</div>' +
          '<button class="action-btn btn-tonal" id="vaultRevokeBtn" style="flex-shrink:0;">' +
            '<span class="material-symbols-outlined" style="font-size:18px">lock</span>' +
            '重新锁定' +
          '</button>' +
        '</div>';

      var revokeBtn = document.getElementById('vaultRevokeBtn');
      if (revokeBtn) {
        revokeBtn.addEventListener('click', function () {
          clearAuthData();
          if (window.showToast) window.showToast('受限文章授权已撤销');
          updateAboutPageStatus();
        });
      }
    } else {
      container.innerHTML =
        '<div class="vault-status-card">' +
          '<span class="material-symbols-outlined status-icon" style="color:var(--md-sys-color-outline);background:var(--md-sys-color-surface-variant);">lock</span>' +
          '<div class="status-info">' +
            '<div class="status-title">🔒 受限文章未解锁</div>' +
            '<p class="status-desc">部分专业与高技术敏感文章处于端到端加密状态，需解答技术挑战或通过验证后方可阅读。</p>' +
          '</div>' +
        '</div>';
    }
  }

  /* ==========================================================================
     Main Initialization Lifecycle
     ========================================================================== */

  document.addEventListener('DOMContentLoaded', async function () {
    // 1. Check for URL Hash Token (#access_token=...)
    var tokenKeyHex = processUrlHashToken();

    // 3. Load stored authorization
    var auth = loadAuthData();
    var effectiveKeyHex = tokenKeyHex || (auth ? auth.key : null);
    if (effectiveKeyHex) {
      triggerVaultUnlocked();
    }

    // 4. If on a restricted post page:
    var vaultDataEl = document.getElementById('vaultData');
    if (vaultDataEl) {
      var unlocked = false;
      if (effectiveKeyHex) {
        unlocked = await tryUnlockPage(effectiveKeyHex);
      }

      if (!unlocked) {
        // Show challenge lock screen
        var lockScreen = document.getElementById('vaultLockScreen');
        if (lockScreen) lockScreen.style.display = 'flex';
        setupChallengeForm();
        initTurnstile();
      }
    }

    // 5. If on About page:
    updateAboutPageStatus();
  });
})();
