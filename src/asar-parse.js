import path from 'path'
import asar from 'asar'
import disk from 'asar/lib/disk'
import Module from 'module'

let arch = null
let original = {}
let packageMainCache = {}

const tools = {
    norm(str) {
        return str.replace(/\\/g, "/")
    },
    join(a, b) {
        return tools.norm(path.join(a, b))
    }
}

function getFileFromArchive(request, options) {
    const relFile = path.relative(arch.src, request)
    let f
    try {
        const node = arch.searchNodeFromDirectory(relFile)
        if (node && node.size) {
            let encoding
            if (options && typeof options === 'string') {
                encoding = options
            }

            f = asar.extractFile(arch.src, relFile)
            if (encoding) {
                f = f.toString(encoding)
            }
        }
    } catch (err) { }
    return f
}


function readPackage(entry) {
    if (Object.prototype.hasOwnProperty.call(packageMainCache, entry)) {
        return packageMainCache[entry]
    }

    const jsonPath = tools.join(entry, 'package.json')
    let json
    try {
        json = asar.extractFile(arch.src, jsonPath)
    } catch (e) {
        return false
    }

    if (json === undefined) {
        return false
    }

    let pkg
    try {
        packageMainCache[jsonPath] = JSON.parse(json).main
        pkg = packageMainCache[jsonPath]
    } catch (err) {
        err.path = jsonPath
        err.message = `Error parsing ${jsonPath}: ${err.message}`
        throw err
    }
    return pkg
}


function parseAsarPath(path) {
    var idx = path.indexOf(".asar")
    if (idx == -1) {
        return path
    }
    return tools.norm(path.substr(idx + 6))
}


function tryFile(entry) {
    try {
        let node = arch.searchNodeFromDirectory(entry)
        if (node && node.size) {
            return entry
        }
    } catch (error) { /* 异常 也返回 false */ }
    return false
}

function tryExtensions(entry, exts) {
    for (var i = 0; i < exts.length; i++) {
        var filename = tryFile(entry + exts[i])
        if (filename) {
            return filename
        }
    }
    return false
}


function tryPackage(entry, exts) {
    var pkg = readPackage(entry)
    if (!pkg) return false

    var filename = tools.join(entry, pkg)
    return tryFile(filename) || tryExtensions(filename, exts) ||  tryExtensions(tools.join(filename, 'index'), exts)
}

function maybeCallback(cb) {
    return typeof cb === 'function' ? cb : () => { };
}

const hooks = {
    fs: {
        readFileSync: (request, options) => {
            var idx = request.indexOf(".asar")
            if (idx == -1) {
                return original.fs.readFileSync(request, options)
            }
            const f = getFileFromArchive(request, options)
            if (f) {
                return f
            }
        },
        realpathSync: function (request, options) {
            var idx = request.indexOf(".asar");
            if (idx == -1) {
                return original.fs.realpathSync(request, options);
            }
            var f = getFileFromArchive(request, options);
            if (f) {
                return f;
            }
        },
        readFile: (request, options, callback_) => {
            const callback = (err, data) => {
                const cb = maybeCallback(callback_)
                if (!err) {
                    return cb(err, data)
                }
                // errno: -2（ ENOENT） 的时候 ，也许文件不存在fs系统中，尝试从asar加载
                if (err && err.errno === -2 && err.syscall === 'open') {
                    const f = getFileFromArchive(request, options)
                    if (f) {
                        return cb(null, f)
                    }
                }
                return cb(err, data)
            }

            return original.fs.readFile(request, options, callback)
        },
    },
    module: {
        _findPath: (request, paths) => {
            let ret = original.module._findPath(request, paths)
            if (ret) {
                return ret
            }

            const exts = Object.keys(Module._extensions)
            if (request.charAt(0) === '/') {
                paths = ['']
            }

            const trailingSlash = (request.slice(-1) === '/')

            const cacheKey = JSON.stringify({
                request: request,
                paths: paths
            })

            if (Module._pathCache[cacheKey]) {
                return Module._pathCache[cacheKey]
            }

            const basePath = path.resolve(arch.src, '..')

            ret = paths.reduce((acc, p) => {
                let filename
                if (acc) return acc // || (paths.length > 1 && p.indexOf(".asar") === -1)

                const rel = path.relative(basePath, p)
                if (/^\./.test(rel)) return acc

                var entry = parseAsarPath(path.join(rel, request))
                if (!entry) return false

                if (!trailingSlash) {
                    filename = tryFile(entry)

                    if (!filename)
                        filename = tryExtensions(entry, exts)
                }

                if (!filename)
                    filename = tryPackage(entry, exts)

                if (!filename) {
                    filename = tryExtensions(tools.join(entry, 'index'), exts)
                }

                return filename
            }, ret)

            if (ret) {
                ret = path.join(arch.src, ret)
                Module._pathCache[cacheKey] = ret
            }

            return ret
        }
    }
}

class AsarParse {
    constructor(archive) {
        arch = disk.readFilesystemSync(archive)
        this.archive = arch.src
    }

    patch() {
        const modules = Object.keys(hooks)
        modules.forEach((moduleName) => {
            const module = require(moduleName)

            const methods = Object.keys(hooks[moduleName])
            original[moduleName] = {}
            methods.forEach((methodName) => {
                original[moduleName][methodName] = module[methodName]
                module[methodName] = hooks[moduleName][methodName].bind(module)
            })
        })
        return this
    }

    unpatch() {
        const modules = Object.keys(hooks)
        modules.forEach((moduleName) => {
            const module = require(moduleName)

            const methods = Object.keys(hooks[moduleName])
            methods.forEach((methodName) => {
                module[methodName] = original[moduleName][methodName]
                delete original[moduleName][methodName]
            })
            delete original[moduleName]
        })
        return this
    }
}

module.exports = AsarParse