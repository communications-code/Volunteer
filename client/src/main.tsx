import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { Helmet } from "react-helmet";
import { useIframeAutoHeight } from "@/hooks/use-iframe-auto-height";

function EmbeddedAutoHeightBridge() {
  useIframeAutoHeight();
  return null;
}

createRoot(document.getElementById("root")!).render(
  <>
    <Helmet>
      <title>VFW Post 7570 - Community Needs</title>
      <meta name="description" content="Browse and support community needs through VFW Post 7570" />
    </Helmet>
    <EmbeddedAutoHeightBridge />
    <App />
  </>
);
