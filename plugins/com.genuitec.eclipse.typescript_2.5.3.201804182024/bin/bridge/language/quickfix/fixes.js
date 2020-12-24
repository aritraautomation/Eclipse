"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var main_1 = require("../../main");
var ts = require("typescript");
var quickFixes_1 = require("../../quickFixes");
var TSQuickFixProvider = (function () {
    function TSQuickFixProvider() {
        this.quickFixes = {};
        if (ts.getSupportedCodeFixes) {
            var dynamicProvider = new TSCodeFixDynamicProvider();
            for (var _i = 0, _a = ts.getSupportedCodeFixes(); _i < _a.length; _i++) {
                var code = _a[_i];
                this.quickFixes[code] = dynamicProvider;
            }
        }
    }
    TSQuickFixProvider.prototype.register = function (code, quickFix) {
        this.quickFixes[code] = quickFix;
    };
    TSQuickFixProvider.prototype.getQuickFixes = function (file, diag) {
        var provider = this.quickFixes[diag.code];
        if (provider) {
            return provider.getQuickFixes(file, diag);
        }
    };
    TSQuickFixProvider.prototype.createDynamicQuickFixes = function (service, request, formattingOptions) {
        patchGetFormattingScanner();
        var type = request.type.split(":", 4);
        if (type.length > 3 && type[0] === "dynamic" && type[1] === "ts") {
            var code = Number.parseInt(type[2]);
            var provider = this.quickFixes[code];
            if (provider && provider.createDynamicQuickFix) {
                return provider.createDynamicQuickFix(service, request, code, ts.toEditorSettings(formattingOptions));
            }
        }
    };
    TSQuickFixProvider.prototype.createQuickFix = function (service, quickFixRequest, formattingOptions) {
        var type = quickFixRequest.type.split(":", 3);
        if (type.length > 2 && type[0] === "ts") {
            var code = Number.parseInt(type[1]);
            var provider = this.quickFixes[code];
            if (provider && provider.createQuickFix) {
                return provider.createQuickFix(service, quickFixRequest, code, ts.toEditorSettings(formattingOptions));
            }
        }
    };
    return TSQuickFixProvider;
}());
exports.ts_priv = ts;
var TSCodeFixDynamicProvider = (function () {
    function TSCodeFixDynamicProvider() {
    }
    TSCodeFixDynamicProvider.prototype.getQuickFixes = function (file, diag) {
        return [new quickFixes_1.QuickFix(undefined, undefined, undefined, "dynamic:ts:" + diag.code + ":ts-codefix", quickFixes_1.QuickFix.REL_HIGHEST)];
    };
    TSCodeFixDynamicProvider.prototype.createDynamicQuickFix = function (service, quickFixRequest, code, formatOptions) {
        var fixes = service.getCodeFixesAtPosition(quickFixRequest.fileName, quickFixRequest.start, quickFixRequest.end, [code], formatOptions);
        fixes.forEach(function (fix) { return fix.changes.forEach(function (ch) {
            if (ch.fileName !== quickFixRequest.fileName) {
                throw new Error("Dynamic fixes are not supported for multiple files");
            }
        }); });
        return fixes.map(function (fix) {
            var changes = fix.changes
                .map(function (change) { return change.textChanges; })
                .reduce(function (res, arr) { return res.concat.apply(res, arr); }, []);
            if (code === 2420) {
                var langEndpoint = main_1.main.getEndpoint("language");
                var projectName = langEndpoint.getProjectName(quickFixRequest.fileName);
                fixQuotes(projectName, changes);
            }
            var formattingChanges = formatTextChanges(service, quickFixRequest.fileName, changes, formatOptions);
            return new quickFixes_1.DynamicQuickFix(fix.description, fix.description, "fix", "no-grouping:ts:" + code, quickFixes_1.QuickFix.REL_HIGHEST, undefined, changes, formattingChanges);
        });
    };
    return TSCodeFixDynamicProvider;
}());
function fixQuotes(projectName, changes) {
    var tslintEndpoint = main_1.main.getEndpoint("tslint");
    var quoteMarks = tslintEndpoint.getQuotemarkCharacters(projectName);
    var correctQuote = quoteMarks[0];
    var wrongQuote = new RegExp(quoteMarks[1], "g");
    changes.forEach(function (change) {
        change.newText = change.newText.replace(wrongQuote, correctQuote);
    });
}
function correctLineEndings(file, changes, formatOptions) {
    var lineStarts = file.getLineStarts();
    var delimiter = "\n";
    if (lineStarts.length > 1) {
        if (file.text.substring(0, lineStarts[1]).endsWith("\r\n")) {
            delimiter = "\r\n";
        }
        else {
            delimiter = "\n";
        }
    }
    else if (formatOptions && formatOptions.newLineCharacter) {
        delimiter = formatOptions.newLineCharacter;
    }
    if (delimiter === "\n") {
        changes.forEach(function (ch) { return ch.newText = ch.newText.replace(/\r\n/g, "\n"); });
    }
    else {
        changes.forEach(function (ch) { return ch.newText = ch.newText.replace(/\r\n/g, "\n").replace(/\n/g, "\r\n"); });
    }
    return changes;
}
function formatTextChanges(service, fileName, changes, formatOptions) {
    if (!changes || changes.length <= 0) {
        return;
    }
    var file = service.getProgram().getSourceFile(fileName);
    correctLineEndings(file, changes, formatOptions);
    var langEndpoint = main_1.main.getEndpoint("language");
    var changeSpan = changes[0].span;
    var oldText = file.text.substr(changeSpan.start, changeSpan.length);
    langEndpoint.editFile(fileName, changeSpan.start, changeSpan.length, changes[0].newText);
    try {
        var info = langEndpoint.getFileInfo(fileName);
        var snapshot = info.getSnapshot();
        var newContents = snapshot.getText(0, snapshot.getLength());
        var formatStart = changeSpan.start;
        var formatEnd = changeSpan.start + changes[0].newText.length;
        while (formatStart > 0 && newContents.charAt(formatStart) !== "\n") {
            formatStart--;
        }
        while (formatEnd < newContents.length && newContents.charAt(formatEnd) !== "\n") {
            formatEnd++;
        }
        return correctLineEndings(file, service.getFormattingEditsForRange(fileName, formatStart, formatEnd, formatOptions), formatOptions);
    }
    finally {
        langEndpoint.editFile(fileName, changeSpan.start, changes[0].newText.length, oldText);
    }
}
exports.tsQuickFixProvider = new TSQuickFixProvider();
var origGetFormattingScanner = undefined;
var curScanner = undefined;
function patchGetFormattingScanner() {
    if (ts.formatting && origGetFormattingScanner == undefined) {
        if (ts.version.startsWith("2.3.")
            || ts.version.startsWith("2.4.")
            || ts.version.startsWith("2.5.")) {
            origGetFormattingScanner = ts.formatting["getFormattingScanner"];
            ts.formatting["getFormattingScanner"] = getFormattingScannerPatched;
        }
        else {
            origGetFormattingScanner = null;
        }
    }
}
function getFormattingScannerPatched() {
    if (curScanner) {
        try {
            curScanner.close();
        }
        catch (e) {
        }
    }
    curScanner = origGetFormattingScanner.apply(this, arguments);
    return {
        advance: curScanner.advance,
        readTokenInfo: curScanner.readTokenInfo,
        isOnToken: curScanner.isOnToken,
        getCurrentLeadingTrivia: curScanner.getCurrentLeadingTrivia,
        lastTrailingTriviaWasNewLine: curScanner.lastTrailingTriviaWasNewLine,
        skipToEndOf: curScanner.skipToEndOf,
        close: function () {
            curScanner.close();
            curScanner = undefined;
        }
    };
}
require("./fixExtendsInterfaceBecomesImplements");
require("./fixClassIncorrectlyImplementsInterface");
