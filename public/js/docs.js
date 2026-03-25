window.DocsTab = (() => {
  let currentDate = window.DateUtils.today();
  let docs = [];

  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  function formatDate(dateStr) {
    const [year, month, day] = dateStr.split('-').map(Number);
    return `${MONTHS[month - 1]} ${day}, ${year}`;
  }

  function render() {
    const list = document.getElementById('docs-list');

    if (docs.length === 0) {
      list.innerHTML = '<div class="empty-state">No docs for this day. Start writing below.</div>';
      return;
    }

    list.innerHTML = docs.map((doc) => `
      <div class="item-card doc-card" data-id="${doc.id}">
        <div class="item-main">
          <span class="item-title">${escapeHtml(doc.title)}</span>
          <div class="item-actions">
            <button class="action-btn" data-action="edit" title="Edit">&#9998;</button>
            <button class="action-btn delete-btn" data-action="delete" title="Delete">&#10005;</button>
          </div>
        </div>
        ${doc.content ? `<div class="item-details visible doc-content">${escapeHtml(doc.content)}</div>` : ''}
      </div>
    `).join('');
  }

  function handleClick(event) {
    const action = event.target.dataset.action || event.target.closest('[data-action]')?.dataset.action;
    if (!action) return;

    const card = event.target.closest('.item-card');
    if (!card) return;
    const id = Number(card.dataset.id);
    const doc = docs.find((item) => item.id === id);
    if (!doc) return;

    if (action === 'edit') {
      window.AppModal.open({
        title: 'Edit Doc',
        name: doc.title,
        details: doc.content,
        fields: { date: doc.date },
        onSave: (values) => window.runAppAction(async () => {
          await API.updateDoc(id, {
            title: values.name,
            content: values.details,
            date: values.date,
          });
          await load();
        }),
      });
      return;
    }

    if (action === 'delete') {
      window.AppModal.confirmDelete(() => window.runAppAction(async () => {
        await API.deleteDoc(id);
        await load();
      }));
    }
  }

  async function addDoc() {
    const input = document.getElementById('doc-input');
    const title = input.value.trim();
    if (!title) return;

    input.value = '';
    await API.createDoc({ title, date: currentDate });
    await load();
  }

  async function load() {
    document.getElementById('docs-date').textContent = formatDate(currentDate);
    docs = await API.getDocs(currentDate);
    render();
  }

  function init() {
    document.getElementById('docs-prev').addEventListener('click', () => {
      currentDate = window.DateUtils.shift(currentDate, -1);
      window.runAppAction(() => load());
    });

    document.getElementById('docs-next').addEventListener('click', () => {
      currentDate = window.DateUtils.shift(currentDate, 1);
      window.runAppAction(() => load());
    });

    document.getElementById('docs-today').addEventListener('click', () => {
      currentDate = window.DateUtils.today();
      window.runAppAction(() => load());
    });

    document.getElementById('docs-list').addEventListener('click', handleClick);
    document.getElementById('add-doc-btn').addEventListener('click', () => window.runAppAction(() => addDoc()));
    document.getElementById('doc-input').addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        window.runAppAction(() => addDoc());
      }
    });
  }

  return { init, load };
})();
