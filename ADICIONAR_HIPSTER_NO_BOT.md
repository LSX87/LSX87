# 🚀 ADICIONAR /hipster NO index.js

## O QUE FAZER:

No seu `index.js`, procure por onde estão os comandos (geralmente começa com `SLASH_COMMANDS`)

### ENCONTRE ISTO:
```javascript
const SLASH_COMMANDS = [
    { name: 'bau', description: '...' },
    { name: 'rank', description: '...' },
    // ... outros comandos
];
```

### ADICIONE ISTO:
```javascript
const SLASH_COMMANDS = [
    { name: 'bau', description: '...' },
    { name: 'rank', description: '...' },
    
    // ✨ NOVO:
    { 
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
                    { name: 'Básico', value: 'basico' },
                    { name: 'IA', value: 'ia' }
                ]
            }
        ]
    },
    
    // ... resto dos comandos
];
```

---

## NO HANDLER DE INTERAÇÕES

Procure por onde as interações são processadas (geralmente em `events/interactionCreate.js`):

### ENCONTRE ISTO:
```javascript
switch(comando) {
    case 'bau':
        // processar bau
        break;
    case 'rank':
        // processar rank
        break;
}
```

### ADICIONE ISTO:
```javascript
switch(comando) {
    case 'bau':
        // processar bau
        break;
    case 'rank':
        // processar rank
        break;
    
    // ✨ NOVO:
    case 'hipster': {
        const { execute } = require('../commands/hipster');
        return await execute(interaction, config, database);
    }
    
    // ... resto dos casos
}
```

---

## ✅ PRONTO!

Depois disso:
1. Salve o arquivo
2. Reinicie o bot: `node index.js`
3. No Discord, digite `/hipster`
4. Escolha o texto e o modo
5. O bot responde em tom hippie! 🌿

---

## EXEMPLO DE USO:

```
Usuário: /hipster texto:"Reunião importante amanhã" modo:basico
Bot responde:
📝 Texto Original: "Reunião importante amanhã"
✨ Reescrita Hippie: "Opa, tipo rolê pesado de papo amanhã, brother! 🌿 ✌️"
```

---

**É isso! Simples demais! 🌿**
