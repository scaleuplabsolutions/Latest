import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "@fontsource/inter";

// Add material icons
const materialIconsLink = document.createElement("link");
materialIconsLink.href = "https://fonts.googleapis.com/icon?family=Material+Icons";
materialIconsLink.rel = "stylesheet";
document.head.appendChild(materialIconsLink);

createRoot(document.getElementById("root")!).render(<App />);
