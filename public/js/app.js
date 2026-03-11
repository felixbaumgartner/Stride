// Remove intro overlay after animation completes
setTimeout(() => {
  const intro = document.getElementById('intro');
  if (intro) intro.remove();
}, 3200);

// Modal helper (shared across tabs)
window.AppModal = (() => {
  const modal = document.getElementById('detail-modal');
  const nameInput = document.getElementById('modal-name');
  const detailsInput = document.getElementById('modal-details');
  const titleEl = document.getElementById('modal-title');
  let onSaveCallback = null;

  document.getElementById('modal-save').addEventListener('click', () => {
    if (onSaveCallback) {
      onSaveCallback(nameInput.value.trim(), detailsInput.value.trim());
    }
    close();
  });

  document.getElementById('modal-cancel').addEventListener('click', close);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });

  function open({ title, name, details, onSave }) {
    titleEl.textContent = title || 'Edit Details';
    nameInput.value = name || '';
    detailsInput.value = details || '';
    onSaveCallback = onSave;
    modal.classList.remove('hidden');
    nameInput.focus();
  }

  function close() {
    modal.classList.add('hidden');
    onSaveCallback = null;
  }

  // Delete confirmation modal
  const deleteModal = document.getElementById('delete-modal');
  let onDeleteCallback = null;

  document.getElementById('delete-confirm').addEventListener('click', () => {
    if (onDeleteCallback) onDeleteCallback();
    deleteModal.classList.add('hidden');
    onDeleteCallback = null;
  });

  document.getElementById('delete-cancel').addEventListener('click', () => {
    deleteModal.classList.add('hidden');
    onDeleteCallback = null;
  });

  deleteModal.addEventListener('click', (e) => {
    if (e.target === deleteModal) {
      deleteModal.classList.add('hidden');
      onDeleteCallback = null;
    }
  });

  function confirmDelete(onConfirm) {
    onDeleteCallback = onConfirm;
    deleteModal.classList.remove('hidden');
  }

  return { open, close, confirmDelete };
})();

// Toast notification system
window.AppToast = (() => {
  const container = document.getElementById('toast-container');

  function show({ message, undoCallback, duration = 10000 }) {
    const toast = document.createElement('div');
    toast.className = 'toast';

    const msgSpan = document.createElement('span');
    msgSpan.textContent = message;
    toast.appendChild(msgSpan);

    let timeoutId;
    let dismissed = false;

    function dismiss() {
      if (dismissed) return;
      dismissed = true;
      clearTimeout(timeoutId);
      toast.classList.add('leaving');
      toast.addEventListener('animationend', () => toast.remove());
    }

    if (undoCallback) {
      const undoBtn = document.createElement('button');
      undoBtn.className = 'toast-undo-btn';
      undoBtn.textContent = 'Undo';
      undoBtn.addEventListener('click', () => {
        undoCallback();
        dismiss();
      });
      toast.appendChild(undoBtn);
    }

    container.appendChild(toast);
    timeoutId = setTimeout(dismiss, duration);

    return dismiss;
  }

  return { show };
})();

// Tab switching
const tabs = {
  tasks: { panel: document.getElementById('tasks-panel'), module: window.TasksTab },
  ideas: { panel: document.getElementById('ideas-panel'), module: window.IdeasTab },
  principles: { panel: document.getElementById('principles-panel'), module: window.PrinciplesTab },
  vision: { panel: document.getElementById('vision-panel'), module: window.VisionTab }
};

let activeTab = 'tasks';

function switchTab(tabName) {
  if (!tabs[tabName]) return;
  activeTab = tabName;

  document.querySelectorAll('.tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  Object.entries(tabs).forEach(([name, { panel }]) => {
    panel.classList.toggle('active', name === tabName);
  });

  tabs[tabName].module.load();
}

document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// Initialize all tabs
Object.values(tabs).forEach(({ module }) => module.init());

// Load the default tab
tabs.tasks.module.load();

// Search handler
(() => {
  const searchInput = document.getElementById('search-input');
  const searchResults = document.getElementById('search-results');
  let debounceTimer = null;

  searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const query = searchInput.value.trim();

    if (!query) {
      searchResults.classList.remove('visible');
      return;
    }

    debounceTimer = setTimeout(async () => {
      try {
        const results = await API.search(query);
        renderResults(results);
      } catch (err) {
        console.error('Search failed:', err);
      }
    }, 250);
  });

  function renderResults(results) {
    const { tasks, ideas, principles, vision } = results;
    const totalCount = tasks.length + ideas.length + principles.length + vision.length;

    if (totalCount === 0) {
      searchResults.innerHTML = '<div class="search-empty">No results found</div>';
      searchResults.classList.add('visible');
      return;
    }

    let html = '';

    if (tasks.length > 0) {
      html += '<div class="search-group-label">Tasks</div>';
      html += tasks.map(t => `
        <div class="search-result-item" data-type="tasks" data-id="${t.id}">
          <span class="search-result-badge">Task</span>
          <div class="search-result-content">
            <div class="search-result-title">${escapeHtml(t.title)}</div>
            ${t.details ? `<div class="search-result-snippet">${escapeHtml(t.details.substring(0, 80))}</div>` : ''}
          </div>
        </div>
      `).join('');
    }

    if (ideas.length > 0) {
      html += '<div class="search-group-label">Ideas</div>';
      html += ideas.map(i => `
        <div class="search-result-item" data-type="ideas" data-id="${i.id}">
          <span class="search-result-badge">Idea</span>
          <div class="search-result-content">
            <div class="search-result-title">${escapeHtml(i.title)}</div>
            ${i.details ? `<div class="search-result-snippet">${escapeHtml(i.details.substring(0, 80))}</div>` : ''}
          </div>
        </div>
      `).join('');
    }

    if (principles.length > 0) {
      html += '<div class="search-group-label">Principles</div>';
      html += principles.map(p => `
        <div class="search-result-item" data-type="principles" data-id="${p.id}">
          <span class="search-result-badge">Principle</span>
          <div class="search-result-content">
            <div class="search-result-title">${escapeHtml(p.text)}</div>
            ${p.details ? `<div class="search-result-snippet">${escapeHtml(p.details.substring(0, 80))}</div>` : ''}
          </div>
        </div>
      `).join('');
    }

    if (vision.length > 0) {
      html += '<div class="search-group-label">Vision</div>';
      html += vision.map(v => `
        <div class="search-result-item" data-type="vision" data-id="${v.id}">
          <span class="search-result-badge">Vision</span>
          <div class="search-result-content">
            <div class="search-result-title">${escapeHtml(v.title)}</div>
            ${v.details ? `<div class="search-result-snippet">${escapeHtml(v.details.substring(0, 80))}</div>` : ''}
          </div>
        </div>
      `).join('');
    }

    searchResults.innerHTML = html;
    searchResults.classList.add('visible');
  }

  // Click a search result to navigate to that tab
  searchResults.addEventListener('click', (e) => {
    const item = e.target.closest('.search-result-item');
    if (!item) return;

    const type = item.dataset.type;
    switchTab(type);

    searchInput.value = '';
    searchResults.classList.remove('visible');
  });

  // Close search results when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-wrapper')) {
      searchResults.classList.remove('visible');
    }
  });

  // Close on Escape key
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      searchInput.value = '';
      searchResults.classList.remove('visible');
      searchInput.blur();
    }
  });
})();

// Export handler
document.getElementById('export-btn').addEventListener('click', async () => {
  try {
    const blob = await API.exportMarkdown();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'stride-export.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Export failed:', err);
  }
});
