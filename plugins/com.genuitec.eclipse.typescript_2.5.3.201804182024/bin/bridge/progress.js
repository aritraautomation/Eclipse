"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var ProgressMonitor = (function () {
    function ProgressMonitor() {
        this.lastReportTime = 0;
    }
    ProgressMonitor.prototype.shouldReport = function () {
        var curTime = new Date().getTime();
        if (this.lastReportTime + 100 <= curTime) {
            this.lastReportTime = curTime;
            return true;
        }
        return false;
    };
    ProgressMonitor.prototype.report = function (obj) {
        console.log("MONITOR: " + JSON.stringify(obj));
    };
    ProgressMonitor.prototype.subTask = function (task) {
        if (this.shouldReport()) {
            this.report({ type: "subTask", value: task });
        }
    };
    ProgressMonitor.prototype.worked = function (amount) {
        if (this.shouldReport()) {
            this.report({ type: "worked", value: amount });
        }
    };
    ProgressMonitor.prototype.beginTask = function (amount) {
        this.report({ type: "beginTask", value: amount });
    };
    return ProgressMonitor;
}());
exports.progressMonitor = new ProgressMonitor();
