import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/workspace',
    },
    {
      path: '/workspace',
      name: 'workspace',
      component: () => import('../views/WorkspaceView.vue'),
    },
    {
      path: '/projects',
      name: 'projects',
      component: () => import('../views/ProjectsView.vue'),
    },
    {
      path: '/projects/:id',
      name: 'project-workspace',
      component: () => import('../views/ProjectWorkspaceView.vue'),
      props: true,
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('../views/SettingsView.vue'),
      children: [
        {
          path: '',
          redirect: '/settings/global',
        },
        {
          path: 'global',
          name: 'settings-global',
          component: () => import('../components/settings/GlobalSettingsPanel.vue'),
        },
        {
          path: 'workspace',
          name: 'settings-workspace',
          component: () => import('../components/settings/WorkspaceSettingsPanel.vue'),
        },
      ],
    },
  ],
})

export default router
