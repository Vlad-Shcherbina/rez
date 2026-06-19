import { assert, bang } from "./assert";

export type Zone = {
    priority: number,
    sdf?: (x: number, y: number) => number,  // negative for inside
    cursor?: string,
    paint?: (args: { hovered: boolean }) => void,
    on_left_mouse_down?: (args: { x: number, y: number }) => void,
    on_left_mouse_up?: (args: { x: number, y: number }) => void,

    /**
     * `on_hover` is called when mouse moves over the zone,
     * or when the zone first comes into existence and the mouse happens to be over it already.
     *
     * After any state change that triggers `ui_fn` recomputation and repaint,
     * we intentionally rerun current_zone.on_hover.
     * It is important that we don't set state redundantly in on_hover handler.
     * This happens automatically for primitive types in React state,
     * but for composite state types an explicit check is needed:
     * ```
     * set_foo(old => old.x === x && old.y === y ? old : { x, y });
     * ```
     * Otherwise, it will be an infinite update loop.
     */
    on_hover?: (args: { x: number, y: number, event: MouseEvent }) => void,
};

export type UiFn = (args: { canvas: HTMLCanvasElement, width: number, height: number }) => Zone[];

export class Rez {
    #ui_fn: UiFn = () => [];
    #canvas: HTMLCanvasElement | null = null;

    private repaint_needed: boolean = false;
    private af_requested: boolean = false; // af - animation frame

    private dpr = 0;
    private width = 0;
    private height = 0;
    private width_pixels = 0;
    private height_pixels = 0;

    private zones: Zone[] | typeof NOT_COMPUTED = NOT_COMPUTED;
    private hovered_zone: Zone | null | typeof NOT_COMPUTED = NOT_COMPUTED;
    private mouse_pos: { x: number, y: number } | null = null;
    private mouse_event: PointerEvent | null = null;

    private unsubscribe = new AbortController();

    on_unhover: () => void = () => {};

    log: boolean = true;

    constructor() {}

    get ui_fn() { return this.#ui_fn; }
    set ui_fn(f: UiFn) {
        this.#ui_fn = f;
        this.zones = NOT_COMPUTED;
        this.hovered_zone = NOT_COMPUTED;
        this.request_repaint();
        if (this.#canvas) {
            queueMicrotask(() => {
                if (this.mouse_event) {
                    this.update_mouse_pos(this.mouse_event);
                } else {
                    this.clear_mouse_pos();
                }
            });
        }
    }

    get canvas() { return this.#canvas; }
    set canvas(c) {
        if (this.#canvas === c) { return; }
        this.#canvas = c;

        this.unsubscribe.abort();
        this.unsubscribe = new AbortController();

        if (c === null) { return; }

        {
            let computed_width1 = parseFloat(getComputedStyle(c).width);
            let computed_height1 = parseFloat(getComputedStyle(c).height);
            c.width = c.width + 1;
            c.height = c.height + 1;
            let computed_width2 = parseFloat(getComputedStyle(c).width);
            let computed_height2 = parseFloat(getComputedStyle(c).height);
            c.width = c.width - 1;
            c.height = c.height - 1;
            if (computed_width1 !== computed_width2 || computed_height1 !== computed_height2) {
                throw new Error("Canvas has no explicit CSS size - will cause infinite resize loop on high-DPI displays");
            }
        }

        let obs = new ResizeObserver((entries) => {
            console.log("resize obs");
            for (let entry of entries) {
                let dpr = window.devicePixelRatio;
                let width_pixels;
                let height_pixels
                if (entry.devicePixelContentBoxSize) {
                    // Only this path gives the correct answer
                    width_pixels = Math.round(entry.devicePixelContentBoxSize[0].inlineSize);
                    height_pixels = Math.round(entry.devicePixelContentBoxSize[0].blockSize);
                } else {
                    // fallback for Safari
                    width_pixels = Math.round(entry.contentBoxSize[0].inlineSize * dpr);
                    height_pixels = Math.round(entry.contentBoxSize[0].blockSize * dpr);
                }
                let width = width_pixels / dpr;
                let height = height_pixels / dpr;

                // pointer_event_to_canvas_coords() relies on this, anchor: XQOEPuOg
                this.dpr = dpr;
                this.width_pixels = width_pixels;
                this.height_pixels = height_pixels;
                this.width = width;
                this.height = height;

                this.request_repaint();
            }
        });

        try {
            obs.observe(c, {box: 'device-pixel-content-box'});
        } catch (e) {
            // fallback for Safari
            obs.observe(c, {box: 'content-box'});
        }
        this.unsubscribe.signal.addEventListener("abort", () => obs.disconnect(), { once: true });

        c.addEventListener("pointerleave", (e) => {
            this.mouse_pos = null;
            this.mouse_event = null;

            if (this.hovered_zone !== null) {
                this.hovered_zone = null;
                this.repaint_needed = true;
                this.on_unhover();
            }

            if (this.repaint_needed) {
                this.request_repaint();
            }
        }, { signal: this.unsubscribe.signal });

        // let update_mouse_pos = (e: PointerEvent) => {
        // }

        c.addEventListener("pointermove", (e) => {
            this.update_mouse_pos(e);
        }, { signal: this.unsubscribe.signal });

        c.addEventListener("pointerdown", (e) => {
            c.setPointerCapture(e.pointerId);
            let { mouse_pos, hovered_zone } = this.update_mouse_pos(e);
            if (e.button === 0) {
                hovered_zone?.on_left_mouse_down?.(mouse_pos);
            }
        }, { signal: this.unsubscribe.signal });

        c.addEventListener("pointerup", (e) => {
            c.releasePointerCapture(e.pointerId);
            let { mouse_pos, hovered_zone } = this.update_mouse_pos(e);
            if (e.button === 0) {
                hovered_zone?.on_left_mouse_up?.(mouse_pos);
            }
        }, { signal: this.unsubscribe.signal });

        // anchor: R0OI8LKK
        // We don't request repaint here, because rAF fires before ResizeObserver, so we'd be painting with wrong resolution.
        // Instead, we only request repaint from ResizeObserver.
        // ResizeObserver is guaranteed to trigger once after we started observing the element, so this works for initialization.
        // Paint is delayed by one frame, but it seems there is no way around it if we want to use accurate resolution from ResizeObserver.
    }

    private clear_mouse_pos() {
        assert(!!this.#canvas);

        this.mouse_pos = null;
        this.mouse_event = null;

        if (this.hovered_zone !== null) {
            this.hovered_zone = null;
            this.on_unhover();
            this.request_repaint();
        }

        this.#canvas.style.cursor = "default";
    }

    private update_mouse_pos(e: PointerEvent) {
        assert(!!this.#canvas);

        let coords = pointer_event_to_canvas_coords(e, this.#canvas);
        this.mouse_pos = coords;
        this.mouse_event = e;

        let prev_hovered_zone = this.hovered_zone;
        this.hovered_zone = NOT_COMPUTED;
        let hovered_zone = this.get_hovered_zone();
        if (prev_hovered_zone !== hovered_zone) {
            this.request_repaint();
        }
        let on_hover = hovered_zone?.on_hover;
        if (on_hover) {
            let { x, y } = this.mouse_pos;
            on_hover({ x, y, event: this.mouse_event } )
        } else {
            this.on_unhover();
        }

        this.#canvas.style.cursor = hovered_zone?.cursor || "default";
        return { mouse_pos: this.mouse_pos, hovered_zone };
    }

    private get_zones(): Zone[] {
        if (this.zones !== NOT_COMPUTED) return this.zones;
        if (!this.#canvas) return [];

        // anchor: R0OI8LKK
        // Without this check, if we move mouse over the canvas right when it's being attached to rez,
        // mouse move handler will trigger before resize observer, and we'll call ui_fn()
        // with uninitialized width and height.
        if (this.width === 0) return [];

        if (this.log) console.time("ui_fn");
        let zones = this.ui_fn({ canvas: this.#canvas, width: this.width, height: this.height });
        if (this.log) console.timeEnd("ui_fn");
        zones.sort((a, b) => a.priority - b.priority);
        this.zones = zones;
        return this.zones;
    }

    private get_hovered_zone(): Zone | null {
        if (this.hovered_zone !== NOT_COMPUTED) return this.hovered_zone;
        if (this.mouse_pos === null) {
            this.hovered_zone = null;
            return this.hovered_zone;
        }
        let zones = this.get_zones();

        let best: Zone | null = null;
        let dist = Infinity;
        for (let i = zones.length - 1; i >= 0; i--) {
            let zone = zones[i];
            if (best && zone.priority < best.priority) break;
            assert(!best || best.priority === zone.priority); // because zones are sorted
            if (!zone.sdf) continue;
            let d = zone.sdf(this.mouse_pos.x, this.mouse_pos.y);
            if (d < 0 && d < dist) {
                dist = d;
                best = zone;
            }
        }
        this.hovered_zone = best;
        return this.hovered_zone;
    }

    request_repaint() {
        this.repaint_needed = true;

        if (this.width === 0) {
            // We don't schedule repaint right away, and instead rely on ReziseObserver to schedule it (see anchor: R0OI8LKK)
            return;
        }

        if (!this.af_requested) {
            this.af_requested = true;
            requestAnimationFrame(() => this.paint());
        }
    }

    private paint() {
        if (this.#canvas === null) return;
        if (!this.repaint_needed) return;
        this.repaint_needed = false;
        this.af_requested = false;

        let zones = this.get_zones();
        let hovered_zone = this.get_hovered_zone();

        if (this.log) console.time("rez.paint()");
        let canvas = this.#canvas;
        assert(this.width > 0);
        canvas.width = this.width_pixels;
        canvas.height = this.height_pixels;
        let ctx = bang(canvas.getContext("2d"));
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(this.dpr, this.dpr);

        for (let z of zones) {
            z.paint?.({ hovered: z === hovered_zone });
        }
        if (this.log) console.timeEnd("rez.paint()");
    }
}

export function pointer_event_to_canvas_coords(e: PointerEvent | WheelEvent, canvas?: HTMLCanvasElement) {
    // currentTarget is only set while we are inside the event handler.
    // If we save the event for later, this field gets cleared.
    // That's why there is also an option to pass canvas explicitly.
    if (!canvas) {
        assert(e.currentTarget instanceof HTMLCanvasElement);
        canvas = e.currentTarget;
    }
    let rect = canvas.getBoundingClientRect();
    let dpr = window.devicePixelRatio;
    // this assumes canvas size is set according to dpr, anchor: XQOEPuOg
    return {
        x: e.offsetX * canvas.width / (rect.width * dpr),
        y: e.offsetY * canvas.height / (rect.height * dpr),
    };
}

const NOT_COMPUTED: unique symbol = Symbol('NOT_COMPUTED');
