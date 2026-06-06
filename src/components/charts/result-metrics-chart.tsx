"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function ResultMetricsChart({
  data,
}: {
  data: Array<{ name: string; value: number }>;
}) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ left: 24, right: 12, top: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tickLine={false} axisLine={false} />
          <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} width={84} />
          <Tooltip cursor={{ fill: "rgba(33,95,96,0.08)" }} />
          <Bar dataKey="value" fill="var(--chart-2)" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
