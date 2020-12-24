"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var tsShim_1 = require("./tsShim");
var ts = require("typescript");
var CompletionRelevance;
(function (CompletionRelevance) {
    CompletionRelevance[CompletionRelevance["TOP"] = 0] = "TOP";
    CompletionRelevance[CompletionRelevance["LOCAL_SYMBOLS"] = 10] = "LOCAL_SYMBOLS";
    CompletionRelevance[CompletionRelevance["LOCAL_THIS_SYMBOLS"] = 20] = "LOCAL_THIS_SYMBOLS";
    CompletionRelevance[CompletionRelevance["FILE_LOCAL_SYMBOLS"] = 30] = "FILE_LOCAL_SYMBOLS";
    CompletionRelevance[CompletionRelevance["IMPORTED_SYMBOLS"] = 40] = "IMPORTED_SYMBOLS";
    CompletionRelevance[CompletionRelevance["KEYWORDS"] = 50] = "KEYWORDS";
    CompletionRelevance[CompletionRelevance["GLOBAL_SYMBOLS"] = 60] = "GLOBAL_SYMBOLS";
    CompletionRelevance[CompletionRelevance["OTHERS"] = 70] = "OTHERS";
})(CompletionRelevance = exports.CompletionRelevance || (exports.CompletionRelevance = {}));
var CompletionsManager = (function () {
    function CompletionsManager(host) {
        this.host = host;
    }
    CompletionsManager.prototype.processCompletions = function (completions, program, sourceFile, position) {
        var localSymbols;
        var localNames = new Set();
        var thisType;
        if (completions.isMemberCompletion) {
            localSymbols = [];
        }
        else {
            getLocalSymbols();
            for (var _i = 0, localSymbols_1 = localSymbols; _i < localSymbols_1.length; _i++) {
                var symbol = localSymbols_1[_i];
                var include = false;
                if (symbol.declarations) {
                    for (var _a = 0, _b = symbol.declarations; _a < _b.length; _a++) {
                        var decl = _b[_a];
                        if (decl.getSourceFile() === sourceFile) {
                            include = true;
                            break;
                        }
                    }
                }
                if (include) {
                    localNames.add(symbol.name);
                }
            }
            if (thisType) {
                addCompletionsForThis();
            }
        }
        for (var _c = 0, _d = completions.entries; _c < _d.length; _c++) {
            var compl = _d[_c];
            if (compl.sortText && (compl.sortText === compl.name || compl.sortText === "0")) {
                compl.sortText = undefined;
            }
            if (!compl.relevance) {
                switch (compl.kind) {
                    case ts.ScriptElementKind.parameterElement:
                    case ts.ScriptElementKind.typeParameterElement:
                    case ts.ScriptElementKind.localClassElement:
                    case ts.ScriptElementKind.localVariableElement:
                        compl.relevance = CompletionRelevance.LOCAL_SYMBOLS;
                        break;
                    case ts.ScriptElementKind.memberGetAccessorElement:
                    case ts.ScriptElementKind.memberSetAccessorElement:
                    case ts.ScriptElementKind.memberVariableElement:
                    case ts.ScriptElementKind.enumMemberElement:
                        compl.relevance = CompletionRelevance.LOCAL_SYMBOLS + 1;
                        break;
                    case ts.ScriptElementKind.memberFunctionElement:
                    case ts.ScriptElementKind.constructorImplementationElement:
                    case ts.ScriptElementKind.localFunctionElement:
                    case ts.ScriptElementKind.localClassElement:
                    case ts.ScriptElementKind.label:
                        compl.relevance = CompletionRelevance.LOCAL_SYMBOLS + 2;
                        break;
                    case ts.ScriptElementKind.keyword:
                        if (compl.name in ["string", "number", "boolean", "any", "void", "never"]) {
                            compl.kind = ts.ScriptElementKind.primitiveType;
                        }
                        else {
                            compl.relevance = CompletionRelevance.KEYWORDS + 1;
                            break;
                        }
                    case ts.ScriptElementKind.primitiveType:
                        compl.relevance = CompletionRelevance.KEYWORDS;
                        break;
                    case ts.ScriptElementKind.alias:
                    case ts.ScriptElementKind.externalModuleName:
                        compl.relevance = CompletionRelevance.IMPORTED_SYMBOLS;
                        break;
                    case ts.ScriptElementKind.variableElement:
                    case ts.ScriptElementKind.letElement:
                    case ts.ScriptElementKind.constElement:
                        if (localNames.has(compl.name)) {
                            compl.relevance = CompletionRelevance.FILE_LOCAL_SYMBOLS;
                        }
                        else {
                            compl.relevance = CompletionRelevance.GLOBAL_SYMBOLS;
                        }
                        break;
                    case ts.ScriptElementKind.functionElement:
                        if (localNames.has(compl.name)) {
                            compl.relevance = CompletionRelevance.FILE_LOCAL_SYMBOLS + 1;
                        }
                        else {
                            compl.relevance = CompletionRelevance.GLOBAL_SYMBOLS + 1;
                        }
                        break;
                    case ts.ScriptElementKind.classElement:
                    case ts.ScriptElementKind.interfaceElement:
                    case ts.ScriptElementKind.typeElement:
                    case ts.ScriptElementKind.enumElement:
                        if (localNames.has(compl.name)) {
                            compl.relevance = CompletionRelevance.FILE_LOCAL_SYMBOLS + 5;
                        }
                        else {
                            compl.relevance = CompletionRelevance.GLOBAL_SYMBOLS + 5;
                        }
                        break;
                    default:
                        compl.relevance = CompletionRelevance.OTHERS;
                }
            }
        }
        function getLocalSymbols() {
            var previousToken = ts.findPrecedingToken(position, sourceFile);
            var contextToken = previousToken;
            if (contextToken && position <= contextToken.end && ts.isWord(contextToken.kind)) {
                contextToken = ts.findPrecedingToken(contextToken.getFullStart(), sourceFile);
            }
            var adjustedPosition = previousToken !== contextToken ?
                previousToken.getStart() :
                position;
            var scopeNode = getScopeNode(contextToken, adjustedPosition) || sourceFile;
            var symbolMeanings = ts.SymbolFlags.Type | ts.SymbolFlags.Value | ts.SymbolFlags.Namespace | ts.SymbolFlags.Alias;
            localSymbols = program.getTypeChecker().getSymbolsInScope(scopeNode, symbolMeanings);
            if (contextToken) {
                thisType = getThisType(contextToken);
            }
        }
        function getScopeNode(initialToken, position) {
            var scope = initialToken;
            while (scope && !ts.positionBelongsToNode(scope, position, sourceFile)) {
                scope = scope.parent;
            }
            return scope;
        }
        function getThisType(node) {
            var container = ts.getThisContainer(node, false);
            var parent = container && container.parent;
            if (parent && (ts.isClassLike(parent) || parent.kind === ts.SyntaxKind.InterfaceDeclaration)) {
                if (container.modifiers) {
                    for (var _i = 0, _a = container.modifiers; _i < _a.length; _i++) {
                        var modifier = _a[_i];
                        if (modifier.kind === ts.SyntaxKind.StaticKeyword) {
                            return undefined;
                        }
                    }
                }
                if ((container.kind !== ts.SyntaxKind.Constructor ||
                    (ts.isNodeDescendantOf &&
                        ts.isNodeDescendantOf(node, container.body)))) {
                    var type = program.getTypeChecker().getTypeAtLocation(parent);
                    if (type["thisType"]) {
                        return type["thisType"];
                    }
                }
            }
            return undefined;
        }
        function addCompletionsForThis() {
            var typeChecker = program.getTypeChecker();
            var completionEntries = completions.entries;
            var node = ts.getTokenAtPosition(sourceFile, position);
            for (var _i = 0, _a = thisType.getApparentProperties(); _i < _a.length; _i++) {
                var symbol = _a[_i];
                var name_1 = ts.getDeclaredName(typeChecker, symbol, node);
                if (name_1) {
                    var kind = tsShim_1.getThisMemberSymbolKind(typeChecker, symbol, node);
                    var relevance = CompletionRelevance.LOCAL_THIS_SYMBOLS;
                    if (kind === ts.ScriptElementKind.memberFunctionElement) {
                        relevance++;
                    }
                    completionEntries.push({
                        name: "this." + name_1,
                        relevance: relevance,
                        sortText: name_1,
                        kind: kind,
                        kindModifiers: ""
                    });
                }
            }
        }
    };
    return CompletionsManager;
}());
exports.CompletionsManager = CompletionsManager;
