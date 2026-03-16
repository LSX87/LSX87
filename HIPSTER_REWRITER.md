# 🌿 REESCRITOR HIPSTER — Guia Completo

## 🎯 O QUE É

Bot que **reescreve qualquer mensagem em tom hippie/maconheiro descontraído!**

### Exemplo:

**Entrada:**
```
Reunião importante amanhã cedo. Todos precisam trazer os documentos.
```

**Saída:**
```
Opa, tipo, rolê pesado de papo amanhã cedo, meu brother! 
Tipo, todos precisam joga aqui os arquivos sagrados, saca só? ✌️ 🌿 😎
```

---

## 📁 ONDE COLOCAR

```
seu-bot/
├── utils/
│   └── hipsterRewriter.js  ← COLOCAR AQUI
```

---

## 💬 USAR NO CHAT AUTOMÁTICO

Você pode integrar com o **autoChat.js** para reescrever mensagens!

### No autoChat.js:

```javascript
const { reescreverHipster } = require('./hipsterRewriter');

// Adicione uma resposta que reescreve:
{
    id: 'hipster',
    palavrasChave: ['reescreve aí', 'hipster', 'maconha', 'erva'],
    respostas: [
        async (mensagem) => {
            // Reescrever a mensagem anterior
            const texto = mensagem.content;
            return await reescreverHipster(texto, 'basico');
        }
    ],
    tipo: 'texto',
    probabilidade: 1.0
}
```

---

## 🎮 USAR COMO COMANDO

### Criar comando `/hipster`:

```javascript
// commands/hipster.js
const { reescreverHipster } = require('../utils/hipsterRewriter');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'hipster',
    description: '🌿 Reescreve em tom hippie',
    options: [
        {
            type: 3,
            name: 'texto',
            description: 'O que reescrever?',
            required: true
        },
        {
            type: 3,
            name: 'modo',
            description: 'basico ou ia',
            required: false,
            choices: [
                { name: 'Básico (rápido)', value: 'basico' },
                { name: 'IA (criativo)', value: 'ia' }
            ]
        }
    ],
    
    async execute(interaction, config) {
        const texto = interaction.options.getString('texto');
        const modo = interaction.options.getString('modo') || 'basico';
        
        await interaction.deferReply();
        
        const resultado = await reescreverHipster(texto, modo);
        
        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('🌿 Reescrita Hipster')
            .addFields(
                { name: '📝 Original', value: texto, inline: false },
                { name: '✨ Reescrita', value: resultado, inline: false }
            );
        
        await interaction.editReply({ embeds: [embed] });
    }
};
```

---

## ⚙️ CONFIGURAÇÃO

### 2 MODOS:

#### **MODO 1: BÁSICO** (Padrão)
```javascript
const resultado = await reescreverHipster(texto, 'basico');
```

**Características:**
- ✅ Rápido (sem API)
- ✅ Usa dicionário de palavras
- ✅ Adiciona expressões aleatórias
- ✅ Adiciona emojis
- ⚠️ Menos criativo

**Exemplo:**
```
Entrada: "Aviso importante para todos"
Saída: "Opa, tipo, aviso muito importante para todos, brother! 🌿 ✌️"
```

---

#### **MODO 2: IA** (Com Claude API)
```javascript
const resultado = await reescreverHipster(texto, 'ia');
```

**Características:**
- ✅ Muito criativo
- ✅ Reescritas naturais
- ✅ Compreende contexto
- ✅ Mais divertido
- ⚠️ Precisa de API key
- ⚠️ Um pouco mais lento

**Exemplo:**
```
Entrada: "Reunião urgente amanhã"
Saída: "Opa brother, tá rolando uma parada pesada amanhã cedo, tipo...
saca só, todo mundo precisa estar lá pra gente trampar junto nessa vibe! ✌️🌿"
```

---

## 🔑 USAR MODE IA

### Passo 1: Ter API Key da Anthropic

```bash
# Você pode criar uma chave em:
# https://console.anthropic.com/account/keys
```

### Passo 2: Adicionar ao `.env`

```env
ANTHROPIC_API_KEY=sk-ant-...seu-token-aqui...
```

### Passo 3: Usar modo `ia`

```javascript
const resultado = await reescreverHipster("Sua mensagem", "ia");
```

---

## 🎨 CUSTOMIZAR

### Adicionar Palavras Hipster

No arquivo `hipsterRewriter.js`:

```javascript
const PALAVRAS_HIPSTER = {
    // Adicione suas palavras:
    'boa noite': 'opa, boa energia',
    'código': 'parada de programação',
    'bug': 'erro sagrado'
};
```

### Adicionar Expressões

```javascript
const EXPRESSOES_HIPSTER = [
    'meu irmão',
    'que parada maneira',
    'muito sagrado'
];
```

### Adicionar Emojis

```javascript
const EMOJIS_HIPSTER = [
    '🍀',
    '🎸',
    '🔮'
];
```

---

## 📚 EXEMPLOS

### Exemplo 1: Reescrever Aviso

```
ORIGINAL:
"Aviso a todos: o servidor vai cair amanhã para manutenção."

RESULTADO BÁSICO:
"Opa, tipo, aviso a todos, meu: o servidor vai cair amanhã para 
trampar na manutenção, brother! 🌿 ✌️"

RESULTADO IA:
"Ó brother, saca só essa parada: amanhã a gente vai ter que desligar 
o servidor pra dar uma arrumada nessa máquina, entendeu? 
Tipo bem importante mesmo! 🔥✌️"
```

### Exemplo 2: Reescrever Reunião

```
ORIGINAL:
"Reunião de equipe às 10 da manhã. Trazer relatórios."

RESULTADO BÁSICO:
"Tipo, rolê de papo de equipe às 10 da manhã, brother! 
Joga aqui os relatórios, meu! 🌿 😎"

RESULTADO IA:
"Mano, tá marcado um papo pesado de equipe amanhã cedinho às 10 pra gente 
trampar junto. Não esquece de trazer os relatórios pra gente conferir essa 
parada, viu? Bem maneiro! ✌️🎸"
```

---

## 🧪 TESTAR NO DISCORD

### Usando Comando:
```
/hipster texto:"Olá, como você está?" modo:basico
```

### Usando Chat Automático:
```
Usuário: "reescreve aí: reunião importante amanhã"
Bot: "Opa, rolê pesado amanhã, brother! 🌿"
```

---

## ❓ DÚVIDAS COMUNS

### P: Qual é a diferença básico vs IA?

**Básico:** Rápido, usa dicionário
```
"reunião" → "rolê de papo"
"trabalho" → "trampo"
```

**IA:** Reescreve a FRASE inteira com contexto
```
"Temos uma reunião importante"
→ "Mano, tá rolando uma parada bem séria aí de papo, viu?"
```

### P: IA custa dinheiro?

Sim, mas é bem barato. ~0,001 USD por requisição.

### P: Posso usar sem IA?

Sim! Modo básico funciona perfeitamente!

### P: Como fazer mais criativo?

Use modo `ia` + customize as palavras/expressões!

### P: Pode escrever "maconha" nas mensagens?

Sim! É só uma brincadeira. O bot escreve em tom hippie/descontraído.

---

## ✅ CHECKLIST

- [ ] Copiar `hipsterRewriter.js` para `utils/`
- [ ] Se quer IA: adicionar ANTHROPIC_API_KEY no `.env`
- [ ] Integrar com `/hipster` comando ou chat automático
- [ ] Testar modo básico
- [ ] Testar modo IA (se configurou)
- [ ] Customizar palavras/expressões (opcional)
- [ ] Pronto! 🌿

---

## 🎯 USAR NO SEU BOT

### Opção 1: Comando Slash

```javascript
// Em seu handler de comandos:
const { reescreverHipster } = require('../utils/hipsterRewriter');

interaction.reply({
    content: await reescreverHipster(texto, 'basico')
});
```

### Opção 2: Chat Automático

```javascript
// Em autoChat.js:
await processarChatAutomatico(mensagem, config);
// (Se configurou palavra-chave "hipster", vai usar)
```

### Opção 3: Webhook

```javascript
// Reescrever automaticamente todas as mensagens:
const resultado = await reescreverHipster(message.content, 'basico');
await message.reply(resultado);
```

---

**Status: ✅ PRONTO PARA USAR**

Use como quiser! 🌿✌️
