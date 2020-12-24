"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var ts = require("typescript");
var typescript_1 = require("typescript");
exports.getMeaningFromLocation = ts.getMeaningFromLocation
    || function (node) {
        if (node.parent.kind === typescript_1.SyntaxKind.ExportAssignment) {
            return 1 | 2 | 4;
        }
        else if (isInRightSideOfImport(node)) {
            return getMeaningFromRightHandSideOfImportEquals(node);
        }
        else if (ts.isDeclarationName(node)) {
            return exports.getMeaningFromDeclaration(node.parent);
        }
        else if (isTypeReference(node)) {
            return 2;
        }
        else if (isNamespaceReference(node)) {
            return 4;
        }
        else {
            return 1;
        }
    };
exports.getMeaningFromDeclaration = ts.getMeaningFromDeclaration
    || function (node) {
        switch (node.kind) {
            case typescript_1.SyntaxKind.Parameter:
            case typescript_1.SyntaxKind.VariableDeclaration:
            case typescript_1.SyntaxKind.BindingElement:
            case typescript_1.SyntaxKind.PropertyDeclaration:
            case typescript_1.SyntaxKind.PropertySignature:
            case typescript_1.SyntaxKind.PropertyAssignment:
            case typescript_1.SyntaxKind.ShorthandPropertyAssignment:
            case typescript_1.SyntaxKind.EnumMember:
            case typescript_1.SyntaxKind.MethodDeclaration:
            case typescript_1.SyntaxKind.MethodSignature:
            case typescript_1.SyntaxKind.Constructor:
            case typescript_1.SyntaxKind.GetAccessor:
            case typescript_1.SyntaxKind.SetAccessor:
            case typescript_1.SyntaxKind.FunctionDeclaration:
            case typescript_1.SyntaxKind.FunctionExpression:
            case typescript_1.SyntaxKind.ArrowFunction:
            case typescript_1.SyntaxKind.CatchClause:
                return 1;
            case typescript_1.SyntaxKind.TypeParameter:
            case typescript_1.SyntaxKind.InterfaceDeclaration:
            case typescript_1.SyntaxKind.TypeAliasDeclaration:
            case typescript_1.SyntaxKind.TypeLiteral:
                return 2;
            case typescript_1.SyntaxKind.ClassDeclaration:
            case typescript_1.SyntaxKind.EnumDeclaration:
                return 1 | 2;
            case typescript_1.SyntaxKind.ModuleDeclaration:
                if (ts.isAmbientModule(node)) {
                    return 4 | 1;
                }
                else if (ts.getModuleInstanceState(node) === 1) {
                    return 4 | 1;
                }
                else {
                    return 4;
                }
            case typescript_1.SyntaxKind.NamedImports:
            case typescript_1.SyntaxKind.ImportSpecifier:
            case typescript_1.SyntaxKind.ImportEqualsDeclaration:
            case typescript_1.SyntaxKind.ImportDeclaration:
            case typescript_1.SyntaxKind.ExportAssignment:
            case typescript_1.SyntaxKind.ExportDeclaration:
                return 1 | 2 | 4;
            case typescript_1.SyntaxKind.SourceFile:
                return 4 | 1;
        }
        return 1 | 2 | 4;
    };
function isInRightSideOfImport(node) {
    while (node.parent.kind === typescript_1.SyntaxKind.QualifiedName) {
        node = node.parent;
    }
    return isInternalModuleImportEqualsDeclaration(node.parent) && (node.parent).moduleReference === node;
}
function isInternalModuleImportEqualsDeclaration(node) {
    return node.kind === typescript_1.SyntaxKind.ImportEqualsDeclaration && node.moduleReference.kind !== typescript_1.SyntaxKind.ExternalModuleReference;
}
function getMeaningFromRightHandSideOfImportEquals(node) {
    if (node.parent.kind === typescript_1.SyntaxKind.QualifiedName &&
        (node.parent).right === node &&
        node.parent.parent.kind === typescript_1.SyntaxKind.ImportEqualsDeclaration) {
        return 1 | 2 | 4;
    }
    return 4;
}
function isTypeReference(node) {
    if (ts.isRightSideOfQualifiedNameOrPropertyAccess(node)) {
        node = node.parent;
    }
    return node.parent.kind === typescript_1.SyntaxKind.TypeReference ||
        (node.parent.kind === typescript_1.SyntaxKind.ExpressionWithTypeArguments && !ts.isExpressionWithTypeArgumentsInClassExtendsClause(node.parent)) ||
        (node.kind === typescript_1.SyntaxKind.ThisKeyword && !isPartOfExpression(node)) ||
        node.kind === typescript_1.SyntaxKind.ThisType;
}
function isNamespaceReference(node) {
    return isQualifiedNameNamespaceReference(node) || isPropertyAccessNamespaceReference(node);
}
function isQualifiedNameNamespaceReference(node) {
    var root = node;
    var isLastClause = true;
    if (root.parent.kind === typescript_1.SyntaxKind.QualifiedName) {
        while (root.parent && root.parent.kind === typescript_1.SyntaxKind.QualifiedName) {
            root = root.parent;
        }
        isLastClause = (root).right === node;
    }
    return root.parent.kind === typescript_1.SyntaxKind.TypeReference && !isLastClause;
}
function isPropertyAccessNamespaceReference(node) {
    var root = node;
    var isLastClause = true;
    if (root.parent.kind === typescript_1.SyntaxKind.PropertyAccessExpression) {
        while (root.parent && root.parent.kind === typescript_1.SyntaxKind.PropertyAccessExpression) {
            root = root.parent;
        }
        isLastClause = (root).name === node;
    }
    if (!isLastClause && root.parent.kind === typescript_1.SyntaxKind.ExpressionWithTypeArguments && root.parent.parent.kind === typescript_1.SyntaxKind.HeritageClause) {
        var decl = root.parent.parent.parent;
        return (decl.kind === typescript_1.SyntaxKind.ClassDeclaration && (root.parent.parent).token === typescript_1.SyntaxKind.ImplementsKeyword) ||
            (decl.kind === typescript_1.SyntaxKind.InterfaceDeclaration && (root.parent.parent).token === typescript_1.SyntaxKind.ExtendsKeyword);
    }
    return false;
}
function isPartOfExpression(node) {
    switch (node.kind) {
        case typescript_1.SyntaxKind.ThisKeyword:
        case typescript_1.SyntaxKind.SuperKeyword:
        case typescript_1.SyntaxKind.NullKeyword:
        case typescript_1.SyntaxKind.TrueKeyword:
        case typescript_1.SyntaxKind.FalseKeyword:
        case typescript_1.SyntaxKind.RegularExpressionLiteral:
        case typescript_1.SyntaxKind.ArrayLiteralExpression:
        case typescript_1.SyntaxKind.ObjectLiteralExpression:
        case typescript_1.SyntaxKind.PropertyAccessExpression:
        case typescript_1.SyntaxKind.ElementAccessExpression:
        case typescript_1.SyntaxKind.CallExpression:
        case typescript_1.SyntaxKind.NewExpression:
        case typescript_1.SyntaxKind.TaggedTemplateExpression:
        case typescript_1.SyntaxKind.AsExpression:
        case typescript_1.SyntaxKind.TypeAssertionExpression:
        case typescript_1.SyntaxKind.NonNullExpression:
        case typescript_1.SyntaxKind.ParenthesizedExpression:
        case typescript_1.SyntaxKind.FunctionExpression:
        case typescript_1.SyntaxKind.ClassExpression:
        case typescript_1.SyntaxKind.ArrowFunction:
        case typescript_1.SyntaxKind.VoidExpression:
        case typescript_1.SyntaxKind.DeleteExpression:
        case typescript_1.SyntaxKind.TypeOfExpression:
        case typescript_1.SyntaxKind.PrefixUnaryExpression:
        case typescript_1.SyntaxKind.PostfixUnaryExpression:
        case typescript_1.SyntaxKind.BinaryExpression:
        case typescript_1.SyntaxKind.ConditionalExpression:
        case typescript_1.SyntaxKind.TemplateExpression:
        case typescript_1.SyntaxKind.NoSubstitutionTemplateLiteral:
        case typescript_1.SyntaxKind.OmittedExpression:
        case typescript_1.SyntaxKind.JsxElement:
        case typescript_1.SyntaxKind.JsxSelfClosingElement:
        case typescript_1.SyntaxKind.YieldExpression:
        case typescript_1.SyntaxKind.AwaitExpression:
            return true;
        case typescript_1.SyntaxKind.QualifiedName:
            while (node.parent.kind === typescript_1.SyntaxKind.QualifiedName) {
                node = node.parent;
            }
            return node.parent.kind === typescript_1.SyntaxKind.TypeQuery || ts.isJSXTagName(node);
        case typescript_1.SyntaxKind.Identifier:
            if (node.parent.kind === typescript_1.SyntaxKind.TypeQuery || ts.isJSXTagName(node)) {
                return true;
            }
        case typescript_1.SyntaxKind.NumericLiteral:
        case typescript_1.SyntaxKind.StringLiteral:
        case typescript_1.SyntaxKind.ThisKeyword:
            var parent_1 = node.parent;
            switch (parent_1.kind) {
                case typescript_1.SyntaxKind.VariableDeclaration:
                case typescript_1.SyntaxKind.Parameter:
                case typescript_1.SyntaxKind.PropertyDeclaration:
                case typescript_1.SyntaxKind.PropertySignature:
                case typescript_1.SyntaxKind.EnumMember:
                case typescript_1.SyntaxKind.PropertyAssignment:
                case typescript_1.SyntaxKind.BindingElement:
                    return (parent_1).initializer === node;
                case typescript_1.SyntaxKind.ExpressionStatement:
                case typescript_1.SyntaxKind.IfStatement:
                case typescript_1.SyntaxKind.DoStatement:
                case typescript_1.SyntaxKind.WhileStatement:
                case typescript_1.SyntaxKind.ReturnStatement:
                case typescript_1.SyntaxKind.WithStatement:
                case typescript_1.SyntaxKind.SwitchStatement:
                case typescript_1.SyntaxKind.CaseClause:
                case typescript_1.SyntaxKind.ThrowStatement:
                case typescript_1.SyntaxKind.SwitchStatement:
                    return (parent_1).expression === node;
                case typescript_1.SyntaxKind.ForStatement:
                    var forStatement = parent_1;
                    return (forStatement.initializer === node && forStatement.initializer.kind !== typescript_1.SyntaxKind.VariableDeclarationList) ||
                        forStatement.condition === node ||
                        forStatement.incrementor === node;
                case typescript_1.SyntaxKind.ForInStatement:
                case typescript_1.SyntaxKind.ForOfStatement:
                    var forInStatement = parent_1;
                    return (forInStatement.initializer === node && forInStatement.initializer.kind !== typescript_1.SyntaxKind.VariableDeclarationList) ||
                        forInStatement.expression === node;
                case typescript_1.SyntaxKind.TypeAssertionExpression:
                case typescript_1.SyntaxKind.AsExpression:
                    return node === (parent_1).expression;
                case typescript_1.SyntaxKind.TemplateSpan:
                    return node === (parent_1).expression;
                case typescript_1.SyntaxKind.ComputedPropertyName:
                    return node === (parent_1).expression;
                case typescript_1.SyntaxKind.Decorator:
                case typescript_1.SyntaxKind.JsxExpression:
                case typescript_1.SyntaxKind.JsxSpreadAttribute:
                    return true;
                case typescript_1.SyntaxKind.ExpressionWithTypeArguments:
                    return (parent_1).expression === node && ts.isExpressionWithTypeArgumentsInClassExtendsClause(parent_1);
                default:
                    if (isPartOfExpression(parent_1)) {
                        return true;
                    }
            }
    }
    return false;
}
function getThisMemberSymbolKind(typeChecker, symbol, location) {
    if (ts.SymbolDisplay && ts.SymbolDisplay.getSymbolKind) {
        return ts.SymbolDisplay.getSymbolKind(typeChecker, symbol, location);
    }
    var flags = symbol.getFlags();
    if (flags & typescript_1.SymbolFlags.Class)
        return ts.getDeclarationOfKind(symbol, typescript_1.SyntaxKind.ClassExpression) ?
            typescript_1.ScriptElementKind.localClassElement : typescript_1.ScriptElementKind.classElement;
    if (flags & typescript_1.SymbolFlags.Enum)
        return typescript_1.ScriptElementKind.enumElement;
    if (flags & typescript_1.SymbolFlags.TypeAlias)
        return typescript_1.ScriptElementKind.typeElement;
    if (flags & typescript_1.SymbolFlags.Interface)
        return typescript_1.ScriptElementKind.interfaceElement;
    if (flags & typescript_1.SymbolFlags.TypeParameter)
        return typescript_1.ScriptElementKind.typeParameterElement;
    var result = getSymbolKindOfConstructorPropertyMethodAccessorFunctionOrVar(typeChecker, symbol, flags);
    if (result === typescript_1.ScriptElementKind.unknown) {
        if (flags & typescript_1.SymbolFlags.TypeParameter)
            return typescript_1.ScriptElementKind.typeParameterElement;
        if (flags & typescript_1.SymbolFlags.EnumMember)
            return typescript_1.ScriptElementKind.variableElement;
        if (flags & typescript_1.SymbolFlags.Alias)
            return typescript_1.ScriptElementKind.alias;
        if (flags & typescript_1.SymbolFlags.Module)
            return typescript_1.ScriptElementKind.moduleElement;
    }
    return result;
}
exports.getThisMemberSymbolKind = getThisMemberSymbolKind;
function getSymbolKindOfConstructorPropertyMethodAccessorFunctionOrVar(typeChecker, symbol, flags) {
    if (typeChecker.isUndefinedSymbol(symbol)) {
        return typescript_1.ScriptElementKind.variableElement;
    }
    if (typeChecker.isArgumentsSymbol(symbol)) {
        return typescript_1.ScriptElementKind.localVariableElement;
    }
    if (flags & typescript_1.SymbolFlags.GetAccessor)
        return typescript_1.ScriptElementKind.memberGetAccessorElement;
    if (flags & typescript_1.SymbolFlags.SetAccessor)
        return typescript_1.ScriptElementKind.memberSetAccessorElement;
    if (flags & typescript_1.SymbolFlags.Method)
        return typescript_1.ScriptElementKind.memberFunctionElement;
    if (flags & typescript_1.SymbolFlags.Constructor)
        return typescript_1.ScriptElementKind.constructorImplementationElement;
    if (flags & typescript_1.SymbolFlags.Property) {
        if (flags & typescript_1.SymbolFlags["SyntheticProperty"]) {
            var unionPropertyKind = ts.forEach(typeChecker.getRootSymbols(symbol), function (rootSymbol) {
                var rootSymbolFlags = rootSymbol.getFlags();
                if (rootSymbolFlags & (typescript_1.SymbolFlags.PropertyOrAccessor | typescript_1.SymbolFlags.Variable)) {
                    return typescript_1.ScriptElementKind.memberVariableElement;
                }
            });
            if (!unionPropertyKind) {
                return typescript_1.ScriptElementKind.memberVariableElement;
            }
            return unionPropertyKind;
        }
        return typescript_1.ScriptElementKind.memberVariableElement;
    }
    return typescript_1.ScriptElementKind.unknown;
}
