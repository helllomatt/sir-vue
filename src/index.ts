import { Renderer, RendererOptions, RendererOptionsOverride, CompilationOptions } from './renderer'

export {
    Renderer,
    RendererOptions,
    RendererOptionsOverride,
    CompilationOptions,
    WebpackOverrideOptions,
    WebpackCustomOptions,
    EntryFiles,
} from './renderer'

export const CreateRenderer = (options: RendererOptions): Renderer => {
    return new Renderer(options)
}

declare global {
    namespace Express {
        export interface Response {
            vue(file: string, context?: any, options?: RendererOptionsOverride): void
            vueConfig(file: string, context?: any, options?: RendererOptionsOverride): CompilationOptions
        }
    }
}
