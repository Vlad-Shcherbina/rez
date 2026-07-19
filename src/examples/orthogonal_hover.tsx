import "../offensive";
import { assert_keyless, bang } from "../assert";
import { createRoot } from "react-dom/client";
import { UiFn, Zone } from "../rez";
import { StrictMode, useLayoutEffect, useRef, useState } from "react";
import { usePaintState, useRez } from "../rerez";
import { useTooltip } from "../tooltip";
import { make_circle_sdf } from "../sdfs";

/*
anchor: D76Qq7ZS
Hover can drive several orthogonal aspects of state at once.
Different zones care about different subsets.

With the naive approach (each `on_hover` sets what it wants, `on_unhover` clears everything),
nothing forces a zone's `on_hover` to clear the aspects it doesn't set,
and `on_unhover` won't help: it only fires when no zone is hovered
or the hovered zone has no `on_hover`.

This example shows a pattern that prevents such stuck hover bugs,
as long as all `on_hover` handlers call `apply_hover`.
*/

type HoverState = {
    pipette: string | null,
    status: string,
    xy: string,
    tooltip: string | null,
}

const DEFAULT_HOVER: HoverState = {
    pipette: null,
    status: "",
    xy: "",
    tooltip: null,
};

function App() {
    let canvas_ref = useRef<HTMLCanvasElement>(null);
    let rez = useRez(canvas_ref);
    rez.log = true;

    let { set_tooltip, clear_tooltip } = useTooltip();

    let pipette_ref = useRef<string | null>(null);
    let [status, set_status] = useState("");
    let [get_xy, set_xy] = usePaintState(() => "");

    function apply_hover(e: MouseEvent | null, h: Partial<HoverState>) {
        let {pipette, status, xy, tooltip, ...rest} = { ...DEFAULT_HOVER, ...h};
        assert_keyless(rest);

        // Note: if the aspects of hover state were non-primitive,
        // we would also need to put set_state behind equality guard to avoid infinite update loop.

        pipette_ref.current = pipette;
        set_xy(xy);
        set_status(status);
        if (tooltip !== null) {
            set_tooltip(<>{tooltip}</>, bang(e));
        } else {
            clear_tooltip();
        }
    }

    let ui_fn: UiFn = ({ canvas }) => {
        let ctx = bang(canvas.getContext("2d"));

        let zones: Zone[] = [];
        zones.push({
            priority: -1000,
            sdf: () => -1,
            paint() {
                ctx.fillStyle = "black";
                ctx.font = "12px monospace";
                ctx.textAlign = "left";
                ctx.textBaseline = "top";
                ctx.fillText(get_xy(), 4, 4);
            },
            on_hover({ x, y, event }) {
                apply_hover(event, {
                    xy: `${x},${y}`,
                });
            }
        });
        {
            let x = 50;
            let y = 100;
            let r = 40;
            zones.push({
                priority: 0,
                sdf: make_circle_sdf(x, y, r),
                paint({hovered}) {
                    ctx.fillStyle = hovered ? "black" : "gray";
                    ctx.beginPath();
                    ctx.arc(x, y, r, 0, Math.PI * 2);
                    ctx.fill();
                },
                on_hover({ event }) {
                    apply_hover(event, {
                        pipette: "circle",
                        status: "hello",
                        tooltip: "circle",
                    });
                },
            });
        }

        return zones;
    };

    useLayoutEffect(() => {
        rez.ui_fn = ui_fn;
        rez.on_unhover = () => apply_hover(null, {});
    });

    useLayoutEffect(() => {
        function on_key_down(e: KeyboardEvent) {
            if (e.key === "q") {
                console.log("pipette:", pipette_ref.current);
            }
        }
        window.addEventListener("keydown", on_key_down);
        return () => window.removeEventListener("keydown", on_key_down);
    }, []);

    return <>
        <h3>Orthogonal hover states</h3>
        <canvas
            ref={canvas_ref}
            style={{
                display: "block",
                width: "400px",
                height: "400px",
            }}
        />
        <div
            style={{
                boxSizing: "border-box",
                width: "400px",
                marginTop: "8px",
                padding: "6px 8px",
                border: "1px solid black",
            }}
        >{status || "\u00A0"}</div>
        <p style={{ width: "400px" }}>
            Hovering the circle also sets a pipette value;
            press "q" to log it to the console.
        </p>
    </>;
}

let root = bang(document.getElementById("root"));
createRoot(root).render(<StrictMode><App /></StrictMode>);
