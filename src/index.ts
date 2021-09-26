import { Renderer, RendererOptions } from './renderer';

export {
    Renderer, RendererOptions, RendererOptionsOverride, CompilationOptions, WebpackOptions, EntryFiles } from './renderer';

export const CreateRenderer = (options: RendererOptions): Renderer => {
    return new Renderer(options);
}