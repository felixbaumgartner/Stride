window.AlignmentTab = (() => {
  let period = '30d';
  let data = null;

  function formatDate(dateStr) {
    const date = window.DateUtils.fromISODate(dateStr);
    if (Number.isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function metricCard(label, value, detail = '') {
    return `
      <div class="alignment-metric">
        <div class="alignment-metric-value">${escapeHtml(String(value))}</div>
        <div class="alignment-metric-label">${escapeHtml(label)}</div>
        ${detail ? `<div class="alignment-metric-detail">${escapeHtml(detail)}</div>` : ''}
      </div>
    `;
  }

  function progressRow(title, meta, value) {
    const safeValue = Math.max(0, Math.min(100, Number(value) || 0));
    return `
      <div class="alignment-progress-row">
        <div class="alignment-progress-copy">
          <span>${escapeHtml(title)}</span>
          <small>${escapeHtml(meta)}</small>
        </div>
        <div class="alignment-progress-track" aria-label="${safeValue}% aligned">
          <span style="width: ${safeValue}%"></span>
        </div>
        <strong>${safeValue}%</strong>
      </div>
    `;
  }

  function renderCoverageList(items, emptyText, titleKey) {
    if (!items.length) {
      return `<div class="alignment-empty">${escapeHtml(emptyText)}</div>`;
    }

    return items.map((item) => {
      const total = item.task_count + item.idea_count;
      const completed = item.task_count ? Math.round((item.completed_task_count / item.task_count) * 100) : 0;
      const title = item[titleKey];
      return `
        <div class="alignment-coverage-item">
          <div>
            <div class="alignment-coverage-title">${escapeHtml(title)}</div>
            <div class="alignment-coverage-meta">
              ${item.task_count} task${item.task_count === 1 ? '' : 's'} · ${item.idea_count} idea${item.idea_count === 1 ? '' : 's'} · ${item.focus_task_count} focus
            </div>
          </div>
          <div class="alignment-coverage-score">${total ? completed + '%' : 'Quiet'}</div>
        </div>
      `;
    }).join('');
  }

  function renderAttentionItems(items, emptyText, formatter) {
    if (!items.length) return `<div class="alignment-empty">${escapeHtml(emptyText)}</div>`;
    return items.map(formatter).join('');
  }

  function render() {
    const root = document.getElementById('alignment-root');
    if (!root) return;

    if (!data) {
      root.innerHTML = '<div class="empty-state">Loading alignment...</div>';
      return;
    }

    const m = data.metrics;
    root.innerHTML = `
      <div class="alignment-header">
        <div>
          <div class="summary-kicker">Alignment</div>
          <h3 class="summary-heading">${formatDate(data.range.from)} to ${formatDate(data.range.to)}</h3>
        </div>
        <div class="alignment-periods">
          ${['7d', '30d', '90d'].map((value) => `
            <button class="alignment-period ${period === value ? 'active' : ''}" data-period="${value}">${value}</button>
          `).join('')}
        </div>
      </div>

      <div class="alignment-score">
        <div>
          <div class="alignment-score-value">${m.focusAlignmentRate}%</div>
          <div class="alignment-score-label">focus alignment</div>
        </div>
        <div class="alignment-score-copy">
          ${m.linkedFocusTasks}/${m.focusTasks} focus tasks connect to a principle or vision.
        </div>
      </div>

      <div class="alignment-metrics">
        ${metricCard('Task alignment', `${m.taskAlignmentRate}%`, `${m.linkedTasks}/${m.totalTasks} linked`)}
        ${metricCard('Idea alignment', `${m.ideaAlignmentRate}%`, `${m.linkedIdeas}/${m.totalIdeas} linked`)}
        ${metricCard('Completion', `${m.completionRate}%`, `${m.completedTasks}/${m.totalTasks} done`)}
        ${metricCard('Ideas used', m.convertedIdeas, `${m.starredIdeas} starred`)}
      </div>

      <section class="alignment-section">
        <h4>Signals</h4>
        ${progressRow('Tasks tied to direction', `${m.linkedTasks} of ${m.totalTasks}`, m.taskAlignmentRate)}
        ${progressRow('Focus tied to direction', `${m.linkedFocusTasks} of ${m.focusTasks}`, m.focusAlignmentRate)}
        ${progressRow('Ideas tied to direction', `${m.linkedIdeas} of ${m.totalIdeas}`, m.ideaAlignmentRate)}
      </section>

      <section class="alignment-section">
        <h4>Principles in Motion</h4>
        ${renderCoverageList(data.principles, 'No principles yet.', 'text')}
      </section>

      <section class="alignment-section">
        <h4>Vision in Motion</h4>
        ${renderCoverageList(data.vision, 'No vision entries yet.', 'title')}
      </section>

      <section class="alignment-section">
        <h4>Needs Attention</h4>
        <div class="alignment-attention-grid">
          <div>
            <h5>Unlinked focus</h5>
            ${renderAttentionItems(
              data.attention.unlinkedFocusTasks,
              'Every focus task has direction.',
              (task) => `<div class="alignment-attention-item"><span>${escapeHtml(task.title)}</span><small>${escapeHtml(formatDate(task.date))}</small></div>`
            )}
          </div>
          <div>
            <h5>Raw ideas</h5>
            ${renderAttentionItems(
              data.attention.unlinkedIdeas,
              'Active ideas are connected.',
              (idea) => `<div class="alignment-attention-item"><span>${escapeHtml(idea.title)}</span><small>${idea.starred ? 'Starred' : 'Unlinked'}</small></div>`
            )}
          </div>
        </div>
        <div class="alignment-attention-grid">
          <div>
            <h5>Quiet principles</h5>
            ${renderAttentionItems(
              data.attention.quietPrinciples,
              'All principles have recent motion.',
              (item) => `<div class="alignment-attention-item"><span>${escapeHtml(item.text)}</span><small>No recent links</small></div>`
            )}
          </div>
          <div>
            <h5>Quiet vision</h5>
            ${renderAttentionItems(
              data.attention.quietVision,
              'All vision entries have recent motion.',
              (item) => `<div class="alignment-attention-item"><span>${escapeHtml(item.title)}</span><small>No recent links</small></div>`
            )}
          </div>
        </div>
      </section>
    `;
  }

  async function load() {
    data = await API.getAlignment(period);
    render();
  }

  function init() {
    document.getElementById('alignment-root')?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-period]');
      if (!button) return;
      period = button.dataset.period;
      window.runAppAction(() => load());
    });
  }

  return { init, load };
})();
