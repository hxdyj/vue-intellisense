'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var isWhat = require('is-what');
var mergeAnything = require('merge-anything');
var vueDocgenApi = require('vue-docgen-api');
var logSymbols = require('log-symbols');
var chalk = require('chalk');
var pathToProp = require('path-to-prop');
var fs = require('fs');
var path = require('path');
var promises = require('fs/promises');
var caseAnything = require('case-anything');
var fp = require('lodash/fp');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

function _interopNamespace(e) {
    if (e && e.__esModule) return e;
    var n = Object.create(null);
    if (e) {
        Object.keys(e).forEach(function (k) {
            if (k !== 'default') {
                var d = Object.getOwnPropertyDescriptor(e, k);
                Object.defineProperty(n, k, d.get ? d : {
                    enumerable: true,
                    get: function () {
                        return e[k];
                    }
                });
            }
        });
    }
    n['default'] = e;
    return Object.freeze(n);
}

var logSymbols__default = /*#__PURE__*/_interopDefaultLegacy(logSymbols);
var chalk__default = /*#__PURE__*/_interopDefaultLegacy(chalk);
var fs__namespace = /*#__PURE__*/_interopNamespace(fs);
var path__namespace = /*#__PURE__*/_interopNamespace(path);

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
    const aliasAbsolutePath = path__namespace.isAbsolute(configFilePath)
        ? configFilePath
        : path__namespace.resolve(process.cwd(), configFilePath);
    if (!fs__namespace.existsSync(aliasAbsolutePath)) {
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
    return pathToProp.getProp(configFile, nestedPropsByDot) || null;
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
        if (isWhat.isPlainObject(extractedAliasObj))
            parsedAliase = mergeAnything.merge(parsedAliase, extractedAliasObj);
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
            console.log(`${logSymbols__default['default'].error} ${chalk__default['default'].bold('[vue-intellisense] Your aliases config is missing or wrong')}!`);
        }
    };
}

function listFilesNonRecursive(folderPath) {
    return __awaiter(this, void 0, void 0, function* () {
        const dirents = yield promises.readdir(folderPath, { withFileTypes: true });
        const files = yield Promise.all(dirents.flatMap((dirent) => {
            const res = path.resolve(folderPath, dirent.name);
            return dirent.isDirectory() ? [] : res;
        }));
        const allFiles = Array.prototype.concat(...files);
        return allFiles;
    });
}
function listFilesRecursively(folderPath) {
    return __awaiter(this, void 0, void 0, function* () {
        const dirents = yield promises.readdir(folderPath, { withFileTypes: true });
        const files = yield Promise.all(dirents.map((dirent) => {
            const res = path.resolve(folderPath, dirent.name);
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
        const parentDirFullPath = path.resolve(folderPath).split(folderPath)[0];
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
    if (!isWhat.isFullString(componentName)) {
        throw new Error('[vue-intellisense] Component is missing a "name" property.');
    }
    const componentNameKebab = caseAnything.kebabCase(componentName);
    const componentNamePascal = caseAnything.pascalCase(componentName);
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
        const docGenOptions = isWhat.isPlainObject(alias) ? { alias } : undefined;
        const vueDocgen = yield vueDocgenApi.parse(vueFilePath, docGenOptions);
        if (!isWhat.isPlainObject(vueDocgen))
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
        return mergeAnything.merge(objects[0], ...objects.slice(1));
    });
}
function writeVeturFiles(outputPath, attributes, tags, globalAttribute) {
    return __awaiter(this, void 0, void 0, function* () {
        const _out = outputPath.endsWith('/') ? outputPath : outputPath + '/';
        fs__namespace.mkdirSync(_out, { recursive: true });
        fs__namespace.writeFileSync(_out + 'attributes.json', JSON.stringify(attributes, undefined, 2));
        fs__namespace.writeFileSync(_out + 'tags.json', JSON.stringify(tags, undefined, 2));
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
                    name: fp.trimChars("\"", fp.trimChars("'", i)),
                    tip: ''
                };
            }).filter(item => item.name !== '');
            fs__namespace.writeFileSync(_out + 'globalAttribute.json', JSON.stringify(data, undefined, 2));
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
        if (isWhat.isFullArray(alias))
            parsedAliase = readAndParseAlias(alias);
        const attributes = yield vueFilePathsToVeturJsonData(allFiles, 'attributes', Object.assign(Object.assign({}, options), { alias: parsedAliase }));
        const tags = yield vueFilePathsToVeturJsonData(allFiles, 'tags', Object.assign(Object.assign({}, options), { alias: parsedAliase }));
        const globalAttributs = yield filePathsToVeturJsonData(globalAttributeFiles);
        yield writeVeturFiles(outputPath, attributes, tags, globalAttributs);
    });
}

exports.generateVeturFiles = generateVeturFiles;
exports.vueFilePathToVeturJsonData = vueFilePathToVeturJsonData;
