import { RefObject, useLayoutEffect, useRef } from "react";
import { PaintState, Rez } from "./rez";

export function useRez(canvas_ref: RefObject<HTMLCanvasElement | null>) {
    let rez_ref = useRef<Rez>(null);
    rez_ref.current ??= new Rez();
    let rez = rez_ref.current;
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
    let ps_ref = useRef<PaintState<T>>(null);
    ps_ref.current ??= new PaintState(f());
    let ps = ps_ref.current;
    let get_ps = () => ps.get();
    let set_ps = (value: T) => ps.set(value);
    // TODO: maybe allow passing old->new function?
    return [get_ps, set_ps] as const;
}
