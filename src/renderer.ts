import * as path from 'path'
import * as fs from 'fs'
import * as crypto from 'crypto'
import * as express from 'express'
import { Configuration as webpackConfiguration, webpack } from 'webpack'
import { WebpackBuilder, WebpackBuilderOptions } from './webpack'
import { renderToString } from '@vue/server-renderer'
const jsToString = require('js-to-string')
import { resolveFolder, resolveFile, resolvePackageFile } from './dir'
const Cryptr = require('cryptr')

export class Renderer {
    options: ResolvedRendererOptions
    defaultFs: FSOptions
    moduleCache: { [key: string]: any } = {}
    crypt: any

    /**
     * Creates a new instance of the renderer and applies any default
     * options
     * @param options renderer options
     */
    constructor(options?: RendererOptions) {
        if (!options) {
            throw new Error(`Missing options for the renderer.`)
        }

        this.defaultFs = {
            exists: fs.existsSync,
            read: (filePath: string) => fs.readFileSync(filePath, 'utf-8'),
            write: fs.writeFileSync,
            mkdir: (dirPath: string) => fs.mkdirSync(dirPath, { recursive: true }),
            rm: (filePath: string) => fs.rmSync(filePath, { recursive: true }),
        }

        this.options = this.applyDefaultOptions(options)
        const obfuscateHash = crypto.createHash('sha256').update(String(this.options.projectDirectory)).digest('base64')
        this.crypt = new Cryptr(obfuscateHash)

        this.inject()
    }

    /**
     * Injects the rendering middleware into the express application
     * Also creates the routes for sending out the compiled bundle files
     */
    inject() {
        this.options.app.use(this.engine())

        this.options.app.get(
            `${this.options.publicPrefix}/*/bundle-client.*.js`,
            (req: express.Request, res: express.Response) => {
                const bundleFilePath = this.getBundleFilePathFromRequst(req.path)
                if (this.options.fs.exists(bundleFilePath)) {
                    res.setHeader('Content-Type', 'application/javascript')
                    res.send(this.options.fs.read(bundleFilePath))
                } else {
                    res.status(404)
                    res.send(`Couldn't find the bundle file. Is the output folder correct? Is everything compiling?`)
                }
            }
        )

        this.options.app.get(
            `${this.options.publicPrefix}/*/bundle-client.*.css`,
            (req: express.Request, res: express.Response) => {
                const bundleFilePath = this.getBundleFilePathFromRequst(req.path)
                if (this.options.fs.exists(bundleFilePath)) {
                    res.setHeader('Content-Type', 'text/css')
                    res.send(this.options.fs.read(bundleFilePath))
                } else {
                    res.status(404)
                    res.send(`Couldn't find the bundle file. Is the output folder correct? Is everything compiling?`)
                }
            }
        )

        if (!this.options.productionMode) {
            this.options.app.get(
                `${this.options.publicPrefix}/*/bundle-client.*.(js|css).map`,
                (req: express.Request, res: express.Response) => {
                    const bundleFilePath = this.getBundleFilePathFromRequst(req.path)
                    if (this.options.fs.exists(bundleFilePath)) {
                        res.setHeader('Content-Type', 'application/json')
                        res.send(this.options.fs.read(bundleFilePath))
                    } else {
                        res.status(404)
                        res.send(
                            `Couldn't find the source map file. Is the output folder correct? Is everything compiling?`
                        )
                    }
                }
            )
        }
    }

    /**
     * Takes an obfuscated request path and turns it into the path to the
     * bundle file.
     *
     * e.g. /public/ssr/ansopdfkjnapwoienfklqwjerj-asiudfnq;weornq;wr/bundle.client.js -> /public/ssr/views/Index/bundle.client.js
     * @param requestPath request path
     * @returns bundle file path
     */
    getBundleFilePathFromRequst(requestPath: string): string {
        const requestPathParts = requestPath.replace(this.options.publicPrefix, '').split('/')
        const bundlePath = this.clarify(requestPathParts[1])
        return path.join(this.options.outputFolder, bundlePath, requestPathParts.slice(2).join('/'))
    }

    /**
     * Compiles everything in the express router stack that uses `res.vue` without
     * sending any responses. Just outputs the files from webpack
     * @param dir base directory to replace __dirname
     * @returns promise that everything compiled
     */
    async prerender(dir?: string): Promise<any[]> {
        const promises: Promise<any>[] = []
        this.renderRouteStack(this.options.app._router, dir).forEach((promise) => promises.push(promise))
        return Promise.all(promises)
    }

    /**
     * Recursively renders the express router stack
     * @param route route to render
     * @param dir replacement for __dirname
     * @returns
     */
    renderRouteStack(route: any, dir?: string): Promise<any>[] {
        let promises: Promise<any>[] = []
        for (const stack of route.stack) {
            if (stack.route && stack.route.path && stack.route.path.indexOf(this.options.publicPrefix) === 0) {
                continue
            }

            if (stack.handle?.stack) {
                this.renderRouteStack(stack.handle, dir).forEach((promise) => promises.push(promise))
            } else if (stack.route) {
                stack.route.stack.forEach((layer: any) => {
                    promises = [].concat(promises as [], this.evaluateRenderFunction(layer.handle, dir) as [])
                })
            } else if (stack.handle) {
                promises = [].concat(promises as [], this.evaluateRenderFunction(stack.handle, dir) as [])
            }
        }

        return promises
    }

    /**
     * Evaluates any found `res.vue` functions and renders them
     * @param handle express handle function
     * @param dir replacement for __dirname
     * @returns
     */
    evaluateRenderFunction(handle: any, dir?: string): Promise<any>[] {
        let promises: Promise<any>[] = []
        const re = /res.vue\(([^]+\))/gm
        let match = null
        while ((match = re.exec(handle.toString())) !== null) {
            if (match.length > 0) {
                let renderFunctionString = this.getRenderFunctionString(match[0], dir)
                // ur mom could be harmful
                // serious: this should only be eval'd code from the developer. if you are malicious
                // to yourself it's time to look in the mirror: https://imgflip.com/i/5kpxd2
                const fn = eval(renderFunctionString)
                promises.push(fn())
            }
        }

        return promises
    }

    /**
     * Turns a `res.vue` call into a `this.templateEngine` call so that
     * it can be evaluated from inside this context for prerendering.
     * @param match matched render function
     * @param dir replacement for __dirname
     * @returns
     */
    getRenderFunctionString(match: string, dir?: string): string {
        let fnText = match.replace(/\s\s+/g, ' ').replace('res.vue(', '(null, null, () => {}, ')
        if (dir) {
            fnText = fnText.replace(/__dirname/g, JSON.stringify(dir))
        } else {
            fnText = fnText.replace(/__dirname/g, JSON.stringify(this.options.projectDirectory))
        }

        // now that we have the render function, we need to purge anything that
        // isn't needed like the context and render variables
        const params = fnText.match(/\(null, null, \(\) => {}, ([^)]+)\)/)
        let basicParams = null
        if (params) {
            const paramString = params[0].substring(1, params[0].length - 1)
            const paramArray = paramString.split(',')
            const paramArrayClean = paramArray.map((param) => param.replace(/['"]+/g, ''))
            const paramArrayClean2 = paramArrayClean.map((param) => param.trim())
            if (paramArrayClean2.length > 4) {
                paramArrayClean2.splice(4)
            }
            paramArrayClean2[paramArrayClean2.length - 1] = `'${paramArrayClean2[paramArrayClean2.length - 1]}'`
            basicParams = paramArrayClean2.join(', ')
        }

        return `async () => await this.templateEngine(${basicParams})`
    }

    /**
     * Express middleware function
     * @returns express middleware
     */
    engine(): express.RequestHandler {
        const self = this
        return function SirVueRenderer(req: express.Request, res: any, next: express.NextFunction) {
            res.vue = self.templateEngine.bind(self, req, res, next)
            res.vueConfig = self.templateEngineConfig.bind(self, req, res, next)
            return next()
        }.bind(this)
    }

    /**
     * Function to get all of the compilation options for a specific render call
     * @param overrideOptions options to override class options
     * @param file file to render
     * @param context context data
     * @returns compilation options
     */
    getCompilationOptions(overrideOptions: RendererOptionsOverride, file: string, context: any): CompilationOptions {
        const rendererOptions = this.applyDefaultOptions({ ...this.options, ...(overrideOptions || {}) })

        let title = this.getTitle(overrideOptions)
        if (rendererOptions.html) {
            rendererOptions.html.title = title ? title : path.basename(file)
        }

        return {
            rendererOptions,
            inputFile: resolveFile(this.defaultFs, file, rendererOptions.viewsFolder),
            context: context || {},
        } as CompilationOptions
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
        let title: string | null = null
        if (this.options.html && this.options.html.title) {
            if (typeof this.options.html.title === 'function') {
                title =
                    overrideOptions.html && overrideOptions.html.title
                        ? this.options.html.title(overrideOptions.html.title)
                        : this.options.html.title()
            } else if (typeof this.options.html.title === 'string') {
                title = this.options.html.title
            }
        } else if (overrideOptions && overrideOptions.html && overrideOptions.html.title) {
            title = overrideOptions.html.title
        }

        return title
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
    templateEngineConfig(
        req: express.Request,
        res: express.Response,
        next: express.NextFunction,
        file: string,
        context?: any,
        options?: RendererOptionsOverride
    ): CompilationOptions {
        return this.getCompilationOptions(
            this.applyDefaultOptions({ ...this.options, ...(options || ({} as ResolvedRendererOptions)) }),
            file,
            context
        )
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
    async templateEngine(
        req: express.Request | null,
        res: express.Response | null,
        next: express.NextFunction,
        file: string,
        context?: any,
        options?: RendererOptionsOverride
    ) {
        const compilationOptions: CompilationOptions = this.getCompilationOptions(
            options || ({ app: this.options.app } as ResolvedRendererOptions),
            file,
            context
        )
        const webpackOptions = this.validateCompilationOptions(compilationOptions)
        const shouldCompile = !this.options.productionMode || !this.options.fs.exists(webpackOptions.outputFolder)
        shouldCompile ? await this.compileFile(webpackOptions) : this.validateCompilationOptions(compilationOptions)

        if (req !== null && res !== null) {
            const renderedFile = await this.renderFile(webpackOptions, compilationOptions)
            this.sendFile(req, res, next, renderedFile)
        }
    }

    /**
     * Uses webpack to compile everything needed for the page to load based on the
     * compilation options given.
     * @param compilationOptions compilation options
     * @returns options used to compile webpack
     */
    async compileFile(webpackOptions: WebpackBuilderOptions): Promise<WebpackBuilderOptions> {
        const webpackBuilder = new WebpackBuilder(webpackOptions)
        await webpackBuilder.build()
        return webpackOptions
    }

    /**
     * Creates a node module from string content and returns the module.
     * This is used to support caching of compiled files.
     * @param src source content
     * @param filename require file name
     * @returns node module
     */
    requireFromString(src: string, filename: string) {
        if (this.moduleCache[filename]) {
            return this.moduleCache[filename]
        }

        const Module: any = module.constructor
        const paths = Module._nodeModulePaths(path.dirname(filename))

        const parent: any = module.parent
        const mod = new Module(filename, parent)
        mod.filename = filename
        mod.paths = [].concat(paths)
        mod._compile(src, filename)

        const exports = mod.exports
        this.moduleCache[filename] = exports

        return exports
    }

    /**
     * Renders the compiled webpack bundle for vue, injecting all of the context data and
     * plugging it into the template to provide full, valid html.
     * @param webpackOptions data coming from a compiled webpack bundle
     * @param compilationOptions compilation options
     * @returns the rendered output as a string
     */
    async renderFile(webpackOptions: WebpackBuilderOptions, compilationOptions: CompilationOptions): Promise<string> {
        const manifest = JSON.parse(
            this.options.fs.read(path.join(webpackOptions.outputFolder, 'vue-ssr-manifest.json'))
        )
        const appPath = path.join(webpackOptions.outputFolder, manifest['main.js'])
        const createApp = this.requireFromString(this.options.fs.read(appPath), appPath).default
        const app = await createApp(compilationOptions.context)
        const appContent = await renderToString(app)
        const outputFile = this.options.fs.read(path.join(webpackOptions.outputFolder, 'index.html'))
        return outputFile
            .replace(
                '/** sir-vue-initial-state **/',
                `window.__INITIAL_STATE__ = ${jsToString(compilationOptions.context)}`
            )
            .replace('<!--sir-vue-outlet-->', `<div id='app'>${appContent}</div>`)
    }

    /**
     * Sends a string of content out to an express response
     * @param req express request
     * @param res express response
     * @param next express next function
     * @param outputContent content to send
     */
    async sendFile(req: express.Request, res: express.Response, next: express.NextFunction, outputContent: string) {
        res.send(outputContent)
    }

    /**
     * Puts together all of the compilation options into something that the webpack builder
     * can use to generate the bundle files
     * @param options compilation options
     * @returns webpack builder options
     */
    validateCompilationOptions(options: CompilationOptions): WebpackBuilderOptions {
        if (!options.inputFile) {
            throw new Error(`Invalid input file to compile`)
        }

        return {
            outputFolder: this.getWebpackOutputPath(this.options.outputFolder, options.inputFile, true),
            inputFile: options.inputFile,
            entryFiles: this.options.entryFiles,
            webpackOverride: this.options.webpackOverride,
            custom: this.options.webpack,
            publicPrefix: `${this.options.publicPrefix}/${this.obfuscate(
                this.getWebpackOutputPath(this.options.outputFolder, options.inputFile)
            )}`,
            templateFile: this.options.templateFile,
            html: options.rendererOptions.html,
            productionMode: this.options.productionMode,
            projectDirectory: this.options.projectDirectory,
            fs: this.options.fs,
        } as WebpackBuilderOptions
    }

    /**
     * Determines the path of the output folder that webpack should compile to.
     * @param outputRoot root folder
     * @param inputFilePath input file
     * @param absolutePath if the absolute path should be returned
     * @returns output path
     */
    getWebpackOutputPath(outputRoot: string, inputFilePath: string, absolutePath: boolean = false): string {
        const diff = path
            .relative(outputRoot, inputFilePath)
            .split(path.sep)
            .filter((i) => i !== '..' && i !== '.')
            .join(path.sep)
        const parsed = path.parse(diff)

        if (absolutePath) {
            return path.join(outputRoot, parsed.dir, parsed.name)
        } else {
            return path.join(parsed.dir, parsed.name)
        }
    }

    /**
     * Takes the incoming renderer options and applies default values to all of the
     * options that are undefined.
     * @param options given renderer options
     * @returns renderer options with defaults/undefined filled out
     */
    private applyDefaultOptions(options: RendererOptions): ResolvedRendererOptions {
        const projectDirectory = this.resolveProjectDirectory(options.projectDirectory)

        return {
            projectDirectory,
            viewsFolder: resolveFolder(this.defaultFs, options.viewsFolder || 'views', projectDirectory),
            outputFolder: resolveFolder(this.defaultFs, options.outputFolder || 'dist', projectDirectory, true),
            webpackOverride: options.webpackOverride || false,
            webpack: {
                client: options.webpack?.client || {},
                server: options.webpack?.server || {},
            } as WebpackOverrideOptions | WebpackCustomOptions,
            publicPrefix: options.publicPrefix || '/public/ssr',
            app: options.app,
            templateFile: options.templateFile
                ? resolveFile(this.defaultFs, options.templateFile, projectDirectory)
                : resolvePackageFile(this.defaultFs, 'build-files/template.html'),
            entryFiles: {
                app: options.entryFiles?.app
                    ? resolveFile(this.defaultFs, options.entryFiles.app, projectDirectory)
                    : resolvePackageFile(this.defaultFs, 'build-files/app.js'),
                client: options.entryFiles?.client
                    ? resolveFile(this.defaultFs, options.entryFiles.client, projectDirectory)
                    : resolvePackageFile(this.defaultFs, 'build-files/entry-client.js'),
                server: options.entryFiles?.server
                    ? resolveFile(this.defaultFs, options.entryFiles.server, projectDirectory)
                    : resolvePackageFile(this.defaultFs, 'build-files/entry-server.js'),
            },
            productionMode: options.productionMode || process.env.NODE_ENV || false,
            html: options.html || {},
            fs: options.fs || this.defaultFs,
        } as ResolvedRendererOptions
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

        return pd || process.cwd()
    }

    /**
     * Takes in a string and creates an encrypted string from it using the
     * project directory as the KEY and the IV.
     *
     * This is not password grade encryption. It is for hiding any directory listings
     * when resolving bundle files.
     * @param text string to obfuscate
     * @returns obfuscated string
     */
    obfuscate(text: string): string {
        return this.crypt.encrypt(text)
    }

    /**
     * Takes in an obfuscated string and returns the original string
     * (opposite of the obfuscate function)
     * @param text string to deobfuscate
     * @returns deobfuscated string
     */
    clarify(text: string): string {
        return this.crypt.decrypt(text)
    }
}

export interface RendererOptions {
    projectDirectory?: string
    viewsFolder?: string
    outputFolder?: string
    webpackOverride?: boolean
    webpack?: WebpackOverrideOptions | WebpackCustomOptions
    publicPrefix?: string
    app: express.Application
    templateFile?: string
    entryFiles?: EntryFilesOption
    productionMode?: boolean
    html?: any
    fs?: FSOptions
}
interface ResolvedRendererOptions {
    projectDirectory: string
    viewsFolder: string
    outputFolder: string
    webpackOverride: boolean
    webpack: WebpackOverrideOptions | WebpackCustomOptions
    publicPrefix: string
    app: express.Application
    templateFile: string
    entryFiles: EntryFiles
    productionMode: boolean
    html: any
    fs: FSOptions
}

export interface FSOptions {
    exists: (path: string) => boolean
    read: (path: string) => string
    write: (path: string, content: string) => void
    mkdir: (path: string) => void
    rm: (path: string) => void
}

export interface RendererOptionsOverride {
    projectDirectory?: string
    viewsFolder?: string
    outputFolder?: string
    webpackOverride?: boolean
    publicPrefix?: string
    templateFile?: string
    entryFiles?: EntryFiles
    html?: any
}

export interface CompilationOptions {
    rendererOptions: RendererOptions
    inputFile: string
    context: any
}

export interface WebpackOverrideOptions {
    client: (options: WebpackBuilderOptions, html: any) => webpackConfiguration
    server: (options: WebpackBuilderOptions, html: any) => webpackConfiguration
}

export interface WebpackCustomOptions {
    client: webpackConfiguration
    server: webpackConfiguration
}

export interface EntryFiles {
    app: string
    client: string
    server: string
}

export interface EntryFilesOption {
    app?: string
    client?: string
    server?: string
}
