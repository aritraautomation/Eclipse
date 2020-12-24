"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var ts = require("typescript");
var classifierServiceHost_1 = require("./classifierServiceHost");
var fileInfo_1 = require("../language/fileInfo");
var ClassifierEndpoint = (function () {
    function ClassifierEndpoint() {
        this.classifier = ts.createClassifier();
        this.fileInfos = Object.create(null);
        var host = new classifierServiceHost_1.ClassifierServiceHost(this.fileInfos);
        this.service = ts.createLanguageService(host, ts.createDocumentRegistry());
    }
    ClassifierEndpoint.prototype.getClassificationsForLines = function (lines, lexState) {
        var lastLexState = lexState;
        var results = [];
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            var classificationResult = this.classifier.getEncodedLexicalClassifications(line, lastLexState, true);
            results.push(classificationResult);
            lastLexState = classificationResult.endOfLineState;
        }
        return results;
    };
    ClassifierEndpoint.prototype.getIndentationAtPosition = function (fileName, position, editorOptions) {
        return this.service.getIndentationAtPosition(fileName, position, editorOptions);
    };
    ClassifierEndpoint.prototype.getIndentationAtPositionAfterEdit = function (fileName, position, offset, length, text, editorOptions) {
        var info = this.fileInfos[fileName];
        var indentation = -1;
        if (info) {
            var oldText = info.getSnapshot().getText(offset, offset + length);
            info.editContents(offset, length, text);
            try {
                indentation = this.service.getIndentationAtPosition(fileName, position, editorOptions);
            }
            finally {
                info.editContents(offset, text.length, oldText);
            }
        }
        return indentation;
    };
    ClassifierEndpoint.prototype.getBraceMatchingAtPosition = function (fileName, position) {
        return this.service.getBraceMatchingAtPosition(fileName, position);
    };
    ClassifierEndpoint.prototype.addFile = function (fileName) {
        var info = this.fileInfos[fileName];
        if (!info) {
            var fileInfo = new fileInfo_1.FileInfo("classifier:" + fileName);
            this.fileInfos[fileName] = fileInfo;
        }
    };
    ClassifierEndpoint.prototype.removeFile = function (fileName) {
        var info = this.fileInfos[fileName];
        if (info) {
            info.lazyUpdate();
        }
    };
    ClassifierEndpoint.prototype.editFile = function (fileName, offset, length, text) {
        var info = this.fileInfos[fileName];
        if (info) {
            info.editContents(offset, length, text);
        }
    };
    ClassifierEndpoint.prototype.updateFileContent = function (fileName, content) {
        var fileInfo = this.fileInfos[fileName];
        if (!fileInfo) {
            fileInfo = new fileInfo_1.FileInfo(fileName);
            this.fileInfos[fileName] = fileInfo;
        }
        fileInfo.updateFile(content);
    };
    return ClassifierEndpoint;
}());
exports.ClassifierEndpoint = ClassifierEndpoint;
