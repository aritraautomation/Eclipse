"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var ts = require("typescript");
var ScriptSnapshot = (function () {
    function ScriptSnapshot(changes, contents, version) {
        this.changes = changes;
        this.contents = contents;
        this.version = version;
    }
    ScriptSnapshot.prototype.getText = function (start, end) {
        return this.contents.substring(start, end);
    };
    ScriptSnapshot.prototype.getLength = function () {
        return this.contents.length;
    };
    ScriptSnapshot.prototype.getChangeRange = function (oldSnapshot) {
        var oldSnapshot2 = oldSnapshot;
        if (this.version === oldSnapshot2.version) {
            return ts.unchangedTextChangeRange;
        }
        else if (this.version - oldSnapshot2.version <= this.changes.length) {
            var start = this.changes.length - (this.version - oldSnapshot2.version);
            var changes = this.changes.slice(start);
            return ts.collapseTextChangeRangesAcrossMultipleVersions(changes);
        }
        else {
            return null;
        }
    };
    return ScriptSnapshot;
}());
exports.ScriptSnapshot = ScriptSnapshot;
