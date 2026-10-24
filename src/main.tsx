import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { themeOptions } from "virtual:theme-options";
import { ThemeProvider } from "@/components/soleone/theme";
import { THEME_STORAGE_KEY } from "@/theme/config";
import { App } from "./App";
import "./index.css";

const router = createBrowserRouter([{ path: "*", element: <App /> }]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider themes={themeOptions} storageKey={THEME_STORAGE_KEY}>
      <RouterProvider router={router} />
    </ThemeProvider>
  </StrictMode>,
);
