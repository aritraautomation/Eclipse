"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var ts = require("typescript");
var quickFixes_1 = require("../../quickFixes");
var fixes_1 = require("./fixes");
var typescript_1 = require("typescript");
var FixCannotExtendAnInterface = (function () {
    function FixCannotExtendAnInterface() {
    }
    FixCannotExtendAnInterface.prototype.getQuickFixes = function (file, diag) {
        var message = ts.flattenDiagnosticMessageText(diag.messageText, "\n");
        var intfName = /Cannot extend an interface '(.*?)'\..*/.exec(message);
        if (intfName && intfName[1]) {
            return [new quickFixes_1.QuickFix("Change to implement the interface instead.", "Change to implement the interface instead.", "fix", "ts:" + diag.code + ":change-extends-to-implements", quickFixes_1.QuickFix.REL_HIGHEST)];
        }
    };
    FixCannotExtendAnInterface.prototype.createQuickFix = function (service, request) {
        var program = service.getProgram();
        var sourceFile = program.getSourceFile(request.fileName);
        var token = fixes_1.ts_priv.getTokenAtPosition(sourceFile, request.start);
        var classDeclNode = fixes_1.ts_priv.getContainingClass(token);
        if (!(token.kind === typescript_1.SyntaxKind["Identifier"] && fixes_1.ts_priv.isClassLike(classDeclNode))) {
            return undefined;
        }
        var heritageClauses = classDeclNode.heritageClauses;
        if (!(heritageClauses && heritageClauses.length > 0)) {
            return undefined;
        }
        var extendsToken = heritageClauses[0].getFirstToken();
        if (!(extendsToken && extendsToken.kind === typescript_1.SyntaxKind.ExtendsKeyword)) {
            return undefined;
        }
        var changeStart = extendsToken.getStart(sourceFile);
        var changeEnd = extendsToken.getEnd();
        if (sourceFile.text.charAt(changeStart - 1) === " ") {
            changeStart--;
        }
        var textChanges = [{ newText: " implements", span: { start: changeStart, length: changeEnd - changeStart } }];
        for (var i = 1; i < heritageClauses.length; i++) {
            var keywordToken = heritageClauses[i].getFirstToken();
            if (keywordToken) {
                changeStart = keywordToken.getStart(sourceFile);
                changeEnd = keywordToken.getEnd();
                if (sourceFile.text.charAt(changeStart - 1) === " ") {
                    changeStart--;
                }
                textChanges.push({ newText: ",", span: { start: changeStart, length: changeEnd - changeStart } });
            }
        }
        var result = {};
        result[sourceFile.fileName] = textChanges;
        return result;
    };
    return FixCannotExtendAnInterface;
}());
fixes_1.tsQuickFixProvider.register(2689, new FixCannotExtendAnInterface());
