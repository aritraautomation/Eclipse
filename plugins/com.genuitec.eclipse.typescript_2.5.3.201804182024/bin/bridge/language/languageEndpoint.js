"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var jsdoc_1 = require("../jsdoc");
var fs = require("fs");
var path = require("path");
var ts = require("typescript");
var main_1 = require("../main");
var languageServiceHost_1 = require("./languageServiceHost");
var fileInfo_1 = require("./fileInfo");
var services_1 = require("../services");
var quickFixes_1 = require("../quickFixes");
var languageServiceProvider_1 = require("./languageServiceProvider");
var BUILD_STATE = main_1.metadataDir + "/buildState.json";
var LanguageEndpoint = (function () {
    function LanguageEndpoint() {
        this.documentRegistry = ts.createDocumentRegistry(ts.sys.useCaseSensitiveFileNames);
        this.fileInfos = Object.create(null);
        this.projectRoots = Object.create(null);
        this.languageServices = Object.create(null);
        this.languageServiceHosts = Object.create(null);
        this.version = 0;
        this.languageServiceProvider = new languageServiceProvider_1.LanguageServiceProvider(this);
        services_1.registry.registerProvider(this.languageServiceProvider);
    }
    LanguageEndpoint.prototype.cleanProject = function (projectName) {
        var _this = this;
        if (this.isProjectInitialized(projectName)) {
            Object.getOwnPropertyNames(this.fileInfos).forEach(function (fileName) {
                if (_this.getProjectName(fileName) === projectName) {
                    _this.fileInfos[fileName].lazyUpdate();
                }
            });
            if (this.buildState && this.buildState[projectName]) {
                delete this.buildState[projectName];
                this.saveBuildState();
            }
            delete this.languageServices[projectName];
            delete this.languageServiceHosts[projectName];
        }
    };
    LanguageEndpoint.prototype.initializeProject = function (projectName, projectFolder, compilationSettings, sourceRoots, tsConfigs) {
        this.cleanProject(projectName);
        this.projectRoots[projectName] = projectFolder;
        this.languageServices[projectName] = this.createProjectLanguageService(projectName, compilationSettings, sourceRoots, tsConfigs);
    };
    LanguageEndpoint.prototype.getProjectVersion = function () {
        return "" + this.version;
    };
    LanguageEndpoint.prototype.updateConfiguration = function (projectName, compilationSettings, sourceRoots) {
        if (this.languageServiceHosts[projectName] !== undefined) {
            this.languageServiceHosts[projectName].updateConfiguration(compilationSettings, sourceRoots);
        }
    };
    LanguageEndpoint.prototype.isProjectInitialized = function (projectName) {
        return this.languageServices[projectName] !== undefined;
    };
    LanguageEndpoint.prototype.getAllTodoComments = function (projectName) {
        var _this = this;
        var todos = {};
        this.getSourceFiles(projectName)
            .forEach(function (fileName) {
            todos[fileName] = _this.getTodoComments(projectName, fileName);
        });
        return todos;
    };
    LanguageEndpoint.prototype.getAllDiagnostics = function (projectName) {
        var _this = this;
        var diagnostics = Object.create(null);
        this.getSourceFiles(projectName)
            .forEach(function (fileName) {
            diagnostics[fileName] = _this.getDiagnostics(projectName, fileName, true);
        });
        return diagnostics;
    };
    LanguageEndpoint.prototype.getDiagnostics = function (serviceKey, fileName, semantic) {
        var service = this.getLaunguageService(serviceKey, fileName);
        if (!service || !this.isSourceFile(serviceKey, fileName)) {
            return [];
        }
        var diagnostics = service.getSyntacticDiagnostics(fileName);
        var fileInfo = this.fileInfos[fileName];
        if (semantic && diagnostics.length === 0
            && fileInfo
            && (!fileInfo.getIsolatedLaunguageService() || this.isSourceFile(serviceKey, fileName))) {
            diagnostics = service.getSemanticDiagnostics(fileName);
        }
        return diagnostics.map(function (diagnostic) {
            return {
                start: diagnostic.start,
                length: diagnostic.length,
                line: diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start).line,
                text: ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")
            };
        });
    };
    LanguageEndpoint.prototype.getEmitOutput = function (serviceKey, fileName) {
        var languageService = this.getLaunguageService(serviceKey, fileName);
        if (languageService) {
            return languageService.getEmitOutput(fileName).outputFiles;
        }
        return [];
    };
    LanguageEndpoint.prototype.findReferences = function (serviceKey, fileName, position) {
        var languageService = this.getLaunguageService(serviceKey, fileName);
        if (!languageService) {
            return [];
        }
        var references = languageService.getReferencesAtPosition(fileName, position);
        return references.map(function (reference) {
            var sourceFile = languageService.getProgram().getSourceFile(reference.fileName);
            var lineNumber = sourceFile.getLineAndCharacterOfPosition(reference.textSpan.start).line;
            var lineStart = sourceFile.getPositionOfLineAndCharacter(lineNumber, 0);
            var lineEnd = sourceFile.getPositionOfLineAndCharacter(lineNumber + 1, 0);
            var line = sourceFile.text.substring(lineStart, lineEnd);
            return {
                fileName: reference.fileName,
                line: line,
                lineNumber: lineNumber,
                lineStart: lineStart,
                textSpan: reference.textSpan
            };
        });
    };
    LanguageEndpoint.prototype.findRenameLocations = function (serviceKey, fileName, position, findInStrings, findInComments) {
        var languageService = this.getLaunguageService(serviceKey, fileName);
        if (!languageService) {
            return [];
        }
        return languageService.findRenameLocations(fileName, position, findInStrings, findInComments);
    };
    LanguageEndpoint.prototype.computeRefactoringChanges = function (projectName, type, files, parameters) {
        var result = [];
        for (var _i = 0, _a = services_1.registry.getProviders(); _i < _a.length; _i++) {
            var provider = _a[_i];
            try {
                if (provider.prepareRefactoringChanges) {
                    var changes = provider.prepareRefactoringChanges(projectName, type, files, parameters);
                    if (changes) {
                        result.push(changes);
                    }
                }
            }
            catch (e) {
                main_1.main.logError(e);
            }
        }
        return services_1.mergeRefactoringChanges(result);
    };
    LanguageEndpoint.prototype.getBraceMatchingAtPosition = function (serviceKey, fileName, position) {
        var languageService = this.getLaunguageService(serviceKey, fileName);
        if (!languageService) {
            return [];
        }
        return languageService.getBraceMatchingAtPosition(fileName, position);
    };
    LanguageEndpoint.prototype.getNavigateToItems = function (projectName, filter) {
        var languageService = this.languageServices[projectName];
        if (!languageService) {
            return [];
        }
        return languageService.getNavigateToItems(filter);
    };
    LanguageEndpoint.prototype.getCompletionsAtPosition = function (serviceKey, fileName, position, prefix) {
        var languageService = this.getLaunguageService(serviceKey, fileName);
        if (!languageService) {
            return null;
        }
        var completions = languageService.getCompletionsAtPosition(fileName, position);
        var result;
        if (completions) {
            result = {
                entries: completions.entries,
                isMemberCompletion: completions.isMemberCompletion,
                isNewIdentifierLocation: completions.isNewIdentifierLocation,
                tsCompletionsEmpty: false
            };
        }
        else {
            result = {
                entries: [],
                isMemberCompletion: false,
                isNewIdentifierLocation: false,
                tsCompletionsEmpty: true
            };
        }
        if (completions != null) {
            var host = this.languageServiceHosts[serviceKey];
            if (host) {
                host.addCompletions(result, fileName, position, prefix);
            }
        }
        for (var _i = 0, _a = services_1.registry.getProviders(); _i < _a.length; _i++) {
            var provider = _a[_i];
            if (provider.addCompletions) {
                provider.addCompletions(result, serviceKey, fileName, position);
            }
        }
        return result;
    };
    LanguageEndpoint.prototype.getCompletionEntryDetails = function (serviceKey, fileName, position, name, kind) {
        var languageService = this.getLaunguageService(serviceKey, fileName);
        if (!languageService) {
            return null;
        }
        var result = languageService.getCompletionEntryDetails(fileName, position, name);
        if (result) {
            var symbol = languageService.getCompletionEntrySymbol ?
                languageService.getCompletionEntrySymbol(fileName, position, name) : null;
            return jsdoc_1.formatCompletionEntryDetails(result, null, symbol, languageService.getProgram().getTypeChecker());
        }
        for (var _i = 0, _a = services_1.registry.getProviders(); _i < _a.length; _i++) {
            var provider = _a[_i];
            if (provider.getCompletionEntryDetails) {
                result = provider.getCompletionEntryDetails(serviceKey, fileName, position, name, kind);
                if (result) {
                    return result;
                }
            }
        }
    };
    LanguageEndpoint.prototype.getCompletionChanges = function (projectName, fileName, position, replacementLength, name, type) {
        var host = this.languageServiceHosts[projectName];
        if (!host) {
            return [];
        }
        return host.getCompletionChanges(fileName, position, replacementLength, name, type);
    };
    LanguageEndpoint.prototype.getDefinitionAtPosition = function (serviceKey, fileName, position) {
        var languageService = this.getLaunguageService(serviceKey, fileName);
        if (!languageService) {
            return null;
        }
        return languageService.getDefinitionAtPosition(fileName, position);
    };
    LanguageEndpoint.prototype.getDocumentHighlights = function (serviceKey, fileName, position, filesToSearch) {
        var languageService = this.getLaunguageService(serviceKey, fileName);
        if (!languageService) {
            return [];
        }
        try {
            return languageService.getDocumentHighlights(fileName, position, filesToSearch);
        }
        catch (e) {
            return [];
        }
    };
    LanguageEndpoint.prototype.getFormattingEditsForRange = function (serviceKey, fileName, start, end, options) {
        var languageService = this.getLaunguageService(serviceKey, fileName);
        if (!languageService) {
            return [];
        }
        return languageService.getFormattingEditsForRange(fileName, start, end, options);
    };
    LanguageEndpoint.prototype.getIndentationAtPosition = function (serviceKey, fileName, position, options) {
        var languageService = this.getLaunguageService(serviceKey, fileName);
        if (!languageService) {
            return 0;
        }
        return languageService.getIndentationAtPosition(fileName, position, options);
    };
    LanguageEndpoint.prototype.getNameOrDottedNameSpan = function (serviceKey, fileName, startPos, endPos) {
        var languageService = this.getLaunguageService(serviceKey, fileName);
        if (!languageService) {
            return null;
        }
        return languageService.getNameOrDottedNameSpan(fileName, startPos, endPos);
    };
    LanguageEndpoint.prototype.getNavigationBarItems = function (serviceKey, fileName) {
        var languageService = this.getLaunguageService(serviceKey, fileName);
        if (!languageService) {
            return [];
        }
        return languageService.getNavigationBarItems(fileName);
    };
    LanguageEndpoint.prototype.getQuickInfoAtPosition = function (serviceKey, fileName, position) {
        var languageService = this.getLaunguageService(serviceKey, fileName);
        if (!languageService) {
            return null;
        }
        var info = languageService.getQuickInfoAtPosition(fileName, position);
        if (info) {
            if (ts.getTouchingPropertyName) {
                var program = languageService.getProgram();
                var sourceFile = program.getSourceFile(fileName);
                var node = ts.getTouchingPropertyName(sourceFile, position);
                var typeChecker = program.getTypeChecker();
                var symbol = typeChecker.getSymbolAtLocation(node);
                return jsdoc_1.formatQuickInfo(info, node, symbol, typeChecker);
            }
            return jsdoc_1.formatQuickInfo(info);
        }
        else {
            for (var _i = 0, _a = services_1.registry.getProviders(); _i < _a.length; _i++) {
                var provider = _a[_i];
                if (provider.getQuickInfo) {
                    info = provider.getQuickInfo(serviceKey, fileName, position);
                    if (info) {
                        return info;
                    }
                }
            }
        }
        return;
    };
    LanguageEndpoint.prototype.getTodoComments = function (serviceKey, fileName) {
        var languageService = this.getLaunguageService(serviceKey, fileName);
        if (!languageService) {
            return [];
        }
        var descriptors = [
            { text: "TODO", priority: 0 },
            { text: "FIXME", priority: 1 },
            { text: "XXX", priority: 2 }
        ];
        var todos = languageService.getTodoComments(fileName, descriptors);
        if (todos.length > 0) {
            var sourceFile_1 = languageService.getProgram().getSourceFile(fileName);
            return todos.map(function (todo) {
                return {
                    start: todo.position,
                    line: sourceFile_1.getLineAndCharacterOfPosition(todo.position).line,
                    priority: todo.descriptor.priority,
                    text: todo.message
                };
            });
        }
        return [];
    };
    LanguageEndpoint.prototype.editFile = function (fileName, offset, length, text) {
        var info = this.getFileInfo(fileName);
        if (info) {
            info.editContents(offset, length, text);
        }
        this.fileChanged(fileName);
    };
    LanguageEndpoint.prototype.setFileOpen = function (fileName, open) {
        var fileInfo = this.fileInfos[fileName];
        if (fileInfo) {
            fileInfo.setOpen(open);
        }
    };
    LanguageEndpoint.prototype.setLibContent = function (libName, libContent) {
        var libFileInfo = new fileInfo_1.FileInfo(null);
        libFileInfo.updateFile(libContent);
        this.fileInfos[libName] = libFileInfo;
        this.bumpProjectVersion();
    };
    LanguageEndpoint.prototype.updateFileContent = function (fileName, content) {
        var fileInfo = this.getFileInfo(fileName);
        if (!fileInfo) {
            fileInfo = new fileInfo_1.FileInfo(null);
            this.fileInfos[fileName] = fileInfo;
        }
        fileInfo.updateFile(content);
        this.fileChanged(fileName);
    };
    LanguageEndpoint.prototype.fileChanged = function (fileName) {
        if (this.affectsCompilation(fileName)) {
            this.bumpProjectVersion();
            for (var _i = 0, _a = Object.keys(this.languageServiceHosts); _i < _a.length; _i++) {
                var project = _a[_i];
                var host = this.languageServiceHosts[project];
                if (host) {
                    host.filesModified([{ delta: "CHANGED", fileName: fileName }]);
                }
            }
        }
    };
    LanguageEndpoint.prototype.getBuildState = function (projectName) {
        if (!this.buildState) {
            try {
                this.buildState = JSON.parse(fs.readFileSync(BUILD_STATE, "utf8"));
            }
            catch (e) {
                this.buildState = {};
            }
        }
        return this.buildState[projectName] || (this.buildState[projectName] = {});
    };
    LanguageEndpoint.prototype.saveBuildState = function () {
        if (this.buildState) {
            fs.writeFileSync(BUILD_STATE, JSON.stringify(this.buildState), { encoding: "utf8" });
        }
    };
    LanguageEndpoint.prototype.dispose = function () {
        this.saveBuildState();
    };
    LanguageEndpoint.prototype.updateFiles = function (deltas) {
        var _this = this;
        var toRecompile = {};
        var compilationAffected = false;
        deltas.forEach(function (delta) {
            var fileName = delta.fileName;
            var affectsCompilation = _this.affectsCompilation(fileName);
            compilationAffected = compilationAffected || affectsCompilation;
            switch (delta.delta) {
                case "ADDED":
                    if (affectsCompilation) {
                        toRecompile[_this.getProjectName(fileName)] = null;
                    }
                case "CHANGED":
                case "REMOVED":
                    var fileInfo = _this.fileInfos[fileName];
                    if (fileInfo !== undefined) {
                        if (!fileInfo.getOpen() || delta.delta !== "CHANGED") {
                            if (fileName.indexOf("/node_modules/") < 0 && fileName.endsWith("/package.json")) {
                                fileInfo.reload();
                            }
                            else {
                                fileInfo.lazyUpdate();
                            }
                        }
                    }
                    break;
            }
        });
        for (var _i = 0, _a = Object.keys(this.languageServiceHosts); _i < _a.length; _i++) {
            var project = _a[_i];
            var host = this.languageServiceHosts[project];
            if (host) {
                host.filesModified(deltas);
            }
        }
        for (var _b = 0, _c = Object.getOwnPropertyNames(toRecompile); _b < _c.length; _b++) {
            var project = _c[_b];
            this.forceRecompilation(project);
        }
        if (compilationAffected) {
            this.bumpProjectVersion();
        }
    };
    LanguageEndpoint.prototype.affectsCompilation = function (file) {
        return file.endsWith(".ts")
            || file.endsWith(".tsx")
            || file.endsWith(".json")
            || file.endsWith(".js")
            || file.endsWith(".jsx");
    };
    LanguageEndpoint.prototype.bumpProjectVersion = function () {
        this.version++;
    };
    LanguageEndpoint.prototype.forceRecompilation = function (projectName) {
        var program = this.getProgram(projectName);
        if (program) {
            program["getRootFileNames"] = function () { return []; };
        }
    };
    LanguageEndpoint.prototype.getFileInfo = function (fileName) {
        var fileInfo = this.fileInfos[fileName];
        if (!fileInfo) {
            var path_1 = this.resolvePath(fileName);
            try {
                if (path_1 != null && fs.statSync(path_1).isFile()) {
                    fileInfo = new fileInfo_1.FileInfo(path_1);
                    this.fileInfos[fileName] = fileInfo;
                }
            }
            catch (e) {
            }
        }
        else if (fileInfo.needsUpdate()) {
            var path_2 = this.resolvePath(fileName);
            try {
                if (path_2 != null && fs.statSync(path_2).isFile()) {
                    fileInfo.setPath(path_2);
                }
            }
            catch (e) {
            }
        }
        return fileInfo;
    };
    LanguageEndpoint.prototype.getProgram = function (projectName) {
        var languageService = this.languageServices[projectName];
        if (!languageService) {
            return;
        }
        return languageService.getProgram();
    };
    LanguageEndpoint.prototype.directoryExists = function (projectName, directoryName) {
        var path = this.resolvePath(directoryName);
        if (path == null) {
            var root = projectName ? this.projectRoots[projectName] : null;
            if (root) {
                path = root.concat(directoryName);
            }
        }
        if (path != null) {
            try {
                return fs.statSync(path).isDirectory();
            }
            catch (e) {
            }
        }
        return false;
    };
    LanguageEndpoint.prototype.getDirectories = function (projectName, directoryName) {
        var rootPath = this.resolvePath(directoryName);
        if (rootPath == null) {
            var root = projectName ? this.projectRoots[projectName] : null;
            if (root) {
                rootPath = root.concat(directoryName);
            }
        }
        if (rootPath != null) {
            try {
                return fs.readdirSync(rootPath).filter(function (file) {
                    return fs.statSync(path.join(rootPath, file)).isDirectory();
                });
            }
            catch (e) {
            }
        }
        return [];
    };
    LanguageEndpoint.prototype.resolvePath = function (path) {
        var projectName = this.getProjectName(path);
        var root = projectName ? this.projectRoots[projectName] : null;
        if (root) {
            var slash = path.indexOf("/");
            if (slash > 0) {
                return root.concat(path.substring(slash + 1));
            }
            return root;
        }
        return undefined;
    };
    LanguageEndpoint.prototype.getProjectName = function (fileName) {
        if (fileName.indexOf("eclipse:") == 0) {
            var slash = fileName.indexOf("/");
            if (slash > 0) {
                return fileName.substring(8, slash);
            }
            return fileName.substring(8);
        }
        return null;
    };
    LanguageEndpoint.prototype.getSourceFiles = function (projectName) {
        var languageService = this.languageServices[projectName];
        if (!languageService) {
            return [];
        }
        return languageService.getProgram()
            .getSourceFiles()
            .filter(function (sourceFile) { return sourceFile.fileName.indexOf("/node_modules/") < 0; })
            .map(function (sourceFile) { return sourceFile.fileName; });
    };
    LanguageEndpoint.prototype.getAffectedSourceFiles = function (projectName, modifiedFiles, modifiedModules) {
        var languageServiceHost = this.languageServiceHosts[projectName];
        if (!languageServiceHost) {
            return [];
        }
        return languageServiceHost.getAffectedSourceFiles(modifiedFiles, modifiedModules);
    };
    LanguageEndpoint.prototype.getLaunguageService = function (projectName, fileName) {
        if (this.isSourceFile(projectName, fileName)) {
            return this.languageServices[projectName];
        }
        var info = this.getFileInfo(fileName);
        if (!info || !info.getOpen()) {
            return undefined;
        }
        if (!info.getIsolatedLaunguageService()) {
            info.setIsolatedLanguageService(this.createIsolatedLanguageService(fileName));
        }
        return info.getIsolatedLaunguageService();
    };
    LanguageEndpoint.prototype.isSourceFile = function (projectName, fileName) {
        var service = this.languageServices[projectName];
        if (service) {
            return service.getProgram().getSourceFiles().some(function (file) { return file.fileName === fileName; });
        }
        return false;
    };
    LanguageEndpoint.prototype.createProjectLanguageService = function (projectName, compilationSettings, sourceRoots, tsConfigs) {
        var host = new languageServiceHost_1.LanguageServiceHost(projectName, compilationSettings, this, sourceRoots, tsConfigs);
        this.languageServiceHosts[projectName] = host;
        var service = ts.createLanguageService(host, this.documentRegistry);
        host.setService(service);
        return service;
    };
    LanguageEndpoint.prototype.createIsolatedLanguageService = function (fileName) {
        var host = new languageServiceHost_1.LanguageServiceHost(null, {}, this, [fileName], [""]);
        return ts.createLanguageService(host, this.documentRegistry);
    };
    LanguageEndpoint.prototype.getLanguageServiceHost = function (projectName) {
        return this.languageServiceHosts[projectName];
    };
    LanguageEndpoint.prototype.getLanguageService = function (projectName) {
        return this.languageServices[projectName];
    };
    LanguageEndpoint.prototype.getDocumentRegistry = function () {
        return this.documentRegistry;
    };
    LanguageEndpoint.prototype.getProjectTSConfigDir = function (projectName) {
        var host = this.languageServiceHosts[projectName];
        if (host) {
            return host.getTSConfigDir();
        }
    };
    LanguageEndpoint.prototype.performValidation = function (projectName, modifiedFiles, modifiedModules, asYouType) {
        if (modifiedFiles !== null && modifiedFiles !== undefined && !asYouType) {
            modifiedFiles = this.getAffectedSourceFiles(projectName, modifiedFiles, modifiedModules);
        }
        var result = [];
        for (var _i = 0, _a = services_1.registry.getProviders(); _i < _a.length; _i++) {
            var validator = _a[_i];
            try {
                if (validator.validate) {
                    result.push(validator.validate(projectName, modifiedFiles, asYouType));
                }
            }
            catch (e) {
                main_1.main.logError(e);
            }
        }
        return Promise.all(result).then(services_1.mergeValidationResults);
    };
    LanguageEndpoint.prototype.prepareDynamicQuickFixes = function (projectName, quickFix, formattingOptions) {
        var result = [];
        for (var _i = 0, _a = services_1.registry.getProviders(); _i < _a.length; _i++) {
            var validator = _a[_i];
            try {
                if (validator.createDynamicQuickFixes) {
                    result.push(validator.createDynamicQuickFixes(projectName, quickFix, formattingOptions));
                }
            }
            catch (e) {
                main_1.main.logError(e);
            }
        }
        return Promise.all(result).then(function (dynFixes) {
            var res;
            dynFixes.forEach(function (fixes) {
                if (fixes) {
                    (_a = (res || (res = []))).push.apply(_a, fixes);
                }
                var _a;
            });
            return res;
        });
    };
    LanguageEndpoint.prototype.prepareQuickFixes = function (projectName, quickFixes, formattingOptions) {
        var result = [];
        for (var _i = 0, _a = services_1.registry.getProviders(); _i < _a.length; _i++) {
            var validator = _a[_i];
            try {
                if (validator.createQuickFixes) {
                    result.push(validator.createQuickFixes(projectName, quickFixes, formattingOptions));
                }
            }
            catch (e) {
                main_1.main.logError(e);
            }
        }
        return Promise.all(result).then(quickFixes_1.mergeQuickFixResults);
    };
    LanguageEndpoint.prototype.createCompilerHost = function (projectName) {
        var host = this.languageServiceHosts[projectName];
        var service = this.languageServices[projectName];
        if (!host || !service) {
            return null;
        }
        var settings = host.getCompilationSettings();
        var program = service.getProgram();
        function getCanonicalFileName(fileName) {
            return host.useCaseSensitiveFileNames ? fileName : fileName.toLowerCase();
        }
        var cancellationToken = {
            isCancellationRequested: function () {
                return host.getCancellationToken && host.getCancellationToken().isCancellationRequested();
            },
            throwIfCancellationRequested: function () {
                if (cancellationToken.isCancellationRequested()) {
                    throw new ts.OperationCanceledException();
                }
            }
        };
        var currentDirectory = host.getCurrentDirectory();
        var compilerHost = {
            getSourceFile: getOrCreateSourceFile,
            getSourceFileByPath: getOrCreateSourceFileByPath,
            getCancellationToken: function () { return cancellationToken; },
            getCanonicalFileName: getCanonicalFileName,
            useCaseSensitiveFileNames: host.useCaseSensitiveFileNames,
            getNewLine: function () { return host.getNewLine(); },
            getDefaultLibFileName: function (options) { return host.getDefaultLibFileName(options); },
            writeFile: function (fileName, data, writeByteOrderMark) { },
            getCurrentDirectory: function () { return currentDirectory; },
            fileExists: function (fileName) {
                return host.getScriptSnapshot(fileName) !== undefined;
            },
            readFile: function (fileName) {
                var snapshot = host.getScriptSnapshot(fileName);
                return snapshot && snapshot.getText(0, snapshot.getLength());
            },
            directoryExists: function (directoryName) {
                return host.directoryExists(directoryName);
            },
            getDirectories: function (path) {
                return host.getDirectories ? host.getDirectories(path) : [];
            }
        };
        var documentRegistryBucketKey = this.documentRegistry.getKeyForCompilationSettings(settings);
        return compilerHost;
        function getOrCreateSourceFile(fileName) {
            return program.getSourceFile(fileName);
        }
        function getOrCreateSourceFileByPath(fileName, path) {
            return program.getSourceFileByPath(path);
        }
    };
    return LanguageEndpoint;
}());
exports.LanguageEndpoint = LanguageEndpoint;
function getProperty(mapOrObject, key) {
    if (typeof mapOrObject.get === "function") {
        return mapOrObject.get(key);
    }
    return mapOrObject[key];
}
exports.getProperty = getProperty;
function getCanonicalFileName(name) {
    return ts.sys.useCaseSensitiveFileNames ? name : name.toLowerCase();
}
exports.getCanonicalFileName = getCanonicalFileName;
