import "../offensive";
import { bang } from "../assert";
import { createRoot } from "react-dom/client";
import { UiFn, Zone } from "../rez";
import { StrictMode, useRef } from "react";
import { useRez } from "../rerez";

function App() {
    let canvas_ref = useRef<HTMLCanvasElement>(null);

    let ui_fn: UiFn = ({ canvas, width, height }) => {
        console.log("ui_fn", width, height, canvas.width, canvas.height);
        let zones: Zone[] = [];
        let ctx = bang(canvas.getContext("2d"));

        zones.push({
            priority: -1000,
            paint: ({ ui_fn_count, paint_count }) => {
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

        zones.push({
            priority: 0,
            paint: () => {
                let lw = 2;
                ctx.strokeStyle = "black";
                ctx.lineWidth = lw;
                ctx.beginPath();
                ctx.ellipse(width / 2, height / 2, width / 2 - lw / 2, height / 2 - lw / 2, 0, 0, Math.PI * 2);
                ctx.stroke();
            },
        });

        return zones;
    }

    useRez(canvas_ref, {
        ui_fn,
        log: true,
    });

    return <>
        <canvas
            ref={canvas_ref}
            style={{
                position: "fixed",
                top: "20px",
                left: "20px",
                width: "calc(100vw - 40px)",
                height: "calc(100vh - 40px)",
                boxSizing: "border-box",
                border: "1px solid black",
            }}
        />
    </>
}

let root = bang(document.getElementById("root"));
createRoot(root).render(<StrictMode><App /></StrictMode>);
