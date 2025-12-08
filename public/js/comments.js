/**
 * Comments System for Request Detail Page
 * Enterprise-grade commenting with internal notes, reactions, and @mentions
 */

class CommentsSystem {
  constructor(requestId, options = {}) {
    this.requestId = requestId;
    this.commentsData = [];
    this.canViewInternal = false;
    this.currentUser = options.currentUser || {};
    this.selectedFiles = [];
    this.quillEditor = null;
    this.mentionsAutocomplete = null;

    this.init();
  }

  init() {
    this.initializeQuillEditor();
    this.setupEventListeners();
    this.loadComments();
  }

  initializeQuillEditor() {
    const editorContainer = document.getElementById('comment-editor');
    if (!editorContainer) return;

    // Quill toolbar configuration
    const toolbarOptions = [
      ['bold', 'italic', 'underline', 'strike'],
      ['blockquote', 'code-block'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      [{ header: [1, 2, 3, false] }],
      ['link'],
      ['clean'],
    ];

    this.quillEditor = new Quill('#comment-editor', {
      theme: 'snow',
      modules: {
        toolbar: toolbarOptions,
        keyboard: {
          bindings: {
            // Ctrl+Enter to submit
            custom: {
              key: 13,
              ctrlKey: true,
              handler: () => {
                this.submitComment();
                return false;
              },
            },
          },
        },
      },
      placeholder:
        'Write your comment... (Ctrl+Enter to send, type @ to mention)',
    });

    // Initialize @mentions autocomplete
    if (typeof MentionsAutocomplete !== 'undefined') {
      this.mentionsAutocomplete = new MentionsAutocomplete(this.quillEditor, {
        searchUrl: '/users/api/search',
        minChars: 1,
        maxResults: 10,
      });
    }

    // Handle file paste/drop in editor
    this.quillEditor.root.addEventListener('drop', (e) => {
      e.preventDefault();
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        this.handleFileSelect(files);
      }
    });

    this.quillEditor.root.addEventListener('paste', (e) => {
      const items = (e.clipboardData || e.originalEvent.clipboardData).items;
      for (const item of items) {
        if (item.type.indexOf('image') !== -1) {
          const file = item.getAsFile();
          if (file) {
            this.handleFileSelect([file]);
            e.preventDefault();
          }
        }
      }
    });
  }

  setupEventListeners() {
    // Submit comment
    document
      .getElementById('submit-comment-btn')
      ?.addEventListener('click', () => {
        this.submitComment();
      });

    // File attachment
    document
      .getElementById('attach-file-btn')
      ?.addEventListener('click', () => {
        document.getElementById('comment-file-input')?.click();
      });

    document
      .getElementById('comment-file-input')
      ?.addEventListener('change', (e) => {
        this.handleFileSelect(e.target.files);
      });
  }

  async loadComments() {
    try {
      const response = await fetch(`/requests/${this.requestId}/comments`);
      const data = await response.json();

      if (data.success) {
        this.commentsData = data.comments;
        this.canViewInternal = data.canViewInternal;
        this.renderComments();
        this.updateCommentsCount();
      }
    } catch (error) {
      console.error('Error loading comments:', error);
      this.showError('Error loading comments');
    }
  }

  renderComments() {
    const container = document.getElementById('comments-list');
    if (!container) return;

    if (this.commentsData.length === 0) {
      container.innerHTML = `
                <div class="text-center py-5">
                    <i class="fas fa-comments fa-3x text-muted mb-3"></i>
                    <p class="text-muted">No comments yet. Be the first to comment!</p>
                </div>
            `;
      return;
    }

    const html = this.commentsData
      .map((comment) => this.renderComment(comment))
      .join('');
    container.innerHTML = html;
  }

  renderComment(comment) {
    const isInternal = comment.IsInternal;
    const containerClass = isInternal
      ? 'comment-item comment-internal'
      : 'comment-item';
    const edited = comment.IsEdited
      ? '<span class="badge bg-secondary ms-2">edited</span>'
      : '';
    const avatar = comment.Avatar || '/images/default-avatar.png';

    // Process content - assume it's HTML from Quill or plain text
    let content = comment.Content;

    // If content doesn't have HTML tags, escape and add @mention highlighting
    if (!content.includes('<')) {
      content = this.escapeHtml(content);
      content = content.replace(
        /@(\w+)/g,
        '<span class="mention-highlight">@$1</span>'
      );
    }

    // Check if current user can edit
    const canEdit =
      this.currentUser.Id === comment.UserId || this.currentUser.isAdmin;

    return `
            <div class="${containerClass}" data-comment-id="${comment.CommentId}">
                <div class="d-flex align-items-start">
                    <img src="${avatar}" 
                         alt="${comment.UserName}" 
                         class="rounded-circle me-3" 
                         style="width: 40px; height: 40px; object-fit: cover;">
                    <div class="flex-grow-1">
                        <div class="comment-header">
                            <div>
                                <span class="comment-author">${comment.UserName || comment.Email}</span>
                                <span class="comment-time ms-2">${this.formatDate(comment.CreatedAt)}</span>
                                ${edited}
                                ${isInternal ? '<span class="badge bg-warning ms-2"><i class="fas fa-lock"></i> Internal</span>' : ''}
                            </div>
                            ${canEdit ? this.renderCommentActions(comment.CommentId) : ''}
                        </div>
                        <div class="comment-content">${content}</div>
                        ${this.renderAttachments(comment.Attachments)}
                        ${this.renderReactions(comment.CommentId, comment.Reactions)}
                        <div class="comment-actions mt-2">
                            <button class="btn btn-sm btn-link text-muted p-0 me-3" onclick="commentsSystem.toggleReaction(${comment.CommentId}, 'like')">
                                <i class="far fa-thumbs-up"></i> Like
                            </button>
                            <button class="btn btn-sm btn-link text-muted p-0" onclick="commentsSystem.toggleReaction(${comment.CommentId}, 'helpful')">
                                <i class="far fa-lightbulb"></i> Helpful
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
  }

  renderCommentActions(commentId) {
    return `
            <div class="dropdown">
                <button class="btn btn-sm btn-link text-muted p-0" data-bs-toggle="dropdown">
                    <i class="fas fa-ellipsis-v"></i>
                </button>
                <ul class="dropdown-menu dropdown-menu-end">
                    <li>
                        <a class="dropdown-item" href="#" onclick="commentsSystem.editComment(${commentId}); return false;">
                            <i class="fas fa-edit me-2"></i>Edit
                        </a>
                    </li>
                    <li>
                        <a class="dropdown-item text-danger" href="#" onclick="commentsSystem.deleteComment(${commentId}); return false;">
                            <i class="fas fa-trash me-2"></i>Delete
                        </a>
                    </li>
                </ul>
            </div>
        `;
  }

  renderAttachments(attachments) {
    if (!attachments || attachments.length === 0) return '';

    try {
      const files =
        typeof attachments === 'string' ? JSON.parse(attachments) : attachments;
      if (!Array.isArray(files) || files.length === 0) return '';

      const html = files
        .filter((f) => f.FileName)
        .map((file) => {
          const icon = this.getFileIcon(file.MimeType);
          return `
                    <a href="${file.FilePath}" class="file-attachment" target="_blank">
                        <i class="${icon}"></i> ${file.FileName}
                    </a>
                `;
        })
        .join('');

      return `<div class="mt-2">${html}</div>`;
    } catch (e) {
      return '';
    }
  }

  renderReactions(commentId, reactions) {
    if (!reactions || reactions.length === 0) return '';

    try {
      const reactionsList =
        typeof reactions === 'string' ? JSON.parse(reactions) : reactions;
      if (!Array.isArray(reactionsList) || reactionsList.length === 0)
        return '';

      const html = reactionsList
        .filter((r) => r.ReactionType)
        .map((r) => {
          const emoji = this.getReactionEmoji(r.ReactionType);
          return `
                    <button class="reaction-btn" onclick="commentsSystem.toggleReaction(${commentId}, '${r.ReactionType}')">
                        ${emoji} ${r.Count}
                    </button>
                `;
        })
        .join('');

      return `<div class="comment-reactions mt-2">${html}</div>`;
    } catch (e) {
      return '';
    }
  }

  async submitComment() {
    // Get content from Quill editor
    if (!this.quillEditor) {
      this.showToast('Editor not initialized', 'danger');
      return;
    }

    const content = this.quillEditor.root.innerHTML.trim();
    const textContent = this.quillEditor.getText().trim();

    // Check if there's actual content (not just empty tags)
    if (!textContent || textContent === '') {
      this.showToast('Please enter a comment', 'warning');
      return;
    }

    const isInternal =
      document.getElementById('comment-internal')?.checked || false;

    // Extract mentioned user IDs
    let mentionedUserIds = [];
    if (
      this.mentionsAutocomplete &&
      typeof MentionsAutocomplete !== 'undefined'
    ) {
      mentionedUserIds = MentionsAutocomplete.extractMentionedUserIds(
        this.quillEditor
      );
    }

    const btn = document.getElementById('submit-comment-btn');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';

    try {
      // First, create the comment
      const response = await fetch(`/requests/${this.requestId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content, // Send HTML content from Quill
          isInternal,
          mentionedUserIds, // Include mentioned users
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Upload files if any
        if (this.selectedFiles.length > 0) {
          btn.innerHTML =
            '<i class="fas fa-spinner fa-spin"></i> Uploading files...';
          await this.uploadFiles(data.comment.CommentId);
        }

        // Clear form and reset mentioned users
        this.quillEditor.setContents([]);
        if (this.quillEditor.mentionedUsers) {
          this.quillEditor.mentionedUsers = [];
        }
        if (document.getElementById('comment-internal')) {
          document.getElementById('comment-internal').checked = false;
        }

        // Reload comments
        await this.loadComments();
        this.showToast('Comment added successfully', 'success');
      } else {
        this.showToast(data.message || 'Error adding comment', 'danger');
      }
    } catch (error) {
      console.error('Error submitting comment:', error);
      this.showToast('Error submitting comment', 'danger');
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  }

  async editComment(commentId) {
    const comment = this.commentsData.find((c) => c.CommentId === commentId);
    if (!comment) return;

    const newContent = prompt('Edit comment:', comment.Content);
    if (!newContent || newContent.trim() === '') return;

    try {
      const response = await fetch(`/requests/comments/${commentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: newContent }),
      });

      const data = await response.json();

      if (data.success) {
        await this.loadComments();
        this.showToast('Comment updated successfully', 'success');
      } else {
        this.showToast(data.message || 'Error updating comment', 'danger');
      }
    } catch (error) {
      console.error('Error updating comment:', error);
      this.showToast('Error updating comment', 'danger');
    }
  }

  async deleteComment(commentId) {
    if (!confirm('Are you sure you want to delete this comment?')) return;

    try {
      const response = await fetch(`/requests/comments/${commentId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        await this.loadComments();
        this.showToast('Comment deleted successfully', 'success');
      } else {
        this.showToast(data.message || 'Error deleting comment', 'danger');
      }
    } catch (error) {
      console.error('Error deleting comment:', error);
      this.showToast('Error deleting comment', 'danger');
    }
  }

  async toggleReaction(commentId, reactionType) {
    try {
      const response = await fetch(
        `/requests/comments/${commentId}/reactions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ reactionType }),
        }
      );

      const data = await response.json();

      if (data.success) {
        await this.loadComments();
      }
    } catch (error) {
      console.error('Error toggling reaction:', error);
    }
  }

  updateCommentsCount() {
    const badge = document.getElementById('comments-count');
    if (badge) {
      badge.textContent = this.commentsData.length;
    }
  }

  // Utility methods
  formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  getReactionEmoji(type) {
    const emojis = {
      like: '👍',
      helpful: '💡',
      thumbsup: '👍',
      thumbsdown: '👎',
    };
    return emojis[type] || '👍';
  }

  getFileIcon(mimeType) {
    if (!mimeType) return 'fas fa-file';
    if (mimeType.startsWith('image/')) return 'fas fa-file-image';
    if (mimeType.startsWith('video/')) return 'fas fa-file-video';
    if (mimeType.includes('pdf')) return 'fas fa-file-pdf';
    if (mimeType.includes('word')) return 'fas fa-file-word';
    if (mimeType.includes('excel')) return 'fas fa-file-excel';
    return 'fas fa-file';
  }

  // File handling methods
  handleFileSelect(files) {
    if (!files || files.length === 0) return;

    // Validate file count
    const totalFiles = this.selectedFiles.length + files.length;
    if (totalFiles > 5) {
      this.showToast('Maximum 5 files allowed', 'warning');
      return;
    }

    // Validate file size
    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) {
        this.showToast(`File ${file.name} is too large (max 10MB)`, 'warning');
        return;
      }
    }

    // Add files to selected list
    this.selectedFiles.push(...Array.from(files));
    this.renderFilePreview();
  }

  renderFilePreview() {
    const container = document.getElementById('comment-files-preview');
    if (!container) return;

    if (this.selectedFiles.length === 0) {
      container.innerHTML = '';
      return;
    }

    const html = this.selectedFiles
      .map((file, index) => {
        const icon = this.getFileIcon(file.type);
        const size = this.formatFileSize(file.size);
        const isImage = file.type.startsWith('image/');

        return `
                <div class="file-preview-item" data-index="${index}">
                    ${
                      isImage
                        ? `
                        <img src="${URL.createObjectURL(file)}" alt="${file.name}" class="file-preview-thumb">
                    `
                        : `
                        <i class="${icon} fa-2x text-muted"></i>
                    `
                    }
                    <div class="file-preview-info">
                        <div class="file-preview-name">${file.name}</div>
                        <div class="file-preview-size">${size}</div>
                    </div>
                    <button type="button" class="btn btn-sm btn-danger" onclick="commentsSystem.removeFile(${index})">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
      })
      .join('');

    container.innerHTML = `<div class="file-preview-container">${html}</div>`;
  }

  removeFile(index) {
    this.selectedFiles.splice(index, 1);
    this.renderFilePreview();
  }

  async uploadFiles(commentId) {
    if (this.selectedFiles.length === 0) return [];

    const formData = new FormData();
    this.selectedFiles.forEach((file) => {
      formData.append('files', file);
    });

    try {
      const response = await fetch(
        `/requests/comments/${commentId}/attachments`,
        {
          method: 'POST',
          body: formData,
        }
      );

      const data = await response.json();

      if (data.success) {
        this.selectedFiles = [];
        this.renderFilePreview();
        return data.attachments;
      } else {
        throw new Error(data.message || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      this.showToast('Error uploading files: ' + error.message, 'danger');
      return [];
    }
  }

  async deleteAttachment(attachmentId, element) {
    if (!confirm('Delete this file?')) return;

    try {
      const response = await fetch(
        `/requests/comments/attachments/${attachmentId}`,
        {
          method: 'DELETE',
        }
      );

      const data = await response.json();

      if (data.success) {
        element.remove();
        this.showToast('File deleted', 'success');
      } else {
        this.showToast(data.message || 'Error deleting file', 'danger');
      }
    } catch (error) {
      console.error('Delete attachment error:', error);
      this.showToast('Error deleting file', 'danger');
    }
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  showToast(message, type = 'info') {
    // Simple toast notification (can be enhanced with Bootstrap toast)
    const toast = document.createElement('div');
    toast.className = `alert alert-${type} alert-dismissible fade show position-fixed top-0 end-0 m-3`;
    toast.style.zIndex = '9999';
    toast.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 3000);
  }

  showError(message) {
    const container = document.getElementById('comments-list');
    if (container) {
      container.innerHTML = `<div class="alert alert-danger">${message}</div>`;
    }
  }
}

// Global instance (will be initialized in detail page)
let commentsSystem = null;
