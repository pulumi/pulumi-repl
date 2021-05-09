import * as prepl from "pulumi-repl";

const repl = new prepl.PulumiRepl({
    stack: "dev",
    project: "foo",
    ephemeral: true,
    config: {
        "aws:region": { value: "us-west-2" }
    }
});

repl.start().catch(err => console.error(err));