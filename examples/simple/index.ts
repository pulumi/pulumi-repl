import { PulumiRepl } from "pulumi-repl";

const repl = new PulumiRepl({
    stack: "dev",
    project: "pulumi-repl",
    config: {
        "aws:region": { value: "us-west-2" }
    },
});

repl.start().catch(err => console.error(err));
