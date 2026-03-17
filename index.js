// index.js — Fuminho Bot 🌿
require('dotenv').config();
const { Client, Collection, Events, GatewayIntentBits, REST, Routes, EmbedBuilder } = require('discord.js');
const fs     = require('fs');
const path   = require('path');
const config = require('./config.json');
const db     = require('./database/database');

// IDs de canais que o bot NUNCA deve apagar mensagens
const CANAIS_IGNORADOS_SEGURANCA = [
    '1483168263113408784', // fotos
    '1483146567337771228', // memes
];

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

// ═══ SEGURANÇA INLINE ════════════════════════════════════════════
const LINK_PATTERNS = [
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

    // Segurança — ignorar canais de fotos/memes e outros configurados
    const canaisIgn = [...CANAIS_IGNORADOS_SEGURANCA, ...(config.seguranca?.canaisIgnorados || [])];
    if (canaisIgn.includes(message.channel.id)) return;

    const seg = config.seguranca;
    if (!seg?.ativo) return;
    const isStaff = message.member.roles.cache.has(config.cargos?.staff);
    const isOwner = message.author.id === config.ownerId;
    if (isStaff || isOwner) return;

    let motivo = null;

    if (seg.banirLinks) {
        const lower = message.content.toLowerCase();
        for (const pattern of LINK_PATTERNS) {
            pattern.lastIndex = 0;
            if (pattern.test(lower)) { motivo = '🔗 Link suspeito'; break; }
        }
    }
    if (!motivo && seg.banirImagens && message.attachments.size > 0) {
        motivo = '🖼️ Imagem não autorizada';
    }
    if (!motivo && seg.palavrasProibidas?.length > 0) {
        const lower = message.content.toLowerCase();
        for (const palavra of seg.palavrasProibidas) {
            if (lower.includes(palavra.toLowerCase())) { motivo = '🤬 Palavra proibida'; break; }
        }
    }
    if (!motivo && seg.maxMensagens > 0) {
        const uid = message.author.id;
        const agora = Date.now();
        if (!spamMap.has(uid)) spamMap.set(uid, []);
        const ts = spamMap.get(uid).filter(t => agora - t < (seg.tempoJanela || 3000));
        ts.push(agora);
        spamMap.set(uid, ts);
        if (ts.length >= seg.maxMensagens) { motivo = '📨 Spam'; spamMap.delete(uid); }
    }

    if (motivo) {
        try {
            await message.delete().catch(() => {});
            const min = seg?.timeoutMinutos || 10;
            await message.member.timeout(min * 60 * 1000, motivo);
            const aviso = await message.channel.send({ content: `> ⚠️ **${message.author.username}** foi silenciado por: *${motivo}*` });
            setTimeout(() => aviso.delete().catch(() => {}), 8000);
        } catch(err) { console.error('Erro segurança:', err.message); }
    }
});

// ═══ BATE-PONTO POR VOZ INLINE ═══════════════════════════════════
client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
    try {
        const callPontoId = config.canais?.call_ponto;
        if (!callPontoId || callPontoId.startsWith('SEU_')) return;
        const membro = newState.member || oldState.member;
        if (!membro || membro.user.bot) return;
        const guildId = (newState.guild || oldState.guild).id;
        const uid = membro.user.id;
        const entrou = !oldState.channelId && newState.channelId === callPontoId;
        const saiu   = oldState.channelId === callPontoId && newState.channelId !== callPontoId;
        if (!entrou && !saiu) return;
        const tipo   = entrou ? 'entrada' : 'saida';
        const ultimo = db.getUltimoPonto(uid, guildId);
        if (tipo === 'entrada' && ultimo?.tipo === 'entrada') return;
        if (tipo === 'saida' && (!ultimo || ultimo.tipo === 'saida')) return;
        const reg = db.baterPonto(uid, membro.user.tag, membro.displayName, tipo, guildId);
        let tempoPeriodo = '';
        if (tipo === 'saida' && ultimo) {
            const ms  = reg.timestamp - ultimo.timestamp;
            const min = Math.floor(ms / 60000);
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
            .setColor(entrou ? 0x2ECC71 : 0xE74C3C)
            .setTitle(entrou ? '🟢  CHEGOU NA CALL — PONTO REGISTRADO' : '🔴  SAIU DA CALL — PONTO FECHADO')
            .setDescription(
                `> 👤  **Membro:** ${membro}\n` +
                `> 🕐  **Horário:** \`${reg.data}\`\n` +
                (tempoPeriodo ? tempoPeriodo + '\n' : '') +
                `> 🎙️  **Canal:** \`${entrou ? newState.channel?.name : oldState.channel?.name}\``
            )
            .setThumbnail(membro.user.displayAvatarURL({ dynamic: true }))
            .setFooter({ text: 'Fuminho 🌿  ·  Ponto automático por voz' })
            .setTimestamp();
        const msg = await canalTexto.send({ embeds: [embed] });
        setTimeout(() => msg.delete().catch(() => {}), 30000);
    } catch (err) {
        console.error('Erro voicePonto:', err.message);
    }
});


const SLASH_COMMANDS = [
    { name: 'ajuda', description: '🌿 Mostra todos os comandos do Fuminho' },
    { name: 'bau',   description: '💰 Deposita, retira ou vê o baú do gueto' },
    {
        name: 'rank', description: '🏆 Sistema de rank mensal do baú',
        options: [
            { type: 1, name: 'ver',     description: 'Ver o rank do mês atual' },
            { type: 1, name: 'meta',    description: 'Alterar meta mensal (Staff)',
              options: [{ type: 10, name: 'valor', description: 'Nova meta em R$', required: true }] },
            { type: 1, name: 'fechar',  description: 'Fechar o rank do mês e distribuir pontos (Staff)' },
            { type: 1, name: 'resetar', description: 'Zerar o rank do mês sem distribuir pontos (Staff)' },
            { type: 1, name: 'adicionar', description: 'Adicionar membro ao rank manualmente (Staff)',
              options: [
                  { type: 6,  name: 'membro', description: 'Membro a adicionar', required: true },
                  { type: 10, name: 'valor',  description: 'Valor em R$ para adicionar ao rank', required: true }
              ]
            }
        ]
    },
    {
        name: 'pontos', description: '✨ Sistema de pontos e níveis',
        options: [
            { type: 1, name: 'ver',        description: 'Ver seus pontos e nível',
              options: [{ type: 6, name: 'membro', description: 'Ver de outro membro', required: false }] },
            { type: 1, name: 'ranking',    description: 'Top 10 geral de pontos' },
            { type: 1, name: 'dar',        description: 'Dar pontos a um membro (Staff)',
              options: [
                  { type: 6, name: 'membro',     description: 'Membro', required: true },
                  { type: 4, name: 'quantidade', description: 'Quantidade de pontos', required: true }
              ]
            },
            { type: 1, name: 'configurar', description: 'Ver configuração dos níveis (Staff)' }
        ]
    },
    {
        name: 'nivel', description: '🎖️ Configura os cargos de cada nível (Staff)',
        options: [
            { type: 1, name: 'ver',      description: 'Ver todos os níveis configurados' },
            { type: 1, name: 'cargo',    description: 'Vincular um cargo a um nível',
              options: [
                  { type: 4, name: 'numero',      description: 'Número do nível (1=OG, 2=Jump-in, etc)', required: true },
                  { type: 8, name: 'cargo',        description: 'Cargo do Discord', required: true },
                  { type: 4, name: 'pontos',       description: 'Pontos necessários para este nível', required: false }
              ]
            },
            { type: 1, name: 'pontos_acao', description: 'Configurar pontos ganhos por cada ação',
              options: [
                  { type: 4, name: 'deposito_bau', description: 'Pontos por depósito no baú',  required: false },
                  { type: 4, name: 'rank_1lugar',  description: 'Pontos por 1º lugar no rank',  required: false },
                  { type: 4, name: 'rank_2lugar',  description: 'Pontos por 2º lugar no rank',  required: false },
                  { type: 4, name: 'rank_3lugar',  description: 'Pontos por 3º lugar no rank',  required: false },
                  { type: 4, name: 'rank_top10',   description: 'Pontos por top 10 no rank',    required: false }
              ]
            }
        ]
    },
    { name: 'ponto', description: '🕐 Bate ponto entrada ou saída (manual)',
      options: [{ type: 3, name: 'tipo', description: 'Tipo do ponto', required: true,
        choices: [{ name: 'Entrada', value: 'entrada' }, { name: 'Saída', value: 'saida' }] }]
    },
    { name: 'pontohistorico', description: '📋 Ver histórico de ponto de um membro (Staff)',
      options: [{ type: 6, name: 'membro', description: 'Membro', required: true }]
    },
    { name: 'chat', description: '💬 Ver histórico de chat de um membro (Staff)',
      options: [
          { type: 6, name: 'membro', description: 'Membro', required: true },
          { type: 4, name: 'limite', description: 'Quantas mensagens (padrão: 20)', required: false }
      ]
    },
    { name: 'avisar', description: '📢 Envia aviso em um canal (Staff)' },
    { name: 'limpeza', description: '🧹 Configura limpeza automática de canais (Staff)',
      options: [
          { type: 1, name: 'ver',    description: 'Ver configuração atual' },
          { type: 1, name: 'agora',  description: 'Limpar um canal agora',
            options: [{ type: 7, name: 'canal', description: 'Canal para limpar', required: true }] },
          { type: 1, name: 'configurar', description: 'Configurar limpeza automática',
            options: [
                { type: 5, name: 'ativo',   description: 'Ativar/desativar', required: true },
                { type: 3, name: 'horario', description: 'Horário HH:MM (ex: 03:00)', required: false },
                { type: 3, name: 'dias',    description: 'Dias (ex: 1,2,3,4,5 = seg-sex)', required: false },
                { type: 3, name: 'canais',  description: 'IDs dos canais separados por vírgula', required: false }
            ]
          }
      ]
    },
    { name: 'cargo', description: '👮 Gerencia cargos (Staff)',
      options: [
          { type: 1, name: 'dar',     description: 'Dá cargo',   options: [{ type: 6, name: 'membro', description: 'Membro', required: true }, { type: 8, name: 'cargo', description: 'Cargo', required: true }] },
          { type: 1, name: 'retirar', description: 'Tira cargo', options: [{ type: 6, name: 'membro', description: 'Membro', required: true }, { type: 8, name: 'cargo', description: 'Cargo', required: true }] },
          { type: 1, name: 'listar',  description: 'Lista cargos', options: [{ type: 6, name: 'membro', description: 'Membro', required: true }] }
      ]
    },
    { name: 'regras', description: '📜 Ver ou editar regras',
      options: [
          { type: 1, name: 'ver',       description: 'Mostra as regras' },
          { type: 1, name: 'adicionar', description: 'Adiciona regra', options: [{ type: 3, name: 'texto', description: 'Texto da regra', required: true }] },
          { type: 1, name: 'remover',   description: 'Remove regra',   options: [{ type: 4, name: 'numero', description: 'Número da regra', required: true }] },
          { type: 1, name: 'editar',    description: 'Edita regra',    options: [{ type: 4, name: 'numero', description: 'Número da regra', required: true }, { type: 3, name: 'texto', description: 'Novo texto', required: true }] }
      ]
    },
    { name: 'votacao', description: '🗳️ Sistema de votações',
      options: [
          { type: 1, name: 'ver',       description: 'Ver votações abertas' },
          { type: 1, name: 'votar',     description: 'Votar em uma opção',
            options: [
                { type: 3, name: 'evento',  description: 'Votação', required: true, choices: [{ name: 'Formula 1', value: 'formula1' }, { name: 'Copa do Mundo', value: 'copa_mundo' }, { name: 'Olimpíadas', value: 'olimpiadas' }, { name: 'NBA', value: 'nba' }] },
                { type: 3, name: 'escolha', description: 'Sua escolha', required: true }
            ]
          },
          { type: 1, name: 'resultado', description: 'Ver resultado (Staff)',
            options: [{ type: 3, name: 'evento', description: 'Votação', required: true, choices: [{ name: 'Formula 1', value: 'formula1' }, { name: 'Copa do Mundo', value: 'copa_mundo' }, { name: 'Olimpíadas', value: 'olimpiadas' }, { name: 'NBA', value: 'nba' }] }]
          },
          { type: 1, name: 'anunciar', description: 'Anuncia votação (Staff)',
            options: [
                { type: 3, name: 'evento',  description: 'Votação', required: true, choices: [{ name: 'Formula 1', value: 'formula1' }, { name: 'Copa do Mundo', value: 'copa_mundo' }, { name: 'Olimpíadas', value: 'olimpiadas' }, { name: 'NBA', value: 'nba' }] },
                { type: 3, name: 'detalhe', description: 'Detalhes adicionais', required: false }
            ]
          }
      ]
    },
    { name: 'notificar', description: '🔔 Ver e editar notificações (YouTube/Twitch/Kick)' },
    { name: 'config', description: '⚙️ Painel de configurações (Staff)',
      options: [
          { type: 1, name: 'servidor',  description: 'Nome e moeda' },
          { type: 1, name: 'seguranca', description: 'Punição e filtros' },
          { type: 1, name: 'chat',      description: 'Respostas automáticas' },
          { type: 1, name: 'votacao',   description: 'Gerenciar votações' }
      ]
    },
    { name: 'resposta', description: '💬 Gerencia respostas automáticas do chat (Staff)',
      options: [
          { type: 1, name: 'adicionar', description: 'Adiciona resposta', options: [{ type: 3, name: 'gatilho', description: 'Palavra-chave', required: true }, { type: 3, name: 'mensagem', description: 'Resposta', required: true }] },
          { type: 1, name: 'remover',   description: 'Remove resposta',   options: [{ type: 3, name: 'gatilho', description: 'Palavra-chave', required: true }] },
          { type: 1, name: 'listar',    description: 'Lista todas as respostas' }
      ]
    },
    { name: 'desligar',  description: '🔴 Desliga o bot (só dono)' },
    { name: 'reiniciar', description: '🔄 Reinicia o bot (só dono)' },
    { name: 'limpar',    description: '🧹 Apaga TODAS as mensagens do canal (só dono)' }
]

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
        // Recentes (bulk delete)
        let deleted;
        do {
            const msgs   = await canal.messages.fetch({ limit: 100 });
            const recent = msgs.filter(m => Date.now() - m.createdTimestamp < 14 * 24 * 60 * 60 * 1000);
            if (recent.size === 0) break;
            deleted = await canal.bulkDelete(recent, true);
            await new Promise(r => setTimeout(r, 1200));
        } while (deleted && deleted.size > 0);

        // Antigas (uma por uma)
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
        console.log('🧹 Canal #' + canal.name + ' limpo (recentes + antigas)');
    } catch (err) {
        console.error('Erro ao limpar #' + canal.name + ':', err.message);
    }
}
client.limparCanalCompleto = limparCanalCompleto;

function startAutoLimpeza() {
    setInterval(async () => {
        const agora     = new Date();
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
            } catch (err) {
                console.error('Erro auto-limpeza:', err.message);
            }
        }
    }, 60_000);
}

client.once(Events.ClientReady, async c => {
    const bot = config.nomeBot || 'Fuminho';
    console.log('\n╔══════════════════════════════════╗');
    console.log(`║   ${bot} Bot 🌿 — ONLINE!          ║`);
    console.log(`║   Tag: ${c.user.tag.substring(0,22).padEnd(22)} ║`);
    console.log(`║   Servidores: ${String(c.guilds.cache.size).padEnd(18)} ║`);
    console.log('╚══════════════════════════════════╝\n');
    await registerCommands();
    startAutoLimpeza();
});

process.on('unhandledRejection', err => console.error('unhandledRejection:', err?.message || err));
process.on('uncaughtException',  err => console.error('uncaughtException:',  err?.message || err));



// ═══ SECURITY FILTERS (inline) ═══════════════════════════════════
// events/securityFilters.js
// Segurança: links, imagens, palavras proibidas, spam → timeout ou ban
const { EmbedBuilder } = require('discord.js');
const config = require('./config.json');
const db     = require('./database/database');

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


// ═══ VOICE STATE PONTO (inline) ══════════════════════════════════
// events/voiceStatePonto.js — Bate-ponto automático por canal de voz
const { Events, EmbedBuilder } = require('discord.js');
const config = require('./config.json');
const db     = require('./database/database');

const nomeBot = () => config.nomeBot || 'Fuminho';
const VERDE   = 0x2ECC71;
const VERMELHO= 0xE74C3C;

// module.exports = {
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
// };


// Registrar voiceStatePonto no client
client.on('voiceStateUpdate', async (oldState, newState) => {
    try {
        const callPontoId = config.canais?.call_ponto;
        if (!callPontoId || callPontoId.startsWith('SEU_')) return;
        const membro = newState.member || oldState.member;
        if (!membro || membro.user.bot) return;
        const guildId = (newState.guild || oldState.guild).id;
        const uid = membro.user.id;
        const entrou = !oldState.channelId && newState.channelId === callPontoId;
        const saiu   = oldState.channelId === callPontoId && newState.channelId !== callPontoId;
        if (!entrou && !saiu) return;
        const tipo   = entrou ? 'entrada' : 'saida';
        const ultimo = db.getUltimoPonto(uid, guildId);
        if (tipo === 'entrada' && ultimo?.tipo === 'entrada') return;
        if (tipo === 'saida' && (!ultimo || ultimo.tipo === 'saida')) return;
        const reg = db.baterPonto(uid, membro.user.tag, membro.displayName, tipo, guildId);
        let tempoPeriodo = '';
        if (tipo === 'saida' && ultimo) {
            const ms  = reg.timestamp - ultimo.timestamp;
            const min = Math.floor(ms / 60000);
            const h   = Math.floor(min / 60);
            const m   = min % 60;
            tempoPeriodo = `> ⏱️  **Tempo trabalhado:** \\`${h}h ${m}min\\``;
        }
        const canalTextoId = config.canais?.ponto;
        let canalTexto = null;
        if (canalTextoId && !canalTextoId.startsWith('SEU_')) {
            try { canalTexto = await (newState.guild || oldState.guild).channels.fetch(canalTextoId); } catch (_) {}
        }
        if (!canalTexto) canalTexto = newState.channel || oldState.channel;
        if (!canalTexto?.send) return;
        const { EmbedBuilder: EmbVoice } = require('discord.js');
        const embed = new EmbVoice()
            .setColor(entrou ? 0x2ECC71 : 0xE74C3C)
            .setTitle(entrou ? '🟢  CHEGOU NA CALL — PONTO REGISTRADO' : '🔴  SAIU DA CALL — PONTO FECHADO')
            .setDescription(
                `> 👤  **Membro:** ${membro}\n` +
                `> 🕐  **Horário:** \\`${reg.data}\\`\n` +
                (tempoPeriodo ? tempoPeriodo + '\n' : '') +
                `> 🎙️  **Canal:** \\`${entrou ? newState.channel?.name : oldState.channel?.name}\\``
            )
            .setThumbnail(membro.user.displayAvatarURL({ dynamic: true }))
            .setFooter({ text: 'Fuminho 🌿  ·  Ponto automático por voz' })
            .setTimestamp();
        const msg = await canalTexto.send({ embeds: [embed] });
        setTimeout(() => msg.delete().catch(() => {}), 30000);
    } catch (err) {
        console.error('Erro voicePonto:', err.message);
    }
});

loadEvents();
client.login(process.env.DISCORD_TOKEN);
