window.IdeasTab = (() => {
  let ideas = [];

  function render() {
    const list = document.getElementById('ideas-list');

    if (ideas.length === 0) {
      list.innerHTML = '<div class="empty-state">No ideas yet. Capture your next big idea.</div>';
      return;
    }

    list.innerHTML = ideas.map(idea => `
      <div class="item-card ${idea.converted ? 'converted' : ''}" data-id="${idea.id}">
        <div class="item-main">
          <span class="item-title" data-action="expand">${escapeHtml(idea.title)}</span>
          ${idea.converted ? '<span class="item-badge">Converted</span>' : ''}
          <div class="item-actions">
            ${!idea.converted ? `<button class="action-btn convert-btn" data-action="convert" title="Convert to task">&#10132;</button>` : ''}
            <button class="action-btn" data-action="edit" title="Edit">&#9998;</button>
            <button class="action-btn delete-btn" data-action="delete" title="Delete">&#10005;</button>
          </div>
        </div>
        <div class="item-details ${idea.details ? 'visible' : ''}" data-action="expand-target">${escapeHtml(idea.details)}</div>
      </div>
    `).join('');
  }

  function handleClick(e) {
    const action = e.target.dataset.action || e.target.closest('[data-action]')?.dataset.action;
    if (!action) return;

    const card = e.target.closest('.item-card');
    if (!card) return;
    const id = Number(card.dataset.id);
    const idea = ideas.find(i => i.id === id);
    if (!idea) return;

    if (action === 'expand') {
      card.querySelector('.item-details').classList.toggle('visible');
    } else if (action === 'edit') {
      window.AppModal.open({
        title: 'Edit Idea',
        name: idea.title,
        details: idea.details,
        onSave: (name, details) => API.updateIdea(id, { title: name, details }).then(load)
      });
    } else if (action === 'convert') {
      const today = new Date().toISOString().split('T')[0];
      API.convertIdea(id, today).then(load);
    } else if (action === 'delete') {
      window.AppModal.confirmDelete(async () => {
        const deleted = { ...idea };
        await API.deleteIdea(id);
        load();
        window.AppToast.show({
          message: 'Idea deleted',
          undoCallback: async () => {
            await API.createIdea({ title: deleted.title, details: deleted.details });
            load();
          }
        });
      });
    }
  }

  async function addIdea() {
    const input = document.getElementById('idea-input');
    const title = input.value.trim();
    if (!title) return;
    input.value = '';
    await API.createIdea({ title });
    load();
  }

  async function load() {
    const showConverted = document.getElementById('show-converted').checked;
    ideas = await API.getIdeas(showConverted);
    render();
  }

  function init() {
    document.getElementById('ideas-list').addEventListener('click', handleClick);
    document.getElementById('add-idea-btn').addEventListener('click', addIdea);
    document.getElementById('idea-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') addIdea();
    });
    document.getElementById('show-converted').addEventListener('change', load);
  }

  return { init, load };
})();
