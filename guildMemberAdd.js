// events/guildMemberAdd.js — Fuminho Bot
const { Events, EmbedBuilder } = require('discord.js');
const config = require('../config.json');
const { sendLogEmbed } = require('./securityFilters');

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member) {
        try {
            const welcomeIds = config.cargos.welcome?.split(',').map(id => id.trim()) || [];
            for (const roleId of welcomeIds) {
                const cargo = member.guild.roles.cache.get(roleId);
                if (cargo) {
                    await member.roles.add(cargo).catch(() => {});
                    console.log(`Cargo "${cargo.name}" dado pra ${member.user.tag}`);
                }
            }
            await sendWelcomeMessage(member);
            await sendLogEmbed(
                member.guild,
                '🌿 Novo Membro no Gueto',
                `**Usuario:** ${member.user.tag} (${member.user.id})\n**Entrou em:** ${member.guild.name}`,
                'Green'
            );
        } catch (err) {
            console.error('Erro em guildMemberAdd:', err.message);
        }
    }
};

async function sendWelcomeMessage(member) {
    try {
        let welcomeChannel = null;
        if (config.canais?.boas_vindas && !config.canais.boas_vindas.startsWith('SEU_')) {
            welcomeChannel = await member.guild.channels.fetch(config.canais.boas_vindas).catch(() => null);
        }
        if (!welcomeChannel) {
            welcomeChannel = member.guild.channels.cache.find(
                c => c.name.toLowerCase().includes('bem-vindo') || c.name.toLowerCase().includes('welcome')
            );
        }
        if (!welcomeChannel) return;

        const bot = config.nomeBot || 'Fuminho';
        const embed = new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle(`🌿 Chegou mais um no Gueto!`)
            .setDescription(`Salve **${member.displayName}**, seja bem-vindo(a)! 🤙`)
            .addFields({
                name: '🌿 Por onde comecar?',
                value:
                    '1. Le as regras com `/regras`\n' +
                    '2. Ve o bau com `/bau`\n' +
                    '3. Checa o rank do mes com `/rank ver`\n' +
                    '4. Ve seus pontos com `/pontos ver`\n' +
                    '5. Fala com a Staff se precisar'
            })
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
            .setFooter({ text: `${bot} 🌿 · ${config.nomeServidor || 'Gueto'}` })
            .setTimestamp();

        await welcomeChannel.send({ embeds: [embed] });
    } catch (err) {
        console.error('Erro no welcome:', err.message);
    }
}
