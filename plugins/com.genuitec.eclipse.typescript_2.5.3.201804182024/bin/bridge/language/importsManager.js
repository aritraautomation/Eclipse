"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var ts = require("typescript");
var path = require("path");
var main_1 = require("../main");
var modelDeltaProvider_1 = require("./modelDeltaProvider");
var tsShim_1 = require("./tsShim");
var quickFixes_1 = require("../quickFixes");
var completionsManager_1 = require("./completionsManager");
var ImportsManager = (function () {
    function ImportsManager(host) {
        this.host = host;
        this.lookupModuleScriptsProvider = new LookupModuleScriptsProvider(host);
        this.importsIndex = new ImportsIndex(host, this.lookupModuleScriptsProvider);
    }
    ImportsManager.prototype.addLookupScripts = function (scriptFiles) {
        return scriptFiles.concat(this.lookupModuleScriptsProvider.getLookupScripts());
    };
    ImportsManager.prototype.markModified = function (modifiedFiles, modifiedModules) {
        this.lookupModuleScriptsProvider.modulesModified(modifiedModules);
        this.importsIndex.markModified(modifiedFiles, modifiedModules);
    };
    ImportsManager.prototype.createDynamicQuickFixes = function (fileName, start, end, missingName) {
        this.importsIndex.updateIndex();
        var program = this.host.getProgram();
        var file = program.getSourceFile(fileName);
        if (file) {
            var token = ts.getTokenAtPosition(file, start);
            var meaning = tsShim_1.getMeaningFromLocation(token);
            var imports = this.importsIndex.getImports(fileName, meaning, missingName);
            return createQuickFixes(fileName, program, start, end, missingName, imports);
        }
        return undefined;
    };
    ImportsManager.prototype.addCompletions = function (completions, program, file, offset) {
        if (completions.isMemberCompletion) {
            return;
        }
        this.importsIndex.updateIndex();
        var fileName = file.fileName;
        var token = ts.getTokenAtPosition(file, offset);
        if (token.kind === ts.SyntaxKind.StringLiteral) {
            return;
        }
        var meaning = tsShim_1.getMeaningFromLocation(token);
        var imports = this.importsIndex.getImports(fileName, meaning);
        var existingNames = new Set();
        for (var _i = 0, _a = completions.entries; _i < _a.length; _i++) {
            var completion = _a[_i];
            existingNames.add(completion.name);
        }
        var list = completions.entries;
        var options = program.getCompilerOptions();
        var count = 0;
        for (var _b = 0, imports_1 = imports; _b < imports_1.length; _b++) {
            var imp = imports_1[_b];
            if (!existingNames.has(imp.name)) {
                count++;
                var item = {
                    name: imp.name,
                    kind: ts.ScriptElementKind.alias,
                    kindModifiers: "",
                    sortText: undefined,
                    relevance: completionsManager_1.CompletionRelevance.GLOBAL_SYMBOLS + 5,
                    moduleName: calculateImportName(options, fileName, imp),
                    type: "ts:add-with-import:" + (imp.moduleName || "") + ":" + imp.fileName
                };
                list.push(item);
            }
        }
    };
    ImportsManager.prototype.getCompletionChanges = function (fileName, position, replacementLength, name, type) {
        if (type.startsWith("ts:add-with-import:")) {
            this.importsIndex.updateIndex();
            type = type.substring("ts:add-with-import:".length);
            var ind = type.indexOf(":");
            var moduleName = type.substring(0, ind);
            var moduleFileName = type.substring(ind + 1);
            var info = this.importsIndex.findImport(name, moduleFileName, moduleName);
            var program = this.host.getProgram();
            var file = program.getSourceFile(fileName);
            if (info && file) {
                var quickFixes = [];
                createQuickFixesForImport(file, program, file.text.substr(position, replacementLength), position, position + replacementLength, info, quickFixes);
                if (quickFixes.length > 0) {
                    quickFixes.sort(function (a, b) { return a.rel - b.rel; });
                    return quickFixes[0].changes;
                }
            }
        }
        return undefined;
    };
    return ImportsManager;
}());
exports.ImportsManager = ImportsManager;
var ImportsIndex = (function () {
    function ImportsIndex(host, lookupModuleScriptsProvider) {
        this.host = host;
        this.lookupModuleScriptsProvider = lookupModuleScriptsProvider;
        this.modifiedFiles = [];
        this.modifiedModules = [];
        this.importNameToInfo = {};
        this.fileToImportNames = {};
    }
    ImportsIndex.prototype.markModified = function (modifiedFiles, modifiedModules) {
        (_a = this.modifiedFiles).push.apply(_a, modifiedFiles);
        (_b = this.modifiedModules).push.apply(_b, modifiedModules);
        var _a, _b;
    };
    ImportsIndex.prototype.updateIndex = function () {
        var _this = this;
        this.program = this.host.getProgram();
        if (this.modelDeltaProvider === undefined) {
            this.initializeIndex();
        }
        else {
            this.modifiedModules.forEach(function (m) {
                (_a = _this.modifiedFiles).push.apply(_a, _this.lookupModuleScriptsProvider.getModuleScriptFiles(m));
                var _a;
            });
            var modifiedFiles = this.modelDeltaProvider.getAffectedSourceFiles(this.prevSourceFiles, this.modifiedFiles, this.modifiedModules);
            this.modifiedFiles = [];
            this.modifiedModules = [];
            this.prevSourceFiles = modifiedFiles.allSourceFiles;
            modifiedFiles.affectedSourceFiles.forEach(function (name) {
                _this.deindexFile(name);
                var sourceFile = _this.program.getSourceFile(name);
                if (sourceFile) {
                    _this.indexFile(sourceFile);
                }
            });
        }
    };
    ImportsIndex.prototype.initializeIndex = function () {
        var _this = this;
        var this_ = this;
        var sourceFileProvider = function () { return _this.lookupModuleScriptsProvider.getIndexingRoots(_this.program); };
        this.modelDeltaProvider = new modelDeltaProvider_1.ModelDeltaProvider(sourceFileProvider);
        var files = sourceFileProvider();
        this.prevSourceFiles = files.map(function (f) { return f.fileName; });
        files.forEach(function (f) { return _this.indexFile(f); });
    };
    ImportsIndex.prototype.deindexFile = function (fileName) {
        var imports = this.fileToImportNames[fileName];
        if (imports) {
            for (var _i = 0, imports_2 = imports; _i < imports_2.length; _i++) {
                var imp = imports_2[_i];
                var infos = this.importNameToInfo[imp];
                if (infos) {
                    for (var i = infos.length - 1; i >= 0; i--) {
                        if (infos[i].fileName === fileName) {
                            infos.splice(i, 1);
                        }
                    }
                }
            }
        }
    };
    ImportsIndex.prototype.indexFile = function (sourceFile) {
        try {
            if (sourceFile.symbol) {
                this.indexModuleFile(sourceFile);
            }
            else {
                this.indexNonModuleFile(sourceFile);
            }
        }
        catch (e) {
            e.stack = "Failed to index imports in file: " + sourceFile.fileName + "\n" + e.stack;
            main_1.main.logError(e);
        }
    };
    ImportsIndex.prototype.indexModuleFile = function (sourceFile) {
        var fileName = sourceFile.fileName;
        this.indexModule(sourceFile.fileName, this.lookupModuleScriptsProvider.getModuleName(fileName), sourceFile.symbol, this.fileToImportNames[fileName] = []);
    };
    ImportsIndex.prototype.indexNonModuleFile = function (sourceFile) {
        var fileName = sourceFile.fileName;
        var fileToImportNames = this.fileToImportNames[fileName] = [];
        for (var _i = 0, _a = sourceFile.statements; _i < _a.length; _i++) {
            var statement = _a[_i];
            if (ts.isAmbientModule(statement) && statement.symbol) {
                var moduleName = statement.name.text;
                this.indexModule(fileName, statement.name.text, statement.symbol, fileToImportNames);
            }
        }
    };
    ImportsIndex.prototype.indexModule = function (fileName, moduleName, module, fileToImportNames) {
        var exports;
        try {
            exports = this.program.getTypeChecker().getExportsOfModule(module);
        }
        catch (e) {
            return;
        }
        var typesNameInd;
        if (moduleName === undefined && (typesNameInd = fileName.indexOf("/node_modules/@types/")) > 0) {
            moduleName = fileName.substr(typesNameInd + "/node_modules/@types/".length);
            if (moduleName.endsWith("index.d.ts")) {
                moduleName = moduleName.substr(0, moduleName.length - "index.d.ts".length);
            }
            if (moduleName.endsWith("/")) {
                moduleName = moduleName.substr(0, moduleName.length - 1);
            }
            if (moduleName.endsWith(".d.ts")) {
                moduleName = moduleName.substr(0, moduleName.length - ".d.ts".length);
            }
        }
        var fileImportNames = this.fileToImportNames[fileName] = [];
        var _loop_1 = function (symbol) {
            var name_1 = symbol.name;
            var info = {
                name: name_1,
                moduleName: moduleName,
                module: { name: module.name },
                fileName: fileName,
                meanings: []
            };
            (this_1.importNameToInfo[name_1] || (this_1.importNameToInfo[name_1] = []))
                .push(info);
            fileImportNames.push(name_1);
            var declarations = symbol.getDeclarations();
            if (declarations) {
                declarations.forEach(function (d) {
                    return info.meanings.push(tsShim_1.getMeaningFromDeclaration(symbol));
                });
            }
        };
        var this_1 = this;
        for (var _i = 0, exports_1 = exports; _i < exports_1.length; _i++) {
            var symbol = exports_1[_i];
            _loop_1(symbol);
        }
    };
    ImportsIndex.prototype.findImport = function (name, fileName, moduleName) {
        var infos = this.importNameToInfo[name];
        for (var _i = 0, infos_1 = infos; _i < infos_1.length; _i++) {
            var info = infos_1[_i];
            if (info.fileName === fileName
                && (!moduleName || moduleName === info.moduleName)) {
                return info;
            }
        }
        return undefined;
    };
    ImportsIndex.prototype.getImports = function (fileName, meaning, name) {
        var infos = name && this.importNameToInfo[name];
        var result = [];
        if (infos) {
            processInfos(infos);
        }
        else if (name) {
            var regex = createNameMatchPattern(name, true);
            for (var _i = 0, _a = Object.keys(this.importNameToInfo); _i < _a.length; _i++) {
                var possibleName = _a[_i];
                if (regex.test(possibleName)) {
                    processInfos(this.importNameToInfo[possibleName]);
                }
            }
            result.sort(function (a, b) { return b.name.length - a.name.length; });
            if (result.length > 5) {
                result.splice(5, result.length - 5);
            }
        }
        else {
            for (var _b = 0, _c = Object.keys(this.importNameToInfo); _b < _c.length; _b++) {
                var possibleName = _c[_b];
                processInfos(this.importNameToInfo[possibleName]);
            }
        }
        return result;
        function processInfos(infos) {
            for (var _i = 0, infos_2 = infos; _i < infos_2.length; _i++) {
                var info = infos_2[_i];
                if (info.fileName !== fileName
                    && info.meanings.some(function (m) { return (m & meaning) !== 0; })) {
                    result.push(info);
                }
            }
        }
    };
    return ImportsIndex;
}());
var LookupModuleScriptsProvider = (function () {
    function LookupModuleScriptsProvider(host) {
        this.host = host;
        this.module2scripts = {};
        this.scripts2module = {};
    }
    LookupModuleScriptsProvider.prototype.getLookupScripts = function () {
        this.reloadPkgJsonIfNeeded();
        this.loadScriptsPerModule();
        var result = [];
        for (var _i = 0, _a = this.pkgJsonModulesList; _i < _a.length; _i++) {
            var module_1 = _a[_i];
            var scripts = this.module2scripts[module_1];
            if (scripts) {
                result.push.apply(result, scripts);
            }
        }
        return result;
    };
    LookupModuleScriptsProvider.prototype.getModuleScriptFiles = function (module) {
        return this.module2scripts[module] || [];
    };
    LookupModuleScriptsProvider.prototype.getModuleName = function (scriptFile) {
        return this.scripts2module[scriptFile];
    };
    LookupModuleScriptsProvider.prototype.getIndexingRoots = function (program) {
        var _this = this;
        this.reloadPkgJsonIfNeeded();
        this.loadScriptsPerModule();
        return program.getSourceFiles().filter(function (file) {
            var name = file.fileName;
            var ind;
            if ((ind = name.indexOf("/node_modules/")) < 0) {
                return true;
            }
            if (name.substring(ind + "/node_modules/".length).startsWith("@types/")) {
                return true;
            }
            return !!_this.scripts2module[name];
        });
    };
    LookupModuleScriptsProvider.prototype.modulesModified = function (modules) {
        var _this = this;
        for (var _i = 0, modules_1 = modules; _i < modules_1.length; _i++) {
            var module_2 = modules_1[_i];
            var scripts = this.module2scripts[module_2];
            if (scripts) {
                scripts.forEach(function (s) { return delete _this.scripts2module[s]; });
            }
            delete this.module2scripts[module_2];
        }
    };
    LookupModuleScriptsProvider.prototype.reloadPkgJsonIfNeeded = function () {
        var jsonConfigDir = this.host.getTSConfigDir();
        var scriptVersion = undefined;
        while (jsonConfigDir.startsWith("eclipse:")) {
            scriptVersion = this.host.getScriptVersion(path.posix.join(jsonConfigDir, "package.json"));
            if (scriptVersion !== undefined) {
                break;
            }
            jsonConfigDir = path.posix.dirname(jsonConfigDir);
        }
        if (scriptVersion !== undefined) {
            if (this.pkgJsonDir !== jsonConfigDir
                || this.pkgJsonTimestamp !== scriptVersion) {
                this.pkgJsonDir = jsonConfigDir;
                this.pkgJsonTimestamp = scriptVersion;
                var snapshot = this.host.getScriptSnapshot(path.posix.join(jsonConfigDir, "package.json"));
                this.pkgJsonModulesList = [];
                try {
                    var pkgJson = JSON.parse(snapshot.getText(0, snapshot.getLength()));
                    for (var _i = 0, _a = ["dependencies", "devDependencies", "peerDependencies",
                        "bundleDependencies", "bundledDependencies", "optionalDependencies"]; _i < _a.length; _i++) {
                        var type = _a[_i];
                        var deps = pkgJson[type];
                        if (deps) {
                            (_b = this.pkgJsonModulesList).push.apply(_b, Object.keys(deps).filter(function (dep) { return !dep.startsWith("@types/"); }));
                        }
                    }
                }
                catch (e) {
                    main_1.main.logError(e);
                }
            }
        }
        else {
            this.pkgJsonModulesList = [];
        }
        var _b;
    };
    LookupModuleScriptsProvider.prototype.loadScriptsPerModule = function () {
        for (var _i = 0, _a = this.pkgJsonModulesList; _i < _a.length; _i++) {
            var module_3 = _a[_i];
            var scripts = this.module2scripts[module_3];
            if (scripts === undefined || scripts === null) {
                try {
                    scripts = this.gatherModuleScripts(module_3);
                    this.module2scripts[module_3] = scripts;
                }
                catch (e) {
                    this.module2scripts[module_3] = [];
                    main_1.main.logError(e);
                }
            }
        }
    };
    LookupModuleScriptsProvider.prototype.gatherModuleScripts = function (module) {
        var _this = this;
        var modulePackageDir = path.posix.join(this.pkgJsonDir, "node_modules", module);
        var result = [];
        var typingsFile;
        var moduleImport = module;
        var snapshot = this.host.getScriptSnapshot(path.posix.join(modulePackageDir, "package.json"));
        if (snapshot !== undefined && snapshot !== null) {
            var modulePackageJson = JSON.parse(snapshot.getText(0, snapshot.getLength()));
            typingsFile = modulePackageJson["typings"];
            if (!typingsFile) {
                var mainEntryPoint = modulePackageJson["main"];
                if (mainEntryPoint && mainEntryPoint.endsWith(".js")) {
                    typingsFile = mainEntryPoint.substring(0, mainEntryPoint.length - 2) + "d.ts";
                    moduleImport = path.posix.dirname(mainEntryPoint);
                    var baseName = path.posix.basename(mainEntryPoint);
                    if (baseName !== "index") {
                        moduleImport = path.posix.join(moduleImport, baseName);
                    }
                }
            }
            else if (!typingsFile.endsWith(".d.ts")) {
                typingsFile = typingsFile + ".d.ts";
            }
        }
        if (typingsFile === undefined) {
            typingsFile = "index.d.ts";
        }
        typingsFile = path.posix.join(modulePackageDir, typingsFile);
        if (this.host.getScriptVersion(typingsFile) !== undefined) {
            result.push(typingsFile);
            this.scripts2module[typingsFile] = moduleImport;
        }
        var submoduleResults = this.host.getDirectories(modulePackageDir)
            .filter(function (dir) { return _this.host.fileExists(modulePackageDir + "/" + dir + "/package.json"); })
            .map(function (subModule) { return _this.gatherModuleScripts(module + "/" + subModule); })
            .reduce(function (a, b) { return a.concat(b); }, []);
        return result.concat(submoduleResults);
    };
    return LookupModuleScriptsProvider;
}());
var ImportInfo = (function () {
    function ImportInfo() {
    }
    return ImportInfo;
}());
function createQuickFixes(fileName, program, start, end, missingName, imports) {
    var file = program.getSourceFile(fileName);
    var result = [];
    if (file.text.substring(start, end) === missingName) {
        imports.forEach(function (imp) { return createQuickFixesForImport(file, program, missingName, start, end, imp, result); });
        return result;
    }
    return undefined;
}
function createQuickFixesForImport(file, program, missingName, start, end, importInfo, result) {
    var fileName = file.fileName;
    var checker = program.getTypeChecker();
    var name = importInfo.name;
    var existingDeclarations = getExistingImportDeclarations(importInfo.module);
    var langEndpoint = main_1.main.getEndpoint("language");
    var projectName = langEndpoint.getProjectName(file.fileName);
    var tslintEndpoint = main_1.main.getEndpoint("tslint");
    var correctQuote = tslintEndpoint.getQuotemarkCharacters(projectName)[0];
    if (existingDeclarations.length > 0) {
        handleExistingImports(existingDeclarations);
    }
    else {
        handleNewImport();
    }
    function getExistingImportDeclarations(module) {
        var result = [];
        file.imports.forEach(function (importNode) {
            var importSymbol = checker.getSymbolAtLocation(importNode);
            if (importSymbol && (importSymbol.name === module.name)) {
                var node = importNode;
                while (node) {
                    if (node.kind === ts.SyntaxKind.ImportDeclaration) {
                        result.push(node);
                        return;
                    }
                    if (node.kind === ts.SyntaxKind.ImportEqualsDeclaration) {
                        result.push(node);
                        return;
                    }
                    node = node.parent;
                }
            }
        });
        return result;
    }
    function handleNewImport(importName) {
        var lastModuleSpecifierEnd = -1;
        importName = ts.stripQuotes(importName || calculateImportName(program.getCompilerOptions(), fileName, importInfo));
        for (var _i = 0, _a = file.imports; _i < _a.length; _i++) {
            var moduleSpecifier = _a[_i];
            var end_1 = moduleSpecifier.getEnd();
            if ((!lastModuleSpecifierEnd || end_1 > lastModuleSpecifierEnd)
                && (importName > moduleSpecifier.text)) {
                lastModuleSpecifierEnd = end_1;
            }
        }
        var newImportInsertPosition;
        if (lastModuleSpecifierEnd > 0) {
            var lineAndChar = file.getLineAndCharacterOfPosition(lastModuleSpecifierEnd);
            var nrs = file.getLineStarts();
            if (nrs.length > lineAndChar.line) {
                newImportInsertPosition = nrs[lineAndChar.line + 1];
            }
            else {
                newImportInsertPosition = nrs[lineAndChar.line];
            }
        }
        else {
            newImportInsertPosition = file.getStart();
        }
        var newText = "import { " + name + " } from " + correctQuote + importName + correctQuote + ";\n";
        var changes;
        var msgText;
        if (name !== missingName) {
            msgText = "Change '" + missingName + "' to '" + name + "' (" + importName + ")";
            if (newImportInsertPosition !== start) {
                changes = [{
                        span: { start: newImportInsertPosition, length: 0 },
                        newText: newText
                    }, {
                        span: { start: start, length: end - start },
                        newText: name
                    }];
            }
            else {
                changes = [{
                        span: { start: start, length: end - start },
                        newText: newText + name
                    }];
            }
        }
        else {
            msgText = "Import '" + name + "' from '" + importName + "'";
            changes = [{
                    span: { start: newImportInsertPosition, length: 0 },
                    newText: newText
                }];
        }
        result.push(new quickFixes_1.DynamicQuickFix(msgText, undefined, "add-import", "no-grouping:ts:add-import", calculateRelevance(name === missingName, importName), undefined, changes));
    }
    function handleExistingImports(declarations) {
        var namespaceImportDeclaration;
        var namedImportDeclaration;
        var existingModuleSpecifier;
        for (var _i = 0, declarations_1 = declarations; _i < declarations_1.length; _i++) {
            var declaration = declarations_1[_i];
            if (declaration.kind === ts.SyntaxKind.ImportDeclaration) {
                var namedBindings = declaration.importClause && declaration.importClause.namedBindings;
                if (namedBindings && namedBindings.kind === ts.SyntaxKind.NamespaceImport) {
                    namespaceImportDeclaration = declaration;
                }
                else {
                    namedImportDeclaration = declaration;
                }
                existingModuleSpecifier = declaration.moduleSpecifier.getText();
            }
            else {
                namespaceImportDeclaration = declaration;
                existingModuleSpecifier = getModuleSpecifierFromImportEqualsDeclaration(declaration);
            }
        }
        if (namespaceImportDeclaration) {
            handleNamespaceImport(namespaceImportDeclaration);
        }
        if (namedImportDeclaration && namedImportDeclaration.importClause &&
            (namedImportDeclaration.importClause.name || namedImportDeclaration.importClause.namedBindings)) {
            var textChange = getTextChangeForImportClause(namedImportDeclaration.importClause);
            var moduleSpecifierWithoutQuotes = ts.stripQuotes(namedImportDeclaration.moduleSpecifier.getText());
            var changes = [];
            var textMsg = void 0;
            if (textChange) {
                changes.push(textChange);
            }
            if (name !== missingName) {
                changes.push({
                    span: { start: start, length: end - start },
                    newText: name
                });
                textMsg = "Change '" + missingName + "' to '" + name + "' (" + moduleSpecifierWithoutQuotes + ")";
            }
            else {
                textMsg = "Add '" + name + "' to import declaration from '" + moduleSpecifierWithoutQuotes + "'";
            }
            result.push(new quickFixes_1.DynamicQuickFix(textMsg, undefined, "add-import", "no-grouping:ts:add-import", quickFixes_1.QuickFix.REL_CRITICAL + 1, undefined, changes));
        }
        else {
            handleNewImport(existingModuleSpecifier);
        }
        function getModuleSpecifierFromImportEqualsDeclaration(declaration) {
            if (declaration.moduleReference && declaration.moduleReference.kind === ts.SyntaxKind.ExternalModuleReference) {
                return declaration.moduleReference.expression.getText();
            }
            return declaration.moduleReference.getText();
        }
        function getTextChangeForImportClause(importClause) {
            var newImportText = name;
            var importList = importClause.namedBindings;
            if (!importList && importClause.name) {
                var start_1 = importClause.name.getEnd();
                return {
                    newText: ", { " + newImportText + " }",
                    span: { start: start_1, length: 0 }
                };
            }
            if (importList.elements.length === 0) {
                var start_2 = importList.getStart();
                return {
                    newText: "{ " + newImportText + " }",
                    span: { start: start_2, length: importList.getEnd() - start_2 }
                };
            }
            for (var _i = 0, _a = importList.elements; _i < _a.length; _i++) {
                var element = _a[_i];
                if (element.name && (element.name.text === name)) {
                    return undefined;
                }
            }
            var insertPoint = importList.elements[importList.elements.length - 1].getEnd();
            var startLine = ts.getLineOfLocalPosition(file, importList.getStart());
            var endLine = ts.getLineOfLocalPosition(file, importList.getEnd());
            var oneImportPerLine = endLine - startLine > importList.elements.length;
            return {
                newText: "," + (oneImportPerLine ? "\n" : " ") + newImportText,
                span: { start: insertPoint, length: 0 }
            };
        }
        function handleNamespaceImport(declaration) {
            var namespacePrefix;
            if (declaration.kind === ts.SyntaxKind.ImportDeclaration) {
                namespacePrefix = declaration.importClause.namedBindings.name.getText();
            }
            else {
                namespacePrefix = declaration.name.getText();
            }
            namespacePrefix = ts.stripQuotes(namespacePrefix);
            result.push(new quickFixes_1.DynamicQuickFix("Change '" + missingName + " to '" + namespacePrefix + "." + name + "'", undefined, "add-import", "no-grouping:ts:add-import", quickFixes_1.QuickFix.REL_CRITICAL, undefined, [{
                    span: { start: start, length: end - start },
                    newText: namespacePrefix + "." + name
                }]));
        }
    }
}
function calculateRelevance(exactMatch, importName) {
    if (importName.startsWith(".")) {
        var count = 0;
        for (var _i = 0, importName_1 = importName; _i < importName_1.length; _i++) {
            var char = importName_1[_i];
            if (char === "/") {
                count++;
            }
        }
        return quickFixes_1.QuickFix.REL_CRITICAL + 1 + Math.min(count, 24) + (exactMatch ? 0 : 30);
    }
    return quickFixes_1.QuickFix.REL_CRITICAL + 25 + (exactMatch ? 0 : 30);
}
function calculateImportName(options, fileName, info) {
    if (info.moduleName) {
        return info.moduleName;
    }
    var moduleName = info.fileName;
    if (moduleName.endsWith("/index.ts")
        || moduleName.endsWith("/index.tsx")) {
        moduleName = path.posix.dirname(moduleName);
    }
    if (moduleName.endsWith("/")) {
        moduleName = moduleName.substring(0, moduleName.length - 1);
    }
    var result = path.posix.relative(path.posix.dirname(fileName), moduleName);
    if (result.endsWith(".ts")) {
        result = result.substring(0, result.length - 3);
    }
    else if (result.endsWith(".tsx")) {
        result = result.substring(0, result.length - 4);
    }
    if (!result.startsWith(".")) {
        return "./" + result;
    }
    return result;
}
function createNameMatchPattern(pattern, prefixMatch) {
    var regex = pattern;
    regex = regex.replace(/([^A-Za-z0-9])/g, "\\$1");
    regex = regex.replace("*", ".*");
    var flags = "";
    if (/[A-Z]/.test(regex)) {
        regex = regex.substring(0, 1) + regex.substring(1).replace(/([A-Z][a-z0-9_\\$]*)/g, "[A-Za-z0-9_\\$]*?$1");
    }
    else {
        flags = "i";
    }
    if (prefixMatch) {
        regex = "^" + regex + ".*";
    }
    else {
        regex = ".*" + regex + ".*";
    }
    return new RegExp(regex, flags);
}
