/**
 * Material Design 3 Native Telegram Comments Renderer
 * Built with MD3 elevated card design system
 */

(function () {
  'use strict';

  function initComments() {
    const container = document.getElementById('tg-comments-container');
    if (!container) return;

    const postId = container.getAttribute('data-post-id');
    const apiUrl = container.getAttribute('data-api-url');
    const channelName = container.getAttribute('data-channel-name');

    if (!postId || !apiUrl) return;

    let tgPostUrl = '';

    // Helper: format date
    function formatDate(dateStr) {
      if (!dateStr) return '';
      try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        const now = new Date();
        const diffMs = now - d;
        const diffHours = diffMs / (1000 * 60 * 60);

        if (diffHours < 24 && now.getDate() === d.getDate()) {
          return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        }
        return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      } catch (e) {
        return dateStr;
      }
    }

    // Helper: Escape HTML
    function escapeHtml(str) {
      if (!str) return '';
      return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // Render single comment card
    function renderCommentCard(comment) {
      const isOwner = comment.is_channel;
      const avatarContent = comment.avatar
        ? `<img src="${escapeHtml(comment.avatar)}" alt="${escapeHtml(comment.author)}" class="md3-avatar-img" loading="lazy" />`
        : `<span class="md3-avatar-letter">${escapeHtml(comment.initial || comment.author.charAt(0) || 'U')}</span>`;

      const authorBadge = isOwner ? `<span class="md3-author-chip">博主</span>` : '';
      const authorUrl = escapeHtml(comment.author_url || `https://t.me/${channelName}`);
      const replyLink = comment.id && tgPostUrl ? `${tgPostUrl}?comment=${encodeURIComponent(comment.id)}` : tgPostUrl;

      // Reply-to quote card
      let replyHtml = '';
      if (comment.reply_to && (comment.reply_to.text || comment.reply_to.author)) {
        replyHtml = `
          <div class="md3-reply-quote-card" data-reply-id="${escapeHtml(comment.reply_to.reply_id)}" title="点击定位到被回复的消息">
            <div class="md3-quote-meta">
              <span class="material-symbols-outlined quote-icon">format_quote</span>
              <span class="md3-quote-author">${escapeHtml(comment.reply_to.author)}</span>
            </div>
            ${comment.reply_to.text ? `<div class="md3-quote-text">${escapeHtml(comment.reply_to.text)}</div>` : ''}
          </div>
        `;
      }

      // Media attachments
      let mediaHtml = '';
      if (comment.media && comment.media.length > 0) {
        mediaHtml = '<div class="md3-card-media-grid">';
        comment.media.forEach(m => {
          if (m.type === 'sticker' && m.src) {
            mediaHtml += `<div class="md3-media-sticker"><img src="${escapeHtml(m.src)}" alt="贴纸" loading="lazy" /></div>`;
          } else if (m.type === 'photo' && m.src) {
            mediaHtml += `<div class="md3-media-photo"><img src="${escapeHtml(m.src)}" alt="图片" loading="lazy" /></div>`;
          } else if (m.type === 'audio') {
            mediaHtml += `<div class="md3-media-audio"><span class="material-symbols-outlined">mic</span><span>语音消息</span></div>`;
          }
        });
        mediaHtml += '</div>';
      }

      const textHtml = comment.text_html || escapeHtml(comment.text_plain || '');

      return `
        <div class="md3-comment-card ${isOwner ? 'is-owner-card' : ''}" id="tg-msg-${escapeHtml(comment.id)}">
          <div class="md3-card-header">
            <div class="md3-user-info">
              <a href="${authorUrl}" target="_blank" rel="noopener noreferrer" class="md3-card-avatar ${escapeHtml(comment.bg_class || 'bgcolor5')}">
                ${avatarContent}
              </a>
              <div class="md3-user-meta">
                <div class="md3-name-row">
                  <a href="${authorUrl}" target="_blank" rel="noopener noreferrer" class="md3-card-author">
                    ${escapeHtml(comment.author)}
                  </a>
                  ${authorBadge}
                </div>
                <time class="md3-card-time" datetime="${escapeHtml(comment.datetime)}" title="${escapeHtml(comment.datetime)}">
                  ${formatDate(comment.datetime) || escapeHtml(comment.time)}
                </time>
              </div>
            </div>
            <a href="${escapeHtml(replyLink)}" target="_blank" rel="noopener noreferrer" class="btn-reply" title="在 Telegram 中回复此条消息">
              <span class="material-symbols-outlined">reply</span>
              <span>回复</span>
            </a>
          </div>

          ${replyHtml}

          <div class="md3-card-content">
            ${textHtml ? `<div class="md3-card-text">${textHtml}</div>` : ''}
            ${mediaHtml}
          </div>
        </div>
      `;
    }

    // Render component
    function renderComponent(data) {
      const comments = data.comments || [];
      tgPostUrl = data.tg_post_url || `https://t.me/${channelName}`;

      // Update header badge count
      const countEl = document.getElementById('comments-count-badge');
      if (countEl) {
        countEl.textContent = data.count > 0 ? `${data.count} 条讨论` : '0 条讨论';
        countEl.style.display = 'inline-flex';
      }

      let html = '';

      // Comments list
      if (comments.length === 0) {
        html += `
          <div class="md3-comments-empty">
            <span class="material-symbols-outlined">chat_bubble_outline</span>
            <p>暂无讨论，点击下方按钮发表第一条评论</p>
          </div>
        `;
      } else {
        html += '<div class="md3-comments-list">';
        comments.forEach(c => {
          html += renderCommentCard(c);
        });
        html += '</div>';
      }

      // Bottom CTA banner (MD3 Booking / CTA style)
      html += `
        <div class="md3-comments-cta-card">
          <div class="md3-cta-content">
            <h4>参与话题讨论</h4>
            <p>在 Telegram 频道中发送回复，将自动同步展示于此</p>
          </div>
          <a href="${escapeHtml(tgPostUrl)}" target="_blank" rel="noopener noreferrer" class="btn-booking">
            <span class="material-symbols-outlined">send</span>
            <span>发表回复</span>
          </a>
        </div>
      `;

      container.innerHTML = html;

      // Attach Reply quote scroll-to listener
      container.querySelectorAll('.md3-reply-quote-card').forEach(quoteEl => {
        quoteEl.addEventListener('click', (e) => {
          e.preventDefault();
          const targetId = quoteEl.getAttribute('data-reply-id');
          if (targetId) {
            const targetEl = document.getElementById(`tg-msg-${targetId}`);
            if (targetEl) {
              targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
              targetEl.classList.add('is-highlighted');
              setTimeout(() => targetEl.classList.remove('is-highlighted'), 2200);
            }
          }
        });
      });
    }

    // Fetch comments API
    function fetchComments() {
      const url = `${apiUrl}/api/posts/${encodeURIComponent(postId)}/comments`;

      fetch(url)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data && data.ok) {
            renderComponent(data);
          } else if (channelName) {
            container.innerHTML = `
              <div class="md3-comments-empty">
                <span class="material-symbols-outlined">forum</span>
                <p>本文尚未开启 Telegram 讨论组，您可以在 Telegram 频道中参与互动。</p>
                <a href="https://t.me/${escapeHtml(channelName)}" target="_blank" class="btn-booking" style="margin-top:16px;">
                  <span class="material-symbols-outlined">open_in_new</span>
                  <span>前往频道</span>
                </a>
              </div>
            `;
          }
        })
        .catch(err => {
          console.error('Comments load error:', err);
          container.innerHTML = `
            <div class="md3-comments-empty">
              <span class="material-symbols-outlined">cloud_off</span>
              <p>加载评论区失败，请检查网络连接</p>
              <button class="btn-reply" onclick="location.reload()" style="margin-top:16px;">
                <span class="material-symbols-outlined">refresh</span>
                <span>重试</span>
              </button>
            </div>
          `;
        });
    }

    // Initial fetch
    fetchComments();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initComments);
  } else {
    initComments();
  }
})();