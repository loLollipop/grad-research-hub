"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function TaskStatusChart({
  data,
}: {
  data: Array<{ name: string; value: number }>;
}) {
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ left: -20, right: 8, top: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tickLine={false} axisLine={false} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
          <Tooltip cursor={{ fill: "rgba(31,61,51,0.08)" }} />
          <Bar dataKey="value" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
