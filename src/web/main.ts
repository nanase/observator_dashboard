import { createApp } from 'vue';
import App from './App.vue';
import { applyStoredTheme } from './composables/useTheme';
import { router } from './router';
import './styles.css';

applyStoredTheme();
createApp(App).use(router).mount('#app');
