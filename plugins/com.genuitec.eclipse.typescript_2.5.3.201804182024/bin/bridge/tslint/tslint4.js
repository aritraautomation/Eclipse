"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var TSLint4 = (function () {
    function TSLint4(tslint_, isEmbedded, languageService) {
        this.tslint_ = tslint_;
        this.isEmbedded = isEmbedded;
        this.languageService = languageService;
        this.Linter = tslint_.Linter;
    }
    TSLint4.prototype.lint = function (file, configFile, program) {
        var linter = new this.Linter({ fix: false });
        linter.program = program;
        linter.languageService = this.languageService;
        linter.lint(file.fileName, file.text, configFile);
        return linter.getResult();
    };
    TSLint4.prototype.loadConfigFile = function (fsName) {
        return this.Linter.loadConfigurationFromPath(fsName);
    };
    TSLint4.prototype.findRule = function (name, rulesDirectories) {
        return this.tslint_.findRule(name, rulesDirectories);
    };
    TSLint4.prototype.version = function () {
        return this.Linter.VERSION;
    };
    TSLint4.prototype.name = function () {
        return (this.isEmbedded ? "embedded" : "project's") + " TSLint " + this.Linter.VERSION;
    };
    return TSLint4;
}());
exports.TSLint4 = TSLint4;
