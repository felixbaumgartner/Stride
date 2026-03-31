window.DocsTab = (() => {
  let currentDate = window.DateUtils.today();
  let currentDocId = null;
  let saveTimer = null;

  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  function formatDate(dateStr) {
    const [year, month, day] = dateStr.split('-').map(Number);
    return `${MONTHS[month - 1]} ${day}, ${year}`;
  }

  function setStatus(text) {
    const el = document.getElementById('docs-save-status');
    el.textContent = text;
    el.classList.toggle('visible', Boolean(text));
  }

  async function autoSave() {
    const editor = document.getElementById('docs-editor');
    const content = editor.value;

    if (!content.trim() && !currentDocId) return;

    setStatus('Saving...');
    try {
      if (!currentDocId) {
        const doc = await API.createDoc({ title: currentDate, content, date: currentDate });
        currentDocId = doc.id;
      } else {
        await API.updateDoc(currentDocId, { content });
      }
      setStatus('Saved');
      setTimeout(() => setStatus(''), 2000);
    } catch {
      setStatus('Save failed');
    }
  }

  function scheduleAutoSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      window.runAppAction(() => autoSave());
    }, 1000);
  }

  function flushSave() {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
      const editor = document.getElementById('docs-editor');
      if (currentDocId || editor.value.trim()) {
        autoSave();
      }
    }
  }

  async function load() {
    document.getElementById('docs-date').textContent = formatDate(currentDate);
    document.getElementById('docs-date-picker').value = currentDate;

    clearTimeout(saveTimer);
    saveTimer = null;

    const docs = await API.getDocs(currentDate);
    const editor = document.getElementById('docs-editor');

    if (docs.length > 0) {
      currentDocId = docs[0].id;
      editor.value = docs[0].content || '';
    } else {
      currentDocId = null;
      editor.value = '';
    }
  }

  function changeDate(newDate) {
    flushSave();
    currentDate = newDate;
    window.runAppAction(() => load());
  }

  function init() {
    document.getElementById('docs-prev').addEventListener('click', () => {
      changeDate(window.DateUtils.shift(currentDate, -1));
    });

    document.getElementById('docs-next').addEventListener('click', () => {
      changeDate(window.DateUtils.shift(currentDate, 1));
    });

    document.getElementById('docs-today').addEventListener('click', () => {
      changeDate(window.DateUtils.today());
    });

    document.getElementById('docs-date-picker').addEventListener('change', (e) => {
      if (e.target.value) changeDate(e.target.value);
    });

    document.getElementById('docs-editor').addEventListener('input', scheduleAutoSave);
  }

  return { init, load };
})();
