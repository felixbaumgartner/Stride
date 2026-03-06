window.VisionTab = (() => {
  let entries = [];

  function render() {
    const list = document.getElementById('vision-list');

    if (entries.length === 0) {
      list.innerHTML = '<div class="empty-state">Where do you see yourself? Add your first vision.</div>';
      return;
    }

    list.innerHTML = entries.map(v => `
      <div class="item-card" data-id="${v.id}">
        <div class="item-main">
          <span class="item-title" data-action="expand">${escapeHtml(v.title)}</span>
          ${v.time_horizon ? `<span class="horizon-badge">${escapeHtml(v.time_horizon)}</span>` : ''}
          <div class="item-actions">
            <button class="action-btn" data-action="edit" title="Edit">&#9998;</button>
            <button class="action-btn delete-btn" data-action="delete" title="Delete">&#10005;</button>
          </div>
        </div>
        <div class="item-details ${v.details ? 'visible' : ''}" data-action="expand-target">${escapeHtml(v.details)}</div>
      </div>
    `).join('');
  }

  function handleClick(e) {
    const action = e.target.dataset.action || e.target.closest('[data-action]')?.dataset.action;
    if (!action) return;

    const card = e.target.closest('.item-card');
    if (!card) return;
    const id = Number(card.dataset.id);
    const entry = entries.find(v => v.id === id);
    if (!entry) return;

    if (action === 'expand') {
      card.querySelector('.item-details').classList.toggle('visible');
    } else if (action === 'edit') {
      window.AppModal.open({
        title: 'Edit Vision',
        name: entry.title,
        details: entry.details,
        onSave: (name, details) => API.updateVision(id, { title: name, details }).then(load)
      });
    } else if (action === 'delete') {
      window.AppModal.confirmDelete(() => API.deleteVision(id).then(load));
    }
  }

  async function addVision() {
    const input = document.getElementById('vision-input');
    const select = document.getElementById('vision-horizon');
    const title = input.value.trim();
    if (!title) return;
    input.value = '';
    const time_horizon = select.value;
    select.value = '';
    await API.createVision({ title, time_horizon });
    load();
  }

  async function load() {
    entries = await API.getVision();
    render();
  }

  function init() {
    document.getElementById('vision-list').addEventListener('click', handleClick);
    document.getElementById('add-vision-btn').addEventListener('click', addVision);
    document.getElementById('vision-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') addVision();
    });
  }

  return { init, load };
})();
