/**
 * Material Design 3 Native Telegram Comments Renderer
 * Connects to Cloudflare Worker /api/posts/:id/comments
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
    let beforeCursor = null;
    let allComments = [];

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

    // Render single comment
    function renderCommentItem(comment) {
      const isOwner = comment.is_channel;
      const avatarContent = comment.avatar
        ? `<img src="${escapeHtml(comment.avatar)}" alt="${escapeHtml(comment.author)}" class="md3-avatar-img" loading="lazy" />`
        : `<span class="md3-avatar-letter">${escapeHtml(comment.initial || comment.author.charAt(0) || 'U')}</span>`;

      const authorBadge = isOwner ? `<span class="md3-owner-chip">博主</span>` : '';
      const replyLink = comment.id && tgPostUrl ? `${tgPostUrl}?comment=${encodeURIComponent(comment.id)}` : tgPostUrl;

      // Reply-to snippet
      let replyHtml = '';
      if (comment.reply_to) {
        replyHtml = `
          <div class="md3-reply-quote" data-reply-id="${escapeHtml(comment.reply_to.reply_id)}">
            <div class="md3-reply-quote-bar"></div>
            <div class="md3-reply-quote-content">
              <span class="md3-reply-quote-author">${escapeHtml(comment.reply_to.author)}</span>
              <span class="md3-reply-quote-text">${escapeHtml(comment.reply_to.text)}</span>
            </div>
          </div>
        `;
      }

      // Media attachments
      let mediaHtml = '';
      if (comment.media && comment.media.length > 0) {
        mediaHtml = '<div class="md3-comment-media-list">';
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
        <div class="md3-comment-item ${isOwner ? 'is-owner' : ''}" id="tg-msg-${escapeHtml(comment.id)}">
          <div class="md3-comment-avatar-wrap">
            <a href="${escapeHtml(comment.author_url || '#')}" target="_blank" rel="noopener noreferrer" class="md3-comment-avatar ${escapeHtml(comment.bg_class || 'bgcolor5')}">
              ${avatarContent}
            </a>
          </div>
          <div class="md3-comment-body">
            <div class="md3-comment-header-row">
              <a href="${escapeHtml(comment.author_url || '#')}" target="_blank" rel="noopener noreferrer" class="md3-comment-author-name">
                ${escapeHtml(comment.author)}
              </a>
              ${authorBadge}
              <time class="md3-comment-time" datetime="${escapeHtml(comment.datetime)}" title="${escapeHtml(comment.datetime)}">
                ${formatDate(comment.datetime) || escapeHtml(comment.time)}
              </time>
            </div>
            
            <div class="md3-comment-bubble">
              ${replyHtml}
              ${textHtml ? `<div class="md3-comment-text">${textHtml}</div>` : ''}
              ${mediaHtml}
            </div>

            <div class="md3-comment-actions">
              <a href="${escapeHtml(replyLink)}" target="_blank" rel="noopener noreferrer" class="md3-reply-btn" title="在 Telegram 中回复此条消息">
                <span class="material-symbols-outlined">reply</span>
                <span>回复</span>
              </a>
            </div>
          </div>
        </div>
      `;
    }

    // Render full comments component
    function renderComponent(data, prepend = false) {
      if (!prepend) {
        allComments = data.comments || [];
      } else {
        allComments = (data.comments || []).concat(allComments);
      }

      tgPostUrl = data.tg_post_url || `https://t.me/${channelName}`;
      beforeCursor = data.before_cursor;

      // Update header badge count
      const countEl = document.getElementById('comments-count-badge');
      if (countEl) {
        countEl.textContent = data.count > 0 ? `${data.count} 条讨论` : '0 条讨论';
        countEl.style.display = 'inline-flex';
      }

      // Update header discuss button
      const topDiscussBtn = document.getElementById('topDiscussBtn');
      if (topDiscussBtn) {
        topDiscussBtn.href = tgPostUrl;
        topDiscussBtn.style.display = 'inline-flex';
      }

      let html = '';

      // Load more button (if there are earlier comments)
      if (data.has_more && beforeCursor) {
        html += `
          <div class="md3-load-more-wrap">
            <button class="md3-load-more-btn" id="loadMoreCommentsBtn" data-before="${escapeHtml(beforeCursor)}">
              <span class="material-symbols-outlined">history</span>
              <span>加载更早的历史评论</span>
            </button>
          </div>
        `;
      }

      // Comments stream
      if (allComments.length === 0) {
        html += `
          <div class="md3-comments-empty">
            <span class="material-symbols-outlined">chat_bubble_outline</span>
            <p>暂无讨论，点击下方按钮发表第一条评论</p>
          </div>
        `;
      } else {
        html += '<div class="md3-comments-stream">';
        allComments.forEach(c => {
          html += renderCommentItem(c);
        });
        html += '</div>';
      }

      // Bottom CTA bar
      html += `
        <div class="md3-comment-cta-bar">
          <div class="md3-cta-icon-wrap">
            <span class="material-symbols-outlined">edit_note</span>
          </div>
          <div class="md3-cta-text">
            <h4>参与话题讨论</h4>
            <p>在 Telegram 频道中发送回复，将自动同步展示于博客评论区</p>
          </div>
          <a href="${escapeHtml(tgPostUrl)}" target="_blank" rel="noopener noreferrer" class="md3-cta-btn">
            <span class="material-symbols-outlined">send</span>
            <span>发表回复</span>
          </a>
        </div>
      `;

      container.innerHTML = html;

      // Attach Reply quote scroll-to listener
      container.querySelectorAll('.md3-reply-quote').forEach(quoteEl => {
        quoteEl.addEventListener('click', (e) => {
          e.preventDefault();
          const targetId = quoteEl.getAttribute('data-reply-id');
          if (targetId) {
            const targetEl = document.getElementById(`tg-msg-${targetId}`);
            if (targetEl) {
              targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
              targetEl.classList.add('is-highlighted');
              setTimeout(() => targetEl.classList.remove('is-highlighted'), 2000);
            }
          }
        });
      });

      // Attach Load More listener
      const loadMoreBtn = document.getElementById('loadMoreCommentsBtn');
      if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', () => {
          const cursor = loadMoreBtn.getAttribute('data-before');
          if (!cursor) return;
          loadMoreBtn.disabled = true;
          loadMoreBtn.innerHTML = '<div class="md3-mini-spinner"></div><span>正在加载历史消息...</span>';
          fetchComments(cursor, true);
        });
      }
    }

    // Fetch comments API
    function fetchComments(before = null, prepend = false) {
      let url = `${apiUrl}/api/posts/${encodeURIComponent(postId)}/comments`;
      if (before) {
        url += `?before=${encodeURIComponent(before)}`;
      }

      fetch(url)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data && data.ok) {
            renderComponent(data, prepend);
          } else if (channelName) {
            container.innerHTML = `
              <div class="md3-comments-empty">
                <span class="material-symbols-outlined">forum</span>
                <p>本文尚未开启 Telegram 讨论组，您可以在 Telegram 频道中参与互动。</p>
                <a href="https://t.me/${escapeHtml(channelName)}" target="_blank" class="md3-cta-btn" style="margin-top:12px;">
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
              <button class="md3-load-more-btn" onclick="location.reload()" style="margin-top:12px;">
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