import "./offensive";
import { bang } from "./assert";
import { createRoot } from "react-dom/client";
import { Rez, UiFn, Zone } from "./rez";
import { make_circle_sdf } from "./sdfs";

function App() {
    let ui_fn: UiFn = ({ canvas }) => {
        let ctx = bang(canvas.getContext("2d"));
        let zones: Zone[] = [];
        zones.push({
            priority: 0,
            sdf: make_circle_sdf(20, 20, 10),
            paint({hovered}) {
                ctx.fillStyle = "red";
                ctx.beginPath();
                ctx.arc(20, 20, 10, 0, 2 * Math.PI);
                ctx.fill();

                if (hovered) {
                    ctx.strokeStyle = "black";
                    ctx.lineWidth = 2;
                    ctx.stroke();
                }
            },
            on_left_mouse_down({x, y}) {
                console.log("circle clicked at", x, y);
            },
        })
        return zones;
    }
    return <>
        Hello, world!
        <Rez
            style={{ width: "100%", height: "100%" }}
            ui_fn={ui_fn}/>
    </>;
}

let root = bang(document.getElementById("root"));
createRoot(root).render(<App />);
