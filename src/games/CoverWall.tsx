// The page backdrop: the shown year's covers tiled on a tilted wall, faded almost to nothing and drifting up.
// 60 tiles fill 6 columns or 4 evenly, and the tiles appear twice so the drift loops without a seam.
const TILES = 60;

export function CoverWall({ covers }: { covers: string[] }) {
  if (covers.length === 0) return null;
  const tiles = Array.from(
    { length: TILES * 2 },
    (_, index) => covers[(index % TILES) % covers.length],
  );
  return (
    <div className="cover-wall" aria-hidden="true">
      <div className="cover-wall-track">
        {tiles.map((cover, index) => (
          <img key={index} src={cover} alt="" decoding="async" />
        ))}
      </div>
    </div>
  );
}
