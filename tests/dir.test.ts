import { Renderer, RendererOptions } from '../src/index';
import 'mocha';
import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import { resolveFolder, resolveFile, resolvePackageFile } from '../src/dir';

describe('file/folder resolver', () => {
    it('should to resolve a folder', () => {
        expect(resolveFolder('views', __dirname)).to.equal(path.join(__dirname, 'views'));
    });

    it('should fail to resolve a folder that is blank', () => {
        expect(() => {
            resolveFolder('', __dirname)
        }).to.throw(Error, 'Cannot resolve an undefined folder.');
    });

    it('should resolve a folder that has already been resolved', () => {
        const folder = path.join(__dirname, 'views');
        expect(resolveFolder(folder)).to.equal(folder);
    });

    it('should fail to resolve a folder that is not already resolved and has no root', () => {
        expect(() => {
            resolveFolder('views')
        }).to.throw(Error, 'Failed to resolve a folder because no root folder has been set and this folder may not exist.');
    });

    it('should fail to resolve a folder that does not exist', () => {
        const folder = path.join(__dirname, '_');
        expect(() => {
            resolveFolder('_', __dirname)
        }).to.throw(Error, `Folder at path ${folder} does not exist.`);
    });

    it('should create the folder if it does not exist', (done) => {
        const randomFolderName = Math.random().toString(36).substr(2, 5);
        const root = path.join(__dirname, 'dist');
        const folder = path.join(root, randomFolderName);
        expect(resolveFolder(randomFolderName, root, true)).to.equal(folder);
        const exists = fs.existsSync(folder)
        expect(exists).to.be.true;
        if (exists) fs.unlink(folder, () => done());
    });

    it('should to resolve a file', () => {
        const root = path.join(__dirname, 'views');
        expect(resolveFile('Test.vue', root)).to.equal(path.join(root, 'Test.vue'));
    });

    it('should fail to resolve a folder that is blank', () => {
        const root = path.join(__dirname, 'views');
        expect(() => {
            resolveFile('', root)
        }).to.throw(Error, 'Cannot resolve an undefined file.');
    });

    it('should resolve a file that has already been resolved', () => {
        const file = path.join(__dirname, 'views', 'Test.vue');
        expect(resolveFile(file)).to.equal(file);
    });

    it('should fail to resolve a file that is not already resolved and has no root', () => {
        expect(() => {
            resolveFile('Test.vue')
        }).to.throw(Error, 'Cannot resolve a file becuase no root folder has been set.');
    });

    it('should fail to resolve a file that does not exist', () => {
        const root = path.join(__dirname, 'views');
        const file = path.join(root, '_');
        expect(() => {
            resolveFile('_', root)
        }).to.throw(Error, `File at path ${file} does not exist.`);
    });

    it('should to resolve a file within the package itself', () => {
        const file = path.join(__dirname, '../src/index.ts');
        expect(resolvePackageFile('index.ts')).to.equal(file);
    });

    it('should fail to resolve a file within the package itself', () => {
        const file = path.join(__dirname, '../src/_');
        expect(() => {
            resolvePackageFile('_')
        }).to.throw(Error, `Package file at path ${file} does not exist.`);
    });
});