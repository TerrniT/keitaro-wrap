import { Area, AreaChart, ResponsiveContainer } from "recharts";

import type { TrendPoint } from "@/lib/api";

interface SparklineProps {
  data: TrendPoint[];
  color?: string;
  height?: number;
  dataKey?: "clicks" | "conversions" | "profit";
}

export function Sparkline({
  data,
  color = "#2f9e44",
  height = 38,
  dataKey = "clicks",
}: SparklineProps) {
  if (!data || data.length === 0) {
    return <div className="h-[38px] w-full rounded bg-muted/40" />;
  }
  const gradientId = `spark-${dataKey}-${color.replace("#", "")}`;
  return (
    <div style={{ height }} className="w-full min-w-[90px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={1.7}
            fill={`url(#${gradientId})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
