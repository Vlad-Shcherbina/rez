import { useEffect, useRef, useCallback, ReactNode } from "react";
import { createRoot, Root } from "react-dom/client";
import { bang } from "./assert";

export function useTooltip() {
    let div_ref = useRef<HTMLDivElement | null>(null);
    let root_ref = useRef<Root | null>(null);

    useEffect(() => {
        let el = document.createElement("div");
        el.style.cssText = `
            opacity: 0.9;
            background-color: #eee;
            position: fixed;
            pointer-events: none;
            padding: 10px;
            display: none;
            z-index: 9999;
        `;
        document.body.appendChild(el);
        div_ref.current = el;
        let root = root_ref.current = createRoot(el);

        // Without a microtask, <StrictMode> produces a warning:
        // "Attempted to synchronously unmount a root while React was already rendering."
        return () => queueMicrotask(() => {
            root.unmount();
            bang(el.parentNode).removeChild(el);
        });
    }, []);

    let set_tooltip = useCallback((content: ReactNode, e: MouseEvent) => {
        let div = bang(div_ref.current);
        let root = bang(root_ref.current);

        if (e.clientX < document.documentElement.clientWidth / 2) {
            div.style.left = e.clientX + 20 + "px";
            div.style.right = "auto";
        } else {
            div.style.right = document.documentElement.clientWidth - e.clientX + 20 + "px";
            div.style.left = "auto";
        }
        if (e.clientY < document.documentElement.clientHeight / 2) {
            div.style.top = e.clientY + 20 + "px";
            div.style.bottom = "auto";
        } else {
            div.style.bottom = document.documentElement.clientHeight - e.clientY + 20 + "px";
            div.style.top = "auto";
        }
        div.style.display = "block";
        root.render(content);
    }, []);

    let clear_tooltip = useCallback(() => {
        let div = bang(div_ref.current);
        let root = bang(root_ref.current);
        div.style.display = "none";
        root.render(<></>);
    }, []);

    return { set_tooltip, clear_tooltip };
}
