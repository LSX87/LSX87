// src/voice/geminiVoice.js — Integração Gemini para comandos de voz
// Recebe texto transcrito, envia ao Gemini com contexto do servidor,
// interpreta intenção de comando e retorna { resposta, comando? }

const config = require('../../config.json');

// Contexto do sistema para o Gemini entender o bot
const SYSTEM_PROMPT = `Você é o Fuminho, bot de Discord de uma comunidade chamada Gueto.
Você responde em português, com sotaque de cria — formal, respeitoso, direto.
Use: salve, firmeza, família, parceiro, na paz, tá ligado.

Você pode executar estes comandos quando o usuário pedir:
- BANIR [menção ou nome]: banir membro do servidor
- KICK [menção ou nome]: expulsar membro
- LIMPAR [número]: apagar N mensagens do canal
- SILENCIAR [menção] [minutos]: dar timeout em membro
- TOCAR [música]: entrar em canal e tocar (informar que não suporta ainda)
- SAIR: sair do canal de voz
- RANK: mostrar rank atual
- BAU: mostrar conteúdo do baú

Se o usuário pedir um comando, responda EXATAMENTE neste formato JSON:
{"resposta": "sua resposta em voz", "comando": "NOME_COMANDO", "parametros": ["param1", "param2"]}

Se for apenas conversa, responda APENAS:
{"resposta": "sua resposta em voz"}

IMPORTANTE: Responda SEMPRE em JSON válido, nada mais.`;

/**
 * Envia o texto ao Gemini e retorna { resposta, comando?, parametros? }
 */
async function processarComGemini(texto, contexto = {}) {
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
        console.error('[GEMINI VOICE] GOOGLE_GEMINI_API_KEY não configurada');
        return { resposta: 'Salve, minha IA não está configurada, parceiro. Firmeza.' };
    }

    // Contexto adicional sobre o servidor
    const contextStr = contexto.membro
        ? `\nQuem falou: ${contexto.membro} | Canal: ${contexto.canal || 'voz'}`
        : '';

    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                system_instruction: { parts: [{ text: SYSTEM_PROMPT + contextStr }] },
                contents: [{ parts: [{ text: texto }] }],
                generationConfig: { maxOutputTokens: 300, temperature: 0.7 }
            })
        });

        if (!res.ok) {
            console.error('[GEMINI VOICE] Erro:', res.status);
            return { resposta: 'Salve, deu uma parada aqui na IA — tenta de novo, parceiro.' };
        }

        const data = await res.json();
        const raw  = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (!raw) return { resposta: 'Salve, não entendi bem — pode repetir, parceiro?' };

        // Parse do JSON retornado pelo Gemini
        try {
            const limpo = raw.replace(/```json|```/g, '').trim();
            return JSON.parse(limpo);
        } catch {
            // Se não veio JSON, trata como resposta simples
            return { resposta: raw };
        }
    } catch (err) {
        console.error('[GEMINI VOICE] Falha:', err.message);
        return { resposta: 'Salve, deu uma parada — tenta de novo, parceiro.' };
    }
}

/**
 * Executa o comando interpretado pelo Gemini no servidor Discord.
 * Retorna { sucesso, mensagem }
 */
async function executarComando(guild, channel, comando, parametros = []) {
    try {
        switch (comando?.toUpperCase()) {

            case 'LIMPAR': {
                const n = parseInt(parametros[0]) || 10;
                const qtd = Math.min(n, 100);
                const msgs = await channel.messages.fetch({ limit: qtd });
                await channel.bulkDelete(msgs, true);
                return { sucesso: true, mensagem: `Firmeza, ${qtd} mensagens apagadas, família.` };
            }

            case 'SAIR':
                return { sucesso: true, mensagem: 'Saindo do canal, na paz, família.', acao: 'SAIR' };

            case 'RANK': {
                const db = require('../../database/database');
                const ranking = db.getRankOrdenado(db.getMesKey()).slice(0, 3);
                if (!ranking.length) return { sucesso: true, mensagem: 'Salve, ninguém depositou ainda esse mês, parceiro.' };
                const nomes = ranking.map((r, i) => `${i + 1}º ${r.displayName}`).join(', ');
                return { sucesso: true, mensagem: `Firmeza, top 3 do rank: ${nomes}. Na paz, família.` };
            }

            case 'BANIR': {
                const nome = parametros[0];
                if (!nome) return { sucesso: false, mensagem: 'Salve, precisa dizer quem banir, parceiro.' };
                const membro = guild.members.cache.find(m =>
                    m.displayName.toLowerCase().includes(nome.toLowerCase()) ||
                    m.user.username.toLowerCase().includes(nome.toLowerCase())
                );
                if (!membro) return { sucesso: false, mensagem: `Salve, não achei ninguém com esse nome, parceiro.` };
                await membro.ban({ reason: 'Banido por comando de voz do Fuminho' });
                return { sucesso: true, mensagem: `Firmeza, ${membro.displayName} foi banido, família.` };
            }

            case 'KICK': {
                const nome = parametros[0];
                if (!nome) return { sucesso: false, mensagem: 'Salve, precisa dizer quem expulsar, parceiro.' };
                const membro = guild.members.cache.find(m =>
                    m.displayName.toLowerCase().includes(nome.toLowerCase())
                );
                if (!membro) return { sucesso: false, mensagem: `Salve, não achei esse membro, parceiro.` };
                await membro.kick('Expulso por comando de voz do Fuminho');
                return { sucesso: true, mensagem: `Firmeza, ${membro.displayName} foi expulso, família.` };
            }

            case 'SILENCIAR': {
                const nome    = parametros[0];
                const minutos = parseInt(parametros[1]) || 10;
                if (!nome) return { sucesso: false, mensagem: 'Salve, precisa dizer quem silenciar, parceiro.' };
                const membro = guild.members.cache.find(m =>
                    m.displayName.toLowerCase().includes(nome.toLowerCase())
                );
                if (!membro) return { sucesso: false, mensagem: `Não achei esse membro, parceiro.` };
                await membro.timeout(minutos * 60_000, 'Silenciado por comando de voz');
                return { sucesso: true, mensagem: `Firmeza, ${membro.displayName} silenciado por ${minutos} minutos, família.` };
            }

            default:
                return { sucesso: false, mensagem: null }; // sem ação necessária
        }
    } catch (err) {
        console.error('[GEMINI VOICE] Erro ao executar comando:', err.message);
        return { sucesso: false, mensagem: `Salve, não consegui executar isso — ${err.message}.` };
    }
}

module.exports = { processarComGemini, executarComando };
