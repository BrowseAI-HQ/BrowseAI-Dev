interface BrowseLogoProps {
  className?: string;
}

export function BrowseLogo({ className = "w-4 h-4" }: BrowseLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 40 40"
      className={className}
      fill="none"
    >
      <line x1="13" y1="8" x2="13" y2="33" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
      <path
        d="M13 8 C22 8, 26 9.5, 26 14 C26 18.5, 22 20, 13 20"
        stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"
      />
      <path
        d="M13 20 C23 20, 28 21.5, 28 27 C28 32, 23 33, 13 33"
        stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  );
}
