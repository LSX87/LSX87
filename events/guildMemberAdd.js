// events/guildMemberAdd.js — Fuminho Bot
const { Events, EmbedBuilder } = require('discord.js');
const config = require('../config.json');

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member) {
        try {
            const canalId = config.canais?.boas_vindas;
            if (!canalId) return;

            const canal = await member.guild.channels.fetch(canalId).catch(() => null);
            if (!canal) return;

            // Cargo de membro automático
            const cargoMembroId = config.cargos?.membro;
            if (cargoMembroId) {
                await member.roles.add(cargoMembroId).catch(err =>
                    console.error('[BOAS-VINDAS] Erro ao dar cargo:', err.message)
                );
            }

            const embed = new EmbedBuilder()
                .setColor(0x2ECC71)
                .setTitle('🌿 CHEGOU MAIS UM NO GUETO')
                .setDescription(
                    `> Salve, ${member}! Seja bem-vindo(a) ao **${member.guild.name}**.\n` +
                    `> Dá uma lida nas regras e se apresenta, brother!\n> \u200b`
                )
                .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                .addFields(
                    { name: '👥 Membros agora', value: `\`${member.guild.memberCount}\``, inline: true },
                    { name: '📜 Regras',        value: config.canais?.regras ? `<#${config.canais.regras}>` : 'Ver regras', inline: true }
                )
                .setFooter({ text: `${config.nomeBot || 'Fuminho'} 🌿` })
                .setTimestamp();

            await canal.send({ embeds: [embed] });
        } catch (err) {
            console.error('[BOAS-VINDAS] Erro:', err.message);
        }
    }
};
