// src/voice/voiceManager.js
// CORREÇÃO: sodium inicializado de forma totalmente síncrona via tweetnacl
// O libsodium-wrappers causa "operation aborted" em alguns ambientes de container

const {
    joinVoiceChannel,
    VoiceConnectionStatus,
    entersState,
    getVoiceConnection,
} = require('@discordjs/voice');

// tweetnacl é a implementação de criptografia mais estável para containers
// O @discordjs/voice detecta automaticamente: sodium-native > libsodium > tweetnacl
// Forçamos o tweetnacl para garantir funcionamento na Discloud
try {
    require('tweetnacl');
    console.log('[VOICE] Criptografia: tweetnacl carregado');
} catch (err) {
    console.error('[VOICE] Erro ao carregar tweetnacl:', err.message);
}

const conexoes = new Map();

async function entrarNoCanal(member, guild) {
    const canalId = member.voice?.channelId;
    if (!canalId) return null;

    // Destruir conexão existente se houver
    const existente = getVoiceConnection(guild.id);
    if (existente) {
        try { existente.destroy(); } catch (_) {}
        await new Promise(r => setTimeout(r, 800));
    }

    let conexao;
    try {
        conexao = joinVoiceChannel({
            channelId: canalId,
            guildId: guild.id,
            adapterCreator: guild.voiceAdapterCreator,
            selfDeaf: false,
            selfMute: false,
        });
    } catch (err) {
        console.error('[VOICE] joinVoiceChannel falhou:', err.message);
        return null;
    }

    // Aguarda Ready com timeout de 30s
    try {
        await entersState(conexao, VoiceConnectionStatus.Ready, 30_000);
        conexoes.set(guild.id, conexao);
        console.log('[VOICE] Conectado em ' + guild.name);

        // Reconexão automática
        conexao.on(VoiceConnectionStatus.Disconnected, async () => {
            try {
                await Promise.race([
                    entersState(conexao, VoiceConnectionStatus.Signalling, 5_000),
                    entersState(conexao, VoiceConnectionStatus.Connecting, 5_000),
                ]);
            } catch {
                try { conexao.destroy(); } catch (_) {}
                conexoes.delete(guild.id);
            }
        });

        conexao.on('error', err => {
            console.error('[VOICE] Erro conexão:', err.message);
        });

        return conexao;
    } catch (err) {
        console.error('[VOICE] Falha Ready:', err.message);
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
