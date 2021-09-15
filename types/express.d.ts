import { RendererOptionsOverride, CompilationOptions } from "../src";
import * as express from 'express';

declare global {
    namespace Express {
        export interface Response {
            vue(file: string, context?: any, options?: RendererOptionsOverride): void;
            vueConfig(file: string, context?: any, options?: RendererOptionsOverride): CompilationOptions;
        }
    }
}