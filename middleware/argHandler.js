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
    // since args will follow the same order as message.command.args
    const { argTree } = context.command;
    if(argTree) {
        const result = await recursiveArgTree(argTree, args, context);
        if(!result) {
            context.args = [];
            return null;
        } else {
            context.args = result;
        }
    } else {
        for(let i = 0, n = args.length; i < n; i++) {
            const commandArg = context.command.args[i];
            if(!commandArg) break;
            try {
                args[i] = await resolver[commandArg.type](args[i], context, commandArg.name);
            } catch(err) {
                const error = {
                    error: err.message,
                    data: err.data
                };
                const { embed } = new EmbedError(context, error);
                return context.channel.send(embed);
            }
            if(commandArg.correct && commandArg.correct.indexOf(args[i]) === -1) {
                const error = {
                    error: "middleware.error.wrongArg",
                    data: {
                        command: command.name,
                        usage: command.usage
                    }
                };
                const { embed } = new EmbedError(context, error);
                return context.channel.send(embed);
            }
        }
        context.args = args;
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
    // check if all the mandatory args are here
    if(args.length < command.args.filter(arg => !arg.optional).length) {
        const error = {
            error: "wiggle.missingArgs",
            data: {
                command: command.name,
                usage: command.usage
            }
        };
        const { embed } = new EmbedError(context, error);
        return context.channel.send(embed);
    }
    context.flags = flags;
    return next();
};

/**
 * base is the first arg, properties of argTree are choice and the possible argument resolver options(if VALUE is used) for arg 0
 * choice contains all of the possibilities for arg 0 in the properties keys of this object
 *
 * once one level passed, we're in the property of choice corresponding to the argument input,
 * and the cycle goes over and over again
 *
 * VALUE as option means a user input
 *
 * the `last` property as option for a argument means that even if the input contains more words than argument, the argument parsing will stop and only one word will be given to the last argument.
 * there will be no parsing error if the last input argument has `last` set to true in it's options
 * @param argTree
 * @param args
 * @param message
 * @param result
 * @param usage
 * @returns {Promise.<void>}
 */
async function recursiveArgTree(argTree, args, message, result = [], usage = "") { // eslint-disable-line
    try {
        // copy the arg array
        const argsLeft = args.slice();
        const choices = argTree.choice;
        const choiceArray = Object.keys(choices);
        let choiceIndex = choiceArray.indexOf(argsLeft[0]);
        // process the usage string if there is an error in the parsing
        // this is for the usage of the first argument
        if(choiceIndex === -1 && result.length === 0) {
            choiceIndex = choiceArray.indexOf("VALUE");
            if(choiceIndex === -1) {
                usage += argTree.label ? `<${argTree.label}> ` : `<${choiceArray.join(" | ")}> `;
                throw missingArg(message, usage);
            } else {
                usage += argTree.label ? `<${argTree.label}> ` : `<${argsLeft[0]}> `;
            }
        } else if(result.length === 0) {
            usage += argTree.label ? `<${argTree.label}> ` : `<${argsLeft[0]}> `;
        }
        // get the index of the choice in every case
        let isVALUE = false;
        if(choiceIndex === -1) {
            choiceIndex = choiceArray.indexOf("VALUE");
            isVALUE = true;
            if(choiceIndex === -1) {
                throw missingArg(message, usage);
            }
        }
        const selectedChoice = choices[choiceArray[choiceIndex]];
        // set default type to "text"
        const type = argTree.type || "text";
        // we declare the label for the VALUE case
        if (isVALUE && argTree.defaultLabel) {
            selectedChoice.label = argTree.defaultLabel;
        }
        // whether we're at a possible end of path or not
        // we're using null here since arguments at end of path will equal to null
        const isEnd = selectedChoice === null || (argTree.last && (argsLeft.length === 1));
        // wheter we need to concat what's left to the argument input into the last argument
        const input = selectedChoice === null && argTree.last ? argsLeft.join(" ") : argsLeft[0];
        // resolve the type of the input
        result.push(await resolver[type](input, message, argTree));
        // do the usage of the next argument to have clearer usage display on error
        // it's useless to do it for the last argument when isEnd is true since there is no more prevision to do
        if(!(selectedChoice === null) && !isEnd) {
            const nextChoiceArray = Object.keys(selectedChoice.choice);
            let nextChoiceIndex = nextChoiceArray.indexOf(argsLeft[1]);
            if(nextChoiceIndex === -1) {
                nextChoiceIndex = nextChoiceArray.indexOf("VALUE");
                if(nextChoiceIndex === -1) {
                    usage += selectedChoice.label ? `<${selectedChoice.label}> ` : `<${nextChoiceArray.join(" | ")}> `;
                    throw missingArg(message, usage);
                } else {
                    usage += selectedChoice.label ? `<${selectedChoice.label}> ` : `<VALUE> `;
                }
            } else {
                usage += selectedChoice.label ? `<${selectedChoice.label}> ` : `<${argsLeft[1]}> `;
            }
        }
        // if we run out of input argument before the end of the path
        if(argsLeft.length === 1 && selectedChoice !== null) {
            throw missingArg(message, usage);
        }
        // if there is no more path to follow or we stop at a `last` argument
        if(isEnd) {
            return result;
        } else {
            argsLeft.splice(0, 1);
            return await recursiveArgTree(selectedChoice, argsLeft, message, result, usage);
        }
    } catch(err) {
        if(err instanceof EmbedError) {
            message.channel.send(err.embed);
            return [];
        } else if(err instanceof resolver.ResolverError) {
            const { embed } = new EmbedError(message, {
                error: err.message,
                data: err.data
            });
            message.channel.send(embed);
        } else {
            console.error(err);
        }
    }
}

function missingArg(message, usage) {
    return new EmbedError(message, {
        error: "wiggle.missingArgs",
        data: {
            command: message.command.name,
            usage
        }
    });
}
/**
 *
 async function recursiveArgTree(argTree, args, message, result = [], usage = "") { // eslint-disable-line
    const argsLeft = args.slice();
    if(argTree.next && !(argTree.last && argsLeft.length === 0)) {
        try {
            const nextArgs = Object.keys(argTree.next);
            let nextIndex = nextArgs.indexOf(argsLeft[0]);
            const next = nextArgs[nextIndex];
            if(nextIndex === -1) {
                nextIndex = nextArgs.indexOf("VALUE");
                usage += argTree.label ? `<${argTree.label}> ` : `<${nextArgs.join(" | ")}> `;
            } else {
                usage += argTree.label ? `${argTree.label} ` : `${next} `;
            }
            if(nextIndex === -1 || argsLeft.length === 0) {
                const error = {
                    error: "wiggle.partialArgs",
                    data: {
                        command: message.command.name,
                        usage: usage
                    }
                };
                const { embed } = new EmbedError(message, error);
                message.channel.send(embed);
            } else {
                console.log(argTree, argsLeft[0]);
                result[result.length] = await resolver[argTree.type](argsLeft[0], message, argTree);
                argsLeft.splice(0, 1);
                return await recursiveArgTree(argTree.next[nextArgs[nextIndex]], argsLeft, message, result, usage);
            }
        } catch(err) {
            const error = {
                error: err.message,
                data: err.data
            };
            if(error.data) error.data.usage = usage;
            const { embed } = new EmbedError(message, error);
            message.channel.send(embed);
        }
    } else {
        const usedArg = args.join(" ");
        try {
            usage += argTree.label ? `<${argTree.label}> ` : "<value>";
            if(argTree.last) {
                result.push(usedArg);
                return result;
            }
            if(usedArg === "") {
                const error = {
                    error: "wiggle.partialArgsEnd",
                    data: {
                        command: message.command.name,
                        usage: usage
                    }
                };
                const { embed } = new EmbedError(message, error);
                return message.channel.send(embed);
            }
            result[result.length] = await resolver[argTree.type](usedArg, message, argTree);
            return result;
        } catch(err) {
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

 */
