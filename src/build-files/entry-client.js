let context = {}
if (window.__INITIAL_STATE__) {
    context = window.__INITIAL_STATE__;
}

import { createApp } from './app';
const { app } = createApp(context);

app.mount('#app', true);