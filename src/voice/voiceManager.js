// src/voice/voiceManager.js
const {
    joinVoiceChannel,
    VoiceConnectionStatus,
    entersState,
    getVoiceConnection,
} = require('@discordjs/voice');

try { require('tweetnacl'); console.log('[VOICE] tweetnacl OK'); }
catch (err) { console.error('[VOICE] tweetnacl erro:', err.message); }

const conexoes = new Map();

async function entrarNoCanal(member, guild) {
    const canalId = member.voice?.channelId;
    if (!canalId) return null;

    // Log de permissões
    const canal = guild.channels.cache.get(canalId);
    if (canal) {
        const perms = canal.permissionsFor(guild.members.me);
        const temConnect = perms?.has('Connect');
        const temSpeak   = perms?.has('Speak');
        console.log(`[VOICE] Permissões — Connect:${temConnect} Speak:${temSpeak}`);
        if (!temConnect || !temSpeak) {
            console.error('[VOICE] Sem permissão!');
            return null;
        }
    }

    // Destrói conexão anterior
    const existente = getVoiceConnection(guild.id);
    if (existente) {
        try { existente.destroy(); } catch (_) {}
        await new Promise(r => setTimeout(r, 800));
    }

    let conexao;
    try {
        console.log('[VOICE] joinVoiceChannel iniciando...');
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

    // Log cada mudança de estado
    conexao.on('stateChange', (old, novo) => {
        console.log(`[VOICE] Estado: ${old.status} → ${novo.status}`);
    });
    conexao.on('error', err => console.error('[VOICE] Erro:', err.message));

    // Aguarda Ready — 3 tentativas de 10s cada
    for (let tentativa = 1; tentativa <= 3; tentativa++) {
        try {
            console.log(`[VOICE] Tentativa ${tentativa}/3 — aguardando Ready...`);
            await entersState(conexao, VoiceConnectionStatus.Ready, 10_000);
            console.log('[VOICE] Conectado com sucesso!');
            conexoes.set(guild.id, conexao);

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

            return conexao;
        } catch {
            const estado = conexao.state?.status;
            console.log(`[VOICE] Tentativa ${tentativa} falhou. Estado: ${estado}`);
            if (tentativa < 3) await new Promise(r => setTimeout(r, 2000));
        }
    }

    console.error('[VOICE] Todas as tentativas falharam');
    try { conexao.destroy(); } catch (_) {}
    conexoes.delete(guild.id);
    return null;
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
