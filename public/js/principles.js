window.PrinciplesTab = (() => {
  let principles = [];

  function render() {
    const list = document.getElementById('principles-list');

    if (principles.length === 0) {
      list.innerHTML = '<div class="empty-state">No principles yet. What do you stand for?</div>';
      return;
    }

    list.innerHTML = principles.map((principle, index) => `
      <div class="item-card" data-id="${principle.id}">
        <div class="item-main">
          <span class="item-number">${index + 1}</span>
          <span class="item-title">${escapeHtml(principle.text)}</span>
          <div class="item-actions">
            <button class="action-btn" data-action="edit" title="Edit">&#9998;</button>
            <button class="action-btn delete-btn" data-action="delete" title="Delete">&#10005;</button>
          </div>
        </div>
        ${principle.details ? `<div class="item-details visible">${escapeHtml(principle.details)}</div>` : ''}
      </div>
    `).join('');
  }

  function handleClick(event) {
    const action = event.target.dataset.action || event.target.closest('[data-action]')?.dataset.action;
    if (!action) return;

    const card = event.target.closest('.item-card');
    if (!card) return;
    const id = Number(card.dataset.id);
    const principle = principles.find((item) => item.id === id);
    if (!principle) return;

    if (action === 'edit') {
      window.AppModal.open({
        title: 'Edit Principle',
        name: principle.text,
        details: principle.details,
        onSave: (values) => window.runAppAction(async () => {
          await API.updatePrinciple(id, { text: values.name, details: values.details });
          await load();
        }),
      });
      return;
    }

    if (action === 'delete') {
      window.AppModal.confirmDelete(() => window.runAppAction(async () => {
        await API.deletePrinciple(id);
        await load();
      }));
    }
  }

  async function addPrinciple() {
    const input = document.getElementById('principle-input');
    const text = input.value.trim();
    if (!text) return;

    input.value = '';
    await API.createPrinciple({ text });
    await load();
  }

  async function load() {
    principles = await API.getPrinciples();
    render();
  }

  function init() {
    document.getElementById('principles-list').addEventListener('click', handleClick);
    document.getElementById('add-principle-btn').addEventListener('click', () => window.runAppAction(() => addPrinciple()));
    document.getElementById('principle-input').addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        window.runAppAction(() => addPrinciple());
      }
    });
  }

  return { init, load };
})();
