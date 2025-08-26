import "./offensive";
import { bang } from "./assert";
import { createRoot } from "react-dom/client";
import { Rez, UiFn, Zone } from "./rez";
import { make_circle_sdf } from "./sdfs";
import { useTooltip } from "./tooltip";
import { StrictMode, useState } from "react";

function App() {
    console.log("<App>");
    let { set_tooltip, clear_tooltip } = useTooltip();
    let [counter, set_counter] = useState(0);
    let [points, set_points] = useState<[number, number][]>([[10, 20]]);
    let [drag, set_drag] = useState<null | { start_x: number, start_y: number, cur_x: number, cur_y: number }>(null);

    let ui_fn: UiFn = ({ canvas, width, height }) => {
        let ctx = bang(canvas.getContext("2d"));
        let zones: Zone[] = [];
        zones.push({
            priority: -1000,
            sdf: () => -1,
            paint() {
                if (drag) {
                    ctx.translate(drag.cur_x - drag.start_x, drag.cur_y - drag.start_y);
                }
            },
            on_left_mouse_down({x, y}) {
                set_drag({ start_x: x, start_y: y, cur_x: x, cur_y: y });
            }
        });
        if (drag) {
            zones.push({
                priority: 1000,
                sdf: () => -1,
                cursor: "grabbing",
                on_hover({x, y}) {
                    set_drag(d => d === null || (d.cur_x === x && d.cur_y === y) ? d : { ...d, cur_x: x, cur_y: y });
                },
                on_left_mouse_up({x, y}) {
                    set_drag(null);
                    set_points(points.map(([px, py]) => [px + (x - drag.start_x), py + (y - drag.start_y)]));
                }
            })
        }
        for (let [x, y] of points) {
            zones.push({
                priority: 0,
                sdf: make_circle_sdf(x, y, 10),
                cursor: "crosshair",
                on_hover({event}) {
                    set_tooltip("Circle", event);
                },
                paint({hovered}) {
                    ctx.fillStyle = "red";
                    ctx.beginPath();
                    ctx.arc(x, y, 10, 0, 2 * Math.PI);
                    ctx.fill();

                    if (hovered) {
                        ctx.strokeStyle = "black";
                        ctx.lineWidth = 2;
                        ctx.stroke();
                    }
                },
                on_left_mouse_down({x, y}) {
                    console.log("circle clicked at", x, y);
                    set_counter(counter + 1);
                    let rx = Math.random() * (width - 20) + 10;
                    let ry = Math.random() * (height - 20) + 10;
                    set_points([...points, [rx, ry]]);
                },
            })
        }
        return zones;
    }
    return <>
        <span
            onPointerMove={(e) => set_tooltip("Hello, world!", e.nativeEvent)}
            onPointerLeave={() => clear_tooltip()}
        >Hello, world!</span>
        <Rez
            style={{ width: "100%", height: "100%" }}
            ui_fn={ui_fn}
            on_unhover={() => clear_tooltip()}
        />
    </>;
}

let root = bang(document.getElementById("root"));
createRoot(root).render(<StrictMode><App /></StrictMode>);
