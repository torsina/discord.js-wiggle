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
const Category = require("./Category");
const Command = require("./Command");
const Discord = require("discord.js");
const fs = require("fs");
const translate = require("./translate");
const Locale = require("./Locale");
const middleware = require("./middleware");
const path = require("path");

class Wiggle {
    constructor(clientOption = {}) {
        this.commands = new Discord.Collection();
        this.categories = new Discord.Collection();
        this.discordClient = null;
        this.clientOptions = clientOption;
        this.locals = { options: {} };

        this._events = [];
        this._middleware = [];
        this._t = translate;
        this._locales = new Map();
        this._locales.set("en", new Locale(path.resolve(__dirname, "locales", "en.json")));

        this.use("message", async (message, next, wiggle) => {
            if(this.get("localeFunction")) await this.get("localeFunction")(message);

            message.t = (context, data) => this._t(message.locale || "en", context, data, wiggle); // eslint-disable-line id-length, max-len
            if(message.channel.guild) {
                message.channel.guild.t = (context, data) => { // eslint-disable-line id-length
                    this._t(message.channel.guild.locale || "en", context, data, wiggle);
                };
            }

            next();
        });
    }

    connect() {
        this.discordClient.login(this.clientOptions.token).catch(console.error);
    }

    command(...params) {
        const command = new Command(this, ...params);
        if(!this.commands.has(command.name)) {
            this.commands.set(command.name, new Discord.Collection())
                .get(command.name)
                .set(command.name, command);
        }

        this.use(command);
        return this;
    }

    get(name) {
        return this.locals.options[name];
    }

    set(name, value) {
        switch(name) {
            case "token": {
                this.clientOptions.token = value;
                this.discordClient = new Discord.Client(this.clientOptions);
                break;
            }
            case "commands": {
                value = require("path").resolve(value);
                if(!fs.existsSync(value)) throw new Error(`Invalid path: ${value}`);

                fs.readdirSync(value)
                    .filter(file => fs.lstatSync(path.resolve(value, file)).isDirectory())
                    .forEach(folder => {
                        const category = module.exports.Category(folder, Object.assign({}, this.get("commandOptions") || {})); // eslint-disable-line new-cap, max-len
                        fs.readdirSync(path.resolve(value, folder))
                            .filter(file => path.extname(file) === ".js")
                            .filter(file => !fs.lstatSync(path.resolve(value, folder, file)).isDirectory())
                            .forEach(file => {
                                const scriptExports = require(path.resolve(value, folder, file));
                                let run = scriptExports.run;
                                delete scriptExports.run;

                                category.command(path.basename(file, ".js"), scriptExports, run);
                            });

                        this.use(category);
                    });
                break;
            }
            case "listeners": {
                value = require("path").resolve(value);
                if(!fs.existsSync(value)) throw new Error(`Invalid path: ${value}`);

                fs.readdirSync(value)
                    .filter(file => path.extname(file) === ".js")
                    .filter(file => !fs.lstatSync(path.resolve(value, file)).isDirectory())
                    .forEach(file => this.use(path.basename(file, ".js"), require(path.resolve(value, file))));
                break;
            }
            case "locales": {
                const locales = this._locales;
                value = path.resolve(value);
                if(!fs.existsSync(value)) throw new Error(`Invalid path: ${value}`);

                fs.readdirSync(value)
                    .map(file => path.resolve(value, file))
                    .filter(file => fs.lstatSync(file).isDirectory() || ~[".js", ".json"].indexOf(path.extname(file)))
                    .forEach(file => {
                        let locale = new Locale(file);

                        const localeName = path.basename(file, path.extname(file));
                        if(localeName === "en") locale.merge(locales.get("en"));
                        locales.set(localeName, locale);
                    });

                break;
            }
        }

        this.locals.options[name] = value;
        return this;
    }

    use(...params) {
        this._middleware = this._middleware.concat(middleware(this, ...params));
        if(params[0] instanceof Category) this.categories.set(params[0].name, params[0]);
        return this;
    }

    _listen(eventName) {
        if(!this.discordClient) {
            process.nextTick(() => this._listen(eventName));
            return;
        } else if(~this._events.indexOf(eventName)) {
            return;
        }

        this._events.push(eventName);
        const handler = async (...params) => {
            let allMiddles = this._middleware.reduce((total, mid) => {
                if(mid.type === "category" && !mid._function) total = total.concat(mid.category._middleware);
                else total.push(mid);
                return total;
            }, []);

            allMiddles = [
                ...allMiddles.splice(0, 2),
                ...allMiddles.filter(mid => ~["category", "unknown"].indexOf(mid.type)),
                ...allMiddles.filter(mid => !~["category", "unknown", "command"].indexOf(mid.type)),
                ...allMiddles.filter(mid => mid.type === "command")
            ];

            for(let middle of allMiddles) {
                let run = false;
                if(middle.type === "event" && middle.event === eventName) {
                    run = true;
                } else if(middle.type === "global") {
                    if(eventName === "message" && middle.category && params[0].command &&
      params[0].command.category === middleware.category) {
                        run = true;
                    } else if(!middle.category) {
                        run = true;
                    }
                } else if(eventName === "message") {
                    if(middle.type === "command" && params[0].command && params[0].command.name === middle.name) {
                        run = true;
                    } else if(middle.type === "category" && params[0].command &&
      params[0].command.category === middle.name) {
                        run = true;
                    } else if(middle.type === "unknown" && params[0].command &&
       (params[0].command.name === middle.name ||
       (params[0].command.category === middle.name))) {
                        run = true;
                    }
                }

                if(run) await new Promise(resolve => middle._function(...params, resolve, this));
            }
        };

        this.discordClient.on(eventName, handler);
    }
}

module.exports = (...params) => new Wiggle(...params);
module.exports.Category = (...params) => new Category(...params);
module.exports.middleware = {
    argHandler: require("../middleware/argHandler"),
    dbots: require("../middleware/dbots"),
    dbotsOrg: require("../middleware/dbotsOrg"),
    carbonitex: require("../middleware/carbonitex"),
    commandParser: require("../middleware/commandParser")
};
