window.VisionTab = (() => {
  let entries = [];

  function render() {
    const list = document.getElementById('vision-list');

    if (entries.length === 0) {
      list.innerHTML = '<div class="empty-state">Where do you see yourself? Add your first vision.</div>';
      return;
    }

    list.innerHTML = entries.map((entry) => `
      <div class="item-card" data-id="${entry.id}">
        <div class="item-main">
          <span class="item-title">${escapeHtml(entry.title)}</span>
          ${entry.time_horizon ? `<span class="horizon-badge">${escapeHtml(entry.time_horizon)}</span>` : ''}
          <div class="item-actions">
            <button class="action-btn" data-action="edit" title="Edit">&#9998;</button>
            <button class="action-btn delete-btn" data-action="delete" title="Delete">&#10005;</button>
          </div>
        </div>
        ${entry.details ? `<div class="item-details visible">${escapeHtml(entry.details)}</div>` : ''}
      </div>
    `).join('');
  }

  function handleClick(event) {
    const action = event.target.dataset.action || event.target.closest('[data-action]')?.dataset.action;
    if (!action) return;

    const card = event.target.closest('.item-card');
    if (!card) return;
    const id = Number(card.dataset.id);
    const entry = entries.find((item) => item.id === id);
    if (!entry) return;

    if (action === 'edit') {
      window.AppModal.open({
        title: 'Edit Vision',
        name: entry.title,
        details: entry.details,
        fields: { horizon: entry.time_horizon },
        onSave: (values) => window.runAppAction(async () => {
          await API.updateVision(id, { title: values.name, details: values.details, time_horizon: values.horizon });
          await load();
        }),
      });
      return;
    }

    if (action === 'delete') {
      window.AppModal.confirmDelete(() => window.runAppAction(async () => {
        await API.deleteVision(id);
        await load();
      }));
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
    await load();
  }

  async function load() {
    entries = await API.getVision();
    render();
  }

  function init() {
    document.getElementById('vision-list').addEventListener('click', handleClick);
    document.getElementById('add-vision-btn').addEventListener('click', () => window.runAppAction(() => addVision()));
    document.getElementById('vision-input').addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        window.runAppAction(() => addVision());
      }
    });
  }

  return { init, load };
})();
