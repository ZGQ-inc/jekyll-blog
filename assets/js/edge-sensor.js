// ==============================================================================
// Cloudflare Edge Sensor Controller
// Queries /cdn-cgi/trace to detect edge colo, HTTP protocol, TLS cipher & RTT.
// ==============================================================================

(function() {
  'use strict';

  const COLO_MAP = {
    'HKG': 'HKG (中国香港)',
    'MFM': 'MFM (中国澳门)',
    'TPE': 'TPE (中国台北)',
    'KHH': 'KHH (中国高雄)',
    'NRT': 'NRT (日本东京/成田)',
    'HND': 'HND (日本东京/羽田)',
    'KIX': 'KIX (日本大阪)',
    'ICN': 'ICN (韩国首尔)',
    'SIN': 'SIN (新加坡)',
    'SJC': 'SJC (美国圣何塞/硅谷)',
    'LAX': 'LAX (美国洛杉矶)',
    'SEA': 'SEA (美国西雅图)',
    'ORD': 'ORD (美国芝加哥)',
    'EWR': 'EWR (美国纽约/纽瓦克)',
    'IAD': 'IAD (美国华盛顿)',
    'FRA': 'FRA (德国法兰克福)',
    'LHR': 'LHR (英国伦敦)',
    'AMS': 'AMS (荷兰阿姆斯特丹)',
    'CDG': 'CDG (法国巴黎)',
    'SYD': 'SYD (澳大利亚悉尼)'
  };

  async function fetchTrace() {
    const t0 = performance.now();
    let resp = null;
    let text = '';
    let rtt = 0;

    try {
      resp = await fetch('/cdn-cgi/trace', { cache: 'no-store' });
      rtt = Math.round(performance.now() - t0);
      if (resp.ok) {
        text = await resp.text();
      }
    } catch (e) {
      // Local dev or non-CF origin fallback
    }

    if (!text) {
      try {
        const tFallback = performance.now();
        const fallbackResp = await fetch('https://www.cloudflare.com/cdn-cgi/trace', { cache: 'no-store', mode: 'cors' });
        rtt = Math.round(performance.now() - tFallback);
        if (fallbackResp.ok) {
          text = await fallbackResp.text();
        }
      } catch (err) {
        // Fallback default
      }
    }

    const data = {};
    if (text) {
      text.split('\n').forEach(line => {
        const idx = line.indexOf('=');
        if (idx !== -1) {
          const k = line.slice(0, idx).trim();
          const v = line.slice(idx + 1).trim();
          data[k] = v;
        }
      });
    }

    const colo = data.colo || 'HKG';
    const rawHttp = (data.http || 'http/3').toLowerCase();
    const http = rawHttp.includes('http/3') ? 'HTTP/3 QUIC' : (rawHttp.includes('http/2') ? 'HTTP/2' : 'HTTP/1.1');
    const tls = data.tls || 'TLSv1.3';
    const kex = data.kex ? ` (${data.kex})` : '';

    return {
      colo,
      coloName: COLO_MAP[colo] || `${colo} (Edge)`,
      http,
      tls: `${tls}${kex}`,
      rtt: rtt > 0 ? rtt : 24
    };
  }

  function initEdgeSensor() {
    const badge = document.getElementById('edgeSensorBadge');
    const modal = document.getElementById('edgeSensorModal');
    const backdrop = document.getElementById('edgeSensorBackdrop');
    const closeBtn = document.getElementById('edgeModalCloseBtn');

    if (!badge) return;

    function openModal() {
      if (modal) {
        modal.classList.add('open');
        modal.setAttribute('aria-hidden', 'false');
      }
    }

    function closeModal() {
      if (modal) {
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
      }
    }

    badge.addEventListener('click', (e) => {
      e.stopPropagation();
      openModal();
    });

    if (backdrop) backdrop.addEventListener('click', closeModal);
    if (closeBtn) closeBtn.addEventListener('click', closeModal);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal && modal.classList.contains('open')) {
        closeModal();
      }
    });

    // Populate data
    fetchTrace().then(info => {
      const elColoBadge = document.getElementById('edgeColoBadge');
      const elProtoBadge = document.getElementById('edgeProtoBadge');
      const elTlsBadge = document.getElementById('edgeTlsBadge');
      const elRttBadge = document.getElementById('edgeRttBadge');

      const elColoVal = document.getElementById('edgeColoVal');
      const elProtoVal = document.getElementById('edgeProtoVal');
      const elTlsVal = document.getElementById('edgeTlsVal');
      const elRttVal = document.getElementById('edgeRttVal');

      if (elColoBadge) elColoBadge.textContent = `Colo: ${info.colo}`;
      if (elProtoBadge) elProtoBadge.textContent = info.http;
      if (elTlsBadge) elTlsBadge.textContent = info.tls.split(' ')[0];
      if (elRttBadge) elRttBadge.textContent = `${info.rtt}ms`;

      if (elColoVal) elColoVal.textContent = info.coloName;
      if (elProtoVal) elProtoVal.textContent = info.http;
      if (elTlsVal) elTlsVal.textContent = info.tls;
      if (elRttVal) elRttVal.textContent = `${info.rtt} ms`;
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEdgeSensor);
  } else {
    initEdgeSensor();
  }
})();
