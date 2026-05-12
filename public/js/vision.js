window.VisionTab = (() => {
  let entries = [];

  function formatTargetDate(iso) {
    const date = window.DateUtils.fromISODate(iso);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function renderBadges(entry) {
    const badges = [];
    if (entry.time_horizon) badges.push(entry.time_horizon);
    if (entry.target_date) badges.push(`By ${formatTargetDate(entry.target_date)}`);
    return badges.map((text) => `<span class="horizon-badge">${escapeHtml(text)}</span>`).join('');
  }

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
          <span class="horizon-badges">${renderBadges(entry)}</span>
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
        fields: {
          horizon: entry.time_horizon,
          targetDate: entry.target_date || '',
        },
        onSave: (values) => window.runAppAction(async () => {
          await API.updateVision(id, {
            title: values.name,
            details: values.details,
            time_horizon: values.horizon,
            target_date: values.targetDate,
          });
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
    const dateInput = document.getElementById('vision-target-date');
    const title = input.value.trim();
    if (!title) return;

    const time_horizon = select.value;
    const target_date = dateInput.value;

    input.value = '';
    select.value = '';
    dateInput.value = '';

    await API.createVision({ title, time_horizon, target_date });
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
