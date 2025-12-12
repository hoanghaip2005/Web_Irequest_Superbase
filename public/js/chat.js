// Chat functionality
let currentChatId = null;
let currentChatType = null;
let ws = null;
let selectedMembers = []; // Array of user IDs
let selectedMembersData = {}; // Object to store user data {id: {name, email, etc}}
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
function loadChat(chatId, chatType, event) {
  currentChatId = chatId;
  currentChatType = chatType;

  console.log('Loading chat:', chatId, chatType);

  // Update active state in chat list
  document.querySelectorAll('.chat-item').forEach((item) => {
    item.classList.remove('active');
  });

  // Add active class to clicked item
  if (event) {
    const chatItem = event.currentTarget || event.target.closest('.chat-item');
    chatItem?.classList.add('active');
  }

  // Update URL without reload
  const url = new URL(window.location);
  url.searchParams.set('chat', chatId);
  url.searchParams.set('type', chatType);
  window.history.pushState({}, '', url);

  // Load chat content dynamically
  if (chatType === 'direct') {
    loadDirectChat(chatId);
  } else if (chatType === 'group') {
    loadGroupChat(chatId);
  }
}

// Load direct chat
async function loadDirectChat(userId) {
  try {
    // Fetch user info and messages
    const response = await fetch(`/chat/api/chat-data?userId=${userId}`);
    const data = await response.json();

    if (!data.success) {
      alert('Không thể tải cuộc trò chuyện');
      return;
    }

    // Update chat content area
    updateChatContent(data.user, data.messages, false);

    // Update sidebar info
    updateChatInfoSidebar(data.user, false);
  } catch (error) {
    console.error('Error loading direct chat:', error);
    alert('Lỗi khi tải cuộc trò chuyện');
  }
}

// Load group chat
async function loadGroupChat(groupId) {
  try {
    console.log('Loading group chat:', groupId);

    // Fetch group info and messages
    const response = await fetch(`/chat/api/group-data?groupId=${groupId}`);
    const data = await response.json();

    if (!data.success) {
      alert(
        'Không thể tải cuộc trò chuyện nhóm: ' +
          (data.message || 'Lỗi không xác định')
      );
      return;
    }

    console.log('Group data loaded:', data);

    // Update chat content area
    updateChatContent(data.group, data.messages, true);

    // Update sidebar info
    updateChatInfoSidebar(data.group, true);
  } catch (error) {
    console.error('Error loading group chat:', error);
    alert('Lỗi khi tải cuộc trò chuyện nhóm: ' + error.message);
  }
}

// Update chat content area
function updateChatContent(user, messages, isGroup) {
  const chatContent = document.getElementById('chatContent');
  if (!chatContent) return;

  // Build chat header
  let headerHtml = `
    <div class="chat-header p-3 border-bottom">
      <div class="d-flex justify-content-between align-items-center">
        <div class="d-flex align-items-center">
  `;

  if (isGroup) {
    headerHtml += `
      <div class="chat-avatar me-3 bg-info">
        <i class="fas fa-users"></i>
      </div>
    `;
  } else {
    if (user.AvatarPath) {
      headerHtml += `<img src="${user.AvatarPath}" class="chat-avatar me-3 rounded-circle" alt="${user.name}">`;
    } else {
      const avatarColor = user.AvatarColor || 'bg-primary';
      const initial = user.name ? user.name.substring(0, 1) : '?';
      headerHtml += `<div class="chat-avatar me-3 ${avatarColor}">${initial}</div>`;
    }
  }

  headerHtml += `
          <div>
            <h6 class="mb-0">${escapeHtml(user.name)}</h6>
            ${isGroup ? `<small class="text-muted">${user.memberCount} thành viên</small>` : `<small class="text-muted">${escapeHtml(user.Email || '')}</small>`}
          </div>
        </div>
        <button class="btn btn-light btn-sm" type="button" onclick="toggleChatInfo()">
          <i class="fas fa-info-circle"></i>
        </button>
      </div>
    </div>
  `;

  // Build messages area
  let messagesHtml = '<div class="chat-messages p-3" id="chatMessages">';

  if (messages && messages.length > 0) {
    messages.forEach((msg) => {
      messagesHtml += buildMessageHtml(msg);
    });
  } else {
    messagesHtml += `
      <div class="text-center py-5">
        <i class="fas fa-comments fa-3x text-muted mb-3"></i>
        <p class="text-muted">Chưa có tin nhắn nào. Bắt đầu cuộc trò chuyện!</p>
      </div>
    `;
  }

  messagesHtml += '</div>';

  // Build input area
  const inputHtml = `
    <div class="chat-input">
      <div id="filePreviewArea" class="file-preview-area d-none">
        <div class="file-preview-container">
          <div id="filePreviewList" class="file-preview-list"></div>
        </div>
      </div>
      <form id="chatForm" onsubmit="sendMessage(event)">
        <div class="d-flex align-items-end gap-2">
          <button type="button" class="btn btn-light btn-icon" onclick="attachFile()" title="Đính kèm file">
            <i class="fas fa-paperclip"></i>
          </button>
          <button type="button" class="btn btn-light btn-icon" onclick="attachImage()" title="Gửi hình ảnh">
            <i class="fas fa-image"></i>
          </button>
          <div class="flex-grow-1">
            <textarea class="form-control" id="messageInput" rows="1"
               placeholder="Nhập tin nhắn..." autocomplete="off"></textarea>
          </div>
          <button type="button" class="btn btn-light btn-icon" onclick="insertEmoji()" title="Chèn emoji">
            <i class="fas fa-smile"></i>
          </button>
          <button type="submit" class="btn btn-primary btn-icon">
            <i class="fas fa-paper-plane"></i>
          </button>
        </div>
        <input type="file" id="fileInput" class="d-none" multiple onchange="handleFileSelect(event)">
        <input type="file" id="imageInput" class="d-none" accept="image/*" multiple onchange="handleImageSelect(event)">
      </form>
      <div id="typingIndicator" class="typing-indicator d-none">
        <small class="text-muted"><i>Đang nhập...</i></small>
      </div>
    </div>
  `;

  // Update the entire chat content
  chatContent.innerHTML = headerHtml + messagesHtml + inputHtml;

  // Scroll to bottom
  scrollToBottom();
}

// Build message HTML
function buildMessageHtml(message) {
  const isMine = message.SenderId === (window.currentUserId || message.isMine);
  const messageClass = isMine ? 'message-sent' : 'message-received';

  let html = `<div class="message ${messageClass}">`;

  if (!isMine) {
    if (message.senderAvatar) {
      html += `<img src="${message.senderAvatar}" class="message-avatar" alt="${message.senderName}">`;
    } else {
      const avatarColor = message.senderColor || 'bg-primary';
      const initial = message.senderName
        ? message.senderName.substring(0, 1)
        : '?';
      html += `<div class="message-avatar ${avatarColor}">${initial}</div>`;
    }
  }

  html += '<div class="message-content">';

  if (!isMine) {
    html += `<div class="message-sender">${escapeHtml(message.senderName)}</div>`;
  }

  const messageText =
    message.Message || message.Content || message.content || '';

  // Handle attachments
  if (message.attachments && message.attachments.length > 0) {
    html += '<div class="message-bubble">';

    // Show message text if exists
    if (messageText) {
      html += `<p class="mb-2">${escapeHtml(messageText)}</p>`;
    }

    // Show attachments
    html += '<div class="message-attachments">';
    message.attachments.forEach((attachment) => {
      const isImage = attachment.type && attachment.type.startsWith('image/');
      const fileIcon = getFileIcon(attachment.type);
      const fileName = attachment.name || attachment.FileName || 'file';
      const fileUrl = attachment.url || attachment.FilePath || '';
      const fileSize = attachment.size || attachment.FileSize || 0;

      if (isImage) {
        html += `
          <div class="image-attachment">
            <a href="${fileUrl}" target="_blank">
              <img src="${fileUrl}" alt="${fileName}" class="img-fluid rounded" style="max-width: 300px; max-height: 300px;">
            </a>
          </div>
        `;
      } else {
        html += `
          <div class="file-attachment">
            <a href="${fileUrl}" target="_blank" class="d-flex align-items-center text-decoration-none">
              <i class="${fileIcon} fa-2x me-2"></i>
              <div>
                <div class="file-name">${escapeHtml(fileName)}</div>
                <div class="file-size text-muted small">${formatFileSize(fileSize)}</div>
              </div>
            </a>
          </div>
        `;
      }
    });
    html += '</div>';
    html += '</div>';
  } else if (messageText) {
    html += `
      <div class="message-bubble">
        <p class="mb-0">${escapeHtml(messageText)}</p>
      </div>
    `;
  }

  html += `
    <div class="message-time">
      ${formatTime(message.CreatedAt || message.timestamp)}
      ${isMine && message.IsRead ? '<i class="fas fa-check-double text-info"></i>' : ''}
      ${isMine && !message.IsRead ? '<i class="fas fa-check"></i>' : ''}
    </div>
  `;

  html += '</div></div>';

  return html;
}

// Helper function to get file icon based on file type
function getFileIcon(fileType) {
  if (!fileType) return 'fas fa-file';

  if (fileType.startsWith('image/')) return 'fas fa-file-image text-primary';
  if (fileType.startsWith('video/')) return 'fas fa-file-video text-danger';
  if (fileType.startsWith('audio/')) return 'fas fa-file-audio text-success';
  if (fileType.includes('pdf')) return 'fas fa-file-pdf text-danger';
  if (fileType.includes('word') || fileType.includes('document'))
    return 'fas fa-file-word text-primary';
  if (fileType.includes('excel') || fileType.includes('spreadsheet'))
    return 'fas fa-file-excel text-success';
  if (fileType.includes('powerpoint') || fileType.includes('presentation'))
    return 'fas fa-file-powerpoint text-warning';
  if (
    fileType.includes('zip') ||
    fileType.includes('rar') ||
    fileType.includes('7z')
  )
    return 'fas fa-file-archive text-warning';
  if (fileType.includes('text')) return 'fas fa-file-alt text-secondary';

  return 'fas fa-file text-secondary';
}

// Helper function to format file size
function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
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
  if (message.Message || message.Content || message.content) {
    html += `
      <div class="message-bubble">
        <p class="mb-0">${escapeHtml(message.Message || message.Content || message.content)}</p>
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
  selectedMembersData[user.id] = user; // Store user data

  renderSelectedMembers();

  document.getElementById('memberSearch').value = '';
  document.getElementById('memberList').innerHTML = '';
}

// Remove member from group
function removeMember(userId) {
  // Convert to string for comparison since HTML attribute passes string
  selectedMembers = selectedMembers.filter(
    (id) => String(id) !== String(userId)
  );
  renderSelectedMembers();
}

// Render selected members
function renderSelectedMembers() {
  const selectedMembersDiv = document.getElementById('selectedMembers');
  selectedMembersDiv.innerHTML = '';

  selectedMembers.forEach((memberId) => {
    const user = selectedMembersData[memberId];
    const userName = user ? user.name : `User ${memberId}`;

    const memberTag = document.createElement('span');
    memberTag.className = 'badge bg-primary me-1 mb-1 p-2';
    memberTag.innerHTML = `
      ${escapeHtml(userName)}
      <i class="fas fa-times ms-1" onclick="removeMember('${memberId}')" style="cursor: pointer;"></i>
    `;
    selectedMembersDiv.appendChild(memberTag);
  });
}

// Create group - handles form submission
function createGroup(event) {
  console.log('🚀 createGroup function called', event);

  // If no event or event is not a form submit event, open the modal instead
  if (!event || !event.target || event.target.tagName !== 'FORM') {
    console.log('📋 Opening modal instead (not a form submit)');
    openCreateGroupModal();
    return false;
  }

  // Prevent form submission FIRST - this is critical!
  if (event && event.preventDefault) {
    event.preventDefault();
    event.stopPropagation();
  }

  console.log('📝 Processing form submission...');

  const groupName = document.getElementById('groupName').value;
  const groupDescription = document.getElementById('groupDescription').value;

  console.log('Form values:', {
    groupName,
    groupDescription,
    selectedMembersCount: selectedMembers.length,
    selectedMembers: selectedMembers,
  });

  // Validate group name
  if (!groupName || !groupName.trim()) {
    alert('Vui lòng nhập tên nhóm');
    return;
  }

  // Validate members
  if (!selectedMembers || selectedMembers.length === 0) {
    alert('Vui lòng thêm ít nhất một thành viên vào nhóm');
    return;
  }

  console.log('Validation passed, sending request...');
  console.log('Creating group with:', {
    name: groupName,
    description: groupDescription,
    members: selectedMembers,
  });

  console.log('📡 Sending fetch request to /chat/create-group...');

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
    .then((res) => {
      console.log('📥 Response received, status:', res.status);
      if (!res.ok) {
        console.error('❌ Response not OK:', res.status, res.statusText);
      }
      return res.json();
    })
    .then((data) => {
      console.log('📦 Response data:', data);
      if (data.success) {
        console.log('✅ Group created successfully, redirecting...');
        const modal = bootstrap.Modal.getInstance(
          document.getElementById('newChatModal')
        );
        if (modal) {
          modal.hide();
        }
        window.location.href = `/chat?chat=${data.groupId}&type=group`;
      } else {
        console.error('❌ Create group failed:', data.message);
        alert('Lỗi: ' + (data.message || 'Không thể tạo nhóm'));
      }
    })
    .catch((err) => {
      console.error('💥 Error creating group:', err);
      alert('Lỗi kết nối: ' + err.message);
    });

  // Prevent any default action
  return false;
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
      // Reset form and selected members when modal opens
      selectedMembers = [];
      selectedMembersData = {};
      document.getElementById('groupName').value = '';
      document.getElementById('groupDescription').value = '';
      document.getElementById('memberSearch').value = '';
      document.getElementById('memberList').innerHTML = '';
      renderSelectedMembers();
      console.log('✅ New chat modal opened, form reset');
    });

    newChatModal.addEventListener('hidden.bs.modal', function () {
      // Clean up when modal is closed
      selectedMembers = [];
      selectedMembersData = {};
      renderSelectedMembers();
      console.log('✅ New chat modal closed, data cleared');
    });
  }

  // Add explicit form submit handler to prevent default behavior
  const newGroupForm = document.getElementById('newGroupForm');
  if (newGroupForm) {
    console.log('✅ Setting up form submit handler');

    newGroupForm.addEventListener('submit', function (e) {
      console.log('🎯 Form submit event triggered via addEventListener');
      e.preventDefault();
      e.stopPropagation();
      createGroup(e);
      return false;
    });

    // Also check if onsubmit attribute exists
    console.log(
      'Form onsubmit attribute:',
      newGroupForm.getAttribute('onsubmit')
    );
  } else {
    console.error('❌ newGroupForm not found!');
  }
});

// ===================================
// CHAT INFO SIDEBAR FUNCTIONS
// ===================================

function toggleChatInfo() {
  const sidebar = document.getElementById('chatInfoSidebar');
  const contentColumn = document.getElementById('chatContentColumn');

  console.log(
    'Toggle sidebar - Current state:',
    sidebar.classList.contains('d-none') ? 'hidden' : 'visible'
  );

  if (sidebar.classList.contains('d-none')) {
    // Show sidebar
    sidebar.classList.remove('d-none');
    sidebar.classList.add('show');
    if (contentColumn) {
      contentColumn.classList.add('sidebar-visible');
    }
    console.log('Sidebar shown');
  } else {
    // Hide sidebar
    sidebar.classList.add('d-none');
    sidebar.classList.remove('show');
    if (contentColumn) {
      contentColumn.classList.remove('sidebar-visible');
    }
    console.log('Sidebar hidden');
  }
}

function toggleInfoSection(sectionId) {
  const section = document.getElementById(sectionId);
  const header = section.previousElementSibling;

  if (section.classList.contains('show')) {
    section.classList.remove('show');
    header.setAttribute('aria-expanded', 'false');
  } else {
    // Close all other sections
    document.querySelectorAll('.info-section-content').forEach((s) => {
      s.classList.remove('show');
      if (s.previousElementSibling) {
        s.previousElementSibling.setAttribute('aria-expanded', 'false');
      }
    });

    section.classList.add('show');
    header.setAttribute('aria-expanded', 'true');
  }
}

function toggleNotifications() {
  // TODO: Implement notification toggle
  alert('Tính năng tắt thông báo sẽ được thêm vào sau');
}

function pinChat() {
  // TODO: Implement pin chat
  alert('Tính năng ghim hội thoại sẽ được thêm vào sau');
}

function openCreateGroupModal() {
  // Open new group chat modal
  const modal = new bootstrap.Modal(document.getElementById('newChatModal'));
  modal.show();

  // Switch to group tab if exists
  const groupTab = document.querySelector('[data-bs-target="#new-group-chat"]');
  if (groupTab) {
    groupTab.click();
  }
}

function clearChatHistory() {
  if (!currentChatId) {
    alert('Vui lòng chọn cuộc trò chuyện');
    return;
  }

  if (confirm('Bạn có chắc chắn muốn xóa toàn bộ lịch sử trò chuyện này?')) {
    fetch(`/chat/clear/${currentChatId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          // Reload chat
          if (currentChatType === 'direct') {
            loadDirectChat(currentChatId);
          } else {
            loadGroupChat(currentChatId);
          }
          alert('Đã xóa lịch sử trò chuyện');
        } else {
          alert('Lỗi: ' + (data.error || 'Không thể xóa lịch sử'));
        }
      })
      .catch((error) => {
        console.error('Error clearing chat:', error);
        alert('Lỗi khi xóa lịch sử trò chuyện');
      });
  }
}

function deleteChat() {
  if (!currentChatId) {
    alert('Vui lòng chọn cuộc trò chuyện');
    return;
  }

  if (currentChatType === 'group') {
    deleteGroup();
    return;
  }

  if (
    confirm(
      'Bạn có chắc chắn muốn xóa cuộc trò chuyện này? Hành động này không thể hoàn tác!'
    )
  ) {
    fetch(`/chat/delete/${currentChatId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          // Reload page to refresh chat list
          window.location.href = '/chat';
        } else {
          alert('Lỗi: ' + (data.error || 'Không thể xóa cuộc trò chuyện'));
        }
      })
      .catch((error) => {
        console.error('Error deleting chat:', error);
        alert('Lỗi khi xóa cuộc trò chuyện');
      });
  }
}

function deleteGroup() {
  if (!currentChatId) {
    alert('Vui lòng chọn nhóm chat');
    return;
  }

  if (
    confirm(
      '⚠️ Bạn có chắc chắn muốn XÓA NHÓM này?\n\n' +
        '• Tất cả tin nhắn trong nhóm sẽ bị xóa\n' +
        '• Tất cả thành viên sẽ bị xóa khỏi nhóm\n' +
        '• Hành động này KHÔNG THỂ hoàn tác!\n\n' +
        'Chỉ người tạo nhóm mới có quyền xóa nhóm.'
    )
  ) {
    console.log('🗑️ Deleting group:', currentChatId);

    fetch(`/chat/delete-group/${currentChatId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          console.log('✅ Group deleted successfully');
          alert('Đã xóa nhóm thành công');
          // Reload page to refresh chat list
          window.location.href = '/chat';
        } else {
          console.error('❌ Delete failed:', data.message);
          alert('Lỗi: ' + (data.message || 'Không thể xóa nhóm'));
        }
      })
      .catch((error) => {
        console.error('💥 Error deleting group:', error);
        alert('Lỗi khi xóa nhóm: ' + error.message);
      });
  }
}

// Update chat info sidebar with user data
function updateChatInfoSidebar(user, isGroup) {
  const sidebar = document.getElementById('chatInfoSidebar');
  if (!sidebar) {
    console.error('Sidebar not found!');
    return;
  }

  console.log('Updating sidebar with user:', user);

  // Load sidebar data after rendering
  const userId = user.UserId || user.id;
  if (userId) {
    loadChatInfoData(userId);
  }

  // Build avatar HTML
  let avatarHtml = '';
  if (isGroup) {
    avatarHtml = `
      <div class="chat-info-avatar mx-auto mb-3 bg-info">
        <i class="fas fa-users fa-3x"></i>
      </div>
    `;
  } else {
    if (user.AvatarPath) {
      avatarHtml = `<img src="${user.AvatarPath}" class="chat-info-avatar mx-auto mb-3" alt="${escapeHtml(user.name)}">`;
    } else {
      const avatarColor = user.AvatarColor || 'bg-primary';
      const initial = user.name ? user.name.substring(0, 1) : '?';
      avatarHtml = `<div class="chat-info-avatar mx-auto mb-3 ${avatarColor}">${initial}</div>`;
    }
  }

  // Update sidebar content
  const sidebarContent = `
    <div class="chat-info-content">
      <!-- User/Group Header -->
      <div class="chat-info-header text-center p-4 border-bottom">
        ${avatarHtml}
        <h5 class="mb-1">${escapeHtml(user.name)}</h5>
        ${isGroup ? `<small class="text-muted">${user.memberCount} thành viên</small>` : `<small class="text-muted">${escapeHtml(user.Email || '')}</small>`}
      </div>

      <!-- Action Buttons -->
      <div class="chat-info-actions p-3 border-bottom">
        <div class="row g-2 text-center">
          <div class="col-4">
            <button class="btn btn-light w-100" onclick="toggleNotifications()">
              <i class="fas fa-bell d-block mb-1"></i>
              <small>Tắt thông báo</small>
            </button>
          </div>
          <div class="col-4">
            <button class="btn btn-light w-100" onclick="pinChat()">
              <i class="fas fa-thumbtack d-block mb-1"></i>
              <small>Ghim hội thoại</small>
            </button>
          </div>
          <div class="col-4">
            <button class="btn btn-light w-100" onclick="openCreateGroupModal()">
              <i class="fas fa-user-plus d-block mb-1"></i>
              <small>Tạo nhóm trò chuyện</small>
            </button>
          </div>
        </div>
      </div>

      <!-- Info Sections -->
      <div class="chat-info-sections">
        <!-- Reminders Section -->
        <div class="info-section border-bottom">
          <div class="info-section-header" onclick="toggleInfoSection('reminders')">
            <div class="d-flex align-items-center">
              <i class="fas fa-clock me-2"></i>
              <span>Danh sách nhắc hẹn</span>
            </div>
            <i class="fas fa-chevron-down"></i>
          </div>
          <div class="info-section-content collapse" id="reminders">
            <p class="text-muted text-center py-3">
              <i class="fas fa-clock fa-2x mb-2 d-block"></i>
              Chưa có nhắc hẹn nào
            </p>
          </div>
        </div>

        <!-- Common Groups Section -->
        <div class="info-section border-bottom">
          <div class="info-section-header" onclick="toggleInfoSection('groups')">
            <div class="d-flex align-items-center">
              <i class="fas fa-users me-2"></i>
              <span id="groupsCountLabel">Nhóm chung</span>
            </div>
            <i class="fas fa-chevron-down"></i>
          </div>
          <div class="info-section-content collapse" id="groups">
            <div id="groupsList" class="p-2">
              <p class="text-muted text-center py-2">Đang tải...</p>
            </div>
          </div>
        </div>

        <!-- Images/Videos Section -->
        <div class="info-section border-bottom">
          <div class="info-section-header" onclick="toggleInfoSection('media')">
            <div class="d-flex align-items-center">
              <i class="fas fa-image me-2"></i>
              <span>Ảnh/Video</span>
            </div>
            <i class="fas fa-chevron-down"></i>
          </div>
          <div class="info-section-content collapse" id="media">
            <div id="mediaList" class="p-2">
              <p class="text-muted text-center py-3">
                <i class="fas fa-image fa-2x mb-2 d-block"></i>
                Chưa có ảnh/video nào
              </p>
            </div>
          </div>
        </div>

        <!-- Files Section -->
        <div class="info-section border-bottom">
          <div class="info-section-header" onclick="toggleInfoSection('files')">
            <div class="d-flex align-items-center">
              <i class="fas fa-file me-2"></i>
              <span>File</span>
            </div>
            <i class="fas fa-chevron-down"></i>
          </div>
          <div class="info-section-content collapse" id="files">
            <div id="filesList" class="p-2">
              <p class="text-muted text-center py-3">
                <i class="fas fa-file fa-2x mb-2 d-block"></i>
                Chưa có file nào
              </p>
            </div>
          </div>
        </div>

        <!-- Links Section -->
        <div class="info-section border-bottom">
          <div class="info-section-header" onclick="toggleInfoSection('links')">
            <div class="d-flex align-items-center">
              <i class="fas fa-link me-2"></i>
              <span>Link</span>
            </div>
            <i class="fas fa-chevron-down"></i>
          </div>
          <div class="info-section-content collapse" id="links">
            <div id="linksList" class="p-2">
              <p class="text-muted text-center py-3">
                <i class="fas fa-link fa-2x mb-2 d-block"></i>
                Chưa có link nào
              </p>
            </div>
          </div>
        </div>

        <!-- Security Settings Section -->
        <div class="info-section">
          <div class="info-section-header" onclick="toggleInfoSection('security')">
            <div class="d-flex align-items-center">
              <i class="fas fa-shield-alt me-2"></i>
              <span>Thiết lập bảo mật</span>
            </div>
            <i class="fas fa-chevron-down"></i>
          </div>
          <div class="info-section-content collapse" id="security">
            <div class="p-3">
              <div class="d-flex align-items-center justify-content-between mb-3">
                <div>
                  <i class="fas fa-user-secret me-2"></i>
                  <span>Tin nhắn tự xóa</span>
                </div>
                <small class="text-muted">Không bao giờ</small>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Bottom Actions -->
      <div class="chat-info-bottom-actions p-3 border-top">
        <button class="btn btn-outline-danger w-100 mb-2" onclick="clearChatHistory()">
          <i class="fas fa-broom me-2"></i>Xóa lịch sử trò chuyện
        </button>
        <button class="btn btn-outline-danger w-100" onclick="deleteChat()">
          <i class="fas fa-trash me-2"></i>Xóa cuộc trò chuyện
        </button>
      </div>
    </div>
  `;

  sidebar.innerHTML = sidebarContent;
}

// Load chat info data (media, files, links, groups)
async function loadChatInfoData(userId) {
  try {
    const response = await fetch(`/chat/api/chat-info/${userId}`);
    const data = await response.json();

    if (!data.success) {
      console.error('Failed to load chat info data');
      return;
    }

    console.log('Chat info data loaded:', data);

    // Update media section
    updateMediaSection(data.media || []);

    // Update files section
    updateFilesSection(data.files || []);

    // Update links section
    updateLinksSection(data.links || []);

    // Update groups section
    updateGroupsSection(data.commonGroups || []);
  } catch (error) {
    console.error('Error loading chat info data:', error);
  }
}

// Update media section
function updateMediaSection(media) {
  const mediaList = document.getElementById('mediaList');
  if (!mediaList) return;

  if (media.length === 0) {
    mediaList.innerHTML = `
      <p class="text-muted text-center py-3">
        <i class="fas fa-image fa-2x mb-2 d-block"></i>
        Chưa có ảnh/video nào
      </p>
    `;
    return;
  }

  let html = '<div class="row g-2">';
  media.forEach((item) => {
    html += `
      <div class="col-4">
        <a href="${item.FilePath}" target="_blank" class="d-block">
          <img src="${item.FilePath}" class="img-fluid rounded" style="aspect-ratio: 1; object-fit: cover;">
        </a>
      </div>
    `;
  });
  html += '</div>';
  mediaList.innerHTML = html;
}

// Update files section
function updateFilesSection(files) {
  const filesList = document.getElementById('filesList');
  if (!filesList) return;

  if (files.length === 0) {
    filesList.innerHTML = `
      <p class="text-muted text-center py-3">
        <i class="fas fa-file fa-2x mb-2 d-block"></i>
        Chưa có file nào
      </p>
    `;
    return;
  }

  let html = '<div class="list-group list-group-flush">';
  files.forEach((file) => {
    const fileSize = formatFileSize(file.FileSize);
    const fileIcon = getFileIcon(file.FileType);
    html += `
      <a href="${file.FilePath}" target="_blank" class="list-group-item list-group-item-action d-flex align-items-center">
        <i class="${fileIcon} me-3 text-primary"></i>
        <div class="flex-grow-1">
          <div class="fw-semibold small">${escapeHtml(file.FileName)}</div>
          <small class="text-muted">${fileSize}</small>
        </div>
      </a>
    `;
  });
  html += '</div>';
  filesList.innerHTML = html;
}

// Update links section
function updateLinksSection(links) {
  const linksList = document.getElementById('linksList');
  if (!linksList) return;

  if (links.length === 0) {
    linksList.innerHTML = `
      <p class="text-muted text-center py-3">
        <i class="fas fa-link fa-2x mb-2 d-block"></i>
        Chưa có link nào
      </p>
    `;
    return;
  }

  let html = '<div class="list-group list-group-flush">';
  links.forEach((link) => {
    html += `
      <a href="${link.URL}" target="_blank" class="list-group-item list-group-item-action">
        <div class="d-flex align-items-center">
          <i class="fas fa-external-link-alt me-3 text-info"></i>
          <div class="flex-grow-1">
            <div class="small text-truncate">${escapeHtml(link.Title || link.URL)}</div>
            <small class="text-muted text-truncate d-block">${escapeHtml(link.URL)}</small>
          </div>
        </div>
      </a>
    `;
  });
  html += '</div>';
  linksList.innerHTML = html;
}

// Update groups section
function updateGroupsSection(groups) {
  const groupsList = document.getElementById('groupsList');
  const groupsCountLabel = document.getElementById('groupsCountLabel');

  if (!groupsList) return;

  if (groups.length === 0) {
    groupsList.innerHTML = `
      <p class="text-muted text-center py-2">Không có nhóm chung</p>
    `;
    if (groupsCountLabel) {
      groupsCountLabel.textContent = 'Nhóm chung';
    }
    return;
  }

  if (groupsCountLabel) {
    groupsCountLabel.textContent = `${groups.length} nhóm chung`;
  }

  let html = '<div class="list-group list-group-flush">';
  groups.forEach((group) => {
    html += `
      <a href="/chat?chat=${group.id}&type=group" class="list-group-item list-group-item-action d-flex align-items-center">
        <div class="chat-avatar me-2 bg-secondary">
          <i class="fas fa-users"></i>
        </div>
        <div class="flex-grow-1">
          <div class="fw-semibold small">${escapeHtml(group.name)}</div>
          <small class="text-muted">${group.memberCount} thành viên</small>
        </div>
      </a>
    `;
  });
  html += '</div>';
  groupsList.innerHTML = html;
}

// Format file size helper
function formatFileSize(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}
