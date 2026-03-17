// index.js — Fuminho Bot 🌿
require('dotenv').config();
const { Client, Collection, Events, GatewayIntentBits, REST, Routes, EmbedBuilder } = require('discord.js');
const fs     = require('fs');
const path   = require('path');
const config = require('./config.json');
const db     = require('./database/database');

// Canais onde o bot NUNCA apaga mensagens (fotos, memes, etc)
const CANAIS_PROTEGIDOS = ['1483168263113408784', '1483146567337771228'];

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildVoiceStates
    ]
});

client.commands    = new Collection();
client.config      = config;
client.bauFlowData = new Map();
client.avisarFlow  = new Map();

// ═══ CARREGAR EVENTOS ════════════════════════════════════════════
const loadEvents = () => {
    const eventsPath = path.join(__dirname, 'events');
    if (!fs.existsSync(eventsPath)) return;
    for (const file of fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'))) {
        try {
            const event = require('./events/' + file);
            if (!event.name || !event.execute) continue;
            client[event.once ? 'once' : 'on'](event.name, (...args) => event.execute(...args));
            console.log('  ✓ Evento: ' + file);
        } catch (err) {
            console.error('  ✗ Erro em ' + file + ':', err.message);
        }
    }
};

// ═══ SEGURANÇA ═══════════════════════════════════════════════════
const linkPatterns = [
    /discord\.gg\/[a-zA-Z0-9]+/gi,
    /free.*nitro/gi,
    /discord\.nitro\.[a-z]+/gi,
    /https?:\/\/(?!(?:www\.)?(?:youtube\.com|youtu\.be|twitch\.tv|imgur\.com|discord\.com|discordapp\.com))[^\s]+/gi,
];
const spamMap = new Map();

client.on(Events.MessageCreate, async (message) => {
    if (!message.guild || !message.member || message.author.bot) return;

    // Log chat
    try { db.logChat(message.author.id, message.author.tag, message.member.displayName, message.guild.id, message.channel.name, message.content); } catch(_) {}

    // Respostas automáticas
    try {
        const respostas = db.getRespostas();
        const lower = message.content.toLowerCase();
        for (const [gatilho, resposta] of Object.entries(respostas)) {
            if (lower.includes(gatilho.toLowerCase())) {
                await message.reply(resposta);
                break;
            }
        }
    } catch(_) {}

    // Canais protegidos — nunca apaga
    const canaisIgn = [...CANAIS_PROTEGIDOS, ...(config.seguranca?.canaisIgnorados || [])];
    if (canaisIgn.includes(message.channel.id)) return;

    const seg = config.seguranca;
    if (!seg?.ativo) return;
    const isStaff = message.member.roles.cache.has(config.cargos?.staff);
    const isOwner = message.author.id === config.ownerId;
    if (isStaff || isOwner) return;

    let motivo = null;
    if (seg.banirLinks) {
        const lower = message.content.toLowerCase();
        for (const p of linkPatterns) { p.lastIndex = 0; if (p.test(lower)) { motivo = '🔗 Link suspeito'; break; } }
    }
    if (!motivo && seg.banirImagens && message.attachments.size > 0) motivo = '🖼️ Imagem não autorizada';
    if (!motivo && seg.palavrasProibidas?.length > 0) {
        const lower = message.content.toLowerCase();
        for (const p of seg.palavrasProibidas) { if (lower.includes(p.toLowerCase())) { motivo = '🤬 Palavra proibida'; break; } }
    }
    if (!motivo && seg.maxMensagens > 0) {
        const uid = message.author.id, agora = Date.now();
        if (!spamMap.has(uid)) spamMap.set(uid, []);
        const ts = spamMap.get(uid).filter(t => agora - t < (seg.tempoJanela || 3000));
        ts.push(agora); spamMap.set(uid, ts);
        if (ts.length >= seg.maxMensagens) { motivo = '📨 Spam'; spamMap.delete(uid); }
    }
    if (motivo) {
        try {
            await message.delete().catch(() => {});
            await message.member.timeout((seg.timeoutMinutos||10)*60000, motivo);
            const av = await message.channel.send({ content: `> ⚠️ **${message.author.username}** silenciado: *${motivo}*` });
            setTimeout(() => av.delete().catch(()=>{}), 8000);
        } catch(e) { console.error('Erro segurança:', e.message); }
    }
});

// ═══ BATE-PONTO POR VOZ ══════════════════════════════════════════
client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
    try {
        const callId = config.canais?.call_ponto;
        if (!callId || callId.startsWith('SEU_')) return;
        const membro = newState.member || oldState.member;
        if (!membro || membro.user.bot) return;
        const guildId = (newState.guild || oldState.guild).id;
        const uid = membro.user.id;
        const entrou = !oldState.channelId && newState.channelId === callId;
        const saiu   = oldState.channelId === callId && newState.channelId !== callId;
        if (!entrou && !saiu) return;
        const tipo = entrou ? 'entrada' : 'saida';
        const ultimo = db.getUltimoPonto(uid, guildId);
        if (tipo === 'entrada' && ultimo?.tipo === 'entrada') return;
        if (tipo === 'saida' && (!ultimo || ultimo.tipo === 'saida')) return;
        const reg = db.baterPonto(uid, membro.user.tag, membro.displayName, tipo, guildId);
        let tempo = '';
        if (tipo === 'saida' && ultimo) {
            const min = Math.floor((reg.timestamp - ultimo.timestamp) / 60000);
            tempo = `> ⏱️ **Tempo:** \`${Math.floor(min/60)}h ${min%60}min\``;
        }
        const canalId = config.canais?.ponto;
        let canal = null;
        if (canalId && !canalId.startsWith('SEU_')) {
            try { canal = await (newState.guild||oldState.guild).channels.fetch(canalId); } catch(_) {}
        }
        if (!canal) canal = newState.channel || oldState.channel;
        if (!canal?.send) return;
        const embed = new EmbedBuilder()
            .setColor(entrou ? 0x2ECC71 : 0xE74C3C)
            .setTitle(entrou ? '🟢 CHEGOU NA CALL — PONTO REGISTRADO' : '🔴 SAIU DA CALL — PONTO FECHADO')
            .setDescription(`> 👤 **Membro:** ${membro}\n> 🕐 **Horário:** \`${reg.data}\`\n${tempo ? tempo+'\n' : ''}> 🎙️ **Canal:** \`${entrou ? newState.channel?.name : oldState.channel?.name}\``)
            .setThumbnail(membro.user.displayAvatarURL({ dynamic: true }))
            .setFooter({ text: 'Fuminho 🌿 · Ponto automático por voz' })
            .setTimestamp();
        const msg = await canal.send({ embeds: [embed] });
        setTimeout(() => msg.delete().catch(()=>{}), 30000);
    } catch(e) { console.error('Erro voicePonto:', e.message); }
});

// ═══ SLASH COMMANDS ══════════════════════════════════════════════
const SLASH_COMMANDS = [
    { name: 'ajuda', description: '🌿 Mostra todos os comandos do Fuminho' },
    { name: 'bau',   description: '💰 Deposita, retira ou vê o baú do gueto' },
    { name: 'rank', description: '🏆 Sistema de rank mensal do baú', options: [
        { type: 1, name: 'ver', description: 'Ver o rank do mês atual' },
        { type: 1, name: 'meta', description: 'Alterar meta mensal (Staff)', options: [{ type: 10, name: 'valor', description: 'Nova meta em R$', required: true }] },
        { type: 1, name: 'fechar', description: 'Fechar o rank do mês (Staff)' },
        { type: 1, name: 'resetar', description: 'Zerar o rank do mês (Staff)' },
        { type: 1, name: 'adicionar', description: 'Adicionar membro ao rank (Staff)', options: [{ type: 6, name: 'membro', description: 'Membro', required: true }, { type: 10, name: 'valor', description: 'Valor em R$', required: true }] }
    ]},
    { name: 'pontos', description: '✨ Sistema de pontos e níveis', options: [
        { type: 1, name: 'ver', description: 'Ver seus pontos', options: [{ type: 6, name: 'membro', description: 'Ver de outro membro', required: false }] },
        { type: 1, name: 'ranking', description: 'Top 10 de pontos' },
        { type: 1, name: 'dar', description: 'Dar pontos (Staff)', options: [{ type: 6, name: 'membro', description: 'Membro', required: true }, { type: 4, name: 'quantidade', description: 'Quantidade', required: true }] },
        { type: 1, name: 'configurar', description: 'Ver configuração dos níveis (Staff)' }
    ]},
    { name: 'nivel', description: '🎖️ Configura cargos de nível (Staff)', options: [
        { type: 1, name: 'ver', description: 'Ver todos os níveis' },
        { type: 1, name: 'cargo', description: 'Vincular cargo a nível', options: [{ type: 4, name: 'numero', description: 'Número do nível', required: true }, { type: 8, name: 'cargo', description: 'Cargo', required: true }, { type: 4, name: 'pontos', description: 'Pontos necessários', required: false }] },
        { type: 1, name: 'pontos_acao', description: 'Configurar pontos por ação', options: [{ type: 4, name: 'deposito_bau', description: 'Pontos por depósito', required: false }, { type: 4, name: 'rank_1lugar', description: 'Pontos 1º lugar', required: false }, { type: 4, name: 'rank_2lugar', description: 'Pontos 2º lugar', required: false }, { type: 4, name: 'rank_3lugar', description: 'Pontos 3º lugar', required: false }, { type: 4, name: 'rank_top10', description: 'Pontos top 10', required: false }] }
    ]},
    { name: 'ponto', description: '🕐 Bate ponto manual', options: [{ type: 3, name: 'tipo', description: 'Tipo do ponto', required: true, choices: [{ name: 'Entrada', value: 'entrada' }, { name: 'Saída', value: 'saida' }] }] },
    { name: 'pontohistorico', description: '📋 Ver histórico de ponto (Staff)', options: [{ type: 6, name: 'membro', description: 'Membro', required: true }] },
    { name: 'chat', description: '💬 Ver histórico de chat (Staff)', options: [{ type: 6, name: 'membro', description: 'Membro', required: true }, { type: 4, name: 'limite', description: 'Quantas mensagens', required: false }] },
    { name: 'avisar', description: '📢 Envia aviso em um canal (Staff)' },
    { name: 'limpeza', description: '🧹 Configura limpeza automática (Staff)', options: [
        { type: 1, name: 'ver', description: 'Ver configuração' },
        { type: 1, name: 'agora', description: 'Limpar canal agora', options: [{ type: 7, name: 'canal', description: 'Canal', required: true }] },
        { type: 1, name: 'configurar', description: 'Configurar limpeza', options: [{ type: 5, name: 'ativo', description: 'Ativar/desativar', required: true }, { type: 3, name: 'horario', description: 'Horário HH:MM', required: false }, { type: 3, name: 'dias', description: 'Dias da semana', required: false }, { type: 3, name: 'canais', description: 'IDs dos canais', required: false }] }
    ]},
    { name: 'cargo', description: '👮 Gerencia cargos (Staff)', options: [
        { type: 1, name: 'dar', description: 'Dá cargo', options: [{ type: 6, name: 'membro', description: 'Membro', required: true }, { type: 8, name: 'cargo', description: 'Cargo', required: true }] },
        { type: 1, name: 'retirar', description: 'Tira cargo', options: [{ type: 6, name: 'membro', description: 'Membro', required: true }, { type: 8, name: 'cargo', description: 'Cargo', required: true }] },
        { type: 1, name: 'listar', description: 'Lista cargos', options: [{ type: 6, name: 'membro', description: 'Membro', required: true }] }
    ]},
    { name: 'regras', description: '📜 Ver ou editar regras', options: [
        { type: 1, name: 'ver', description: 'Mostra as regras' },
        { type: 1, name: 'adicionar', description: 'Adiciona regra', options: [{ type: 3, name: 'texto', description: 'Texto da regra', required: true }] },
        { type: 1, name: 'remover', description: 'Remove regra', options: [{ type: 4, name: 'numero', description: 'Número da regra', required: true }] },
        { type: 1, name: 'editar', description: 'Edita regra', options: [{ type: 4, name: 'numero', description: 'Número', required: true }, { type: 3, name: 'texto', description: 'Novo texto', required: true }] }
    ]},
    { name: 'enquete', description: '🗳️ Sistema de enquetes', options: [
        { type: 1, name: 'criar', description: 'Criar nova enquete (Staff)', options: [
            { type: 3, name: 'pergunta', description: 'Pergunta da enquete', required: true },
            { type: 3, name: 'opcoes', description: 'Opções separadas por vírgula (ex: Sim,Não,Talvez)', required: true },
            { type: 3, name: 'duracao', description: 'Duração (ex: 1h, 30min, 1d)', required: false }
        ]},
        { type: 1, name: 'votar', description: 'Votar em uma enquete', options: [
            { type: 3, name: 'id', description: 'ID da enquete', required: true },
            { type: 3, name: 'opcao', description: 'Número da opção', required: true }
        ]},
        { type: 1, name: 'resultado', description: 'Ver resultado de uma enquete (Staff)', options: [
            { type: 3, name: 'id', description: 'ID da enquete', required: true }
        ]},
        { type: 1, name: 'encerrar', description: 'Encerrar enquete (Staff)', options: [
            { type: 3, name: 'id', description: 'ID da enquete', required: true }
        ]},
        { type: 1, name: 'listar', description: 'Listar enquetes abertas' }
    ]},
    { name: 'notificar', description: '🔔 Ver e editar notificações' },
    { name: 'config', description: '⚙️ Painel de configurações (Staff)', options: [
        { type: 1, name: 'servidor', description: 'Nome e moeda' },
        { type: 1, name: 'seguranca', description: 'Punição e filtros' },
        { type: 1, name: 'chat', description: 'Respostas automáticas' },
        { type: 1, name: 'enquete', description: 'Gerenciar enquetes' }
    ]},
    { name: 'resposta', description: '💬 Gerencia respostas automáticas (Staff)', options: [
        { type: 1, name: 'adicionar', description: 'Adiciona resposta', options: [{ type: 3, name: 'gatilho', description: 'Palavra-chave', required: true }, { type: 3, name: 'mensagem', description: 'Resposta', required: true }] },
        { type: 1, name: 'remover', description: 'Remove resposta', options: [{ type: 3, name: 'gatilho', description: 'Palavra-chave', required: true }] },
        { type: 1, name: 'listar', description: 'Lista todas as respostas' }
    ]},
    { name: 'desligar',  description: '🔴 Desliga o bot (só dono)' },
    { name: 'reiniciar', description: '🔄 Reinicia o bot (só dono)' },
    { name: 'limpar',    description: '🧹 Apaga mensagens do canal (só dono)' }
];

async function registerCommands() {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        console.log('📡 Registrando slash commands...');
        await rest.put(Routes.applicationCommands(client.user.id), { body: SLASH_COMMANDS });
        console.log('✅ ' + SLASH_COMMANDS.length + ' slash commands registrados!');
    } catch (err) {
        console.error('❌ Erro ao registrar commands:', err.message);
    }
}

async function limparCanalCompleto(canal) {
    try {
        let deleted;
        do {
            const msgs   = await canal.messages.fetch({ limit: 100 });
            const recent = msgs.filter(m => Date.now() - m.createdTimestamp < 14 * 24 * 60 * 60 * 1000);
            if (recent.size === 0) break;
            deleted = await canal.bulkDelete(recent, true);
            await new Promise(r => setTimeout(r, 1200));
        } while (deleted && deleted.size > 0);
        let continuar = true;
        while (continuar) {
            const msgs   = await canal.messages.fetch({ limit: 100 });
            const antigas = msgs.filter(m => Date.now() - m.createdTimestamp >= 14 * 24 * 60 * 60 * 1000);
            if (antigas.size === 0) { continuar = false; break; }
            for (const msg of antigas.values()) {
                try { await msg.delete(); await new Promise(r => setTimeout(r, 600)); } catch (_) {}
            }
            if (antigas.size < 100) continuar = false;
        }
    } catch (err) { console.error('Erro ao limpar:', err.message); }
}
client.limparCanalCompleto = limparCanalCompleto;

function startAutoLimpeza() {
    setInterval(async () => {
        const agora = new Date();
        const horaAtual = String(agora.getHours()).padStart(2,'0') + ':' + String(agora.getMinutes()).padStart(2,'0');
        const diaAtual  = agora.getDay();
        for (const guild of client.guilds.cache.values()) {
            try {
                const cfg = await db.getLimpezaConfig(guild.id);
                if (!cfg.ativo || cfg.canais.length === 0) continue;
                if (cfg.horario !== horaAtual) continue;
                if (!cfg.diasDaSemana.includes(diaAtual)) continue;
                for (const canalId of cfg.canais) {
                    const canal = guild.channels.cache.get(canalId);
                    if (canal) await limparCanalCompleto(canal);
                }
            } catch (err) { console.error('Erro auto-limpeza:', err.message); }
        }
    }, 60_000);
}

client.once(Events.ClientReady, async c => {
    console.log('\n╔══════════════════════════════════╗');
    console.log(`║   Fuminho Bot 🌿 — ONLINE!          ║`);
    console.log(`║   Tag: ${c.user.tag.substring(0,22).padEnd(22)} ║`);
    console.log(`║   Servidores: ${String(c.guilds.cache.size).padEnd(18)} ║`);
    console.log('╚══════════════════════════════════╝\n');
    await registerCommands();
    startAutoLimpeza();
});

process.on('unhandledRejection', err => console.error('unhandledRejection:', err?.message || err));
process.on('uncaughtException',  err => console.error('uncaughtException:',  err?.message || err));

loadEvents();
client.login(process.env.DISCORD_TOKEN);
