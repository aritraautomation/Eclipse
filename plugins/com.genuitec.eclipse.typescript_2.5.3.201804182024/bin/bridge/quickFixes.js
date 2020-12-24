"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var QuickFix = (function () {
    function QuickFix(title, description, imageName, type, relevance, hoverLinkText) {
        this.ttl = title;
        this.des = description;
        this.img = imageName;
        this.tp = type;
        this.rel = relevance;
        this.hlt = hoverLinkText;
    }
    QuickFix.REL_CRITICAL = -100;
    QuickFix.REL_HIGHEST = 0;
    QuickFix.REL_HIGH = 100;
    QuickFix.REL_LOW = 500;
    QuickFix.REL_LOWEST = 1000;
    return QuickFix;
}());
exports.QuickFix = QuickFix;
var DynamicQuickFix = (function (_super) {
    __extends(DynamicQuickFix, _super);
    function DynamicQuickFix(title, description, imageName, type, relevance, hoverLinkText, changes, formattingChanges) {
        var _this = _super.call(this, title, description, imageName, type, relevance, hoverLinkText) || this;
        _this.changes = changes;
        _this.formattingChanges = formattingChanges;
        return _this;
    }
    return DynamicQuickFix;
}(QuickFix));
exports.DynamicQuickFix = DynamicQuickFix;
function mergeQuickFixResults(results) {
    var result = {};
    for (var _i = 0, results_1 = results; _i < results_1.length; _i++) {
        var qfRes = results_1[_i];
        for (var file in qfRes) {
            result[file] = (result[file] || []).concat(qfRes[file]);
        }
    }
    return Promise.resolve(result);
}
exports.mergeQuickFixResults = mergeQuickFixResults;
