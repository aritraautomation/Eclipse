"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var fs = require("fs");
var ts = require("typescript");
var snapshot_1 = require("./snapshot");
var FileInfo = (function () {
    function FileInfo(path) {
        this.changes = [];
        this.contents = null;
        this.open = false;
        this.path = path;
        this.prevSpan = null;
        if (path && path.startsWith("eclipse:")) {
            throw new Error("Bad path");
        }
    }
    FileInfo.prototype.readFileContents = function (fileName) {
        var options = { encoding: "utf8" };
        return fs.readFileSync(fileName, options);
    };
    FileInfo.prototype.ensureContents = function () {
        if (this.contents == null) {
            try {
                this.contents = this.readFileContents(this.path);
            }
            catch (e) {
            }
            this.addChangeIfNeeded();
        }
    };
    FileInfo.prototype.needsUpdate = function () {
        return this.contents == null;
    };
    FileInfo.prototype.setPath = function (path) {
        this.path = path;
    };
    FileInfo.prototype.editContents = function (offset, length, text) {
        if (this.contents == null) {
            throw new Error("cannot edit null contents");
        }
        var prefix = this.contents.substring(0, offset);
        var suffix = this.contents.substring(offset + length);
        var newContents = prefix + text + suffix;
        var span = ts.createTextSpan(offset, length);
        var change = ts.createTextChangeRange(span, text.length);
        this.contents = newContents;
        this.changes.push(change);
    };
    FileInfo.prototype.getOpen = function () {
        return this.open;
    };
    FileInfo.prototype.setOpen = function (open) {
        this.open = open;
        if (!open) {
            this.lazyUpdate();
            if (this.getIsolatedLaunguageService()) {
                this.setIsolatedLanguageService(null);
            }
        }
    };
    FileInfo.prototype.getPath = function () {
        return this.path;
    };
    FileInfo.prototype.getSnapshot = function () {
        this.ensureContents();
        if (this.contents == null) {
            return undefined;
        }
        return new snapshot_1.ScriptSnapshot(this.changes.slice(0), this.contents, this.changes.length);
    };
    FileInfo.prototype.setIsolatedLanguageService = function (service) {
        this.isolatedLangService = service;
    };
    FileInfo.prototype.getIsolatedLaunguageService = function () {
        return this.isolatedLangService;
    };
    FileInfo.prototype.getVersion = function () {
        return this.changes.length.toString(10);
    };
    FileInfo.prototype.lazyUpdate = function () {
        if (this.contents != null) {
            this.prevSpan = ts.createTextSpan(0, this.contents.length);
            this.contents = null;
        }
    };
    FileInfo.prototype.reload = function () {
        if (fs.existsSync(this.path)) {
            this.updateFile(this.readFileContents(this.path));
        }
    };
    FileInfo.prototype.updateFile = function (contents) {
        if (this.contents != null) {
            if (this.contents === contents) {
                return;
            }
            var span = ts.createTextSpan(0, this.contents.length);
            var change = ts.createTextChangeRange(span, contents.length);
            this.contents = contents;
            this.changes.push(change);
            this.prevSpan = null;
        }
        else {
            this.contents = contents;
            this.addChangeIfNeeded();
        }
    };
    FileInfo.prototype.addChangeIfNeeded = function () {
        if (this.prevSpan != null && this.contents != null) {
            this.changes.push(ts.createTextChangeRange(this.prevSpan, this.contents.length));
            this.prevSpan = null;
        }
    };
    return FileInfo;
}());
exports.FileInfo = FileInfo;
