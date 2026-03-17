// events/voiceCommands.js — Comandos /entrar e /sair_voz
const { EmbedBuilder, MessageFlags } = require('discord.js');
const { entrarNoCanal, sairDoCanal } = require('../src/voice/voiceManager');
const { iniciarEscuta }              = require('../src/voice/voiceListener');
const { falarNoCanal }               = require('../src/voice/tts');
const config = require('../config.json');

const isStaff = i => i.member.roles.cache.has(config.cargos?.staff) || i.user.id === config.ownerId;

const canaisVoz = new Map();

async function handleEntrar(interaction) {
    if (!isStaff(interaction)) {
        return interaction.reply({
            content: '🚫 Só a Staff pode chamar o Fuminho pro canal, parceiro.',
            flags: [MessageFlags.Ephemeral]
        });
    }

    // Verifica se está em canal de voz
    const canalVozId = interaction.member.voice?.channelId;
    if (!canalVozId) {
        return interaction.reply({
            content: '🎙️ Você precisa estar em um canal de voz primeiro, parceiro!',
            flags: [MessageFlags.Ephemeral]
        });
    }

    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    console.log('[VOICE CMD] /entrar chamado por ' + interaction.user.tag + ' no canal ' + canalVozId);

    const conexao = await entrarNoCanal(interaction.member, interaction.guild);

    if (!conexao) {
        return interaction.editReply({
            content: [
                '❌ Não consegui entrar no canal de voz.',
                '',
                '**Verifique no Discord Developer Portal:**',
                '• Acesse discord.com/developers/applications',
                '• Seu bot → Bot → Ative: SERVER MEMBERS INTENT e MESSAGE CONTENT INTENT',
                '',
                '**Verifique as permissões do canal de voz:**',
                '• Clique com botão direito no canal → Editar Canal → Permissões',
                '• Adicione @Fuminho e ative: ✅ Conectar  ✅ Falar  ✅ Mover membros',
            ].join('\n')
        });
    }

    canaisVoz.set(interaction.guild.id, interaction.channel);
    iniciarEscuta(conexao, interaction.guild, interaction.channel, config.ownerId);

    // Saudação em voz após 1.5s
    setTimeout(async () => {
        try { await falarNoCanal(conexao, 'Salve família, Fuminho na área. Pode falar comigo, na paz.'); }
        catch (_) {}
    }, 1500);

    const embed = new EmbedBuilder()
        .setColor(0x2ECC71)
        .setTitle('🎙️  FUMINHO ENTROU NO CANAL')
        .setDescription(
            `> ✅ Conectado em <#${canalVozId}>\n` +
            `> 🤖 Escutando com IA Gemini\n` +
            `> 💬 Fale naturalmente — eu respondo em voz\n` +
            `> \u200b\n` +
            `> **Comandos de voz:**\n` +
            `> • _"Limpar X mensagens"_\n` +
            `> • _"Banir/Expulsar [nome]"_ (só Staff)\n` +
            `> • _"Mostrar rank"_\n` +
            `> • _"Sair do canal"_`
        )
        .setFooter({ text: `${config.nomeBot || 'Fuminho'} 🌿 · Voz → Gemini → Voz` })
        .setTimestamp();

    return interaction.editReply({ embeds: [embed], flags: [] });
}

async function handleSairVoz(interaction) {
    const saiu = sairDoCanal(interaction.guild.id);
    canaisVoz.delete(interaction.guild.id);

    if (!saiu) {
        return interaction.reply({
            content: 'Salve, não estou em nenhum canal de voz agora, parceiro.',
            flags: [MessageFlags.Ephemeral]
        });
    }

    return interaction.reply({
        embeds: [
            new EmbedBuilder()
                .setColor(0xE74C3C)
                .setTitle('🔴  FUMINHO SAIU DO CANAL')
                .setDescription('> Saí do canal. Usa `/entrar` pra chamar de volta, família.')
                .setTimestamp()
        ]
    });
}

module.exports = { handleEntrar, handleSairVoz, canaisVoz };
