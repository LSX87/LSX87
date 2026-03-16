// src/utils/geminiAI.js — Integração com Google Gemini API
// Use sua API key do Google para reescrever com IA

/**
 * Reescreve texto em tom hippie usando Google Gemini
 * 
 * @param {string} texto - Texto a reescrever
 * @returns {Promise<string>} Texto reescrito
 */
async function reescreverComGemini(texto) {
    try {
        // Verificar se tem API key
        if (!process.env.GOOGLE_GEMINI_API_KEY) {
            console.error('❌ GOOGLE_GEMINI_API_KEY não configurada no .env');
            return null;
        }
        
        // Fazer requisição para Google Gemini
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${process.env.GOOGLE_GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                {
                                    text: `Reescreva esta mensagem em tom de hippie noiado que gosta de erva. 
                                    Seja criativo, divertido, use gírias, expressões descontraídas, adicione emojis.
                                    Mantenha o significado original mas torne MUITO mais descontraído e maconheiro.
                                    Use palavras como: brother, meu, tipo, saca só, maneiro, sagrado, parada, trampo, etc.
                                    
                                    Mensagem original: "${texto}"
                                    
                                    Resposta (APENAS o texto reescrito, nada mais):`
                                }
                            ]
                        }
                    ],
                    generationConfig: {
                        maxOutputTokens: 500,
                        temperature: 0.9 // Mais criativo
                    }
                })
            }
        );
        
        // Verificar se a requisição foi bem-sucedida
        if (!response.ok) {
            const erro = await response.json();
            console.error('❌ Erro da API Gemini:', erro);
            return null;
        }
        
        // Extrair o texto da resposta
        const data = await response.json();
        
        if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
            console.error('❌ Resposta inválida da API');
            return null;
        }
        
        const textoReescrito = data.candidates[0].content.parts[0].text.trim();
        
        console.log('✅ Reescrita com sucesso via Gemini!');
        return textoReescrito;
        
    } catch (erro) {
        console.error('❌ Erro ao chamar Gemini:', erro.message);
        return null;
    }
}

/**
 * Função auxiliar para testar a API
 * Use para verificar se está funcionando
 */
async function testarGemini() {
    console.log('🧪 Testando Google Gemini API...');
    
    const resultado = await reescreverComGemini('Olá, como você está?');
    
    if (resultado) {
        console.log('✅ API funcionando!');
        console.log('Resultado:', resultado);
        return true;
    } else {
        console.log('❌ API não está funcionando. Verifique:');
        console.log('   1. GOOGLE_GEMINI_API_KEY está no .env?');
        console.log('   2. A chave é válida?');
        console.log('   3. Você tem internet?');
        return false;
    }
}

module.exports = {
    reescreverComGemini,
    testarGemini
};
