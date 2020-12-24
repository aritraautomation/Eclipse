"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var TSLint5 = (function () {
    function TSLint5(tslint_, isEmbedded, languageService) {
        this.tslint_ = tslint_;
        this.isEmbedded = isEmbedded;
        this.languageService = languageService;
        this.Linter = tslint_.Linter;
    }
    TSLint5.prototype.lint = function (file, configFile, program) {
        var linter = new this.Linter({ fix: false });
        linter.program = program;
        linter.languageService = this.languageService;
        linter.lint(file.fileName, file.text, configFile);
        return linter.getResult();
    };
    TSLint5.prototype.loadConfigFile = function (fsName) {
        return this.Linter.loadConfigurationFromPath(fsName);
    };
    TSLint5.prototype.findRule = function (name, rulesDirectories, ruleOptions) {
        var Rule = this.tslint_.findRule(name, rulesDirectories);
        if (Rule) {
            new Rule(ruleOptions);
        }
        return Rule;
    };
    TSLint5.prototype.version = function () {
        return this.Linter.VERSION;
    };
    TSLint5.prototype.name = function () {
        return (this.isEmbedded ? "embedded" : "project's") + " TSLint " + this.Linter.VERSION;
    };
    return TSLint5;
}());
exports.TSLint5 = TSLint5;
