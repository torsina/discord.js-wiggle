const discord = require("discord.js");
class EmbedError {
    constructor(message, { error, data, color }, input = true) {
        const isUsed = message.command.embedError;
        if(isUsed) {
            this.embed = new discord.RichEmbed()
                .setFooter(message.t("wiggle.embed.footer", { tag: message.author.tag }))
                .setColor(color || "RED")
                .setTimestamp();
            if(input) this.embed.addField(message.t("words.input"), message.originalContent);
            this.embed.addField(message.t("words.error"), message.t(error, data));
        } else {
            this.embed = message.t(error, data);
        }
    }
}
module.exports = EmbedError;
