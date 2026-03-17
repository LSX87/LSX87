// events/interactionCreate.js — Fuminho Bot
const {
    Events, EmbedBuilder, MessageFlags,
    ActionRowBuilder, ButtonBuilder, ButtonStyle,
    StringSelectMenuBuilder, RoleSelectMenuBuilder, ChannelSelectMenuBuilder,
    ModalBuilder, TextInputBuilder, TextInputStyle,
    ChannelType
} = require('discord.js');
const config = require('../config.json');
const db     = require('../database/database');
const { handleDesligar, handleReiniciar, handleLimpar } = require('./interactionCreateAdmin');
// voiceCommands carregado sob demanda (lazy) para não quebrar se voz falhar
let _voiceCmds = null;
function getVoice() {
    if (!_voiceCmds) {
        try { _voiceCmds = require('./voiceCommands'); }
        catch(e) { console.error('[VOICE] Módulo indisponível:', e.message); _voiceCmds = {}; }
    }
    return _voiceCmds;
}
// showBauContents lazy para não quebrar na inicialização
function getShowBau() {
    try { return require('./messageCreateBau').showBauContents; }
    catch(e) { console.error('[BAU] Erro ao carregar:', e.message); return null; }
}

const fmt     = v => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nomeBot = () => config.nomeBot || 'Fuminho';
const moeda   = () => config.moeda || 'R$';
const isStaff = i => i.member.roles.cache.has(config.cargos?.staff) || i.user.id === config.ownerId;

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        try {
            if (interaction.isChatInputCommand()) {
                switch (interaction.commandName) {
                    case 'ajuda':         return await handleAjuda(interaction);
                    case 'bau':           return await handleBau(interaction);
                    case 'rank':          return await handleRank(interaction);
                    case 'pontos':        return await handlePontos(interaction);
                    case 'ponto':         return await handlePonto(interaction);
                    case 'pontohistorico':return await handlePontoHistorico(interaction);
                    case 'chat':          return await handleChat(interaction);
                    case 'avisar':        return await handleAvisarStart(interaction);
                    case 'limpeza':       return await handleLimpeza(interaction);
                    case 'cargo':         return await handleCargo(interaction);
                    case 'regras':        return await handleRegras(interaction);
                    case 'enquete':       return await handleEnquete(interaction);
                    case 'notificar':     return await handleNotificar(interaction);
                    case 'config':        return await handleConfig(interaction);
                    case 'resposta':      return await handleResposta(interaction);
                    case 'nivel':         return await handleNivel(interaction);
                    case 'entrar':        return await (getVoice().handleEntrar || (i => i.reply({content:'🎙️ Sistema de voz indisponível.',flags:[64]})))(interaction);
                    case 'sair_voz':     return await (getVoice().handleSairVoz || (i => i.reply({content:'🎙️ Sistema de voz indisponível.',flags:[64]})))(interaction);
                    case 'desligar':      return await handleDesligar(interaction);
                    case 'reiniciar':     return await handleReiniciar(interaction);
                    case 'hipster':       return await handleHipster(interaction);
                    case 'limpar':        return await handleLimpar(interaction);
                }
            }
            if (interaction.isButton()) {
                if (interaction.customId.startsWith('aviso_tipo_')) return await handleAvisarTipo(interaction);
                if (interaction.customId.startsWith('cfg_'))        return await handleConfigBtn(interaction);
            }
            if (interaction.isChannelSelectMenu()) {
                if (interaction.customId === 'aviso_canal') return await handleAvisarCanal(interaction);
            }
            if (interaction.isRoleSelectMenu()) {
                if (interaction.customId === 'aviso_cargo') return await handleAvisarCargo(interaction);
            }
            if (interaction.isModalSubmit()) {
                if (interaction.customId === 'aviso_modal')       return await handleAvisarModal(interaction);
                if (interaction.customId.startsWith('cfg_modal_')) return await handleConfigModal(interaction);
            }
        } catch (err) {
            console.error('Erro em interacao:', err);
            try {
                const msg = { content: 'Deu ruim ai, parceiro. Tenta de novo.', flags: [MessageFlags.Ephemeral] };
                if (interaction.deferred) await interaction.editReply(msg).catch(() => {});
                else if (!interaction.replied) await interaction.reply(msg).catch(() => {});
            } catch (_) {}
        }
    }
};

async function getChannel(interaction, key) {
    const id = config.canais?.[key];
    if (id && !id.startsWith('SEU_')) {
        try { return await interaction.guild.channels.fetch(id); } catch (_) {}
    }
    return interaction.channel;
}

// ══════════════════════════════════════════════
//  /rank
// ══════════════════════════════════════════════
async function handleRank(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'ver') {
        await interaction.deferReply();
        const mesKey  = db.getMesKey();
        const rankingRaw = db.getRankOrdenado(mesKey);
        const meta    = config.rank?.metaMensal || 100000;
        const d       = new Date();
        const nomeMes = d.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

        // Mostra todos que depositaram, sem fetch por membro (evita rate limit)
        const ranking = rankingRaw.filter(r => r.valorTotal > 0);

        const totalDepositado = ranking.reduce((acc, r) => acc + r.valorTotal, 0);
        const pctMeta = Math.min(100, Math.round((totalDepositado / meta) * 100));
        const barras  = '█'.repeat(Math.round(pctMeta / 10)) + '░'.repeat(10 - Math.round(pctMeta / 10));

        const embed = new EmbedBuilder()
            .setColor(0xFEE75C)
            .setTitle(`🏆  RANK DO GUETO — ${nomeMes.toUpperCase()}`)
            .setDescription(
                `> 🎯 **Meta:** \`${moeda()} ${fmt(meta)}\`\n` +
                `> 💰 **Depositado:** \`${moeda()} ${fmt(totalDepositado)}\`\n` +
                `> 📊 **Progresso:** \`${barras}\` \`${pctMeta}%\`\n` +
                `> \u200b`
            )
            .setFooter({ text: `${nomeBot()} 🌿 · Só dinheiro sujo conta pro rank — firmeza` })
            .setTimestamp();

        if (ranking.length === 0) {
            embed.addFields({ name: '━━━━━━━  🏅  TOP  ━━━━━━━', value: '> Ninguém depositou ainda!', inline: false });
        } else {
            const medalhas = ['🥇','🥈','🥉'];
            const top = ranking.slice(0, 10);
            const rankTexto = top.map((r, i) => {
                const med     = medalhas[i] || `**${i+1}.**`;
                const mini    = Math.round((r.valorTotal / (top[0].valorTotal || 1)) * 8);
                const barMini = '▰'.repeat(mini) + '▱'.repeat(8 - mini);
                return (
                    `${med} **${r.displayName}**\n` +
                    `> \`${barMini}\` ${moeda()} **${fmt(r.valorTotal)}** — ${r.depositos} dep.`
                );
            }).join('\n\n');
            embed.addFields({ name: `━━━━━━━  🏅  TOP ${top.length}  ━━━━━━━`, value: rankTexto, inline: false });
        }
        return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'meta') {
        if (!isStaff(interaction)) return interaction.reply({ content: 'So a Staff pode mudar a meta.', flags: [MessageFlags.Ephemeral] });
        const novaM = interaction.options.getNumber('valor');
        config.rank = config.rank || {};
        config.rank.metaMensal = novaM;
        return interaction.reply({ content: `✅ Meta atualizada pra **${moeda()} ${fmt(novaM)}**!`, flags: [MessageFlags.Ephemeral] });
    }

    if (sub === 'fechar') {
        if (!isStaff(interaction)) return interaction.reply({ content: 'So a Staff pode fechar o rank.', flags: [MessageFlags.Ephemeral] });
        await interaction.deferReply();
        const mesKey  = db.getMesKey();
        const ranking = db.getRankOrdenado(mesKey);
        const meta    = config.rank?.metaMensal || 100000;
        const d       = new Date();
        const nomeMes = d.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
        const pontosCfg = config.niveis?.pontosPorAcao || {};

        if (ranking.length === 0) return interaction.editReply({ content: 'Nao tem ninguem no rank esse mes.' });

        const totalDep = ranking.reduce((acc, r) => acc + r.valorTotal, 0);
        const medalhas = ['🥇','🥈','🥉'];
        const resultados = [];

        for (let i = 0; i < ranking.length; i++) {
            const r = ranking[i];
            let pts = 0;
            if (i === 0)      pts = pontosCfg.rank_1lugar || 50;
            else if (i === 1) pts = pontosCfg.rank_2lugar || 30;
            else if (i === 2) pts = pontosCfg.rank_3lugar || 15;
            else if (i < 10)  pts = pontosCfg.rank_top10  || 5;
            if (pts > 0) {
                const ptResult = await db.adicionarPontos(r.userId, r.userName, r.displayName, pts);
                resultados.push({ ...r, pts, ptResult, pos: i });
            }
        }

        const embed = new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle(`🏆 RANK FECHADO — ${nomeMes.toUpperCase()}`)
            .setDescription(`**Total depositado:** ${moeda()} ${fmt(totalDep)}\n**Meta era:** ${moeda()} ${fmt(meta)}`)
            .setFooter({ text: `${nomeBot()} 🌿` })
            .setTimestamp();

        const top3 = resultados.filter(r => r.pos < 3);
        if (top3.length > 0) {
            embed.addFields({
                name: 'PODIO DO MES',
                value: top3.map(r => `${medalhas[r.pos]} **${r.displayName}** — ${moeda()} ${fmt(r.valorTotal)} | +${r.pts} pts`).join('\n'),
                inline: false
            });
        }

        const canalRank = await getChannel(interaction, 'rank');
        await canalRank.send({ embeds: [embed] });
        db.resetarRankMes(mesKey);
        return interaction.editReply({ content: `✅ Rank de **${nomeMes}** fechado! Pontos distribuidos.` });
    }

    if (sub === 'resetar') {
        if (!isStaff(interaction)) return interaction.reply({ content: 'So a Staff.', flags: [MessageFlags.Ephemeral] });
        db.resetarRankMes(db.getMesKey());
        return interaction.reply({ content: `✅ Rank zerado!`, flags: [MessageFlags.Ephemeral] });
    }

    if (sub === 'adicionar') {
        if (!isStaff(interaction)) return interaction.reply({ content: 'So a Staff pode usar isso.', flags: [MessageFlags.Ephemeral] });

        const membro = interaction.options.getMember('membro');
        const valor  = interaction.options.getNumber('valor');

        const entry = db.adicionarAoRank(
            membro.user.id,
            membro.user.tag,
            membro.displayName,
            valor
        );

        const embed = new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle('✅  Membro Adicionado ao Rank')
            .addFields(
                { name: '👤  Membro',          value: `${membro}`,                                    inline: true },
                { name: '💰  Valor adicionado', value: `\`${moeda()} ${fmt(valor)}\``,            inline: true },
                { name: '📊  Total no rank',    value: `\`${moeda()} ${fmt(entry.valorTotal)}\``, inline: true }
            )
            .setFooter({ text: `Adicionado por ${interaction.member.displayName}  ·  ${nomeBot()} 🌿` })
            .setTimestamp();

        return interaction.reply({ embeds: [embed] });
    }
}

// ══════════════════════════════════════════════
//  /pontos
// ══════════════════════════════════════════════
async function handlePontos(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'ver') {
        const membro = interaction.options.getMember('membro') || interaction.member;
        const dados  = db.getPontos(membro.user.id);
        const niveis = config.niveis?.cargos || [];
        const prox   = niveis.find(n => n.pontosNecessarios > dados.pontos);

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle(`🌿 FICHA DO GUETO — ${membro.displayName.toUpperCase()}`)
            .setThumbnail(membro.user.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: '🎖️ Nivel',   value: `**${dados.nomeNivel || 'OG'}**`,                                              inline: true },
                { name: '✨ Pontos',  value: `**${dados.pontos || 0}**`,                                                     inline: true },
                { name: '📈 Proximo', value: prox ? `${prox.nome} (${prox.pontosNecessarios} pts)` : '**NIVEL MAXIMO!**',   inline: true }
            )
            .setFooter({ text: `${nomeBot()} 🌿` })
            .setTimestamp();
        return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'ranking') {
        await interaction.deferReply();
        const ranking = db.getRankingPontos().slice(0, 10);
        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('🌿 RANKING GERAL DE PONTOS')
            .setFooter({ text: `${nomeBot()} 🌿` })
            .setTimestamp();
        if (ranking.length === 0) {
            embed.setDescription('Ningem tem ponto ainda!');
        } else {
            const medalhas = ['🥇','🥈','🥉'];
            embed.setDescription(ranking.map((r, i) => `${medalhas[i] || `**${i+1}.**`} **${r.displayName}** — ${r.pontos} pts | ${r.nomeNivel}`).join('\n'));
        }
        return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'dar') {
        if (!isStaff(interaction)) return interaction.reply({ content: 'So a Staff.', flags: [MessageFlags.Ephemeral] });
        const membro = interaction.options.getMember('membro');
        const qtd    = interaction.options.getInteger('quantidade');
        const ptRes  = await db.adicionarPontos(membro.user.id, membro.user.tag, membro.displayName, qtd);
        const embed  = new EmbedBuilder()
            .setColor(0x57F287).setTitle('✨ Pontos Adicionados')
            .addFields(
                { name: 'Membro',  value: `${membro}`,          inline: true },
                { name: '+Pontos', value: `**${qtd}**`,          inline: true },
                { name: 'Total',   value: `**${ptRes.pontos}**`, inline: true },
                { name: 'Nivel',   value: ptRes.nomeNivel,       inline: true }
            )
            .setFooter({ text: `Adicionado por ${interaction.member.displayName}` })
            .setTimestamp();
        return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'configurar') {
        if (!isStaff(interaction)) return interaction.reply({ content: 'So a Staff.', flags: [MessageFlags.Ephemeral] });
        const niveis = config.niveis?.cargos || [];
        const pts    = config.niveis?.pontosPorAcao || {};
        const embed  = new EmbedBuilder()
            .setColor(0x5865F2).setTitle('⚙️ CONFIG DE NIVEIS')
            .addFields(
                { name: 'Niveis', value: niveis.map(n => `• **${n.nome}** — ${n.pontosNecessarios} pts | ${n.cargoId ? `<@&${n.cargoId}>` : 'Sem cargo'}`).join('\n') || 'Nenhum', inline: false },
                { name: 'Pontos por Acao', value: `Bau: **${pts.deposito_bau||10}**  1°: **${pts.rank_1lugar||50}**  2°: **${pts.rank_2lugar||30}**  3°: **${pts.rank_3lugar||15}**  Top10: **${pts.rank_top10||5}**`, inline: false }
            )
            .setFooter({ text: `${nomeBot()} 🌿` });
        return interaction.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
    }
}

// ══════════════════════════════════════════════
//  /bau
// ══════════════════════════════════════════════
async function handleBau(interaction) {
    if (!interaction.client.bauFlowData) interaction.client.bauFlowData = new Map();

    // Se já tem fluxo aberto, cancela o antigo
    if (interaction.client.bauFlowData.has(interaction.user.id)) {
        const oldFlow = interaction.client.bauFlowData.get(interaction.user.id);
        if (oldFlow?.timeoutId) clearTimeout(oldFlow.timeoutId);
        interaction.client.bauFlowData.delete(interaction.user.id);
    }

    const embed = new EmbedBuilder().setColor(0xF1C40F)
        .setTitle('╔══════════  📦  BAÚ DO GUETO  ══════════╗')
        .setDescription(
            '> \u200b\n' +
            '> 💰 **`1`** — Adicionar Dinheiro\n' +
            '> 💸 **`2`** — Retirar Dinheiro\n' +
            '> \u200b\n' +
            '> 📦 **`3`** — Adicionar Item\n' +
            '> 📤 **`4`** — Retirar Item\n' +
            '> \u200b\n' +
            '> 👁️ **`5`** — Ver o Baú (inventário)\n' +
            '> \u200b\n' +
            '> ✏️ Digita **1**, **2**, **3**, **4** ou **5**:'
        )
        .setFooter({ text: `${nomeBot()} 🌿  ·  Expira em 10 minutos  ·  Depositar = pontos no rank` });

    // Manda o embed como mensagem normal no canal (o fluxo de baú usa messageCreate)
    const canal = interaction.channel;
    await interaction.reply({ content: '📦 Abrindo o baú...', flags: [MessageFlags.Ephemeral] }).catch(() => {});
    const qMsg = await canal.send({ embeds: [embed] });
    console.log('[BAU] Fluxo aberto por ' + interaction.user.tag + ' | canal=' + canal.name);

    // Timeout de 10 minutos: apaga o menu e cancela o fluxo
    const timeoutId = setTimeout(async () => {
        const flow = interaction.client.bauFlowData.get(interaction.user.id);
        if (flow) {
            interaction.client.bauFlowData.delete(interaction.user.id);
            try {
                const ch = await interaction.client.channels.fetch(flow.channelId);
                if (flow.questionMessageId) {
                    const m = await ch.messages.fetch(flow.questionMessageId);
                    await m.delete().catch(() => {});
                }
            } catch (_) {}
        }
    }, 600_000);

    interaction.client.bauFlowData.set(interaction.user.id, {
        step: 1, action: null, itemName: null,
        timestamp: Date.now(), questionMessageId: qMsg.id,
        channelId: canal.id, timeoutId
    });
}

// ══════════════════════════════════════════════
//  /ponto
// ══════════════════════════════════════════════
async function handlePonto(interaction) {
    const tipo    = interaction.options.getString('tipo');
    const uid     = interaction.user.id;
    const guildId = interaction.guild.id;

    const ultimo = await db.getUltimoPonto(uid, guildId);
    if (ultimo) {
        if (tipo === 'entrada' && ultimo.tipo === 'entrada') return interaction.reply({ content: 'Ja bateu **entrada**! Bate a **saida** primeiro.', flags: [MessageFlags.Ephemeral] });
        if (tipo === 'saida'   && ultimo.tipo === 'saida'  ) return interaction.reply({ content: 'Ja bateu **saida**! Bate a **entrada** primeiro.', flags: [MessageFlags.Ephemeral] });
    }
    if (tipo === 'saida' && !ultimo) return interaction.reply({ content: 'Nao bateu **entrada** ainda!', flags: [MessageFlags.Ephemeral] });

    const reg = await db.baterPonto(uid, interaction.user.tag, interaction.member.displayName, tipo, guildId);

    let tempoPeriodo = '';
    if (tipo === 'saida' && ultimo) {
        const ms  = reg.timestamp - ultimo.timestamp;
        const min = Math.floor(ms / 60_000);
        const h   = Math.floor(min / 60);
        const m   = min % 60;
        tempoPeriodo = `Trampo: **${h}h ${m}min**`;
    }

    const embed = new EmbedBuilder()
        .setColor(tipo === 'entrada' ? 'Green' : 'Red')
        .setTitle(tipo === 'entrada' ? '🟢 CHEGOU NO GUETO' : '🔴 SAIU DO GUETO')
        .addFields(
            { name: 'Membro',  value: `${interaction.member}`, inline: true },
            { name: 'Horario', value: reg.data,                inline: true },
            ...(tempoPeriodo ? [{ name: 'Periodo', value: tempoPeriodo, inline: false }] : [])
        )
        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: `${nomeBot()} 🌿` })
        .setTimestamp();

    const canalPonto = await getChannel(interaction, 'ponto');
    await canalPonto.send({ embeds: [embed] });
    await interaction.reply({ content: `Ponto de **${tipo}** registrado!`, flags: [MessageFlags.Ephemeral] });
}

// ══════════════════════════════════════════════
//  /pontohistorico
// ══════════════════════════════════════════════
async function handlePontoHistorico(interaction) {
    if (!isStaff(interaction)) return interaction.reply({ content: 'So a Staff.', flags: [MessageFlags.Ephemeral] });
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    const membro    = interaction.options.getMember('membro');
    const registros = await db.getPonto(membro.user.id, interaction.guild.id);
    if (!registros.length) return interaction.editReply({ content: `Nenhum registro pra **${membro.displayName}**.` });

    const embed = new EmbedBuilder()
        .setColor('Blue')
        .setTitle(`HISTORICO DE PONTO — ${membro.displayName.toUpperCase()}`)
        .setDescription(`${registros.length} registro(s)`)
        .setThumbnail(membro.user.displayAvatarURL({ dynamic: true }))
        .setTimestamp();

    const texto = registros.slice(-20).reverse().map(r => `${r.tipo === 'entrada' ? '🟢 ENTRADA' : '🔴 SAIDA'} — ${r.data}`).join('\n');
    embed.addFields({ name: 'Ultimos 20', value: texto || 'Nenhum', inline: false });
    await interaction.editReply({ embeds: [embed] });
}

// ══════════════════════════════════════════════
//  /chat
// ══════════════════════════════════════════════
async function handleChat(interaction) {
    if (!isStaff(interaction)) return interaction.reply({ content: 'So a Staff.', flags: [MessageFlags.Ephemeral] });
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    const membro = interaction.options.getMember('membro');
    const limite = interaction.options.getInteger('limite') || 20;
    const logs   = await db.getChatLog(membro.user.id, interaction.guild.id);
    if (!logs.length) return interaction.editReply({ content: `Nenhuma mensagem pra **${membro.displayName}**.` });

    const embed = new EmbedBuilder()
        .setColor('Blue')
        .setTitle(`BATE-PAPO — ${membro.displayName.toUpperCase()}`)
        .setDescription(`${logs.length} msg(s) | Exibindo ultimas ${Math.min(limite, logs.length)}`)
        .setTimestamp();

    const linhas = logs.slice(-limite).reverse().map(l => `[${l.data}] #${l.canal}: ${l.mensagem.substring(0, 100)}`).join('\n');
    const chunks = [];
    let atual = '';
    for (const linha of linhas.split('\n')) {
        if (atual.length + linha.length > 900) { chunks.push(atual); atual = ''; }
        atual += linha + '\n';
    }
    if (atual) chunks.push(atual);
    for (let i = 0; i < Math.min(chunks.length, 5); i++) {
        embed.addFields({ name: i === 0 ? 'Mensagens' : '...continua', value: '```' + chunks[i] + '```', inline: false });
    }
    await interaction.editReply({ embeds: [embed] });
}

// ══════════════════════════════════════════════
//  /avisar
// ══════════════════════════════════════════════
async function handleAvisarStart(interaction) {
    if (!isStaff(interaction)) return interaction.reply({ content: 'So a Staff.', flags: [MessageFlags.Ephemeral] });
    interaction.client.avisarFlow.delete(interaction.user.id);

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('aviso_tipo_normal').setLabel('📢 Aviso Normal').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('aviso_tipo_importante').setLabel('⚠️ Aviso Importante').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('aviso_tipo_reuniao').setLabel('📅 Reuniao').setStyle(ButtonStyle.Secondary)
    );
    const embed = new EmbedBuilder().setColor('Blue').setTitle('📢 CRIAR AVISO — Passo 1 de 4')
        .setDescription('**Qual o tipo do aviso?**\n\nEscolha clicando num botao.')
        .setFooter({ text: 'Expira em 2 minutos' });
    await interaction.reply({ embeds: [embed], components: [row], flags: [MessageFlags.Ephemeral] });
}

async function handleAvisarTipo(interaction) {
    const uid  = interaction.user.id;
    const tipo = interaction.customId.replace('aviso_tipo_', '');
    interaction.client.avisarFlow.set(uid, { tipo, canalId: null, mensagem: null, cargoId: null });

    const row = new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder().setCustomId('aviso_canal').setPlaceholder('Seleciona o canal').addChannelTypes(ChannelType.GuildText)
    );
    const tiposLabel = { normal: '📢 Normal', importante: '⚠️ Importante', reuniao: '📅 Reuniao' };
    const embed = new EmbedBuilder().setColor('Blue').setTitle('📢 CRIAR AVISO — Passo 2 de 4')
        .setDescription(`**Tipo:** ${tiposLabel[tipo]}\n\nEm qual canal manda?`);
    await interaction.update({ embeds: [embed], components: [row] });
}

async function handleAvisarCanal(interaction) {
    const uid  = interaction.user.id;
    const flow = interaction.client.avisarFlow.get(uid);
    if (!flow) return interaction.reply({ content: 'Sessao expirada. Usa /avisar de novo.', flags: [MessageFlags.Ephemeral] });
    flow.canalId = interaction.values[0];
    interaction.client.avisarFlow.set(uid, flow);
    const modal = new ModalBuilder().setCustomId('aviso_modal').setTitle('Mensagem do Aviso');
    modal.addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('aviso_mensagem').setLabel('Mensagem:').setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Ex: Reuniao hoje as 20h!').setMinLength(3).setMaxLength(2000)
    ));
    await interaction.showModal(modal);
}

async function handleAvisarModal(interaction) {
    const uid  = interaction.user.id;
    const flow = interaction.client.avisarFlow.get(uid);
    if (!flow) return interaction.reply({ content: 'Sessao expirada.', flags: [MessageFlags.Ephemeral] });
    flow.mensagem = interaction.fields.getTextInputValue('aviso_mensagem');
    interaction.client.avisarFlow.set(uid, flow);

    if (flow.tipo === 'normal') {
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
        await enviarAviso(interaction, flow);
        interaction.client.avisarFlow.delete(uid);
        return;
    }

    const row = new ActionRowBuilder().addComponents(
        new RoleSelectMenuBuilder().setCustomId('aviso_cargo').setPlaceholder('Cargo a marcar')
    );
    const embed = new EmbedBuilder().setColor('Yellow').setTitle('CRIAR AVISO — Passo 4 de 4')
        .setDescription('Qual cargo marcar no aviso?');
    await interaction.reply({ embeds: [embed], components: [row], flags: [MessageFlags.Ephemeral] });
}

async function handleAvisarCargo(interaction) {
    const uid  = interaction.user.id;
    const flow = interaction.client.avisarFlow.get(uid);
    if (!flow) return interaction.reply({ content: 'Sessao expirada.', flags: [MessageFlags.Ephemeral] });
    flow.cargoId = interaction.values[0];
    interaction.client.avisarFlow.set(uid, flow);
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
    await enviarAviso(interaction, flow);
    interaction.client.avisarFlow.delete(uid);
}

async function enviarAviso(interaction, flow) {
    const tipos = {
        normal:     { emoji: '📢', label: 'AVISO',            color: 0x3498DB },
        importante: { emoji: '⚠️', label: 'AVISO IMPORTANTE', color: 0xF1C40F },
        reuniao:    { emoji: '📅', label: 'AVISO DE REUNIÃO',  color: 0x9B59B6 }
    };
    const { emoji, label, color } = tipos[flow.tipo] || tipos.normal;
    const cargo = flow.cargoId ? interaction.guild.roles.cache.get(flow.cargoId) : null;
    const canal = interaction.guild.channels.cache.get(flow.canalId);
    if (!canal) { try { await interaction.editReply({ content: 'Canal nao encontrado.', components: [], embeds: [] }); } catch (_) {} return; }

    // Reescrever mensagem em modo hipster com IA 🌿
    let mensagemFinal = flow.mensagem;
    try {
        const { reescreverHipster } = require('../hipsterRewriter');
        mensagemFinal = (await reescreverHipster(flow.mensagem, 'ia')).toUpperCase();
    } catch (_) { mensagemFinal = flow.mensagem; }

    const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(`${emoji}  ${label}`)
        .setDescription(`\u200b\n${mensagemFinal}\n\u200b`)
        .addFields(
            { name: '👤  Enviado por', value: `${interaction.member}`,                         inline: true  },
            { name: '\u200b',          value: '\u200b',                                        inline: true  },
            { name: '🏷️  Cargo',      value: cargo ? `${cargo}` : '`Sem cargo marcado`',      inline: true  }
        )
        .setTimestamp()
        .setFooter({ text: `${nomeBot()} 🌿  ·  ${label}` });

    try {
        // Manda menção separada só se tiver cargo, para notificar corretamente
        await canal.send({ content: cargo ? `${cargo}` : undefined, embeds: [embed] });
        try { await interaction.editReply({ content: `✅ Aviso enviado em ${canal}!`, embeds: [], components: [] }); } catch (_) {}
    } catch (err) {
        try { await interaction.editReply({ content: `Erro: ${err.message}`, components: [], embeds: [] }); } catch (_) {}
    }
}

// ══════════════════════════════════════════════
//  /limpeza
// ══════════════════════════════════════════════
async function handleLimpeza(interaction) {
    if (!isStaff(interaction)) return interaction.reply({ content: 'So a Staff.', flags: [MessageFlags.Ephemeral] });
    const sub     = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (sub === 'ver') {
        const cfg = await db.getLimpezaConfig(guildId);
        const diasNomes = ['Dom','Seg','Ter','Qua','Qui','Sex','Sab'];
        const dias   = (cfg.diasDaSemana || []).map(d => diasNomes[d]).join(', ') || 'Nenhum';
        const canais = (cfg.canais || []).map(id => `<#${id}>`).join(', ') || 'Nenhum';
        const embed  = new EmbedBuilder().setColor('Blue').setTitle('CONFIG DE AUTO-LIMPEZA')
            .addFields(
                { name: 'Status',  value: cfg.ativo ? 'ATIVO' : 'DESATIVADO', inline: true },
                { name: 'Horario', value: cfg.horario || '03:00',              inline: true },
                { name: 'Dias',    value: dias,                                inline: true },
                { name: 'Canais',  value: canais,                              inline: false }
            );
        return interaction.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
    }
    if (sub === 'agora') {
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
        const canal = interaction.options.getChannel('canal');
        await interaction.client.limparCanalCompleto(canal);
        return interaction.editReply({ content: `Canal ${canal} limpo!` });
    }
    if (sub === 'configurar') {
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
        const cfg     = await db.getLimpezaConfig(guildId);
        cfg.ativo     = interaction.options.getBoolean('ativo');
        const horario = interaction.options.getString('horario');
        const dias    = interaction.options.getString('dias');
        const canais  = interaction.options.getString('canais');
        if (horario && /^\d{2}:\d{2}$/.test(horario)) cfg.horario = horario;
        if (dias)   cfg.diasDaSemana = dias.split(',').map(d => parseInt(d.trim())).filter(d => !isNaN(d));
        if (canais) cfg.canais       = canais.split(',').map(id => id.trim()).filter(id => id.length > 0);
        await db.setLimpezaConfig(guildId, cfg);
        return interaction.editReply({ content: `Auto-limpeza ${cfg.ativo ? 'ATIVADA' : 'DESATIVADA'}!` });
    }
}

// ══════════════════════════════════════════════
//  /cargo
// ══════════════════════════════════════════════
async function handleCargo(interaction) {
    if (!isStaff(interaction)) return interaction.reply({ content: 'So a Staff.', flags: [MessageFlags.Ephemeral] });
    const sub    = interaction.options.getSubcommand();
    const membro = interaction.options.getMember('membro');
    const cargo  = interaction.options.getRole('cargo');

    if (sub === 'dar') {
        if (membro.roles.cache.has(cargo.id)) return interaction.reply({ content: `${membro.displayName} ja tem esse cargo.`, flags: [MessageFlags.Ephemeral] });
        await membro.roles.add(cargo);
        const embed = new EmbedBuilder().setColor('Green').setTitle('CARGO ADICIONADO')
            .addFields({ name: 'Membro', value: `${membro}`, inline: true }, { name: 'Cargo', value: `${cargo}`, inline: true }).setTimestamp();
        return interaction.reply({ embeds: [embed] });
    }
    if (sub === 'retirar') {
        if (!membro.roles.cache.has(cargo.id)) return interaction.reply({ content: `${membro.displayName} nao tem esse cargo.`, flags: [MessageFlags.Ephemeral] });
        await membro.roles.remove(cargo);
        const embed = new EmbedBuilder().setColor('Red').setTitle('CARGO REMOVIDO')
            .addFields({ name: 'Membro', value: `${membro}`, inline: true }, { name: 'Cargo', value: `${cargo}`, inline: true }).setTimestamp();
        return interaction.reply({ embeds: [embed] });
    }
    if (sub === 'listar') {
        const cargos = membro.roles.cache.filter(r => r.id !== interaction.guild.id).sort((a, b) => b.position - a.position).map(r => `${r}`).join(' ');
        const embed  = new EmbedBuilder().setColor('Blue').setTitle(`CARGOS DE ${membro.displayName.toUpperCase()}`)
            .addFields({ name: 'Total', value: `${membro.roles.cache.size - 1}`, inline: true }, { name: 'Cargos', value: cargos || 'Nenhum', inline: false }).setTimestamp();
        return interaction.reply({ embeds: [embed] });
    }
}

// ══════════════════════════════════════════════
//  /regras
// ══════════════════════════════════════════════
// Publica regras no canal — apaga a antiga e manda a nova (igual ao rank)
async function publicarRegrasNoCanal(guild, client) {
    try {
        const canalId = config.canais?.regras;
        if (!canalId) return;
        const canal = await guild.channels.fetch(canalId).catch(() => null);
        if (!canal) return;

        const lista = await db.getRegras();
        const texto = lista.map((r, i) => `**${i + 1}.** ${r}`).join('\n\n');
        const embed = new EmbedBuilder()
            .setColor(0xE74C3C)
            .setTitle('📜  REGRAS DO GUETO')
            .setDescription(texto)
            .setFooter({ text: `${config.nomeBot || 'Fuminho'} 🌿  ·  Respeita as regras, brother` })
            .setTimestamp();

        // Apaga todas as mensagens de regras antigas do bot no canal
        let continuar = true;
        while (continuar) {
            const msgs = await canal.messages.fetch({ limit: 50 });
            const antigas = msgs.filter(m => m.author.id === client.user.id && m.embeds.length > 0);
            if (antigas.size === 0) { continuar = false; break; }
            for (const m of antigas.values()) await m.delete().catch(() => {});
            if (antigas.size < 50) continuar = false;
        }

        await canal.send({ embeds: [embed] });
    } catch (err) {
        console.error('[REGRAS] Erro ao publicar:', err.message);
    }
}

async function handleRegras(interaction) {
    const sub = interaction.options.getSubcommand(false);

    // /regras ver — só mostra, não atualiza o canal
    if (!sub || sub === 'ver') {
        const lista = await db.getRegras();
        const texto = lista.map((r, i) => `**${i + 1}.** ${r}`).join('\n\n');
        const embed = new EmbedBuilder()
            .setColor(0xE74C3C)
            .setTitle('📜  REGRAS DO GUETO')
            .setDescription(texto)
            .setFooter({ text: `${nomeBot()} 🌿` })
            .setTimestamp();
        return interaction.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
    }

    // Edição: só staff ou dono
    const temPerm = isStaff(interaction) || interaction.user.id === config.ownerId;
    if (!temPerm) return interaction.reply({ content: '🚫 Sem permissão.', flags: [MessageFlags.Ephemeral] });

    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
    const lista = await db.getRegras();

    if (sub === 'adicionar') {
        lista.push(interaction.options.getString('texto'));
        await db.setRegras(lista);
        await publicarRegrasNoCanal(interaction.guild, interaction.client);
        return interaction.editReply({ content: `✅ Regra **${lista.length}** adicionada e canal atualizado!` });
    }

    if (sub === 'remover') {
        const n = interaction.options.getInteger('numero');
        if (n < 1 || n > lista.length) return interaction.editReply({ content: '❌ Número inválido.' });
        lista.splice(n - 1, 1);
        await db.setRegras(lista);
        await publicarRegrasNoCanal(interaction.guild, interaction.client);
        return interaction.editReply({ content: `✅ Regra **${n}** removida e canal atualizado!` });
    }

    if (sub === 'editar') {
        const n = interaction.options.getInteger('numero');
        if (n < 1 || n > lista.length) return interaction.editReply({ content: '❌ Número inválido.' });
        lista[n - 1] = interaction.options.getString('texto');
        await db.setRegras(lista);
        await publicarRegrasNoCanal(interaction.guild, interaction.client);
        return interaction.editReply({ content: `✅ Regra **${n}** editada e canal atualizado!` });
    }
}

// ══════════════════════════════════════════════
//  /notificar
// ══════════════════════════════════════════════
async function handleNotificar(interaction) {
    const not = config.notificacoes || {};
    const yt  = not.youtube && not.youtube !== 'SEU_ID_YOUTUBE' ? `\`${not.youtube}\`` : 'Nao configurado';
    const tw  = not.twitch  && not.twitch  !== 'SEU_ID_TWITCH'  ? `\`${not.twitch}\``  : 'Nao configurado';
    const kk  = not.kick    && not.kick    !== 'SEU_ID_KICK'    ? `\`${not.kick}\``    : 'Nao configurado';

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('cfg_not_youtube').setLabel('Editar YouTube').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('cfg_not_twitch').setLabel('Editar Twitch').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('cfg_not_kick').setLabel('Editar Kick').setStyle(ButtonStyle.Secondary)
    );
    const embed = new EmbedBuilder().setColor('DarkRed').setTitle('🔔 NOTIFICACOES')
        .addFields({ name: 'YouTube', value: yt, inline: true }, { name: 'Twitch', value: tw, inline: true }, { name: 'Kick', value: kk, inline: true });
    return interaction.reply({ embeds: [embed], components: [row], flags: [MessageFlags.Ephemeral] });
}

// ══════════════════════════════════════════════
//  /config
// ══════════════════════════════════════════════
async function handleConfig(interaction) {
    if (!isStaff(interaction)) return interaction.reply({ content: 'So a Staff.', flags: [MessageFlags.Ephemeral] });
    const sub = interaction.options.getSubcommand();

    if (sub === 'servidor') {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('cfg_nome_servidor').setLabel('Nome do Servidor').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('cfg_moeda').setLabel('Moeda (R$ / PP)').setStyle(ButtonStyle.Primary)
        );
        const embed = new EmbedBuilder().setColor('Blue').setTitle('⚙️ CONFIG — SERVIDOR')
            .addFields({ name: 'Nome atual', value: config.nomeServidor || 'Gueto', inline: true }, { name: 'Moeda', value: moeda() || 'R$', inline: true });
        return interaction.reply({ embeds: [embed], components: [row], flags: [MessageFlags.Ephemeral] });
    }
    if (sub === 'seguranca') {
        const seg = config.seguranca || {};
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('cfg_seg_punicao').setLabel('Tipo de Punicao').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('cfg_seg_timeout').setLabel('Minutos Timeout').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('cfg_seg_palavras').setLabel('Palavras Proibidas').setStyle(ButtonStyle.Secondary)
        );
        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('cfg_seg_links').setLabel(`Links: ${seg.banirLinks ? 'ON' : 'OFF'}`).setStyle(seg.banirLinks ? ButtonStyle.Success : ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('cfg_seg_imagens').setLabel(`Imagens: ${seg.banirImagens ? 'ON' : 'OFF'}`).setStyle(seg.banirImagens ? ButtonStyle.Success : ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('cfg_seg_spam').setLabel(`Max spam: ${seg.maxMensagens || 5}`).setStyle(ButtonStyle.Secondary)
        );
        const embed = new EmbedBuilder().setColor('Red').setTitle('🛡️ CONFIG — SEGURANCA')
            .addFields(
                { name: 'Punicao',  value: seg.punicao || 'timeout',                              inline: true },
                { name: 'Timeout',  value: `${seg.timeoutMinutos || 10}min`,                       inline: true },
                { name: 'Links',    value: seg.banirLinks   ? 'SIM' : 'NAO',                       inline: true },
                { name: 'Imagens',  value: seg.banirImagens ? 'SIM' : 'NAO',                       inline: true },
                { name: 'Palavras', value: (seg.palavrasProibidas || []).join(', ') || 'Nenhuma',  inline: false }
            );
        return interaction.reply({ embeds: [embed], components: [row, row2], flags: [MessageFlags.Ephemeral] });
    }
    if (sub === 'chat') {
        const chat = config.chat || {};
        const row  = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('cfg_chat_add').setLabel('Adicionar Resposta').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('cfg_chat_list').setLabel('Ver Respostas').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('cfg_chat_toggle').setLabel(`Chat: ${chat.ativo ? 'ON' : 'OFF'}`).setStyle(chat.ativo ? ButtonStyle.Success : ButtonStyle.Danger)
        );
        const embed = new EmbedBuilder().setColor('Blue').setTitle('💬 CONFIG — CHAT AUTO')
            .addFields({ name: 'Status', value: chat.ativo ? 'ATIVO' : 'OFF', inline: true });
        return interaction.reply({ embeds: [embed], components: [row], flags: [MessageFlags.Ephemeral] });
    }
    if (sub === 'enquete' || sub === 'votacao') {
        const eventos = config.eventos || {};
        const nomes   = Object.entries(eventos).map(([k, v]) => `**${v.nome}** — ${v.ativo ? 'ATIVO' : 'INATIVO'}`).join('\n') || 'Nenhuma';
        const embed   = new EmbedBuilder().setColor('Gold').setTitle('🗳️ CONFIG — VOTACOES').addFields({ name: 'Votacoes', value: nomes, inline: false });
        return interaction.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
    }
}

async function handleConfigBtn(interaction) {
    const id = interaction.customId;

    if (id === 'cfg_not_youtube' || id === 'cfg_not_twitch' || id === 'cfg_not_kick') {
        const plat  = id.replace('cfg_not_', '');
        const label = { youtube: 'YouTube', twitch: 'Twitch', kick: 'Kick' }[plat];
        const modal = new ModalBuilder().setCustomId(`cfg_modal_not_${plat}`).setTitle(`Editar ${label}`);
        modal.addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('valor').setLabel(`ID no ${label}:`).setStyle(TextInputStyle.Short).setPlaceholder('meucanal').setRequired(true)
        ));
        return interaction.showModal(modal);
    }

    const modalMap = {
        'cfg_nome_servidor': { id: 'cfg_modal_nome_servidor', title: 'Nome do Servidor', label: 'Novo nome:',          placeholder: 'Gueto' },
        'cfg_moeda':         { id: 'cfg_modal_moeda',         title: 'Moeda',            label: 'Moeda:',              placeholder: 'R$' },
        'cfg_seg_timeout':   { id: 'cfg_modal_seg_timeout',   title: 'Timeout (min)',    label: 'Minutos:',            placeholder: '10' },
        'cfg_seg_palavras':  { id: 'cfg_modal_seg_palavras',  title: 'Palavras Proib.',  label: 'Palavras (virgula):', placeholder: 'palavrao1, palavrao2' },
        'cfg_seg_spam':      { id: 'cfg_modal_seg_spam',      title: 'Anti-Spam',        label: 'Max msgs/3s:',        placeholder: '5' },
        'cfg_chat_add':      { id: 'cfg_modal_chat_add',      title: 'Resposta Auto',    label: 'Gatilho:',            placeholder: 'oi', label2: 'Resposta:', placeholder2: 'Eai!' },
    };

    if (id === 'cfg_seg_links')   { config.seguranca.banirLinks   = !config.seguranca.banirLinks;   return interaction.reply({ content: `Links: **${config.seguranca.banirLinks ? 'ON' : 'OFF'}**`,     flags: [MessageFlags.Ephemeral] }); }
    if (id === 'cfg_seg_imagens') { config.seguranca.banirImagens = !config.seguranca.banirImagens; return interaction.reply({ content: `Imagens: **${config.seguranca.banirImagens ? 'ON' : 'OFF'}**`, flags: [MessageFlags.Ephemeral] }); }
    if (id === 'cfg_seg_punicao') { const op = ['timeout','kick','ban']; const a = op.indexOf(config.seguranca?.punicao||'timeout'); config.seguranca.punicao = op[(a+1)%op.length]; return interaction.reply({ content: `Punicao: **${config.seguranca.punicao}**`, flags: [MessageFlags.Ephemeral] }); }
    if (id === 'cfg_chat_toggle') { if (!config.chat) config.chat = { ativo: true }; config.chat.ativo = !config.chat.ativo; return interaction.reply({ content: `Chat: **${config.chat.ativo ? 'ON' : 'OFF'}**`, flags: [MessageFlags.Ephemeral] }); }
    if (id === 'cfg_chat_list')   { const r = config.chat?.respostasAutomaticas || {}; const l = Object.entries(r).map(([k,v]) => `**${k}** → ${v}`).join('\n')||'Nenhuma'; return interaction.reply({ content: `📋 **Respostas:**\n${l}`, flags: [MessageFlags.Ephemeral] }); }

    const cfg = modalMap[id];
    if (!cfg) return;
    const modal = new ModalBuilder().setCustomId(cfg.id).setTitle(cfg.title);
    const comps = [new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('valor').setLabel(cfg.label).setStyle(TextInputStyle.Short).setPlaceholder(cfg.placeholder).setRequired(true))];
    if (cfg.label2) comps.push(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('valor2').setLabel(cfg.label2).setStyle(TextInputStyle.Paragraph).setPlaceholder(cfg.placeholder2||'').setRequired(true)));
    modal.addComponents(...comps);
    return interaction.showModal(modal);
}

async function handleConfigModal(interaction) {
    const id  = interaction.customId;
    const val = interaction.fields.getTextInputValue('valor');
    let val2 = ''; try { val2 = interaction.fields.getTextInputValue('valor2'); } catch (_) {}
    let msg = '';
    if      (id === 'cfg_modal_not_youtube')     { config.notificacoes = config.notificacoes || {}; config.notificacoes.youtube = val; msg = `YouTube: \`${val}\``; }
    else if (id === 'cfg_modal_not_twitch')      { config.notificacoes = config.notificacoes || {}; config.notificacoes.twitch  = val; msg = `Twitch: \`${val}\``; }
    else if (id === 'cfg_modal_not_kick')        { config.notificacoes = config.notificacoes || {}; config.notificacoes.kick    = val; msg = `Kick: \`${val}\``; }
    else if (id === 'cfg_modal_nome_servidor')   { config.nomeServidor = val; msg = `Nome: **${val}**`; }
    else if (id === 'cfg_modal_moeda')           { config.moeda   = val; msg = `Moeda: **${val}**`; }
    else if (id === 'cfg_modal_seg_timeout')     { const n = parseInt(val); if (isNaN(n)||n<1) return interaction.reply({ content: 'Valor invalido.', flags: [MessageFlags.Ephemeral] }); if (!config.seguranca) config.seguranca = {}; config.seguranca.timeoutMinutos = n; msg = `Timeout: **${n} min**`; }
    else if (id === 'cfg_modal_seg_palavras')    { if (!config.seguranca) config.seguranca = {}; config.seguranca.palavrasProibidas = val.split(',').map(s=>s.trim()).filter(Boolean); msg = `Palavras: **${config.seguranca.palavrasProibidas.join(', ')}**`; }
    else if (id === 'cfg_modal_seg_spam')        { const n = parseInt(val); if (isNaN(n)||n<1) return interaction.reply({ content: 'Valor invalido.', flags: [MessageFlags.Ephemeral] }); if (!config.seguranca) config.seguranca = {}; config.seguranca.maxMensagens = n; msg = `Anti-spam: **${n} msgs**`; }
    else if (id === 'cfg_modal_chat_add')        { if (!config.chat) config.chat = { ativo: true, respostasAutomaticas: {} }; if (!config.chat.respostasAutomaticas) config.chat.respostasAutomaticas = {}; config.chat.respostasAutomaticas[val.toLowerCase()] = val2; msg = `Resposta: **${val}** → ${val2}`; }
    await interaction.reply({ content: `✅ ${msg}\n\n⚠️ Salva permanente so no \`config.json\`.`, flags: [MessageFlags.Ephemeral] });
}

// ══════════════════════════════════════════════
//  /enquete
// ══════════════════════════════════════════════
async function handleEnquete(interaction) {
    const sub     = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    // ── CRIAR ──
    if (sub === 'criar') {
        if (!isStaff(interaction)) return interaction.reply({ content: 'Só a Staff pode criar enquetes.', flags: [MessageFlags.Ephemeral] });
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

        const pergunta = interaction.options.getString('pergunta');
        const opcoesBruto = interaction.options.getString('opcoes');
        const duracao = interaction.options.getString('duracao') || '24h';
        const opcoes = opcoesBruto.split(',').map(o => o.trim()).filter(Boolean).slice(0, 8);

        if (opcoes.length < 2) return interaction.editReply({ content: 'Mínimo 2 opções, brother!' });

        // Reescrever pergunta em hipster maiúsculo 🌿
        let perguntaFinal = pergunta;
        try {
            const { reescreverHipster } = require('../hipsterRewriter');
            perguntaFinal = (await reescreverHipster(pergunta, 'ia')).toUpperCase();
        } catch (_) { perguntaFinal = pergunta.toUpperCase(); }

        const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣'];
        const opcoesTexto = opcoes.map((o, i) => `${emojis[i]} **${o.toUpperCase()}**`).join('\n');

        const embed = new EmbedBuilder()
            .setColor(0x9B59B6)
            .setTitle('🗳️  ENQUETE DO GUETO')
            .setDescription(`\u200b\n**${perguntaFinal}**\n\u200b`)
            .addFields(
                { name: '━━━━━━━  📊  OPÇÕES  ━━━━━━━', value: opcoesTexto, inline: false },
                { name: '\u200b', value: `> ⏱️ Duração: \`${duracao}\`\n> 👤 Criada por: ${interaction.member}\n> 👇 **Clique no emoji para votar!**`, inline: false }
            )
            .setFooter({ text: 'Fuminho 🌿 · Clique no emoji abaixo para votar!' })
            .setTimestamp();

        // Enviar no canal fixo de enquetes
        const canalEnquete = await interaction.client.channels.fetch('1446667977372991669').catch(() => interaction.channel);
        const msg = await canalEnquete.send({ embeds: [embed] });

        // Adicionar reações automáticas
        for (let i = 0; i < opcoes.length; i++) {
            await msg.react(emojis[i]).catch(() => {});
        }

        // Salvar enquete no banco (sem ID visível)
        const db2 = require('../database/database');
        const id = msg.id; // usar ID da mensagem como chave
        db2.salvarEnquete(guildId, id, {
            id, pergunta: perguntaFinal, opcoes,
            criador: interaction.user.id,
            messageId: msg.id, canalId: canalEnquete.id,
            timestamp: Date.now(), ativa: true, duracao
        });

        return interaction.editReply({ content: `✅ Enquete criada em ${canalEnquete}! As pessoas votam clicando nos emojis. 🌿` });
    }

    // ── VOTAR ──
    if (sub === 'votar') {
        const id = interaction.options.getString('id').toUpperCase();
        const opcaoNum = parseInt(interaction.options.getString('opcao')) - 1;
        const db2 = require('../database/database');
        const enquete = db2.getEnquete(guildId, id);
        if (!enquete) return interaction.reply({ content: `Enquete \`${id}\` não encontrada.`, flags: [MessageFlags.Ephemeral] });
        if (!enquete.ativa) return interaction.reply({ content: 'Essa enquete já foi encerrada, brother!', flags: [MessageFlags.Ephemeral] });
        if (opcaoNum < 0 || opcaoNum >= enquete.opcoes.length) return interaction.reply({ content: `Opção inválida! Use 1 a ${enquete.opcoes.length}.`, flags: [MessageFlags.Ephemeral] });
        if (enquete.votos[interaction.user.id] !== undefined) return interaction.reply({ content: `Você já votou nessa enquete! Votou em: **${enquete.opcoes[enquete.votos[interaction.user.id]].toUpperCase()}**`, flags: [MessageFlags.Ephemeral] });

        enquete.votos[interaction.user.id] = opcaoNum;
        db2.salvarEnquete(guildId, id, enquete);

        const totalVotos = Object.keys(enquete.votos).length;
        return interaction.reply({
            content: `✅ Voto registrado! Você votou em **${enquete.opcoes[opcaoNum].toUpperCase()}**\n> Total de votos: \`${totalVotos}\``,
            flags: [MessageFlags.Ephemeral]
        });
    }

    // ── RESULTADO ──
    if (sub === 'resultado') {
        if (!isStaff(interaction)) return interaction.reply({ content: 'Só a Staff.', flags: [MessageFlags.Ephemeral] });
        const id = interaction.options.getString('id').toUpperCase();
        const db2 = require('../database/database');
        const enquete = db2.getEnquete(guildId, id);
        if (!enquete) return interaction.reply({ content: `Enquete \`${id}\` não encontrada.`, flags: [MessageFlags.Ephemeral] });

        const contagem = {};
        enquete.opcoes.forEach((_, i) => contagem[i] = 0);
        Object.values(enquete.votos).forEach(v => contagem[v] = (contagem[v] || 0) + 1);
        const total = Object.values(contagem).reduce((a, b) => a + b, 0);

        const emojis = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣'];
        const barras = enquete.opcoes.map((op, i) => {
            const qt = contagem[i] || 0;
            const pct = total > 0 ? Math.round((qt / total) * 100) : 0;
            const bar = '█'.repeat(Math.round(pct / 10)) + '░'.repeat(10 - Math.round(pct / 10));
            return `${emojis[i]} **${op.toUpperCase()}**\n> \`${bar}\` **${qt}** votos — **${pct}%**`;
        }).join('\n\n');

        const embed = new EmbedBuilder()
            .setColor(enquete.ativa ? 0x9B59B6 : 0x95A5A6)
            .setTitle(`📊  RESULTADO — ${enquete.ativa ? '🟢 ATIVA' : '🔴 ENCERRADA'}`)
            .setDescription(`**${enquete.pergunta}**\n\u200b`)
            .addFields(
                { name: '━━━━━━━  📊  PLACAR  ━━━━━━━', value: barras || 'Nenhum voto ainda.', inline: false },
                { name: '\u200b', value: `> 🆔 ID: \`${id}\`\n> 🗳️ Total: \`${total} votos\``, inline: false }
            )
            .setFooter({ text: 'Fuminho 🌿 · Enquete' })
            .setTimestamp();

        return interaction.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
    }

    // ── ENCERRAR ──
    if (sub === 'encerrar') {
        if (!isStaff(interaction)) return interaction.reply({ content: 'Só a Staff.', flags: [MessageFlags.Ephemeral] });
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

        // Listar enquetes ativas para o staff escolher
        const db2 = require('../database/database');
        const ativas = Object.values(db2.getEnquetes(guildId)).filter(e => e.ativa);
        if (!ativas.length) return interaction.editReply({ content: 'Nenhuma enquete ativa no momento!' });

        // Pegar a mais recente se não especificou ID
        const idParam = interaction.options.getString('id');
        let enquete;
        if (idParam) {
            enquete = db2.getEnquete(guildId, idParam);
        } else {
            enquete = ativas.sort((a, b) => b.timestamp - a.timestamp)[0];
        }
        if (!enquete) return interaction.editReply({ content: 'Enquete não encontrada!' });
        if (!enquete.ativa) return interaction.editReply({ content: 'Enquete já encerrada!' });

        // Buscar a mensagem e contar as reações
        const emojis = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣'];
        const contagem = {};
        enquete.opcoes.forEach((_, i) => contagem[i] = 0);

        try {
            const canal = await interaction.client.channels.fetch(enquete.canalId);
            const msg = await canal.messages.fetch(enquete.messageId);
            for (let i = 0; i < enquete.opcoes.length; i++) {
                const reaction = msg.reactions.cache.find(r => r.emoji.name === emojis[i]);
                // -1 para não contar o próprio bot
                contagem[i] = reaction ? Math.max(0, reaction.count - 1) : 0;
            }
        } catch (_) {}

        enquete.ativa = false;
        db2.salvarEnquete(guildId, enquete.id, enquete);

        const total = Object.values(contagem).reduce((a, b) => a + b, 0);
        const vencedorIdx = Object.entries(contagem).sort((a, b) => b[1] - a[1])[0]?.[0];
        const vencedor = enquete.opcoes[vencedorIdx]?.toUpperCase() || 'EMPATE';

        const barras = enquete.opcoes.map((op, i) => {
            const qt = contagem[i] || 0;
            const pct = total > 0 ? Math.round((qt / total) * 100) : 0;
            const bar = '█'.repeat(Math.round(pct / 10)) + '░'.repeat(10 - Math.round(pct / 10));
            return `${emojis[i]} **${op.toUpperCase()}**\n> \`${bar}\` **${qt}** votos — **${pct}%**`;
        }).join('\n\n');

        const embed = new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle('🏆  ENQUETE ENCERRADA!')
            .setDescription(`**${enquete.pergunta}**\n\u200b`)
            .addFields(
                { name: '━━━━━━━  📊  RESULTADO FINAL  ━━━━━━━', value: barras || 'Nenhum voto.', inline: false },
                { name: '🏆  VENCEDOR', value: `**${vencedor}** com **${contagem[vencedorIdx] || 0}** votos!`, inline: false }
            )
            .setFooter({ text: 'Fuminho 🌿 · Enquete encerrada' })
            .setTimestamp();

        try {
            const canal = await interaction.client.channels.fetch(enquete.canalId);
            await canal.send({ embeds: [embed] });
        } catch (_) {}

        return interaction.editReply({ content: `✅ Enquete encerrada! Vencedor: **${vencedor}** 🏆` });
    }

    // ── LISTAR ──
    if (sub === 'listar') {
        const db2 = require('../database/database');
        const ativas = Object.values(db2.getEnquetes(guildId)).filter(e => e.ativa);

        if (!ativas.length) return interaction.reply({ content: 'Nenhuma enquete aberta no momento, brother!', flags: [MessageFlags.Ephemeral] });

        const embed = new EmbedBuilder()
            .setColor(0x9B59B6)
            .setTitle('🗳️  ENQUETES ABERTAS')
            .setFooter({ text: 'Fuminho 🌿 · Vote com /enquete votar' })
            .setTimestamp();

        ativas.slice(0, 10).forEach(e => {
            const totalVotos = Object.keys(e.votos).length;
            embed.addFields({
                name: `🆔 ${e.id}`,
                value: `> **${e.pergunta}**\n> 🗳️ ${totalVotos} votos · ${e.opcoes.length} opções`,
                inline: false
            });
        });

        return interaction.reply({ embeds: [embed] });
    }
}


// ══════════════════════════════════════════════
//  /resposta
// ══════════════════════════════════════════════
async function handleResposta(interaction) {
    if (!isStaff(interaction)) return interaction.reply({ content: 'So a Staff.', flags: [MessageFlags.Ephemeral] });
    const sub = interaction.options.getSubcommand();
    if (sub === 'adicionar') {
        const gatilho  = interaction.options.getString('gatilho').trim().toLowerCase();
        const mensagem = interaction.options.getString('mensagem').trim();
        db.adicionarResposta(gatilho, mensagem);
        const embed = new EmbedBuilder().setColor(0x57F287).setTitle('Resposta Salva')
            .addFields({ name: 'Gatilho', value: `\`${gatilho}\``, inline: true }, { name: 'Resposta', value: mensagem, inline: false }).setTimestamp();
        return interaction.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
    }
    if (sub === 'remover') {
        const gatilho = interaction.options.getString('gatilho').trim().toLowerCase();
        if (!db.getRespostas()[gatilho]) return interaction.reply({ content: `Gatilho \`${gatilho}\` nao encontrado.`, flags: [MessageFlags.Ephemeral] });
        db.removerResposta(gatilho);
        return interaction.reply({ content: `Gatilho \`${gatilho}\` removido!`, flags: [MessageFlags.Ephemeral] });
    }
    if (sub === 'listar') {
        const todas = db.getRespostas();
        const lista = Object.entries(todas);
        if (!lista.length) return interaction.reply({ content: 'Nenhuma resposta.', flags: [MessageFlags.Ephemeral] });
        const texto = lista.map(([g, r]) => `**\`${g}\`** → ${r}`).join('\n');
        const embed = new EmbedBuilder().setColor(0x5865F2).setTitle(`Respostas (${lista.length})`).setDescription(texto).setTimestamp();
        return interaction.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
    }
}

// ══════════════════════════════════════════════
//  /ajuda
// ══════════════════════════════════════════════
async function handleAjuda(interaction) {
    const owner = interaction.user.id === config.ownerId;
    const staff = isStaff(interaction);
    const seg   = config.seguranca || {};
    const bot   = nomeBot();

    const embed1 = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle(`🌿 ${bot.toUpperCase()} — COMANDOS`)
        .setThumbnail(interaction.client.user.displayAvatarURL())
        .setFooter({ text: `${bot} 🌿 Bot do Gueto` })
        .addFields(
            { name: '📦 BAU DO GUETO', value: '`/bau` — Depositar dinheiro, gerenciar itens ou ver o bau\n• Só **dinheiro sujo** conta pro rank mensal', inline: false },
            { name: '🏆 RANK MENSAL',  value: '`/rank ver` — Ver rank do mes\n`/rank meta` — Mudar meta (Staff)\n`/rank fechar` — Fechar mes e dar pontos (Staff)\n`/rank resetar` — Zerar rank (Staff)', inline: false },
            { name: '🌿 PONTOS',       value: '`/pontos ver` — Ver seus pontos e nivel\n`/pontos ranking` — Top 10 geral\n`/pontos dar` — Dar pontos (Staff)', inline: false },
            { name: '🕐 PONTO',        value: '`/ponto entrada` — Registrar chegada\n`/ponto saida` — Registrar saida + tempo', inline: false },
            { name: '🗳️ ENQUETES',    value: '`/enquete criar` — Criar enquete (Staff)\n`/enquete encerrar` — Encerrar e ver resultado (Staff)\n`/enquete listar` — Ver enquetes abertas\n• Para votar: clique no emoji da opção na mensagem!', inline: false },
            { name: '📜 SERVIDOR',     value: '`/regras` — Ver ou editar regras\n`/notificar` — YouTube, Twitch e Kick', inline: false },
            { name: '🌿 CRIA FORMAL',  value: '`/hipster texto:` — Reescreve qualquer mensagem no sotaque cria formal\n• Modo `basico` — rápido e sem IA\n• Modo `ia` — usa Google Gemini (mais autêntico)', inline: false },
            { name: '🎙️ VOZ & IA',     value: '`/entrar` — Fuminho entra no canal de voz e começa a ouvir\n`/sair_voz` — Sai do canal de voz\n• Fale naturalmente: voz → STT → Gemini → TTS\n• Dê comandos de voz: banir, limpar, silenciar, rank', inline: false }
        );

    if (staff) {
        embed1.addFields(
            { name: '👮 STAFF — AVISOS', value: '`/avisar` — Cria aviso interativo', inline: false },
            { name: '👮 STAFF — TOOLS',  value: '`/pontohistorico @membro`\n`/chat @membro`\n`/cargo dar/retirar/listar`\n`/limpeza ver/agora/configurar`\n`/config servidor/seguranca/chat`\n`/resposta adicionar/remover/listar`\n`/nivel ver/cargo/pontos_acao`\n`/votacao resultado/anunciar`', inline: false }
        );
    }

    const embed2 = new EmbedBuilder()
        .setColor(0xFEE75C)
        .setTitle(`🌿 ${bot.toUpperCase()} — COMO FUNCIONA`)
        .setTimestamp()
        .setFooter({ text: `${bot} 🌿` })
        .addFields(
            { name: '💰 COMO GANHAR PONTOS', value: `Depositar dinheiro no bau: **+${config.niveis?.pontosPorAcao?.deposito_bau || 10} pts**\n1° lugar no rank: **+${config.niveis?.pontosPorAcao?.rank_1lugar || 50} pts**\n2° lugar: **+${config.niveis?.pontosPorAcao?.rank_2lugar || 30} pts**\n3° lugar: **+${config.niveis?.pontosPorAcao?.rank_3lugar || 15} pts**\nTop 10: **+${config.niveis?.pontosPorAcao?.rank_top10 || 5} pts**`, inline: false },
            { name: '🛡️ SEGURANCA', value: `Punicao: **${seg.punicao || 'timeout'}**\nBloqueia: links, imagens, spam, palavroes\nStaff nao e afetada`, inline: false }
        );

    if (owner) embed2.addFields({ name: '⚙️ ADMIN (so dono)', value: '`/desligar` `/reiniciar` `/limpar`', inline: false });

    await interaction.reply({ embeds: [embed1, embed2], flags: [MessageFlags.Ephemeral] });
}

// ══════════════════════════════════════════════
//  /nivel
// ══════════════════════════════════════════════
async function handleNivel(interaction) {
    if (!isStaff(interaction)) return interaction.reply({ content: 'So a Staff pode configurar niveis.', flags: [MessageFlags.Ephemeral] });

    const sub    = interaction.options.getSubcommand();
    const niveis = config.niveis?.cargos || [];
    const pts    = config.niveis?.pontosPorAcao || {};

    if (sub === 'ver') {
        const embed = new EmbedBuilder()
            .setColor(0x2ECC71)
            .setTitle('╔══════  🎖️  NÍVEIS DO GUETO  ══════╗')
            .setDescription('> Configure com `/nivel cargo` e `/nivel pontos_acao`\n> \u200b')
            .setFooter({ text: `${nomeBot()} 🌿` })
            .setTimestamp();

        const linhasNiveis = niveis.map((n, i) => {
            const cargoTxt = n.cargoId && !n.cargoId.startsWith('ID_') ? `<@&${n.cargoId}>` : '`Nao configurado`';
            return `> \`${i+1}.\` **${n.nome}** — \`${n.pontosNecessarios} pts\` → ${cargoTxt}`;
        }).join('\n');

        embed.addFields(
            { name: '━━━━━━━  🎖️  NIVEIS  ━━━━━━━',      value: linhasNiveis || '> Nenhum nivel',                                                                                                                                                                                                                       inline: false },
            { name: '━━━━━━━  ✨  PONTOS POR ACAO  ━━━━━━━', value: `> 💰 Deposito bau: \`+${pts.deposito_bau||10} pts\`\n> 🥇 1° rank: \`+${pts.rank_1lugar||50} pts\`\n> 🥈 2°: \`+${pts.rank_2lugar||30} pts\`\n> 🥉 3°: \`+${pts.rank_3lugar||15} pts\`\n> 🏅 Top10: \`+${pts.rank_top10||5} pts\``, inline: false }
        );
        return interaction.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
    }

    if (sub === 'cargo') {
        const numero = interaction.options.getInteger('numero');
        const cargo  = interaction.options.getRole('cargo');
        const pontos = interaction.options.getInteger('pontos');
        if (numero < 1 || numero > niveis.length) return interaction.reply({ content: `Nivel invalido. Use 1 a ${niveis.length}.`, flags: [MessageFlags.Ephemeral] });

        const idx = numero - 1;
        config.niveis.cargos[idx].cargoId = cargo.id;
        if (pontos !== null && pontos >= 0) config.niveis.cargos[idx].pontosNecessarios = pontos;

        const embed = new EmbedBuilder().setColor(0x2ECC71).setTitle('✅  Nivel Configurado!')
            .addFields(
                { name: '🎖️ Nivel',  value: `\`${numero}. ${niveis[idx].nome}\``,                       inline: true },
                { name: '👔 Cargo',  value: `${cargo}`,                                                   inline: true },
                { name: '✨ Pontos', value: `\`${config.niveis.cargos[idx].pontosNecessarios} pts\``,     inline: true }
            )
            .setDescription('> Salva no `config.json` pra manter apos reiniciar!')
            .setFooter({ text: `${nomeBot()} 🌿` })
            .setTimestamp();
        return interaction.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
    }

    if (sub === 'pontos_acao') {
        const dep = interaction.options.getInteger('deposito_bau');
        const p1  = interaction.options.getInteger('rank_1lugar');
        const p2  = interaction.options.getInteger('rank_2lugar');
        const p3  = interaction.options.getInteger('rank_3lugar');
        const p10 = interaction.options.getInteger('rank_top10');

        if (!config.niveis) config.niveis = { pontosPorAcao: {} };
        if (!config.niveis.pontosPorAcao) config.niveis.pontosPorAcao = {};

        if (dep !== null) config.niveis.pontosPorAcao.deposito_bau = dep;
        if (p1  !== null) config.niveis.pontosPorAcao.rank_1lugar  = p1;
        if (p2  !== null) config.niveis.pontosPorAcao.rank_2lugar  = p2;
        if (p3  !== null) config.niveis.pontosPorAcao.rank_3lugar  = p3;
        if (p10 !== null) config.niveis.pontosPorAcao.rank_top10   = p10;

        const pA = config.niveis.pontosPorAcao;
        const embed = new EmbedBuilder().setColor(0x2ECC71).setTitle('✅  Pontos por Acao Atualizados!')
            .addFields({ name: '✨ Configuracao atual', value: `> Bau: \`+${pA.deposito_bau||10}\`  1°: \`+${pA.rank_1lugar||50}\`  2°: \`+${pA.rank_2lugar||30}\`  3°: \`+${pA.rank_3lugar||15}\`  Top10: \`+${pA.rank_top10||5}\``, inline: false })
            .setDescription('> Salva no `config.json` pra manter apos reiniciar!')
            .setFooter({ text: `${nomeBot()} 🌿` })
            .setTimestamp();
        return interaction.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
    }
}

// ══════════════════════════════════════════════
//  /hipster
// ══════════════════════════════════════════════
async function handleHipster(interaction) {
    const texto = interaction.options.getString('texto');
    const modo  = interaction.options.getString('modo') || 'basico';

    await interaction.deferReply();

    try {
        const { reescreverHipster } = require('../hipsterRewriter');
        const resultado = await reescreverHipster(texto, modo);

        const { EmbedBuilder: EB } = require('discord.js');
        const embed = new EB()
            .setColor(modo === 'ia' ? 0xFF6600 : 0x57F287)
            .setTitle(`🌿 SOTAQUE CRIA — Modo ${modo === 'ia' ? '🤖 IA Gemini' : '⚡ Básico'}`)
            .addFields(
                { name: '📝 Original',     value: `\`\`\`${texto}\`\`\``,     inline: false },
                { name: '✨ Versão Hippie', value: `\`\`\`${resultado}\`\`\``, inline: false }
            )
            .setFooter({ text: 'Fuminho 🌿 · Sotaque Cria Formal' })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    } catch (err) {
        console.error('Erro hipster:', err);
        await interaction.editReply({ content: 'Opa, deu ruim aí, brother! 😅' });
    }
}
