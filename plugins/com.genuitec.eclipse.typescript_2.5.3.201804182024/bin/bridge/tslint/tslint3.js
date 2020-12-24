"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var path_1 = require("path");
var TSLint3 = (function () {
    function TSLint3(Linter, isEmbedded, modulePath) {
        this.Linter = Linter;
        this.isEmbedded = isEmbedded;
        this.modulePath = modulePath;
        this.findRule = require(path_1.posix.join(modulePath, "lib/ruleLoader")).findRule;
    }
    TSLint3.prototype.lint = function (file, configFile, program) {
        var linter = new this.Linter(file.fileName, file.text, {
            configuration: configFile,
            formatter: "json"
        }, program);
        return linter.lint();
    };
    TSLint3.prototype.loadConfigFile = function (fsName) {
        return this.Linter.loadConfigurationFromPath(fsName);
    };
    TSLint3.prototype.version = function () {
        return this.Linter.VERSION;
    };
    TSLint3.prototype.name = function () {
        return (this.isEmbedded ? "embedded" : "project's") + " TSLint " + this.Linter.VERSION;
    };
    return TSLint3;
}());
exports.TSLint3 = TSLint3;
