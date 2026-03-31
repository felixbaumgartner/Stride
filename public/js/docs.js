window.DocsTab = (() => {
  let docs = [];
  const saveTimers = {};

  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  function formatDate(dateStr) {
    const [year, month, day] = dateStr.split('-').map(Number);
    return `${MONTHS[month - 1]} ${day}, ${year}`;
  }

  function getDayName(dateStr) {
    const d = window.DateUtils.fromISODate(dateStr);
    return DAYS[d.getDay()];
  }

  function setStatus(text) {
    const el = document.getElementById('docs-save-status');
    el.textContent = text;
    el.classList.toggle('visible', Boolean(text));
    if (text === 'Saved') {
      setTimeout(() => setStatus(''), 2000);
    }
  }

  function autoResize(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  }

  async function saveEntry(docId, content) {
    setStatus('Saving...');
    try {
      await API.updateDoc(docId, { content });
      setStatus('Saved');
    } catch {
      setStatus('Save failed');
    }
  }

  function scheduleSave(docId, content) {
    clearTimeout(saveTimers[docId]);
    saveTimers[docId] = setTimeout(() => {
      window.runAppAction(() => saveEntry(docId, content));
    }, 1000);
  }

  function renderEntries() {
    const container = document.getElementById('journal-entries');
    const sorted = [...docs].sort((a, b) => b.date.localeCompare(a.date));
    const today = window.DateUtils.today();

    container.innerHTML = sorted.map((doc) => {
      const isToday = doc.date === today;
      return `
        <div class="journal-entry${isToday ? ' journal-entry-today' : ''}" data-id="${doc.id}" data-date="${doc.date}">
          <div class="journal-entry-header">
            <span class="journal-entry-date">${getDayName(doc.date)}, ${formatDate(doc.date)}</span>
            ${isToday ? '<span class="journal-today-badge">Today</span>' : ''}
          </div>
          <textarea class="journal-entry-content" placeholder="Write something..."></textarea>
        </div>`;
    }).join('');

    sorted.forEach((doc, i) => {
      const textarea = container.querySelectorAll('.journal-entry-content')[i];
      textarea.value = doc.content || '';
      autoResize(textarea);
    });
  }

  async function addEntryForDate(date) {
    const existing = docs.find((d) => d.date === date);
    if (existing) {
      const el = document.querySelector(`.journal-entry[data-date="${date}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        el.querySelector('.journal-entry-content').focus();
      }
      return;
    }
    const doc = await API.createDoc({ title: date, content: '', date });
    docs.push(doc);
    renderEntries();
    const el = document.querySelector(`.journal-entry[data-date="${date}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      el.querySelector('.journal-entry-content').focus();
    }
  }

  function downloadJournal() {
    const sorted = [...docs].sort((a, b) => a.date.localeCompare(b.date));
    let md = '# Journal\n\n';
    for (const doc of sorted) {
      md += `## ${getDayName(doc.date)}, ${formatDate(doc.date)}\n\n`;
      md += `${doc.content || '(empty)'}\n\n---\n\n`;
    }
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'journal.md';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function load() {
    docs = await API.getDocs();

    const today = window.DateUtils.today();
    if (!docs.find((d) => d.date === today)) {
      const doc = await API.createDoc({ title: today, content: '', date: today });
      docs.push(doc);
    }

    renderEntries();
  }

  function init() {
    const container = document.getElementById('journal-entries');

    container.addEventListener('input', (e) => {
      if (!e.target.classList.contains('journal-entry-content')) return;
      autoResize(e.target);
      const entry = e.target.closest('.journal-entry');
      const id = Number(entry.dataset.id);
      scheduleSave(id, e.target.value);
      const doc = docs.find((d) => d.id === id);
      if (doc) doc.content = e.target.value;
    });

    document.getElementById('docs-date-picker').addEventListener('change', (e) => {
      if (e.target.value) {
        window.runAppAction(() => addEntryForDate(e.target.value));
        e.target.value = '';
      }
    });

    document.getElementById('docs-download-btn').addEventListener('click', downloadJournal);
  }

  return { init, load };
})();
