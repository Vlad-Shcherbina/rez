import "./offensive";
import { bang } from "./assert";
import { createRoot } from "react-dom/client";

function App() {
    return <>Hello, world!</>;
}

let root = bang(document.getElementById("root"));
createRoot(root).render(<App />);
