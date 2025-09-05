import "./offensive";
import { bang } from "./assert";
import { createRoot } from "react-dom/client";
import { Rez, UiFn, Zone } from "./rez";
import { make_circle_sdf } from "./sdfs";
import { useTooltip } from "./tooltip";
import { StrictMode, useState } from "react";

type HoverDetail = {
    x: number,
    y: number,
};

function App() {
    // console.log("<App>");
    let { set_tooltip, clear_tooltip } = useTooltip();
    let [counter, set_counter] = useState(0);
    let [points, set_points] = useState<[number, number][]>([[10, 20]]);
    let [drag, set_drag] = useState<null | { start_x: number, start_y: number }>(null);
    let [cross, set_cross_naive] = useState<[number, number]>([0, 0]);
    let set_cross = (nx: number, ny: number) => set_cross_naive((old) => old[0] != nx || old[1] != ny ? [nx, ny] : old);

    let ui_fn: UiFn<HoverDetail> = ({ canvas, width, height }) => {
        let ctx = bang(canvas.getContext("2d"));
        let zones: Zone<HoverDetail>[] = [];
        zones.push({
            priority: -2000,
            paint({ hover_detail }) {
                ctx.fillStyle = "black";
                ctx.font = "12px sans-serif";
                ctx.fillText('hover detail: ' + JSON.stringify(hover_detail), 10, 20);

                ctx.strokeStyle = "black";
                ctx.strokeRect(cross[0], cross[1], 10, 10);
            },
        })
        zones.push({
            priority: -1000,
            sdf: () => -1,
            paint({ hover_detail }) {
                if (drag && hover_detail ) {
                    ctx.translate(hover_detail.x - drag.start_x, hover_detail.y - drag.start_y);
                }
            },
            on_left_mouse_down({x, y}) {
                set_drag({ start_x: x, start_y: y });
            }
        });
        if (drag) {
            zones.push({
                priority: 1000,
                sdf: () => -1,
                cursor: "grabbing",
                get_hover_detail(x, y) {
                    set_cross(x, y);
                    return [`${x},${y}`, {x, y}];
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
// createRoot(root).render(<StrictMode><App /></StrictMode>);
createRoot(root).render(<App />);
