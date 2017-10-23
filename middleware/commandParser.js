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
const discord = require("discord.js");
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
        if(command.command.embedError) {
            const embed = new discord.RichEmbed();
            embed.addField(message.t("words.input"), message.originalContent)
                .addField(message.t("words.error"), message.t("wiggle.commands.error.guildOnly"))
                .setColor("RED")
                .setTimestamp()
                .setFooter(message.t("wiggle.embed.footer", { tag: message.author.tag }));
            return message.channel.send(embed);
        } else {
            return message.channel.send(message.t("wiggle.commands.error.guildOnly"));
        }
    }

    if(!command.command.caseSensitive) message.content = message.content.toLowerCase();
    message.command = command.command;

    return next();
};

module.exports = () => commandParser;
