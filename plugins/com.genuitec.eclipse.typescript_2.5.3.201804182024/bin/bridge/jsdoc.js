"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var path = require("path");
var typescript_1 = require("typescript");
var ts = require("typescript");
var changeCase = require("change-case");
var jsDocRequire = require("requizzle")({
    requirePaths: {
        before: [path.join(__dirname, "../node_modules/jsdoc/lib")],
        after: [path.join(__dirname, "../node_modules/jsdoc/node_modules")]
    },
    infect: true
});
var jsdocEnv = jsDocRequire("jsdoc/lib/jsdoc/env");
jsdocEnv.conf = {
    tags: {
        allowUnknownTags: true,
        dictionaries: ["jsdoc"]
    },
    plugins: ["plugins/markdown"]
};
var doclet = jsDocRequire("jsdoc/lib/jsdoc/doclet");
var markdownParser = jsDocRequire("jsdoc/lib/jsdoc/util/markdown").getParser();
var template = jsDocRequire("jsdoc/lib/jsdoc/template");
var defaultTemplate = new template.Template(path.join(__dirname, "../node_modules/jsdoc/templates/default/tmpl"));
function markdown(text, stripPara) {
    var result = markdownParser(text);
    if (stripPara) {
        return result.replace(/\<p\>(.*?)\<\/p\>/gm, "$1");
    }
    return result;
}
function retrieveOriginalComment(location, symbol, typeChecker) {
    var result = "";
    if (location &&
        ((ts.isNameOfFunctionDeclaration(location) && !(symbol.flags & (ts.SymbolFlags["GetAccessor"] + ts.SymbolFlags["SetAccessor"]))) ||
            (location.kind === typescript_1.SyntaxKind["ConstructorKeyword"] && location.parent.kind === typescript_1.SyntaxKind["Constructor"]))) {
        var type = typeChecker.getTypeOfSymbolAtLocation(symbol, location);
        var functionDeclaration = location.parent;
        var allSignatures = functionDeclaration.kind === 150 ? type.getNonNullableType().getConstructSignatures() : type.getNonNullableType().getCallSignatures();
        var signature = void 0;
        if (!typeChecker.isImplementationOfOverload(functionDeclaration)) {
            signature = typeChecker.getSignatureFromDeclaration(functionDeclaration);
        }
        else {
            signature = allSignatures[0];
        }
        processDeclaration(signature.declaration);
        return result;
    }
    else {
        if (symbol.getFlags() & ts.SymbolFlags.Alias) {
            symbol = typeChecker.getAliasedSymbol(symbol);
        }
        if (symbol.declarations && symbol.declarations.length > 0) {
            processDeclaration(symbol.declarations[0]);
        }
    }
    return result;
    function processDeclaration(declaration) {
        var docs;
        if (ts.getJSDocs) {
            docs = ts.getJSDocs(declaration);
        }
        else if (ts.getCommentsFromJSDoc) {
            ts.getCommentsFromJSDoc(declaration);
            docs = declaration.jsDocCache;
        }
        var source = declaration.getSourceFile();
        if (docs && docs.length > 0) {
            var d = docs[0];
            result += source.text.substring(d.pos, d.end);
        }
    }
}
function formatDoc(doc, location, symbol, typeChecker) {
    if (!doc) {
        return undefined;
    }
    var text;
    if (ts.isNameOfFunctionDeclaration
        && (ts.getJSDocs || ts.getCommentsFromJSDoc)
        && symbol && typeChecker) {
        text = retrieveOriginalComment(location, symbol, typeChecker);
    }
    else {
        text = "";
        if (doc.documentation) {
            for (var _i = 0, _a = doc.documentation; _i < _a.length; _i++) {
                var part = _a[_i];
                if (part.kind == "lineBreak") {
                    text += "\n";
                }
                else {
                    text += part.text;
                }
            }
        }
        if (doc.tags) {
            for (var _b = 0, _c = doc.tags; _b < _c.length; _b++) {
                var jsdoc = _c[_b];
                if (!text.endsWith("{")) {
                    text += "\n";
                }
                text += "@" + jsdoc.name;
                if (jsdoc.text) {
                    text += " " + jsdoc.text;
                }
            }
        }
    }
    text = preprocess(text).trim();
    var d = new doclet.Doclet(text, {});
    var template = "";
    if (d.deprecated) {
        template += "<p class=\"description\"><strong>Deprecated.</strong> <em>" + markdown(d.deprecated, true) + "</em></p>";
    }
    var ngModule, whatItDoes, howToUse;
    var tags = [];
    var hide = false;
    if (d.tags) {
        d.tags.forEach(function (t) {
            if (t.originalTitle === "ngModule") {
                ngModule = t;
            }
            else if (t.originalTitle === "whatItDoes") {
                whatItDoes = t;
            }
            else if (t.originalTitle === "howToUse") {
                howToUse = t;
            }
            else if (t.originalTitle === "hide" && t.text === "true") {
                hide = true;
            }
            else {
                tags.push(t);
            }
        });
    }
    if (hide) {
        return null;
    }
    outputTag(ngModule);
    outputTag(whatItDoes);
    outputTag(howToUse);
    if (d.description) {
        template += "<p class=\"description\">" + markdown(d.description) + "</p>";
    }
    if (d.params) {
        template += "<div class=\"params\"><strong>Parameters:</strong><ul>";
        d.params.forEach(function (param) {
            if (param.name && param.description) {
                template += "<li><strong>" + param.name + "</strong> " + markdown(param.description, true);
            }
        });
        template += "</ul></div>";
    }
    if (d.returns) {
        if (d.returns.length == 1) {
            if (d.returns[0].description) {
                template += "<p><strong>Returns:</strong> " + markdown(d.returns[0].description, true) + "</p>";
            }
        }
        else {
            template += "<div class=\"params\"><strong>Returns:</strong><ul>";
            d.params.forEach(function (ret) {
                if (ret.description) {
                    template += "<li>" + markdown(ret.description, true);
                }
            });
            template += "</ul></div>";
        }
    }
    if (tags) {
        tags.forEach(outputTag);
    }
    template = template
        .replace(/🚼/g, "@");
    return template;
    function outputTag(t) {
        if (!t) {
            return;
        }
        var title = changeCase.sentenceCase(t.originalTitle);
        if (Array.isArray(t.text)
            || t.text) {
            title += ":";
        }
        template += "<div class=\"jsdoctag\">\n                <div class=\"jsdoctag-name\">" + title + "</div>\n                <div class=\"jsdoctag-details\">";
        if (Array.isArray(t.text)) {
            template += "<ul>";
            t.text.forEach(function (e) { return template += "<li>" + markdown(t.text) + "</li>"; });
            template += "</ul>";
        }
        else {
            template += "" + markdown(t.text);
        }
        template += "</div><div class=\"clear\"></div>";
    }
}
function formatQuickInfo(doc, location, symbol, typeChecker) {
    if (!doc) {
        return;
    }
    var template = formatDoc(doc, location, symbol, typeChecker) || "";
    return {
        displayParts: doc.displayParts,
        documentation: [{
                kind: "text",
                text: template
            }],
        kind: doc.kind,
        kindModifiers: doc.kindModifiers,
        tags: [],
        textSpan: doc.textSpan
    };
}
exports.formatQuickInfo = formatQuickInfo;
function formatCompletionEntryDetails(doc, location, symbol, typeChecker) {
    if (!doc) {
        return;
    }
    var template = formatDoc(doc, location, symbol, typeChecker) || "";
    return {
        displayParts: doc.displayParts,
        documentation: [{
                kind: "text",
                text: template
            }],
        kind: doc.kind,
        kindModifiers: doc.kindModifiers,
        name: doc.name,
        tags: []
    };
}
exports.formatCompletionEntryDetails = formatCompletionEntryDetails;
function preprocess(text) {
    var start = -1;
    var last = 0;
    var res = "";
    while ((start = text.indexOf("`", last)) >= 0) {
        var tripleQuote = text.substr(start, 3) === "```";
        var end = text.indexOf(tripleQuote ? "```" : "`", start + 3);
        if (end > 0) {
            res += processNonCode(text.substring(last, start));
            res += text.substring(start, end + (tripleQuote ? 3 : 1))
                .replace("@", "🚼");
            last = end + (tripleQuote ? 3 : 1);
        }
        else {
            break;
        }
    }
    res += processNonCode(text.substr(last));
    return res;
    function processNonCode(text) {
        return text
            .replace(/</g, "&lt;")
            .replace(/\{([a-zA-Z_$]+)\}/g, "`$1`");
    }
}
