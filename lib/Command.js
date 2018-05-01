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
const resolver = require("./resolver.js");
const EmbedError = require("./EmbedError");
class Command {
    constructor(wiggle, name, ...extra) {
        let options = {};
        if(extra.length === 1) {
            this.process = extra[0];
        } else {
            this.process = extra[1];
            options = extra[0];
        }
        Object.entries(options).forEach(([key, value]) => this[key] = value);
        this.locals = {};
        this.name = name;
        this.aliases = options.aliases || [];
        this.args = options.args || [];
        this.argParser = options.argPandler || null;
        this.flags = options.flags || [];
        this.category = options.category || "default";
        this.caseSensitive = !!options.caseSensitive;
        this.guildOnly = !!options.guildOnly;
        this.nsfwOnly = !!options.nsfwOnly;
        this.EmbedError = EmbedError;
        this.cooldowns = new Map();

        if(options.cooldown) {
            if(Array.isArray(options.cooldown)) {
                this.cooldown = { time: options.cooldown[0], uses: options.cooldown[1] };
            } else if(typeof options.cooldown === "object") {
                this.cooldown = options.cooldown;
            } else {
                this.cooldown = { time: options.cooldown, uses: 1 };
            }
        } else {
            this.cooldown = {};
        }

        if(!this.args.length && !this.flags.length) {
            this.usage = "[]";
        } else if(this.args.length) {
            this.usage = this.args.reduce((usage, arg) => {
                arg.label = arg.label || arg.type;
                usage += arg.optional ? `[${arg.label}] ` : `<${arg.label}> `;
                return usage;
            }, "").trim();
        }

        if(this.flags.length) this.usage += " ";
        this.usage += this.flags.reduce((usage, flag) => {
            usage += ` --${flag.name}`;
            if(flag.short) usage += `|-${flag.short}`;
            if(flag.type && flag.default !== undefined) {
                usage += ` [${flag.type}=${flag.default}]`;
            } else {
                usage += ` [${flag.type}]`;
            }

            return usage;
        }, "").trim();
    }

    onCooldown(user) {
        return this.cooldowns.has(user.id);
    }

    addCooldown(user) {
        if(!this.cooldown) return;

        let cooldowns = this.cooldowns.get(user.id);
        if(cooldowns) this.cooldowns.set(user.id, cooldowns + 1);
        else this.cooldowns.set(user.id, 1);

        setTimeout(() => {
            cooldowns = this.cooldowns.get(user.id);
            if(cooldowns === 1) this.cooldowns.delete(user.id);
            else this.cooldowns.set(user.id, cooldowns - 1);
        }, this.cooldown.time);
    }

    async run(message, next, wiggle) {
        const { command } = this;
        if(command.sendTyping) message.channel.startTyping(1);

        const context = {
            args: message.args,
            author: message.author,
            member: message.member,
            category: command.category,
            channel: message.channel,
            client: wiggle.discordClient,
            content: message.content,
            command,
            flags: message.flags,
            guild: message.guild,
            message,
            reply: (content, file) => {
                let params = [undefined, undefined];
                if(typeof content === "object" && content.embed) params[0] = { embed: content.embed };
                else if(typeof content === "object" && content.file) params[1] = content.file;
                else if(file) params[1] = file;
                else if(typeof content === "object" && Array.isArray(content)) params = content;
                else if(typeof content === "undefined" || content === null) return undefined;
                else params = [content];

                return message.channel.send(...params);
            },
            resolver,
            t: message.t, // eslint-disable-line id-length
            wiggle
        };

        const result = await command.process(context, next);
        command.addCooldown(message.author);
        if(command.sendTyping) message.channel.stopTyping();
        if(command.replyResult) context.reply(result);
    }
}

module.exports = Command;
