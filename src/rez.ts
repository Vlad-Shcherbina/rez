import { assert, bang } from "./assert";

export type Zone = {
    priority: number,
    sdf?: (x: number, y: number) => number,  // negative for inside
    cursor?: string,
    /**
     * Zones paint in priority order into a shared ctx whose transform is reset
     * once per pass, so ctx state deliberately leaks from lower- to higher-priority
     * zones (e.g. a paint-only zone can ctx.translate() everything painted after it,
     * see ADRs/006-drag-hack.md).
     */
    paint?: (args: {
        hovered: boolean,
        hovered_zone: Zone | null,

        // for debugging repaints
        ui_fn_count: number,
        paint_count: number,
    }) => void,
    on_left_mouse_down?: (args: { x: number, y: number }) => void,
    on_left_mouse_up?: (args: { x: number, y: number }) => void,
    on_right_mouse_down?: (args: { x: number, y: number }) => void,
    on_right_mouse_up?: (args: { x: number, y: number }) => void,

    /**
     * `on_hover` is called when mouse moves over the zone,
     * or when the zone first comes into existence and the mouse happens to be over it already.
     *
     * After any state change that triggers `ui_fn` recomputation and repaint,
     * we intentionally rerun current_zone.on_hover (anchor: m0h5cK7X).
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

// Stable identity, so reconcile's "zones changed" comparison stays honest
// while there is no canvas or no size yet.
const no_zones: Zone[] = [];

export class Rez {
    #ui_fn: UiFn = () => [];
    #canvas: HTMLCanvasElement | null = null;

    private repaint_needed: boolean = false;
    private af_requested: boolean = false; // af - animation frame

    private measured: { dpr: number, width: number, height: number } | null = null;  // owned by RO

    private ui_fn_count = 0;
    private paint_count = 0;

    // Derived values, refreshed by reconcile() (see ADRs/009-reconcile.md).
    // Always fresh by the time paint() runs, because every input mutation
    // reconciles first (microtask before rAF on the ui_fn path).
    private zones: Zone[] = no_zones;
    private hovered_zone: Zone | null = null;
    private mouse_pos: { x: number, y: number } | null = null;

    private zones_memo: {
        ui_fn: UiFn,
        canvas: HTMLCanvasElement,
        width: number,
        height: number,
        dpr: number,
        zones: Zone[],
    } | null = null;

    private mouse_event: PointerEvent | null = null;
    private hover_active = false; // an on_hover has fired and no on_unhover since

    private unsubscribe = new AbortController();

    // meant to be private, but we need to access it from PaintState
    paint_states: Set<PaintState<unknown>> = new Set();

    /**
     * Fires on the falling edge of "an on_hover has been dispatched"
     * (anchor: m0h5cK7X). Should tolerate redundant calls: the exactly-once
     * behavior is an implementation nicety, not a contract.
     */
    on_unhover: () => void = () => {};

    log: boolean = true;

    constructor() {}

    get ui_fn() { return this.#ui_fn; }
    set ui_fn(f: UiFn) {
        this.#ui_fn = f;
        // anchor: 76UVNDC4
        // Deferred: this setter runs mid-React-commit (from useLayoutEffect).
        // Reconciling synchronously would fire app handlers before sibling effects
        // of the same commit have run (e.g. before on_unhover is reassigned on the
        // next line), and would make the
        // ui_fn -> on_hover -> setState -> rerender -> ui_fn cycle recursive
        // instead of a flat microtask ping-pong.
        queueMicrotask(() => this.reconcile("frame"));
    }

    get canvas() { return this.#canvas; }
    set canvas(c) {
        if (this.#canvas === c) { return; }
        this.#canvas = c;

        // Inputs measured against the old canvas are meaningless.
        this.mouse_event = null;
        this.measured = null;

        this.unsubscribe.abort();
        this.unsubscribe = new AbortController();

        // Normally ResizeObserver will call reconcile(), but there are edge cases:
        // when c === null, or when canvas has display:none or otherwise not rendered.
        // Deferred for the same reason as in the ui_fn setter (anchor: 76UVNDC4):
        // this setter also runs mid-React-commit, and this reconcile can fire
        // on_unhover, releasing hover held against the old canvas. Deferring also
        // means that falling edge reaches the on_unhover assigned in the same
        // commit, not the stale one.
        queueMicrotask(() => this.reconcile("frame"));

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
                this.measured = { dpr, width, height };

                // Set the canvas resolution here, not in paint(), so that ui_fn() always
                // observes the correct canvas.width/height. ui_fn() can run before the first
                // paint(), e.g. from the pointermove handler.
                // Guarded because assigning width/height clears the bitmap even when the
                // value is unchanged. That matters when this callback fires with the
                // rounded pixel size unchanged and reconcile derives "nothing to repaint"
                // (zones memo hit): an unconditional assignment would blank the canvas.
                if (c.width !== width_pixels) c.width = width_pixels;
                if (c.height !== height_pixels) c.height = height_pixels;

                if (this.log) console.log("resize obs", { dpr, width_pixels, height_pixels, width, height });

                // anchor: IJ5uYVqh
                // Paint synchronously ("now") rather than in rAF to avoid flicker:
                // the resolution change cleared the canvas, and this callback runs in
                // the frame's rendering steps (the same slot as rAF), before the frame
                // is presented.
                this.reconcile("now");
            }
        });

        try {
            obs.observe(c, {box: 'device-pixel-content-box'});
        } catch (e) {
            // fallback for Safari
            obs.observe(c, {box: 'content-box'});
        }
        this.unsubscribe.signal.addEventListener("abort", () => obs.disconnect(), { once: true });

        c.addEventListener("pointerleave", () => {
            this.mouse_event = null;
            this.reconcile("frame");
        }, { signal: this.unsubscribe.signal });

        c.addEventListener("pointermove", (e) => {
            this.handle_pointer_event(e);
        }, { signal: this.unsubscribe.signal });

        c.addEventListener("contextmenu", (e) => {
            e.preventDefault();
        }, { signal: this.unsubscribe.signal });

        c.addEventListener("pointerdown", (e) => {
            c.setPointerCapture(e.pointerId);
            this.handle_pointer_event(e);
        }, { signal: this.unsubscribe.signal });

        c.addEventListener("pointerup", (e) => {
            c.releasePointerCapture(e.pointerId);
            this.handle_pointer_event(e);
        }, { signal: this.unsubscribe.signal });
    }

    private handle_pointer_event(e: PointerEvent) {
        this.mouse_event = e;
        // Sync reconcile, so the dispatch below sees a hovered_zone computed from
        // this very event (the pointer may have moved since the last pointermove).
        // Consequence: on_hover fires before the mouse-button handler.
        this.reconcile("frame");

        // pointerdown/pointerup only fire for the first press and final release.
        // Changes to chorded buttons arrive as pointermove with button identifying
        // the changed button and buttons containing the state after the change.
        let handler: Zone["on_left_mouse_down"];
        if (e.button === 0) {
            handler = (e.buttons & 1) !== 0
                ? this.hovered_zone?.on_left_mouse_down
                : this.hovered_zone?.on_left_mouse_up;
        } else if (e.button === 2) {
            handler = (e.buttons & 2) !== 0
                ? this.hovered_zone?.on_right_mouse_down
                : this.hovered_zone?.on_right_mouse_up;
        } else {
            return;
        }

        let mouse_pos = bang(this.mouse_pos);
        call_handler(() => handler?.(mouse_pos));
    }

    /**
     * The single choke point: every input mutation (ui_fn, canvas, size, mouse event)
     * is followed by exactly one reconcile() call, which refreshes the derived values
     * and decides all reactions (handlers, cursor, repaint). See ADRs/009-reconcile.md.
     *
     * "now" paints synchronously; only for the resize path, where the canvas was just
     * cleared and we are already in the frame's rendering steps.
     */
    private reconcile(paint_timing: "frame" | "now") {
        let prev_zones = this.zones;
        let prev_hovered_zone = this.hovered_zone;

        this.zones = this.get_zones();
        this.mouse_pos = this.mouse_event === null ? null
            : pointer_event_to_canvas_coords(this.mouse_event, bang(this.#canvas));
        this.hovered_zone = hit_test(this.zones, this.mouse_pos);

        // Repaint iff something paint() reads has changed
        // (PaintState.set has its own subscription path).
        if (this.zones !== prev_zones || this.hovered_zone !== prev_hovered_zone) {
            this.repaint_needed = true;
        }

        // anchor: m0h5cK7X
        // on_hover is a level handler: it fires on every reconcile while the mouse is
        // over a zone that has it (apps rely on this for live coordinates, and it
        // makes hover state path-independent across ui_fn changes).
        // on_unhover is a transition handler: it fires once, on the falling edge of
        // "an on_hover has been dispatched", and never while the mouse is elsewhere,
        // so it can't clobber a tooltip that meanwhile belongs to another element.
        let event = this.mouse_event;
        let on_hover = this.hovered_zone?.on_hover;
        if (event !== null && on_hover !== undefined) {
            let { x, y } = bang(this.mouse_pos);
            call_handler(() => on_hover({ x, y, event }));
            this.hover_active = true;
        } else if (this.hover_active) {
            this.hover_active = false;
            call_handler(() => this.on_unhover());
        }

        if (this.#canvas !== null) {
            this.#canvas.style.cursor = this.hovered_zone?.cursor || "default";
        }

        if (this.repaint_needed) {
            if (paint_timing === "now") {
                this.paint();
            } else {
                this.request_repaint();
            }
        }
    }

    private get_zones(): Zone[] {
        let measured = this.measured;
        if (this.#canvas === null || measured === null || measured.width === 0) return no_zones;

        // Identity memo; the key is the complete set of inputs ui_fn() can observe
        // (dpr because canvas.width = width * dpr, anchor: XQOEPuOg).
        // No invalidation calls anywhere: staleness is checked here, at the point of use.
        let m = this.zones_memo;
        if (m !== null
            && m.ui_fn === this.#ui_fn
            && m.canvas === this.#canvas
            && m.width === measured.width
            && m.height === measured.height
            && m.dpr === measured.dpr
        ) {
            return m.zones;
        }

        if (this.log) console.time("ui_fn");
        this.ui_fn_count += 1;
        let zones = this.#ui_fn({ canvas: this.#canvas, width: measured.width, height: measured.height });
        if (this.log) console.timeEnd("ui_fn");
        zones.sort((a, b) => a.priority - b.priority);
        this.zones_memo = { ui_fn: this.#ui_fn, canvas: this.#canvas, width: measured.width, height: measured.height, dpr: measured.dpr, zones };
        return zones;
    }

    request_repaint() {
        this.repaint_needed = true;

        if (!this.af_requested) {
            this.af_requested = true;
            requestAnimationFrame(() => {
                this.af_requested = false;
                this.paint();
            });
        }
    }

    private paint() {
        if (this.#canvas === null) return;
        let measured = this.measured;
        if (measured === null || measured.width === 0) return;
        if (!this.repaint_needed) return;
        this.repaint_needed = false;

        let zones = this.zones;
        let hovered_zone = this.hovered_zone;

        if (this.log) console.time("rez.paint()");
        let canvas = this.#canvas;
        let ctx = bang(canvas.getContext("2d"));
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.scale(measured.dpr, measured.dpr);

        for (let ps of this.paint_states) {
            let had = ps.subscribers.delete(this);
            assert(had);
        }
        this.paint_states.clear();

        assert(current_rez_for_paint_state === DISALLOWED);
        // Intentional: publish the currently-painting Rez as ambient context
        // for PaintState.get()/set(). Not the pre-ES6 `const self = this` pattern.
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        current_rez_for_paint_state = this;
        try {
            for (let z of zones) {
                z.paint?.({ hovered: z === hovered_zone, hovered_zone, ui_fn_count: this.ui_fn_count, paint_count: this.paint_count });
            }
        } finally {
            assert(current_rez_for_paint_state === this);
            current_rez_for_paint_state = DISALLOWED;
        }

        this.paint_count += 1;
        if (this.log) console.timeEnd("rez.paint()");
    }
}

function hit_test(zones: Zone[], mouse_pos: { x: number, y: number } | null): Zone | null {
    if (mouse_pos === null) return null;

    let best: Zone | null = null;
    let dist = Infinity;
    for (let i = zones.length - 1; i >= 0; i--) {
        let zone = zones[i];
        if (best && zone.priority < best.priority) break;
        assert(!best || best.priority === zone.priority); // because zones are sorted
        if (!zone.sdf) continue;
        let d = zone.sdf(mouse_pos.x, mouse_pos.y);
        if (d < 0 && d < dist) {
            dist = d;
            best = zone;
        }
    }
    return best;
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

export class PaintState<T> {
    #value: T;
    subscribers: Set<Rez> = new Set();

    constructor(value: T) {
        this.#value = value;
    }

    get(): T {
        assert(current_rez_for_paint_state !== DISALLOWED, "paint state can only be accessed in paint() or event handler");
        if (current_rez_for_paint_state !== NONE) {
            let rez = current_rez_for_paint_state;
            if (this.subscribers.has(rez)) {
                assert(rez.paint_states.has(this));
            } else {
                assert(!rez.paint_states.has(this));
                this.subscribers.add(rez);
                rez.paint_states.add(this);
            }
        }
        return this.#value;
    }

    set(value: T) {
        if (this.#value === value) return;
        this.#value = value;
        for (let rez of this.subscribers) {
            rez.request_repaint();
        }
    }
}

const NONE: unique symbol = Symbol('NONE');
const DISALLOWED: unique symbol = Symbol('DISALLOWED');

// Set to a specific Rez instance when painting,
// to NONE in event handlers, and to DISALLOWED elsewhere (e.g. in ui_fn()).
let current_rez_for_paint_state: Rez | typeof NONE | typeof DISALLOWED = DISALLOWED;

function call_handler(f: () => void) {
    assert(current_rez_for_paint_state === DISALLOWED);
    current_rez_for_paint_state = NONE;
    try {
        f();
    } finally {
        assert(current_rez_for_paint_state === NONE);
        current_rez_for_paint_state = DISALLOWED;
    }
}
