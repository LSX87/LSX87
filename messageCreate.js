// events/messageCreate.js — Fuminho Bot (sem orcamentos)
const { Events, EmbedBuilder } = require('discord.js');
const config = require('../config.json');
const db     = require('../database/database');
const { handleBauFlow }        = require('./messageCreateBau');
const { checkSecurityFilters } = require('./securityFilters');

const nomeBot = () => config.nomeBot || 'Fuminho';

async function handleAutoChat(message) {
    if (!config.chat?.ativo) return;
    const lower     = message.content.toLowerCase().trim();
    const respostas = db.getRespostas();
    for (const [gatilho, resposta] of Object.entries(respostas)) {
        if (lower.includes(gatilho.toLowerCase())) {
            const embed = new EmbedBuilder()
                .setColor(0x57F287)
                .setDescription(resposta)
                .setFooter({ text: `${nomeBot()} 🌿` });
            await message.reply({ embeds: [embed] });
            return;
        }
    }
}

async function logChatMessage(message) {
    if (!message.guild) return;
    await db.logChat(
        message.author.id, message.author.tag,
        message.member?.displayName || message.author.username,
        message.guild.id, message.channel.name, message.content
    );
}

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        if (message.author.bot) return;
        const punido = await checkSecurityFilters(message);
        if (punido) return;
        await logChatMessage(message);
        await handleBauFlow(message);
        // Respostas automáticas desativadas — use /resposta adicionar para configurar
        // await handleAutoChat(message);
    }
};