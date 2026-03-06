window.TasksTab = (() => {
  let currentDate = new Date().toISOString().split('T')[0];
  let tasks = [];

  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  function formatDate(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return `${MONTHS[m - 1]} ${d}, ${y}`;
  }

  function shiftDate(offset) {
    const d = new Date(currentDate + 'T12:00:00');
    d.setDate(d.getDate() + offset);
    currentDate = d.toISOString().split('T')[0];
    load();
  }

  function renderTasks() {
    const list = document.getElementById('tasks-list');

    if (tasks.length === 0) {
      list.innerHTML = '<div class="empty-state">No tasks for this day. Add your first task below.</div>';
      return;
    }

    list.innerHTML = tasks.map(t => `
      <div class="item-card" data-id="${t.id}">
        <div class="item-main">
          <div class="task-checkbox ${t.completed ? 'checked' : ''}" data-action="toggle"></div>
          <span class="item-title ${t.completed ? 'completed' : ''}" data-action="expand">${escapeHtml(t.title)}</span>
          ${t.source === 'idea' ? '<span class="item-badge">from idea</span>' : ''}
          <div class="item-actions">
            <button class="action-btn" data-action="edit" title="Edit">&#9998;</button>
            <button class="action-btn delete-btn" data-action="delete" title="Delete">&#10005;</button>
          </div>
        </div>
        <div class="item-details ${t.details ? 'visible' : ''}" data-action="expand-target">${escapeHtml(t.details)}</div>
      </div>
    `).join('');
  }

  function handleClick(e) {
    const action = e.target.dataset.action || e.target.closest('[data-action]')?.dataset.action;
    if (!action) return;

    const card = e.target.closest('.item-card');
    if (!card) return;
    const id = Number(card.dataset.id);
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    if (action === 'toggle') {
      API.toggleTask(id, task.completed ? 0 : 1).then(load);
    } else if (action === 'expand') {
      const details = card.querySelector('.item-details');
      details.classList.toggle('visible');
    } else if (action === 'edit') {
      window.AppModal.open({
        title: 'Edit Task',
        name: task.title,
        details: task.details,
        onSave: (name, details) => API.updateTask(id, { title: name, details }).then(load)
      });
    } else if (action === 'delete') {
      window.AppModal.confirmDelete(() => API.deleteTask(id).then(load));
    }
  }

  async function addTask() {
    const input = document.getElementById('task-input');
    const title = input.value.trim();
    if (!title) return;
    input.value = '';
    await API.createTask({ title, date: currentDate });
    load();
  }

  async function loadSummary() {
    const view = document.getElementById('summary-view');
    if (!view.classList.contains('hidden')) {
      view.classList.add('hidden');
      return;
    }
    const data = await API.getSummary();
    view.innerHTML = `
      <div class="summary-stats">
        <div class="summary-stat">
          <div class="summary-stat-value">${data.totalTasks}</div>
          <div class="summary-stat-label">Total</div>
        </div>
        <div class="summary-stat">
          <div class="summary-stat-value">${data.completedTasks}</div>
          <div class="summary-stat-label">Completed</div>
        </div>
        <div class="summary-stat">
          <div class="summary-stat-value">${data.completionRate}%</div>
          <div class="summary-stat-label">Rate</div>
        </div>
        <div class="summary-stat">
          <div class="summary-stat-value">${data.ideasCreated}</div>
          <div class="summary-stat-label">Ideas</div>
        </div>
      </div>
      ${data.dailyBreakdown.map(day => `
        <div class="summary-day">
          <div class="summary-day-header">
            <span class="summary-day-name">${day.day}</span>
            <span class="summary-day-count">${day.completedCount}/${day.tasks.length} done</span>
          </div>
          ${day.tasks.length ? `<ul class="summary-day-tasks">${day.tasks.filter(t => t.completed).map(t => `<li>${escapeHtml(t.title)}</li>`).join('')}</ul>` : ''}
        </div>
      `).join('')}
      <button class="summary-close" id="summary-close">Close</button>
    `;
    view.classList.remove('hidden');
    document.getElementById('summary-close').addEventListener('click', () => view.classList.add('hidden'));
  }

  async function load() {
    document.getElementById('current-date').textContent = formatDate(currentDate);
    tasks = await API.getTasks(currentDate);
    renderTasks();
  }

  function init() {
    document.getElementById('prev-day').addEventListener('click', () => shiftDate(-1));
    document.getElementById('next-day').addEventListener('click', () => shiftDate(1));
    document.getElementById('today-btn').addEventListener('click', () => {
      currentDate = new Date().toISOString().split('T')[0];
      load();
    });
    document.getElementById('tasks-list').addEventListener('click', handleClick);
    document.getElementById('add-task-btn').addEventListener('click', addTask);
    document.getElementById('task-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') addTask();
    });
    document.getElementById('summary-toggle').addEventListener('click', loadSummary);
  }

  return { init, load };
})();

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
