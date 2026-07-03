// Maps a normalized (0..1) video-frame point onto canvas pixels, reproducing
// CSS object-fit:cover for the camera's REAL aspect ratio. Without this, any
// non-16:9 webcam makes the blade drift away from the actual fingertip.
export function mapNormToCanvas(
  nx: number,
  ny: number,
  videoAspect: number,
  canvasW: number,
  canvasH: number
): { x: number; y: number } {
  const canvasAspect = canvasW / canvasH;

  let dispW: number;
  let dispH: number;
  if (videoAspect > canvasAspect) {
    // Video wider than canvas → fill height, crop left/right.
    dispH = canvasH;
    dispW = canvasH * videoAspect;
  } else {
    // Video taller/narrower → fill width, crop top/bottom.
    dispW = canvasW;
    dispH = canvasW / videoAspect;
  }

  return {
    x: nx * dispW + (canvasW - dispW) / 2,
    y: ny * dispH + (canvasH - dispH) / 2
  };
}
