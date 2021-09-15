import * as express from 'express';
import { Configuration as webpackConfiguration } from 'webpack';
import { WebpackBuilderOptions } from './webpack';
/**
 * TODO:
 *  - webpack
 *  - rendering
 *  - move out file/folder checking into separate class
 *  - documentation (readme)
 *  - license
 *  - example
 */
export declare class Renderer {
    options: RendererOptions;
    constructor(options?: RendererOptions);
    /**
     * Injects the rendering middleware into the express application
     * Also creates the routes for sending out the compiled bundle files
     */
    inject(): void;
    /**
     * Express middleware function
     * @returns express middleware
     */
    engine(): express.RequestHandler;
    getCompilationOptions(overrideOptions: RendererOptionsOverride, file: string, context: any): CompilationOptions;
    templateEngineConfig(req: express.Request, res: express.Response, next: express.NextFunction, file: string, context?: any, options?: RendererOptionsOverride): CompilationOptions;
    templateEngine(req: express.Request, res: express.Response, next: express.NextFunction, file: string, context?: any, options?: RendererOptionsOverride): Promise<void>;
    compileFile(req: express.Request, res: express.Response, next: express.NextFunction, compilationOptions: CompilationOptions): Promise<void>;
    validateCompilationOptions(options: CompilationOptions): WebpackBuilderOptions;
    getWebpackOutputPath(outputRoot: string, inputFilePath: string, absolutePath?: boolean): string;
    /**
     * Takes the incoming renderer options and applies default values to all of the
     * options that are undefined.
     * @param options given renderer options
     * @returns renderer options with defaults/undefined filled out
     */
    private applyDefaultOptions;
    /**
     * Finds the project directory based on the options given to the renderer instance.
     * By default the project directory is the current working directory
     * @param pd project directory path
     * @returns given resolved project directory or its default
     */
    resolveProjectDirectory(pd?: string): string;
    /**
     * Finds/validates a folder path. If a relative path was given, it will be looked for
     * within the current project directory variable.
     * @param folder folder to resolve
     * @returns resovled folder path
     */
    resolveFolder(folder?: string, projectDirectory?: string): string;
    /**
     * Finds/validates a file path. If a relative path was given, it will be looked for
     * within the current project directory variable.
     * @param file file to resolve
     * @returns resolved file path
     */
    resolveFile(file?: string, projectDirectory?: string): string;
    /**
     * Finds and resolves a file within this package
     * @param file file to resolve
     * @returns resolved file path
     */
    resolvePackageFile(file: string): string;
}
export interface RendererOptions {
    projectDirectory?: string;
    viewsFolder?: string;
    outputFolder?: string;
    webpackOverride?: boolean;
    webpack?: WebpackOptions;
    publicPrefix?: string;
    app: express.Application;
    templateFile?: string;
    entryFiles?: EntryFiles;
}
export interface RendererOptionsOverride {
    projectDirectory?: string;
    viewsFolder?: string;
    outputFolder?: string;
    webpackOverride?: boolean;
    publicPrefix?: string;
    templateFile?: string;
    entryFiles?: EntryFiles;
}
export interface CompilationOptions {
    rendererOptions: RendererOptions;
    inputFile: string;
    context: any;
}
export interface WebpackOptions {
    client: webpackConfiguration;
    server: webpackConfiguration;
}
export interface EntryFiles {
    app: string;
    client: string;
    server: string;
}
