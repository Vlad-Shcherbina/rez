import { RefObject, useLayoutEffect, useState } from "react";
import { PaintState, Rez } from "./rez";

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

export function usePaintState<T>(f: () => T) {
    let [ps, _] = useState(() => new PaintState(f()));
    let get_ps = () => ps.get();
    let set_ps = (value: T) => ps.set(value);
    // TODO: maybe allow passing old->new function?
    return [get_ps, set_ps] as const;
}
