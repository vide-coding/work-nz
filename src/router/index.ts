import { createRouter, createWebHistory } from "vue-router";
import WorkspaceView from "../views/WorkspaceView.vue";
import ProjectsView from "../views/ProjectsView.vue";
import ProjectWorkspaceView from "../views/ProjectWorkspaceView.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      redirect: "/workspace",
    },
    {
      path: "/workspace",
      name: "workspace",
      component: WorkspaceView,
    },
    {
      path: "/projects",
      name: "projects",
      component: ProjectsView,
    },
    {
      path: "/projects/:id",
      name: "project-workspace",
      component: ProjectWorkspaceView,
      props: true,
    },
  ],
});

export default router;
