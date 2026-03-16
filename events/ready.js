// events/ready.js — Fuminho Bot
const { Events, EmbedBuilder } = require('discord.js');
const config = require('../config.json');
const fs     = require('fs');
const path   = require('path');

const CHANGELOG_PATH = path.join(__dirname, '../changelog.json');

async function postarChangelog(client) {
    try {
        if (!fs.existsSync(CHANGELOG_PATH)) return;

        const changelog = JSON.parse(fs.readFileSync(CHANGELOG_PATH, 'utf8'));

        // Só posta se ainda não foi postado
        if (changelog.postado) return;

        const canalId = config.canais?.atualizacoes || '1482759968984928367';
        const canal   = await client.channels.fetch(canalId).catch(() => null);
        if (!canal) { console.log('[CHANGELOG] Canal não encontrado:', canalId); return; }

        const bullets = changelog.novidades.map(n => `• ${n}`).join('\n');

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle(`📋  ${changelog.titulo}`)
            .setDescription(bullets)
            .setFooter({ text: `${config.nomeBot || 'Fuminho'} 🌿  ·  v${changelog.versao}` })
            .setTimestamp();

        await canal.send({ embeds: [embed] });

        // Marca como postado para não repetir
        changelog.postado = true;
        fs.writeFileSync(CHANGELOG_PATH, JSON.stringify(changelog, null, 2), 'utf8');

        console.log(`[CHANGELOG] v${changelog.versao} postado em #${canal.name}`);
    } catch (err) {
        console.error('[CHANGELOG] Erro:', err.message);
    }
}

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        const bot = config.nomeBot || 'Fuminho';
        console.log(`${bot} Bot esta ativo! 🌿`);
        console.log(`Monitorando ${client.guilds.cache.size} servidor(es)`);

        // Posta changelog automaticamente se houver novidade
        await postarChangelog(client);
    }
};
