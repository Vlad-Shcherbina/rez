import "../offensive";
import { bang } from "../assert";
import { createRoot } from "react-dom/client";
import { StrictMode, useEffect, useRef, useState } from "react";

const SIZE = 200;

// Artificial per-paint workload, shared by all canvases via a ref so that
// dragging the slider doesn't trigger React renders.
let load_ref = { current: 0 };

function paint_crosshair(canvas: HTMLCanvasElement, x: number, y: number) {
    // Artificial workload: busy-wait to make each paint expensive (in ms).
    let deadline = performance.now() + load_ref.current;
    while (performance.now() < deadline) { /* spin */ }

    let ctx = bang(canvas.getContext("2d"));
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.strokeStyle = "black";
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, SIZE);
    ctx.moveTo(0, y);
    ctx.lineTo(SIZE, y);
    ctx.stroke();
}

function event_pos(canvas: HTMLCanvasElement, event: React.MouseEvent): [number, number] {
    let rect = canvas.getBoundingClientRect();
    return [event.clientX - rect.left, event.clientY - rect.top];
}

// Repaint synchronously on every mousemove event.
function DirectCanvas() {
    let canvas_ref = useRef<HTMLCanvasElement>(null);

    let on_mouse_move = (event: React.MouseEvent) => {
        let canvas = bang(canvas_ref.current);
        paint_crosshair(canvas, ...event_pos(canvas, event));
    };

    return <canvas
        ref={canvas_ref}
        width={SIZE}
        height={SIZE}
        style={{ border: "1px solid black" }}
        onMouseMove={on_mouse_move}
    />;
}

// Store position on every mousemove, repaint once per animation frame.
function RafCanvas() {
    let canvas_ref = useRef<HTMLCanvasElement>(null);
    let pos_ref = useRef<[number, number]>([0, 0]);
    let raf_ref = useRef<number | null>(null);

    let on_mouse_move = (event: React.MouseEvent) => {
        let canvas = bang(canvas_ref.current);
        pos_ref.current = event_pos(canvas, event);
        if (raf_ref.current !== null) return;
        raf_ref.current = requestAnimationFrame(() => {
            raf_ref.current = null;
            paint_crosshair(canvas, ...pos_ref.current);
        });
    };

    return <canvas
        ref={canvas_ref}
        width={SIZE}
        height={SIZE}
        style={{ border: "1px solid black" }}
        onMouseMove={on_mouse_move}
    />;
}

// Route position through React state; repaint in an effect.
function StateCanvas() {
    let canvas_ref = useRef<HTMLCanvasElement>(null);
    let [pos, set_pos] = useState<[number, number]>([0, 0]);

    let on_mouse_move = (event: React.MouseEvent) => {
        set_pos(event_pos(bang(canvas_ref.current), event));
    };

    useEffect(() => {
        paint_crosshair(bang(canvas_ref.current), ...pos);
    }, [pos]);

    return <canvas
        ref={canvas_ref}
        width={SIZE}
        height={SIZE}
        style={{ border: "1px solid black" }}
        onMouseMove={on_mouse_move}
    />;
}

function App() {
    let [load, set_load] = useState(0);

    return <>
        <h3>Mouse latency</h3>
        <p>Move the mouse over each canvas. Each shows a crosshair at the mouse position.</p>
        <p>
            <label>
                load: {load} ms{" "}
                <input
                    type="range"
                    min={0}
                    max={200}
                    value={load}
                    onChange={event => {
                        let v = event.target.valueAsNumber;
                        load_ref.current = v;
                        set_load(v);
                    }}
                />
            </label>
        </p>
        <div style={{ display: "flex", gap: "16px" }}>
            <figure style={{ margin: 0 }}>
                <DirectCanvas />
                <figcaption>direct repaint</figcaption>
            </figure>
            <figure style={{ margin: 0 }}>
                <RafCanvas />
                <figcaption>RAF repaint</figcaption>
            </figure>
            <figure style={{ margin: 0 }}>
                <StateCanvas />
                <figcaption>React state</figcaption>
            </figure>
        </div>
    </>;
}

let root = bang(document.getElementById("root"));
// createRoot(root).render(<StrictMode><App /></StrictMode>);
createRoot(root).render(<App />);
