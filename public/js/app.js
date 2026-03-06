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
