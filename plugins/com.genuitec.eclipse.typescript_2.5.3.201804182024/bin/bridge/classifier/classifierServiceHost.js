"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var ts = require("typescript");
var EOL = require("os").EOL;
var ClassifierServiceHost = (function () {
    function ClassifierServiceHost(fileInfos) {
        this.fileInfos = fileInfos;
    }
    ClassifierServiceHost.prototype.getCompilationSettings = function () {
        return null;
    };
    ClassifierServiceHost.prototype.getCurrentDirectory = function () {
        return "";
    };
    ClassifierServiceHost.prototype.getDefaultLibFileName = function (options) {
        return ts.getDefaultLibFileName(options);
    };
    ClassifierServiceHost.prototype.getNewLine = function () {
        return EOL;
    };
    ClassifierServiceHost.prototype.getScriptFileNames = function () {
        return Object.getOwnPropertyNames(this.fileInfos);
    };
    ClassifierServiceHost.prototype.getScriptSnapshot = function (fileName) {
        var fileInfo = this.fileInfos[fileName];
        if (fileInfo) {
            return fileInfo.getSnapshot();
        }
        return undefined;
    };
    ClassifierServiceHost.prototype.getScriptVersion = function (fileName) {
        var fileInfo = this.fileInfos[fileName];
        return fileInfo ? fileInfo.getVersion() : undefined;
    };
    return ClassifierServiceHost;
}());
exports.ClassifierServiceHost = ClassifierServiceHost;
