import assert from "assert";
import { spawn } from "child_process";
import path from "path";

describe("worker smoke tests", function () {
    this.timeout(20000);
    it("should start the worker process", (done) => {
        const proc = spawn("node", ["src/workers/studentImport.worker.js"], { env: process.env });
        let started = false;
        proc.stdout.on("data", d => {
            const s = String(d);
            if (s.includes("studentImport worker (streaming) started")) {
                started = true;
                proc.kill();
            }
        });
        proc.on("exit", () => {
            assert.ok(started, "worker started");
            done();
        });
    });
});
