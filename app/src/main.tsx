// app/src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App";
import { ConvexClerkProvider } from "@/components/ConvexClerkProvider";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConvexClerkProvider>
      <App />
    </ConvexClerkProvider>
  </React.StrictMode>,
);
