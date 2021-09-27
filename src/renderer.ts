import * as path from 'path';
import * as fs from 'fs';
import * as express from 'express';
import { Configuration as webpackConfiguration, webpack } from 'webpack';
import { WebpackBuilder, WebpackBuilderOptions } from './webpack';
import { renderToString } from '@vue/server-renderer';
const jsToString = require('js-to-string');
import { resolveFolder, resolveFile, resolvePackageFile } from './dir';

export class Renderer {
    options: ResolvedRendererOptions;

    /**
     * Creates a new instance of the renderer and applies any default
     * options
     * @param options renderer options
     */
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

        this.options.app.get(`${this.options.publicPrefix}/*/bundle-client.*.js`,
            (req: express.Request, res: express.Response) => {
                const bundleFilePath = path.join(this.options.outputFolder, req.path.replace(this.options.publicPrefix, '')); 
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
     * Compiles everything in the express router stack that uses `res.vue` without
     * sending any responses. Just outputs the files from webpack
     * @param dir base directory to replace __dirname
     * @returns promise that everything compiled
     */
    async prerender(dir?: string): Promise<any[]> {
        const promises: Promise<any>[] = [];

        this.options.app._router.stack.forEach(async ({ route }: any) => { 
            if (route && route.path && route.path.indexOf(this.options.publicPrefix) !== 0) {
                const re = RegExp('res.vue\\(([^]+\\))', 'gm');
                let match: RegExpExecArray | null = null;
                for (const stack of route.stack) {
                    while ((match = re.exec(stack.handle.toString())) !== null) {
                        if (match.length > 0) {
                            // ur mom could be harmful
                            // serious: this should only be eval'd code from the developer. if you are malicious
                            // to yourself it's time to look in the mirror: https://imgflip.com/i/5kpxd2
                            let fnText = match[0].replace(/\s\s+/g, ' ').replace('res.vue(', 'async () => await this.templateEngine(null, null, () => {}, ');
                            if (dir) {
                                fnText = fnText.replace(/__dirname/g, JSON.stringify(dir));
                            } else {
                                fnText = fnText.replace(/__dirname/g, JSON.stringify(this.options.projectDirectory));
                            }
                            const fn = eval(fnText);
                            promises.push(fn());
                        }
                    }
                }
            }
        });

       return Promise.all(promises);
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

    /**
     * Function to get all of the compilation options for a specific render call
     * @param overrideOptions options to override class options
     * @param file file to render
     * @param context context data
     * @returns compilation options
     */
    getCompilationOptions(overrideOptions: RendererOptionsOverride, file: string, context: any): CompilationOptions {
        const rendererOptions = { ...this.options, ...(overrideOptions || {}) } as ResolvedRendererOptions;

        let title = this.getTitle(overrideOptions);
        if (rendererOptions.html) {
            title ? rendererOptions.html.title = title : delete rendererOptions.html.title;
        }

        return {
            rendererOptions,
            inputFile: resolveFile(file, rendererOptions.viewsFolder),
            context: context || {}
        } as CompilationOptions;
    }

    /**
     * Figures out the title of the page based on the special `title` function in the 
     * rendere title callback. If no callback was defined, then the title defined 
     * on the request is given. If nothing ever was defined ever, then the default
     * HtmlWebpackPlugin title takes effect.
     * @param overrideOptions options provded to override
     * @returns title of the page
     */
    getTitle(overrideOptions: RendererOptionsOverride): string | null {
        let title: string | null = null;
        if (this.options.html && this.options.html.title) {
            if (typeof this.options.html.title === 'function') {
                title = overrideOptions.html && overrideOptions.html.title ? this.options.html.title(overrideOptions.html.title) : this.options.html.title();
            } else if (typeof this.options.html.title === 'string') {
                title = this.options.html.title;
            }
        } else if (overrideOptions && overrideOptions.html && overrideOptions.html.title) {
            title = overrideOptions.html.title;
        }

        return title;
    }
    
    /**
     * Returns just the compilation options for when calling the function through
     * an express request. This should mainly be called for debugging purposes to see
     * how things are working on the backend
     * @param req express requist
     * @param res express response
     * @param next express next function
     * @param file file to render
     * @param context context data
     * @param options override options
     * @returns compilation options
     */
    templateEngineConfig(req: express.Request, res: express.Response, next: express.NextFunction, file: string, context?: any, options?: RendererOptionsOverride): CompilationOptions {
        return this.getCompilationOptions(this.applyDefaultOptions({ ...this.options, ...(options || { } as ResolvedRendererOptions)}), file, context);
        
    }

    /**
     * Compiles the file, and sends out the compiled contents with the context applied to it.
     * From here, express should pick up the client bundle file and serve that so the hydration
     * can happen on the server
     * @param req express request
     * @param res express response
     * @param next express next function
     * @param file file to render
     * @param context context data
     * @param options override option
     */
    async templateEngine(req: express.Request | null, res: express.Response | null, next: express.NextFunction, file: string, context?: any, options?: RendererOptionsOverride) {
        const compilationOptions: CompilationOptions = this.getCompilationOptions(options || { app: this.options.app } as ResolvedRendererOptions, file, context);
        const webpackOptions = this.validateCompilationOptions(compilationOptions);
        const shouldCompile = !this.options.productionMode || !fs.existsSync(webpackOptions.outputFolder);
        shouldCompile ? await this.compileFile(webpackOptions) : this.validateCompilationOptions(compilationOptions);

        if (req !== null && res !== null) {
            const renderedFile = await this.renderFile(webpackOptions, compilationOptions);
            this.sendFile(req, res, next, renderedFile);
        }
    }

    /**
     * Uses webpack to compile everything needed for the page to load based on the
     * compilation options given.
     * @param compilationOptions compilation options
     * @returns options used to compile webpack
     */
    async compileFile(webpackOptions: WebpackBuilderOptions): Promise<WebpackBuilderOptions> {
        const webpackBuilder = new WebpackBuilder(webpackOptions);
        await webpackBuilder.build();
        return webpackOptions;
    }

    /**
     * Renders the compiled webpack bundle for vue, injecting all of the context data and
     * plugging it into the template to provide full, valid html.
     * @param webpackOptions data coming from a compiled webpack bundle
     * @param compilationOptions compilation options
     * @returns the rendered output as a string
     */
    async renderFile(webpackOptions: WebpackBuilderOptions, compilationOptions: CompilationOptions): Promise<string> {
        const manifest = require(path.join(webpackOptions.outputFolder, 'vue-ssr-manifest.json'));
        const appPath = path.join(webpackOptions.outputFolder, manifest['main.js']);
        const createApp = require(appPath).default;
        const app = await createApp(compilationOptions.context);
        const appContent = await renderToString(app);
        const outputFile = fs.readFileSync(path.join(webpackOptions.outputFolder, 'index.html'), 'utf-8');
        return outputFile.replace('0/** vue-ssr-initial-state **/', jsToString(compilationOptions.context)).replace('<!--vue-ssr-outlet-->', appContent);
    }

    /**
     * Sends a string of content out to an express response
     * @param req express request
     * @param res express response
     * @param next express next function
     * @param outputContent content to send
     */
    async sendFile(req: express.Request, res: express.Response, next: express.NextFunction, outputContent: string) {
        res.send(outputContent);
    }

    /**
     * Puts together all of the compilation options into something that the webpack builder
     * can use to generate the bundle files
     * @param options compilation options
     * @returns webpack builder options
     */
    validateCompilationOptions(options: CompilationOptions): WebpackBuilderOptions {
        if (!options.inputFile) {
            throw new Error(`Invalid input file to compile`);
        }

        return {
            outputFolder: this.getWebpackOutputPath(this.options.outputFolder, options.inputFile, true),
            inputFile: options.inputFile,
            entryFiles: this.options.entryFiles,
            webpackOverride: this.options.webpackOverride,
            custom: this.options.webpack,
            publicPrefix: `${this.options.publicPrefix}/${this.getWebpackOutputPath(this.options.outputFolder, options.inputFile)}`,
            templateFile: this.options.templateFile,
            html: options.rendererOptions.html,
            productionMode: this.options.productionMode
        } as WebpackBuilderOptions;
    }

    /**
     * Determines the path of the output folder that webpack should compile to.
     * @param outputRoot root folder
     * @param inputFilePath input file
     * @param absolutePath if the absolute path should be returned
     * @returns output path
     */
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
    private applyDefaultOptions(options: RendererOptions): ResolvedRendererOptions {
        const projectDirectory = this.resolveProjectDirectory(options.projectDirectory);
        return {
            projectDirectory,
            viewsFolder: resolveFolder(options.viewsFolder || 'views', projectDirectory),
            outputFolder: resolveFolder(options.outputFolder || 'dist', projectDirectory, true),
            webpackOverride: options.webpackOverride || false,
            webpack: {
                client: options.webpack?.client || {},
                server: options.webpack?.server || {},
            } as WebpackOptions,
            publicPrefix: options.publicPrefix || '/public/ssr',
            app: options.app,
            templateFile: options.templateFile ? resolveFile(options.templateFile, projectDirectory) : resolvePackageFile('build-files/template.html'),
            entryFiles: {
                app: options.entryFiles?.app ? resolveFile(options.entryFiles.app, projectDirectory) : resolvePackageFile('build-files/app.js'),
                client: options.entryFiles?.client ? resolveFile(options.entryFiles.client, projectDirectory) : resolvePackageFile('build-files/entry-client.js'),
                server: options.entryFiles?.server ? resolveFile(options.entryFiles.server, projectDirectory) : resolvePackageFile('build-files/entry-server.js')
            },
            productionMode: options.productionMode || process.env.NODE_ENV || false,
            html: options.html || {},
        } as ResolvedRendererOptions;
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
    productionMode?: boolean;
    html?: any;
}
interface ResolvedRendererOptions {
    projectDirectory: string;
    viewsFolder: string;
    outputFolder: string;
    webpackOverride: boolean;
    webpack: WebpackOptions;
    publicPrefix: string;
    app: express.Application;
    templateFile: string;
    entryFiles: EntryFiles;
    productionMode: boolean;
    html: any;
}

export interface RendererOptionsOverride {
    projectDirectory?: string;
    viewsFolder?: string;
    outputFolder?: string;
    webpackOverride?: boolean;
    publicPrefix?: string;
    templateFile?: string;
    entryFiles?: EntryFiles;
    html?: any;
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