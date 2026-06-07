export type DailyPlanPeriod = {
  endExclusive: Date;
  marker: string;
  shortLabel: string;
  start: Date;
  title: string;
};

export function getDailyPlanPeriod(value = new Date()): DailyPlanPeriod {
  const start = startOfLocalDay(value);
  const endExclusive = addDays(start, 1);
  const key = dateKey(start);

  return {
    endExclusive,
    marker: `<!-- daily-plan:${key} -->`,
    shortLabel: key,
    start,
    title: `今日开工 ${key}`,
  };
}

function startOfLocalDay(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(value: Date, days: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function dateKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
