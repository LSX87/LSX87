// events/messageCreateBau.js — Fuminho Bot 🌿
const { EmbedBuilder } = require('discord.js');
const config = require('../config.json');
const db     = require('../database/database');

const nomeBot  = () => config.nomeBot || 'Fuminho';
const fmt      = v  => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const VERDE    = 0x2ECC71;
const AMARELO  = 0xF1C40F;
const VERMELHO = 0xE74C3C;
const ROXO     = 0x9B59B6;
const AZUL     = 0x3498DB;

// Únicos cargos que têm direito a ganhar pontos
const CARGOS_COM_PONTOS = [
    '1450471503001813084', // Jump-in
    '1450472254759506035', // Old G
    '1445176418345680997', // Outsider
    '1450471295983550546', // Aliado
];

const membroTemDireitoAPontos = member =>
    CARGOS_COM_PONTOS.some(id => member.roles.cache.has(id));

async function deleteMessageById(channel, messageId) {
    if (!messageId) return;
    try { const m = await channel.messages.fetch(messageId); await m.delete(); } catch (_) {}
}

// ══════════════════════════════════════════════
//  Atualiza o rank no canal após depósito
// ══════════════════════════════════════════════
async function atualizarRankNoCanal(guild) {
    try {
        const canalId = config.canais?.rank;
        if (!canalId || canalId.startsWith('SEU_')) return;
        const canal = await guild.channels.fetch(canalId).catch(() => null);
        if (!canal) return;

        const mesKey  = db.getMesKey();
        const ranking = db.getRankOrdenado(mesKey);
        const meta    = config.rank?.metaMensal || 100000;
        const d       = new Date();
        const nomeMes = d.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

        // Filtra só cargos autorizados
        const rankingFiltrado = [];
        for (const r of ranking) {
            try {
                const member = await guild.members.fetch(r.userId).catch(() => null);
                if (!member) continue;
                if (member.roles.cache.has(config.cargos?.staff)) continue;
                if (!membroTemDireitoAPontos(member)) continue;
                rankingFiltrado.push({ ...r, member });
            } catch (_) { continue; }
        }

        const totalDep = rankingFiltrado.reduce((acc, r) => acc + r.valorTotal, 0);
        const pct      = Math.min(100, Math.round((totalDep / meta) * 100));
        const blocos   = Math.round(pct / 10);
        const barra    = '█'.repeat(blocos) + '░'.repeat(10 - blocos);
        const medalhas = ['🥇', '🥈', '🥉'];
        const top      = rankingFiltrado.slice(0, 10);

        // Monta menções do top 3 para marcar
        const mencoes = top.slice(0, 3).map(r => `${r.member}`).join(' ');

        let rankTexto = '';
        if (top.length === 0) {
            rankTexto = '> Ninguém depositou ainda esse mês!';
        } else {
            rankTexto = top.map((r, i) => {
                const med     = medalhas[i] || `**${i + 1}.**`;
                const mini    = Math.round((r.valorTotal / (top[0].valorTotal || 1)) * 8);
                const barMini = '▰'.repeat(mini) + '▱'.repeat(8 - mini);
                return (
                    `${med} **${r.displayName}**\n` +
                    `> \`${barMini}\` ${config.moeda} **${fmt(r.valorTotal)}** — ${r.depositos} dep.`
                );
            }).join('\n\n');
        }

        const embed = new EmbedBuilder()
            .setColor(0xFEE75C)
            .setTitle(`🏆  RANK DO GUETO — ${nomeMes.toUpperCase()}`)
            .setDescription(
                `> 🎯 **Meta:** \`${config.moeda} ${fmt(meta)}\`\n` +
                `> 💰 **Depositado:** \`${config.moeda} ${fmt(totalDep)}\`\n` +
                `> 📊 **Progresso:** \`${barra}\` \`${pct}%\`\n` +
                `> \u200b`
            )
            .addFields({ name: `━━━━━━━  🏅  TOP ${top.length > 0 ? top.length : ''}  ━━━━━━━`, value: rankTexto || '> Sem dados', inline: false })
            .setFooter({ text: `${nomeBot()} 🌿  ·  Deposita dinheiro sujo no /bau pra subir` })
            .setTimestamp();

        // Apaga TODAS as mensagens antigas do bot no canal do rank
        let continuar = true;
        while (continuar) {
            const msgs    = await canal.messages.fetch({ limit: 50 });
            const antigas = msgs.filter(msg => msg.author.id === guild.client.user.id && msg.embeds.length > 0);
            if (antigas.size === 0) { continuar = false; break; }
            for (const msg of antigas.values()) {
                await msg.delete().catch(() => {});
            }
            if (antigas.size < 50) continuar = false;
        }

        // Manda novo rank com menção do top 3
        await canal.send({ content: top.length > 0 ? `🏆 **RANK ATUALIZADO!** ${mencoes}` : undefined, embeds: [embed] });

    } catch (err) {
        console.error('[RANK] Erro ao atualizar:', err.message);
    }
}

async function sendBauQuestion(channel, title, description, color) {
    const embed = new EmbedBuilder()
        .setColor(color || AMARELO)
        .setTitle(title)
        .setDescription(description)
        .setFooter({ text: `${nomeBot()} 🌿  ·  Baú do Gueto` });
    const sent = await channel.send({ embeds: [embed] });
    return sent.id;
}

async function handleBauFlow(message) {
    if (!message.client.bauFlowData) return;
    const flowData = message.client.bauFlowData.get(message.author.id);
    if (!flowData) return;

    console.log(`[BAU] Msg de ${message.author.tag} | canal=${message.channel.id} | flowChannel=${flowData.channelId} | step=${flowData.step}`);

    if (flowData.channelId && message.channel.id !== flowData.channelId) {
        return;
    }
    if (!flowData) return;

    // Apaga mensagem do usuário imediatamente para manter o chat limpo
    await message.delete().catch(() => {});

    if (Date.now() - flowData.timestamp > 600_000) {
        message.client.bauFlowData.delete(message.author.id);
        await deleteMessageById(message.channel, flowData.questionMessageId);
        const w = await message.channel.send({ embeds: [
            new EmbedBuilder().setColor(VERMELHO)
                .setDescription('⏱️ Demorou demais, mermão. Usa `/bau` de novo.')
                .setFooter({ text: `${nomeBot()} 🌿` })
        ]});
        setTimeout(() => w.delete().catch(() => {}), 5000);
        return;
    }

    const content    = message.content.trim();
    const autoDelete = msg => setTimeout(() => msg.delete().catch(() => {}), 18000);

    // ══════════════════════════════════════════════════════════════
    //  PASSO 1 — Menu principal
    // ══════════════════════════════════════════════════════════════
    if (flowData.step === 1) {
        if (!['1','2','3','4','5'].includes(content)) {
            const w = await message.channel.send({ embeds: [
                new EmbedBuilder().setColor(VERMELHO)
                    .setDescription('❌ Opção inválida. Digita **1**, **2**, **3**, **4** ou **5**.')
            ]});
            setTimeout(() => w.delete().catch(() => {}), 4000);
            return;
        }

        flowData.action = content;
        await deleteMessageById(message.channel, flowData.questionMessageId);

        if (content === '5') {
            if (flowData.timeoutId) clearTimeout(flowData.timeoutId);
            message.client.bauFlowData.delete(message.author.id);
            await showBauContents(message);
            return;
        }

        if (content === '1' || content === '2') {
            flowData.tipo = 'dinheiro';
            flowData.step = 10;
            message.client.bauFlowData.set(message.author.id, flowData);
            flowData.questionMessageId = await sendBauQuestion(
                message.channel,
                content === '1' ? '💵  Adicionar Dinheiro — Qual o tipo?' : '💸  Retirar Dinheiro — Qual o tipo?',
                '`1` — 🟢 Dinheiro **Limpo**\n`2` — 🔴 Dinheiro **Sujo**\n\n> Digita **1** ou **2**',
                content === '1' ? VERDE : VERMELHO
            );
            return;
        }

        if (content === '3' || content === '4') {
            flowData.tipo = 'item';
            flowData.step = 20;
            message.client.bauFlowData.set(message.author.id, flowData);
            flowData.questionMessageId = await sendBauQuestion(
                message.channel,
                content === '3' ? '📦  Adicionar Item — Qual o nome?' : '📤  Retirar Item — Qual o nome?',
                '> Digite o nome do item\n> Ex: `Bandagem`, `Arma`, `Colete`',
                content === '3' ? AZUL : AMARELO
            );
            return;
        }
    }

    // ══════════════════════════════════════════════════════════════
    //  FLUXO DINHEIRO — passos 10 e 11
    // ══════════════════════════════════════════════════════════════

    if (flowData.step === 10) {
        if (!['1','2'].includes(content)) {
            const w = await message.channel.send({ embeds: [
                new EmbedBuilder().setColor(VERMELHO).setDescription('❌ Digita **1** (Limpo) ou **2** (Sujo).')
            ]});
            setTimeout(() => w.delete().catch(() => {}), 4000);
            return;
        }
        flowData.tipoDinheiro = content === '1' ? 'limpo' : 'sujo';
        flowData.step = 11;
        await deleteMessageById(message.channel, flowData.questionMessageId);
        message.client.bauFlowData.set(message.author.id, flowData);

        const atual = db.getDinheiroBau(flowData.tipoDinheiro);
        const label = flowData.tipoDinheiro === 'limpo' ? '🟢 Limpo' : '🔴 Sujo';
        const acao  = flowData.action === '1' ? 'Adicionar' : 'Retirar';

        flowData.questionMessageId = await sendBauQuestion(
            message.channel,
            `💵  ${acao} Dinheiro ${label}`,
            `> **Saldo atual (${label}):** \`${config.moeda} ${fmt(atual)}\`\n\n> Qual o valor?\n> Ex: \`5000\`, \`10000\``,
            flowData.action === '1' ? VERDE : VERMELHO
        );
        return;
    }

    if (flowData.step === 11) {
        const valor = parseFloat(content.replace(/\./g, '').replace(',', '.'));
        if (isNaN(valor) || valor <= 0) {
            const w = await message.channel.send({ embeds: [
                new EmbedBuilder().setColor(VERMELHO).setDescription('❌ Valor inválido. Ex: `5000`')
            ]});
            setTimeout(() => w.delete().catch(() => {}), 4000);
            return;
        }
        await deleteMessageById(message.channel, flowData.questionMessageId);
        if (flowData.timeoutId) clearTimeout(flowData.timeoutId);
        message.client.bauFlowData.delete(message.author.id);

        const tipo    = flowData.tipoDinheiro;
        const label   = tipo === 'limpo' ? '🟢 Limpo' : '🔴 Sujo';
        const cor     = tipo === 'limpo' ? VERDE : VERMELHO;
        const adicion = flowData.action === '1';

        if (adicion) {
            const novo      = db.adicionarDinheiroBau(tipo, valor);
            const rankEntry = db.adicionarAoRank(message.author.id, message.author.tag, message.member.displayName, valor);

            // Só ganha pontos se tiver cargo permitido
            const temDireito = membroTemDireitoAPontos(message.member);

            // Base de pontos: limpo=10, sujo=20
            const ptsBauBase = tipo === 'sujo' ? 20 : 10;

            // Multiplicador por valor depositado (máx 50%)
            let pct_bonus;
            if (valor >= 60000)      pct_bonus = 0.50;
            else if (valor >= 15000) pct_bonus = 0.40;
            else                     pct_bonus = 0.30;

            const ptsBau  = temDireito ? Math.round(ptsBauBase + ptsBauBase * pct_bonus) : 0;
            const ptLabel = `+${ptsBau} pts (bônus ${Math.round(pct_bonus * 100)}%)`;

            const ptResult = temDireito
                ? db.adicionarPontos(message.author.id, message.author.tag, message.member.displayName, ptsBau)
                : db.getPontos(message.author.id);

            // Registra transação para controle anti-trapaça
            if (temDireito && ptsBau > 0) {
                db.registrarTransacao(message.author.id, 'dinheiro_' + tipo, valor, ptsBau);
            }

            const meta     = config.rank?.metaMensal || 100000;
            const rankMes  = db.getRankOrdenado(db.getMesKey());
            const totMes   = rankMes.reduce((a, r) => a + r.valorTotal, 0);
            const pct      = Math.min(100, Math.round((totMes / meta) * 100));
            const blocos   = Math.round(pct / 5);
            const barra    = '`' + '█'.repeat(blocos) + '░'.repeat(20 - blocos) + `\` ${pct}%`;
            const proxNivel = config.niveis?.cargos?.[ptResult.nivel + 1];

            const embed = new EmbedBuilder()
                .setColor(cor)
                .setTitle('╔══════  💰  DINHEIRO ADICIONADO  ══════╗')
                .setDescription(`> 🌿  **${message.member.displayName}** depositou grana no baú!`)
                .addFields(
                    {
                        name: `━━━━━━━  ${label}  DEPOSITADO  ━━━━━━━`,
                        value:
                            `> **Valor adicionado:** \`${config.moeda} ${fmt(valor)}\`\n` +
                            `> **Novo saldo (${label}):** \`${config.moeda} ${fmt(novo)}\``,
                        inline: false
                    },
                    {
                        name: '━━━━━━━  🏦  BAÚ COMPLETO  ━━━━━━━',
                        value:
                            `> 🟢 **Dinheiro Limpo:** \`${config.moeda} ${fmt(db.getDinheiroBau('limpo'))}\`\n` +
                            `> 🔴 **Dinheiro Sujo:** \`${config.moeda} ${fmt(db.getDinheiroBau('sujo'))}\`\n` +
                            `> 💰 **Total no baú:** \`${config.moeda} ${fmt(db.getTotalDinheiroBau())}\`\n` +
                            `> 📊  **Progresso da meta:**\n> ${barra}`,
                        inline: false
                    },
                    {
                        name: '━━━━━━━  ✨  SEUS PONTOS  ━━━━━━━',
                        value: temDireito
                            ? `> 🎖️  **Nível:** \`${ptResult.nomeNivel}\`\n` +
                              `> ✨  **Pontos:** \`${ptResult.pontos} pts\` _(${ptLabel})_\n` +
                              `> 📈  **Próximo:** \`${proxNivel
                                ? proxNivel.nome + ' — faltam ' + Math.max(0, proxNivel.pontosNecessarios - ptResult.pontos) + ' pts'
                                : 'NÍVEL MÁXIMO! 👑'}\``
                            : `> ⛔  Seu cargo não acumula pontos no sistema.`,
                        inline: false
                    }
                )
                .setFooter({ text: `${nomeBot()} 🌿  ·  some em 18s` })
                .setTimestamp();

            const m = await message.channel.send({ embeds: [embed] });
            autoDelete(m);

            // Atualiza o rank no canal APENAS quando for dinheiro sujo
            if (tipo === 'sujo') {
                setTimeout(() => atualizarRankNoCanal(message.guild).catch(e => console.error('[RANK AUTO]', e.message)), 1000);
            }

            if (ptResult.subiu) {
                setTimeout(async () => {
                    const lvlMsg = await message.channel.send({ embeds: [
                        new EmbedBuilder().setColor(AMARELO)
                            .setTitle('🔥  SUBIU DE NÍVEL NO GUETO!')
                            .setDescription(`> ${message.member} é agora **${ptResult.novoNivel}**! 👑`)
                            .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
                            .setFooter({ text: `${nomeBot()} 🌿` })
                            .setTimestamp()
                    ]});
                    if (ptResult.cargoId && !ptResult.cargoId.startsWith('ID_')) {
                        try { await message.member.roles.add(ptResult.cargoId); } catch (_) {}
                    }
                    setTimeout(() => lvlMsg.delete().catch(() => {}), 25000);
                }, 600);
            }

        } else {
            const saldoAtual = db.getDinheiroBau(tipo);
            if (valor > saldoAtual) {
                const w = await message.channel.send({ embeds: [
                    new EmbedBuilder().setColor(VERMELHO)
                        .setTitle('❌  Saldo insuficiente')
                        .setDescription(
                            `> Você tentou retirar \`${config.moeda} ${fmt(valor)}\`\n` +
                            `> mas só tem \`${config.moeda} ${fmt(saldoAtual)}\` de dinheiro ${label} no baú.`
                        )
                        .setFooter({ text: `${nomeBot()} 🌿  ·  some em 10s` })
                ]});
                setTimeout(() => w.delete().catch(() => {}), 10000);
                return;
            }
            const novo = db.retirarDinheiroBau(tipo, valor);

            // Desconta pontos proporcionais ao que foi retirado (só cargos permitidos)
            const temDireitoRet = membroTemDireitoAPontos(message.member);
            const desconto      = temDireitoRet ? db.calcularDesconto(message.author.id, tipo, valor) : 0;
            const ptRetResult   = desconto > 0
                ? db.removerPontos(message.author.id, message.author.tag, message.member.displayName, desconto)
                : db.getPontos(message.author.id);

            const m = await message.channel.send({ embeds: [
                new EmbedBuilder()
                    .setColor(AMARELO)
                    .setTitle('╔══════  💸  DINHEIRO RETIRADO  ══════╗')
                    .addFields(
                        {
                            name: `━━━━━━━  ${label}  RETIRADO  ━━━━━━━`,
                            value:
                                `> **Valor retirado:** \`${config.moeda} ${fmt(valor)}\`\n` +
                                `> **Saldo restante (${label}):** \`${config.moeda} ${fmt(novo)}\``,
                            inline: false
                        },
                        {
                            name: '━━━━━━━  🏦  BAÚ ATUAL  ━━━━━━━',
                            value:
                                `> 🟢 **Dinheiro Limpo:** \`${config.moeda} ${fmt(db.getDinheiroBau('limpo'))}\`\n` +
                                `> 🔴 **Dinheiro Sujo:** \`${config.moeda} ${fmt(db.getDinheiroBau('sujo'))}\`\n` +
                                `> 💰 **Total:** \`${config.moeda} ${fmt(db.getTotalDinheiroBau())}\``,
                            inline: false
                        },
                        {
                            name: '━━━━━━━  ✨  SEUS PONTOS  ━━━━━━━',
                            value: temDireitoRet
                                ? desconto > 0
                                    ? `> ⬇️ **-${desconto} pts** descontados\n> 📊 **Total:** \`${ptRetResult.pontos} pts\``
                                    : `> ✅ Nenhum ponto descontado\n> 📊 **Total:** \`${ptRetResult.pontos} pts\``
                                : `> ⛔ Cargo sem pontos no sistema.`,
                            inline: false
                        }
                    )
                    .setFooter({ text: `Por ${message.member.displayName}  ·  some em 18s` })
                    .setTimestamp()
            ]});
            autoDelete(m);
        }
        return;
    }

    // ══════════════════════════════════════════════════════════════
    //  FLUXO ITEM — passos 20 e 21
    // ══════════════════════════════════════════════════════════════

    if (flowData.step === 20) {
        if (!content || content.length < 1) return;
        await deleteMessageById(message.channel, flowData.questionMessageId);

        const adicion = flowData.action === '3';

        if (adicion) {
            const jaExiste  = db.itemExisteNoBau(content);
            const itemAtual = db.getBauItens()[db.normKey(content)];
            flowData.step      = 21;
            flowData.itemName  = content.trim();
            flowData.jaExistia = jaExiste;
            flowData.qtdAtual  = itemAtual?.quantidade || 0;
            message.client.bauFlowData.set(message.author.id, flowData);

            const aviso = jaExiste
                ? `> ⚠️ **"${content}"** já existe com \`${itemAtual.quantidade} un.\` — vai **somar**!\n> \u200b\n`
                : '';

            flowData.questionMessageId = await sendBauQuestion(
                message.channel,
                `📦  Adicionando: **${content}** — Quantidade?`,
                `${aviso}> Quantas unidades?\n> Ex: \`1\`, \`5\`, \`10\``,
                AZUL
            );
        } else {
            const itens = db.getBauItens();
            const key   = db.normKey(content);
            const item  = itens[key] || null;
            if (!item) {
                message.client.bauFlowData.delete(message.author.id);
                const w = await message.channel.send({ embeds: [
                    new EmbedBuilder().setColor(VERMELHO)
                        .setTitle('❌  Item não encontrado')
                        .setDescription(`> **"${content}"** não tá no ba��.\n> Usa \`/bau\` → opção **5** pra ver o que tem.`)
                        .setFooter({ text: `${nomeBot()} 🌿` })
                ]});
                setTimeout(() => w.delete().catch(() => {}), 6000);
                return;
            }
            flowData.step           = 21;
            flowData.itemName       = key;
            flowData.itemNomeExibir = item.nome;
            flowData.itemCurrentQty = item.quantidade;
            message.client.bauFlowData.set(message.author.id, flowData);
            flowData.questionMessageId = await sendBauQuestion(
                message.channel,
                `📤  Retirando: **${item.nome}**`,
                `> **Quantidade atual:** \`${item.quantidade} un.\`\n\n> Quantas deseja retirar?\n> Digita **0** pra remover tudo`,
                AMARELO
            );
        }
        return;
    }

    if (flowData.step === 21) {
        const qty = parseInt(content);
        if (isNaN(qty) || qty < 0) {
            const w = await message.channel.send({ embeds: [
                new EmbedBuilder().setColor(VERMELHO).setDescription('❌ Quantidade inválida. Digita um número.')
            ]});
            setTimeout(() => w.delete().catch(() => {}), 4000);
            return;
        }
        await deleteMessageById(message.channel, flowData.questionMessageId);
        if (flowData.timeoutId) clearTimeout(flowData.timeoutId);
        message.client.bauFlowData.delete(message.author.id);

        const adicion = flowData.action === '3';

        if (adicion) {
            const item  = db.adicionarItemBau(flowData.itemName, qty);
            const somou = flowData.jaExistia;

            // +10 pts fixo por adicionar item (só cargos permitidos)
            const temDireito = membroTemDireitoAPontos(message.member);
            const ptsItem    = 10;
            const ptResult   = temDireito
                ? db.adicionarPontos(message.author.id, message.author.tag, message.member.displayName, ptsItem)
                : null;

            // Registra transação com quantidade para controle anti-trapaça
            if (temDireito) {
                db.registrarTransacao(message.author.id, 'item', item.nome, ptsItem, qty);
            }

            const m = await message.channel.send({ embeds: [
                new EmbedBuilder()
                    .setColor(AZUL)
                    .setTitle('╔══════  📦  ITEM ADICIONADO  ══════╗')
                    .addFields(
                        {
                            name: '━━━━━━━  📦  ITEM  ━━━━━━━',
                            value:
                                `> **Item:** \`${item.nome}\`\n` +
                                `> **Adicionado:** \`+${qty} un.\`\n` +
                                `> **Total no baú:** \`${item.quantidade} un.\`` +
                                (somou ? ` _(era \`${flowData.qtdAtual}\`, somou!)_` : ' _(item novo!)_'),
                            inline: false
                        },
                        {
                            name: '━━━━━━━  ✨  SEUS PONTOS  ━━━━━━━',
                            value: temDireito
                                ? `> ✨ **+${ptsItem} pts** pelo item!\n> 📊 **Total:** \`${ptResult.pontos} pts\``
                                : `> ⛔ Seu cargo não acumula pontos.`,
                            inline: false
                        }
                    )
                    .setFooter({ text: `Por ${message.member.displayName}  ·  some em 18s` })
                    .setTimestamp()
            ]});
            autoDelete(m);
        } else {
            const result = db.retirarItemBau(flowData.itemName, qty);
            if (!result) {
                const w = await message.channel.send({ embeds: [new EmbedBuilder().setColor(VERMELHO).setDescription('❌ Item não encontrado.')] });
                autoDelete(w); return;
            }

            // Desconta pontos proporcionais à quantidade retirada (só cargos permitidos)
            const temDireitoItem = membroTemDireitoAPontos(message.member);
            const qtyParaDesc    = result.removido ? (flowData.itemCurrentQty || qty) : qty;
            const descontoItem   = temDireitoItem
                ? db.calcularDescontoItem(message.author.id, flowData.itemNomeExibir || flowData.itemName, qtyParaDesc)
                : 0;
            const ptItemRet = descontoItem > 0
                ? db.removerPontos(message.author.id, message.author.tag, message.member.displayName, descontoItem)
                : db.getPontos(message.author.id);

            if (result.removido) {
                const m = await message.channel.send({ embeds: [
                    new EmbedBuilder().setColor(VERMELHO)
                        .setTitle('🗑️  Item Removido do Baú')
                        .addFields(
                            { name: '📦  Item', value: `\`${flowData.itemNomeExibir || flowData.itemName}\` removido completamente.`, inline: false },
                            {
                                name: '✨  Seus Pontos',
                                value: temDireitoItem
                                    ? descontoItem > 0
                                        ? `> ⬇️ **-${descontoItem} pts** descontados\n> 📊 **Total:** \`${ptItemRet.pontos} pts\``
                                        : `> ✅ Nenhum ponto descontado\n> 📊 **Total:** \`${ptItemRet.pontos} pts\``
                                    : `> ⛔ Cargo sem pontos no sistema.`,
                                inline: false
                            }
                        )
                        .setFooter({ text: `Por ${message.member.displayName}  ·  some em 18s` })
                        .setTimestamp()
                ]});
                autoDelete(m);
            } else {
                const m = await message.channel.send({ embeds: [
                    new EmbedBuilder().setColor(AMARELO)
                        .setTitle('📤  Item Retirado do Baú')
                        .addFields(
                            { name: '📦  Item',     value: `\`${flowData.itemNomeExibir || flowData.itemName}\``, inline: true },
                            { name: '➖  Retirado', value: `\`${qty} un.\``,                                      inline: true },
                            { name: '📊  Restante', value: `\`${result.quantidade} un.\``,                        inline: true },
                            {
                                name: '✨  Seus Pontos',
                                value: temDireitoItem
                                    ? descontoItem > 0
                                        ? `> ⬇️ **-${descontoItem} pts** descontados\n> 📊 **Total:** \`${ptItemRet.pontos} pts\``
                                        : `> ✅ Nenhum ponto descontado\n> 📊 **Total:** \`${ptItemRet.pontos} pts\``
                                    : `> ⛔ Cargo sem pontos no sistema.`,
                                inline: false
                            }
                        )
                        .setFooter({ text: `Por ${message.member.displayName}  ·  some em 18s` })
                        .setTimestamp()
                ]});
                autoDelete(m);
            }
        }
        return;
    }
}

async function showBauContents(message) {
    const itens   = db.getBauItens();
    const keys    = Object.keys(itens);
    const limpo   = db.getDinheiroBau('limpo');
    const sujo    = db.getDinheiroBau('sujo');
    const total   = db.getTotalDinheiroBau();
    const meta    = config.rank?.metaMensal || 100000;
    const rankMes = db.getRankOrdenado(db.getMesKey());
    const totMes  = rankMes.reduce((a, r) => a + r.valorTotal, 0);
    const pct     = Math.min(100, Math.round((totMes / meta) * 100));
    const blocos  = Math.round(pct / 10);
    const barra   = '█'.repeat(blocos) + '░'.repeat(10 - blocos);

    // Porcentagem de cada tipo em relação ao total
    const pctLimpo = total > 0 ? Math.round((limpo / total) * 100) : 0;
    const pctSujo  = total > 0 ? Math.round((sujo  / total) * 100) : 0;

    const embed = new EmbedBuilder()
        .setColor(0xF1C40F)
        .setTitle('🏛️  BAÚ DO GUETO — INVENTÁRIO COMPLETO')
        .setDescription(
            `> \u200b\n` +
            `> 🟢 **Limpo:** \`${config.moeda} ${fmt(limpo)}\` _(${pctLimpo}%)_\n` +
            `> 🔴 **Sujo:**  \`${config.moeda} ${fmt(sujo)}\` _(${pctSujo}%)_\n` +
            `> ─────────────────────\n` +
            `> 💰 **Total no Baú:** \`${config.moeda} ${fmt(total)}\`\n` +
            `> \u200b\n` +
            `> 📊 **Meta do mês:** \`${config.moeda} ${fmt(meta)}\`\n` +
            `> \`${barra}\` \`${pct}%\`\n` +
            `> \u200b`
        )
        .setFooter({ text: `${nomeBot()} 🌿  ·  some em 35s` })
        .setTimestamp();

    if (keys.length === 0) {
        embed.addFields({
            name: '📦  ITENS NO BAÚ',
            value: '> _Nenhum item no baú no momento._',
            inline: false
        });
    } else {
        // Divide itens em colunas de até 10
        const chunks = [];
        for (let i = 0; i < keys.length; i += 10) chunks.push(keys.slice(i, i + 10));
        chunks.forEach((chunk, ci) => {
            const linhas = chunk.map((k, i) => {
                const it  = itens[k];
                const num = String(ci * 10 + i + 1).padStart(2, '0');
                const qty = it.quantidade;
                const bar = Math.min(qty, 10);
                const mini = '▰'.repeat(bar) + '▱'.repeat(10 - bar);
                return `> \`${num}.\` **${it.nome}**\n> \`${mini}\` \`${qty} un.\``;
            }).join('\n\n');
            embed.addFields({
                name: ci === 0 ? `📦  ITENS NO BAÚ (${keys.length} tipos)` : '\u200b',
                value: linhas,
                inline: false
            });
        });
    }

    // Apaga mensagem anterior do baú no canal (se houver)
    try {
        const msgs = await message.channel.messages.fetch({ limit: 30 });
        for (const msg of msgs.values()) {
            if (
                msg.author.id === message.client.user.id &&
                msg.embeds.length > 0 &&
                msg.embeds[0]?.title?.includes('BAÚ DO GUETO — INVENTÁRIO')
            ) {
                await msg.delete().catch(() => {});
                break;
            }
        }
    } catch (_) {}

    const m = await message.channel.send({ embeds: [embed] });
    setTimeout(() => m.delete().catch(() => {}), 35000);
}

module.exports = { handleBauFlow, showBauContents };
