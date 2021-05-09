import * as pulumi from "@pulumi/pulumi";
import * as auto from "@pulumi/pulumi/automation";
import * as aws from "@pulumi/aws";
import * as gcp from "@pulumi/gcp";
import * as azure from "@pulumi/azure-native";
import * as k8s from "@pulumi/kubernetes"

const repl = require("repl");

export interface ReplArgs {
    // the name of the stack to initialize.
    stack: string;
    // the name of the project.
    project: string;
    // optional config to set before initializing the repl (ie "aws:region").
    config?: auto.ConfigMap;
    // if true, tears down stack and resources on repl exit.
    ephemeral?: boolean;
    // the directory to initialize your 'Pulumi.yaml', defaults to '.'.
    workDir?: string;
    // granular options for pulumi stack, project, and workspace settings.
    workspaceOpts?: auto.LocalWorkspaceOptions;
}

export interface ReplResult {
    // a summary of the pulumi update after repl is finished.
    updateResult: auto.UpResult;
    // if args.ephemeral=true, a summary of the pulumi destroy after repl is finished.
    destroyResult?: auto.DestroyResult;
}

export class PulumiRepl {
    // the Automation API stack that was created/selected.
    public stack: Promise<auto.Stack>;

    private __outputs: any = {};
    private __repl: any;
    private __context: any = {
        aws,
        azure,
        gcp,
        k8s,
        pulumi
    };
    private __pluginPromise: Promise<any>;
    private __configPromise: Promise<any>;
    private __ephemeral = false;
    constructor(args: ReplArgs) {
        const program = this.__initProgram();
        const workspaceOpts: auto.LocalWorkspaceOptions = args.workspaceOpts ? args.workspaceOpts : {};
        if (args.workDir) {
            workspaceOpts.workDir = args.workDir;
        }
        if (!workspaceOpts.workDir) {
            workspaceOpts.workDir = ".";
        }
        this.__ephemeral = !!args.ephemeral;
        const autoArgs: auto.InlineProgramArgs = {
            stackName: args.stack,
            projectName: args.project,
            program,
        };
        this.stack = auto.LocalWorkspace.createOrSelectStack(autoArgs, workspaceOpts);
        this.__pluginPromise = this.__initializePlugins();
        if (args.config) {
            this.__configPromise = this.__initConfig(args.config);
        } else {
            this.__configPromise = Promise.resolve();
        }
    }
    // starts execution of the REPL, returns a promise that resolves with execution result.
    async start(): Promise<ReplResult> {
        let result: ReplResult;
        console.log("configuring pulumi stack...")
        const stack = await this.stack;
        await this.__pluginPromise;
        await this.__configPromise;
        console.log("starting pulumi repl update...")
        result = {
            updateResult: await stack.up({
                onOutput: console.log,
            })
        };
        console.log("repl update complete!");
        console.log(`update summary: \n${JSON.stringify(result.updateResult.summary.resourceChanges, null, 4)}`);

        if (this.__ephemeral) {
            console.log("destroying ephemeral pulumi repl stack...")
            result.destroyResult = await stack.destroy({
                onOutput: console.log,
            });
            console.log("destroy complete!");
        }

        return result;
    }
    // add a value to the REPL execution. This supports including additional pulumi provider SDKs.
    public addContext(key: string, value: any) {
        const context = this.__repl ? this.__repl.context : this.__context;
        context[key] = value;
    }
    private async __initializePlugins() {
        const stack = await this.stack;
        const promises = [];
        promises.push(stack.workspace.installPlugin("aws", "v4.3.0"));
        promises.push(stack.workspace.installPlugin("azure-native", "v1.5.0"));
        promises.push(stack.workspace.installPlugin("gcp", "v5.2.0"));
        promises.push(stack.workspace.installPlugin("kubernetes", "v3.1.1"));
        return Promise.all(promises);
    }
    private async __initConfig(config: auto.ConfigMap) {
        const stack = await this.stack;
        return stack.setAllConfig(config);
    }
    private __initProgram() {
        const pulumiProgram: auto.PulumiFn = () => {
            let resolveHandler: any;
            let rejectHandler: any;

            const done = new Promise((resolve, reject) => {
                resolveHandler = resolve;
                rejectHandler = reject;
            });
            this.__repl = repl.start('pulumi-repl> ');
            const contextKeys = Object.keys(this.__context);
            for (let key of contextKeys) {
                this.__repl.context[key] = this.__context[key];
            }

            this.__repl.on('exit', () => {
                console.log('Exit signal received.');
                console.log("Completing pulumi update...")
                resolveHandler(this.__outputs);
            });

            this.__repl.context.registerOutput = (k: any, v: any) => {
                this.__outputs[k] = v;
            }
            return done;
        };

        return pulumiProgram;
    }
}