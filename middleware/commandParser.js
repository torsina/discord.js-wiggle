/**
 MIT License

 Copyright (c) 2017 minemidnight

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in all
 copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 SOFTWARE.
 */
const EmbedError = require("../lib/EmbedError");
const commandParser = async (message, next, wiggle) => {
    let prefixes;
    if(wiggle.get("getPrefixes")) prefixes = await wiggle.get("getPrefixes")(message);
    else prefixes = wiggle.get("prefixes") || ["mention"];

    prefixes = prefixes.filter((ele, i, arr) => arr.indexOf(ele) === i);
    if(~prefixes.indexOf("mention")) prefixes[prefixes.indexOf("mention")] = `<@!?${wiggle.discordClient.user.id}>`;
    const prefixRegex = new RegExp(`^(?:${prefixes.join("|")}),?(?:\\s+)?([\\s\\S]+)`, "i");

    message.originalContent = message.content;
    let match = message.content.match(prefixRegex);
    if(!match && message.channel.guild) return next();
    else if(match) [, message.content] = match;

    let command;
    if(!~message.content.indexOf(" ")) {
        command = message.content;
        message.content = "";
    } else {
        command = message.content.substring(0, message.content.indexOf(" "));
        message.content = message.content.substring(message.content.indexOf(" ")).trim();
    }
    command = command.toLowerCase().trim();

    const middlewares = wiggle._middleware.reduce((total, mid) => {
        if(mid.type === "category") {
            const commands = [...mid.category._middleware].filter(mid2 => mid2.type === "command");
            total = total.concat(commands);
        } else if(mid.type === "command") {
            total.push(mid);
        }

        return total;
    }, []);

    command = middlewares.find(middleware => middleware.name === command || ~middleware.command.aliases.indexOf(command));
    if(!command) {
        return next();
    } else if(command.command.guildOnly === true && !message.channel.guild) {
        const { embed } = new EmbedError(message, { error: "wiggle.commands.error.guildOnly" });
        return message.channel.send(embed);
    }

    if(!command.command.caseSensitive) message.content = message.content.toLowerCase();

    message.command = command.command;
    if(message.command.onCooldown(message.author)) {
        const error = {
            error: "wiggle.commands.error.cooldown",
            data: {
                seconds: message.command.cooldown.time / 1000,
                times: message.command.cooldown.uses
            }
        };
        const { embed } = new EmbedError(message, error);
        return message.channel.send(embed);
    }
    console.log(message.command);
    if(message.command.nsfwOnly && message.channel && !message.channel.nsfw) {
        const { embed } = new EmbedError(message, { error: "wiggle.commands.error.nsfwOnly" });
        return message.channel.send(embed);
    }

    return next();
};

module.exports = () => commandParser;
