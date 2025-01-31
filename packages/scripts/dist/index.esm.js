import { isPlainObject, isFullString, isFullArray } from 'is-what';
import { merge } from 'merge-anything';
import { parse } from 'vue-docgen-api';
import logSymbols from 'log-symbols';
import chalk from 'chalk';
import { getProp } from 'path-to-prop';
import * as fs from 'fs';
import * as path from 'path';
import { resolve } from 'path';
import { readdir } from 'fs/promises';
import { kebabCase, pascalCase } from 'case-anything';
import { trimChars } from 'lodash/fp';

/*! *****************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */

function __awaiter(thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
}

/**
 * extract alias file config absolute path and nested property by dot
 * @param {string} alias
 */
function extractAliasPath(alias) {
    const [configFilePath, ...aliasNested] = alias.replace(/^#|#$/g, '').split('#');
    const aliasAbsolutePath = path.isAbsolute(configFilePath)
        ? configFilePath
        : path.resolve(process.cwd(), configFilePath);
    if (!fs.existsSync(aliasAbsolutePath)) {
        throw new Error(`[vue-intellisense] ${aliasAbsolutePath} is not found`);
    }
    // not nested alias
    if (aliasNested.length === 0) {
        return { aliasAbsolutePath, nestedPropsByDot: '' };
    }
    // example: resolve.alias
    const nestedPropsByDot = aliasNested.join('.');
    return { aliasAbsolutePath, nestedPropsByDot };
}
/**
 *
 * @param aliasAbsolutePath
 * @param nestedPropsByDot like: resolve.alias
 * @returns
 */
function getAliasFromFilePath(aliasAbsolutePath, nestedPropsByDot) {
    const configFile = require(aliasAbsolutePath);
    if (!nestedPropsByDot)
        return configFile;
    return getProp(configFile, nestedPropsByDot) || null;
}
function readAndParseAlias(rawAliases) {
    let parsedAliase = {};
    // contain merged aliase of all file config
    rawAliases.map((rawAlias) => {
        const { aliasAbsolutePath, nestedPropsByDot } = extractAliasPath(rawAlias);
        const extractedAliasObj = getAliasFromFilePath(aliasAbsolutePath, nestedPropsByDot);
        if (!extractedAliasObj) {
            throw new Error(`[vue-intellisense] ${rawAlias} is not contain alias config object`);
        }
        if (isPlainObject(extractedAliasObj))
            parsedAliase = merge(parsedAliase, extractedAliasObj);
    });
    return parsedAliase;
}
/**
 *  Make console.warn throw, so that we can check warning aliase config not correct
 */
function handleWarningMissingAlias() {
    const warn = console.warn;
    console.warn = function (message, ...args) {
        warn.apply(console, args);
        if (['Neither', 'nor', 'or', 'could be found in'].every((msg) => message.includes(msg))) {
            console.log(`${logSymbols.error} ${chalk.bold('[vue-intellisense] Your aliases config is missing or wrong')}!`);
        }
    };
}

function listFilesNonRecursive(folderPath) {
    return __awaiter(this, void 0, void 0, function* () {
        const dirents = yield readdir(folderPath, { withFileTypes: true });
        const files = yield Promise.all(dirents.flatMap((dirent) => {
            const res = resolve(folderPath, dirent.name);
            return dirent.isDirectory() ? [] : res;
        }));
        const allFiles = Array.prototype.concat(...files);
        return allFiles;
    });
}
function listFilesRecursively(folderPath) {
    return __awaiter(this, void 0, void 0, function* () {
        const dirents = yield readdir(folderPath, { withFileTypes: true });
        const files = yield Promise.all(dirents.map((dirent) => {
            const res = resolve(folderPath, dirent.name);
            return dirent.isDirectory() ? listFilesRecursively(res) : [res];
        }));
        const allFiles = Array.prototype.concat(...files);
        return allFiles;
    });
}
/**
 * @param {string} folderPath "resources/foo/goo"
 * @param {{
 *   regexFilter?: RegExp,
 *   resolvePaths?: boolean,
 *   recursive?: boolean,
 * }} options
 * regexFilter: RegExp - eg. /\.txt/ for only .txt files
 *
 * resolvePaths: boolean - when true it will return the _full_ path from the file system's root. If false (default) it will return the relativePath based on the initial directory path passed
 *
 * recursive: boolean - when true it will return ALL paths recursively. If false (default) it will only return the paths from the folder
 * @return {Promise<string[]>}
 */
function listFiles(folderPath, options) {
    return __awaiter(this, void 0, void 0, function* () {
        const { regexFilter, resolvePaths, recursive } = options || {};
        if (folderPath.endsWith('/'))
            folderPath = folderPath.slice(0, -1);
        const parentDirFullPath = resolve(folderPath).split(folderPath)[0];
        let allFiles = recursive
            ? yield listFilesRecursively(folderPath)
            : yield listFilesNonRecursive(folderPath);
        if (regexFilter === undefined && !resolvePaths)
            return allFiles;
        return allFiles.flatMap((filePath) => {
            if (!resolvePaths)
                filePath = filePath.replace(parentDirFullPath, '');
            if (regexFilter === undefined)
                return filePath;
            return filePath.match(regexFilter) ? filePath : [];
        });
    });
}

function vueDocgenToVetur(vueDocgen, veturFile) {
    const componentName = vueDocgen.displayName;
    if (!isFullString(componentName)) {
        throw new Error('[vue-intellisense] Component is missing a "name" property.');
    }
    const componentNameKebab = kebabCase(componentName);
    const componentNamePascal = pascalCase(componentName);
    if (veturFile === 'attributes') {
        const props = vueDocgen.props || [];
        return props.reduce((carry, vueDocgenProp) => {
            const { name, description, type: _type, values = [], tags: customTags = {} } = vueDocgenProp;
            const attributeName = `${componentNameKebab}/${name}`;
            const attributePascal = `${componentNamePascal}/${name}`;
            const t = (_type === null || _type === void 0 ? void 0 : _type.name) || '';
            const type = t.endsWith('[]') ? 'array' : t.replace('func', 'function');
            // get the "options" from string literals
            const _typeTags = customTags.type || [];
            const typeTags = _typeTags.map((t) => t.type.name);
            const valuesCalculated = values.length
                ? values
                : typeTags.length
                    ? typeTags[0]
                        .split('|')
                        .map((t) => t.trim())
                        .filter((t) => t[0] === `'` && t[t.length - 1] === `'`)
                        .map((t) => t.slice(1, -1))
                    : [];
            const options = valuesCalculated.length ? { options: valuesCalculated } : {};
            return Object.assign(Object.assign({}, carry), { [attributeName]: Object.assign({ type, description }, options), [attributePascal]: Object.assign({ type, description }, options) });
        }, {});
    }
    if (veturFile === 'tags') {
        const props = vueDocgen.props || [];
        const attributes = props.map(({ name }) => name);
        return {
            [componentNameKebab]: { attributes, description: vueDocgen.description || '' },
            [componentNamePascal]: { attributes, description: vueDocgen.description || '' },
        };
    }
    throw new Error('[vue-intellisense] wrong args');
}

let replaceInFiles = require('../lib/replaceInFiles');
function filePathsToVeturJsonData(inputPaths) {
    return __awaiter(this, void 0, void 0, function* () {
        return (yield replaceInFiles({
            files: inputPaths,
            from: /directives*\(('|").+('|")(,|\))/g,
        })).matchs;
    });
}

handleWarningMissingAlias();
function vueFilePathToVeturJsonData(vueFilePath, veturFile, options = {}) {
    return __awaiter(this, void 0, void 0, function* () {
        const { alias } = options;
        const docGenOptions = isPlainObject(alias) ? { alias } : undefined;
        const vueDocgen = yield parse(vueFilePath, docGenOptions);
        if (!isPlainObject(vueDocgen))
            return {};
        const jsonData = vueDocgenToVetur(vueDocgen, veturFile);
        return jsonData;
    });
}
function vueFilePathsToVeturJsonData(inputPaths, veturFile, options) {
    return __awaiter(this, void 0, void 0, function* () {
        const objects = yield Promise.all(inputPaths.map((path) => vueFilePathToVeturJsonData(path, veturFile, options)));
        if (!objects.length)
            throw '[vue-intellisense] missing <input paths>';
        return merge(objects[0], ...objects.slice(1));
    });
}
function writeVeturFiles(outputPath, attributes, tags, globalAttribute) {
    return __awaiter(this, void 0, void 0, function* () {
        const _out = outputPath.endsWith('/') ? outputPath : outputPath + '/';
        fs.mkdirSync(_out, { recursive: true });
        fs.writeFileSync(_out + 'attributes.json', JSON.stringify(attributes, undefined, 2));
        fs.writeFileSync(_out + 'tags.json', JSON.stringify(tags, undefined, 2));
        if (globalAttribute) {
            let data = globalAttribute.map(i => {
                let match = i.match(/('|")\w+('|")/g);
                if (match && match.length != 0) {
                    i = match[0];
                }
                else {
                    i = '';
                }
                return {
                    name: 'v-' + trimChars("\"", trimChars("'", i)),
                    tip: ''
                };
            }).filter(item => item.name !== '');
            fs.writeFileSync(_out + 'globalAttributes.json', JSON.stringify(data, undefined, 2));
        }
    });
}
function generateVeturFiles(inputPath, outputPath, options) {
    return __awaiter(this, void 0, void 0, function* () {
        const { recursive, alias } = options || {};
        const inputIsFile = ['.vue', '.jsx', '.tsx'].some((fileType) => inputPath.endsWith(fileType));
        const globalAttributeIsFile = ['.vue', '.jsx', '.tsx', '.ts', '.js'].some((fileType) => inputPath.endsWith(fileType));
        const allFiles = inputIsFile
            ? [inputPath]
            : yield listFiles(inputPath, {
                regexFilter: /\.vue|\.jsx|\.tsx/,
                recursive,
                resolvePaths: true,
            });
        const globalAttributeFiles = globalAttributeIsFile
            ? [inputPath]
            : yield listFiles(inputPath, {
                regexFilter: /\.vue|\.jsx|\.tsx|\.ts|\.js/,
                recursive,
                resolvePaths: true,
            });
        let parsedAliase = alias;
        if (isFullArray(alias))
            parsedAliase = readAndParseAlias(alias);
        const attributes = yield vueFilePathsToVeturJsonData(allFiles, 'attributes', Object.assign(Object.assign({}, options), { alias: parsedAliase }));
        const tags = yield vueFilePathsToVeturJsonData(allFiles, 'tags', Object.assign(Object.assign({}, options), { alias: parsedAliase }));
        const globalAttributs = yield filePathsToVeturJsonData(globalAttributeFiles);
        yield writeVeturFiles(outputPath, attributes, tags, globalAttributs);
    });
}

export { generateVeturFiles, vueFilePathToVeturJsonData };
