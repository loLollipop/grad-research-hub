export type WritingPackPeriod = {
  marker: string;
  title: string;
  dateKey: string;
};

export function getWritingPackPeriod(value = new Date()): WritingPackPeriod {
  const dateKey = localDateKey(value);

  return {
    marker: `<!-- writing-pack:${dateKey} -->`,
    title: `写作素材包 ${dateKey}`,
    dateKey,
  };
}

function localDateKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
