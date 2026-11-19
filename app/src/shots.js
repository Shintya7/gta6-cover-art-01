// Fixed scenes for screenshots: ?shot=editor shows the page with sample photos
// loaded; ?shot=cover shows the cover alone, filling the viewport.
// Query knobs: size (1080x1080 | 1080x1350 | 1920x1080), layout (poster |
// triptych | single), grade (sunset | neon | noir | golden), caption,
// subcaption, captionPosition (bottom | top), captionColor (white | yellow |
// pink), photos (comma list of sample names, one per panel), zoom (comma list
// of zooms, one per panel), pan (comma list of vertical pans as a fraction of
// the panel height, one per panel; positive shows the photo's top).
// window.__shotReady is set once the scene is painted.
export async function runShot(shot, query, applyScene) {
  if (shot === 'cover') document.body.classList.add('shot-cover');
  const photos = (query.get('photos') ?? 'pier,boulevard,pier').split(',').map((s) => s.trim());
  const zooms = (query.get('zoom') ?? '').split(',').map((s) => Number(s) || 1);
  const pans = (query.get('pan') ?? '').split(',').map((s) => Number(s) || 0);
  const tweaks = photos.map((_, i) => ({ zoom: zooms[i] || 1, oyFrac: pans[i] || 0 }));
  await applyScene({
    layout: query.get('layout') ?? 'poster',
    size: query.get('size') ?? '1080x1080',
    grade: query.get('grade') ?? 'sunset',
    caption: query.get('caption') ?? 'Sunset Heist',
    subcaption: query.get('subcaption') ?? 'Palms · Sunset · Neon',
    captionPosition: query.get('captionPosition') ?? 'bottom',
    captionColor: query.get('captionColor') ?? 'white',
    photos,
    tweaks,
  });
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}
