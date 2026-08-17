type BrandWordmarkProps = {
  className?: string;
};

export function BrandWordmark({ className = "" }: BrandWordmarkProps) {
  return (
    <span
      aria-label="365x100"
      className={`inline-flex font-bold leading-none tracking-[-0.045em] [font-family:var(--font-league-spartan)] ${className}`}
      role="img"
    >
      <span aria-hidden="true" className="text-[#000000]">
        365<span className="text-[#ff3131]">x</span>100
      </span>
    </span>
  );
}
