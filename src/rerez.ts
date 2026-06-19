import { RefObject, useLayoutEffect, useState } from "react";
import { Rez } from "./rez";

export function useRez(canvas_ref: RefObject<HTMLCanvasElement | null>) {
    let [rez, _] = useState<Rez>(() => new Rez());
    useLayoutEffect(() => {
        // "destructor"
        return () => { rez.canvas = null; }
    }, [rez]);
    useLayoutEffect(() => {
        rez.canvas = canvas_ref.current;
    });
    return rez;
}
