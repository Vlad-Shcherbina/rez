import "../offensive";
import { assert, bang } from "../assert";
import { createRoot } from "react-dom/client";
import { UiFn, Zone } from "../rez";
import { make_circle_sdf } from "../sdfs";
import { useTooltip } from "../tooltip";
import { StrictMode, useRef, useState } from "react";
import { useRez } from "../rerez";

function App() {
    let canvas_ref = useRef<HTMLCanvasElement>(null);
    let rez = useRez(canvas_ref);
    rez.log = true;

    let [toggled, set_toggled] = useState([true, false, false]);

    let { set_tooltip, clear_tooltip } = useTooltip();

    let ui_fn: UiFn = ({canvas, width, height}) => {
        // TODO: First invocation of ui_fn happens before canvas changed resolution.
        // This is probably a bug. First paint happens with the right resolution.
        // assert(canvas.width % 400 === 0, `${canvas.width} ${canvas.height}`); // % to allow for DPI factor

        let zones: Zone[] = [];
        let ctx = bang(canvas.getContext("2d"));
        zones.push({
            priority: -1000,
            paint: () => {
                assert(canvas.width % 400 === 0, `${canvas.width} ${canvas.height}`); // % to allow for DPI factor
                ctx.fillStyle = "black";
                for (let i = 0; i < width; i += 2) {
                    ctx.fillRect(i, 0, 1, 1);
                    ctx.fillRect(i, height - 1, 1, 1);
                }
                for (let i = 0; i < height; i += 2) {
                    ctx.fillRect(0, i, 1, 1);
                    ctx.fillRect(width - 1, i, 1, 1);
                }
            },
        });

        let coords: [number, number][] = [[50, 60], [200, 50], [100, 180]];
        coords.forEach(([x, y], i) => {
            let r = 20;
            zones.push({
                priority: 0,
                sdf: make_circle_sdf(x, y, r),
                paint: ({hovered}) => {
                    ctx.fillStyle = toggled[i] ? "green" : "yellow";
                    ctx.strokeStyle = hovered ? "black" : "gray";
                    ctx.lineWidth = hovered ? 2 : 1;
                    ctx.beginPath();
                    ctx.arc(x, y, r, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.fill();
                },
                on_hover: ({event}) => {
                    set_tooltip(<>Click to make {toggled[i] ? "yellow" : "green"}</>, event);
                },
                on_left_mouse_down: () => {
                    toggled[i] = !toggled[i];
                    set_toggled([...toggled]);
                },
            })
        });

        return zones;
    }
    rez.ui_fn = ui_fn;
    rez.on_unhover = clear_tooltip;

    return <>
        <h3>Simple example</h3>
        <canvas ref={canvas_ref} style={{width: "400px", height: "400px", border: "1px solid black"}} />
    </>
}

let root = bang(document.getElementById("root"));
createRoot(root).render(<StrictMode><App /></StrictMode>);
// createRoot(root).render(<App />);
