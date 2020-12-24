"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var ts = require("typescript");
var path1 = require("path");
var modelDeltaProvider_1 = require("./modelDeltaProvider");
var importsManager_1 = require("./importsManager");
var main_1 = require("../main");
var quickFixes_1 = require("../quickFixes");
var refactoringManager_1 = require("./refactoringManager");
var completionsManager_1 = require("./completionsManager");
var fixes_1 = require("./quickfix/fixes");
exports.LIB_FILE_NAME = "lib.d.ts";
var EOL = require("os").EOL;
var path = path1.posix;
var LanguageServiceHost = (function () {
    function LanguageServiceHost(projectName, compilationSettings, endpoint, sourceRoots, tsConfigFiles) {
        this.projectName = projectName;
        this.compilationSettings = compilationSettings;
        this.endpoint = endpoint;
        this.sourceRoots = sourceRoots;
        this.tsConfigFiles = tsConfigFiles;
        this.tsConfigDir = path.dirname(this.tsConfigFiles[0]);
        if (main_1.main.getBridgeType() === "editor") {
            this.importsManager = new importsManager_1.ImportsManager(this);
            this.completionsManager = new completionsManager_1.CompletionsManager(this);
            this.refactoringManager = new refactoringManager_1.RefactoringManager(this);
        }
        this.setupSettings();
    }
    LanguageServiceHost.prototype.getTSConfigDir = function () {
        return path.join("eclipse:" + this.projectName, this.tsConfigDir);
    };
    LanguageServiceHost.prototype.getTSConfigFile = function () {
        return path.join("eclipse:" + this.projectName, this.tsConfigFiles[0]);
    };
    LanguageServiceHost.prototype.getTSConfigFiles = function () {
        var _this = this;
        return this.tsConfigFiles.map(function (f) { return path.join("eclipse:" + _this.projectName, f); });
    };
    LanguageServiceHost.prototype.getProjectVersion = function () {
        return this.endpoint.getProjectVersion();
    };
    LanguageServiceHost.prototype.setService = function (service) {
        this.service = service;
    };
    LanguageServiceHost.prototype.getService = function () {
        return this.service;
    };
    LanguageServiceHost.prototype.getCompilationSettings = function () {
        return this.compilationSettings;
    };
    LanguageServiceHost.prototype.getCurrentDirectory = function () {
        return "";
    };
    LanguageServiceHost.prototype.getDefaultLibFileName = function (options) {
        return ts.getDefaultLibFileName(options);
    };
    LanguageServiceHost.prototype.getNewLine = function () {
        return EOL;
    };
    LanguageServiceHost.prototype.getScriptFileNames = function () {
        var scriptFileNames = this.sourceRoots;
        var defaultLib = this.endpoint.getFileInfo(ts.getDefaultLibFileName(this.compilationSettings));
        if (!this.compilationSettings.noLib) {
            if (defaultLib) {
                scriptFileNames = scriptFileNames.concat([ts.getDefaultLibFileName(this.compilationSettings)]);
            }
            else {
                scriptFileNames = scriptFileNames.concat([exports.LIB_FILE_NAME]);
            }
        }
        var libs = this.compilationSettings.lib;
        if (libs !== undefined && libs.length > 0) {
            for (var _i = 0, libs_1 = libs; _i < libs_1.length; _i++) {
                var lib = libs_1[_i];
                var libName = this.getLibFileName(lib);
                var libFileInfo = this.endpoint.getFileInfo(libName);
                if (libFileInfo !== undefined) {
                    scriptFileNames = scriptFileNames.concat([libName]);
                }
            }
        }
        if (this.importsManager) {
            scriptFileNames = this.importsManager.addLookupScripts(scriptFileNames);
        }
        return scriptFileNames;
    };
    LanguageServiceHost.prototype.updateConfiguration = function (options, sourceRoots) {
        this.compilationSettings = options;
        this.sourceRoots = sourceRoots;
        this.setupSettings();
    };
    LanguageServiceHost.prototype.filesModified = function (deltas) {
        if (this.importsManager) {
            var modifiedModules = [];
            var modifiedFiles = [];
            for (var _i = 0, deltas_1 = deltas; _i < deltas_1.length; _i++) {
                var delta = deltas_1[_i];
                var name_1 = delta.fileName;
                if (name_1.startsWith("eclipse:" + this.projectName + "/")) {
                    var ind = name_1.indexOf("/node_modules/");
                    if (ind > 0 && name_1.indexOf("/node_modules/@types/") < 0) {
                        var moduleName = name_1.substring(ind + "/node_modules/".length);
                        ind = moduleName.indexOf("/");
                        if (ind > 0 && moduleName.startsWith("@")) {
                            ind = moduleName.indexOf("/", ind + 1);
                        }
                        if (ind > 0) {
                            moduleName = moduleName.substring(0, ind);
                        }
                        modifiedModules.push(moduleName);
                    }
                    else if (name_1.endsWith(".ts") || name_1.endsWith(".tsx")) {
                        modifiedFiles.push(name_1);
                    }
                }
            }
            this.importsManager.markModified(modifiedFiles, modifiedModules);
        }
    };
    LanguageServiceHost.prototype.getScriptSnapshot = function (fileName) {
        var fileInfo = this.endpoint.getFileInfo(fileName);
        if (fileInfo) {
            return fileInfo.getSnapshot();
        }
        return undefined;
    };
    LanguageServiceHost.prototype.getScriptVersion = function (fileName) {
        var fileInfo = this.endpoint.getFileInfo(fileName);
        return fileInfo ? fileInfo.getVersion() : undefined;
    };
    LanguageServiceHost.prototype.directoryExists = function (directoryName) {
        return this.endpoint.directoryExists(this.projectName, directoryName);
    };
    LanguageServiceHost.prototype.readDirectory = function (path, extensions, excludes, includes) {
        var sep = path.indexOf("/");
        var projectName;
        var pathWithinProject;
        if (sep > 0) {
            projectName = path.substr(0, sep);
            pathWithinProject = path.substr(sep + 1);
        }
        else {
            projectName = path;
            pathWithinProject = "";
        }
        var sysPath = this.endpoint.resolvePath(projectName);
        process.chdir(sysPath);
        var res = ts.sys.readDirectory(pathWithinProject, extensions, excludes, includes);
        return res;
    };
    LanguageServiceHost.prototype.readFile = function (path, encoding) {
        var sysPath = this.endpoint.resolvePath(path);
        return ts.sys.readFile(sysPath, encoding);
    };
    LanguageServiceHost.prototype.fileExists = function (path) {
        var sysPath = this.endpoint.resolvePath(path);
        return ts.sys.fileExists(sysPath);
    };
    LanguageServiceHost.prototype.getDirectories = function (directoryName) {
        return this.endpoint.getDirectories(this.projectName, directoryName);
    };
    LanguageServiceHost.prototype.getProgram = function () {
        return this.service.getProgram();
    };
    LanguageServiceHost.prototype.getBuildState = function () {
        if (!this.buildState) {
            this.buildState = this.endpoint.getBuildState(this.projectName);
        }
        return this.buildState;
    };
    Object.defineProperty(LanguageServiceHost.prototype, "sourceFiles", {
        get: function () {
            var state = this.getBuildState();
            return state.sourceFiles || (state.sourceFiles = []);
        },
        set: function (files) {
            var state = this.getBuildState();
            state.sourceFiles = files;
        },
        enumerable: true,
        configurable: true
    });
    LanguageServiceHost.prototype.getAffectedSourceFiles = function (modifiedFiles, modifiedModules) {
        if (!this.modelDeltaProvider) {
            var this_1 = this;
            var sourceFileProvider = function () { return this_1.service.getProgram().getSourceFiles()
                .filter(function (sourceFile) { return sourceFile.fileName.indexOf("/node_modules/") < 0; }); };
            this.modelDeltaProvider = new modelDeltaProvider_1.ModelDeltaProvider(sourceFileProvider);
        }
        var delta = this.modelDeltaProvider.getAffectedSourceFiles(this.sourceFiles, modifiedFiles, modifiedModules);
        this.sourceFiles = delta.allSourceFiles;
        if (this.importsManager) {
            this.importsManager.markModified(delta.affectedSourceFiles, modifiedModules);
        }
        return delta.affectedSourceFiles;
    };
    LanguageServiceHost.prototype.useCaseSensitiveFileNames = function () {
        return ts.sys.useCaseSensitiveFileNames;
    };
    LanguageServiceHost.prototype.getRealFileName = function (fileName) {
        return this.endpoint.resolvePath(fileName);
    };
    LanguageServiceHost.prototype.getQuickFixes = function (file, diag) {
        switch (diag.code) {
            case 2304:
                var message = ts.flattenDiagnosticMessageText(diag.messageText, "\n");
                var missingName = /Cannot find name \'(.*?)\'/.exec(message);
                if (missingName && missingName[1]) {
                    return [new quickFixes_1.QuickFix(undefined, undefined, undefined, "dynamic:ts:add-import:" + missingName[1], quickFixes_1.QuickFix.REL_HIGHEST)];
                }
                break;
            default:
                return fixes_1.tsQuickFixProvider.getQuickFixes(file, diag);
        }
    };
    LanguageServiceHost.prototype.createDynamicQuickFixes = function (request, formattingOptions) {
        if (request.type.startsWith("dynamic:ts:add-import:")) {
            var data = /dynamic:ts:add-import:(.*)/.exec(request.type);
            if (data && data[1]) {
                return Promise.resolve(this.importsManager.createDynamicQuickFixes(request.fileName, request.start, request.end, data[1]));
            }
        }
        return Promise.resolve(fixes_1.tsQuickFixProvider.createDynamicQuickFixes(this.service, request, formattingOptions));
    };
    LanguageServiceHost.prototype.createQuickFixes = function (quickFixRequests, formattingOptions) {
        var result = [];
        var program = this.getProgram();
        for (var _i = 0, quickFixRequests_1 = quickFixRequests; _i < quickFixRequests_1.length; _i++) {
            var request = quickFixRequests_1[_i];
            var res = fixes_1.tsQuickFixProvider.createQuickFix(this.service, request, formattingOptions);
            if (res) {
                result.push(res);
            }
        }
        return quickFixes_1.mergeQuickFixResults(result);
    };
    LanguageServiceHost.prototype.addCompletions = function (completions, fileName, offset, prefix) {
        var program = this.getProgram();
        var file = program.getSourceFile(fileName);
        if (file) {
            this.importsManager.addCompletions(completions, program, file, offset);
            this.completionsManager.processCompletions(completions, program, file, offset);
        }
    };
    LanguageServiceHost.prototype.getCompletionChanges = function (fileName, position, replacementLength, name, type) {
        var result = this.importsManager.getCompletionChanges(fileName, position, replacementLength, name, type);
        if (result) {
            return result;
        }
        return [];
    };
    LanguageServiceHost.prototype.prepareRefactoringChanges = function (type, files, parameters) {
        var result = this.refactoringManager.prepareRefactoringChanges(type, files, parameters);
        if (result) {
            return result;
        }
    };
    LanguageServiceHost.prototype.getLibFileName = function (libName) {
        return "lib." + (libName == "es6" ? "es2015" : libName) + ".d.ts";
    };
    LanguageServiceHost.prototype.setupSettings = function () {
        if ((this.compilationSettings.baseUrl
            && !modelDeltaProvider_1.moduleHasNonRelativeName(this.compilationSettings.baseUrl))
            || this.compilationSettings.baseUrl === "") {
            this.compilationSettings.baseUrl = path.join("eclipse:" + this.projectName, this.tsConfigDir, this.compilationSettings.baseUrl);
        }
        if (this.compilationSettings.types && !this.compilationSettings.typeRoots) {
            var typeRootDir = "node_modules/@types";
            if (this.directoryExists(typeRootDir)) {
                var typeRoots = path.join("eclipse:" + this.projectName, typeRootDir);
                this.compilationSettings.typeRoots = [typeRoots];
            }
        }
        this.compilationSettings.configFilePath = path.join("eclipse:" + this.projectName, this.tsConfigFiles[0]);
    };
    return LanguageServiceHost;
}());
exports.LanguageServiceHost = LanguageServiceHost;
