import { createSSRApp, h } from 'vue';
import App from '{{vue-render-file}}';

export function createApp(data = {}) {
    const app = createSSRApp(App, data);
    return { app };
}