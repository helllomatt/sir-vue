import { expect } from 'chai';
import * as express from 'express';
import { CreateRenderer, Renderer, RendererOptions } from '../src';

describe('module', () => {
    let app: express.Application;

    beforeEach(() => {
        app = express();
    });

    it('should create a new renderer instance', () => {
        const options: RendererOptions = {
            app,
            viewsFolder: 'tests',
            outputFolder: 'tests',
        };

        const renderer = CreateRenderer(options);
        expect(renderer).to.be.instanceOf(Renderer);
    });
})