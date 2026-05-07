import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createHashRouter, Navigate, RouterProvider } from "react-router-dom";
import "./index.css";
import { AppShell } from "./components/AppShell";
import { SkillsPage } from "./pages/SkillsPage";
import { SkillDetailPage } from "./pages/SkillDetailPage";
import { RouterPage } from "./pages/RouterPage";
import { RunPage } from "./pages/RunPage";
import { SettingsPage } from "./pages/SettingsPage";
import { ProjectsPage } from "./pages/ProjectsPage";

const router = createHashRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/skills/global" replace /> },
      { path: "skills", element: <Navigate to="/skills/global" replace /> },
      { path: "skills/global", element: <SkillsPage mode="global" /> },
      { path: "skills/projects", element: <SkillsPage mode="projects" /> },
      { path: "skills/:name", element: <SkillDetailPage /> },
      { path: "projects", element: <ProjectsPage /> },
      { path: "router", element: <RouterPage /> },
      { path: "run", element: <RunPage /> },
      { path: "settings", element: <SettingsPage /> },
    ],
  },
]);

const root = document.getElementById("root");
if (!root) throw new Error("missing #root");

createRoot(root).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
