import * as React from "react";

interface ChevronDownProps extends React.SVGAttributes<SVGSVGElement> {
  size?: number | string;
}

export function ChevronDown({ size = 14, className, ...props }: ChevronDownProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <polyline points="4 6 8 10 12 6" />
    </svg>
  );
}
