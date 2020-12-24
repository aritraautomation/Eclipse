"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var fs = require("fs");
var path = require("path");
var ts = require("typescript");
var semver = require("semver");
var services_1 = require("../services");
var quickFixes_1 = require("../quickFixes");
var main_1 = require("../main");
var progress_1 = require("../progress");
var tslint3_1 = require("./tslint3");
var tslint4_1 = require("./tslint4");
var tslint5_1 = require("./tslint5");
var requizzle = require("requizzle");
var TSLintEndpoint = (function () {
    function TSLintEndpoint() {
        this.projectPreferences = {};
        this.customQuickFixes = {};
        this.customFailureFilters = {};
        this.configFiles = {};
        services_1.registry.registerProvider(this);
        this.registerCustomQuickFixes();
        this.registerCustomFilters();
    }
    Object.defineProperty(TSLintEndpoint.prototype, "languageEndpoint", {
        get: function () {
            if (!this.languageEndpoint_) {
                this.languageEndpoint_ = main_1.main.getEndpoint("language");
            }
            return this.languageEndpoint_;
        },
        enumerable: true,
        configurable: true
    });
    TSLintEndpoint.prototype.updatePreferences = function (projectName, prefs) {
        this.projectPreferences[projectName] = prefs;
    };
    TSLintEndpoint.prototype.validate = function (projectName, modifiedFiles, asYouType) {
        var _this = this;
        var prefs = this.projectPreferences[projectName] || { enableTSLint: false, tsLintVersion: null };
        if (!prefs.enableTSLint) {
            if (modifiedFiles === null || modifiedFiles === undefined) {
                var projectInfo = new services_1.FileMarkersInfo();
                projectInfo.markerTypes[services_1.MarkerType.TSLINT_CONFIG_PROBLEM] = true;
                projectInfo.markerTypes[services_1.MarkerType.TSLINT_FAILURE] = true;
                var projectFile = "eclipse:" + projectName;
                return Promise.resolve({ projectFile: projectInfo });
            }
            return Promise.resolve({});
        }
        var _a = this.findTSLint(projectName), fsName = _a.fsName, tsLintName = _a.tsLintName;
        var result = {};
        var linter = this.createLinter(projectName, prefs.tsLintVersion);
        var lintJS = false;
        if (fsName && linter) {
            var configFile_1;
            var configFileInfo = result[tsLintName] = new services_1.FileMarkersInfo();
            configFileInfo.markerTypes[services_1.MarkerType.TSLINT_CONFIG_PROBLEM] = false;
            try {
                configFile_1 = linter.loadConfigFile(fsName);
            }
            catch (e) {
                if (e.message) {
                    configFileInfo.markers = [
                        new services_1.FileMarker(services_1.MarkerType.TSLINT_CONFIG_PROBLEM, 0, 1, 1, "TSLint configuration is malformed (Using " + linter.name() + "):\n " + e.message, services_1.MarkerPriority.PRIORITY_NORMAL, services_1.MarkerSeverity.SEVERITY_ERROR)
                    ];
                    return Promise.resolve(result);
                }
                else {
                    throw e;
                }
            }
            this.configFiles[projectName] = configFile_1;
            lintJS = configFile_1.jsRules !== undefined;
            configFileInfo.markers = validateRules(fsName, configFile_1, linter, true);
            var program_1 = this.languageEndpoint.getProgram(projectName);
            var toCheck_1 = new Set();
            if (modifiedFiles === null || modifiedFiles === undefined
                || modifiedFiles.some(function (f) { return f === tsLintName; })) {
                program_1.getSourceFiles()
                    .filter(isSupportedSourceFile)
                    .forEach(function (f) { return toCheck_1.add(f); });
            }
            else {
                modifiedFiles
                    .filter(function (f) { return (f.indexOf("/node_modules/") < 0); })
                    .forEach(function (name) {
                    var f = program_1.getSourceFile(name);
                    if (f) {
                        if (isSupportedSourceFile(f)) {
                            toCheck_1.add(f);
                        }
                        else {
                            var fileInfo = result[name] = new services_1.FileMarkersInfo();
                            fileInfo.markerTypes[services_1.MarkerType.TSLINT_FAILURE] = false;
                            fileInfo.markerTypes[services_1.MarkerType.TSLINT_JS_FAILURE] = false;
                        }
                    }
                });
            }
            var done_1 = 0;
            var skipRest_1 = false;
            toCheck_1.forEach(function (f) {
                if (skipRest_1) {
                    return;
                }
                progress_1.progressMonitor.subTask("linting TypeScript: "
                    + f.fileName.substring(f.fileName.indexOf("/"))
                    + " (" + Math.round(done_1++ * 100 / toCheck_1.size) + "%)");
                var markerType = (f.flags & ts.NodeFlags.JavaScriptFile) === 0
                    ? services_1.MarkerType.TSLINT_FAILURE
                    : services_1.MarkerType.TSLINT_JS_FAILURE;
                var fileInfo = result[f.fileName] = new services_1.FileMarkersInfo();
                fileInfo.markerTypes[markerType] = false;
                var fileRes = fileInfo.markers;
                try {
                    var lintRes = linter.lint(f, configFile_1, program_1);
                    if (lintRes) {
                        lintRes.failures.forEach(function (failure) {
                            if (_this.filterOut(failure, f)) {
                                return;
                            }
                            var _a = alignPosition(failure, f.text), start = _a.start, end = _a.end;
                            var quickFixes = [];
                            var customFix = _this.customQuickFixes[failure.getRuleName()];
                            if ((failure.hasFix && failure.hasFix())
                                || (customFix && customFix.hasQuickFix(failure))) {
                                var title = void 0;
                                if (customFix && customFix.getTitle && customFix.hasQuickFix(failure)) {
                                    title = customFix.getTitle(failure);
                                }
                                else {
                                    var descr = failure.getFailure();
                                    descr = descr[0].toLowerCase() + descr.substring(1);
                                    title = "Fix " + descr;
                                }
                                quickFixes.push(new quickFixes_1.QuickFix(title, undefined, "fix", "tslint:" + _this.extractType(failure.getFailure()), quickFixes_1.QuickFix.REL_HIGHEST));
                            }
                            quickFixes.push(new quickFixes_1.QuickFix("Locally disable '" + failure.getRuleName() + "' rule", undefined, "disable", "tslint-ide:disable-local:" + failure.getRuleName(), quickFixes_1.QuickFix.REL_HIGH));
                            quickFixes.push(new quickFixes_1.QuickFix("Remove rule '" + failure.getRuleName() + "' from tslint.json", undefined, "remove", "tslint-ide:remove:" + failure.getRuleName(), quickFixes_1.QuickFix.REL_LOW));
                            quickFixes.push(new quickFixes_1.QuickFix("Jump to configuration of rule '" + failure.getRuleName() + "'", undefined, "jump", "" +
                                "tslint-ide:jump-to:" + failure.getRuleName(), quickFixes_1.QuickFix.REL_LOW + 5, "Jump to rule configuration"));
                            quickFixes.push(new quickFixes_1.QuickFix("Disable TSLint validation for this project", undefined, "disable-all", "tslint-ide:disable", quickFixes_1.QuickFix.REL_LOWEST));
                            var severity;
                            if (failure.getRuleSeverity) {
                                switch (failure.getRuleSeverity()) {
                                    case "error":
                                        severity = services_1.MarkerSeverity.SEVERITY_ERROR;
                                        break;
                                    case "warning":
                                        severity = services_1.MarkerSeverity.SEVERITY_WARNING;
                                        break;
                                    case "off":
                                        return;
                                }
                            }
                            else {
                                severity = services_1.MarkerSeverity.SEVERITY_WARNING;
                            }
                            fileRes.push(new services_1.FileMarker(markerType, start, end, failure.getStartPosition().getLineAndCharacter().line + 1, failure.getFailure(), services_1.MarkerPriority.PRIORITY_NORMAL, severity, failure.getRuleName(), quickFixes));
                        });
                    }
                }
                catch (e) {
                    if (e.message) {
                        var lineStarts = f.getLineStarts();
                        fileRes.push(new services_1.FileMarker(markerType, 0, lineStarts.length > 1 ? lineStarts[1] : f.text.length, 1, "Internal error in " + linter.name() + ": " + e.message, services_1.MarkerPriority.PRIORITY_NORMAL, services_1.MarkerSeverity.SEVERITY_WARNING));
                        main_1.main.logError(e);
                    }
                    else {
                        throw e;
                    }
                }
            });
        }
        return Promise.resolve(result);
        function isSupportedSourceFile(f) {
            return (f.fileName.indexOf("/node_modules/") < 0)
                && !f.isDeclarationFile
                && (lintJS || (f.kind & ts.NodeFlags.JavaScriptFile) === 0);
        }
    };
    TSLintEndpoint.prototype.createLinter = function (projectName, tsLintVersion) {
        var host = this.languageEndpoint.getLanguageServiceHost(projectName);
        var languageService = this.languageEndpoint.getLanguageService(projectName);
        var tsConfigDir = this.languageEndpoint.getProjectTSConfigDir(projectName);
        var tsLintModule;
        var embedded;
        if (tsLintVersion && tsLintVersion !== "default") {
            embedded = true;
            tsLintModule = path.join(__dirname, tsLintVersion === "5.6.0"
                ? "../../node_modules/tslint"
                : "../../tslint/" + tsLintVersion + "/node_modules/tslint");
            if (!fs.existsSync(tsLintModule)) {
                console.error(tsLintModule + " does not exist. Falling back to latest TSLint version.");
                tsLintModule = null;
            }
        }
        else {
            embedded = false;
            tsLintModule = this.findup("node_modules/tslint/package.json", tsConfigDir, host);
            if (tsLintModule) {
                tsLintModule = host.getRealFileName(path.posix.dirname(tsLintModule));
            }
        }
        if (tsLintModule) {
            try {
                var tslint = requireTsLint(tsLintModule);
                if (tslint.VERSION && tslint.VERSION >= "3.0.0" && tslint.VERSION < "4.0.0") {
                    return new tslint3_1.TSLint3(tslint, embedded, tsLintModule);
                }
                if (tslint.Linter && tslint.Linter.VERSION && tslint.Linter.VERSION >= "4.0.0"
                    && tslint.Linter.VERSION < "5.0.0") {
                    return new tslint4_1.TSLint4(tslint, embedded, languageService);
                }
                if (tslint.Linter && tslint.Linter.VERSION && tslint.Linter.VERSION >= "5.0.0"
                    && tslint.Linter.VERSION < "6.0.0") {
                    return new tslint5_1.TSLint5(tslint, embedded, languageService);
                }
            }
            catch (e) {
            }
        }
        return new tslint5_1.TSLint5(requireTsLint("tslint"), true, languageService);
    };
    TSLintEndpoint.prototype.createQuickFixes = function (projectName, quickFixRequests, formattingOptions) {
        var _this = this;
        var prefs = this.projectPreferences[projectName] || { enableTSLint: false, tsLintVersion: null };
        quickFixRequests = quickFixRequests.filter(function (req) { return req.type.startsWith("tslint:"); });
        if (quickFixRequests.length == 0) {
            return Promise.resolve({});
        }
        var _a = this.findTSLint(projectName), fsName = _a.fsName, tsLintName = _a.tsLintName;
        var result = {};
        var linter = this.createLinter(projectName, prefs.tsLintVersion);
        if (fsName && linter) {
            var configFile = void 0;
            try {
                configFile = linter.loadConfigFile(fsName);
            }
            catch (e) {
                throw e;
            }
            validateRules(fsName, configFile, linter, false);
            this.configFiles[projectName] = configFile;
            var program = this.languageEndpoint.getProgram(projectName);
            var reqsPerFile_1 = {};
            quickFixRequests.forEach(function (req) {
                (reqsPerFile_1[req.fileName] || (reqsPerFile_1[req.fileName] = [])).push(req);
            });
            var _loop_1 = function (fileName) {
                var f = program.getSourceFile(fileName);
                if (!f) {
                    return "continue";
                }
                var lintRes = linter.lint(f, configFile, program);
                if (lintRes) {
                    var reqsMap_1 = {};
                    for (var _i = 0, _a = reqsPerFile_1[fileName]; _i < _a.length; _i++) {
                        var req = _a[_i];
                        reqsMap_1[req.start] = {
                            start: req.start,
                            end: req.end,
                            fileName: req.fileName,
                            type: req.type.substring("tslint:".length)
                        };
                    }
                    var edits_1 = result[fileName] || (result[fileName] = []);
                    lintRes.failures.forEach(function (failure) {
                        var _a = alignPosition(failure, f.text), start = _a.start, end = _a.end;
                        var fixReq = reqsMap_1[start];
                        var reqType = _this.extractType(failure.getFailure());
                        var sameTypeReqs = [];
                        if (reqsPerFile_1[fileName].length > 1) {
                            for (var reqName in reqsMap_1) {
                                if (reqsMap_1[reqName].type == reqType) {
                                    sameTypeReqs.push(reqsMap_1[reqName]);
                                }
                            }
                        }
                        if (fixReq
                            && fixReq.type == reqType
                            && fixReq.end == end) {
                            var customQuickFix = _this.customQuickFixes[failure.getRuleName()];
                            if (failure.hasFix && failure.hasFix()) {
                                var fix = failure.getFix();
                                var arr = void 0;
                                if (fix.replacements) {
                                    arr = fix.replacements;
                                }
                                else if (fix.text !== undefined) {
                                    arr = [fix];
                                }
                                else if (fix) {
                                    arr = fix;
                                }
                                for (var _i = 0, arr_1 = arr; _i < arr_1.length; _i++) {
                                    var replacement = arr_1[_i];
                                    edits_1.push({
                                        span: {
                                            start: replacement.start,
                                            length: replacement.length
                                        },
                                        newText: replacement.text
                                    });
                                }
                            }
                            else if (customQuickFix && customQuickFix.hasQuickFix(failure)) {
                                var replacements = customQuickFix.getReplacements(failure, sameTypeReqs, f);
                                if (replacements.length > 0) {
                                    edits_1.push.apply(edits_1, replacements);
                                }
                            }
                        }
                    });
                }
            };
            for (var _i = 0, _b = Object.keys(reqsPerFile_1); _i < _b.length; _i++) {
                var fileName = _b[_i];
                _loop_1(fileName);
            }
        }
        return Promise.resolve(result);
    };
    TSLintEndpoint.prototype.getConfigFile = function (projectName) {
        return this.configFiles[projectName];
    };
    TSLintEndpoint.prototype.getQuotemarkCharacters = function (projectName) {
        var configFile = this.getConfigFile(projectName);
        var singleQuote = false;
        if (configFile && configFile.rules && configFile.rules.get && configFile.rules.get("quotemark")) {
            var quoteMarkConfig = configFile.rules.get("quotemark");
            if (quoteMarkConfig.ruleArguments[0]) {
                singleQuote = quoteMarkConfig.ruleArguments[0] === "single";
            }
        }
        var correctQuote = singleQuote ? "'" : "\"";
        var wrongQuote = singleQuote ? "\"" : "'";
        return [correctQuote, wrongQuote];
    };
    TSLintEndpoint.prototype.findTSLint = function (projectName) {
        var host = this.languageEndpoint.getLanguageServiceHost(projectName);
        var tsConfigDir = this.languageEndpoint.getProjectTSConfigDir(projectName);
        var tsLint = this.findup("tslint.json", tsConfigDir, host);
        if (tsLint) {
            return { fsName: host.getRealFileName(tsLint), tsLintName: tsLint };
        }
        return { fsName: undefined, tsLintName: undefined };
    };
    TSLintEndpoint.prototype.findup = function (fileName, dir, host) {
        while (dir && dir.startsWith("eclipse:")) {
            var snapshot = host.getScriptSnapshot(path.posix.join(dir, fileName));
            if (snapshot) {
                return path.posix.join(dir, fileName);
            }
            dir = path.posix.dirname(dir);
        }
        return undefined;
    };
    TSLintEndpoint.prototype.filterOut = function (failure, file) {
        var filter = this.customFailureFilters[failure.getRuleName()];
        return filter && filter.shouldFilterOut(failure, file);
    };
    TSLintEndpoint.prototype.extractType = function (type) {
        if (type.startsWith("Unused import:")) {
            return "Unused import";
        }
        return type;
    };
    TSLintEndpoint.prototype.registerCustomQuickFixes = function () {
        this.customQuickFixes["no-trailing-whitespace"] = {
            hasQuickFix: function (failure) { return true; },
            getReplacements: function (failure) {
                return [{
                        span: {
                            start: failure.getStartPosition().getPosition(),
                            length: failure.getEndPosition().getPosition() - failure.getStartPosition().getPosition(),
                        },
                        newText: ""
                    }];
            }
        };
        this.customQuickFixes["quotemark"] = {
            hasQuickFix: function (failure) {
                return failure.getFailure() === "\" should be '"
                    || failure.getFailure() === "' should be \"";
            },
            getReplacements: function (failure, sameTypeRequests, file) {
                var text = file.text;
                var quote = failure.getFailure() === "\" should be '" ? "'" : "\"";
                var wrongQuote = failure.getFailure() === "\" should be '" ? "\"" : "'";
                var result = [];
                var start = failure.getStartPosition().getPosition();
                var end = failure.getEndPosition().getPosition();
                if (text.charAt(start) === wrongQuote) {
                    result.push({ span: { start: start, length: 1 }, newText: quote });
                }
                if (start + 1 < end && text.charAt(end - 1) === wrongQuote) {
                    result.push({ span: { start: end - 1, length: 1 }, newText: quote });
                }
                for (var i = start + 1; i < end; i++) {
                    if (text.charAt(i) === quote && text.charAt(i - 1) !== "\\") {
                        result.push({ span: { start: i, length: 0 }, newText: "\\" });
                    }
                }
                return result;
            }
        };
        this.customQuickFixes["whitespace"] = {
            hasQuickFix: function (failure) {
                return "missing whitespace" === failure.getFailure();
            },
            getReplacements: function (failure, sameTypeRequests, file) {
                if ("missing whitespace" === failure.getFailure()) {
                    return [
                        { span: { start: failure.getStartPosition().getPosition(), length: 0 }, newText: " " }
                    ];
                }
                return [];
            }
        };
        this.customQuickFixes["eofline"] = {
            hasQuickFix: function (failure) {
                return "file should end with a newline" === failure.getFailure();
            },
            getReplacements: function (failure, sameTypeRequests, file) {
                if ("file should end with a newline" === failure.getFailure()) {
                    return [
                        { span: { start: failure.getStartPosition().getPosition(), length: 0 }, newText: "\n" }
                    ];
                }
                return [];
            }
        };
        this.customQuickFixes["one-line"] = {
            hasQuickFix: function (failure) {
                return "missing whitespace" === failure.getFailure();
            },
            getReplacements: function (failure, sameTypeRequests, file) {
                if ("missing whitespace" === failure.getFailure()) {
                    return [
                        { span: { start: failure.getStartPosition().getPosition(), length: 0 }, newText: " " }
                    ];
                }
                return [];
            }
        };
        this.customQuickFixes["comment-format"] = {
            hasQuickFix: function (failure) {
                return "comment must start with a space" === failure.getFailure();
            },
            getReplacements: function (failure, sameTypeRequests, file) {
                if ("comment must start with a space" === failure.getFailure()) {
                    return [
                        { span: { start: failure.getStartPosition().getPosition(), length: 0 }, newText: " " }
                    ];
                }
                return [];
            }
        };
        this.customQuickFixes["no-var-keyword"] = {
            hasQuickFix: function (failure) {
                return true;
            },
            getReplacements: function (failure, sameTypeRequests, file) {
                var start = failure.getStartPosition().getPosition();
                var end = failure.getEndPosition().getPosition();
                if (file.text.substring(start, end) === "var") {
                    return [
                        { span: { start: start, length: end - start }, newText: "let" }
                    ];
                }
                return [];
            },
            getTitle: function () {
                return "Fix by using 'let' instead of 'var'";
            }
        };
        this.customQuickFixes["no-unused-variable"] = {
            hasQuickFix: function (failure) { return failure.getFailure().startsWith("Unused import"); },
            getReplacements: function (failure, sameTypeRequests, file) {
                var result = [];
                var start = failure.getStartPosition().getPosition();
                var end = failure.getEndPosition().getPosition();
                var _loop_2 = function (statement) {
                    var importStatement = statement;
                    if (importStatement.getStart() <= start && importStatement.getEnd() >= end) {
                        var imports = importStatement.importClause.namedBindings;
                        if (!imports.elements || imports.elements.length == 1) {
                            start = importStatement.getStart();
                            end = importStatement.getEnd();
                            if (file.text.charAt(importStatement.getEnd()) === "\n") {
                                end += 1;
                            }
                        }
                        else {
                            var toRemove_1 = 0;
                            sameTypeRequests.forEach(function (req) {
                                if (importStatement.getStart() <= req.start && importStatement.getEnd() >= req.end) {
                                    toRemove_1++;
                                }
                            });
                            if (toRemove_1 == imports.elements.length) {
                                var lastImportName = imports.elements[imports.elements.length - 1].name;
                                if (file.text.substring(start, end) == lastImportName.text) {
                                    start = importStatement.getStart();
                                    end = importStatement.getEnd();
                                    if (file.text.charAt(importStatement.getEnd()) === "\n") {
                                        end += 1;
                                    }
                                }
                                else {
                                    return { value: result };
                                }
                            }
                            else {
                                for (var i = start; i > 0; i--) {
                                    if (file.text.charAt(i) === ",") {
                                        start = i;
                                        break;
                                    }
                                    else if (file.text.charAt(i) === "{") {
                                        for (var j = end; end < file.text.length; j++) {
                                            if (file.text.charAt(j) === ",") {
                                                end = j + 1;
                                                for (var k = end; end < file.text.length; k++) {
                                                    if (file.text.charAt(k).trim().length > 0) {
                                                        end = k;
                                                        break;
                                                    }
                                                }
                                                break;
                                            }
                                        }
                                        break;
                                    }
                                }
                            }
                        }
                        return "break";
                    }
                };
                for (var _i = 0, _a = file.statements; _i < _a.length; _i++) {
                    var statement = _a[_i];
                    var state_1 = _loop_2(statement);
                    if (typeof state_1 === "object")
                        return state_1.value;
                    if (state_1 === "break")
                        break;
                }
                result.push({ span: { start: start, length: end - start }, newText: "" });
                return result;
            }
        };
    };
    TSLintEndpoint.prototype.registerCustomFilters = function () {
        this.customFailureFilters["quotemark"] = {
            shouldFilterOut: function (failure, file) {
                var text = file.text;
                var quote = failure.getFailure() === "\" should be '" ? "'" : "\"";
                return text.charAt(failure.getStartPosition().getPosition()) === quote;
            }
        };
    };
    return TSLintEndpoint;
}());
exports.TSLintEndpoint = TSLintEndpoint;
function validateRules(fsName, configFile, linter, produceMarkers) {
    var configFileValidation = [];
    var ruleConfiguration = configFile.rules;
    var rulesDirectories = configFile.rulesDirectory;
    var ruleErrors = {};
    var ruleWarnings = {};
    if (ruleConfiguration.forEach) {
        ruleConfiguration.forEach(function (value, ruleName) { return validateRule(ruleName, value); });
        Object.keys(ruleErrors).forEach(function (ruleName) { return ruleConfiguration.delete(ruleName); });
    }
    else {
        for (var ruleName in ruleConfiguration) {
            if (ruleConfiguration.hasOwnProperty(ruleName)) {
                validateRule(ruleName);
            }
        }
        Object.keys(ruleErrors).forEach(function (ruleName) { return delete ruleConfiguration[ruleName]; });
    }
    function validateRule(ruleName, ruleOptions) {
        if (ruleName === "no-unused-variable" && !ts.sys.useCaseSensitiveFileNames
            && semver.satisfies(linter.version(), ">=5.0.0-a <5.4.0")) {
            ruleWarnings[ruleName] = "Cannot load rule \"" + ruleName + "\", because it will break other TypeScript services due to Windows specific issue https://github.com/palantir/tslint/issues/2649 - rule will be disabled. Please use TSLint 3.x, 4.x or update to TSLint 5.4.0 or higher.";
            ruleErrors[ruleName] = "";
            return;
        }
        try {
            var Rule = linter.findRule(ruleName, rulesDirectories, ruleOptions);
            if (!Rule) {
                ruleErrors[ruleName] = "Implementation of rule \"" + ruleName + "\" cannot be found. Try running 'npm install', upgrading TSLint (currently running with " + linter.name() + ") and/or ensuring that you have all necessary custom rules installed. If TSLint was recently upgraded, you may have old rules configured which need to be cleaned up.";
            }
            else {
                if (Rule.metadata && Rule.metadata.deprecationMessage) {
                    ruleWarnings[ruleName] = "Rule \"" + Rule.metadata.ruleName + "\" is deprecated. " + Rule.metadata.deprecationMessage;
                }
            }
        }
        catch (e) {
            ruleErrors[ruleName] = "Cannot load rule \"" + ruleName + "\". Internal error while loading the rule with " + linter.name() + ": " + e.message + ".";
        }
    }
    if (produceMarkers &&
        (Object.keys(ruleErrors).length > 0 || Object.keys(ruleWarnings).length > 0)) {
        var jju = require("jju");
        var tokens = jju.tokenize(fs.readFileSync(fsName, "UTF-8"));
        var position_1 = 0;
        tokens.forEach(function (tok) {
            if (tok.type === "key" && tok.stack.length === 1 && tok.stack[0] === "rules") {
                var ruleName = tok.value;
                if (ruleErrors[ruleName]) {
                    configFileValidation.push(new services_1.FileMarker(services_1.MarkerType.TSLINT_CONFIG_PROBLEM, position_1, position_1 + tok.raw.length, -1, ruleErrors[ruleName], services_1.MarkerPriority.PRIORITY_NORMAL, services_1.MarkerSeverity.SEVERITY_ERROR));
                }
                else if (ruleWarnings[ruleName]) {
                    configFileValidation.push(new services_1.FileMarker(services_1.MarkerType.TSLINT_CONFIG_PROBLEM, position_1, position_1 + tok.raw.length, -1, ruleWarnings[ruleName], services_1.MarkerPriority.PRIORITY_NORMAL, services_1.MarkerSeverity.SEVERITY_WARNING));
                }
            }
            position_1 += tok.raw.length;
        });
    }
    return configFileValidation;
}
function alignPosition(failure, text) {
    return services_1.adjustMarkerPos(failure.getStartPosition().getPosition(), failure.getEndPosition().getPosition(), text);
}
var lintCache = {};
function requireTsLint(tsLintModule) {
    var result = lintCache[tsLintModule];
    if (result) {
        return result;
    }
    var tsLintModuleParent = tsLintModule === "tslint" ?
        path.join(__dirname, "../../node_modules")
        : path.dirname(tsLintModule);
    var tsLintRequire = requizzle({
        requirePaths: {
            before: [tsLintModuleParent]
        },
        infect: true
    });
    result = lintCache[tsLintModule] = tsLintRequire(tsLintModule);
    return result;
}
