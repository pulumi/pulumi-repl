import { PulumiRepl } from "pulumi-repl";
// import a custom pulumi provider SDK.
import * as random from "@pulumi/random";

const repl = new PulumiRepl({
    stack: "dev",
    project: "pulumi-repl-custom",
    ephemeral: true, // delete stack resources on repl exit
    eject: true, // write out resulting program to ./eject
    config: {
        "hello": { value: "world"} 
        /**
         * try entering the following in the repl:
         * > var config = new pulumi.Config();
         * > console.log(config.get("hello"));
         */
    }
});

// make the random SDK accessible to the repl at runtime
repl.addContext("random", random);

// access the automation api stack to install provider plugins
repl.stack.then(s => {
    // install the 'random' resource provider plugin
    s.workspace.installPlugin("random", "v4.0.0").then(()=>{
        repl.start().catch(err => console.error(err));
    })
});
