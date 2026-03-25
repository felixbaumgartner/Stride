setTimeout(() => {
  const intro = document.getElementById('intro');
  if (intro) intro.remove();
}, 3200);

window.AppModal = (() => {
  const modal = document.getElementById('detail-modal');
  const titleEl = document.getElementById('modal-title');
  const nameInput = document.getElementById('modal-name');
  const detailsInput = document.getElementById('modal-details');
  const dateWrap = document.getElementById('modal-date-wrap');
  const dateInput = document.getElementById('modal-date');
  const horizonWrap = document.getElementById('modal-horizon-wrap');
  const horizonInput = document.getElementById('modal-horizon');
  const linksWrap = document.getElementById('modal-links-wrap');
  const principleSelect = document.getElementById('modal-principle');
  const visionSelect = document.getElementById('modal-vision');
  const focusWrap = document.getElementById('modal-focus-wrap');
  const focusInput = document.getElementById('modal-focus');
  const extraActionsWrap = document.getElementById('modal-extra-actions');
  let onSaveCallback = null;
  let extraActions = [];

  function renderSelect(select, placeholder, items, value) {
    select.innerHTML = [`<option value="">${placeholder}</option>`]
      .concat(items.map((item) => `<option value="${item.id}">${escapeHtml(item.label)}</option>`))
      .join('');
    select.value = value ? String(value) : '';
  }

  function setVisibility(element, visible) {
    element.classList.toggle('hidden', !visible);
  }

  function buildValues() {
    return {
      name: nameInput.value.trim(),
      details: detailsInput.value.trim(),
      date: dateInput.value,
      horizon: horizonInput.value,
      principleId: principleSelect.value ? Number(principleSelect.value) : null,
      visionId: visionSelect.value ? Number(visionSelect.value) : null,
      focus: focusInput.checked,
    };
  }

  function close() {
    modal.classList.add('hidden');
    onSaveCallback = null;
    extraActions = [];
    extraActionsWrap.innerHTML = '';
  }

  function open(config) {
    const {
      title,
      name = '',
      details = '',
      fields = {},
      options = {},
      extraActions: nextExtraActions = [],
      onSave,
    } = config;

    titleEl.textContent = title || 'Edit Details';
    nameInput.value = name;
    detailsInput.value = details;
    nameInput.classList.remove('hidden');
    detailsInput.classList.remove('hidden');

    setVisibility(dateWrap, Object.prototype.hasOwnProperty.call(fields, 'date'));
    dateInput.value = fields.date || '';

    setVisibility(horizonWrap, Object.prototype.hasOwnProperty.call(fields, 'horizon'));
    horizonInput.value = fields.horizon || '';

    const shouldShowLinks = options.principles || options.vision;
    setVisibility(linksWrap, Boolean(shouldShowLinks));
    if (shouldShowLinks) {
      renderSelect(
        principleSelect,
        'No principle',
        (options.principles || []).map((item) => ({ id: item.id, label: item.text })),
        fields.principleId
      );
      renderSelect(
        visionSelect,
        'No vision',
        (options.vision || []).map((item) => ({ id: item.id, label: item.title })),
        fields.visionId
      );
    }

    setVisibility(focusWrap, Object.prototype.hasOwnProperty.call(fields, 'focus'));
    focusInput.checked = Boolean(fields.focus);

    extraActions = nextExtraActions;
    setVisibility(extraActionsWrap, extraActions.length > 0);
    extraActionsWrap.innerHTML = extraActions
      .map((action, index) => `<button class="btn btn-secondary btn-inline" data-extra-action="${index}">${escapeHtml(action.label)}</button>`)
      .join('');

    onSaveCallback = onSave;
    modal.classList.remove('hidden');
    nameInput.focus();
  }

  document.getElementById('modal-save').addEventListener('click', async () => {
    if (!onSaveCallback) return;
    const keepOpen = await onSaveCallback(buildValues());
    if (keepOpen !== false) {
      close();
    }
  });

  extraActionsWrap.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-extra-action]');
    if (!button) return;

    const action = extraActions[Number(button.dataset.extraAction)];
    if (!action?.onClick) return;

    const keepOpen = await action.onClick(buildValues());
    if (keepOpen !== false) {
      close();
    }
  });

  document.getElementById('modal-cancel').addEventListener('click', close);
  modal.addEventListener('click', (event) => {
    if (event.target === modal) close();
  });

  const deleteModal = document.getElementById('delete-modal');
  let onDeleteCallback = null;

  document.getElementById('delete-confirm').addEventListener('click', async () => {
    if (onDeleteCallback) await onDeleteCallback();
    deleteModal.classList.add('hidden');
    onDeleteCallback = null;
  });

  document.getElementById('delete-cancel').addEventListener('click', () => {
    deleteModal.classList.add('hidden');
    onDeleteCallback = null;
  });

  deleteModal.addEventListener('click', (event) => {
    if (event.target === deleteModal) {
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

const tabs = {
  tasks: { panel: document.getElementById('tasks-panel'), module: window.TasksTab },
  ideas: { panel: document.getElementById('ideas-panel'), module: window.IdeasTab },
  principles: { panel: document.getElementById('principles-panel'), module: window.PrinciplesTab },
  vision: { panel: document.getElementById('vision-panel'), module: window.VisionTab },
  docs: { panel: document.getElementById('docs-panel'), module: window.DocsTab },
};

function switchTab(tabName) {
  if (!tabs[tabName]) return;

  document.querySelectorAll('.tab').forEach((button) => {
    button.classList.toggle('active', button.dataset.tab === tabName);
  });

  Object.entries(tabs).forEach(([name, { panel }]) => {
    panel.classList.toggle('active', name === tabName);
  });

  window.runAppAction(() => tabs[tabName].module.load());
}

document.querySelectorAll('.tab').forEach((button) => {
  button.addEventListener('click', () => switchTab(button.dataset.tab));
});

Object.values(tabs).forEach(({ module }) => module.init());
window.runAppAction(() => tabs.tasks.module.load());

// Search handler
(() => {
  const input = document.getElementById('search-input');
  const resultsEl = document.getElementById('search-results');
  const wrapper = document.getElementById('search-wrapper');
  if (!input || !resultsEl) return;

  let debounceTimer = null;

  function truncate(text, max) {
    if (!text) return '';
    return text.length > max ? text.slice(0, max) + '...' : text;
  }

  function badgeLabel(type) {
    return { tasks: 'Task', ideas: 'Idea', principles: 'Principle', vision: 'Vision', docs: 'Doc' }[type] || type;
  }

  function renderResults(data) {
    const sections = [];
    for (const type of ['tasks', 'ideas', 'principles', 'vision', 'docs']) {
      const items = data[type];
      if (!items || items.length === 0) continue;
      const rows = items.map((item) => {
        const title = escapeHtml(item.title || item.text || '');
        const snippet = truncate(item.details || '', 80);
        return `<button class="search-result-item" data-type="${type}" data-id="${item.id}">
          <span class="search-result-badge">${badgeLabel(type)}</span>
          <span class="search-result-title">${title}</span>
          ${snippet ? `<span class="search-result-snippet">${escapeHtml(snippet)}</span>` : ''}
        </button>`;
      });
      sections.push(rows.join(''));
    }
    if (sections.length === 0) {
      resultsEl.innerHTML = '<div class="search-empty">No results found</div>';
    } else {
      resultsEl.innerHTML = sections.join('');
    }
    resultsEl.classList.add('visible');
  }

  function closeResults() {
    resultsEl.classList.remove('visible');
    resultsEl.innerHTML = '';
  }

  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const query = input.value.trim();
    if (!query) { closeResults(); return; }
    debounceTimer = setTimeout(async () => {
      await window.runAppAction(async () => {
        const data = await API.search(query);
        renderResults(data);
      });
    }, 250);
  });

  resultsEl.addEventListener('click', (e) => {
    const item = e.target.closest('.search-result-item');
    if (!item) return;
    const type = item.dataset.type;
    if (type) switchTab(type);
    input.value = '';
    closeResults();
  });

  document.addEventListener('click', (e) => {
    if (!wrapper.contains(e.target)) closeResults();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeResults(); input.blur(); }
  });
})();

// Export handler
(() => {
  const btn = document.getElementById('export-btn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    await window.runAppAction(async () => {
      const blob = await API.exportMarkdown();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'stride-export.md';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });
  });
})();

