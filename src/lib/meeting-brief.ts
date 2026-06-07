export type MeetingBriefScope = "today" | "week";

export type MeetingBriefPeriod = {
  endExclusive: Date;
  marker: string;
  shortLabel: string;
  start: Date;
  title: string;
};

export function getMeetingBriefPeriod(
  value = new Date(),
  scope: MeetingBriefScope = "week",
): MeetingBriefPeriod {
  const today = startOfLocalDay(value);
  const start = scope === "today" ? today : startOfWeek(today);
  const endExclusive = addDays(start, scope === "today" ? 1 : 7);
  const endInclusive = addDays(endExclusive, -1);
  const startKey = dateKey(start);
  const endKey = dateKey(endInclusive);
  const shortLabel = scope === "today" ? startKey : `${monthDay(start)} 至 ${monthDay(endInclusive)}`;

  return {
    endExclusive,
    marker: `<!-- meeting-brief:${scope}:${startKey} -->`,
    shortLabel,
    start,
    title: scope === "today" ? `组会/周报准备 ${startKey}` : `组会/周报准备 ${startKey} 至 ${endKey}`,
  };
}

function startOfLocalDay(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function startOfWeek(value: Date) {
  const date = startOfLocalDay(value);
  const day = date.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  return addDays(date, offset);
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

function monthDay(value: Date) {
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${month}-${day}`;
}
