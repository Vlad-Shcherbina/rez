export function make_circle_sdf(cx: number, cy: number, r: number) {
    return (x: number, y: number) => {
        const dx = x - cx;
        const dy = y - cy;
        return Math.sqrt(dx * dx + dy * dy) - r;
    };
}

// Segment from (x1, y1) to (x2, y2) with round caps;
// `thickness` is the full stroke width, as in ctx.lineWidth.
export function make_segment_sdf(x1: number, y1: number, x2: number, y2: number, thickness: number) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len_sq = dx * dx + dy * dy;
    return (x: number, y: number) => {
        const px = x - x1;
        const py = y - y1;
        const t = len_sq === 0 ? 0 : Math.min(Math.max((px * dx + py * dy) / len_sq, 0), 1);
        return Math.hypot(px - t * dx, py - t * dy) - thickness / 2;
    };
}

// Axis-aligned box centered at (cx, cy) with half-extents (hw, hh).
export function make_box_sdf(cx: number, cy: number, hw: number, hh: number) {
    return (x: number, y: number) => {
        const dx = Math.abs(x - cx) - hw;
        const dy = Math.abs(y - cy) - hh;
        const ox = Math.max(dx, 0);
        const oy = Math.max(dy, 0);
        return Math.hypot(ox, oy) + Math.min(Math.max(dx, dy), 0);
    };
}
