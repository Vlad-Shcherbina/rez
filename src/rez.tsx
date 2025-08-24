import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { bang } from "./assert";

export type Zone = {
    priority: number,
    sdf?: (x: number, y: number) => number,  // negative for inside
    cursor?: string,
    paint?: (arg: { hovered: boolean }) => void,
    on_left_mouse_down?: (args: { x: number, y: number }) => void,
};

export type UiFn = (args: { canvas: HTMLCanvasElement }) => Zone[];

type RezProps = {
    ui_fn: UiFn,
} & React.ComponentPropsWithoutRef<"canvas">;

type Size = {
    width_pixels: number,
    height_pixels: number,
    dpr: number,
    width: number,
    height: number,
};

export function Rez(props: RezProps) {
    console.log("<Rez>");
    let { ui_fn, ...canvas_props } = props;
    let canvas_ref = useRef<HTMLCanvasElement>(null);

    let [size, set_size] = useState<Size>(() => ({
        width_pixels: 0,
        height_pixels: 0,
        dpr: 1,
        width: 0,
        height: 0,
    }));

    let [mouse_pos, set_mouse_pos] = useState<{ x: number, y: number } | null>(null);

    let scale_mouse_coords = useCallback((e: MouseEvent) => {
        let canvas = bang(canvas_ref.current);
        let rect = canvas.getBoundingClientRect();
        return {
            x: e.offsetX * size.width / rect.width,
            y: e.offsetY * size.height / rect.height,
        };
    }, [size]);

    useEffect(() => {
        console.log("create rez");
        let canvas = bang(canvas_ref.current);
        // https://webglfundamentals.org/webgl/lessons/webgl-resizing-the-canvas.html
        const obs = new ResizeObserver((entries) => {
            console.log("on resize");
            console.log(entries.length);
            for (const entry of entries) {
                let dpr = window.devicePixelRatio;
                let width_pixels;
                let height_pixels
                if (entry.devicePixelContentBoxSize) {
                    // NOTE: Only this path gives the correct answer
                    // The other paths are imperfect fallbacks
                    // for browsers that don't provide any way to do this
                    width_pixels = Math.round(entry.devicePixelContentBoxSize[0].inlineSize);
                    height_pixels = Math.round(entry.devicePixelContentBoxSize[0].blockSize);
                } else {
                    // anchor: 7Mynyw35
                    width_pixels = Math.round(entry.contentBoxSize[0].inlineSize * dpr);
                    height_pixels = Math.round(entry.contentBoxSize[0].blockSize * dpr);
                }

                set_size({
                    width_pixels,
                    height_pixels,
                    dpr,
                    width: width_pixels / dpr,
                    height: height_pixels / dpr,
                });
            }
        });
        try {
            obs.observe(canvas, {box: 'device-pixel-content-box'});
        } catch (e) {
            // It seems this fallback is only needed for Safari, so maybe it can be removed. anchor: 7Mynyw35
            obs.observe(canvas, {box: 'content-box'});
        }
        return () => {
            obs.disconnect();
        };
    }, []);

    let zones = useMemo(() => {
        if (size.width_pixels === 0) return [];
        console.log("recompute zones");
        let canvas = bang(canvas_ref.current);
        return ui_fn({canvas}).sort((a, b) => b.priority - a.priority);
    }, [ui_fn, size]);

    let hovered_zone: Zone | null = useMemo<Zone | null>(() => {
        if (!mouse_pos) return null;
        let best: Zone | null = null;
        let priority = 0;
        let dist = 0;
        for (let zone of zones) {
            if (!zone.sdf) continue;
            let d = zone.sdf(mouse_pos.x, mouse_pos.y);
            if (d < 0) {
                if (best === null || zone.priority > priority || zone.priority === priority && d < dist) {
                    best = zone;
                    priority = zone.priority;
                    dist = d;
                }
            }
        }
        return best;
    }, [zones, mouse_pos]);

    useEffect(() => {
        if (size.width_pixels === 0) return;
        console.log("repaint");
        let canvas = bang(canvas_ref.current);
        canvas.width = size.width_pixels;
        canvas.height = size.height_pixels;

        let ctx = bang(canvas.getContext("2d"));
        ctx.scale(size.dpr, size.dpr);

        for (let z of zones) {
            z.paint?.({ hovered: z === hovered_zone });
        }
    }, [zones, hovered_zone, size]);

    function on_mouse_move(e: React.PointerEvent) {
        let p = scale_mouse_coords(e.nativeEvent);
        set_mouse_pos(p);
    }

    function on_mouse_leave() {
        set_mouse_pos(null);
    }

    function on_pointer_down(e: React.PointerEvent) {
        let canvas = bang(canvas_ref.current);
        canvas.setPointerCapture(e.nativeEvent.pointerId);
        if (e.button === 0) {
            hovered_zone?.on_left_mouse_down?.(bang(mouse_pos));
        }
    }

    function on_pointer_up(e: React.PointerEvent) {
        let canvas = bang(canvas_ref.current);
        canvas.releasePointerCapture(e.nativeEvent.pointerId);
    }

    return <canvas
        ref={canvas_ref}
        {...canvas_props}
        onPointerMove={on_mouse_move}
        onPointerLeave={on_mouse_leave}
        onPointerDown={on_pointer_down}
        onPointerUp={on_pointer_up}
    />;
}
