window.DateUtils = (() => {
  const pad = (value) => String(value).padStart(2, '0');

  function toISODate(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function fromISODate(dateStr) {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day, 12, 0, 0, 0);
  }

  function today() {
    return toISODate(new Date());
  }

  function shift(dateStr, offset) {
    const date = fromISODate(dateStr);
    date.setDate(date.getDate() + offset);
    return toISODate(date);
  }

  function getWeek(dateStr) {
    const source = fromISODate(dateStr);
    const dayIndex = (source.getDay() + 6) % 7;
    const thursday = new Date(source);
    thursday.setDate(source.getDate() - dayIndex + 3);

    const year = thursday.getFullYear();
    const firstThursday = new Date(year, 0, 4, 12, 0, 0, 0);
    const firstDayIndex = (firstThursday.getDay() + 6) % 7;
    firstThursday.setDate(firstThursday.getDate() - firstDayIndex + 3);

    const week = 1 + Math.round((thursday - firstThursday) / 604800000);
    return `${year}-W${pad(week)}`;
  }

  return { today, shift, getWeek, fromISODate, toISODate };
})();

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

window.handleAppError = (error) => {
  const message = error?.message || 'Something went wrong';
  window.alert(message);
};

window.runAppAction = async (action) => {
  try {
    return await action();
  } catch (error) {
    window.handleAppError(error);
    return false;
  }
};
