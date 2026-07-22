type SidequestWordmarkProps = {
  className?: string;
};

export function SidequestWordmark({ className }: SidequestWordmarkProps) {
  return (
    <span className={className} aria-label="Sidequest">
      <svg
        aria-hidden="true"
        viewBox="0 0 28 28"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M20.9 12.1a7.3 7.3 0 1 0-7.3 9.2c3.1 0 5.8-1.9 5.8-4.6 0-2.5-2.2-4.2-5-4.2h-3.1"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="21" cy="8.4" r="2.3" fill="currentColor" />
      </svg>
      <span>sidequest</span>
    </span>
  );
}
