window.TasksTab = (() => {
  let currentDate = window.DateUtils.today();
  let tasks = [];
  let carryoverTasks = [];
  let carryoverSourceDate = null;
  let principles = [];
  let vision = [];

  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  function formatDate(dateStr) {
    const [year, month, day] = dateStr.split('-').map(Number);
    return `${MONTHS[month - 1]} ${day}, ${year}`;
  }

  async function ensureLookups() {
    [principles, vision] = await Promise.all([API.getPrinciples(), API.getVision()]);
  }

  function renderFocusSummary() {
    const focusCount = tasks.filter((task) => task.focus).length;
    const completedFocusCount = tasks.filter((task) => task.focus && task.completed).length;
    const summary = document.getElementById('focus-summary');

    summary.innerHTML = `
      <div class="focus-summary-card">
        <div>
          <div class="focus-summary-title">Daily focus</div>
          <div class="focus-summary-copy">${focusCount}/3 focus slots used${focusCount ? `, ${completedFocusCount} completed` : ''}</div>
        </div>
        <div class="focus-summary-value">${focusCount}</div>
      </div>
    `;
  }

  function daysBetweenISO(fromISO, toISO) {
    const [y1, m1, d1] = fromISO.split('-').map(Number);
    const [y2, m2, d2] = toISO.split('-').map(Number);
    const from = new Date(y1, m1 - 1, d1);
    const to = new Date(y2, m2 - 1, d2);
    return Math.round((to - from) / 86400000);
  }

  function renderCarryover() {
    const banner = document.getElementById('carryover-banner');

    if (!carryoverTasks.length || !carryoverSourceDate) {
      banner.classList.add('hidden');
      banner.innerHTML = '';
      return;
    }

    const gap = daysBetweenISO(carryoverSourceDate, currentDate);
    const gapSuffix = gap > 1 ? ` <span class="carryover-gap">(${gap} days ago)</span>` : '';

    banner.classList.remove('hidden');
    banner.innerHTML = `
      <div class="carryover-header">
        <div>
          <div class="carryover-title">Unfinished from ${formatDate(carryoverSourceDate)}${gapSuffix}</div>
          <div class="carryover-copy">Move what still matters into ${formatDate(currentDate)}.</div>
        </div>
        <button class="ghost-btn" data-action="carryover-all">Move all here</button>
      </div>
      <div class="carryover-list">
        ${carryoverTasks.map((task) => `
          <button class="carryover-chip" data-action="carryover-one" data-id="${task.id}">
            <span>${escapeHtml(task.title)}</span>
            <span>Move</span>
          </button>
        `).join('')}
      </div>
    `;
  }

  function renderTasks() {
    const list = document.getElementById('tasks-list');

    if (tasks.length === 0) {
      list.innerHTML = '<div class="empty-state">No tasks for this day. Add your first task below.</div>';
      return;
    }

    list.innerHTML = tasks.map((task) => {
      const meta = [];
      if (task.principle_text) meta.push(`<span class="meta-chip">Principle: ${escapeHtml(task.principle_text)}</span>`);
      if (task.vision_title) meta.push(`<span class="meta-chip">Vision: ${escapeHtml(task.vision_title)}</span>`);

      return `
        <div class="item-card ${task.focus ? 'focused' : ''}" data-id="${task.id}">
          <div class="item-main">
            <div class="task-checkbox ${task.completed ? 'checked' : ''}" data-action="toggle"></div>
            <span class="item-title ${task.completed ? 'completed' : ''}" data-action="expand">${escapeHtml(task.title)}</span>
            ${task.focus ? '<span class="item-badge item-badge-focus">Focus</span>' : ''}
            ${task.source === 'idea' ? '<span class="item-badge">from idea</span>' : ''}
            <div class="item-actions">
              <button class="action-btn" data-action="focus" title="Toggle focus">${task.focus ? '&#9733;' : '&#9734;'}</button>
              <button class="action-btn" data-action="edit" title="Edit">&#9998;</button>
              <button class="action-btn delete-btn" data-action="delete" title="Delete">&#10005;</button>
            </div>
          </div>
          ${(task.details || meta.length) ? `
            <div class="item-details visible" data-action="expand-target">
              ${task.details ? `<div>${escapeHtml(task.details)}</div>` : ''}
              ${meta.length ? `<div class="item-meta">${meta.join('')}</div>` : ''}
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  }

  function openTaskEditor(task) {
    window.AppModal.open({
      title: 'Edit Task',
      name: task.title,
      details: task.details,
      fields: {
        date: task.date,
        principleId: task.principle_id,
        visionId: task.vision_id,
        focus: task.focus,
      },
      options: { principles, vision },
      extraActions: [
        {
          label: 'Move to tomorrow',
          onClick: () => window.runAppAction(async () => {
            await API.rescheduleTask(task.id, window.DateUtils.shift(task.date, 1));
            await load();
          }),
        },
        {
          label: 'Move to next week',
          onClick: () => window.runAppAction(async () => {
            await API.rescheduleTask(task.id, window.DateUtils.shift(task.date, 7));
            await load();
          }),
        },
      ],
      onSave: (values) => window.runAppAction(async () => {
        await API.updateTask(task.id, {
          title: values.name,
          details: values.details,
          date: values.date,
          principle_id: values.principleId,
          vision_id: values.visionId,
          focus: values.focus,
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
    const task = tasks.find((item) => item.id === id);
    if (!task) return;

    if (action === 'toggle') {
      window.runAppAction(async () => {
        await API.toggleTask(id, task.completed ? 0 : 1);
        await load();
      });
      return;
    }

    if (action === 'focus') {
      window.runAppAction(async () => {
        await API.setTaskFocus(id, task.focus ? 0 : 1);
        await load();
      });
      return;
    }

    if (action === 'edit') {
      openTaskEditor(task);
      return;
    }

    if (action === 'delete') {
      window.AppModal.confirmDelete(() => window.runAppAction(async () => {
        await API.deleteTask(id);
        await load();
      }));
    }
  }

  function handleCarryoverClick(event) {
    const action = event.target.dataset.action || event.target.closest('[data-action]')?.dataset.action;
    if (!action) return;

    if (action === 'carryover-all') {
      window.runAppAction(async () => {
        for (const task of carryoverTasks) {
          await API.rescheduleTask(task.id, currentDate);
        }
        await load();
      });
      return;
    }

    if (action === 'carryover-one') {
      const trigger = event.target.closest('[data-id]');
      const id = Number(trigger?.dataset.id);
      if (!id) return;

      window.runAppAction(async () => {
        await API.rescheduleTask(id, currentDate);
        await load();
      });
    }
  }

  async function addTask() {
    const input = document.getElementById('task-input');
    const title = input.value.trim();
    if (!title) return;

    input.value = '';
    await API.createTask({ title, date: currentDate });
    await load();
  }

  async function renderSummary() {
    const view = document.getElementById('summary-view');
    const data = await API.getSummary({ date: currentDate });

    view.innerHTML = `
      <div class="summary-header">
        <div>
          <div class="summary-kicker">Week ${escapeHtml(data.week)}</div>
          <h3 class="summary-heading">Review for the week of ${escapeHtml(formatDate(data.dateRange.from))}</h3>
        </div>
      </div>
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
          <div class="summary-stat-value">${data.focusedCompletedTasks}/${data.focusedTasks}</div>
          <div class="summary-stat-label">Focus Done</div>
        </div>
        <div class="summary-stat">
          <div class="summary-stat-value">${data.ideasConverted}</div>
          <div class="summary-stat-label">Ideas Used</div>
        </div>
      </div>
      ${data.dailyBreakdown.map((day) => `
        <div class="summary-day">
          <div class="summary-day-header">
            <span class="summary-day-name">${escapeHtml(day.day)}</span>
            <span class="summary-day-count">${day.completedCount}/${day.tasks.length} done${day.focusCount ? ` � ${day.focusCount} focus` : ''}</span>
          </div>
          ${day.tasks.length ? `
            <ul class="summary-day-tasks">
              ${day.tasks.map((task) => `<li>${task.completed ? '&#10003; ' : ''}${escapeHtml(task.title)}</li>`).join('')}
            </ul>
          ` : '<div class="summary-day-empty">No tasks logged.</div>'}
        </div>
      `).join('')}
      <div class="weekly-review">
        <div class="weekly-review-header">
          <h4>Weekly review</h4>
          <p>Capture what worked, what blocked you, and what deserves next week&apos;s attention.</p>
        </div>
        <label class="review-field">
          <span>Wins</span>
          <textarea id="review-wins" class="modal-textarea review-textarea" placeholder="What moved forward this week?">${escapeHtml(data.review.wins)}</textarea>
        </label>
        <label class="review-field">
          <span>Blockers</span>
          <textarea id="review-blockers" class="modal-textarea review-textarea" placeholder="What slowed you down?">${escapeHtml(data.review.blockers)}</textarea>
        </label>
        <label class="review-field">
          <span>What changed</span>
          <textarea id="review-changes" class="modal-textarea review-textarea" placeholder="What did you learn or adjust?">${escapeHtml(data.review.changesSummary)}</textarea>
        </label>
        <label class="review-field">
          <span>Next week focus</span>
          <textarea id="review-next-focus" class="modal-textarea review-textarea" placeholder="What should matter next week?">${escapeHtml(data.review.nextFocus)}</textarea>
        </label>
        <div class="weekly-review-actions">
          <button class="btn" id="save-weekly-review" data-week="${escapeHtml(data.week)}">Save weekly review</button>
          <button class="summary-close" id="summary-close">Close</button>
        </div>
      </div>
    `;

    view.classList.remove('hidden');
  }

  function filterByDaysAgo(tasks, days) {
    const today = new Date(window.DateUtils.today() + 'T00:00:00');
    const cutoff = new Date(today);
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    return tasks.filter((t) => t.date >= cutoffStr);
  }

  function renderUnfinishedSection(label, items) {
    if (!items.length) {
      return `
        <div class="unfinished-section">
          <div class="unfinished-section-header">
            <span class="unfinished-section-label">${label}</span>
            <span class="unfinished-section-count">0 tasks</span>
          </div>
          <div class="summary-day-empty">No unfinished tasks.</div>
        </div>
      `;
    }

    return `
      <div class="unfinished-section">
        <div class="unfinished-section-header">
          <span class="unfinished-section-label">${label}</span>
          <span class="unfinished-section-count">${items.length} task${items.length !== 1 ? 's' : ''}</span>
        </div>
        <div class="unfinished-task-list">
          ${items.map((t) => `
            <div class="unfinished-task-item">
              <span class="unfinished-task-title">${escapeHtml(t.title)}</span>
              <span class="unfinished-task-date">${formatDate(t.date)}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  async function renderUnfinished() {
    const view = document.getElementById('unfinished-view');
    const allTasks = await API.getUnfinishedTasks();

    const oneWeek = filterByDaysAgo(allTasks, 7);
    const twoWeeks = filterByDaysAgo(allTasks, 14);
    const oneMonth = allTasks;

    view.innerHTML = `
      <div class="unfinished-header">
        <div>
          <div class="summary-kicker">Overdue</div>
          <h3 class="summary-heading">Unfinished tasks</h3>
        </div>
      </div>
      <div class="unfinished-stats">
        <div class="summary-stat">
          <div class="summary-stat-value">${oneWeek.length}</div>
          <div class="summary-stat-label">7 Days</div>
        </div>
        <div class="summary-stat">
          <div class="summary-stat-value">${twoWeeks.length}</div>
          <div class="summary-stat-label">14 Days</div>
        </div>
        <div class="summary-stat">
          <div class="summary-stat-value">${oneMonth.length}</div>
          <div class="summary-stat-label">30 Days</div>
        </div>
      </div>
      ${renderUnfinishedSection('Last 7 days', oneWeek)}
      ${renderUnfinishedSection('Last 14 days', twoWeeks)}
      ${renderUnfinishedSection('Last 30 days', oneMonth)}
      <div class="weekly-review-actions">
        <button class="summary-close" id="unfinished-close">Close</button>
      </div>
    `;

    view.classList.remove('hidden');
  }

  async function loadUnfinished() {
    const view = document.getElementById('unfinished-view');
    if (!view.classList.contains('hidden')) {
      view.classList.add('hidden');
      return;
    }

    await renderUnfinished();
  }

  async function loadSummary() {
    const view = document.getElementById('summary-view');
    if (!view.classList.contains('hidden')) {
      view.classList.add('hidden');
      return;
    }

    await renderSummary();
  }

  async function load() {
    document.getElementById('current-date').textContent = formatDate(currentDate);
    await ensureLookups();

    const [currentTasks, carryover] = await Promise.all([
      API.getTasks(currentDate),
      API.getCarryover(currentDate, 7),
    ]);

    tasks = currentTasks;
    carryoverTasks = carryover.tasks || [];
    carryoverSourceDate = carryover.sourceDate || null;

    renderCarryover();
    renderFocusSummary();
    renderTasks();

    const summaryView = document.getElementById('summary-view');
    if (!summaryView.classList.contains('hidden')) {
      await renderSummary();
    }
  }

  function init() {
    document.getElementById('prev-day').addEventListener('click', () => {
      currentDate = window.DateUtils.shift(currentDate, -1);
      window.runAppAction(() => load());
    });

    document.getElementById('next-day').addEventListener('click', () => {
      currentDate = window.DateUtils.shift(currentDate, 1);
      window.runAppAction(() => load());
    });

    document.getElementById('today-btn').addEventListener('click', () => {
      currentDate = window.DateUtils.today();
      window.runAppAction(() => load());
    });

    document.getElementById('tasks-list').addEventListener('click', handleClick);
    document.getElementById('carryover-banner').addEventListener('click', handleCarryoverClick);
    document.getElementById('add-task-btn').addEventListener('click', () => window.runAppAction(() => addTask()));
    document.getElementById('task-input').addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        window.runAppAction(() => addTask());
      }
    });

    document.getElementById('summary-toggle').addEventListener('click', () => window.runAppAction(() => loadSummary()));
    document.getElementById('unfinished-toggle').addEventListener('click', () => window.runAppAction(() => loadUnfinished()));
    document.getElementById('unfinished-view').addEventListener('click', (event) => {
      if (event.target.id === 'unfinished-close') {
        document.getElementById('unfinished-view').classList.add('hidden');
      }
    });
    document.getElementById('summary-view').addEventListener('click', (event) => {
      if (event.target.id === 'summary-close') {
        document.getElementById('summary-view').classList.add('hidden');
        return;
      }

      if (event.target.id === 'save-weekly-review') {
        const week = event.target.dataset.week;
        window.runAppAction(async () => {
          await API.saveWeeklyReview({
            week,
            wins: document.getElementById('review-wins').value.trim(),
            blockers: document.getElementById('review-blockers').value.trim(),
            changesSummary: document.getElementById('review-changes').value.trim(),
            nextFocus: document.getElementById('review-next-focus').value.trim(),
          });
          await renderSummary();
        });
      }
    });
  }

  return { init, load };
})();

