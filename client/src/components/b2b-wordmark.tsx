type B2BWordmarkProps = {
  className?: string;
  compact?: boolean;
};

export function B2BWordmark({
  className = "",
  compact = false,
}: B2BWordmarkProps) {
  return (
    <div
      className={`select-none text-black ${className}`}
      role="img"
      aria-label="Çalışkan B2B"
    >
      <div className={compact ? "h-[3px] w-full bg-current" : "h-1 w-full bg-current"} />

      <div className={`mt-[2px] flex items-end ${compact ? "gap-1" : "gap-1.5"}`}>
        <div
          className={`min-w-0 flex-1 border-current ${compact ? "border-b-[3px] pb-[2px]" : "border-b-4 pb-[3px]"}`}
        >
          <div
            className={`whitespace-nowrap font-black uppercase tracking-[-0.075em] leading-[0.82] ${compact ? "text-[25px] sm:text-[30px]" : "text-[30px] sm:text-[36px]"}`}
            style={{
              fontFamily:
                'Impact, Haettenschweiler, "Arial Narrow Bold", "Arial Black", sans-serif',
              fontStretch: "condensed",
            }}
          >
            ÇALIŞKAN
          </div>
        </div>

        <div
          className={`shrink-0 border-current text-center font-black tracking-[-0.055em] leading-[0.78] ${compact ? "border-b-[3px] pb-[2px] text-[18px] sm:text-[22px]" : "border-b-4 pb-[3px] text-[22px] sm:text-[27px]"}`}
          style={{
            fontFamily:
              'Impact, Haettenschweiler, "Arial Narrow Bold", "Arial Black", sans-serif',
          }}
        >
          B2B
        </div>
      </div>
    </div>
  );
}
