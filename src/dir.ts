import * as path from 'path'
import { FSOptions } from './renderer'

const cache: any = {};

/**
 * Finds/validates a folder path. If a relative path was given, it will be looked for
 * within the current project directory variable.
 * @param folder folder to resolve
 * @param rootFolder root folder path to look for the folder in
 * @returns resovled folder path
 */
export const resolveFolder = (
    fsOverride: FSOptions,
    folder: string,
    rootFolder?: string,
    createIfNotExists: boolean = false
): string => {
    if (!folder || folder === '') {
        throw new Error(`Cannot resolve an undefined folder.`)
    }

    if (cache[folder]) {
        return cache[folder];
    } else 
    // check if the given "folder" is actually a path
    if (fsOverride.exists(folder)) {
        cache[folder] = path.resolve(folder);
        return cache[folder]
    } else {
        if (!rootFolder) {
            throw new Error(
                `Failed to resolve a folder because no root folder has been set and this folder may not exist.`
            )
        }

        const fp = path.join(rootFolder, folder)

        if (!fsOverride.exists(fp)) {
            if (createIfNotExists) {
                fsOverride.mkdir(fp)
                cache[folder] = path.resolve(fp);
            } else {
                throw new Error(`Folder at path ${fp} does not exist.`)
            }
        }

        return fp
    }
}

/**
 * Finds/validates a file path. If a relative path was given, it will be looked for
 * within the current project directory variable.
 * @param file file to resolve
 * @param rootFolder root folder path to look for the folder in
 * @returns resolved file path
 */
export const resolveFile = (fsOverride: FSOptions, file: string, rootFolder?: string): string => {
    if (!file || file === '') {
        throw new Error(`Cannot resolve an undefined file.`)
    }

    // check if the given "file" is actually a path
    if (fsOverride.exists(file)) {
        return path.resolve(file)
    } else {
        if (!rootFolder) {
            throw new Error(`Cannot resolve a file becuase no root folder has been set.`)
        }

        const fp = path.join(rootFolder, file)

        if (!fsOverride.exists(fp)) {
            throw new Error(`File at path ${fp} does not exist.`)
        }

        return fp
    }
}

/**
 * Finds and resolves a file within this package
 * @param file file to resolve
 * @returns resolved file path
 */
export const resolvePackageFile = (fsOverride: FSOptions, file: string): string => {
    const packageRoot = __dirname
    const fp = path.join(packageRoot, file)

    if (!fsOverride.exists(fp)) {
        throw new Error(`Package file at path ${fp} does not exist.`)
    }

    return fp
}
