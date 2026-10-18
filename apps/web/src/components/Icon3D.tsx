/**
 * A three-dimensional picture for the large showcase tiles (home steps, what a
 * course brings) -- Microsoft's Fluent Emoji 3D (MIT, public/icons/3d/LICENSE.txt),
 * kept in the site. The owner chose these for showcases and the Solar line of
 * Glyph for menus, panels and buttons (2026-10-18). Decorative: the tile's
 * text says what it is.
 */
const FILES = {
  book: "books",
  target: "bullseye",
  list: "memo",
  trophy: "trophy",
  play: "clapper_board",
  gift: "wrapped_gift",
  bookmark: "bookmark",
  compass: "compass",
} as const;

export type Icon3DName = keyof typeof FILES;

export function Icon3D({ name, size = 48, className }: { name: Icon3DName; size?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={className ? `icon3d ${className}` : "icon3d"}
      src={`/icons/3d/${FILES[name]}.png`}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      loading="lazy"
      decoding="async"
    />
  );
}
