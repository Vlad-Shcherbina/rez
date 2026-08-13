import { RefObject, useLayoutEffect, useRef } from "react";
import { bang } from "./assert";
import { PaintState, Rez, UiFn } from "./rez";

type UseRezOptions = {
    ui_fn: UiFn,
    on_unhover?: () => void,
    log?: boolean,
};

const noop = () => {};

export function useRez(
    canvas_ref: RefObject<HTMLCanvasElement | null>,
    { ui_fn, on_unhover = noop, log = false }: UseRezOptions,
) {
    let rez_ref = useRef<Rez>(null);
    rez_ref.current ??= new Rez();

    useLayoutEffect(() => {
        // "destructor"
        return () => {
            // The release this triggers is deferred, so it lands after the unmount;
            // on_unhover handlers tolerate that (anchor: qX3vNbW8).
            bang(rez_ref.current).canvas = null;
        }
    }, []);

    useLayoutEffect(() => {
        let rez = bang(rez_ref.current);

        rez.log = log;
        rez.ui_fn = ui_fn;
        rez.on_unhover = on_unhover;
        rez.canvas = canvas_ref.current;
    });
}

export function usePaintState<T>(f: () => T) {
    let ps_ref = useRef<PaintState<T>>(null);
    ps_ref.current ??= new PaintState(f());
    let ps = ps_ref.current;
    let get_ps = () => ps.get();
    let set_ps = (value: T) => ps.set(value);
    // TODO: maybe allow passing old->new function?
    // TODO: maybe return stable get_ps and set_ps to allow memoization downstream
    return [get_ps, set_ps] as const;
}
