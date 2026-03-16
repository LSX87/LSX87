// hipsterRewriter.js — Reescritor Hipster Noiado
// Transforma qualquer mensagem em tom hippie/maconheiro descontraído

/**
 * DICIONÁRIO HIPSTER
 * Mapeia palavras normais para versões "hippie"
 */
const PALAVRAS_HIPSTER = {
    // Cumprimentos
    'oi': 'e aí, meu brother',
    'olá': 'opa, valeu',
    'oi tudo bem': 'opa, tudo maneiro',
    
    // Trabalho/Reunião
    'reunião': 'rolê de papo',
    'reunião importante': 'rolê pesado de papo',
    'trabalho': 'trampo',
    'trabalhar': 'trampar',
    'documento': 'arquivo sagrado',
    'projeto': 'parada',
    'deadline': 'prazo zika',
    'urgente': 'tipo, agora mesmo',
    'rápido': 'na velocidade da luz, brother',
    
    // Ações
    'fazer': 'manda bala em',
    'enviar': 'joga aqui',
    'receber': 'pega aí',
    'aprovar': 'ativa aí, meu consagrado',
    'rejeitar': 'nega essa aí',
    'atualizar': 'manda uma atualizada',
    'corrigir': 'ajusta aí, brother',
    
    // Sentimentos
    'bom': 'top demais',
    'ruim': 'meio chato',
    'melhor': 'sagrado demais',
    'pior': 'tipo, que viagem ruim',
    'legal': 'maneiro demais',
    'chato': 'meio tedioso',
    
    // Números/Quantidade
    'muito': 'tipo, muuito',
    'pouco': 'tipo, pouquinha coisa',
    'tudo': 'tudo sagrado',
    'nada': 'nada de nada',
    
    // Concordância
    'sim': 'é isso aí',
    'não': 'nega esse rolo aí',
    'talvez': 'tipo, talvez',
    'pode ser': 'pode ser, mano',
    
    // Exclamações
    'obrigado': 'valeu demais, brother',
    'de nada': 'sem problemas, meu',
    'desculpa': 'tipo, me desculpa aí',
    'perdão': 'perdão, brother',
    
    // Adjetivos
    'importante': 'tipo, muito importante',
    'dificil': 'meio complicado',
    'fácil': 'tranquilo demais',
    'cansado': 'tipo, cansadão',
    'feliz': 'tipo, muito maneiro',
    'triste': 'meio chato demais'
};

/**
 * EXPRESSÕES HIPSTER
 * Adicionadas aleatoriamente nas frases
 */
const EXPRESSOES_HIPSTER = [
    'meu brother',
    'meu consagrado',
    'tipo',
    'saca só',
    'entendeu?',
    'brother',
    'meu',
    'sério mesmo',
    'de verdade',
    'acredita?',
    'muito maneiro',
    'bastante sagrado',
    'demais, brother',
    'sensacional'
];

/**
 * PREFIXOS HIPSTER
 * Para começar frases
 */
const PREFIXOS_HIPSTER = [
    'Opa, ',
    'Tipo, ',
    'Saca só, ',
    'Mano, ',
    'Brother, ',
    'Meu, ',
    'Rapaz, ',
    'Ó, '
];

/**
 * SUFIXOS HIPSTER
 * Para terminar frases
 */
const SUFIXOS_HIPSTER = [
    ', brother!',
    ', meu!',
    ', maneiro!',
    ', sabe?',
    ', viu?',
    ', entendeu?',
    ', né?',
    ', meu consagrado!',
    ', demais!'
];

/**
 * EMOJIS HIPSTER
 * Usados para decorar a resposta
 */
const EMOJIS_HIPSTER = [
    '🌿',  // Folha
    '✌️',   // Paz
    '🍃',   // Cannabis
    '😎',   // Óculos
    '🎶',   // Música
    '🎸',   // Guitarra
    '🌈',   // Arco-íris
    '⭐',   // Estrela
    '💫',   // Brilho
    '🔥',   // Fogo
    '❤️',   // Coração
    '👽',   // Alien
];

/**
 * Seleciona um elemento aleatório de um array
 */
function aleatorio(array) {
    return array[Math.floor(Math.random() * array.length)];
}

/**
 * Conta quantas vezes uma palavra aparece na frase
 */
function contarPalavras(texto) {
    return texto.split(/\s+/).length;
}

/**
 * REESCRITOR BÁSICO (sem IA)
 * Substitui palavras e adiciona expressões hipster
 */
function reescreverBasico(texto) {
    let resultado = texto.toLowerCase();
    
    // Substituir palavras conhecidas
    Object.entries(PALAVRAS_HIPSTER).forEach(([chave, valor]) => {
        const regex = new RegExp(`\\b${chave}\\b`, 'gi');
        resultado = resultado.replace(regex, valor);
    });
    
    // Adicionar prefixo aleatório
    if (Math.random() > 0.5) {
        resultado = aleatorio(PREFIXOS_HIPSTER) + resultado;
    }
    
    // Adicionar sufixo aleatório
    if (Math.random() > 0.4) {
        resultado = resultado + aleatorio(SUFIXOS_HIPSTER);
    }
    
    // Adicionar expressões hipster no meio
    const palavras = resultado.split(' ');
    const indice = Math.floor(palavras.length / 2);
    if (indice > 0 && Math.random() > 0.6) {
        palavras.splice(indice, 0, aleatorio(EXPRESSOES_HIPSTER) + ',');
    }
    resultado = palavras.join(' ');
    
    // Adicionar emojis
    const numEmojis = Math.floor(Math.random() * 3) + 1;
    for (let i = 0; i < numEmojis; i++) {
        resultado += ' ' + aleatorio(EMOJIS_HIPSTER);
    }
    
    return resultado;
}

/**
 * REESCRITOR COM IA (usando Google Gemini API)
 * Reescreve com muito mais criatividade e naturalidade
 */
async function reescreverComIA(texto) {
    try {
        // Importar Gemini
        const { reescreverComGemini } = require('./geminiAI');
        
        // Verificar se tem API key
        if (!process.env.GOOGLE_GEMINI_API_KEY) {
            console.log('⚠️ GOOGLE_GEMINI_API_KEY não configurada, usando reescritor básico');
            return reescreverBasico(texto);
        }
        
        // Reescrever com Gemini
        const resultado = await reescreverComGemini(texto);
        
        if (resultado) {
            return resultado;
        } else {
            // Fallback para básico se falhar
            console.log('⚠️ Gemini falhou, usando reescritor básico');
            return reescreverBasico(texto);
        }
        
    } catch (err) {
        console.error('❌ Erro ao chamar IA:', err.message);
        return reescreverBasico(texto);
    }
}

/**
 * FUNÇÃO PRINCIPAL
 * Você escolhe: básico ou IA
 * 
 * Uso:
 * const resultado = await reescreverHipster(mensagem, 'ia');
 */
async function reescreverHipster(texto, modo = 'basico') {
    if (!texto || texto.length === 0) {
        return 'Tipo, precisa de um texto aí, brother! 🌿';
    }
    
    try {
        if (modo === 'ia') {
            return await reescreverComIA(texto);
        } else {
            return reescreverBasico(texto);
        }
    } catch (err) {
        console.error('❌ Erro:', err);
        return 'Opa, deu ruim aí, brother! 😅';
    }
}

/**
 * COMANDO DE TESTE
 * Use para testar no Discord
 */
function criarComandoTeste() {
    return {
        name: 'hipster',
        description: '🌿 Reescreve qualquer coisa em tom hippie',
        options: [
            {
                type: 3, // STRING
                name: 'texto',
                description: 'O que você quer reescrever?',
                required: true
            },
            {
                type: 3,
                name: 'modo',
                description: 'basico ou ia (padrão: basico)',
                required: false,
                choices: [
                    { name: 'Básico', value: 'basico' },
                    { name: 'IA (mais criativo)', value: 'ia' }
                ]
            }
        ]
    };
}

module.exports = {
    reescreverHipster,
    reescreverBasico,
    reescreverComIA,
    criarComandoTeste,
    
    // Internals para customizar
    PALAVRAS_HIPSTER,
    EXPRESSOES_HIPSTER,
    PREFIXOS_HIPSTER,
    SUFIXOS_HIPSTER,
    EMOJIS_HIPSTER
};
