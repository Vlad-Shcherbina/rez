import "../offensive";
import { bang } from "../assert";
import { createRoot } from "react-dom/client";
import { UiFn, Zone } from "../rez";
import { make_box_sdf, make_circle_sdf } from "../sdfs";
import { useTooltip } from "../tooltip";
import { StrictMode, useLayoutEffect, useRef, useState } from "react";
import { useRez } from "../rerez";

// world -> screen: screen = world * scale + offset
type Zoom = { offset_x: number, offset_y: number, scale: number };

// Standard normal via Box-Muller.
function gaussian() {
    let u = 1 - Math.random();
    let v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function fit_zoom(stars: { x: number, y: number }[], width: number, height: number): Zoom {
    let min_x = Math.min(...stars.map(s => s.x));
    let max_x = Math.max(...stars.map(s => s.x));
    let min_y = Math.min(...stars.map(s => s.y));
    let max_y = Math.max(...stars.map(s => s.y));

    let pad = 40;
    let scale = Math.min(
        (width - 2 * pad) / (max_x - min_x),
        (height - 2 * pad) / (max_y - min_y),
    );
    let offset_x = width / 2 - scale * (min_x + max_x) / 2;
    let offset_y = height / 2 - scale * (min_y + max_y) / 2;
    return { offset_x, offset_y, scale };
}

function App() {
    let canvas_ref = useRef<HTMLCanvasElement>(null);
    let rez = useRez(canvas_ref);
    rez.log = true;

    let { set_tooltip, clear_tooltip } = useTooltip();

    let stars_ref = useRef<{ x: number, y: number }[]>(null);
    stars_ref.current ??= Array.from({ length: 100 }, () => ({ x: gaussian(), y: gaussian() }));
    let stars = stars_ref.current;

    // Not initialized until the first ui_fn call, because fit_zoom() needs the
    // canvas size, which only becomes available then.
    let [maybe_zoom, set_zoom] = useState<Zoom | null>(null);

    let ui_fn: UiFn = ({ canvas, width, height }) => {
        let zones: Zone[] = [];
        let ctx = bang(canvas.getContext("2d"));

        // maybe_zoom -> the persisted state, possibly not initialized yet.
        // zoom -> the transform to actually use this frame, always present.
        let zoom = maybe_zoom ?? fit_zoom(stars, width, height);
        if (maybe_zoom === null) set_zoom(zoom);

        zones.push({
            priority: -1000,
            paint: ({ ui_fn_count, paint_count }) => {
                ctx.fillStyle = "#f6f6f6";
                ctx.fillRect(0, 0, width, height);

                ctx.fillStyle = "black";
                ctx.font = "12px monospace";
                ctx.textAlign = "left";
                ctx.textBaseline = "top";
                ctx.fillText(`ui_fn: ${ui_fn_count}`, 4, 4);
                ctx.fillText(`paint: ${paint_count}`, 4, 18);
            },
        });

        // "Zoom to fit" button in the top right corner.
        let margin = 12;
        let size = 28;
        let cx = width - margin - size / 2;
        let cy = margin + size / 2;

        zones.push({
            priority: 0,
            sdf: make_box_sdf(cx, cy, size / 2, size / 2),
            cursor: "pointer",
            paint: ({ hovered }) => {
                // A square made of four corner brackets spanning the whole button.
                let h = size / 2; // half-extent of the button square
                let arm = size / 3; // length of each corner arm
                ctx.strokeStyle = "#333";
                ctx.lineWidth = hovered ? 3 : 1.5;
                ctx.lineCap = "round";
                for (let sx of [-1, 1]) {
                    for (let sy of [-1, 1]) {
                        let x = cx + sx * h;
                        let y = cy + sy * h;
                        ctx.beginPath();
                        ctx.moveTo(x - sx * arm, y);
                        ctx.lineTo(x, y);
                        ctx.lineTo(x, y - sy * arm);
                        ctx.stroke();
                    }
                }
            },
            on_hover: ({ event }) => {
                set_tooltip(<>zoom to fit</>, event);
            },
            on_left_mouse_down: () => {
                set_zoom(fit_zoom(stars, width, height));
            },
        });

        // Stars.
        for (let star of stars) {
            let sx = star.x * zoom.scale + zoom.offset_x;
            let sy = star.y * zoom.scale + zoom.offset_y;
            let r = 3;
            zones.push({
                priority: 1,
                sdf: make_circle_sdf(sx, sy, 2 * r),
                paint: ({ hovered }) => {
                    ctx.beginPath();
                    ctx.arc(sx, sy, hovered ? r + 3 : r, 0, Math.PI * 2);
                    ctx.fillStyle = hovered ? "#e8a13a" : "#333";
                    ctx.fill();
                },
                on_hover: ({ event }) => {
                    set_tooltip(<>({star.x.toFixed(2)}, {star.y.toFixed(2)})</>, event);
                },
            });
        }

        return zones;
    }

    // Maybe pass ui_fn and on_hover to useRez and move the effect there? (anchor: VhPJQYue)
    useLayoutEffect(() => {
        rez.ui_fn = ui_fn;
        rez.on_unhover = () => {
            clear_tooltip();
        }
    });

    return <>
        <canvas
            ref={canvas_ref}
            style={{
                position: "fixed",
                top: "0",
                left: "0",
                width: "100vw",
                height: "100vh",
                display: "block",
            }}
        />
    </>
}

let root = bang(document.getElementById("root"));
createRoot(root).render(<StrictMode><App /></StrictMode>);
