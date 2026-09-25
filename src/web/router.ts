import { createRouter, createWebHistory } from 'vue-router';
import ChartsView from './views/ChartsView.vue';
import DashboardView from './views/DashboardView.vue';
import DevicesView from './views/DevicesView.vue';
import MiniView from './views/MiniView.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: DashboardView, meta: { title: 'ダッシュボード' } },
    { path: '/charts', component: ChartsView, meta: { title: 'グラフ' } },
    { path: '/devices', component: DevicesView, meta: { title: 'デバイス' } },
    // PWA の起動先。上部バーを出さない
    { path: '/mini', component: MiniView, meta: { title: 'ミニマル表示', bare: true } },
    { path: '/:rest(.*)*', redirect: '/' },
  ],
});

router.afterEach((to) => {
  document.title = to.path === '/' ? 'Observator' : `${to.meta.title as string} - Observator`;
});
