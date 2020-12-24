"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var RefactoringType;
(function (RefactoringType) {
    RefactoringType["SYMBOL_RENAME"] = "SYMBOL_RENAME";
    RefactoringType["RESOURCE_RENAME"] = "RESOURCE_RENAME";
    RefactoringType["RESOURCE_MOVE"] = "RESOURCE_MOVE";
})(RefactoringType = exports.RefactoringType || (exports.RefactoringType = {}));
var RefactoringParameter;
(function (RefactoringParameter) {
    RefactoringParameter["DESTINATION"] = "destination";
    RefactoringParameter["UPDATE_REFERENCES"] = "updateReferences";
    RefactoringParameter["UPDATE_EXPORTED_SYMBOLS"] = "updateExportedSymbols";
})(RefactoringParameter = exports.RefactoringParameter || (exports.RefactoringParameter = {}));
function mergeRefactoringChanges(results) {
    var result = {};
    results.forEach(function (res) {
        for (var file in res) {
            var fileChanges = res[file];
            var fileChangesRes = result[file] || (result[file] = {});
            for (var descr in fileChanges) {
                var descrChanges = fileChanges[descr];
                var descrChangesRes = fileChangesRes[descr] || (fileChangesRes[descr] = []);
                descrChangesRes.push.apply(descrChangesRes, descrChanges);
            }
        }
    });
    return result;
}
exports.mergeRefactoringChanges = mergeRefactoringChanges;
function mergeValidationResults(results) {
    var result = {};
    for (var _i = 0, results_1 = results; _i < results_1.length; _i++) {
        var valRes = results_1[_i];
        var _loop_1 = function (file) {
            var markersInfo1 = result[file] || (result[file] = new FileMarkersInfo());
            var markersInfo2 = valRes[file];
            (_a = markersInfo1.markers).push.apply(_a, markersInfo2.markers);
            Object.keys(markersInfo2.markerTypes).forEach(function (key) {
                markersInfo1.markerTypes[key] = markersInfo1.markerTypes[key] || markersInfo2.markerTypes[key];
            });
            var _a;
        };
        for (var file in valRes) {
            _loop_1(file);
        }
    }
    return Promise.resolve(result);
}
exports.mergeValidationResults = mergeValidationResults;
var FileMarkersInfo = (function () {
    function FileMarkersInfo() {
        this.markers = [];
        this.markerTypes = {};
    }
    return FileMarkersInfo;
}());
exports.FileMarkersInfo = FileMarkersInfo;
var FileMarker = (function () {
    function FileMarker(markerType, charStart, charEnd, lineNumber, message, priority, severity, problemType, quickFixes) {
        this.mt = markerType;
        this.st = charStart;
        this.end = charEnd;
        this.ln = lineNumber;
        this.msg = message;
        this.pr = priority;
        this.sev = severity;
        this.qfx = quickFixes;
        this.pt = problemType;
    }
    return FileMarker;
}());
exports.FileMarker = FileMarker;
function adjustMarkerPos(start, end, text) {
    if (start === end) {
        var ch = void 0;
        while (start > 0 &&
            ((ch = text.charAt(start)) === "\n"
                || ch === "\r" || ch === "" || ch === undefined)) {
            start--;
        }
        if (start === end) {
            end++;
        }
    }
    return { start: start, end: end };
}
exports.adjustMarkerPos = adjustMarkerPos;
var MarkerType;
(function (MarkerType) {
    MarkerType[MarkerType["TYPE_SCRIPT_PROBLEM"] = 0] = "TYPE_SCRIPT_PROBLEM";
    MarkerType[MarkerType["TODO"] = 1] = "TODO";
    MarkerType[MarkerType["ANGULAR2_PROBLEM"] = 2] = "ANGULAR2_PROBLEM";
    MarkerType[MarkerType["TSLINT_FAILURE"] = 3] = "TSLINT_FAILURE";
    MarkerType[MarkerType["TSLINT_CONFIG_PROBLEM"] = 4] = "TSLINT_CONFIG_PROBLEM";
    MarkerType[MarkerType["TSLINT_JS_FAILURE"] = 5] = "TSLINT_JS_FAILURE";
    MarkerType[MarkerType["TSCONFIG_FAILURE"] = 6] = "TSCONFIG_FAILURE";
})(MarkerType = exports.MarkerType || (exports.MarkerType = {}));
var MarkerPriority;
(function (MarkerPriority) {
    MarkerPriority[MarkerPriority["PRIORITY_LOW"] = 0] = "PRIORITY_LOW";
    MarkerPriority[MarkerPriority["PRIORITY_NORMAL"] = 1] = "PRIORITY_NORMAL";
    MarkerPriority[MarkerPriority["PRIORITY_HIGH"] = 2] = "PRIORITY_HIGH";
})(MarkerPriority = exports.MarkerPriority || (exports.MarkerPriority = {}));
var MarkerSeverity;
(function (MarkerSeverity) {
    MarkerSeverity[MarkerSeverity["SEVERITY_INFO"] = 0] = "SEVERITY_INFO";
    MarkerSeverity[MarkerSeverity["SEVERITY_WARNING"] = 1] = "SEVERITY_WARNING";
    MarkerSeverity[MarkerSeverity["SEVERITY_ERROR"] = 2] = "SEVERITY_ERROR";
})(MarkerSeverity = exports.MarkerSeverity || (exports.MarkerSeverity = {}));
var ServiceProvidersRegistry = (function () {
    function ServiceProvidersRegistry() {
        this.providers = [];
    }
    ServiceProvidersRegistry.prototype.registerProvider = function (provider) {
        this.providers.push(provider);
    };
    ServiceProvidersRegistry.prototype.getProviders = function () {
        return this.providers.slice();
    };
    return ServiceProvidersRegistry;
}());
exports.registry = new ServiceProvidersRegistry();
