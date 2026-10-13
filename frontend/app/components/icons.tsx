// Small inline SVG icons (stroke = currentColor). No icon library needed.
import * as React from "react";

type IconProps = { className?: string };

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export const PencilIcon = ({ className }: IconProps) => (
  <svg {...base} className={className ?? "h-5 w-5"} style={{ color: "#fff" }}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
);
export const DownloadIcon = ({ className }: IconProps) => (
  <svg {...base} className={className ?? "h-5 w-5"} style={{ color: "#fff" }}><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></svg>
);
export const PlusIcon = ({ className }: IconProps) => (
  <svg {...base} className={className ?? "h-5 w-5"} style={{ color: "#fff" }}><path d="M12 5v14" /><path d="M5 12h14" /></svg>
);
export const MinusIcon = ({ className }: IconProps) => (
  <svg {...base} className={className ?? "h-5 w-5"} style={{ color: "#fff" }}><path d="M5 12h14" /></svg>
);
export const UndoIcon = ({ className }: IconProps) => (
  <svg {...base} className={className ?? "h-5 w-5"} style={{ color: "#fff" }}><path d="M9 14 4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 0 12h-3" /></svg>
);
export const ZoomIcon = ({ className }: IconProps) => (
  <svg {...base} className={className ?? "h-5 w-5"} style={{ color: "#fff" }}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /><path d="M11 8v6" /><path d="M8 11h6" /></svg>
);
