"use client";

export function AgentDot({ accent, size = 8 }: { accent: string; size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-block shrink-0 rounded-full"
      style={{
        width: size,
        height: size,
        background: accent,
        boxShadow: `0 0 0 2px color-mix(in srgb, ${accent} 18%, transparent)`,
      }}
    />
  );
}
