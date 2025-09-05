import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { bang } from "./assert";

export type Zone<HoverDetail> = {
    priority: number,
    sdf?: (x: number, y: number) => number,  // negative for inside
    cursor?: string,
    paint?: (args: { hovered: boolean, hover_detail: HoverDetail | null }) => void,
    on_left_mouse_down?: (args: { x: number, y: number }) => void,
    on_left_mouse_up?: (args: { x: number, y: number }) => void,
    on_hover?: (args: { x: number, y: number, event: MouseEvent }) => void,
    get_hover_detail?: (x: number, y: number) => [string | null, HoverDetail | null],
};

export type UiFn<HoverDetail> = (args: { canvas: HTMLCanvasElement, width: number, height: number }) => Zone<HoverDetail>[];

type RezProps<HoverDetail> = {
    ui_fn: UiFn<HoverDetail>,
    on_unhover?: () => void,
} & React.ComponentPropsWithoutRef<"canvas">;

type Size = {
    width_pixels: number,
    height_pixels: number,
    dpr: number,
    width: number,
    height: number,
};

export function Rez<HoverDetail>(props: RezProps<HoverDetail>) {

    console.log("<Rez>");
    let { ui_fn, on_unhover, ...canvas_props } = props;
    let canvas_ref = useRef<HTMLCanvasElement>(null);

    let [size, set_size] = useState<Size>(() => ({
        width_pixels: 0,
        height_pixels: 0,
        dpr: 1,
        width: 0,
        height: 0,
    }));

    let [mouse_pos, set_mouse_pos] = useState<{ x: number, y: number } | null>(null);
    let [mouse_event, set_mouse_event] = useState<MouseEvent | null>(null);

    let [hover_detail, set_hover_detail] = useState<[string | null, HoverDetail | null]>([null, null]);

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
        return ui_fn({canvas, width: size.width, height: size.height}).sort((a, b) => a.priority - b.priority);
    }, [ui_fn, size]);

    let hovered_zone: Zone<HoverDetail> | null = useMemo<Zone<HoverDetail> | null>(() => {
        if (!mouse_pos) return null;
        let best: Zone<HoverDetail> | null = null;
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
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(size.dpr, size.dpr);

        for (let z of zones) {
            z.paint?.({ hovered: z === hovered_zone, hover_detail: hover_detail[1] });
        }
    }, [zones, hovered_zone, size, hover_detail]);

    useEffect(() => {
        if (size.width_pixels === 0) return;
        let h = hovered_zone?.on_hover;
        if (h && mouse_pos && mouse_event) {
            h({ x: mouse_pos.x, y: mouse_pos.y, event: mouse_event });
        } else {
            on_unhover?.();
        }
        let ghd = hovered_zone?.get_hover_detail;
        let new_hd: [string | null, HoverDetail | null] = [null, null];
        if (ghd && mouse_pos) {
            new_hd = ghd(mouse_pos.x, mouse_pos.y);
        }
        set_hover_detail(hd => hd[0] === new_hd[0] ? hd : new_hd);
    }, [zones, hovered_zone, size, mouse_event, mouse_pos, on_unhover]);

    function on_mouse_move(e: React.PointerEvent) {
        let p = scale_mouse_coords(e.nativeEvent);
        set_mouse_pos(p);
        set_mouse_event(e.nativeEvent);
    }

    function on_mouse_leave() {
        set_mouse_pos(null);
        set_mouse_event(null);
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
        if (e.button === 0) {
            hovered_zone?.on_left_mouse_up?.(bang(mouse_pos));
        }
    }

    let updated_props = { ... canvas_props};
    updated_props.style = { ... updated_props.style, cursor: hovered_zone?.cursor || "default" };

    return <canvas
        ref={canvas_ref}
        {...updated_props}
        onPointerMove={on_mouse_move}
        onPointerLeave={on_mouse_leave}
        onPointerDown={on_pointer_down}
        onPointerUp={on_pointer_up}
    />;
}
