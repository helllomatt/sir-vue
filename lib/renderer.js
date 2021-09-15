"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Renderer = void 0;
const path = require("path");
const fs = require("fs");
const express = require("express");
const webpack_1 = require("./webpack");
const server_renderer_1 = require("@vue/server-renderer");
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
class Renderer {
    constructor(options) {
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
        console.log(`${this.options.publicPrefix}/*/bundle-client.js`);
        this.options.app.get(`${this.options.publicPrefix}/*/bundle-client.js`, (req, res) => {
            const bundleFilePath = path.join(this.options.outputFolder, req.path.replace(this.options.publicPrefix, ''));
            console.log(bundleFilePath);
            if (fs.existsSync(bundleFilePath)) {
                res.setHeader('Content-Type', 'application/javascript');
                res.send(fs.readFileSync(bundleFilePath, 'utf-8'));
            }
            else {
                res.status(404);
                res.send(`Couldn't find the bundle file. Is the output folder correct? Is everything compiling?`);
            }
        });
    }
    /**
     * Express middleware function
     * @returns express middleware
     */
    engine() {
        const self = this;
        return function SirVueRenderer(req, res, next) {
            res.vue = self.templateEngine.bind(self, req, res, next);
            res.vueConfig = self.templateEngineConfig.bind(self, req, res, next);
            return next();
        }.bind(this);
    }
    getCompilationOptions(overrideOptions, file, context) {
        const rendererOptions = Object.assign(Object.assign({}, this.options), (overrideOptions || {}));
        return {
            rendererOptions,
            inputFile: this.resolveFile(file, rendererOptions.viewsFolder),
            context: context || {}
        };
    }
    templateEngineConfig(req, res, next, file, context, options) {
        return this.getCompilationOptions(this.applyDefaultOptions(Object.assign(Object.assign({}, this.options), (options || {}))), file, context);
    }
    templateEngine(req, res, next, file, context, options) {
        const compilationOptions = this.getCompilationOptions(options || { app: express() }, file, context);
        return this.compileFile(req, res, next, compilationOptions);
    }
    compileFile(req, res, next, compilationOptions) {
        return __awaiter(this, void 0, void 0, function* () {
            const webpackOptions = this.validateCompilationOptions(compilationOptions);
            const webpackBuilder = new webpack_1.WebpackBuilder(webpackOptions);
            yield webpackBuilder.build();
            const manifest = require(path.join(webpackOptions.outputFolder, 'vue-ssr-manifest.json'));
            const appPath = path.join(webpackOptions.outputFolder, manifest['main.js']);
            const createApp = require(appPath).default;
            const app = yield createApp(compilationOptions.context);
            const appContent = yield (0, server_renderer_1.renderToString)(app);
            const outputFile = fs.readFileSync(path.join(webpackOptions.outputFolder, 'index.html'), 'utf-8');
            const outputContent = outputFile.replace('0/** vue-ssr-initial-state **/', jsToString(compilationOptions.context)).replace('<!--vue-ssr-outlet-->', appContent);
            res.send(outputContent);
        });
    }
    validateCompilationOptions(options) {
        if (!options.inputFile) {
            throw new Error(`Invalid input file to compile`);
        }
        if (!this.options.outputFolder) {
            throw new Error(`Cannot compile to output folder ${this.options.outputFolder}`);
        }
        if (!this.options.entryFiles) {
            throw new Error(`Cannot use provided entry files to compile. ${this.options.entryFiles}`);
        }
        const override = this.options.webpackOverride || false;
        let customWebpackOptions;
        if (!this.options.webpack) {
            customWebpackOptions = {
                server: {},
                client: {}
            };
        }
        else {
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
        };
    }
    getWebpackOutputPath(outputRoot, inputFilePath, absolutePath = false) {
        const diff = path.relative(outputRoot, inputFilePath).split(path.sep).filter(i => i !== '..' && i !== '.').join(path.sep);
        const parsed = path.parse(diff);
        if (absolutePath) {
            return path.join(outputRoot, parsed.dir, parsed.name);
        }
        else {
            return path.join(parsed.dir, parsed.name);
        }
    }
    /**
     * Takes the incoming renderer options and applies default values to all of the
     * options that are undefined.
     * @param options given renderer options
     * @returns renderer options with defaults/undefined filled out
     */
    applyDefaultOptions(options) {
        var _a, _b, _c, _d, _e;
        const projectDirectory = this.resolveProjectDirectory(options.projectDirectory);
        return {
            projectDirectory,
            viewsFolder: this.resolveFolder(options.viewsFolder, projectDirectory),
            outputFolder: this.resolveFolder(options.outputFolder, projectDirectory),
            webpackOverride: options.webpackOverride || false,
            webpack: {
                client: ((_a = options.webpack) === null || _a === void 0 ? void 0 : _a.client) || {},
                server: ((_b = options.webpack) === null || _b === void 0 ? void 0 : _b.server) || {},
            },
            publicPrefix: options.publicPrefix || '/public/ssr',
            app: options.app,
            templateFile: options.templateFile ? this.resolveFile(options.templateFile, projectDirectory) : this.resolvePackageFile('build-files/template.html'),
            entryFiles: {
                app: ((_c = options.entryFiles) === null || _c === void 0 ? void 0 : _c.app) ? this.resolveFile(options.entryFiles.app, projectDirectory) : this.resolvePackageFile('build-files/app.js'),
                client: ((_d = options.entryFiles) === null || _d === void 0 ? void 0 : _d.client) ? this.resolveFile(options.entryFiles.client, projectDirectory) : this.resolvePackageFile('build-files/entry-client.js'),
                server: ((_e = options.entryFiles) === null || _e === void 0 ? void 0 : _e.server) ? this.resolveFile(options.entryFiles.server, projectDirectory) : this.resolvePackageFile('build-files/entry-server.js')
            }
        };
    }
    /**
     * Finds the project directory based on the options given to the renderer instance.
     * By default the project directory is the current working directory
     * @param pd project directory path
     * @returns given resolved project directory or its default
     */
    resolveProjectDirectory(pd) {
        if (pd && !fs.existsSync(pd)) {
            throw new Error(`Project directory at path ${pd} does not exist.`);
        }
        return pd || process.cwd();
    }
    /**
     * Finds/validates a folder path. If a relative path was given, it will be looked for
     * within the current project directory variable.
     * @param folder folder to resolve
     * @returns resovled folder path
     */
    resolveFolder(folder, projectDirectory) {
        if (!folder || folder === '') {
            throw new Error(`Cannot resolve an undefined folder.`);
        }
        // check if the given "folder" is actually a path
        if (fs.existsSync(folder)) {
            return path.resolve(folder);
        }
        else {
            if (!this.options) {
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
    resolveFile(file, projectDirectory) {
        if (!file || file === '') {
            throw new Error(`Cannot resolve an undefined file.`);
        }
        // check if the given "file" is actually a path
        if (fs.existsSync(file)) {
            return path.resolve(file);
        }
        else {
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
    resolvePackageFile(file) {
        const packageRoot = __dirname;
        const fp = path.join(packageRoot, file);
        if (!fs.existsSync(fp)) {
            throw new Error(`Package file at path ${fp} does not exist.`);
        }
        return fp;
    }
}
exports.Renderer = Renderer;
