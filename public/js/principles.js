window.PrinciplesTab = (() => {
  let principles = [];

  function render() {
    const list = document.getElementById('principles-list');

    if (principles.length === 0) {
      list.innerHTML = '<div class="empty-state">No principles yet. What do you stand for?</div>';
      return;
    }

    list.innerHTML = principles.map((p, i) => `
      <div class="item-card" data-id="${p.id}">
        <div class="item-main">
          <span class="item-number">${i + 1}</span>
          <span class="item-title" data-action="expand">${escapeHtml(p.text)}</span>
          <div class="item-actions">
            <button class="action-btn" data-action="edit" title="Edit">&#9998;</button>
            <button class="action-btn delete-btn" data-action="delete" title="Delete">&#10005;</button>
          </div>
        </div>
        <div class="item-details ${p.details ? 'visible' : ''}" data-action="expand-target">${escapeHtml(p.details)}</div>
      </div>
    `).join('');
  }

  function handleClick(e) {
    const action = e.target.dataset.action || e.target.closest('[data-action]')?.dataset.action;
    if (!action) return;

    const card = e.target.closest('.item-card');
    if (!card) return;
    const id = Number(card.dataset.id);
    const principle = principles.find(p => p.id === id);
    if (!principle) return;

    if (action === 'expand') {
      card.querySelector('.item-details').classList.toggle('visible');
    } else if (action === 'edit') {
      window.AppModal.open({
        title: 'Edit Principle',
        name: principle.text,
        details: principle.details,
        onSave: (name, details) => API.updatePrinciple(id, { text: name, details }).then(load)
      });
    } else if (action === 'delete') {
      window.AppModal.confirmDelete(async () => {
        const deleted = { ...principle };
        await API.deletePrinciple(id);
        load();
        window.AppToast.show({
          message: 'Principle deleted',
          undoCallback: async () => {
            await API.createPrinciple({ text: deleted.text, details: deleted.details });
            load();
          }
        });
      });
    }
  }

  async function addPrinciple() {
    const input = document.getElementById('principle-input');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    await API.createPrinciple({ text });
    load();
  }

  async function load() {
    principles = await API.getPrinciples();
    render();
  }

  function init() {
    document.getElementById('principles-list').addEventListener('click', handleClick);
    document.getElementById('add-principle-btn').addEventListener('click', addPrinciple);
    document.getElementById('principle-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') addPrinciple();
    });
  }

  return { init, load };
})();
