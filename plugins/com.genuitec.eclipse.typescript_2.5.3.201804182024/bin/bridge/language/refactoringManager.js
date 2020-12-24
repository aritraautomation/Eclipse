"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var languageEndpoint_1 = require("./languageEndpoint");
var modelDeltaProvider_1 = require("./modelDeltaProvider");
var typescript_1 = require("typescript");
var path = require("path");
var main_1 = require("../main");
var services_1 = require("../services");
var change = require("change-case");
var separator = "/";
var RefactoringChanges = (function () {
    function RefactoringChanges(host, type, files, parameters, description) {
        this.host = host;
        this.type = type;
        this.files = files;
        this.parameters = parameters;
        this.description = description;
        var destination = parameters[services_1.RefactoringParameter.DESTINATION];
        this.changes = {};
        for (var _i = 0, files_1 = files; _i < files_1.length; _i++) {
            var file = files_1[_i];
            this.prepareRefactoringChanges(file, destination);
        }
    }
    RefactoringChanges.prototype.shouldIgnore = function (fileName) {
        return !!this.files.find(function (file) {
            return file === fileName
                || (file.endsWith("/") && fileName.startsWith(file));
        });
    };
    RefactoringChanges.prototype.addChange = function (fileName, textChange) {
        var fileChanges = this.changes[fileName] || (this.changes[fileName] = {});
        (fileChanges[this.description] || (fileChanges[this.description] = []))
            .push(textChange);
    };
    RefactoringChanges.prototype.getChanges = function () {
        return this.changes;
    };
    return RefactoringChanges;
}());
var RefactoringManager = (function () {
    function RefactoringManager(host) {
        this.host = host;
    }
    RefactoringManager.prototype.prepareRefactoringChanges = function (type, files, parameters) {
        var result = [];
        if (parameters[services_1.RefactoringParameter.UPDATE_REFERENCES] === true) {
            result.push(new ImportChanges(this.host, type, files, parameters).getChanges());
        }
        if (parameters[services_1.RefactoringParameter.UPDATE_EXPORTED_SYMBOLS] === true) {
            result.push(new TypeChanges(this.host, type, files, parameters).getChanges());
        }
        return services_1.mergeRefactoringChanges(result);
    };
    return RefactoringManager;
}());
exports.RefactoringManager = RefactoringManager;
var ImportChanges = (function (_super) {
    __extends(ImportChanges, _super);
    function ImportChanges(host, type, files, parameters) {
        return _super.call(this, host, type, files, parameters, "Update file references") || this;
    }
    ImportChanges.prototype.prepareRefactoringChanges = function (source, destination) {
        this.preImportsRefactoringChanges(source, destination);
        this.postImportRefactoringChanges(source, destination);
    };
    ImportChanges.prototype.findImportPath = function (importNode, file, parent) {
        var importPath = importNode.text;
        var resolved = languageEndpoint_1.getProperty(file.resolvedModules, importPath);
        var module_ = true;
        if (resolved) {
            if (resolved.resolvedFileName.indexOf("/node_modules/") < 0) {
                importPath = resolved.resolvedFileName;
                module_ = false;
            }
        }
        else if (!modelDeltaProvider_1.moduleHasNonRelativeName(importPath)) {
            importPath = resolveModuleName(parent, importPath);
            module_ = false;
        }
        return module_ ? null : importPath;
    };
    ImportChanges.prototype.preImportsRefactoringChanges = function (source, destination) {
        var _this = this;
        if (!isMoving(destination))
            return;
        var result = {};
        var isDir = isDirectory(source);
        var sourceFiles = this.host.getProgram().getSourceFiles()
            .filter(function (sourceFile) {
            return sourceFile.fileName.startsWith(source);
        });
        sourceFiles.forEach(function (file) {
            var fileName = file.fileName;
            var fileParent = path.posix.parse(fileName).dir;
            if (file.imports) {
                var parsedPath_1 = path.posix.parse(source);
                file.imports.forEach(function (importNode) {
                    var importPath = _this.findImportPath(importNode, file, fileParent);
                    if (importPath != null
                        && (!isDir || !importPath.includes(source))
                        && !(_this.shouldIgnore(importPath))) {
                        var newText = destination;
                        var text = importNode.text;
                        if (isDir) {
                            var relative = correctPath(stripExt(path.posix.relative(parsedPath_1.dir, fileParent)));
                            if (!newText.endsWith(separator)) {
                                newText.concat(separator);
                            }
                            newText = newText.concat(relative);
                        }
                        newText = stripExt(path.posix.relative(newText, importPath));
                        if (!newText.startsWith(".")) {
                            newText = "." + separator + newText;
                        }
                        if (newText.endsWith("index") && !text.endsWith("index")) {
                            var length_1 = text.endsWith(separator) ? "index".length : "index".length + 1;
                            newText = newText.substr(0, newText.length - length_1);
                        }
                        if (text != newText) {
                            var start = importNode.getStart() + 1;
                            var length_2 = importNode.text.length;
                            _this.addChange(fileName, { span: { start: start, length: length_2 }, newText: newText });
                        }
                    }
                });
            }
        });
    };
    ImportChanges.prototype.postImportRefactoringChanges = function (source, destination) {
        var _this = this;
        var result = {};
        var sourceFiles = this.host.getProgram().getSourceFiles()
            .filter(function (sourceFile) {
            return sourceFile.fileName.indexOf("/node_modules/") < 0;
        });
        sourceFiles.forEach(function (file) {
            if (_this.shouldIgnore(file.fileName)) {
                return;
            }
            var fileParent = path.parse(file.fileName).dir;
            if (file.imports) {
                file.imports.forEach(function (importNode) {
                    var fileName = file.fileName;
                    var importPath = _this.findImportPath(importNode, file, fileParent);
                    if (importPath != null) {
                        var isDir = isDirectory(source);
                        var textWithQuotes = correctPath(importNode.getText(file));
                        var text = importNode.text;
                        var fullStart = importNode.getStart();
                        var newText = destination;
                        var moving = isMoving(destination);
                        var parsedPath = path.parse(source);
                        var relative = correctPath(stripExt(path.relative(parsedPath.dir, importPath)));
                        if (relative.endsWith("index") && !text.endsWith("index")) {
                            var length_3 = text.endsWith(separator) ? "index".length : "index".length + 1;
                            relative = relative.substr(0, relative.length - length_3);
                        }
                        if (importPath.includes(source)) {
                            if (moving) {
                                if (!fileName.includes(source)) {
                                    var normalize = correctPath(path.normalize(text));
                                    if (normalize.endsWith(relative) || source == importPath) {
                                        var parent_1 = path.parse(fileName).dir;
                                        newText = correctPath(path.posix.relative(parent_1, newText));
                                        if (newText == "") {
                                            newText = ".";
                                        }
                                        else if (!newText.startsWith(".")) {
                                            newText = "." + separator + newText;
                                        }
                                        _this.addChange(fileName, { span: { start: fullStart + 1, length: text.lastIndexOf("/" + relative) }, newText: newText });
                                    }
                                }
                            }
                            else {
                                var resource = parsedPath.name;
                                var length_4 = resource.length;
                                var index = -1;
                                if (isDir) {
                                    index = textWithQuotes.indexOf(relative);
                                }
                                else if (source == importPath) {
                                    index = textWithQuotes.lastIndexOf(resource);
                                    if (index == -1) {
                                        index = text.length + 1;
                                        length_4 = 0;
                                        if (!text.endsWith("/")) {
                                            newText = separator + newText;
                                        }
                                    }
                                }
                                if (index >= 0) {
                                    _this.addChange(fileName, { span: { start: fullStart + index, length: length_4 }, newText: newText });
                                }
                            }
                        }
                    }
                });
            }
        });
        return result;
    };
    return ImportChanges;
}(RefactoringChanges));
function detectNamingConventions(program) {
    return DefaultTSConventions.getInstance();
}
var DefaultTSConventions = (function () {
    function DefaultTSConventions() {
    }
    DefaultTSConventions.getInstance = function () {
        if (!this.instance) {
            this.instance = new DefaultTSConventions();
        }
        return this.instance;
    };
    DefaultTSConventions.prototype.fileNameToSymbolName = function (symbolFlag, fileName) {
        var changeCase = getChangeCase(symbolFlag);
        return changeCase ? changeCase(fileName) : undefined;
        function getChangeCase(symbolFlag) {
            switch (symbolFlag) {
                case typescript_1.SymbolFlags.Class:
                case typescript_1.SymbolFlags.Interface:
                case typescript_1.SymbolFlags.TypeAlias:
                    return change.pascalCase;
                case typescript_1.SymbolFlags.BlockScopedVariable:
                case typescript_1.SymbolFlags.FunctionScopedVariable:
                case typescript_1.SymbolFlags.Function:
                    return change.camelCase;
            }
        }
    };
    return DefaultTSConventions;
}());
var TypeChanges = (function (_super) {
    __extends(TypeChanges, _super);
    function TypeChanges(host, type, files, parameters) {
        return _super.call(this, host, type, files, parameters, "Update exported symbol names") || this;
    }
    TypeChanges.prototype.prepareRefactoringChanges = function (source, newText) {
        var _this = this;
        if (isTypeScriptFile(source) && !isMoving(newText) && !isDirectory(source)) {
            var namingConvention_1 = detectNamingConventions(this.host.getProgram());
            var _loop_1 = function (sym) {
                sym.declarations.forEach(function (declaration) {
                    if (!declaration.name) {
                        return;
                    }
                    var pos = declaration.name.pos + 1;
                    var name = sym.name;
                    var oldtext = path.parse(source).name;
                    var oldValue = namingConvention_1.fileNameToSymbolName(sym.flags, oldtext);
                    var index = name.indexOf(oldValue);
                    if (index >= 0) {
                        var newValue = namingConvention_1.fileNameToSymbolName(sym.flags, newText);
                        if (newValue) {
                            newValue = name.replace(oldValue, newValue);
                            _this.prepareRenameChanges(source, pos, newValue);
                        }
                    }
                });
            };
            for (var _i = 0, _a = this.getExportsOfFile(source); _i < _a.length; _i++) {
                var sym = _a[_i];
                _loop_1(sym);
            }
        }
    };
    TypeChanges.prototype.getExportsOfFile = function (source) {
        var exports = [];
        try {
            var sourceFile = this.host.getProgram().getSourceFile(source);
            if (sourceFile) {
                var module_1 = sourceFile.symbol;
                if (module_1) {
                    exports = this.host.getProgram().getTypeChecker().getExportsOfModule(module_1);
                }
            }
        }
        catch (e) {
            e.stack = "Problem while getting the exports of the file: " + source + "\n" + e.stack;
            main_1.main.logError(e);
        }
        return exports;
    };
    TypeChanges.prototype.prepareRenameChanges = function (source, pos, newText) {
        var _this = this;
        var locations = this.host.getService().findRenameLocations(source, pos, false, false);
        if (locations) {
            locations.forEach(function (location) {
                if (location) {
                    _this.addChange(location.fileName, { span: location.textSpan, newText: newText });
                }
            });
        }
    };
    return TypeChanges;
}(RefactoringChanges));
function resolveModuleName(parentName, moduleName) {
    if (moduleName.charAt(moduleName.length - 1) === separator) {
        moduleName = moduleName.concat("index.ts");
    }
    return path.posix.join(parentName, moduleName);
}
function stripExt(name) {
    if (name.endsWith(".ts") || name.endsWith(".js")) {
        return name.substr(0, name.length - 3);
    }
    else if (name.endsWith(".tsx") || name.endsWith(".jsx")) {
        return name.substr(0, name.length - 4);
    }
    return name;
}
function isTypeScriptFile(fileName) {
    return fileName.endsWith(".ts") || fileName.endsWith(".tsx");
}
function correctPath(text) { return text.replace(/\\/g, separator); }
function isDirectory(text) { return text.endsWith(separator); }
function isMoving(text) { return text.startsWith("eclipse:"); }
