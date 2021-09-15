import * as path from 'path';
import * as fs from 'fs';
import * as express from 'express';
import { Configuration as webpackConfiguration } from 'webpack';
import { WebpackBuilder, WebpackBuilderOptions } from './webpack';
import { renderToString } from '@vue/server-renderer';
const jsToString = require('js-to-string');

/**
 * TODO:
 *  - webpack
 *  - rendering
 *  - move out file/folder checking into separate class
 *  - documentation (readme)
 *  - license
 *  - example
 */

export class Renderer {
    options: RendererOptions;

    constructor(options?: RendererOptions) {
        if (!options) {
            throw new Error(`Missing options for the renderer.`);
        }
        
        this.options = this.applyDefaultOptions(options);
        this.inject();
    }

    /**
     * Injects the rendering middleware into the express application
     * Also creates the routes for sending out the compiled bundle files
     */
    inject() {
        this.options.app.use(this.engine());

        this.options.app.get(`${this.options.publicPrefix}/*/bundle-client.js`,
            (req: express.Request, res: express.Response) => {
                const bundleFilePath = path.join(this.options.outputFolder!, req.path.replace(this.options.publicPrefix!, '')); 
                console.log(bundleFilePath);
                if (fs.existsSync(bundleFilePath)) {
                    res.setHeader('Content-Type', 'application/javascript');
                    res.send(fs.readFileSync(bundleFilePath, 'utf-8'));
                } else {
                    res.status(404);
                    res.send(`Couldn't find the bundle file. Is the output folder correct? Is everything compiling?`);
                }
            },
        );
    }

    /**
     * Express middleware function
     * @returns express middleware
     */
    engine(): express.RequestHandler {
        const self = this;
        return function SirVueRenderer(req: express.Request, res: any, next: express.NextFunction) {
            res.vue = self.templateEngine.bind(self, req, res, next);
            res.vueConfig = self.templateEngineConfig.bind(self, req, res, next);
            return next();
        }.bind(this);
    }

    getCompilationOptions(overrideOptions: RendererOptionsOverride, file: string, context: any): CompilationOptions {
        const rendererOptions = { ...this.options, ...(overrideOptions || {}) } as RendererOptions;

        return {
            rendererOptions,
            inputFile: this.resolveFile(file, rendererOptions.viewsFolder),
            context: context || {}
        } as CompilationOptions;
    }
    

    templateEngineConfig(req: express.Request, res: express.Response, next: express.NextFunction, file: string, context?: any, options?: RendererOptionsOverride): CompilationOptions {
        return this.getCompilationOptions(this.applyDefaultOptions({ ...this.options, ...(options || { } as RendererOptions)}), file, context);
        
    }

    async templateEngine(req: express.Request, res: express.Response, next: express.NextFunction, file: string, context?: any, options?: RendererOptionsOverride) {
        const compilationOptions = this.getCompilationOptions(options || { app: this.options.app } as RendererOptions, file, context);
        const webpackOptions = await this.compileFile(compilationOptions);
        const renderedFile = await this.renderFile(webpackOptions, compilationOptions);
        this.sendFile(req, res, next, renderedFile);
    }

    async compileFile(compilationOptions: CompilationOptions): Promise<WebpackBuilderOptions> {
        const webpackOptions = this.validateCompilationOptions(compilationOptions);
        const webpackBuilder = new WebpackBuilder(webpackOptions);
        await webpackBuilder.build();
        return webpackOptions;
    }

    async renderFile(webpackOptions: WebpackBuilderOptions, compilationOptions: CompilationOptions): Promise<string> {
        const manifest = require(path.join(webpackOptions.outputFolder, 'vue-ssr-manifest.json'));
        const appPath = path.join(webpackOptions.outputFolder, manifest['main.js']);
        const createApp = require(appPath).default;
        const app = await createApp(compilationOptions.context);
        const appContent = await renderToString(app);
        const outputFile = fs.readFileSync(path.join(webpackOptions.outputFolder, 'index.html'), 'utf-8');
        return outputFile.replace('0/** vue-ssr-initial-state **/', jsToString(compilationOptions.context)).replace('<!--vue-ssr-outlet-->', appContent);
    }

    async sendFile(req: express.Request, res: express.Response, next: express.NextFunction, outputContent: string) {
        res.send(outputContent);
    }

    validateCompilationOptions(options: CompilationOptions): WebpackBuilderOptions {
        if (!options.inputFile) {
            throw new Error(`Invalid input file to compile`);
        }

        if (!this.options.outputFolder) {
            throw new Error(`Cannot compile to output folder ${this.options.outputFolder}`);
        }

        if (!this.options.entryFiles) {
            throw new Error(`Cannot use provided entry files to compile. ${this.options.entryFiles}`);
        }

        const override: boolean = this.options.webpackOverride || false

        let customWebpackOptions: WebpackOptions;
        if (!this.options.webpack) {
            customWebpackOptions = {
                server: {},
                client: {}
            };
        } else {
            customWebpackOptions = this.options.webpack;
        }

        return {
            outputFolder: this.getWebpackOutputPath(this.options.outputFolder, options.inputFile, true),
            inputFile: options.inputFile,
            entryFiles: this.options.entryFiles,
            webpackOverride: override,
            custom: customWebpackOptions,
            publicPrefix: `${this.options.publicPrefix}/${this.getWebpackOutputPath(this.options.outputFolder, options.inputFile)}`,
            templateFile: this.options.templateFile,
        } as WebpackBuilderOptions;
    }

    getWebpackOutputPath(outputRoot: string, inputFilePath: string, absolutePath: boolean = false): string {
        const diff = path.relative(outputRoot, inputFilePath).split(path.sep).filter(i => i !== '..' && i !== '.').join(path.sep);
        const parsed = path.parse(diff);

        if (absolutePath) {
            return path.join(
                outputRoot,
                parsed.dir,
                parsed.name
            )
        } else {
            return path.join(
                parsed.dir,
                parsed.name
            );
        }
    }

    /**
     * Takes the incoming renderer options and applies default values to all of the 
     * options that are undefined.
     * @param options given renderer options
     * @returns renderer options with defaults/undefined filled out
     */
    private applyDefaultOptions(options: RendererOptions): RendererOptions {
        const projectDirectory = this.resolveProjectDirectory(options.projectDirectory);
        return {
            projectDirectory,
            viewsFolder: this.resolveFolder(options.viewsFolder, projectDirectory),
            outputFolder: this.resolveFolder(options.outputFolder, projectDirectory),
            webpackOverride: options.webpackOverride || false,
            webpack: {
                client: options.webpack?.client || {},
                server: options.webpack?.server || {},
            } as WebpackOptions,
            publicPrefix: options.publicPrefix || '/public/ssr',
            app: options.app,
            templateFile: options.templateFile ? this.resolveFile(options.templateFile, projectDirectory) : this.resolvePackageFile('build-files/template.html'),
            entryFiles: {
                app: options.entryFiles?.app ? this.resolveFile(options.entryFiles.app, projectDirectory) : this.resolvePackageFile('build-files/app.js'),
                client: options.entryFiles?.client ? this.resolveFile(options.entryFiles.client, projectDirectory) : this.resolvePackageFile('build-files/entry-client.js'),
                server: options.entryFiles?.server ? this.resolveFile(options.entryFiles.server, projectDirectory) : this.resolvePackageFile('build-files/entry-server.js')
            }
        } as RendererOptions;
    }

    /**
     * Finds the project directory based on the options given to the renderer instance.
     * By default the project directory is the current working directory
     * @param pd project directory path
     * @returns given resolved project directory or its default
     */
    resolveProjectDirectory(pd?: string): string {
        if (pd && !fs.existsSync(pd)) {
            throw new Error(`Project directory at path ${pd} does not exist.`)
        }

        return pd || process.cwd();
    }

    /**
     * Finds/validates a folder path. If a relative path was given, it will be looked for
     * within the current project directory variable.
     * @param folder folder to resolve
     * @returns resovled folder path
     */
    resolveFolder(folder?: string, projectDirectory?: string): string {
        if (!folder || folder === '') {
            throw new Error(`Cannot resolve an undefined folder.`);
        }

        // check if the given "folder" is actually a path
        if (fs.existsSync(folder)) {
            return path.resolve(folder);
        } else {
            if (!this.options) {
                console.log(this.options);
                throw new Error(`Failed to resolve folder because no project directory has been set and this folder may not exist.`);
            }

            const pd = projectDirectory || this.options.projectDirectory || null;

            if (!pd) {
                throw new Error(`Cannot resolve a folder no project directory has been set.`);
            }

            const fp = path.join(pd, folder);

            if (!fs.existsSync(fp)) {
                throw new Error(`Folder at path ${fp} does not exist.`);
            }

            return fp;
        }
    }

    /**
     * Finds/validates a file path. If a relative path was given, it will be looked for
     * within the current project directory variable.
     * @param file file to resolve
     * @returns resolved file path
     */
    resolveFile(file?: string, projectDirectory?: string): string {
        if (!file || file === '') {
            throw new Error(`Cannot resolve an undefined file.`);
        }

        // check if the given "file" is actually a path
        if (fs.existsSync(file)) {
            return path.resolve(file);
        } else {
            const pd = projectDirectory || this.options.projectDirectory || null;

            if (!pd) {
                throw new Error(`Cannot resolve a file no project directory has been set.`);
            }

            const fp = path.join(pd, file);

            if (!fs.existsSync(fp)) {
                throw new Error(`File at path ${fp} does not exist.`);
            }

            return fp;
        }
    }

    /**
     * Finds and resolves a file within this package
     * @param file file to resolve
     * @returns resolved file path
     */
    resolvePackageFile(file: string): string {
        const packageRoot = __dirname;
        const fp = path.join(packageRoot, file);

        if (!fs.existsSync(fp)) {
            throw new Error(`Package file at path ${fp} does not exist.`);
        }

        return fp;
    }
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
    // TODO: add htmlwebpackplugin options
}

export interface RendererOptionsOverride {
    projectDirectory?: string;
    viewsFolder?: string;
    outputFolder?: string;
    webpackOverride?: boolean;
    publicPrefix?: string;
    templateFile?: string;
    entryFiles?: EntryFiles;
    // TODO: add htmlwebpackplugin options
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