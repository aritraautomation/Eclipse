"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var ts = require("typescript");
var quickFixes_1 = require("../../quickFixes");
var fixes_1 = require("./fixes");
var typescript_1 = require("typescript");
var FixClassIncorrectlyImplementsInterface = (function () {
    function FixClassIncorrectlyImplementsInterface() {
    }
    FixClassIncorrectlyImplementsInterface.prototype.getQuickFixes = function (file, diag) {
        var message = ts.flattenDiagnosticMessageText(diag.messageText, "\n");
        var intfName = /Class '.*?' incorrectly implements interface '(.*?)'\..*/.exec(message);
        if (intfName && intfName[1]) {
            return [new quickFixes_1.QuickFix("Add unimplemented members.", "Add unimplemented members", "fix", "ts:" + diag.code + ":add-unimplemented-members%" + intfName[1], quickFixes_1.QuickFix.REL_HIGHEST)];
        }
    };
    FixClassIncorrectlyImplementsInterface.prototype.createQuickFix = function (service, request, code, formattingOptions) {
        var program = service.getProgram();
        var sourceFile = program.getSourceFile(request.fileName);
        var start = request.start;
        var token = fixes_1.ts_priv.getTokenAtPosition(sourceFile, start);
        var checker = program.getTypeChecker();
        var classDecl = fixes_1.ts_priv.getContainingClass(token);
        if (!classDecl) {
            return undefined;
        }
        var startPos = classDecl.members.end;
        var classType = checker.getTypeAtLocation(classDecl);
        var implementedTypeNodes = fixes_1.ts_priv.getClassImplementsHeritageClauseElements(classDecl);
        var hasNumericIndexSignature = !!checker.getIndexTypeOfType(classType, typescript_1.IndexKind["Number"]);
        var hasStringIndexSignature = !!checker.getIndexTypeOfType(classType, typescript_1.IndexKind["String"]);
        var res = {};
        var result = res[request.fileName] = [];
        for (var _i = 0, implementedTypeNodes_1 = implementedTypeNodes; _i < implementedTypeNodes_1.length; _i++) {
            var implementedTypeNode = implementedTypeNodes_1[_i];
            if (!request.type.endsWith("%" + implementedTypeNode.getText())) {
                continue;
            }
            var implementedType = checker.getTypeFromTypeNode(implementedTypeNode);
            var implementedTypeSymbols = checker.getPropertiesOfType(implementedType);
            var nonPrivateMembers = implementedTypeSymbols.filter(function (symbol) { return !(fixes_1.ts_priv.getModifierFlags(symbol.valueDeclaration) & typescript_1.ModifierFlags["Private"]); });
            var insertion = getMissingIndexSignatureInsertion(implementedType, typescript_1.IndexKind.Number, classDecl, hasNumericIndexSignature);
            insertion += getMissingIndexSignatureInsertion(implementedType, typescript_1.IndexKind.String, classDecl, hasStringIndexSignature);
            insertion += fixes_1.ts_priv.codefix.getMissingMembersInsertion(classDecl, nonPrivateMembers, checker, formattingOptions.newLineCharacter);
            var indent = "";
            for (var i = 0; i < formattingOptions.indentSize; i++) {
                indent += " ";
            }
            if (!formattingOptions.convertTabsToSpaces) {
                var tabSize = "";
                for (var i = 0; i < formattingOptions.tabSize; i++) {
                    tabSize += " ";
                }
                indent = indent.replace(new RegExp(tabSize, "g"), "\t");
            }
            var newLine = formattingOptions.newLineCharacter;
            if (insertion) {
                pushAction(result, newLine + indent + insertion
                    .replace(/throw new Error\(\'.*?\'\);/g, indent + "// TODO Auto-generated method stub" + newLine + indent + "return;")
                    .replace(/\n/g, "\n" + indent));
            }
        }
        return res;
        function getMissingIndexSignatureInsertion(type, kind, enclosingDeclaration, hasIndexSigOfKind) {
            if (!hasIndexSigOfKind) {
                var IndexInfoOfKind = checker.getIndexInfoOfType(type, kind);
                if (IndexInfoOfKind) {
                    var writer = fixes_1.ts_priv.getSingleLineStringWriter();
                    checker.getSymbolDisplayBuilder().buildIndexSignatureDisplay(IndexInfoOfKind, writer, kind, enclosingDeclaration);
                    var result_1 = writer.string();
                    fixes_1.ts_priv.releaseStringWriter(writer);
                    return result_1;
                }
            }
            return "";
        }
        function pushAction(result, insertion) {
            result.push({
                span: { start: startPos, length: 0 },
                newText: insertion
            });
        }
    };
    return FixClassIncorrectlyImplementsInterface;
}());
if (ts.version.startsWith("2.2.")) {
    fixes_1.tsQuickFixProvider.register(2420, new FixClassIncorrectlyImplementsInterface());
}
