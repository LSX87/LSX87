// src/voice/voiceManager.js
const {
    joinVoiceChannel,
    VoiceConnectionStatus,
    entersState,
    getVoiceConnection,
} = require('@discordjs/voice');

// tweetnacl para criptografia — puro JS, sem compilação nativa
try {
    require('tweetnacl');
    console.log('[VOICE] tweetnacl OK');
} catch (err) {
    console.error('[VOICE] tweetnacl FALHOU:', err.message);
}

const conexoes = new Map();

async function entrarNoCanal(member, guild) {
    const canalId = member.voice?.channelId;
    console.log('[VOICE] Tentando entrar no canal:', canalId, '| guild:', guild.name);

    if (!canalId) {
        console.log('[VOICE] Membro não está em canal de voz');
        return null;
    }

    // Verifica permissões do bot no canal
    const canal = guild.channels.cache.get(canalId);
    if (canal) {
        const perms = canal.permissionsFor(guild.members.me);
        console.log('[VOICE] Permissões no canal:', {
            Connect: perms?.has('Connect'),
            Speak: perms?.has('Speak'),
            MoveMembers: perms?.has('MoveMembers'),
        });
        if (!perms?.has('Connect') || !perms?.has('Speak')) {
            console.error('[VOICE] FALTA PERMISSÃO: Connect ou Speak');
            return null;
        }
    }

    // Destruir conexão existente
    const existente = getVoiceConnection(guild.id);
    if (existente) {
        console.log('[VOICE] Destruindo conexão existente');
        try { existente.destroy(); } catch (_) {}
        await new Promise(r => setTimeout(r, 1000));
    }

    let conexao;
    try {
        console.log('[VOICE] Chamando joinVoiceChannel...');
        conexao = joinVoiceChannel({
            channelId: canalId,
            guildId: guild.id,
            adapterCreator: guild.voiceAdapterCreator,
            selfDeaf: false,
            selfMute: false,
        });
        console.log('[VOICE] joinVoiceChannel OK, aguardando Ready...');
    } catch (err) {
        console.error('[VOICE] joinVoiceChannel ERRO:', err.message);
        return null;
    }

    try {
        await entersState(conexao, VoiceConnectionStatus.Ready, 30_000);
        console.log('[VOICE] Conectado com sucesso em', guild.name);
        conexoes.set(guild.id, conexao);

        conexao.on(VoiceConnectionStatus.Disconnected, async () => {
            console.log('[VOICE] Desconectado — tentando reconectar...');
            try {
                await Promise.race([
                    entersState(conexao, VoiceConnectionStatus.Signalling, 5_000),
                    entersState(conexao, VoiceConnectionStatus.Connecting, 5_000),
                ]);
                console.log('[VOICE] Reconectado!');
            } catch {
                console.log('[VOICE] Reconexão falhou, destruindo');
                try { conexao.destroy(); } catch (_) {}
                conexoes.delete(guild.id);
            }
        });

        conexao.on('error', err => {
            console.error('[VOICE] Erro na conexão:', err.message);
        });

        // Log de mudanças de estado
        conexao.on('stateChange', (old, novo) => {
            console.log(`[VOICE] Estado: ${old.status} → ${novo.status}`);
        });

        return conexao;
    } catch (err) {
        console.error('[VOICE] Falha ao atingir Ready:', err.message);
        console.error('[VOICE] Estado atual:', conexao.state?.status);
        try { conexao.destroy(); } catch (_) {}
        conexoes.delete(guild.id);
        return null;
    }
}

function sairDoCanal(guildId) {
    const conexao = getVoiceConnection(guildId) || conexoes.get(guildId);
    if (conexao) {
        try { conexao.destroy(); } catch (_) {}
        conexoes.delete(guildId);
        return true;
    }
    return false;
}

function getConexao(guildId) {
    return getVoiceConnection(guildId) || conexoes.get(guildId) || null;
}

module.exports = { entrarNoCanal, sairDoCanal, getConexao };
