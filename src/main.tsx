import "./offensive";
import { bang } from "./assert";
import { createRoot } from "react-dom/client";
import { Rez, UiFn, Zone } from "./rez";
import { make_circle_sdf } from "./sdfs";
import { useTooltip } from "./tooltip";
import { useState } from "react";

function App() {
    let { set_tooltip, clear_tooltip } = useTooltip();
    let [counter, set_counter] = useState(0);
    let [points, set_points] = useState<[number, number][]>([[10, 20]]);
    let ui_fn: UiFn = ({ canvas, width, height }) => {
        let ctx = bang(canvas.getContext("2d"));
        let zones: Zone[] = [];
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
createRoot(root).render(<App />);
