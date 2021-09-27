import { EntryFiles, WebpackOptions } from "./renderer";
import * as path from 'path';
import * as fs from 'fs';
import { Configuration, MultiStats, webpack } from "webpack";
import { merge } from 'webpack-merge';

export class WebpackBuilder {
    options: WebpackBuilderOptions;
    config: {
        server: Configuration,
        client: Configuration
    }

    /**
     * Constructs a new instance of the Webpack Builder
     * @param options webpack builder options
     */
    constructor(options: WebpackBuilderOptions) {
        this.options = options;

        this.config = {
            server: this.options.webpackOverride ? this.options.custom.server : require('./build-files/webpack-server')(options.custom.server || {}, options, options.html),
            client: this.options.webpackOverride ? this.options.custom.client : require('./build-files/webpack-client')(options.custom.client || {}, options, options.html),
        }
    }

    /**
     * Puts together all of the options into something that webpack and ingest
     * for both the server bundle and the client bundle
     * @returns [server config, client config]
     */
    getConfig() {
        // we want the latest version of everything, so delete all prior to get the
        // latest
        if (fs.existsSync(this.options.outputFolder) && !this.options.productionMode) {
            fs.rmSync(this.options.outputFolder, {
                recursive: true
            });
        }

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

        const serverConfig = merge(Object.assign({}, this.config.server), {
            entry: outputPaths.server,
            output: {
                path: this.options.outputFolder
            }
        });
        const clientConfig = merge(Object.assign({}, this.config.client), {
            entry: outputPaths.client,
            output: {
                path: this.options.outputFolder
            }
        });

        return [serverConfig, clientConfig];
    }

    /**
     * Helper function for the build output/results of webpack to find
     * any errors and return them in a consistent format
     * @param err webpack errors
     * @param stats webpack stats
     * @returns [found errors]
     */
    hasErrors(err?: Error, stats?: MultiStats): string[] {
        if (err) {
            return [err.message];
        } else {
            const errors: string[] = [];

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

    /**
     * The function to actually run the webpack compilation and generate all of the
     * bundle files.
     * @returns webpack build promise results
     */
    build() {
        const config = this.getConfig();
        const compiler = webpack(config);
        return new Promise((resolve, reject) => {
            compiler.run((err, stats) => {
                const errors = this.hasErrors(err, stats);
                if (errors.length > 0) {
                    console.log(errors);
                    reject(`Webpack failed to compile.`);
                } else {
                    resolve(0);
                }
            });
        });
    }
};

export interface WebpackBuilderOptions {
    outputFolder: string;
    inputFile: string;
    entryFiles: EntryFiles,
    webpackOverride: boolean,
    custom: WebpackOptions,
    publicPrefix: string;
    templateFile: string;
    html: any;
    productionMode: boolean;
}