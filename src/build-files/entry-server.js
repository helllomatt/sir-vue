import { createApp } from './app'

export default async (context) => {
    const { app } = createApp(context)
    return app
}
