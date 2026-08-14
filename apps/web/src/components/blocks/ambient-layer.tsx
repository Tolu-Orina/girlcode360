export function AmbientLayer() {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      <span className="ambient-orb ambient-orb-a top-[-80px] right-[-40px] size-[280px]" />
      <span className="ambient-orb ambient-orb-b bottom-[20%] left-[-60px] size-[240px]" />
    </div>
  );
}
