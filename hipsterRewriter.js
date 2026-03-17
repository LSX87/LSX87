// hipsterRewriter.js — Reescritor Cria Formal 🌿
// Transforma qualquer texto num sotaque de cria, mas formal e respeitoso
// Modo 'ia' usa Google Gemini | Modo 'basico' usa substituição local

const PALAVRAS_CRIA = {
    'olá': 'salve', 'oi': 'salve',
    'bom dia': 'salve, bom dia pra família',
    'boa tarde': 'salve, boa tarde pra todos',
    'boa noite': 'salve, boa noite pra todos',
    'tudo bem': 'tudo suave', 'tudo bom': 'tudo na paz',
    'como vai': 'como tá sendo',
    'sim': 'é isso', 'correto': 'certinho', 'certo': 'sem dúvida',
    'claro': 'com certeza', 'entendido': 'entendido, na paz',
    'combinado': 'combinado, firmeza',
    'pessoal': 'família', 'galera': 'família',
    'amigos': 'irmãos', 'amigo': 'irmão',
    'fazer': 'resolver', 'vamos': 'bora',
    'problema': 'parada', 'assunto': 'parada importante',
    'reunião': 'encontro da família', 'trabalho': 'trampo',
    'dinheiro': 'grana', 'importante': 'de peso',
    'urgente': 'urgente, parceiro',
    'obrigado': 'valeu, família', 'obrigada': 'valeu, família',
    'de nada': 'imagina, sempre',
    'até logo': 'até mais, família', 'tchau': 'salve',
};

const PREFIXOS_CRIA  = ['Salve, família — ','Irmão, ','Parceiro, ','Olha só, ','Firmeza — ','Na paz — '];
const SUFIXOS_CRIA   = [' — firmeza.',' , na paz.',', família.',', tá bom?',' — salve.',', parceiro.'];
const EXPRESSOES_CRIA = ['firmeza','na paz','salve','parceiro','família','sem dúvida','com respeito','tá ligado'];

function aleatorio(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function reescreverBasico(texto) {
    let r = texto;
    Object.entries(PALAVRAS_CRIA).forEach(([k, v]) => {
        r = r.replace(new RegExp(`\\b${k}\\b`, 'gi'), v);
    });
    if (Math.random() > 0.5) r = aleatorio(PREFIXOS_CRIA) + r;
    if (Math.random() > 0.4) r = r + aleatorio(SUFIXOS_CRIA);
    const palavras = r.split(' ');
    const idx = Math.floor(palavras.length / 2);
    if (idx > 0 && Math.random() > 0.6) palavras.splice(idx, 0, aleatorio(EXPRESSOES_CRIA) + ',');
    return palavras.join(' ');
}

async function reescreverComIA(texto) {
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) { console.log('[CRIA] Sem API key, usando básico'); return reescreverBasico(texto); }
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text:
`Você reescreve textos com sotaque de cria de comunidade, de forma FORMAL e RESPEITOSA.

Regras:
- Use: salve, firmeza, família, parceiro, irmão, na paz, tá ligado, bora, trampo, grana, parada, sem dúvida, com respeito
- Tom FORMAL e SÉRIO — comunicação respeitosa da comunidade, não zoeira
- Preserve o significado original completamente
- Sem palavrão, sem agressividade
- Comece com "Salve" ou "Firmeza" quando couber
- Termine com "na paz", "firmeza" ou "família"

Texto: "${texto}"

Responda APENAS com o texto reescrito:`
                }] }],
                generationConfig: { maxOutputTokens: 600, temperature: 0.7 }
            })
        });
        if (!response.ok) { console.error('[CRIA] Gemini erro:', response.status); return reescreverBasico(texto); }
        const data = await response.json();
        const resultado = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        return resultado || reescreverBasico(texto);
    } catch (err) {
        console.error('[CRIA] Erro IA:', err.message);
        return reescreverBasico(texto);
    }
}

async function reescreverHipster(texto, modo = 'basico') {
    if (!texto || texto.length === 0) return 'Salve, precisa de um texto aí, parceiro! 🌿';
    try { return modo === 'ia' ? await reescreverComIA(texto) : reescreverBasico(texto); }
    catch (err) { return 'Salve, deu uma parada aqui — tenta de novo, parceiro.'; }
}

module.exports = { reescreverHipster, reescreverBasico, reescreverComIA, PALAVRAS_CRIA };
