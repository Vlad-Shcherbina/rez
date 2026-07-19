import "../offensive";
import { bang } from "../assert";
import { createRoot } from "react-dom/client";
import { UiFn, Zone } from "../rez";
import { StrictMode, useLayoutEffect, useRef, useState } from "react";
import { usePaintState, useRez } from "../rerez";

/*
anchor: 5ZKcK8LO
Path-dependent editing via a mode-gated `on_hover`.

Buttons don't act, they only set a mode (`left_pressed` / `right_pressed`);
all mutation goes through one choke point: `on_hover` applies the tool
at the current cell. Because `on_hover` is level-triggered,
the mode change alone reruns it, so pressing a button without moving
the mouse also paints — a click is just a zero-length drag.

That re-dispatch means at-least-once delivery, so applying the tool must be
idempotent: the functional updates return `old_cells` unchanged when there is
nothing to do, making repeated application at the same cell a no-op.
*/

const CELL_SIZE = 10;

function App() {
    let canvas_ref = useRef<HTMLCanvasElement>(null);
    let rez = useRez(canvas_ref);

    let [get_xy, set_xy] = usePaintState<{ x: number, y: number } | null>(() => null);
    let [left_pressed, set_left_pressed] = useState(false);
    let [right_pressed, set_right_pressed] = useState(false);
    let [painted_cells, set_painted_cells] = useState<Map<string, [number, number]>>(() => new Map());

    let ui_fn: UiFn = ({ canvas }) => {
        let ctx = bang(canvas.getContext("2d"));

        let zone: Zone = {
            priority: 0,
            sdf: () => -1,
            paint() {
                ctx.fillStyle = "black";
                for (let [x, y] of painted_cells.values()) {
                    ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
                }

                let xy = get_xy();
                if (xy === null) return;

                ctx.fillStyle = "rgba(0, 255, 255, 0.5)";
                ctx.fillRect(xy.x * CELL_SIZE, xy.y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
            },
            on_hover({ x, y }) {
                let cell_x = Math.floor(x / CELL_SIZE);
                let cell_y = Math.floor(y / CELL_SIZE);
                let xy = get_xy();  // allowed in handlers
                if (xy === null || xy.x !== cell_x || xy.y !== cell_y) {
                    set_xy({ x: cell_x, y: cell_y });
                }

                let key = `${cell_x},${cell_y}`;
                if (right_pressed) {
                    set_painted_cells(old_cells => {
                        if (!old_cells.has(key)) return old_cells;
                        let new_cells = new Map(old_cells);
                        new_cells.delete(key);
                        return new_cells;
                    });
                } else if (left_pressed) {
                    set_painted_cells(old_cells => {
                        if (old_cells.has(key)) return old_cells;
                        let new_cells = new Map(old_cells);
                        new_cells.set(key, [cell_x, cell_y]);
                        return new_cells;
                    });
                }
            },
            on_left_mouse_down() {
                set_left_pressed(true);
            },
            on_left_mouse_up() {
                set_left_pressed(false);
            },
            on_right_mouse_down() {
                set_right_pressed(true);
            },
            on_right_mouse_up() {
                set_right_pressed(false);
            },
        };
        return [zone];
    };

    useLayoutEffect(() => {
        rez.ui_fn = ui_fn;
        rez.on_unhover = () => set_xy(null);
    });

    return <>
        <h3>Path-dependent brush</h3>
        <p>left mouse button to paint, right to clear</p>
        <canvas
            ref={canvas_ref}
            style={{
                display: "block",
                width: "400px",
                height: "400px",
                border: "1px solid black",
            }}
        />
    </>;
}

let root = bang(document.getElementById("root"));
createRoot(root).render(<StrictMode><App /></StrictMode>);
