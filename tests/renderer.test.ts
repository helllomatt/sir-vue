import { Renderer, RendererOptions, RendererOptionsOverride, CompilationOptions } from '../src/index';
import 'mocha';
import { expect } from 'chai';
import * as path from 'path';
import * as express from 'express';
import * as request from 'supertest';
import * as fs from 'fs';
import { JSDOM } from 'jsdom';
import * as process from 'process';

describe('renderer', () => {
    let app: express.Application;

    beforeEach(() => {
        app = express();
    });

    afterEach(() => {
        fs.rmSync(path.join(__dirname, 'dist', 'views'), { recursive: true, force: true });
    });

    it('should create a renderer instance', () => {
        expect(() => {
            const renderer = new Renderer();
            expect(renderer).to.be.instanceOf(Renderer);
        }).to.throw(Error, 'Missing options for the renderer.');
    });

    it('should apply default options to the renderer instance', () => {
        const options: RendererOptions = {
            app,
            viewsFolder: 'tests',
            outputFolder: 'tests',
        };

        const renderer = new Renderer(options);
        expect(renderer.options.projectDirectory).to.equal(process.cwd());
    });

    it('should create a renderer instance with minimal options', () => {
        process.chdir(__dirname);
        const options: RendererOptions = {
            app
        };

        const renderer = new Renderer(options);
        expect(renderer.options.viewsFolder).to.equal(path.join(__dirname, 'views'));
        expect(renderer.options.outputFolder).to.equal(path.join(__dirname, 'dist'));
        process.chdir('../');
    });

    it('should set a new project directory', () => {
        const options: RendererOptions = {
            app,
            viewsFolder: 'tests',
            outputFolder: 'tests',
        };

        const pd = path.join(process.cwd(), 'tests');

        const renderer = new Renderer(options);
        const projectDirectory = renderer.resolveProjectDirectory(pd);
        expect(projectDirectory).to.equal(pd);
    });

    it('should throw an error when tyring to set an invalid project directory', () => {
        const options: RendererOptions = {
            app,
            viewsFolder: 'tests',
            outputFolder: 'tests',
        };

        const renderer = new Renderer(options);

        expect(() => {
            renderer.resolveProjectDirectory('_');
        }).to.throw(Error, `Project directory at path _ does not exist.`);
    });

    it('should inject the render middleware to vue', () => {
        const options: RendererOptions = {
            app,
            viewsFolder: 'tests',
            outputFolder: 'tests',
        };

        new Renderer(options);
        expect(app._router).to.not.be.undefined;

        const middleware = (app._router.stack.filter((layer: any) => layer.name === 'bound SirVueRenderer'));
        expect(middleware.length).to.equal(1);
    });

    it('should have the vue render function attached to response', (done) => {
        const options: RendererOptions = {
            app,
            viewsFolder: 'tests/views',
            outputFolder: 'tests/dist',
        };

        const r = new Renderer(options);
        expect(app._router).to.not.be.undefined;

        const middleware = (app._router.stack.filter((layer: any) => layer.name === 'bound SirVueRenderer'));
        expect(middleware.length).to.equal(1);

        app.get('/', (req: express.Request, res: express.Response, next: express.NextFunction) => {
            expect(res.vue).to.not.be.null;
            expect(res.vueConfig).to.not.be.null;
            res.send();
        })

        request(app)
            .get('/')
            .end(done);
    });

    it('should resolve the correct files in the vue render function', (done) => {
        const options: RendererOptions = {
            app,
            projectDirectory: __dirname,
            viewsFolder: 'tests/views',
            outputFolder: 'tests/dist',
        };

        const r = new Renderer(options);
        expect(app._router).to.not.be.undefined;

        const middleware = (app._router.stack.filter((layer: any) => layer.name === 'bound SirVueRenderer'));
        expect(middleware.length).to.equal(1);

        app.get('/', (req: express.Request, res: express.Response, next: express.NextFunction) => {
            expect(res.vue).to.not.be.null;
            expect(res.vueConfig).to.not.be.null;

            const config = res.vueConfig('Test.vue', { name: 'Matthew' });
            expect(config.inputFile).to.equal(path.join(__dirname, 'views/Test.vue'));
            expect(config.context).to.deep.equal({ name: 'Matthew' });
            res.send();
        })

        request(app)
            .get('/')
            .end(done);
    });

    it('should resolve the correct files in the vue render function with custom options', (done) => {
        const options: RendererOptions = {
            app,
            projectDirectory: __dirname,
            viewsFolder: 'tests/views',
            outputFolder: 'tests/dist',
        };

        const r = new Renderer(options);
        expect(app._router).to.not.be.undefined;

        const middleware = (app._router.stack.filter((layer: any) => layer.name === 'bound SirVueRenderer'));
        expect(middleware.length).to.equal(1);

        app.get('/', (req: express.Request, res: express.Response, next: express.NextFunction) => {
            expect(res.vue).to.not.be.null;
            expect(res.vueConfig).to.not.be.null;

            const overrideOptions: RendererOptionsOverride = {
                projectDirectory: __dirname,
                viewsFolder: 'alt-views'
            };

            const config = res.vueConfig('AltTest.vue', { name: 'Matthew' }, overrideOptions);
            expect(config.inputFile).to.equal(path.join(__dirname, 'alt-views/AltTest.vue'));
            expect(config.context).to.deep.equal({ name: 'Matthew' });
            res.send();
        })

        request(app)
            .get('/')
            .end(done);
    });

    it('should validate compilation options', () => {
        const options: RendererOptions = {
            app,
            projectDirectory: __dirname,
            viewsFolder: 'tests/views',
            outputFolder: 'tests/dist',
        };

        const r = new Renderer(options);

        const compilationOptions = r.validateCompilationOptions({
            inputFile: 'Test.vue',
            rendererOptions: r.options,
            context: {},
        } as CompilationOptions);

        expect(compilationOptions.outputFolder).to.equal(path.join(__dirname, 'dist', 'Test'));
    });

    it('should get the webpack output folder', () => {
        const options: RendererOptions = {
            app,
            projectDirectory: __dirname,
            viewsFolder: 'tests/views',
            outputFolder: 'tests/dist',
        };

        const r = new Renderer(options);
        const webpackOutput = r.getWebpackOutputPath(r.options.outputFolder!, path.join(__dirname, 'Test.vue'));
        expect(webpackOutput).to.equal('Test');

        const absoluteWebpackOutput = r.getWebpackOutputPath(r.options.outputFolder!, path.join(__dirname, 'Test.vue'), true);
        expect(absoluteWebpackOutput).to.equal(path.join(__dirname, 'dist', 'Test'));
    });

    it('should fail to validate compilation options because of a missing input file variable', () => {
        const options: RendererOptions = {
            app,
            projectDirectory: __dirname,
            viewsFolder: 'tests/views',
            outputFolder: 'tests/dist',
        };

        const r = new Renderer(options);
        expect(() => {
            r.validateCompilationOptions({} as CompilationOptions);
        }).to.throw(Error, 'Invalid input file to compile');
    });

    it('should render the html file', async () => {
        const options: RendererOptions = {
            app,
            projectDirectory: __dirname,
            viewsFolder: 'tests/views',
            outputFolder: 'tests/dist',
        };

        const r = new Renderer(options);
        const compilationOptions = r.getCompilationOptions({ app } as RendererOptions, 'Test.vue', {});
        
        await r.compileFile(compilationOptions);
        
        const indexFileExistance = fs.existsSync(path.join(__dirname, 'dist', 'views', 'Test', 'index.html'));
        expect(indexFileExistance).to.deep.equal(true);
    }).timeout(30 * 1000);

    it('should render a basic component', async () => {
        const options: RendererOptions = {
            app,
            projectDirectory: __dirname,
            viewsFolder: 'tests/views',
            outputFolder: 'tests/dist',
        };

        const r = new Renderer(options);
        const compilationOptions = r.getCompilationOptions({ app } as RendererOptions, 'Test.vue', {});

        const webpackOptions = await r.compileFile(compilationOptions);
        const indexFilePath = path.join(__dirname, 'dist', 'views', 'Test', 'index.html');
        const indexFileExistance = fs.existsSync(indexFilePath);
        expect(indexFileExistance).to.deep.equal(true);

        const dom = new JSDOM(await r.renderFile(webpackOptions, compilationOptions));
        const testElement = dom.window.document.querySelector('#test')
        expect(testElement).to.not.be.null;
        expect(testElement!.textContent).to.equal('Hello, world!');
    }).timeout(30 * 1000);

    it('should serve out a rendered vue file from express', async () => {
        const options: RendererOptions = {
            app,
            projectDirectory: __dirname,
            viewsFolder: 'tests/views',
            outputFolder: 'tests/dist',
        };

        const r = new Renderer(options);
        expect(app._router).to.not.be.undefined;

        const middleware = (app._router.stack.filter((layer: any) => layer.name === 'bound SirVueRenderer'));
        expect(middleware.length).to.equal(1);

        app.get('/', (req: express.Request, res: express.Response, next: express.NextFunction) => {
            res.vue('Test.vue', {}, {});
        });

        const req = await request(app)
            .get('/')
            .expect(200);

        const dom = new JSDOM(req.text);
        const testElement = dom.window.document.querySelector('#test')
        expect(testElement).to.not.be.null;
        expect(testElement!.textContent).to.equal('Hello, world!');
    }).timeout(30 * 1000);

    it('should use the template engine to render a file and serve it out', async () => {
        const options: RendererOptions = {
            app,
            projectDirectory: __dirname,
            viewsFolder: 'tests/views',
            outputFolder: 'tests/dist',
        };

        let response = '';
        const r = new Renderer(options);
        const req = {} as express.Request;
        const res = {
            send(text) { response = text }
        } as express.Response;
        const next = () => {}
        await r.templateEngine(req, res, next, 'Test.vue', {}, {});

        expect(response).to.not.equal('');
        const dom = new JSDOM(response);
        const testElement = dom.window.document.querySelector('#test')
        expect(testElement).to.not.be.null;
        expect(testElement!.textContent).to.equal('Hello, world!');
    }).timeout(30 * 1000);

    it('should render components with sub components', async () => {
        const options: RendererOptions = {
            app,
            projectDirectory: __dirname,
            viewsFolder: 'tests/views',
            outputFolder: 'tests/dist',
        };

        let response = '';
        const r = new Renderer(options);
        const req = {} as express.Request;
        const res = {
            send(text) { response = text }
        } as express.Response;
        const next = () => { }
        await r.templateEngine(req, res, next, 'TestParent.vue', {}, {});

        expect(response).to.not.equal('');
        const dom = new JSDOM(response);

        const testParentElement = dom.window.document.querySelector('#test-parent')
        expect(testParentElement).to.not.be.null;
        expect(testParentElement!.textContent).to.equal(`Hello, world I'm a parent!`);

        const testChildElement = dom.window.document.querySelector('#test-child')
        expect(testChildElement).to.not.be.null;
        expect(testChildElement!.textContent).to.equal(`Hello, world I'm a sub component!`);
        expect(testChildElement!.previousSibling).to.equal(testParentElement);
    }).timeout(30 * 1000);

    it('should prerender the bundle based on the routes given, without calling the route', async () => {
        const options: RendererOptions = {
            app,
            projectDirectory: __dirname,
            viewsFolder: 'tests/views',
            outputFolder: 'tests/dist',
        };

        const r = new Renderer(options);
        expect(app._router).to.not.be.undefined;

        const middleware = (app._router.stack.filter((layer: any) => layer.name === 'bound SirVueRenderer'));
        expect(middleware.length).to.equal(1);

        app.get('/', (req: express.Request, res: express.Response, next: express.NextFunction) => {
            res.vue('Test.vue', {}, {});
        });
        app.get('/another', (req: express.Request, res: express.Response, next: express.NextFunction) => {
            res.vue('AnotherTest.vue', {}, {});
        });

        await r.prerender();

        const outputTestFolder = path.join(__dirname, 'dist/views/Test')
        const testFolderExists = fs.existsSync(outputTestFolder);
        expect(testFolderExists).to.be.true;;

        const outputAnotherFolder = path.join(__dirname, 'dist/views/Test')
        const anotherFolderExists = fs.existsSync(outputAnotherFolder);
        expect(anotherFolderExists).to.be.true;
    }).timeout(30 * 1000);

    it('should render a prerendered bundle/file', async () => {
        const options: RendererOptions = {
            app,
            projectDirectory: __dirname,
            viewsFolder: 'tests/views',
            outputFolder: 'tests/dist',
        };

        const r = new Renderer(options);
        expect(app._router).to.not.be.undefined;

        const middleware = (app._router.stack.filter((layer: any) => layer.name === 'bound SirVueRenderer'));
        expect(middleware.length).to.equal(1);

        app.get('/', (req: express.Request, res: express.Response, next: express.NextFunction) => {
            res.vue('Test.vue', {}, {});
        });

        await r.prerender();
        r.options.productionMode = true;

        const req = await request(app)
            .get('/')
            .expect(200);

        const outputTestFolder = path.join(__dirname, 'dist/views/Test')
        const testFolderExists = fs.existsSync(outputTestFolder);
        expect(testFolderExists).to.be.true;

        const dom = new JSDOM(req.text);
        const testElement = dom.window.document.querySelector('#test')
        expect(testElement).to.not.be.null;
        expect(testElement!.textContent).to.equal('Hello, world!');
    }).timeout(30 * 1000);
});
