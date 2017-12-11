module.exports = {
    run: async ({ message, reply, t }) => {
        if(!message.flags.https) {
            message.channel.send(t("ping.success", {
                ms: Math.floor(message.client.ping)
            }));
        } else {
            const now = Date.now();
            const msg = await reply(t("ping.success", { ms: "pinging..." }));
            msg.edit(t("ping.success", { ms: Date.now() - now }));
            return undefined;
        }
    },
    flags: [{
        name: "https",
        type: "boolean",
        short: "h",
        default: false,
        aliases: ["http"]
    }],
    cooldown: 5000,
    nsfwOnly: true
};
