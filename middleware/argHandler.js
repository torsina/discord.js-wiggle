const resolver = require("../lib/resolver");
const EmbedError = require("../lib/EmbedError");
module.exports = async (message, next, wiggle) => {
    const { command } = message;
    if(!command) return next();
    const { embedError } = command;
    const content = message.originalContent.split(" ").slice(1);
    const usedFlags = [];
    const flags = {};
    const args = [];
    const flagsCopy = message.command.flags.slice();
    let flagStart, quoted, bigArg = {};
    for(let i = 0, n = content.length; i < n; i++) {
        const index = content[i];
        // check for a flag declaration
        // we use isNan to not turn a negative number into a flag declaration
        if(index.charAt(0) === "-" && isNaN(parseInt(index))) {
            const flagKeys = [];
            // stop the registering of the args
            if(!flagStart) flagStart = true;
            let flagName = index.slice(1, index.length);
            if(index.charAt(1) === "-") {
                flagName = index.slice(2, index.length);
                for(let j = 0, m = flagsCopy.length; j < m; j++) {
                    flagKeys.push(flagsCopy[j].name);
                }
            } else {
                for(let j = 0, m = flagsCopy.length; j < m; j++) {
                    flagKeys.push(flagsCopy[j].short);
                }
            }
            const flagIndex = flagKeys.indexOf(flagName);
            if(flagIndex !== -1) {
                const flag = flagsCopy[flagIndex];
                // store the index we're in to later parse the value of this flag
                usedFlags.push({ flag: flag, index: i });
                // delete the used flag from the array to make indexOf faster
                flagsCopy.splice(flagIndex, 1);
            } else if(embedError) {
                const error = {
                    error: "middleware.error.wrongFlag",
                    data: {
                        command: command.name,
                        usage: command.usage
                    }
                };
                const { embed } = new EmbedError(message, error);
                return message.channel.send(embed);
            } else {
                return message.channel.send(
                    message.t("middleware.error.wrongFlag", { command: command.name, usage: command.usage }));
            }
            // check if we started to loop through the flags
        } else if(!flagStart) {
            const start = index.charAt(0);
            const end = index.charAt(index.length - 1);
            if((start === `"` || start === `'` || start === `\``) && !quoted) {
                quoted = true;
                bigArg.quote = start;
                bigArg.start = i;
                bigArg.arg = [index];
                if(end === bigArg.quote) {
                    quoted = false;
                    const value = bigArg.arg.join(" ").slice(1, -1);
                    args.push(value);
                    bigArg = {};
                }
            } else if(end === bigArg.quote && quoted) {
                quoted = false;
                if(bigArg.start !== i) bigArg.arg.push(index);
                const value = bigArg.arg.join(" ").slice(1, -1);
                args.push(value);
                bigArg = {};
            } else if(quoted && bigArg.start !== i) {
                bigArg.arg.push(index);
            } else if(!quoted) {
                args.push(index);
            }
        }
    }
    // since args will follow the same order as message.command.args
    const { argTree } = message.command;
    if(argTree) {
        let result = await recursiveArgTree(argTree, args, message);
        if(!result) return;
        message.args = result;
    } else {
        for(let i = 0, n = args.length; i < n; i++) {
            const commandArg = message.command.args[i];
            if(!commandArg) break;
            try {
                args[i] = await resolver[commandArg.type](args[i], message, commandArg.name);
            } catch(err) {
                const error = {
                    error: err.message,
                    data: err.data
                };
                const { embed } = new EmbedError(message, error);
                return message.channel.send(embed);
            }
            if(commandArg.correct && commandArg.correct.indexOf(args[i]) === -1) {
                const error = {
                    error: "middleware.error.wrongArg",
                    data: {
                        command: command.name,
                        usage: command.usage
                    }
                };
                const { embed } = new EmbedError(message, error);
                return message.channel.send(embed);
            }
        }
    }
    // parse the value of each used flag
    for(let i = 0, n = usedFlags.length; i < n; i++) {
        const index = usedFlags[i];
        const nextIndex = usedFlags[i + 1];
        const min = index.index + 1;
        // if we're in the last index
        const max = nextIndex ? nextIndex.index : content.length;
        const value = content.slice(min, max).join(" ");
        try {
            flags[index.flag.name] = await resolver[index.flag.type](value, message, index.flag.name);
        } catch(err) {
            if(embedError) {
                const error = {
                    error: err.message,
                    data: err.data
                };
                const { embed } = new EmbedError(message, error);
                return message.channel.send(embed);
            } else {
                return message.channel.send(message.t(err.message, err.data));
            }
        }
    }
    // check if all the mandatory args are here
    if(args.length < command.args.filter(arg => !arg.optional).length) {
        if(embedError) {
            const error = {
                error: "wiggle.missingArgs",
                data: {
                    command: command.name,
                    usage: command.usage
                }
            };
            const { embed } = new EmbedError(message, error);
            return message.channel.send(embed);
        } else {
            return message.t("wiggle.missingArgs", { command: command.name, usage: command.usage });
        }
    }
    message.flags = flags;
    return next();
};

async function recursiveArgTree(argTree, args, message, result = [], usage = "") {
    const usedArgs = args.slice();
    if(argTree.next) {
        try {
            const nextArgs = Object.keys(argTree.next);
            const nextIndex = nextArgs.indexOf(usedArgs[0]);
            const next = nextArgs[nextIndex];
            if(nextIndex === -1) usage += argTree.label ? `${argTree.label} ` : `<${nextArgs.join(" | ")}> `;
            else {
                usage += argTree.label ? `${argTree.label} ` : `${next} `;
            }
            result[result.length] = await resolver[argTree.type](usedArgs[0], message, argTree);
            usedArgs.splice(0, 1);
            if(nextIndex === -1) {
                const error = {
                    error: "wiggle.missingArgs",
                    data: {
                        command: message.command.name,
                        usage: usage
                    }
                };
                const { embed } = new EmbedError(message, error);
                message.channel.send(embed);
            } else {
                return await recursiveArgTree(argTree.next[nextArgs[nextIndex]], usedArgs, message, result, usage);
            }
        } catch(err) {
            const error = {
                error: err.message,
                data: err.data
            };
            error.data.usage = usage;
            const { embed } = new EmbedError(message, error);
            message.channel.send(embed);
        }
    } else {
        const usedArg = args.join(" ");
        try {
            usage += argTree.label ? `<${argTree.label}> ` : "<value>";
            if(usedArg === "") {
                const error = {
                    error: "wiggle.missingArgs",
                    data: {
                        command: message.command.name,
                        usage: usage
                    }
                };
                const { embed } = new EmbedError(message, error);
                message.channel.send(embed);
                return;
            }
            result[result.length] = await resolver[argTree.type](usedArg, message, argTree);
            return result;
        } catch(err) {
            console.error(err);
            const error = {
                error: err.message,
                data: err.data
            };
            error.data.usage = usage;
            const { embed } = new EmbedError(message, error);
            message.channel.send(embed);
        }
    }
}
