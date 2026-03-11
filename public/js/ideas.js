window.IdeasTab = (() => {
  let ideas = [];
  let principles = [];
  let vision = [];

  async function ensureLookups() {
    [principles, vision] = await Promise.all([API.getPrinciples(), API.getVision()]);
  }

  function render() {
    const list = document.getElementById('ideas-list');

    if (ideas.length === 0) {
      list.innerHTML = '<div class="empty-state">No ideas yet. Capture your next big idea.</div>';
      return;
    }

    list.innerHTML = ideas.map((idea) => {
      const meta = [];
      if (idea.principle_text) meta.push(`<span class="meta-chip">Principle: ${escapeHtml(idea.principle_text)}</span>`);
      if (idea.vision_title) meta.push(`<span class="meta-chip">Vision: ${escapeHtml(idea.vision_title)}</span>`);

      return `
        <div class="item-card ${idea.converted ? 'converted' : ''} ${idea.archived ? 'archived' : ''}" data-id="${idea.id}">
          <div class="item-main">
            <span class="item-title">${escapeHtml(idea.title)}</span>
            ${idea.converted ? '<span class="item-badge">Converted</span>' : ''}
            ${idea.archived ? '<span class="item-badge item-badge-archived">Archived</span>' : ''}
            <div class="item-actions">
              ${!idea.converted ? '<button class="action-btn convert-btn" data-action="convert" title="Convert to task">&#10132;</button>' : ''}
              <button class="action-btn" data-action="archive" title="Archive">${idea.archived ? '&#8634;' : '&#128230;'}</button>
              <button class="action-btn" data-action="edit" title="Edit">&#9998;</button>
              <button class="action-btn delete-btn" data-action="delete" title="Delete">&#10005;</button>
            </div>
          </div>
          ${(idea.details || meta.length) ? `
            <div class="item-details visible">
              ${idea.details ? `<div>${escapeHtml(idea.details)}</div>` : ''}
              ${meta.length ? `<div class="item-meta">${meta.join('')}</div>` : ''}
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  }

  function openIdeaEditor(idea) {
    window.AppModal.open({
      title: 'Edit Idea',
      name: idea.title,
      details: idea.details,
      fields: {
        principleId: idea.principle_id,
        visionId: idea.vision_id,
      },
      options: { principles, vision },
      onSave: (values) => window.runAppAction(async () => {
        await API.updateIdea(idea.id, {
          title: values.name,
          details: values.details,
          principle_id: values.principleId,
          vision_id: values.visionId,
        });
        await load();
      }),
    });
  }

  function handleClick(event) {
    const action = event.target.dataset.action || event.target.closest('[data-action]')?.dataset.action;
    if (!action) return;

    const card = event.target.closest('.item-card');
    if (!card) return;
    const id = Number(card.dataset.id);
    const idea = ideas.find((item) => item.id === id);
    if (!idea) return;

    if (action === 'edit') {
      openIdeaEditor(idea);
      return;
    }

    if (action === 'convert') {
      window.runAppAction(async () => {
        await API.convertIdea(id, window.DateUtils.today());
        await load();
      });
      return;
    }

    if (action === 'archive') {
      window.runAppAction(async () => {
        await API.archiveIdea(id, idea.archived ? 0 : 1);
        await load();
      });
      return;
    }

    if (action === 'delete') {
      window.AppModal.confirmDelete(() => window.runAppAction(async () => {
        await API.deleteIdea(id);
        await load();
      }));
    }
  }

  async function addIdea() {
    const input = document.getElementById('idea-input');
    const title = input.value.trim();
    if (!title) return;

    input.value = '';
    await API.createIdea({ title });
    await load();
  }

  async function load() {
    await ensureLookups();
    ideas = await API.getIdeas({
      includeConverted: document.getElementById('show-converted').checked,
      includeArchived: document.getElementById('show-archived').checked,
    });
    render();
  }

  function init() {
    document.getElementById('ideas-list').addEventListener('click', handleClick);
    document.getElementById('add-idea-btn').addEventListener('click', () => window.runAppAction(() => addIdea()));
    document.getElementById('idea-input').addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        window.runAppAction(() => addIdea());
      }
    });
    document.getElementById('show-converted').addEventListener('change', () => window.runAppAction(() => load()));
    document.getElementById('show-archived').addEventListener('change', () => window.runAppAction(() => load()));
  }

  return { init, load };
})();
