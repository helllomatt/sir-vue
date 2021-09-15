import { createSSRApp, h } from 'vue';
import App from '{{vue-render-file}}';

export function createApp(data = {}) {
    const mergedData = Object.assign(App.data ? App.data() : {}, data);
    App.data = () => (mergedData)

    const app = createSSRApp({
        render: () => h(App),
    });

    return { app };
}