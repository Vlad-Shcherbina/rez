import "../offensive";
import { assert, bang } from "../assert";
import { createRoot } from "react-dom/client";
import { UiFn, Zone } from "../rez";
import { make_circle_sdf, make_segment_sdf } from "../sdfs";
import { useTooltip } from "../tooltip";
import { StrictMode, useLayoutEffect, useRef, useState } from "react";
import { usePaintState, useRez } from "../rerez";

function App() {
    let canvas_ref = useRef<HTMLCanvasElement>(null);
    let rez = useRez(canvas_ref);
    rez.log = true;

    let [toggled, set_toggled] = useState([true, false, false]);

    let { set_tooltip, clear_tooltip } = useTooltip();

    let [get_x, set_x] = usePaintState(() => 0);

    let ui_fn: UiFn = ({canvas, width, height}) => {
        // Trying to catch possible issues like incorrectly including border size and getting 402.
        let expected_width = Math.round(400 * window.devicePixelRatio);
        assert(canvas.width === expected_width, `${canvas.width} ${canvas.height} {expected_width}`);

        // Alternating pattern is also to catch physical/logical resolution mismatches (they'll show as Moire).
        let zones: Zone[] = [];
        let ctx = bang(canvas.getContext("2d"));
        zones.push({
            priority: -1000,
            paint: ({ ui_fn_count, paint_count }) => {
                assert(canvas.width === expected_width, `${canvas.width} ${canvas.height} {expected_width}`);
                ctx.fillStyle = "black";
                for (let i = 0; i < width; i += 2) {
                    ctx.fillRect(i, 0, 1, 1);
                    ctx.fillRect(i, height - 1, 1, 1);
                }
                for (let i = 0; i < height; i += 2) {
                    ctx.fillRect(0, i, 1, 1);
                    ctx.fillRect(width - 1, i, 1, 1);
                }
                ctx.fillStyle = "black";
                ctx.font = "12px monospace";
                ctx.textAlign = "left";
                ctx.textBaseline = "top";
                ctx.fillText(`ui_fn: ${ui_fn_count}`, 4, 4);
                ctx.fillText(`paint: ${paint_count}`, 4, 18);
            },
        });

        let coords: [number, number][] = [[50, 60], [200, 50], [100, 180]];
        coords.forEach(([x, y], i) => {
            let r = 20;
            zones.push({
                priority: 0,
                sdf: make_circle_sdf(x, y, r),
                // Hover effect: restyle based on the `hovered` flag. anchor: 31ImAttW
                paint: ({hovered}) => {
                    ctx.fillStyle = toggled[i] ? "green" : "yellow";
                    ctx.strokeStyle = hovered ? "black" : "gray";
                    ctx.lineWidth = hovered ? 2 : 1;
                    ctx.beginPath();
                    ctx.arc(x, y, r, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.fill();

                    // Live readout via paint state: updated by another zone's on_hover,
                    // repainted without a rerender. anchor: spqEMBfi
                    if (i === 0 && toggled[i]) {
                        ctx.fillStyle = "black";
                        ctx.font = "12px monospace";
                        ctx.textAlign = "left";
                        ctx.textBaseline = "middle";
                        ctx.fillText(`paint state x: ${get_x()}`, x - 30, y);
                    }
                },
                on_hover: ({event}) => {
                    set_tooltip(<>Click to make {toggled[i] ? "yellow" : "green"}</>, event);
                },
                on_left_mouse_down: () => {
                    toggled[i] = !toggled[i];
                    set_toggled([...toggled]);
                },
                on_right_mouse_down: () => {
                    toggled[i] = !toggled[i];
                    set_toggled([...toggled]);
                },
            })
        });

        let x = 250;
        let y = 250;
        let r = 30;
        // Hover indicator painted by a separate zone at a different priority. anchor: H8XbZthF
        let z: Zone = {
            priority: 0,
            sdf: make_circle_sdf(x, y, r),
            paint: () => {
                ctx.fillStyle = "gray";
                ctx.beginPath();
                ctx.arc(x, y, r, 0, Math.PI * 2);
                ctx.fill();
            },
            on_hover: ({event, x}) => {
                set_x(x); // anchor: spqEMBfi
                set_tooltip(<>Hover indicator is in a separate zone</>, event);
            },
        };
        zones.push(z);
        zones.push({
            priority: 10,
            paint: ({ hovered_zone }) => {
                if (hovered_zone !== z) return;
                ctx.strokeStyle = "black";
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(x, y, r, 0, Math.PI * 2);
                ctx.stroke();
            }
        });

        let [sx1, sy1, sx2, sy2] = [70, 300, 220, 350];
        let seg_thickness = 10;
        zones.push({
            priority: 0,
            sdf: make_segment_sdf(sx1, sy1, sx2, sy2, seg_thickness),
            paint: ({hovered}) => {
                ctx.strokeStyle = hovered ? "black" : "gray";
                ctx.lineWidth = seg_thickness;
                ctx.lineCap = "round";
                ctx.beginPath();
                ctx.moveTo(sx1, sy1);
                ctx.lineTo(sx2, sy2);
                ctx.stroke();
            },
            on_hover: ({event}) => {
                set_tooltip(<>Segment SDF</>, event);
            },
        });

        return zones;
    }

    // Maybe pass ui_fn and on_hover to useRez and move the effect there? (anchor: VhPJQYue)
    useLayoutEffect(() => {
        rez.ui_fn = ui_fn;
        rez.on_unhover = () => {
            set_x(-1); // anchor: spqEMBfi
            clear_tooltip();
        }
    });

    return <>
        <h3>Simple example</h3>
        <p>Left-click or right-click a circle to toggle it.</p>
        <canvas ref={canvas_ref} style={{width: "400px", height: "400px", border: "1px solid black"}} />
    </>
}

let root = bang(document.getElementById("root"));
createRoot(root).render(<StrictMode><App /></StrictMode>);
// createRoot(root).render(<App />);
