module.exports = {
    run: async (context) => {
        console.log(context.args);
    },
    guildOnly: true,
    argTree: {
        // describe arg[0]
        // type "text" is used by default, so no need to declare it each time
        // the generated usage here will be "test <add | remove>"
        choice: {
            // "add" is one of the 2 correct options of arg[0]
            add: {
                // describe arg[1]
                // since we want a user input, we'll use VALUE as the only choice
                // since numbers as object properties will be parsed to string, we can't use numbers to specify a path
                // here, the last property means that the path can end at arg[1]
                // and be still valid (if no resolver error occur)
                // we use the `label` property to hide VALUE from showing in the usage and be more user friendly
                type: "int",
                min: 0,
                label: "price",
                choice: {
                    VALUE: {
                        // describe arg[2]
                        // still using "text" as type so no need to declare it
                        choice: {
                            more: {
                                // describe arg[3]
                                // here, the `last` property will gather every words of the input that are left to parse
                                // and will join them into arg[3]
                                last: true,
                                choice: { VALUE: null }
                            }
                        }
                    }
                }
            },
            // "remove" is one of the 2 correct options of arg[0]
            remove: null
            // the option is null, meaning that "remove" is the end of this argument path
        }
    }
};
