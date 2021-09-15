"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebpackBuilder = void 0;
const path = require("path");
const fs = require("fs");
const webpack_1 = require("webpack");
const webpack_merge_1 = require("webpack-merge");
class WebpackBuilder {
    constructor(options) {
        this.options = options;
        this.config = {
            server: this.options.webpackOverride ? this.options.custom.server : require('./build-files/webpack-server')(options.custom.server || {}, options),
            client: this.options.webpackOverride ? this.options.custom.client : require('./build-files/webpack-client')(options.custom.client || {}, options),
        };
    }
    getConfig() {
        fs.mkdirSync(this.options.outputFolder, {
            recursive: true
        });
        const serverEntryFile = path.basename(this.options.entryFiles.server);
        const clientEntryFile = path.basename(this.options.entryFiles.client);
        // output paths for server/client entry files
        const outputPaths = {
            app: path.join(this.options.outputFolder, 'app.js'),
            server: path.join(this.options.outputFolder, serverEntryFile),
            client: path.join(this.options.outputFolder, clientEntryFile)
        };
        // input paths either from the user-defined or default
        const inputPaths = {
            app: path.join(__dirname, 'build-files/app.js'),
            server: this.options.entryFiles.server,
            client: this.options.entryFiles.client
        };
        // copy server/client entry files to output location with proper information replaced
        fs.writeFileSync(outputPaths.app, fs.readFileSync(inputPaths.app, 'utf-8')
            .replace(`'{{vue-render-file}}'`, JSON.stringify(this.options.inputFile)));
        fs.writeFileSync(outputPaths.server, fs.readFileSync(inputPaths.server, 'utf-8'));
        fs.writeFileSync(outputPaths.client, fs.readFileSync(inputPaths.client, 'utf-8'));
        const serverConfig = (0, webpack_merge_1.merge)(Object.assign({}, this.config.server), {
            entry: outputPaths.server,
            output: {
                path: this.options.outputFolder
            }
        });
        const clientConfig = (0, webpack_merge_1.merge)(Object.assign({}, this.config.client), {
            entry: outputPaths.client,
            output: {
                path: this.options.outputFolder
            }
        });
        return [serverConfig, clientConfig];
    }
    hasErrors(err, stats) {
        if (err) {
            return [err.message];
        }
        else {
            const errors = [];
            if (stats) {
                if (stats.stats) {
                    stats.stats.forEach(stat => {
                        if (stat.hasErrors()) {
                            stat.compilation.errors.forEach(i => errors.push(i.message));
                        }
                    });
                }
            }
            return errors;
        }
    }
    build() {
        const config = this.getConfig();
        const compiler = (0, webpack_1.webpack)(config);
        return new Promise((resolve, reject) => {
            compiler.run((err, stats) => {
                const errors = this.hasErrors(err, stats);
                if (errors.length > 0) {
                    console.log(errors);
                    reject(`Webpack failed to compile.`);
                }
                else {
                    resolve(0);
                }
            });
        });
    }
}
exports.WebpackBuilder = WebpackBuilder;
;
