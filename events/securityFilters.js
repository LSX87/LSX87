// events/securityFilters.js
// Segurança: links, imagens, palavras proibidas, spam → timeout ou ban
const { EmbedBuilder } = require('discord.js');
const config = require('../config.json');
const db     = require('../database/database');

const LINK_PATTERNS = [
    /discord\.gg\/[a-zA-Z0-9]+/gi,
    /bit\.ly\/[^\s]+/gi,
    /tinyurl\.com\/[^\s]+/gi,
    /goo\.gl\/[^\s]+/gi,
    /discord\.nitro\.[a-z]+/gi,
    /\b(phishing|scam)\b/gi,
    /\b(malware|virus|trojan|ransomware)\b/gi,
    /free.*nitro/gi,
    /https?:\/\/(?!(?:www\.)?(?:youtube\.com|youtu\.be|twitch\.tv|imgur\.com|discord\.com|discordapp\.com))[^\s]+/gi,
];

// Anti-spam: conta mensagens por usuário em janela de tempo
const spamMap = new Map();

async function checkSecurityFilters(message) {
    if (!message.guild || !message.member) return false;

    const seg = config.seguranca;
    if (!seg?.ativo) return false;

    // Ignora staff, dono e cargos ignorados
    const isStaff = message.member.roles.cache.has(config.cargos?.staff);
    const isOwner = message.author.id === config.ownerId;
    if (isStaff || isOwner) return false;

    // Ignora canais configurados para ignorar
    const canaisIgn = seg.canaisIgnorados || [];
    if (canaisIgn.includes(message.channel.id)) return false;

    let motivo = null;

    // ── 1. Links suspeitos ──────────────────────────────────────────────────
    if (seg.banirLinks) {
        const lower = message.content.toLowerCase();
        for (const pattern of LINK_PATTERNS) {
            pattern.lastIndex = 0;
            if (pattern.test(lower)) { motivo = '🔗 Link suspeito/não autorizado'; break; }
        }
    }

    // ── 2. Imagens/arquivos ─────────────────────────────────────────────────
    if (!motivo && seg.banirImagens && message.attachments.size > 0) {
        motivo = '🖼️ Envio de imagem/arquivo não autorizado';
    }

    // ── 3. Palavras proibidas ───────────────────────────────────────────────
    if (!motivo && seg.palavrasProibidas?.length > 0) {
        const lower = message.content.toLowerCase();
        for (const palavra of seg.palavrasProibidas) {
            if (lower.includes(palavra.toLowerCase())) {
                motivo = `🤬 Palavra proibida detectada`;
                break;
            }
        }
    }

    // ── 4. Anti-spam ────────────────────────────────────────────────────────
    if (!motivo && seg.maxMensagens > 0) {
        const uid = message.author.id;
        const agora = Date.now();
        if (!spamMap.has(uid)) spamMap.set(uid, []);
        const timestamps = spamMap.get(uid).filter(t => agora - t < (seg.tempoJanela || 3000));
        timestamps.push(agora);
        spamMap.set(uid, timestamps);
        if (timestamps.length >= seg.maxMensagens) {
            motivo = '📨 Spam detectado';
            spamMap.delete(uid);
        }
    }

    if (motivo) {
        await aplicarPunicao(message, motivo);
        return true;
    }
    return false;
}

async function aplicarPunicao(message, motivo) {
    const { guild, author, channel, member } = message;
    const seg     = config.seguranca;
    const punicao = seg?.punicao || 'timeout'; // 'timeout' | 'ban' | 'kick'

    try {
        await message.delete().catch(() => {});

        let tipoPunicao = '';
        let descPunicao = '';

        if (punicao === 'ban') {
            await member.ban({ reason: `Segurança: ${motivo}`, deleteMessageSeconds: 0 });
            tipoPunicao = '🔨 Banido';
            descPunicao = 'permanente';
        } else if (punicao === 'kick') {
            await member.kick(`Segurança: ${motivo}`);
            tipoPunicao = '👢 Expulso';
            descPunicao = 'removido do servidor';
        } else {
            // Timeout (padrão)
            const minutos = seg?.timeoutMinutos || 10;
            const ms      = minutos * 60 * 1000;
            await member.timeout(ms, `Segurança: ${motivo}`);
            tipoPunicao = '⏱️ Silenciado';
            descPunicao = `${minutos} minuto(s)`;
        }

        console.log(`🔴 PUNIÇÃO [${tipoPunicao}]: ${author.tag} — ${motivo}`);

        // Aviso no canal
        const aviso = await channel.send({
            content: `> ⚠️ **${author.username}** foi **${tipoPunicao}** por: *${motivo}*`
        });
        setTimeout(() => aviso.delete().catch(() => {}), 8000);

        // Salva no banco
        await db.logPunicao(author.id, author.tag, guild.id, motivo, tipoPunicao);

        // Log embed
        await sendLogEmbed(guild,
            `🚨 Punição Automática — ${tipoPunicao}`,
            `**Usuário:** ${author.tag} (\`${author.id}\`)\n` +
            `**Motivo:** ${motivo}\n` +
            `**Canal:** <#${channel.id}>\n` +
            `**Duração:** ${descPunicao}`,
            'Red'
        );

    } catch (err) {
        console.error('❌ Erro ao punir:', err.message);
    }
}

async function sendLogEmbed(guild, title, description, color) {
    const canalId = config.canais?.logs;
    if (!canalId || canalId === 'SEU_CANAL_LOGS') return;
    try {
        const canal = await guild.channels.fetch(canalId).catch(() => null);
        if (!canal) return;
        const embed = new EmbedBuilder()
            .setColor(color).setTitle(title).setDescription(description)
            .setTimestamp()
            .setFooter({ text: `${config.nomeServidor || 'Oficina'} — Segurança` });
        await canal.send({ embeds: [embed] });
    } catch (_) {}
}

module.exports = { checkSecurityFilters, sendLogEmbed };
