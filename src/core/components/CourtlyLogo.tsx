interface CourtlyLogoProps {
  className?: string;
  size?: number;
}

export function CourtlyLogo({ className = "", size = 120 }: CourtlyLogoProps) {
  return (
    <img
      src="/images/courtly-mark.png"
      alt="Courtly"
      width={size}
      height={size}
      className={className}
    />
  );
}
