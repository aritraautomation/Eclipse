"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var languageEndpoint_1 = require("./languageEndpoint");
var path = require("path");
var ts = require("typescript");
var ModelDelta = (function () {
    function ModelDelta() {
    }
    return ModelDelta;
}());
exports.ModelDelta = ModelDelta;
var ModelDeltaProvider = (function () {
    function ModelDeltaProvider(sourceFilesProvider) {
        this.sourceFilesProvider = sourceFilesProvider;
    }
    ModelDeltaProvider.prototype.getAffectedSourceFiles = function (prevSourceFiles, changedFiles, changedModules) {
        var importedBy = {};
        var newSourceFiles = [];
        this.sourceFilesProvider()
            .forEach(function (file) {
            var fileName = file.fileName;
            var parentName = path.posix.dirname(fileName);
            newSourceFiles.push(fileName);
            function resolveModuleName(moduleName) {
                if (moduleName.charAt(moduleName.length - 1) === "/") {
                    moduleName = moduleName.concat("index.ts");
                }
                return path.posix.join(parentName, moduleName);
            }
            if (file.imports) {
                file.imports.forEach(function (importNode) {
                    var name = importNode.text;
                    var resolved = languageEndpoint_1.getProperty(file.resolvedModules, name);
                    var module_ = true;
                    if (resolved) {
                        if (resolved.resolvedFileName.indexOf("/node_modules/") < 0) {
                            name = resolved.resolvedFileName;
                            module_ = false;
                        }
                    }
                    else if (!moduleHasNonRelativeName(name)) {
                        name = resolveModuleName(name);
                        module_ = false;
                    }
                    if (module_) {
                        var slash = name.indexOf("/");
                        if (slash >= 0 && name.charAt(0) == "@") {
                            slash = name.indexOf("/", slash + 1);
                        }
                        if (slash >= 0) {
                            name = name.substring(0, slash);
                        }
                    }
                    name = stripExt(name);
                    (importedBy[name] || (importedBy[name] = [])).push(fileName);
                });
            }
            if (file.referencedFiles) {
                file.referencedFiles.forEach(function (ref) {
                    var name = resolveModuleName(ref.fileName);
                    (importedBy[name] || (importedBy[name] = [])).push(fileName);
                });
            }
        });
        var stack;
        var modified = {};
        stack = this.compareDiff(newSourceFiles, prevSourceFiles);
        stack = stack.concat(changedFiles);
        function addToStack(name) {
            if (name.lastIndexOf("/index.ts", name.length - 9) > 0) {
                addToStack(name.slice(0, name.length - 9));
            }
            var list = importedBy[stripExt(name)];
            if (list) {
                for (var i = 0; i < list.length; i++) {
                    stack.push(list[i]);
                }
            }
        }
        changedModules.forEach(addToStack);
        while (stack.length > 0) {
            var name_1 = stack.pop();
            if (!(name_1 in modified)) {
                modified[name_1] = null;
                addToStack(name_1);
            }
        }
        var res = new ModelDelta();
        res.allSourceFiles = newSourceFiles;
        res.affectedSourceFiles = Object.keys(modified);
        return res;
    };
    ModelDeltaProvider.prototype.compareDiff = function (arr1, arr2) {
        arr1 = arr1.sort();
        arr2 = arr2.sort();
        var i1 = 0;
        var i2 = 0;
        var res = [];
        do {
            while (i1 < arr1.length && i2 < arr2.length && arr1[i1] === arr2[i2]) {
                i1++;
                i2++;
            }
            if (i1 >= arr1.length || i2 >= arr2.length) {
                break;
            }
            if (arr1[i1] < arr2[i2]) {
                do {
                    res.push(arr1[i1]);
                    i1++;
                } while (i1 < arr1.length && arr1[i1] < arr2[i2]);
            }
            else {
                do {
                    res.push(arr2[i2]);
                    i2++;
                } while (i2 < arr2.length && arr1[i1] > arr2[i2]);
            }
        } while (true);
        if (i1 < arr1.length) {
            for (; i1 < arr1.length; i1++) {
                res.push(arr1[i1]);
            }
        }
        else if (i2 < arr2.length) {
            for (; i2 < arr2.length; i2++) {
                res.push(arr2[i2]);
            }
        }
        return res;
    };
    return ModelDeltaProvider;
}());
exports.ModelDeltaProvider = ModelDeltaProvider;
function stripExt(name) {
    if (name.endsWith(".ts") || name.endsWith(".js")) {
        return name.substr(0, name.length - 3);
    }
    else if (name.endsWith(".tsx") || name.endsWith(".jsx")) {
        return name.substr(0, name.length - 4);
    }
    return name;
}
function moduleHasNonRelativeName(moduleName) {
    return !(ts.isRootedDiskPath(moduleName) || ts.isExternalModuleNameRelative(moduleName));
}
exports.moduleHasNonRelativeName = moduleHasNonRelativeName;
