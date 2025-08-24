export function make_circle_sdf(cx: number, cy: number, r: number) {
    return (x: number, y: number) => {
        const dx = x - cx;
        const dy = y - cy;
        return Math.sqrt(dx * dx + dy * dy) - r;
    };
}
