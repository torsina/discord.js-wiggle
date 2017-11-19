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
const linkRegex = /^((https|http|ftp|rtsp|mms)?:\/\/)?(([0-9a-z_!~*'().&=+$%-]+:)?[0-9a-z_!~*'().&=+$%-]+@)?(([0-9]{1,3}\.){3}[0-9]{1,3}|([0-9a-z_!~*'()-]+\.)*([0-9a-z][0-9a-z-]{0,61})?[0-9a-z]\.[a-z]{2,6})(:[0-9]{1,4})?((\/?)|(\/[0-9a-z_!~*'().;?:@&=+$,%#-]+)+\/?)$/im; // eslint-disable-line max-len

class ResolverError extends Error {
    constructor(path, data = {}) {
        super(path);
        this.data = data;
    }
}

function getUsers(input, users) {
    let matches = {
        1: [],
        2: [],
        3: []
    };

    input = input.toLowerCase();
    if(~input.indexOf("#")) {
        let index = input.lastIndexOf("#");
        var discrim = input.substring(index + 1);
        input = input.substring(0, index);
        if(isNaN(discrim)) discrim = false;
    }

    users.forEach(user => {
        let matchLevel = 0;
        let username = user.user ? user.user.username.toLowerCase() : user.username.toLowerCase();
        let nick = user.nickname ? user.nickname.toLowerCase() : null;

        if(discrim && (user.user ? user.user.discriminator : user.discriminator) === discrim) discrim = true;
        else if(discrim) return;

        if(user.id === input) matchLevel = 3;
        else if(nick && nick === input && discrim) matchLevel = 3;
        else if(username === input && discrim) matchLevel = 3;
        else if(nick && nick === input) matchLevel = 2;
        else if(username === input) matchLevel = 2;
        else if(username.startsWith(input)) matchLevel = 1;
        else if(nick && nick.startsWith(input)) matchLevel = 1;

        if(matchLevel) matches[matchLevel].push(user.user || user);
    });

    if(matches[3].length) return matches[3];
    else if(matches[2].length) return matches[2];
    else if(matches[1].length) return matches[1];
    else return undefined;
}

module.exports = {
    timespan: (input, message) => {
        const years = input.match(/(\d+)\s*y((ea)?rs?)?/) || ["", 0];
        const months = input.match(/(\d+)\s*(M|mo(nths?)?)/) || ["", 0];
        const weeks = input.match(/(\d+)\s*w((ee)?ks?)?/) || ["", 0];
        const days = input.match(/(\d+)\s*d(ays?)?/) || ["", 0];
        const hours = input.match(/(\d+)\s*h((ou)?rs?)?/) || ["", 0];
        const minutes = input.match(/(\d+)\s*m(?!o)(in(ute)?s?)?/) || ["", 0];
        const seconds = input.match(/(\d+)\s*s(ec(ond)?s?)?/) || ["", 0];
        const ms = input.match(/(\d+)\s*m(illi)?s(ec(ond)?s?)?/) || ["", 0];

        return (parseInt(years[1]) * 31536000000) +
            (parseInt(months[1]) * 2592000000) +
            (parseInt(weeks[1]) * 604800000) +
            (parseInt(days[1]) * 86400000) +
            (parseInt(hours[1]) * 3600000) +
            (parseInt(minutes[1]) * 60000) +
            (parseInt(seconds[1]) * 1000) +
            parseInt(ms[1]);
    },
    boolean: (input, message) => {
        if(~["enable", "yes", "true", "1"].indexOf(input)) return true;
        else if(~["disable", "no", "false", "0"].indexOf(input)) return false;
        else throw new ResolverError("wiggle.resolver.error.booleanError");
    },
    channel: (input, message) => {
        if(input.match(/<#(\d{17,21})>/)) input = input.match(/<#(\d{17,21})>/)[1];
        const foundChannel = message.guild.channels
            .find(ch => input === ch.id || ch.name.toLowerCase().includes(input.toLowerCase()));

        if(foundChannel) return foundChannel;
        else throw new ResolverError("wiggle.resolver.error.channelNotFound");
    },
    emoji: (input, message) => {
        const match = input.match(/<:([a-z0-9-_]{2,32}):(\d{17,21})>/i);
        if(!match) throw new ResolverError("wiggle.resolver.error.emojiNotFound");

        return {
            name: match[1],
            id: match[2],
            url: `https://cdn.discordapp.com/emojis/${match[2]}.png`
        };
    },
    float: (input, message, options = {}) => {
        input = parseFloat(input);
        if(isNaN(input)) throw new ResolverError("wiggle.resolver.error.NaN");
        if(options.min !== undefined && input < options.min) {
            throw new ResolverError("wiggle.resolver.error.belowMin", { min: options.min });
        } else if(options.max !== undefined && input > options.max) {
            throw new ResolverError("wiggle.resolver.error.aboveMax", { max: options.max });
        } else {
            return input;
        }
    },
    image: (input, message) => {
        let imageURL;
        if(message.attachments.length && message.attachments.first().width) {
            imageURL = message.attachments.first().url;
        } else if(linkRegex.test(input)) {
            imageURL = input;
        } else {
            try {
                let { url } = module.exports.emoji(input, message);
                imageURL = url;
            } catch(err) {
                try {
                    let { avatarURL } = module.exports.user(input, message);
                    imageURL = avatarURL;
                } catch(err2) {
                    throw new ResolverError("wiggle.resolver.error.noImage");
                }
            }
        }

        return imageURL;
    },
    int: (input, message, options = {}) => {
        input = parseInt(input);
        if(isNaN(input)) throw new ResolverError("wiggle.resolver.error.NaN");
        if(options.min !== undefined && input < options.min) {
            throw new ResolverError("wiggle.resolver.error.belowMin", { min: options.min });
        } else if(options.max !== undefined && input > options.max) {
            throw new ResolverError("wiggle.resolver.error.aboveMax", { max: options.max });
        } else {
            return input;
        }
    },
    invite: async (input, message) => {
        const match = input.match(/^discord(\\.gg|app\\.com\/invite)\/([a-z0-9-_]{2,16})$/i);
        if(match) [, input] = match;
        try {
            return await message.client.fetchInvite(input);
        } catch(err) {
            throw new ResolverError("wiggle.resolver.error.invalidInvite");
        }
    },
    link: (input, message) => {
        if(!linkRegex.test(input)) throw new ResolverError("wiggle.resolver.error.invalidLink");
        else return input.trim();
    },
    member: async (input, message) => {
        if(!message.channel.guild) throw new ResolverError("wiggle.resolver.error.cantResolveMember");
        const match = input.match(/<@!?(\d{17,21})>/);
        const user = await module.exports.user(input, message);
        let member = message.guild.members.get(user.id);
        if(member) return member;
        try {
            member = await message.guild.fetchMember(match[1]);
            return member;
        } catch(err) {
            throw new ResolverError("wiggle.resolver.error.noMemberFound");
        }
    },
    role: (input, message) => {
        if(input.match(/<@&(\d{17,21})>/)) input = input.match(/<@&(\d{17,21})>/)[1];
        const foundRole = message.guild.roles
            .find(role => input === role.id || role.name.toLowerCase().includes(input.toLowerCase()));

        if(foundRole) return foundRole;
        else throw new ResolverError("wiggle.resolver.error.roleNotFound");
    },
    text: (input, message, options = {}) => {
        if(options.max !== undefined && input.length > options.max) {
            throw new ResolverError("wiggle.resolver.error.stringAboveMax", { max: options.max });
        } else {
            return input;
        }
    },
    textChannel: (input, message) => {
        if(input.match(/<#(\d{17,21})>/)) input = input.match(/<#(\d{17,21})>/)[1];
        const foundChannel = message.guild.channels
            .filter(ch => ch.type === "text")
            .find(ch => input === ch.id || ch.name.toLowerCase().includes(input.toLowerCase()));

        if(foundChannel) return foundChannel;
        else throw new ResolverError("wiggle.resolver.error.channelNotFound");
    },
    user: async (input, message) => {
        const client = message.client;
        const match = input.match(/<@!?(\d{17,21})>/);
        if(match && match[1]) {
            let user = client.users.get(match[1]);
            if(user) return user;
            try {
                user = await client.fetchUser(match[1]);
                return user;
            } catch(err) {
                throw new ResolverError("wiggle.resolver.error.userNotCached");
            }
        }

        let users;
        if(message.channel.guild) users = getUsers(input, message.guild.members.users) || getUsers(input, client.users);
        else users = getUsers(input, client.users);

        if(!users || !users.length) throw new ResolverError("wiggle.resolver.error.noUserFound");
        else return users[0];
    },
    voiceChannel: (input, message) => {
        const foundChannel = message.guild.channels
            .filter(ch => ch.type === "voice")
            .find(ch => input === ch.id || ch.name.toLowerCase().includes(input.toLowerCase()));

        if(foundChannel) return foundChannel;
        else throw new ResolverError("wiggle.resolver.error.channelNotFound");
    }
};
