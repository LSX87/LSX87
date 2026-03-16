# 🚀 CONFIGURAR GOOGLE GEMINI — PASSO A PASSO

## 📋 O QUE VOCÊ VAI FAZER:

1. ✅ Copiar sua API key do Google
2. ✅ Adicionar no arquivo `.env`
3. ✅ Pronto! O bot usa IA automaticamente!

---

## 📝 PASSO 1: Preparar o .env

### Abrir o arquivo `.env.example`:
```bash
# Você vai ver algo como:
DISCORD_TOKEN=seu_token_do_bot_aqui
GOOGLE_GEMINI_API_KEY=sua_chave_gemini_aqui
```

### Copiar para `.env`:
```bash
cp .env.example .env
```

### Editar o arquivo `.env`:
Procure por esta linha:
```
GOOGLE_GEMINI_API_KEY=sua_chave_gemini_aqui
```

E MUDE PARA:
```
GOOGLE_GEMINI_API_KEY=sua_chave_real_aqui
```

---

## 📋 PASSO 2: Adicionar sua API Key

### Você já tem a chave do Google?

Se tem, **EXCELENTE!** Basta:

1. Abrir o arquivo `.env` com um editor de texto
2. Encontrar: `GOOGLE_GEMINI_API_KEY=`
3. Colocar sua chave depois do `=`

### EXEMPLO:
```
❌ ERRADO:
GOOGLE_GEMINI_API_KEY=sua_chave_gemini_aqui

✅ CERTO:
GOOGLE_GEMINI_API_KEY=AIzaSyDxxx...sua_chave_real...xxxxx
```

---

## ✅ PASSO 3: Testar se está funcionando

### Criar arquivo de teste (opcional):
```javascript
// test-gemini.js
const { testarGemini } = require('./src/utils/geminiAI');

testarGemini();
```

### Rodar:
```bash
node test-gemini.js
```

### Se funcionar, você vai ver:
```
✅ API funcionando!
Resultado: Opa, tipo oi aí, brother! 🌿
```

---

## 🎯 PASSO 4: Usar no Discord

### Comando disponível:
```
/hipster texto:"sua mensagem" modo:ia
```

### EXEMPLO:
```
Usuário digita: /hipster texto:"Reunião amanhã cedo" modo:ia

Bot responde via Google Gemini:
"Opa brother, tipo tá rolando um papo bem importante amanhã cedinho pra gente 
trampar junto nessa vibe, entendeu? Muito maneiro! 🌿✌️"
```

---

## ⚙️ ARQUIVO QUE FIZA MÁGICA:

```
src/utils/geminiAI.js  ← Este arquivo!
```

Ele cuida de:
- ✅ Conectar com Google Gemini
- ✅ Enviar sua mensagem
- ✅ Reescrever em tom hippie
- ✅ Retornar o resultado

---

## 📂 ONDE ESTÃO OS ARQUIVOS:

```
seu-bot/
├── .env ← COLOCA A CHAVE AQUI
├── .env.example
│
├── src/utils/
│   ├── geminiAI.js ← O ARQUIVO NOVO QUE FAZ A MÁGICA!
│   └── hipsterRewriter.js ← USA O geminiAI.js
│
└── commands/
    └── hipster.js ← COMANDO QUE USA TUDO ISSO
```

---

## 🆘 PROBLEMAS?

### ❌ "API key inválida"
- Verificar se copiou a chave inteira
- Não deixar espaços extras
- Reiniciar o bot

### ❌ "GOOGLE_GEMINI_API_KEY não encontrada"
- Verificar se criou o arquivo `.env`
- Verificar se está na RAIZ do projeto
- NÃO usar `.env.example`, criar um novo `.env`

### ❌ "API respondeu com erro"
- Verificar a chave no console do Google
- Verificar se tem créditos/limite
- Reiniciar o bot

### ❌ "Comando /hipster não aparece"
- Aguardar 5 minutos
- Fazer logout/login no Discord
- Resetar a aplicação Discord

---

## ✨ RESUMO:

1. Abrir `.env.example` e copiar
2. Renomear para `.env`
3. Adicionar sua chave do Google
4. Reiniciar bot: `node index.js`
5. Testar: `/hipster texto:"teste" modo:ia`
6. **PRONTO!** 🌿

---

## 🎯 PRONTO!

Seu bot agora usa Google Gemini para reescrever em tom hippie! 

Toda vez que alguém usar `/hipster`, a IA vai reescrever SUPER criativo! 🚀
