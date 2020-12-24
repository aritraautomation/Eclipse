"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var fs_1 = require("fs");
var Main = (function () {
    function Main(bridgeType, enabledEndpoints) {
        this.bridgeType = bridgeType;
        this.endpoints = {};
        this.versions = {};
        var versions = this.versions;
        if (!(bridgeType === "editor" || bridgeType === "builder" || bridgeType === "classifier")) {
            throw new Error("Invalid bridge type " + bridgeType);
        }
        console.error("Bridge type: " + bridgeType);
        var Module = require("module");
        var path = require("path");
        Main.bridgePath = path.dirname(__filename);
        var oldProto = Module._resolveLookupPaths;
        Module._resolveLookupPaths = function (request, parent) {
            var _a = oldProto(request, parent), id = _a[0], paths = _a[1];
            if (request === "typescript") {
                return [id, [
                        path.resolve(Main.bridgePath, "../typescript/" + versions["typescript"] + "/node_modules")
                    ]];
            }
            if (request.startsWith("@angular/") && versions["angular"]
                && parent.filename.replace(/\\/g, "/")
                    .match("\/com.genuitec.eclipse.typescript.*\/bin\/")) {
                var version = versions["angular"];
                if (version.startsWith("2.")) {
                    version = "2.4.6";
                }
                else if (version.startsWith("4.")) {
                    version = "4.0.0";
                }
                var angularLoc = path.resolve(Main.bridgePath, "../angular/" + version + "/node_modules");
                if (!fs_1.existsSync(angularLoc)) {
                    console.error("Cannot locate folder with implmeentation of Angular " + version + " under expected location " + angularLoc + ".");
                }
                return [id, [angularLoc]];
            }
            return [id, paths];
        };
        for (var i = 1; i < enabledEndpoints.length; i += 2) {
            var name_1 = enabledEndpoints[i - 1];
            var version = enabledEndpoints[i];
            if (name_1 === "language" || name_1 == "classifier") {
                console.error("Running with TS version:" + version);
                this.versions["typescript"] = version;
            }
            this.versions[name_1] = version;
            console.error("Initializing endpoint " + name_1 + " in version " + version);
            var endpoint = require("./" + name_1);
            this.endpoints[name_1] = new endpoint.default();
        }
        this.run();
    }
    Main.prototype.run = function () {
        var _this = this;
        var readline = require("readline");
        var rl = readline.createInterface(process.stdin, process.stdout);
        rl.on("line", function (line) {
            _this.processRequest(line);
        });
        rl.on("close", function () {
            process.exit(0);
        });
    };
    Main.prototype.getEndpoint = function (name) {
        return this.endpoints[name];
    };
    Main.prototype.getBridgeType = function () {
        return this.bridgeType;
    };
    Main.prototype.processRequest = function (requestJson) {
        var _this = this;
        try {
            if (Main.disposed) {
                throw new Error("Bride is disposed.");
            }
            var request = JSON.parse(requestJson);
            if (request.method === "close") {
                this.shutdown();
                this.printResult({});
                return;
            }
            var endpoint = this.endpoints[request.endpoint];
            if (!endpoint) {
                console.log("ERROR: endpoint " + request.endpoint + " is not initialized.");
            }
            var method = endpoint[request.method];
            var result = method.apply(endpoint, request.arguments);
            if (result instanceof Promise) {
                var p = result;
                p.then(function (result) {
                    _this.printResult(result);
                }, function (error) {
                    _this.throwError(error);
                });
            }
            else {
                this.printResult(result);
            }
        }
        catch (e) {
            this.throwError(e);
        }
    };
    Main.prototype.shutdown = function () {
        Main.disposed = true;
        for (var _i = 0, _a = Object.keys(this.endpoints); _i < _a.length; _i++) {
            var endpointName = _a[_i];
            var endpoint = this.endpoints[endpointName];
            if (endpoint && endpoint.dispose) {
                endpoint.dispose();
            }
        }
    };
    Main.prototype.printResult = function (result) {
        if (result === undefined) {
            result = null;
        }
        var resultJson = JSON.stringify(result);
        console.log("RESULT: " + resultJson);
    };
    Main.prototype.throwError = function (e) {
        var error;
        if (e.stack != null) {
            error = e.stack;
        }
        else if (e.message != null) {
            error = e.message;
        }
        else {
            error = "Error: No stack trace or error message was provided.";
        }
        console.log("ERROR: " + error.replace(/\\/g, "\\\\").replace(/\n/g, "\\n"));
    };
    Main.prototype.logError = function (e) {
        var error;
        if (e.stack != null) {
            error = e.stack;
        }
        else if (e.message != null) {
            error = e.message;
        }
        else {
            return;
        }
        console.log("ERROR_LOG: " + error.replace(/\\/g, "\\\\").replace(/\n/g, "\\n"));
    };
    Main.disposed = false;
    return Main;
}());
Error.stackTraceLimit = 100;
exports.metadataDir = process.cwd();
exports.main = new Main(process.argv[2], process.argv.slice(3));
