import { EntryFiles, WebpackOptions } from "./renderer";
import { Configuration, MultiStats } from "webpack";
export declare class WebpackBuilder {
    options: WebpackBuilderOptions;
    config: {
        server: Configuration;
        client: Configuration;
    };
    constructor(options: WebpackBuilderOptions);
    getConfig(): Configuration[];
    hasErrors(err?: Error, stats?: MultiStats): string[];
    build(): Promise<unknown>;
}
export interface WebpackBuilderOptions {
    outputFolder: string;
    inputFile: string;
    entryFiles: EntryFiles;
    webpackOverride: boolean;
    custom: WebpackOptions;
    publicPrefix: string;
    templateFile: string;
}
