function pad(value) {
  return String(value).padStart(2, '0');
}

function formatLocalDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseISODate(dateStr) {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return null;
  }

  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setHours(12, 0, 0, 0);
  return date;
}

function getTodayDate() {
  return formatLocalDate(new Date());
}

function shiftISODate(dateStr, offset) {
  const baseDate = parseISODate(dateStr) || new Date();
  baseDate.setDate(baseDate.getDate() + offset);
  return formatLocalDate(baseDate);
}

function getISOWeekInfoFromDate(dateStr) {
  const source = parseISODate(dateStr) || new Date();
  source.setHours(12, 0, 0, 0);

  const dayIndex = (source.getDay() + 6) % 7;
  const thursday = new Date(source);
  thursday.setDate(source.getDate() - dayIndex + 3);

  const isoYear = thursday.getFullYear();
  const firstThursday = new Date(isoYear, 0, 4);
  firstThursday.setHours(12, 0, 0, 0);
  const firstDayIndex = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - firstDayIndex + 3);

  const weekNumber = 1 + Math.round((thursday - firstThursday) / 604800000);
  const monday = new Date(thursday);
  monday.setDate(thursday.getDate() - 3);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return {
    week: `${isoYear}-W${pad(weekNumber)}`,
    from: formatLocalDate(monday),
    to: formatLocalDate(sunday),
  };
}

function getISOWeekInfoFromWeek(weekStr) {
  if (!weekStr || !/^\d{4}-W\d{2}$/.test(weekStr)) {
    return getISOWeekInfoFromDate();
  }

  const [yearPart, weekPart] = weekStr.split('-W');
  const year = Number(yearPart);
  const week = Number(weekPart);
  const jan4 = new Date(year, 0, 4);
  jan4.setHours(12, 0, 0, 0);
  const jan4DayIndex = (jan4.getDay() + 6) % 7;
  const mondayOfWeekOne = new Date(jan4);
  mondayOfWeekOne.setDate(jan4.getDate() - jan4DayIndex);

  const monday = new Date(mondayOfWeekOne);
  monday.setDate(mondayOfWeekOne.getDate() + (week - 1) * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return {
    week: `${year}-W${pad(week)}`,
    from: formatLocalDate(monday),
    to: formatLocalDate(sunday),
  };
}

module.exports = {
  formatLocalDate,
  getISOWeekInfoFromDate,
  getISOWeekInfoFromWeek,
  getTodayDate,
  parseISODate,
  shiftISODate,
};
