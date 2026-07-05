export function make_circle_sdf(cx: number, cy: number, r: number) {
    return (x: number, y: number) => {
        const dx = x - cx;
        const dy = y - cy;
        return Math.sqrt(dx * dx + dy * dy) - r;
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
