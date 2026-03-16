// events/voiceStatePonto.js — Bate-ponto automático por canal de voz
const { Events, EmbedBuilder } = require('discord.js');
const config = require('../config.json');
const db     = require('../database/database');

const nomeBot = () => config.nomeBot || 'Fuminho';
const VERDE   = 0x2ECC71;
const VERMELHO= 0xE74C3C;

module.exports = {
    name: Events.VoiceStateUpdate,
    async execute(oldState, newState) {
        try {
            const callPontoId = config.canais?.call_ponto;
            if (!callPontoId || callPontoId.startsWith('SEU_')) return;

            const membro  = newState.member || oldState.member;
            if (!membro || membro.user.bot) return;

            const guildId = (newState.guild || oldState.guild).id;
            const uid     = membro.user.id;

            const entrou = !oldState.channelId && newState.channelId === callPontoId;
            const saiu   = oldState.channelId === callPontoId && newState.channelId !== callPontoId;

            if (!entrou && !saiu) return;

            const tipo   = entrou ? 'entrada' : 'saida';
            const ultimo = db.getUltimoPonto(uid, guildId);

            // Evita duplicata
            if (tipo === 'entrada' && ultimo?.tipo === 'entrada') return;
            if (tipo === 'saida'   && (!ultimo || ultimo.tipo === 'saida')) return;

            const reg = db.baterPonto(uid, membro.user.tag, membro.displayName, tipo, guildId);

            let tempoPeriodo = '';
            if (tipo === 'saida' && ultimo) {
                const ms  = reg.timestamp - ultimo.timestamp;
                const min = Math.floor(ms / 60_000);
                const h   = Math.floor(min / 60);
                const m   = min % 60;
                tempoPeriodo = `> ⏱️  **Tempo trabalhado:** \`${h}h ${m}min\``;
            }

            const canalTextoId = config.canais?.ponto;
            let canalTexto = null;
            if (canalTextoId && !canalTextoId.startsWith('SEU_')) {
                try { canalTexto = await (newState.guild || oldState.guild).channels.fetch(canalTextoId); } catch (_) {}
            }
            if (!canalTexto) canalTexto = newState.channel || oldState.channel;
            if (!canalTexto?.send) return;

            const embed = new EmbedBuilder()
                .setColor(entrou ? VERDE : VERMELHO)
                .setTitle(entrou ? '🟢  CHEGOU NA CALL — PONTO REGISTRADO' : '🔴  SAIU DA CALL — PONTO FECHADO')
                .setDescription(
                    `> 👤  **Membro:** ${membro}\n` +
                    `> 🕐  **Horário:** \`${reg.data}\`\n` +
                    (tempoPeriodo ? tempoPeriodo + '\n' : '') +
                    `> 🎙️  **Canal:** \`${entrou ? newState.channel?.name : oldState.channel?.name}\``
                )
                .setThumbnail(membro.user.displayAvatarURL({ dynamic: true }))
                .setFooter({ text: `${nomeBot()} 🌿  ·  Ponto automático por voz` })
                .setTimestamp();

            const msg = await canalTexto.send({ embeds: [embed] });
            setTimeout(() => msg.delete().catch(() => {}), 30000);

        } catch (err) {
            console.error('Erro no voiceStatePonto:', err.message);
        }
    }
};
