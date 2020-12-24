"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var path = require("path");
var ts = require("typescript");
var fs = require("fs");
var jju = require("jju");
var services_1 = require("../services");
var progress_1 = require("../progress");
var LanguageServiceProvider = (function () {
    function LanguageServiceProvider(endpoint) {
        this.endpoint = endpoint;
    }
    LanguageServiceProvider.prototype.prepareRefactoringChanges = function (projectName, type, files, parameters) {
        var host = this.endpoint.getLanguageServiceHost(projectName);
        if (host) {
            return host.prepareRefactoringChanges(type, files, parameters);
        }
    };
    LanguageServiceProvider.prototype.createQuickFixes = function (projectName, quickFixRequests, formattingOptions) {
        var host = this.endpoint.getLanguageServiceHost(projectName);
        if (!host) {
            return Promise.resolve(undefined);
        }
        return host.createQuickFixes(quickFixRequests, formattingOptions);
    };
    LanguageServiceProvider.prototype.createDynamicQuickFixes = function (projectName, quickFixRequest, formattingOptions) {
        var host = this.endpoint.getLanguageServiceHost(projectName);
        if (!host) {
            return Promise.resolve(undefined);
        }
        return host.createDynamicQuickFixes(quickFixRequest, formattingOptions);
    };
    LanguageServiceProvider.prototype.validate = function (projectName, modifiedFiles, asYouType) {
        var host = this.endpoint.getLanguageServiceHost(projectName);
        if (!host) {
            return Promise.resolve({});
        }
        var program = host.getProgram();
        var srcFiles = program
            .getSourceFiles()
            .filter(function (sourceFile) { return sourceFile.fileName.indexOf("/node_modules/") < 0; })
            .map(function (sourceFile) { return sourceFile.fileName; });
        var sourceFiles = new Set(srcFiles);
        var hostTSConfigFiles = host.getTSConfigFiles();
        var result = {};
        var errorCount = 0;
        if (modifiedFiles === null || modifiedFiles === undefined
            || modifiedFiles.find(function (file) { return hostTSConfigFiles.indexOf(file) >= 0; })) {
            var usedMessages_1 = new Set();
            hostTSConfigFiles
                .reverse()
                .forEach(function (tsConfigFile) {
                var tsRealConfigFile = host.getRealFileName(tsConfigFile);
                var _a = parseConfigFile(host, tsRealConfigFile), _ = _a[0], diagnostics = _a[1];
                result[tsConfigFile] = new services_1.FileMarkersInfo();
                result[tsConfigFile].markerTypes[services_1.MarkerType.TSCONFIG_FAILURE] = false;
                if (!diagnostics || !diagnostics.length) {
                    return;
                }
                var tsConfigFileContent = fs.readFileSync(tsRealConfigFile, "UTF-8");
                var tokens = jju.tokenize(tsConfigFileContent);
                for (var _i = 0, diagnostics_1 = diagnostics; _i < diagnostics_1.length; _i++) {
                    var d = diagnostics_1[_i];
                    if (errorCount++ > 100) {
                        break;
                    }
                    var diag = d;
                    var mesg = diag.messageText;
                    if (usedMessages_1.has(mesg)) {
                        continue;
                    }
                    usedMessages_1.add(mesg);
                    var compilerOption = "";
                    var results = mesg.match(/'(.*?)'/g);
                    if (results && results[0]) {
                        compilerOption = results[0].replace(/^'(--)?|'$/g, "");
                    }
                    var position = 0;
                    var found = false;
                    for (var _b = 0, tokens_1 = tokens; _b < tokens_1.length; _b++) {
                        var tok = tokens_1[_b];
                        if (tok.type === "key" && tok.stack.length === 1 && tok.value === compilerOption) {
                            var tempString = tsConfigFileContent.substring(0, position);
                            var lineNumber = tempString.split("\n").length - 1;
                            var ruleName = tok.value;
                            result[tsConfigFile].markers.push(new services_1.FileMarker(services_1.MarkerType.TSCONFIG_FAILURE, position, position + tok.raw.length, lineNumber, mesg.replace(/-/g, ""), services_1.MarkerPriority.PRIORITY_HIGH, convertSeverity(diag.category)));
                            found = true;
                            break;
                        }
                        position += tok.raw.length;
                    }
                    if (!found) {
                        result[tsConfigFile].markers.push(new services_1.FileMarker(services_1.MarkerType.TSCONFIG_FAILURE, 0, 1, 0, mesg.replace(/-/g, ""), services_1.MarkerPriority.PRIORITY_HIGH, convertSeverity(diag.category)));
                    }
                }
            });
        }
        if (modifiedFiles === null || modifiedFiles === undefined) {
            modifiedFiles = srcFiles;
        }
        modifiedFiles = modifiedFiles.filter(function (file) {
            return file.indexOf("/node_modules/") < 0
                && file.startsWith("eclipse:")
                && !file.endsWith(".d.ts")
                && (file.endsWith(".ts") || file.endsWith(".tsx"));
        });
        var done = 0;
        var todoDescriptors = [
            { text: "FIXME", priority: services_1.MarkerPriority.PRIORITY_HIGH },
            { text: "TODO", priority: services_1.MarkerPriority.PRIORITY_LOW },
            { text: "XXX", priority: services_1.MarkerPriority.PRIORITY_HIGH }
        ];
        for (var _i = 0, modifiedFiles_1 = modifiedFiles; _i < modifiedFiles_1.length; _i++) {
            var file = modifiedFiles_1[_i];
            var fileInfo = result[file] = new services_1.FileMarkersInfo();
            fileInfo.markerTypes[services_1.MarkerType.TYPE_SCRIPT_PROBLEM] = false;
            fileInfo.markerTypes[services_1.MarkerType.TODO] = false;
            var fileErrors = fileInfo.markers;
            if (!sourceFiles.has(file)) {
                continue;
            }
            progress_1.progressMonitor.subTask("validating TypeScript: "
                + file.substring(file.indexOf("/"))
                + " (" + Math.round(done++ * 100 / modifiedFiles.length) + "%)");
            var srcFile = program.getSourceFile(file);
            var diagnostics = program.getSyntacticDiagnostics(srcFile, null);
            if (!diagnostics || diagnostics.length == 0) {
                diagnostics = program.getSemanticDiagnostics(srcFile, null) || [];
                if (program.getCompilerOptions().declaration) {
                    var declarationDiagnostics = program.getDeclarationDiagnostics(srcFile, null);
                    diagnostics = concatenate(diagnostics, declarationDiagnostics);
                }
            }
            for (var _a = 0, diagnostics_2 = diagnostics; _a < diagnostics_2.length; _a++) {
                var diag = diagnostics_2[_a];
                if (errorCount++ > 100) {
                    break;
                }
                fileErrors.push(createMarker(host, srcFile, services_1.MarkerType.TYPE_SCRIPT_PROBLEM, diag));
            }
            var todos = getTodoComments(srcFile, todoDescriptors);
            for (var _b = 0, todos_1 = todos; _b < todos_1.length; _b++) {
                var todo = todos_1[_b];
                fileErrors.push(new services_1.FileMarker(services_1.MarkerType.TODO, todo.position, todo.position + todo.message.length, srcFile.getLineAndCharacterOfPosition(todo.position).line + 1, todo.message, todo.descriptor.priority, services_1.MarkerSeverity.SEVERITY_INFO));
            }
        }
        return Promise.resolve(result);
    };
    return LanguageServiceProvider;
}());
exports.LanguageServiceProvider = LanguageServiceProvider;
function parseConfigFile(host, configFileName) {
    var result = ts.readConfigFile(configFileName, ts.sys.readFile);
    if (!result.config) {
        return [null, [result.error]];
    }
    var configParseResult = ts.parseJsonConfigFileContent(result.config, ts.sys, path.dirname(configFileName));
    if (configParseResult.errors.length > 0) {
        return [null, configParseResult.errors];
    }
    return [configParseResult, null];
}
function concatenate(array1, array2) {
    if (!array2 || !array2.length)
        return array1;
    if (!array1 || !array1.length)
        return array2;
    return array1.concat(array2);
}
function getTodoComments(sourceFile, descriptors) {
    var fileContents = sourceFile.text;
    var result = [];
    if (descriptors.length > 0) {
        var regExp = getTodoCommentsRegExp();
        var matchArray = void 0;
        while (matchArray = regExp.exec(fileContents)) {
            var firstDescriptorCaptureIndex = 3;
            var preamble = matchArray[1];
            var matchPosition = matchArray.index + preamble.length;
            var token = ts.getTokenAtPosition(sourceFile, matchPosition);
            if (!isInsideComment(sourceFile, token, matchPosition)) {
                continue;
            }
            var descriptor = undefined;
            for (var i = 0, n = descriptors.length; i < n; i++) {
                if (matchArray[i + firstDescriptorCaptureIndex]) {
                    descriptor = descriptors[i];
                }
            }
            if (isLetterOrDigit(fileContents.charCodeAt(matchPosition + descriptor.text.length))) {
                continue;
            }
            var message = matchArray[2];
            result.push({
                descriptor: descriptor,
                message: message,
                position: matchPosition
            });
        }
    }
    return result;
    function escapeRegExp(str) {
        return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
    }
    function isInsideComment(sourceFile, token, position) {
        return position <= token.getStart(sourceFile) &&
            (isInsideCommentRange(ts.getTrailingCommentRanges(sourceFile.text, token.getFullStart())) ||
                isInsideCommentRange(ts.getLeadingCommentRanges(sourceFile.text, token.getFullStart())));
        function isInsideCommentRange(comments) {
            return ts.forEach(comments, function (comment) {
                if (comment.pos < position && position < comment.end) {
                    return true;
                }
                else if (position === comment.end) {
                    var text = sourceFile.text;
                    var width = comment.end - comment.pos;
                    if (width <= 2 || text.charCodeAt(comment.pos + 1) === ts.CharacterCodes.slash) {
                        return true;
                    }
                    else {
                        return !(text.charCodeAt(comment.end - 1) === ts.CharacterCodes.slash &&
                            text.charCodeAt(comment.end - 2) === ts.CharacterCodes.asterisk);
                    }
                }
                return false;
            });
        }
    }
    function getTodoCommentsRegExp() {
        var singleLineCommentStart = /(?:\/\/+\s*)/.source;
        var multiLineCommentStart = /(?:\/\*+\s*)/.source;
        var anyNumberOfSpacesAndAsterisksAtStartOfLine = /(?:^(?:\s|\*)*)/.source;
        var preamble = "(" + anyNumberOfSpacesAndAsterisksAtStartOfLine + "|" + singleLineCommentStart + "|" + multiLineCommentStart + ")";
        var literals = "(?:" + ts.map(descriptors, function (d) { return "(" + escapeRegExp(d.text) + ")"; }).join("|") + ")";
        var endOfLineOrEndOfComment = /(?:$|\*\/)/.source;
        var messageRemainder = /(?:.*?)/.source;
        var messagePortion = "(" + literals + messageRemainder + ")";
        var regExpString = preamble + messagePortion + endOfLineOrEndOfComment;
        return new RegExp(regExpString, "gim");
    }
    function isLetterOrDigit(char) {
        var CharacterCodes = ts.CharacterCodes;
        return (char >= CharacterCodes.a && char <= CharacterCodes.z) ||
            (char >= CharacterCodes.A && char <= CharacterCodes.Z) ||
            (char >= CharacterCodes._0 && char <= CharacterCodes._9);
    }
}
function createMarker(host, file, markerType, diag) {
    var start = diag.start;
    var end = diag.start + diag.length;
    if (diag.length === 0) {
        var newPos = services_1.adjustMarkerPos(start, end, (diag.file || file).text);
        start = newPos.start;
        end = newPos.end;
    }
    var quickFixes;
    if (markerType == services_1.MarkerType.TYPE_SCRIPT_PROBLEM) {
        quickFixes = host.getQuickFixes(file, diag);
    }
    return new services_1.FileMarker(markerType, start, end, (diag.file || file).getLineAndCharacterOfPosition(diag.start).line + 1, ts.flattenDiagnosticMessageText(diag.messageText, "\n"), services_1.MarkerPriority.PRIORITY_HIGH, convertSeverity(diag.category), diag.category + ":" + diag.code, quickFixes && quickFixes.length > 0 ? quickFixes : undefined);
}
function convertSeverity(severity) {
    switch (severity) {
        case ts.DiagnosticCategory.Message: return services_1.MarkerSeverity.SEVERITY_INFO;
        case ts.DiagnosticCategory.Warning: return services_1.MarkerSeverity.SEVERITY_WARNING;
        case ts.DiagnosticCategory.Error: return services_1.MarkerSeverity.SEVERITY_ERROR;
    }
    return services_1.MarkerSeverity.SEVERITY_ERROR;
}
