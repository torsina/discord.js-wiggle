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

const events = {
    channelCreate: "channelCreate",
    channelDelete: "channelDelete",
    channelPinsUpdate: "channelPinsUpdate",
    channelUpdate: "channelUpdate",
    clientUserGuildSettingsUpdate: "clientUserGuildSettingsUpdate",
    clientUserSettingsUpdate: "clientUserSettingsUpdate",
    debug: "debug",
    disconnect: "disconnect",
    emojiCreate: "emojiCreate",
    emojiDelete: "emojiDelete",
    emojiUpdate: "emojiUpdate",
    error: "error",
    guildBanAdd: "guildBanAdd",
    guildBanRemove: "guildBanRemove",
    guildCreate: "guildCreate",
    guildDelete: "guildDelete",
    guildMemberAdd: "guildMemberAdd",
    guildMemberAvailable: "guildMemberAvailable",
    guildMemberRemove: "guildMemberRemove",
    guildMembersChunk: "guildMembersChunk",
    guildMemberSpeaking: "guildMemberSpeaking",
    guildMemberUpdate: "guildMemberUpdate",
    guildUnavailable: "guildUnavailable",
    guildUpdate: "guildUpdate",
    message: "message",
    messageDelete: "messageDelete",
    messageDeleteBulk: "messageDeleteBulk",
    messageReactionAdd: "messageReactionAdd",
    messageReactionRemove: "messageReactionRemove",
    messageReactionRemoveAll: "messageReactionRemoveAll",
    messageUpdate: "messageUpdate",
    presenceUpdate: "presenceUpdate",
    ready: "ready",
    reconnecting: "reconnecting",
    resume: "resume",
    roleCreate: "roleCreate",
    roleDelete: "roleDelete",
    roleUpdate: "roleUpdate",
    typingStart: "typingStart",
    typingStop: "typingStop",
    userNoteUpdate: "userNoteUpdate",
    userUpdate: "userUpdate",
    voiceStateUpdate: "voiceStateUpdate",
    warn: "warn"
};

module.exports = (wiggle, ...callback) => {
    const middleware = { type: "global" };
    if(wiggle instanceof Category) middleware.category = wiggle.name;

    if(typeof callback[0] !== "function") {
        if(callback.length > 2) return callback.slice(1).map(cb => module.exports(wiggle, callback[0], cb));
        if(events[callback[0]]) {
            middleware.type = "event";
            middleware.event = events[callback[0]];
            wiggle._listen(middleware.event);
        } else if(callback[0] instanceof Command) {
            middleware.type = "command";
            middleware.command = callback[0];
            middleware.name = callback[0].name;
            callback.push(callback[0].run);
        } else if(callback[0] instanceof Category) {
            middleware.type = "category";
            middleware.category = callback[0];
            middleware.name = callback[0].name;

            if(!callback[1]) {
                callback[0].commands.forEach((command, name) => {
                    callback[0].commands.set(name, new Command(wiggle, name, ...command));
                    callback[0]._middleware = callback[0]._middleware.concat(
                        callback[0].commands.map(cmd => module.exports(wiggle, cmd))
                    );
                });

                return middleware;
            }
        } else if(typeof callback[0] === "string" && wiggle._middleware &&
    wiggle._middleware.find(mid => mid.name === callback[0])) {
            const target = wiggle._middleware.find(mid => mid.name === callback[0]);
            return module.exports(wiggle, target.category || target.command, ...callback.slice(1));
        } else {
            middleware.type = "unknown";
            middleware.name = callback[0].name || callback[0];
        }

        callback.shift();
    } else if(callback.length > 1) {
        return callback.map(cb => module.exports(wiggle, cb));
    }

    middleware._function = callback[0];
    return middleware;
};
