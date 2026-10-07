import type { SVGProps } from "react";
import type { DieSides } from "./diceRoller.types";

interface DiceIconProps extends SVGProps<SVGSVGElement> {
  sides: DieSides;
  size?: number | string;
}

export function DieIcon({ sides, size = 28, className, ...props }: DiceIconProps) {
  switch (sides) {
    case 4:
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          aria-hidden="true"
          {...props}
        >
          {/* d4: Tetrahedron */}
          <polygon points="12 3 2 20 22 20" />
          <line x1="12" y1="3" x2="12" y2="15" />
          <line x1="2" y1="20" x2="12" y2="15" />
          <line x1="22" y1="20" x2="12" y2="15" />
        </svg>
      );

    case 6:
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          aria-hidden="true"
          {...props}
        >
          {/* d6: Cube isometric */}
          <polygon points="12 2 21 7 21 17 12 22 3 17 3 7" />
          <line x1="12" y1="12" x2="21" y2="7" />
          <line x1="12" y1="12" x2="3" y2="7" />
          <line x1="12" y1="12" x2="12" y2="22" />
        </svg>
      );

    case 8:
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          aria-hidden="true"
          {...props}
        >
          {/* d8: Octahedron */}
          <polygon points="12 2 21 12 12 22 3 12" />
          <polyline points="3 12 12 16 21 12" />
          <polyline points="3 12 12 8 21 12" />
          <line x1="12" y1="2" x2="12" y2="8" />
          <line x1="12" y1="16" x2="12" y2="22" />
        </svg>
      );

    case 10:
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          aria-hidden="true"
          {...props}
        >
          {/* d10: Pentagonal Trapezohedron */}
          <polygon points="12 2 20 8 18 19 12 22 6 19 4 8" />
          <line x1="12" y1="2" x2="12" y2="12" />
          <line x1="4" y1="8" x2="12" y2="12" />
          <line x1="20" y1="8" x2="12" y2="12" />
          <line x1="6" y1="19" x2="12" y2="12" />
          <line x1="18" y1="19" x2="12" y2="12" />
          <line x1="12" y1="22" x2="12" y2="12" />
        </svg>
      );

    case 12:
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          aria-hidden="true"
          {...props}
        >
          {/* d12: Dodecahedron */}
          <polygon points="12 2 20.5 8 17.5 18 6.5 18 3.5 8" />
          <polygon points="12 7 16.5 10.5 15 15.5 9 15.5 7.5 10.5" />
          <line x1="12" y1="2" x2="12" y2="7" />
          <line x1="20.5" y1="8" x2="16.5" y2="10.5" />
          <line x1="17.5" y1="18" x2="15" y2="15.5" />
          <line x1="6.5" y1="18" x2="9" y2="15.5" />
          <line x1="3.5" y1="8" x2="7.5" y2="10.5" />
        </svg>
      );

    case 20:
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          aria-hidden="true"
          {...props}
        >
          {/* d20: Icosahedron */}
          <polygon points="12 2 21 7.5 21 16.5 12 22 3 16.5 3 7.5" />
          <polygon points="12 7 18 17 6 17" />
          <line x1="12" y1="2" x2="12" y2="7" />
          <line x1="21" y1="7.5" x2="18" y2="17" />
          <line x1="3" y1="7.5" x2="6" y2="17" />
          <line x1="21" y1="16.5" x2="18" y2="17" />
          <line x1="3" y1="16.5" x2="6" y2="17" />
          <line x1="12" y1="22" x2="18" y2="17" />
          <line x1="12" y1="22" x2="6" y2="17" />
          <line x1="12" y1="7" x2="21" y2="7.5" />
          <line x1="12" y1="7" x2="3" y2="7.5" />
        </svg>
      );

    case 100:
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          aria-hidden="true"
          {...props}
        >
          {/* d100: Percentile faceted die */}
          <circle cx="12" cy="12" r="9.5" />
          <polygon points="12 4 19 12 12 20 5 12" />
          <polygon points="12 7 16 12 12 17 8 12" />
          <line x1="12" y1="2.5" x2="12" y2="4" />
          <line x1="12" y1="20" x2="12" y2="21.5" />
          <line x1="2.5" y1="12" x2="5" y2="12" />
          <line x1="19" y1="12" x2="21.5" y2="12" />
        </svg>
      );

    default:
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          className={className}
          aria-hidden="true"
          {...props}
        >
          <rect x="3" y="3" width="18" height="18" rx="3" />
        </svg>
      );
  }
}
