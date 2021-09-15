import { Renderer, RendererOptions, RendererOptionsOverride, CompilationOptions } from '../src/index';
import 'mocha';
import { expect } from 'chai';
import * as path from 'path';
import * as express from 'express';
import * as request from 'supertest';
import * as fs from 'fs';
import { JSDOM } from 'jsdom';

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

    it('should try to resolve a folder', () => {
        const options: RendererOptions = {
            app,
            viewsFolder: 'tests',
            outputFolder: 'tests',
        };

        const renderer = new Renderer(options);
        expect(renderer.options.viewsFolder).to.equal(path.join(process.cwd(), 'tests'));

        expect(() => {
            renderer.options.projectDirectory = undefined;
            renderer.resolveFolder('testers');
        }).to.throw(Error, `Cannot resolve a folder no project directory has been set.`);

        renderer.options.projectDirectory = process.cwd();

        expect(() => {
            renderer.resolveFolder();
        }).to.throw(Error, `Cannot resolve an undefined folder.`);

        expect(() => {
            renderer.resolveFolder('');
        }).to.throw(Error, `Cannot resolve an undefined folder.`);

        const vfSrc = path.join(process.cwd(), 'src');
        const viewsFolder = renderer.resolveFolder(vfSrc);
        expect(viewsFolder).to.equal(vfSrc);

        expect(() => {
            renderer.resolveFolder('_');
        }).to.throw(Error, `Folder at path ${path.join(process.cwd(), '_')} does not exist.`);
    });

    it('should try to resolve a file', () => {
        const options: RendererOptions = {
            app,
            viewsFolder: 'tests',
            outputFolder: 'tests',
        };

        const renderer = new Renderer(options);
        expect(renderer.options.viewsFolder).to.equal(path.join(process.cwd(), 'tests'));

        expect(() => {
            renderer.options.projectDirectory = undefined;
            renderer.resolveFile('_');
        }).to.throw(Error, `Cannot resolve a file no project directory has been set.`);

        renderer.options.projectDirectory = process.cwd();

        expect(() => {
            renderer.resolveFile();
        }).to.throw(Error, `Cannot resolve an undefined file.`);

        expect(() => {
            renderer.resolveFile('');
        }).to.throw(Error, `Cannot resolve an undefined file.`);

        const vfSrc = path.join(process.cwd(), 'src', 'index.ts');
        const viewsFolder = renderer.resolveFile(vfSrc);
        expect(viewsFolder).to.equal(vfSrc);

        expect(() => {
            renderer.resolveFile('_');
        }).to.throw(Error, `File at path ${path.join(process.cwd(), '_')} does not exist.`);
    });

    it('should try to resolve a file within the package itself', () => {
        const options: RendererOptions = {
            app,
            viewsFolder: 'tests',
            outputFolder: 'tests',
        };

        const renderer = new Renderer(options);

        // __dirname is tests right now, but we need it to be src
        const file = path.join(__dirname, '../src/index.ts');
        expect(renderer.resolvePackageFile('index.ts')).to.equal(file);

        expect(() => {
            renderer.resolvePackageFile('_');
        }).to.throw(Error, `Package file at path ${path.join(__dirname, '../src/_')} does not exist.`);
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
});
