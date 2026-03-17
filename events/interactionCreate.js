// events/interactionCreateAdmin.js — Fuminho Bot
const { EmbedBuilder, MessageFlags } = require('discord.js');
const config = require('../config.json');

function isOwner(i) { return i.user.id === config.ownerId; }
function denyOwner(i) { return i.reply({ content: '🚫 Só o dono pode usar isso.', flags: [MessageFlags.Ephemeral] }); }

async function handleDesligar(interaction) {
    if (!isOwner(interaction)) return denyOwner(interaction);
    const embed = new EmbedBuilder().setColor('Red')
        .setTitle('🔴  FUMINHO DESLIGANDO')
        .setDescription('> O bot vai desligar em instantes...')
        .setFooter({ text: `Solicitado por ${interaction.member.displayName}` })
        .setTimestamp();
    await interaction.reply({ embeds: [embed] });
    setTimeout(() => process.exit(0), 2000);
}

async function handleReiniciar(interaction) {
    if (!isOwner(interaction)) return denyOwner(interaction);
    const embed = new EmbedBuilder().setColor('Orange')
        .setTitle('🔄  FUMINHO REINICIANDO')
        .setDescription('> O bot vai reiniciar em instantes...')
        .setFooter({ text: `Solicitado por ${interaction.member.displayName}` })
        .setTimestamp();
    await interaction.reply({ embeds: [embed] });
    setTimeout(() => process.exit(1), 2000);
}

async function handleLimpar(interaction) {
    if (!isOwner(interaction)) return denyOwner(interaction);

    // Verifica se o canal existe e é acessível antes de tudo
    const channel = interaction.channel;
    if (!channel) {
        try { await interaction.reply({ content: '❌ Canal não encontrado.', flags: [MessageFlags.Ephemeral] }); } catch (_) {}
        return;
    }

    try {
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
    } catch (_) { return; }

    let totalApagadas = 0;

    try {
        // ── Recentes (< 14 dias) — bulk delete ───────────────────────
        let continuar = true;
        while (continuar) {
            let msgs;
            try { msgs = await channel.messages.fetch({ limit: 100 }); }
            catch (_) { break; }

            const recent = msgs.filter(m => Date.now() - m.createdTimestamp < 14 * 24 * 60 * 60 * 1000);
            if (recent.size === 0) { continuar = false; break; }

            try {
                const deleted = await channel.bulkDelete(recent, true);
                totalApagadas += deleted.size;
                if (deleted.size < 2) continuar = false;
            } catch (_) { continuar = false; }

            await new Promise(r => setTimeout(r, 1200));
        }

        // ── Antigas (> 14 dias) — uma por uma ────────────────────────
        let continuarAntigas = true;
        while (continuarAntigas) {
            let msgs;
            try { msgs = await channel.messages.fetch({ limit: 100 }); }
            catch (_) { break; }

            if (msgs.size === 0) { continuarAntigas = false; break; }

            let apagouAlguma = false;
            for (const msg of msgs.values()) {
                try {
                    await msg.delete();
                    totalApagadas++;
                    apagouAlguma = true;
                    await new Promise(r => setTimeout(r, 700));
                } catch (_) {}
            }
            if (!apagouAlguma) continuarAntigas = false;
        }

        try {
            await interaction.editReply({
                content: `✅ **${totalApagadas}** mensagem(ns) apagada(s)! Canal limpo 🌿`
            });
        } catch (_) {}

        console.log(`🧹 ${totalApagadas} msgs apagadas em #${channel.name} por ${interaction.user.tag}`);

    } catch (error) {
        console.error('Erro ao limpar:', error.message);
        try {
            await interaction.editReply({ content: `❌ Erro: ${error.message}` });
        } catch (_) {}
    }
}

module.exports = { handleDesligar, handleReiniciar, handleLimpar };
