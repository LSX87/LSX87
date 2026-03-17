// src/voice/voiceListener.js — Ouve membros no canal e processa comandos de voz
// Fluxo completo:
//   1. receiver.subscribe(userId)  → OpusStream
//   2. gravarAudio()               → arquivo PCM
//   3. pcmParaWav()                → arquivo WAV
//   4. transcreverAudio()          → texto (STT)
//   5. processarComGemini()        → { resposta, comando? }
//   6. executarComando()           → executa ação no servidor (se houver)
//   7. falarNoCanal()              → resposta em voz (TTS)

const { gravarAudio, pcmParaWav, transcreverAudio, limparTemp } = require('./stt');
const { falarNoCanal }       = require('./tts');
const { processarComGemini, executarComando } = require('./geminiVoice');
const { sairDoCanal }        = require('./voiceManager');

// Controla quais usuários estão sendo gravados (evita duplo processamento)
const gravando = new Set();

/**
 * Inicia a escuta de todos os membros no canal de voz.
 * Chamada após o bot entrar no canal.
 * 
 * @param {VoiceConnection} conexao  — conexão retornada por entrarNoCanal()
 * @param {Guild}           guild
 * @param {TextChannel}     canalTexto — onde logar o que foi dito
 * @param {string}          ownerId    — ID do dono (só dono pode dar comandos críticos)
 */
function iniciarEscuta(conexao, guild, canalTexto, ownerId) {
    const receiver = conexao.receiver;

    console.log(`[VOICE LISTENER] Escuta iniciada em ${guild.name}`);

    // Evento: usuário começa a falar
    receiver.speaking.on('start', async (userId) => {
        // Ignora bots e gravações em andamento
        const membro = guild.members.cache.get(userId);
        if (!membro || membro.user.bot) return;
        if (gravando.has(userId)) return;

        gravando.add(userId);
        console.log(`[VOICE LISTENER] Gravando: ${membro.displayName}`);

        try {
            // ── 1 & 2. Grava e converte áudio ──────────────────────────
            const pcmPath = await gravarAudio(receiver, userId, 8000); // max 8s
            const wavPath = pcmParaWav(pcmPath);

            // ── 3. Speech-to-Text ───────────────────────────────────────
            const texto = await transcreverAudio(wavPath);
            limparTemp(userId);

            if (!texto || texto.length < 3) {
                gravando.delete(userId);
                return; // áudio vazio ou ruído
            }

            console.log(`[VOICE LISTENER] ${membro.displayName} disse: "${texto}"`);

            // Log no canal de texto
            if (canalTexto) {
                canalTexto.send({
                    content: `🎙️ **${membro.displayName}:** ${texto}`
                }).catch(() => {});
            }

            // ── 4. Processa com Gemini ──────────────────────────────────
            const resultado = await processarComGemini(texto, {
                membro: membro.displayName,
                canal: canalTexto?.name,
            });

            let respostaFinal = resultado.resposta || 'Salve, parceiro.';

            // ── 5. Executa comando (se houver) ─────────────────────────
            if (resultado.comando) {
                // Comandos críticos (ban, kick) só para dono ou staff
                const isCritico = ['BANIR', 'KICK', 'SILENCIAR'].includes(resultado.comando.toUpperCase());
                const temPerm   = userId === ownerId || membro.roles.cache.has(require('../../config.json').cargos?.staff);

                if (isCritico && !temPerm) {
                    respostaFinal = 'Salve, você não tem permissão pra isso, parceiro. Firmeza.';
                } else {
                    const exec = await executarComando(guild, canalTexto, resultado.comando, resultado.parametros || []);
                    if (exec.mensagem) respostaFinal = exec.mensagem;

                    // Ação especial: sair do canal
                    if (exec.acao === 'SAIR') {
                        await falarNoCanal(conexao, respostaFinal);
                        sairDoCanal(guild.id);
                        gravando.delete(userId);
                        return;
                    }
                }
            }

            // ── 6. Resposta em voz (TTS) ───────────────────────────────
            await falarNoCanal(conexao, respostaFinal);

            // Log da resposta no canal de texto
            if (canalTexto) {
                canalTexto.send({
                    content: `🤖 **Fuminho:** ${respostaFinal}`
                }).catch(() => {});
            }

        } catch (err) {
            console.error('[VOICE LISTENER] Erro no pipeline:', err.message);
            try { await falarNoCanal(conexao, 'Salve, deu uma parada — tenta de novo, parceiro.'); } catch (_) {}
        } finally {
            gravando.delete(userId);
        }
    });
}

module.exports = { iniciarEscuta };
