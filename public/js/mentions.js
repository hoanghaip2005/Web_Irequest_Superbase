/**
 * MentionsAutocomplete - @mentions autocomplete for Quill editor
 * Provides user search and mention insertion functionality
 */
class MentionsAutocomplete {
  constructor(quillEditor, options = {}) {
    this.quill = quillEditor;
    this.options = {
      searchUrl: '/users/api/search',
      minChars: 1,
      maxResults: 10,
      debounceDelay: 300,
      ...options,
    };

    this.isOpen = false;
    this.selectedIndex = 0;
    this.mentionChars = '@';
    this.users = [];
    this.mentionCharPos = null;
    this.searchQuery = '';
    this.debounceTimer = null;

    this.init();
  }

  init() {
    this.createDropdown();
    this.attachEventListeners();
  }

  createDropdown() {
    // Create dropdown container
    this.dropdown = document.createElement('div');
    this.dropdown.className = 'mentions-dropdown';
    this.dropdown.style.display = 'none';

    // Create list
    this.list = document.createElement('ul');
    this.list.className = 'mentions-list';
    this.dropdown.appendChild(this.list);

    // Add to body (will be positioned absolutely)
    document.body.appendChild(this.dropdown);

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!this.dropdown.contains(e.target) && e.target !== this.quill.root) {
        this.hideDropdown();
      }
    });
  }

  attachEventListeners() {
    // Listen for text changes in Quill
    this.quill.on('text-change', () => {
      this.onTextChange();
    });

    // Listen for selection changes
    this.quill.on('selection-change', (range) => {
      if (!range) {
        this.hideDropdown();
      }
    });

    // Handle keyboard navigation
    this.quill.keyboard.addBinding({
      key: 'ArrowDown',
      handler: () => {
        if (this.isOpen) {
          this.selectNext();
          return false; // Prevent default
        }
        return true;
      },
    });

    this.quill.keyboard.addBinding({
      key: 'ArrowUp',
      handler: () => {
        if (this.isOpen) {
          this.selectPrevious();
          return false;
        }
        return true;
      },
    });

    this.quill.keyboard.addBinding({
      key: 'Enter',
      handler: () => {
        if (this.isOpen) {
          this.insertSelectedMention();
          return false;
        }
        return true;
      },
    });

    this.quill.keyboard.addBinding({
      key: 'Escape',
      handler: () => {
        if (this.isOpen) {
          this.hideDropdown();
          return false;
        }
        return true;
      },
    });
  }

  onTextChange() {
    const range = this.quill.getSelection();
    if (!range) return;

    const text = this.quill.getText(0, range.index);
    const lastAtIndex = text.lastIndexOf(this.mentionChars);

    // Check if we're after an @ character
    if (lastAtIndex !== -1) {
      const textAfterAt = text.slice(lastAtIndex + 1);

      // Check if there's a space after @
      if (textAfterAt.includes(' ') || textAfterAt.includes('\n')) {
        this.hideDropdown();
        return;
      }

      // Must be at the cursor position or just before
      if (lastAtIndex <= range.index) {
        this.mentionCharPos = lastAtIndex;
        this.searchQuery = textAfterAt.trim();

        if (this.searchQuery.length >= this.options.minChars) {
          this.debouncedSearch();
        } else if (this.searchQuery.length === 0) {
          // Show popular users when just @ is typed
          this.searchUsers('');
        } else {
          this.hideDropdown();
        }
      } else {
        this.hideDropdown();
      }
    } else {
      this.hideDropdown();
    }
  }

  debouncedSearch() {
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.searchUsers(this.searchQuery);
    }, this.options.debounceDelay);
  }

  async searchUsers(query) {
    try {
      const url = `${this.options.searchUrl}?q=${encodeURIComponent(query)}&limit=${this.options.maxResults}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.success && data.users.length > 0) {
        this.users = data.users;
        this.selectedIndex = 0;
        this.showDropdown();
      } else {
        this.hideDropdown();
      }
    } catch (error) {
      console.error('Error searching users:', error);
      this.hideDropdown();
    }
  }

  showDropdown() {
    if (this.users.length === 0) {
      this.hideDropdown();
      return;
    }

    // Render users
    this.renderUsers();

    // Position dropdown near cursor
    this.positionDropdown();

    this.dropdown.style.display = 'block';
    this.isOpen = true;
  }

  hideDropdown() {
    this.dropdown.style.display = 'none';
    this.isOpen = false;
    this.users = [];
    this.selectedIndex = 0;
    this.mentionCharPos = null;
  }

  renderUsers() {
    this.list.innerHTML = '';

    this.users.forEach((user, index) => {
      const li = document.createElement('li');
      li.className = 'mentions-item';
      if (index === this.selectedIndex) {
        li.classList.add('selected');
      }

      li.innerHTML = `
        <img src="${user.avatar}" alt="${user.displayName}" class="mentions-avatar">
        <div class="mentions-info">
          <div class="mentions-name">${this.escapeHtml(user.displayName)}</div>
          <div class="mentions-email">${this.escapeHtml(user.email)}</div>
        </div>
      `;

      li.addEventListener('click', () => {
        this.selectedIndex = index;
        this.insertSelectedMention();
      });

      li.addEventListener('mouseenter', () => {
        this.selectedIndex = index;
        this.renderUsers();
      });

      this.list.appendChild(li);
    });
  }

  positionDropdown() {
    const range = this.quill.getSelection();
    if (!range) return;

    // Get the bounds of the mention character
    const bounds = this.quill.getBounds(this.mentionCharPos);
    const editorBounds = this.quill.root.getBoundingClientRect();

    // Position dropdown below the mention character
    this.dropdown.style.left = `${editorBounds.left + bounds.left}px`;
    this.dropdown.style.top = `${editorBounds.top + bounds.bottom + window.scrollY + 5}px`;

    // Ensure dropdown doesn't go off-screen
    const dropdownRect = this.dropdown.getBoundingClientRect();
    if (dropdownRect.right > window.innerWidth) {
      this.dropdown.style.left = `${window.innerWidth - dropdownRect.width - 10}px`;
    }
    if (dropdownRect.bottom > window.innerHeight) {
      this.dropdown.style.top = `${editorBounds.top + bounds.top + window.scrollY - dropdownRect.height - 5}px`;
    }
  }

  selectNext() {
    this.selectedIndex = (this.selectedIndex + 1) % this.users.length;
    this.renderUsers();
  }

  selectPrevious() {
    this.selectedIndex =
      (this.selectedIndex - 1 + this.users.length) % this.users.length;
    this.renderUsers();
  }

  insertSelectedMention() {
    if (!this.users[this.selectedIndex]) return;

    const user = this.users[this.selectedIndex];
    const range = this.quill.getSelection();

    // Calculate the position to delete from
    const deleteLength = range.index - this.mentionCharPos;

    // Delete the @search text
    this.quill.deleteText(this.mentionCharPos, deleteLength);

    // Insert the mention
    this.insertMention(user, this.mentionCharPos);

    // Hide dropdown
    this.hideDropdown();
  }

  insertMention(user, position) {
    // Create a custom mention format
    const mentionText = `@${user.displayName}`;

    // Insert mention with custom formatting
    this.quill.insertText(position, mentionText, {
      mention: {
        id: user.id,
        value: user.displayName,
        email: user.email,
        avatar: user.avatar,
      },
      color: '#0066cc',
      bold: true,
    });

    // Insert a space after mention
    this.quill.insertText(position + mentionText.length, ' ');

    // Move cursor after the mention and space
    this.quill.setSelection(position + mentionText.length + 1);

    // Store mention data in a hidden attribute for later retrieval
    this.storeMentionData(user);
  }

  storeMentionData(user) {
    // Get current mentioned users
    if (!this.quill.mentionedUsers) {
      this.quill.mentionedUsers = [];
    }

    // Add user if not already mentioned
    if (!this.quill.mentionedUsers.find((u) => u.id === user.id)) {
      this.quill.mentionedUsers.push({
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        email: user.email,
      });
    }
  }

  // Static method to extract mentioned user IDs from content
  static extractMentionedUserIds(quillEditor) {
    if (quillEditor.mentionedUsers) {
      return quillEditor.mentionedUsers.map((u) => u.id);
    }
    return [];
  }

  // Static method to parse mentions from HTML content
  static parseMentionsFromHtml(html) {
    const mentionedUserIds = [];
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Look for mention patterns (this is a fallback method)
    const mentionRegex = /@(\w+)/g;
    const matches = html.matchAll(mentionRegex);

    for (const match of matches) {
      // This is a simple implementation
      // You might need to enhance this based on your mention format
      console.log('Found mention:', match[1]);
    }

    return mentionedUserIds;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  destroy() {
    if (this.dropdown && this.dropdown.parentNode) {
      this.dropdown.parentNode.removeChild(this.dropdown);
    }
    clearTimeout(this.debounceTimer);
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MentionsAutocomplete;
}
