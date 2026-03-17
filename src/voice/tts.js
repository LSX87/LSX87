// src/voice/tts.js — Text-to-Speech
// Converte texto em áudio e reproduz no canal de voz
// Suporta: gTTS (grátis) ou ElevenLabs (mais natural)
// Fluxo: texto → arquivo MP3 → AudioResource → VoiceConnection player

const fs   = require('fs');
const path = require('path');
const {
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    StreamType,
} = require('@discordjs/voice');

const TMP_DIR = path.join(__dirname, '../../tmp');
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

// Map de players ativos: guildId → AudioPlayer
const players = new Map();

/**
 * Gera arquivo de áudio MP3 a partir do texto.
 * Usa ElevenLabs se ELEVENLABS_API_KEY estiver no .env, senão usa gTTS.
 */
async function gerarAudio(texto, guildId) {
    const arquivo = path.join(TMP_DIR, `tts_${guildId}_${Date.now()}.mp3`);

    // ── ElevenLabs (mais natural) ────────────────────────────────
    const elKey    = process.env.ELEVENLABS_API_KEY;
    const elVoice  = process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB'; // Adam (pt-BR)
    if (elKey) {
        try {
            const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${elVoice}`, {
                method: 'POST',
                headers: {
                    'xi-api-key': elKey,
                    'Content-Type': 'application/json',
                    'Accept': 'audio/mpeg',
                },
                body: JSON.stringify({
                    text: texto,
                    model_id: 'eleven_multilingual_v2',
                    voice_settings: { stability: 0.5, similarity_boost: 0.8 }
                })
            });
            if (res.ok) {
                const buffer = Buffer.from(await res.arrayBuffer());
                fs.writeFileSync(arquivo, buffer);
                return arquivo;
            }
            console.error('[TTS] ElevenLabs erro:', res.status);
        } catch (err) {
            console.error('[TTS] ElevenLabs falhou:', err.message);
        }
    }

    // ── node-gtts — Google Text-to-Speech (grátis, sem key) ──────
    try {
        const gtts = require('node-gtts')('pt');
        await new Promise((resolve, reject) => {
            gtts.save(arquivo, texto, err => err ? reject(err) : resolve());
        });
        return arquivo;
    } catch (err) {
        console.error('[TTS] node-gtts falhou:', err.message);
        return null;
    }
}

/**
 * Reproduz o arquivo de áudio no canal de voz via a conexão fornecida.
 * Fluxo: arquivo MP3 → AudioResource → AudioPlayer → VoiceConnection
 */
async function reproduzirAudio(conexao, arquivo) {
    if (!conexao || !arquivo || !fs.existsSync(arquivo)) return;

    const guildId = conexao.joinConfig.guildId;

    // Para player anterior se existir
    const playerAnterior = players.get(guildId);
    if (playerAnterior) {
        playerAnterior.stop();
        players.delete(guildId);
    }

    const player   = createAudioPlayer();
    const resource = createAudioResource(arquivo, { inputType: StreamType.Arbitrary });

    conexao.subscribe(player);
    player.play(resource);
    players.set(guildId, player);

    // Aguarda terminar de tocar e limpa o arquivo
    await new Promise((resolve) => {
        player.on(AudioPlayerStatus.Idle, () => {
            players.delete(guildId);
            try { fs.unlinkSync(arquivo); } catch (_) {}
            resolve();
        });
        player.on('error', err => {
            console.error('[TTS] Player erro:', err.message);
            players.delete(guildId);
            resolve();
        });
        // Timeout de segurança: 30s
        setTimeout(() => { player.stop(); resolve(); }, 30_000);
    });
}

/**
 * Função principal: gera e reproduz TTS de uma vez.
 */
async function falarNoCanal(conexao, texto) {
    if (!conexao || !texto) return;
    // Limita texto longo para não travar
    const textoLimitado = texto.length > 500 ? texto.slice(0, 500) + '...' : texto;
    const arquivo = await gerarAudio(textoLimitado, conexao.joinConfig.guildId);
    if (arquivo) await reproduzirAudio(conexao, arquivo);
}

module.exports = { gerarAudio, reproduzirAudio, falarNoCanal };
