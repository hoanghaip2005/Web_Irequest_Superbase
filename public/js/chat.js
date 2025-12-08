// Chat functionality
let currentChatId = null;
let currentChatType = null;
let ws = null;
let selectedMembers = [];
let attachedFiles = []; // Store attached files before sending

// Initialize WebSocket connection
function initializeWebSocket() {
  // Temporarily disabled - WebSocket server not configured
  console.log('WebSocket disabled - using HTTP polling instead');
  return;
}

// Handle incoming WebSocket messages
function handleWebSocketMessage(data) {
  switch (data.type) {
    case 'new_message':
      appendMessage(data.message);
      updateChatList(data.chatId);
      break;
    case 'typing':
      showTypingIndicator(data.userName);
      break;
    case 'stop_typing':
      hideTypingIndicator();
      break;
    case 'message_read':
      updateMessageReadStatus(data.messageId);
      break;
  }
}

// Load chat
function loadChat(chatId, chatType) {
  currentChatId = chatId;
  currentChatType = chatType;

  // Redirect to chat page with query params
  window.location.href = `/chat?chat=${chatId}&type=${chatType}`;
}

// Send message
function sendMessage(event) {
  event.preventDefault();

  const messageInput = document.getElementById('messageInput');
  const message = messageInput.value.trim();

  console.log('Sending message:', {
    message,
    currentChatId,
    currentChatType,
    attachedFiles,
  });

  if (!message && attachedFiles.length === 0) {
    console.warn('Message and files are empty');
    return;
  }

  if (!currentChatId) {
    console.error('No chat selected');
    alert('Vui lòng chọn cuộc trò chuyện trước khi gửi tin nhắn');
    return;
  }

  // If there are attached files, send with FormData
  if (attachedFiles.length > 0) {
    const formData = new FormData();
    formData.append('chatId', currentChatId);
    formData.append('chatType', currentChatType);
    formData.append('content', message);
    formData.append('timestamp', new Date().toISOString());

    // Append all files
    attachedFiles.forEach((file, index) => {
      formData.append('files', file);
    });

    fetch('/chat/send-message-with-files', {
      method: 'POST',
      body: formData,
    })
      .then((res) => res.json())
      .then((data) => {
        console.log('Message with files sent response:', data);
        if (data.success) {
          messageInput.value = '';
          attachedFiles = [];
          hidePreviewArea();
          appendMessage(data.message);
          scrollToBottom();
        } else {
          console.error('Failed to send message:', data);
          alert(
            'Không thể gửi tin nhắn: ' + (data.message || 'Lỗi không xác định')
          );
        }
      })
      .catch((err) => {
        console.error('Error sending message with files:', err);
        alert('Lỗi khi gửi tin nhắn');
      });
  } else {
    // Send text-only message
    const data = {
      chatId: currentChatId,
      chatType: currentChatType,
      content: message,
      timestamp: new Date().toISOString(),
    };

    fetch('/chat/send-message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
      .then((res) => res.json())
      .then((data) => {
        console.log('Message sent response:', data);
        if (data.success) {
          messageInput.value = '';
          appendMessage(data.message);
          scrollToBottom();
        } else {
          console.error('Failed to send message:', data);
          alert(
            'Không thể gửi tin nhắn: ' + (data.message || 'Lỗi không xác định')
          );
        }
      })
      .catch((err) => {
        console.error('Error sending message:', err);
        alert('Lỗi khi gửi tin nhắn');
      });
  }
}

// Append message to chat
function appendMessage(message) {
  const chatMessages = document.getElementById('chatMessages');
  if (!chatMessages) return;

  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${message.isMine ? 'message-sent' : 'message-received'}`;

  let html = '';

  if (!message.isMine) {
    // Show avatar for received messages
    const avatarColor = message.senderColor || 'bg-primary';
    const avatarInitial = message.senderName
      ? message.senderName.substring(0, 1)
      : '?';

    if (message.senderAvatar) {
      html += `<img src="${message.senderAvatar}" class="message-avatar" alt="${message.senderName}">`;
    } else {
      html += `<div class="message-avatar ${avatarColor}">${avatarInitial}</div>`;
    }
  }

  html += `<div class="message-content">`;

  if (!message.isMine) {
    html += `<div class="message-sender">${escapeHtml(message.senderName)}</div>`;
  }

  // Message text
  if (message.Content || message.content) {
    html += `
      <div class="message-bubble">
        <p class="mb-0">${escapeHtml(message.Content || message.content)}</p>
      </div>
    `;
  }

  // Attachments
  if (message.attachments && message.attachments.length > 0) {
    message.attachments.forEach((attachment) => {
      if (attachment.type === 'image') {
        html += `
          <div class="message-attachment image-attachment">
            <img src="${attachment.url}" alt="${attachment.name}" onclick="viewImage('${attachment.url}')">
          </div>
        `;
      } else {
        html += `
          <div class="message-attachment file-attachment" onclick="downloadFile('${attachment.url}', '${attachment.name}')">
            <div class="attachment-icon">
              <i class="${getFileIcon(attachment.name)}"></i>
            </div>
            <div class="attachment-info">
              <div class="attachment-name">${escapeHtml(attachment.name)}</div>
              <div class="attachment-size">${attachment.size || ''}</div>
            </div>
          </div>
        `;
      }
    });
  }

  // Timestamp
  html += `
    <div class="message-time">
      ${formatTime(message.CreatedAt || message.timestamp)}
      ${message.isMine && message.IsRead ? '<i class="fas fa-check-double text-info"></i>' : ''}
      ${message.isMine && !message.IsRead ? '<i class="fas fa-check"></i>' : ''}
    </div>
  `;

  html += `</div>`;

  messageDiv.innerHTML = html;
  chatMessages.appendChild(messageDiv);
  scrollToBottom();
}

// View image in modal/lightbox
function viewImage(url) {
  // Simple image viewer - you can replace with a proper lightbox library
  window.open(url, '_blank');
}

// Download file
function downloadFile(url, filename) {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.target = '_blank';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Scroll chat to bottom
function scrollToBottom() {
  const chatMessages = document.getElementById('chatMessages');
  if (chatMessages) {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
}

// Search users
function searchUsers(query) {
  // Allow empty query to show all users
  const searchQuery = query || '';

  fetch(`/chat/search-users?q=${encodeURIComponent(searchQuery)}`)
    .then((res) => res.json())
    .then((users) => {
      const userList = document.getElementById('userList');
      userList.innerHTML = '';

      if (users.length === 0) {
        userList.innerHTML =
          '<div class="list-group-item text-muted text-center">Không tìm thấy người dùng</div>';
        return;
      }

      users.forEach((user) => {
        const item = document.createElement('a');
        item.href = '#';
        item.className = 'list-group-item list-group-item-action';

        const avatarColor = user.AvatarColor || 'bg-primary';
        const avatarInitial = user.name ? user.name.substring(0, 1) : '?';
        let avatarHtml = '';

        if (user.AvatarPath) {
          avatarHtml = `<img src="${user.AvatarPath}" class="rounded-circle me-2" style="width: 32px; height: 32px;" alt="${user.name}">`;
        } else {
          avatarHtml = `<div class="chat-avatar ${avatarColor} me-2" style="width: 32px; height: 32px; font-size: 0.875rem;">${avatarInitial}</div>`;
        }

        item.innerHTML = `
          <div class="d-flex align-items-center">
            ${avatarHtml}
            <div>
              <strong>${escapeHtml(user.name)}</strong>
              <br>
              <small class="text-muted">${escapeHtml(user.email)}</small>
            </div>
          </div>
        `;
        item.onclick = (e) => {
          e.preventDefault();
          startDirectChat(user.id);
        };
        userList.appendChild(item);
      });
    })
    .catch((err) => console.error('Error searching users:', err));
}

// Start direct chat
function startDirectChat(userId) {
  console.log('Starting direct chat with user:', userId);

  fetch('/chat/start-direct', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ userId }),
  })
    .then((res) => res.json())
    .then((data) => {
      console.log('Start chat response:', data);

      if (data.success) {
        const modal = bootstrap.Modal.getInstance(
          document.getElementById('newChatModal')
        );
        if (modal) modal.hide();

        // Redirect to chat with the user
        const url = `/chat?chat=${data.chatId}&type=${data.chatType}`;
        console.log('Redirecting to:', url);
        window.location.href = url;
      } else {
        console.error('Failed to start chat:', data.message);
        alert(
          'Không thể bắt đầu cuộc trò chuyện: ' +
            (data.message || 'Lỗi không xác định')
        );
      }
    })
    .catch((err) => {
      console.error('Error starting chat:', err);
      alert('Lỗi kết nối: ' + err.message);
    });
}

// Search members for group
function searchMembers(query) {
  if (query.length < 2) return;

  fetch(`/chat/search-users?q=${encodeURIComponent(query)}`)
    .then((res) => res.json())
    .then((users) => {
      const memberList = document.getElementById('memberList');
      memberList.innerHTML = '';

      users.forEach((user) => {
        if (selectedMembers.includes(user.id)) return;

        const item = document.createElement('a');
        item.href = '#';
        item.className = 'list-group-item list-group-item-action';
        item.innerHTML = `
                    <div class="d-flex align-items-center justify-content-between">
                        <div class="d-flex align-items-center">
                            <div class="chat-avatar me-2" style="width: 32px; height: 32px; font-size: 0.875rem;">
                                ${user.name.substring(0, 1)}
                            </div>
                            <span>${user.name}</span>
                        </div>
                        <button type="button" class="btn btn-sm btn-outline-primary">
                            <i class="fas fa-plus"></i>
                        </button>
                    </div>
                `;
        item.onclick = (e) => {
          e.preventDefault();
          addMember(user);
        };
        memberList.appendChild(item);
      });
    })
    .catch((err) => console.error('Error searching members:', err));
}

// Add member to group
function addMember(user) {
  if (selectedMembers.includes(user.id)) return;

  selectedMembers.push(user.id);

  const selectedMembersDiv = document.getElementById('selectedMembers');
  const memberTag = document.createElement('span');
  memberTag.className = 'badge bg-primary me-1 mb-1';
  memberTag.innerHTML = `
        ${user.name}
        <i class="fas fa-times ms-1" onclick="removeMember('${user.id}')" style="cursor: pointer;"></i>
    `;
  selectedMembersDiv.appendChild(memberTag);

  document.getElementById('memberSearch').value = '';
  document.getElementById('memberList').innerHTML = '';
}

// Remove member from group
function removeMember(userId) {
  selectedMembers = selectedMembers.filter((id) => id !== userId);
  renderSelectedMembers();
}

// Create group
function createGroup(event) {
  event.preventDefault();

  const groupName = document.getElementById('groupName').value;
  const groupDescription = document.getElementById('groupDescription').value;

  if (selectedMembers.length === 0) {
    alert('Vui lòng thêm ít nhất một thành viên');
    return;
  }

  fetch('/chat/create-group', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: groupName,
      description: groupDescription,
      members: selectedMembers,
    }),
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.success) {
        bootstrap.Modal.getInstance(
          document.getElementById('newChatModal')
        ).hide();
        window.location.href = `/chat?id=${data.groupId}&type=group`;
      }
    })
    .catch((err) => console.error('Error creating group:', err));
}

// Attach file
function attachFile() {
  document.getElementById('fileInput').click();
}

// Attach image
function attachImage() {
  document.getElementById('imageInput').click();
}

// Handle file select
function handleFileSelect(event) {
  const files = Array.from(event.target.files);
  if (!files.length) return;

  files.forEach((file) => {
    // Add to attachedFiles array
    attachedFiles.push(file);

    // Show preview
    addFilePreview(file, false);
  });

  // Clear input for next selection
  event.target.value = '';

  // Show preview area
  showPreviewArea();
}

// Handle image select
function handleImageSelect(event) {
  const files = Array.from(event.target.files);
  if (!files.length) return;

  files.forEach((file) => {
    // Add to attachedFiles array
    attachedFiles.push(file);

    // Show preview
    addFilePreview(file, true);
  });

  // Clear input for next selection
  event.target.value = '';

  // Show preview area
  showPreviewArea();
}

// Add file preview to UI
function addFilePreview(file, isImage) {
  const previewList = document.getElementById('filePreviewList');
  const fileIndex = attachedFiles.length - 1;

  const previewItem = document.createElement('div');
  previewItem.className = `file-preview-item ${isImage ? 'image-preview' : ''}`;
  previewItem.dataset.index = fileIndex;

  if (isImage && file.type.startsWith('image/')) {
    // Image preview with thumbnail
    const reader = new FileReader();
    reader.onload = function (e) {
      previewItem.innerHTML = `
        <img src="${e.target.result}" alt="${file.name}">
        <div class="file-info">
          <div class="file-name">${file.name}</div>
          <div class="file-size">${formatFileSize(file.size)}</div>
        </div>
        <button class="file-remove" onclick="removeFile(${fileIndex})">
          <i class="fas fa-times"></i>
        </button>
      `;
    };
    reader.readAsDataURL(file);
  } else {
    // Regular file preview with icon
    const icon = getFileIcon(file.name);
    previewItem.innerHTML = `
      <div class="file-icon">
        <i class="${icon}"></i>
      </div>
      <div class="file-info">
        <div class="file-name">${file.name}</div>
        <div class="file-size">${formatFileSize(file.size)}</div>
      </div>
      <button class="file-remove" onclick="removeFile(${fileIndex})">
        <i class="fas fa-times"></i>
      </button>
    `;
  }

  previewList.appendChild(previewItem);
}

// Remove file from preview
function removeFile(index) {
  // Remove from array
  attachedFiles.splice(index, 1);

  // Remove from UI
  const previewList = document.getElementById('filePreviewList');
  const items = previewList.querySelectorAll('.file-preview-item');
  items[index].remove();

  // Update indices for remaining items
  const remainingItems = previewList.querySelectorAll('.file-preview-item');
  remainingItems.forEach((item, i) => {
    item.dataset.index = i;
    const removeBtn = item.querySelector('.file-remove');
    removeBtn.setAttribute('onclick', `removeFile(${i})`);
  });

  // Hide preview area if no files
  if (attachedFiles.length === 0) {
    hidePreviewArea();
  }
}

// Show preview area
function showPreviewArea() {
  const previewArea = document.getElementById('filePreviewArea');
  previewArea.classList.remove('d-none');
}

// Hide preview area
function hidePreviewArea() {
  const previewArea = document.getElementById('filePreviewArea');
  previewArea.classList.add('d-none');
  document.getElementById('filePreviewList').innerHTML = '';
}

// Format file size
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

// Get file icon based on extension
function getFileIcon(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const iconMap = {
    pdf: 'fas fa-file-pdf',
    doc: 'fas fa-file-word',
    docx: 'fas fa-file-word',
    xls: 'fas fa-file-excel',
    xlsx: 'fas fa-file-excel',
    ppt: 'fas fa-file-powerpoint',
    pptx: 'fas fa-file-powerpoint',
    zip: 'fas fa-file-archive',
    rar: 'fas fa-file-archive',
    txt: 'fas fa-file-alt',
    csv: 'fas fa-file-csv',
  };
  return iconMap[ext] || 'fas fa-file';
}

// Insert emoji
function insertEmoji() {
  // Simple emoji picker - you can integrate a full emoji picker library
  const emojis = [
    '😀',
    '😃',
    '😄',
    '😁',
    '😊',
    '😍',
    '🥰',
    '😘',
    '👍',
    '👏',
    '🎉',
    '❤️',
  ];
  const emoji = emojis[Math.floor(Math.random() * emojis.length)];
  const messageInput = document.getElementById('messageInput');
  messageInput.value += emoji;
  messageInput.focus();
}

// View group info
function viewGroupInfo(groupId) {
  window.location.href = `/chat/group/${groupId}/info`;
}

// Manage members
function manageMembers(groupId) {
  window.location.href = `/chat/group/${groupId}/members`;
}

// Clear chat
function clearChat(chatId) {
  if (confirm('Xóa toàn bộ lịch sử trò chuyện?')) {
    fetch(`/chat/${chatId}/clear`, {
      method: 'DELETE',
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          location.reload();
        }
      })
      .catch((err) => console.error('Error clearing chat:', err));
  }
}

// Delete chat
function deleteChat(chatId) {
  if (confirm('Xóa cuộc trò chuyện này? Thao tác này không thể hoàn tác.')) {
    fetch(`/chat/${chatId}`, {
      method: 'DELETE',
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          window.location.href = '/chat';
        }
      })
      .catch((err) => console.error('Error deleting chat:', err));
  }
}

// Mark messages as read
function markMessagesAsRead(chatId) {
  fetch(`/chat/${chatId}/mark-read`, {
    method: 'POST',
  })
    .then((res) => res.json())
    .catch((err) => console.error('Error marking messages as read:', err));
}

// Show typing indicator
function showTypingIndicator(userName) {
  const indicator = document.getElementById('typingIndicator');
  indicator.innerHTML = `<small class="text-muted"><i>${userName} đang nhập...</i></small>`;
  indicator.classList.remove('d-none');
}

// Hide typing indicator
function hideTypingIndicator() {
  const indicator = document.getElementById('typingIndicator');
  indicator.classList.add('d-none');
}

// Utility functions
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

function formatTime(timestamp) {
  if (!timestamp) return '';

  // Parse timestamp and convert to Vietnam timezone
  const date = new Date(timestamp);
  const now = new Date();

  // Check if date is valid
  if (isNaN(date.getTime())) {
    return timestamp;
  }

  const diff = now - date;

  // Vietnam timezone options
  const vnOptions = { timeZone: 'Asia/Ho_Chi_Minh' };

  // Just now (less than 1 minute)
  if (diff < 60000 && diff >= 0) return 'Vừa xong';

  // Minutes ago
  if (diff < 3600000 && diff >= 0) {
    const minutes = Math.floor(diff / 60000);
    return `${minutes} phút trước`;
  }

  // Hours ago (within 24 hours)
  if (diff < 86400000 && diff >= 0) {
    const hours = Math.floor(diff / 3600000);
    return `${hours} giờ trước`;
  }

  // Today - show time only
  const todayStr = now.toLocaleDateString('en-CA', vnOptions);
  const dateStr = date.toLocaleDateString('en-CA', vnOptions);

  if (dateStr === todayStr) {
    return date.toLocaleTimeString('vi-VN', {
      ...vnOptions,
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  // Yesterday
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toLocaleDateString('en-CA', vnOptions);

  if (dateStr === yesterdayStr) {
    return (
      'Hôm qua ' +
      date.toLocaleTimeString('vi-VN', {
        ...vnOptions,
        hour: '2-digit',
        minute: '2-digit',
      })
    );
  }

  // This year - show date and time without year
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleString('vi-VN', {
      ...vnOptions,
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  // Different year - show full date
  return date.toLocaleString('vi-VN', {
    ...vnOptions,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function () {
  // Get chat info from URL
  const urlParams = new URLSearchParams(window.location.search);
  currentChatId = urlParams.get('chat');
  currentChatType = urlParams.get('type') || 'direct';

  console.log('Chat initialized:', { currentChatId, currentChatType });

  // Initialize WebSocket
  initializeWebSocket();

  // Auto-scroll to bottom on load
  scrollToBottom();

  // Handle typing indicator
  let typingTimer;
  const messageInput = document.getElementById('messageInput');
  if (messageInput) {
    messageInput.addEventListener('keypress', function () {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: 'typing',
            chatId: currentChatId,
          })
        );
      }

      clearTimeout(typingTimer);
      typingTimer = setTimeout(function () {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              type: 'stop_typing',
              chatId: currentChatId,
            })
          );
        }
      }, 1000);
    });
  }

  // Search chats
  const chatSearch = document.getElementById('chatSearch');
  if (chatSearch) {
    chatSearch.addEventListener('keyup', function (e) {
      const query = e.target.value.toLowerCase();
      const chatItems = document.querySelectorAll('.chat-item');

      chatItems.forEach((item) => {
        const name = item.querySelector('h6').textContent.toLowerCase();
        if (name.includes(query)) {
          item.style.display = '';
        } else {
          item.style.display = 'none';
        }
      });
    });
  }

  // Auto-load users when opening new chat modal
  const newChatModal = document.getElementById('newChatModal');
  if (newChatModal) {
    newChatModal.addEventListener('shown.bs.modal', function () {
      // Load all users when modal opens
      searchUsers('');
    });
  }
});
