"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var jsdoc_1 = require("../jsdoc");
var services_1 = require("../services");
var main_1 = require("../main");
var quickFixes_1 = require("../quickFixes");
var language_service_1 = require("@angular/language-service");
var AngularEndpoint = (function () {
    function AngularEndpoint() {
        this.plugin = {};
        services_1.registry.registerProvider(new AngularValidator(this));
    }
    Object.defineProperty(AngularEndpoint.prototype, "languageEndpoint", {
        get: function () {
            if (!this.languageEndpoint_) {
                this.languageEndpoint_ = main_1.main.getEndpoint("language");
            }
            return this.languageEndpoint_;
        },
        enumerable: true,
        configurable: true
    });
    AngularEndpoint.prototype.getCompletionsAtPosition = function (projectName, fileName, contents, position) {
        if (fileName.endsWith(".ts") || fileName.endsWith(".tsx")) {
            throw new Error("Angular content assist in TS/TSX files not supported this way.");
        }
        this.languageEndpoint.updateFileContent(fileName, contents);
        return this.getServicePlugin(projectName).getPromisedCompletionsAtPosition(fileName, position);
    };
    AngularEndpoint.prototype.getDefinitionAtPosition = function (projectName, fileName, contents, position) {
        if (fileName.endsWith(".ts") || fileName.endsWith(".tsx")) {
            throw new Error("Angular content assist in TS/TSX files not supported this way.");
        }
        this.languageEndpoint.updateFileContent(fileName, contents);
        return this.getServicePlugin(projectName).getPromisedDefinitionAtPosition(fileName, position);
    };
    AngularEndpoint.prototype.getQuickInfoAtPosition = function (projectName, fileName, contents, position) {
        if (fileName.endsWith(".ts") || fileName.endsWith(".tsx")) {
            throw new Error("Angular content assist in TS/TSX files not supported this way.");
        }
        var plugin = this.getServicePlugin(projectName);
        if (plugin.getQuickInfoAtPositionSync) {
            this.languageEndpoint.updateFileContent(fileName, contents);
            return jsdoc_1.formatQuickInfo(plugin.getQuickInfoAtPositionSync(fileName, position));
        }
    };
    AngularEndpoint.prototype.getCompletionEntryDetails = function (projectName, fileName, position, name, type) {
        if (fileName.endsWith(".ts") || fileName.endsWith(".tsx")) {
            throw new Error("Angular content assist in TS/TSX files not supported this way.");
        }
        var plugin = this.getServicePlugin(projectName);
        if (plugin.getCompletionEntryDetailsSync) {
            return jsdoc_1.formatCompletionEntryDetails(plugin.getCompletionEntryDetailsSync(fileName, position, name, type));
        }
    };
    AngularEndpoint.prototype.getServicePlugin = function (projectName) {
        var result = this.plugin[projectName];
        if (!result) {
            var host = this.languageEndpoint.getLanguageServiceHost(projectName);
            if (!host) {
                throw new Error("Cannot acquire Language Service Host for " + projectName);
            }
            var service = this.languageEndpoint.getLanguageService(projectName);
            if (!service) {
                throw new Error("Cannot acquire Language Service for " + projectName);
            }
            var registry_1 = this.languageEndpoint.getDocumentRegistry();
            var basePath = this.languageEndpoint.getProjectTSConfigDir(projectName);
            if (!basePath) {
                throw new Error("Cannot acquire base path for " + projectName);
            }
            result = this.plugin[projectName] = new language_service_1.default({
                host: host, service: service, registry: registry_1, basePath: basePath,
                logger: { log: function (e) { main_1.main.logError(e); } }
            });
        }
        return result;
    };
    return AngularEndpoint;
}());
exports.AngularEndpoint = AngularEndpoint;
var AngularValidator = (function () {
    function AngularValidator(endpoint) {
        this.endpoint = endpoint;
    }
    Object.defineProperty(AngularValidator.prototype, "languageEndpoint", {
        get: function () {
            if (!this.languageEndpoint_) {
                this.languageEndpoint_ = main_1.main.getEndpoint("language");
            }
            return this.languageEndpoint_;
        },
        enumerable: true,
        configurable: true
    });
    AngularValidator.prototype.addCompletions = function (completions, projectName, fileName, offset) {
        if (this.endpoint.getServicePlugin(projectName).getCompletionsAtPositionSync) {
            var result = this.endpoint.getServicePlugin(projectName).getCompletionsAtPositionSync(fileName, offset);
            if (result) {
                result.forEach(function (c) {
                    completions.entries.push({
                        kind: c.kind,
                        name: c.name.startsWith("%") ? c.name.substr(1) : c.name,
                        sortText: c.sort,
                        kindModifiers: getKindModifier(c.name)
                    });
                });
            }
        }
        function getKindModifier(name) {
            if (name.startsWith("[")) {
                return "in";
            }
            if (name.startsWith("([")) {
                return "inout";
            }
            if (name.startsWith("(")) {
                return "out";
            }
            if (name.startsWith("*")) {
                return "templ";
            }
            if (name.startsWith("%")) {
                return "attr";
            }
            return "";
        }
    };
    AngularValidator.prototype.getCompletionEntryDetails = function (projectName, fileName, position, name, kind) {
        var plugin = this.endpoint.getServicePlugin(projectName);
        if (plugin.getCompletionEntryDetailsSync) {
            return jsdoc_1.formatCompletionEntryDetails(plugin.getCompletionEntryDetailsSync(fileName, position, name, kind));
        }
    };
    AngularValidator.prototype.getQuickInfo = function (projectName, fileName, position) {
        var plugin = this.endpoint.getServicePlugin(projectName);
        if (plugin.getQuickInfoAtPositionSync) {
            return jsdoc_1.formatQuickInfo(plugin.getQuickInfoAtPositionSync(fileName, position));
        }
    };
    AngularValidator.prototype.validate = function (projectName, modifiedFiles, asYouType) {
        var _this = this;
        if (asYouType) {
            return Promise.resolve({});
        }
        var plugin = this.endpoint.getServicePlugin(projectName);
        var result = {};
        if (modifiedFiles === null || modifiedFiles === undefined) {
            var srcFiles = this.languageEndpoint.getProgram(projectName)
                .getSourceFiles()
                .filter(function (sourceFile) { return sourceFile.fileName.indexOf("/node_modules/") < 0; })
                .map(function (sourceFile) { return sourceFile.fileName; });
            modifiedFiles = srcFiles;
        }
        return plugin
            .validate(modifiedFiles)
            .then(function (diags) {
            var program = _this.languageEndpoint.getProgram(projectName);
            var result = {};
            diags.forEach(function (diags, file) {
                var fileInfo = result[file] = new services_1.FileMarkersInfo();
                fileInfo.markerTypes[services_1.MarkerType.ANGULAR2_PROBLEM] = diags.length > 0;
                var fileErrors = fileInfo.markers;
                for (var _i = 0, diags_1 = diags; _i < diags_1.length; _i++) {
                    var diag = diags_1[_i];
                    if (fileErrors.length > 100) {
                        continue;
                    }
                    var srcFile = program.getSourceFile(file);
                    var lineLoc = srcFile && srcFile.getLineAndCharacterOfPosition(diag.span.start);
                    var line = (lineLoc && lineLoc.line) || -1;
                    fileErrors.push(new services_1.FileMarker(services_1.MarkerType.ANGULAR2_PROBLEM, diag.span.start, diag.span.end, line, diag.message, services_1.MarkerPriority.PRIORITY_HIGH, diag.kind == 1 ? services_1.MarkerSeverity.SEVERITY_WARNING : services_1.MarkerSeverity.SEVERITY_ERROR, diag.type, diag.quickFixes && diag.quickFixes.map(function (qf) { return new quickFixes_1.QuickFix(qf.title, qf.description, qf.imageName, qf.type, quickFixes_1.QuickFix.REL_HIGH); })));
                }
            });
            return Promise.resolve(result);
        });
    };
    AngularValidator.prototype.createQuickFixes = function (projectName, quickFixRequests) {
        var plugin = this.endpoint.getServicePlugin(projectName);
        if (plugin.createQuickFixes) {
            return plugin.createQuickFixes(quickFixRequests);
        }
    };
    AngularValidator.prototype.prepareRefactoringChanges = function (projectName, type, files, parameters) {
        var plugin = this.endpoint.getServicePlugin(projectName);
        if (plugin.prepareRefactoringChanges) {
            var changes = plugin.prepareRefactoringChanges(projectName, type, files, parameters);
            if (changes) {
                return changes;
            }
        }
    };
    return AngularValidator;
}());
