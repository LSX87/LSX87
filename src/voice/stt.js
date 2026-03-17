// src/voice/stt.js — Speech-to-Text
// Prioridade: AssemblyAI (grátis 100h/mês) → Google Speech → null
// Fluxo: OpusStream → PCM → WAV → API → texto

const fs   = require('fs');
const path = require('path');
const { EndBehaviorType } = require('@discordjs/voice');
const { pipeline }        = require('stream/promises');
const prism               = require('prism-media');

const TMP_DIR = path.join(__dirname, '../../tmp');
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

// ─────────────────────────────────────────────────────────────────
//  GRAVAÇÃO DE ÁUDIO
// ─────────────────────────────────────────────────────────────────

async function gravarAudio(receiver, userId, maxMs = 8000) {
    const arquivo = path.join(TMP_DIR, `audio_${userId}_${Date.now()}.pcm`);

    const opusStream = receiver.subscribe(userId, {
        end: { behavior: EndBehaviorType.AfterSilence, duration: 1000 }
    });

    const decoder = new prism.opus.Decoder({
        frameSize: 960,
        channels: 2,
        rate: 48000,
    });

    const saida = fs.createWriteStream(arquivo);

    const timeout = setTimeout(() => {
        try { opusStream.destroy(); } catch (_) {}
    }, maxMs);

    try {
        await pipeline(opusStream, decoder, saida);
    } catch (_) {}
    finally { clearTimeout(timeout); }

    return arquivo;
}

// Converte PCM raw → WAV (com header)
function pcmParaWav(pcmPath) {
    const wavPath      = pcmPath.replace('.pcm', '.wav');
    const pcm          = fs.readFileSync(pcmPath);
    const sampleRate   = 48000;
    const numChannels  = 2;
    const bitsPerSample = 16;
    const byteRate     = sampleRate * numChannels * (bitsPerSample / 8);
    const blockAlign   = numChannels * (bitsPerSample / 8);
    const dataSize     = pcm.length;
    const buf          = Buffer.alloc(44 + dataSize);

    buf.write('RIFF', 0);              buf.writeUInt32LE(36 + dataSize, 4);
    buf.write('WAVE', 8);              buf.write('fmt ', 12);
    buf.writeUInt32LE(16, 16);         buf.writeUInt16LE(1, 20);
    buf.writeUInt16LE(numChannels, 22); buf.writeUInt32LE(sampleRate, 24);
    buf.writeUInt32LE(byteRate, 28);   buf.writeUInt16LE(blockAlign, 32);
    buf.writeUInt16LE(bitsPerSample, 34); buf.write('data', 36);
    buf.writeUInt32LE(dataSize, 40);   pcm.copy(buf, 44);

    fs.writeFileSync(wavPath, buf);
    return wavPath;
}

// ─────────────────────────────────────────────────────────────────
//  ASSEMBLYAI — GRÁTIS 100h/mês, sem cartão
//  Cadastro: https://www.assemblyai.com → Get a Free API Key
// ─────────────────────────────────────────────────────────────────
async function transcreverAssemblyAI(wavPath) {
    const apiKey = process.env.ASSEMBLYAI_API_KEY;
    if (!apiKey) return null;

    try {
        // 1. Faz upload do arquivo de áudio
        const audioBuffer = fs.readFileSync(wavPath);
        const uploadRes   = await fetch('https://api.assemblyai.com/v2/upload', {
            method: 'POST',
            headers: {
                'authorization': apiKey,
                'content-type': 'application/octet-stream',
            },
            body: audioBuffer,
        });

        if (!uploadRes.ok) {
            console.error('[STT] AssemblyAI upload erro:', uploadRes.status);
            return null;
        }

        const { upload_url } = await uploadRes.json();

        // 2. Solicita transcrição em português
        const transcriptRes = await fetch('https://api.assemblyai.com/v2/transcript', {
            method: 'POST',
            headers: {
                'authorization': apiKey,
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                audio_url: upload_url,
                language_code: 'pt',
            }),
        });

        if (!transcriptRes.ok) {
            console.error('[STT] AssemblyAI transcript erro:', transcriptRes.status);
            return null;
        }

        const { id } = await transcriptRes.json();

        // 3. Polling — aguarda processamento (normalmente 2-5s para áudios curtos)
        for (let i = 0; i < 20; i++) {
            await new Promise(r => setTimeout(r, 1000));

            const statusRes = await fetch(`https://api.assemblyai.com/v2/transcript/${id}`, {
                headers: { 'authorization': apiKey }
            });
            const status = await statusRes.json();

            if (status.status === 'completed') {
                return status.text?.trim() || null;
            }
            if (status.status === 'error') {
                console.error('[STT] AssemblyAI erro:', status.error);
                return null;
            }
            // status === 'processing' ou 'queued' → continua aguardando
        }

        console.error('[STT] AssemblyAI timeout — áudio demorou demais');
        return null;

    } catch (err) {
        console.error('[STT] AssemblyAI falhou:', err.message);
        return null;
    }
}

// ─────────────────────────────────────────────────────────────────
//  GOOGLE SPEECH — GRÁTIS 60min/mês
//  Chave em: console.cloud.google.com → APIs → Speech-to-Text
// ─────────────────────────────────────────────────────────────────
async function transcreverGoogle(wavPath) {
    const googleKey = process.env.GOOGLE_SPEECH_KEY;
    if (!googleKey) return null;

    try {
        const audioBase64 = fs.readFileSync(wavPath).toString('base64');
        const res = await fetch(
            `https://speech.googleapis.com/v1/speech:recognize?key=${googleKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    config: {
                        encoding: 'LINEAR16',
                        sampleRateHertz: 48000,
                        languageCode: 'pt-BR',
                        audioChannelCount: 2,
                    },
                    audio: { content: audioBase64 }
                })
            }
        );
        const data = await res.json();
        return data.results?.[0]?.alternatives?.[0]?.transcript?.trim() || null;
    } catch (err) {
        console.error('[STT] Google Speech falhou:', err.message);
        return null;
    }
}

// ─────────────────────────────────────────────────────────────────
//  FUNÇÃO PRINCIPAL — tenta em ordem: AssemblyAI → Google → null
// ─────────────────────────────────────────────────────────────────
async function transcreverAudio(wavPath) {
    // AssemblyAI tem prioridade (mais generoso no plano grátis)
    if (process.env.ASSEMBLYAI_API_KEY) {
        const texto = await transcreverAssemblyAI(wavPath);
        if (texto) return texto;
    }

    // Fallback: Google Speech
    if (process.env.GOOGLE_SPEECH_KEY) {
        const texto = await transcreverGoogle(wavPath);
        if (texto) return texto;
    }

    console.warn('[STT] Nenhuma API configurada. Adicione ASSEMBLYAI_API_KEY no .env');
    return null;
}

function limparTemp(userId) {
    try {
        fs.readdirSync(TMP_DIR)
            .filter(f => f.includes(userId))
            .forEach(f => {
                try { fs.unlinkSync(path.join(TMP_DIR, f)); } catch (_) {}
            });
    } catch (_) {}
}

module.exports = { gravarAudio, pcmParaWav, transcreverAudio, limparTemp };
