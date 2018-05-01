const resolver = require("../lib/resolver");
const EmbedError = require("../lib/EmbedError");
module.exports = async (context, next, wiggle) => {
    const { command } = context;
    if(!command) return next();
    const { embedError } = command;
    const content = context.originalContent.split(" ").slice(1);
    const usedFlags = [];
    const flags = {};
    const args = [];
    const flagsCopy = context.command.flags.slice();
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
                const { embed } = new EmbedError(context, error);
                return context.channel.send(embed);
            } else {
                return context.channel.send(
                    context.t("middleware.error.wrongFlag", { command: command.name, usage: command.usage }));
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
    // parse the value of each used flag
    for(let i = 0, n = usedFlags.length; i < n; i++) {
        const index = usedFlags[i];
        const nextIndex = usedFlags[i + 1];
        const min = index.index + 1;
        // if we're in the last index
        const max = nextIndex ? nextIndex.index : content.length;
        const value = content.slice(min, max).join(" ");
        try {
            flags[index.flag.name] = await resolver[index.flag.type](value, context, index.flag.name);
        } catch(err) {
            const error = {
                error: err.message,
                data: err.data
            };
            const { embed } = new EmbedError(context, error);
            return context.channel.send(embed);
        }
    }
    context.flags = flags;
    context.args = content;
    return next();
};