const discord = require("discord.js");
class EmbedError {
    constructor(context, { error, data, color }, input = true) {
        const isUsed = context.command.embedError;
        if(isUsed) {
            this.embed = new discord.RichEmbed()
                .setFooter(context.t("wiggle.embed.footer", { tag: context.author.tag }))
                .setColor(color || "RED")
                .setTimestamp();
            if(input) this.embed.addField(context.t("words.input"), context.originalContent);
            this.embed.addField(context.t("words.error"), context.t(error, data));
        } else {
            this.embed = context.t(error, data);
        }
    }
}
module.exports = EmbedError;
