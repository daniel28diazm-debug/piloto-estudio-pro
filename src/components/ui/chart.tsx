// Stubbed — this project uses Recharts directly without the shadcn chart wrapper.
import * as React from "react";

export type ChartConfig = Record<string, { label?: React.ReactNode; color?: string }>;
export const ChartContainer = ({ children }: { children: React.ReactNode; config?: ChartConfig; className?: string }) => <>{children}</>;
export const ChartTooltip = () => null;
export const ChartTooltipContent = () => null;
export const ChartLegend = () => null;
export const ChartLegendContent = () => null;
export const ChartStyle = () => null;
