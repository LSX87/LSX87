// commands/hipster.js — Comando /hipster para reescrever em tom hippie
// Totalmente pronto para usar!

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { reescreverHipster } = require('../src/utils/hipsterRewriter');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('hipster')
        .setDescription('🌿 Reescreve qualquer coisa em tom hippie/maconheiro')
        .addStringOption(option =>
            option
                .setName('texto')
                .setDescription('O que você quer reescrever?')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('modo')
                .setDescription('basico (rápido) ou ia (criativo)')
                .setRequired(false)
                .addChoices(
                    { name: '⚡ Básico (rápido)', value: 'basico' },
                    { name: '🤖 IA (muito criativo)', value: 'ia' }
                )
        ),
    
    async execute(interaction, config, database) {
        const texto = interaction.options.getString('texto');
        const modo = interaction.options.getString('modo') || 'basico';
        
        // Responder depois de 3 segundos (dar tempo de processar)
        await interaction.deferReply();
        
        try {
            // Reescrever o texto
            const resultado = await reescreverHipster(texto, modo);
            
            // Criar embed bonito
            const embed = new EmbedBuilder()
                .setColor(modo === 'ia' ? 0xFF6600 : 0x00FF00)
                .setTitle(`🌿 Reescrita Hipster - Modo ${modo === 'ia' ? 'IA' : 'Básico'}`)
                .addFields(
                    { 
                        name: '📝 Texto Original', 
                        value: `\`${texto}\``, 
                        inline: false 
                    },
                    { 
                        name: '✨ Reescrita Hippie', 
                        value: `\`${resultado}\``, 
                        inline: false 
                    }
                )
                .setFooter({ text: 'Reescritor Hipster v4' })
                .setTimestamp();
            
            await interaction.editReply({ embeds: [embed] });
            
        } catch (erro) {
            console.error('❌ Erro:', erro);
            await interaction.editReply({
                content: '❌ Erro ao reescrever! Tente novamente.',
                ephemeral: true
            });
        }
    }
};
