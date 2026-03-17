// database/database.js — Fuminho Bot 🌿
// Railway: dados salvos em /data (volume persistente) se disponível
// Fallback: pasta local database/data/
const fs   = require('fs');
const path = require('path');

// Railway monta volume em /data se configurado
// Senão usa pasta local (funciona na Discloud também)
const DB_DIR  = fs.existsSync('/data')
    ? '/data'
    : path.join(__dirname, 'data');

const DB_FILE  = path.join(DB_DIR, 'db.json');
const TMP_FILE = DB_FILE + '.tmp';

if (!fs.existsSync(DB_DIR))  fs.mkdirSync(DB_DIR, { recursive: true });
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify({}), 'utf8');

console.log('[DB] Usando banco em:', DB_FILE);

// Write atômico — escreve em .tmp e renomeia para evitar corrupção
function load() {
    try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
    catch (_) { return {}; }
}
function save(data) {
    try {
        fs.writeFileSync(TMP_FILE, JSON.stringify(data, null, 2), 'utf8');
        fs.renameSync(TMP_FILE, DB_FILE);
    } catch (err) { console.error('[DB] Erro ao salvar:', err.message); }
}
function get(key)        { return load()[key] ?? null; }
function set(key, value) { const d = load(); d[key] = value; save(d); }
function del(key)        { const d = load(); delete d[key]; save(d); }

function normKey(nome) { return nome.toLowerCase().trim(); }

// ─── BAÚ — DINHEIRO ──────────────────────────────────────────────
function getBauDinheiro()    { return get('bau_dinheiro') || { limpo: 0, sujo: 0 }; }
function setBauDinheiro(obj) { set('bau_dinheiro', obj); }
function getDinheiroBau(tipo)          { return getBauDinheiro()[tipo] || 0; }
function getTotalDinheiroBau()         { const d = getBauDinheiro(); return (d.limpo||0)+(d.sujo||0); }
function adicionarDinheiroBau(tipo, valor) { const d = getBauDinheiro(); d[tipo]=(d[tipo]||0)+valor; setBauDinheiro(d); return d[tipo]; }
function retirarDinheiroBau(tipo, valor)   { const d = getBauDinheiro(); d[tipo]=Math.max(0,(d[tipo]||0)-valor); setBauDinheiro(d); return d[tipo]; }

// ─── BAÚ — ITENS ─────────────────────────────────────────────────
function getBauItens()       { return get('bau_itens') || {}; }
function setBauItens(itens)  { set('bau_itens', itens); }
function itemExisteNoBau(nome) { return !!getBauItens()[normKey(nome)]; }
function adicionarItemBau(nome, qty) {
    const itens = getBauItens(); const key = normKey(nome);
    if (itens[key]) itens[key].quantidade += qty;
    else itens[key] = { nome: nome.trim(), quantidade: qty };
    setBauItens(itens); return itens[key];
}
function retirarItemBau(nome, qty) {
    const itens = getBauItens(); const key = normKey(nome);
    if (!itens[key]) return null;
    if (qty === 0 || qty >= itens[key].quantidade) { delete itens[key]; setBauItens(itens); return { removido: true }; }
    itens[key].quantidade -= qty; setBauItens(itens); return itens[key];
}

// ─── RANK MENSAL ─────────────────────────────────────────────────
function getMesKey() { const d=new Date(); return `rank_${d.getFullYear()}_${String(d.getMonth()+1).padStart(2,'0')}`; }
function getRankMes(mesKey)     { return get(mesKey||getMesKey())||{}; }
function resetarRankMes(mesKey) { set(mesKey||getMesKey(),{}); }
function adicionarAoRank(userId, userName, displayName, valor) {
    const key=getMesKey(); const rank=getRankMes(key);
    if (!rank[userId]) rank[userId]={userId,userName,displayName,valorTotal:0,depositos:0};
    rank[userId].valorTotal+=valor; rank[userId].depositos+=1; rank[userId].displayName=displayName;
    set(key,rank); return rank[userId];
}
function getRankOrdenado(mesKey) { return Object.values(getRankMes(mesKey)).sort((a,b)=>b.valorTotal-a.valorTotal); }

// ─── PONTOS / NÍVEIS ─────────────────────────────────────────────
function getPontos(userId)        { return get('pts_'+userId)||{pontos:0,nivel:0,nomeNivel:'Aliado'}; }
function setPontos(userId, dados) { set('pts_'+userId, dados); }
async function adicionarPontos(userId, userName, displayName, quantidade) {
    const cfg=require('../config.json'); const niveis=cfg.niveis?.cargos||[];
    const dados=getPontos(userId); dados.userId=userId; dados.userName=userName; dados.displayName=displayName;
    dados.pontos=(dados.pontos||0)+quantidade;
    let nivelAtual=0, nomeAtual=niveis[niveis.length-1]?.nome||'Aliado';
    for (let i=0;i<niveis.length;i++) { if (dados.pontos>=niveis[i].pontosNecessarios){nivelAtual=i;nomeAtual=niveis[i].nome;} }
    dados.nivel=nivelAtual; dados.nomeNivel=nomeAtual; setPontos(userId,dados); return dados;
}
function removerPontos(userId, userName, displayName, quantidade) {
    const cfg=require('../config.json'); const niveis=cfg.niveis?.cargos||[];
    const dados=getPontos(userId); dados.userId=userId; dados.userName=userName; dados.displayName=displayName;
    dados.pontos=Math.max(0,(dados.pontos||0)-quantidade);
    let nivelAtual=0, nomeAtual=niveis[niveis.length-1]?.nome||'Aliado';
    for (let i=0;i<niveis.length;i++) { if (dados.pontos>=niveis[i].pontosNecessarios){nivelAtual=i;nomeAtual=niveis[i].nome;} }
    dados.nivel=nivelAtual; dados.nomeNivel=nomeAtual; setPontos(userId,dados); return dados;
}
function getRankingPontos() {
    const d=load();
    return Object.entries(d).filter(([k])=>k.startsWith('pts_')).map(([,v])=>v).sort((a,b)=>b.pontos-a.pontos);
}

// ─── REGRAS ──────────────────────────────────────────────────────
const REGRAS_PADRAO=['Respeite todos os membros.','Sem spam ou flood no chat.','Não envie links suspeitos.','Siga as orientações da Staff.','O gueto tem lei própria — respeite.'];
function getRegras()      { return get('regras')||REGRAS_PADRAO; }
function setRegras(lista) { set('regras',lista); }

// ─── PONTO ───────────────────────────────────────────────────────
function baterPonto(userId, userName, displayName, tipo, guildId) {
    const key='ponto_'+guildId+'_'+userId; const lista=get(key)||[];
    const reg={tipo,userId,userName,displayName,timestamp:Date.now(),data:new Date().toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})};
    lista.push(reg); if(lista.length>500) lista.splice(0,lista.length-500);
    set(key,lista); return reg;
}
function getPonto(userId, guildId)       { return get('ponto_'+guildId+'_'+userId)||[]; }
function getUltimoPonto(userId, guildId) { const l=get('ponto_'+guildId+'_'+userId)||[]; return l.length?l[l.length-1]:null; }

// ─── CHAT LOG ────────────────────────────────────────────────────
function logChat(userId, userName, displayName, guildId, canalNome, mensagem) {
    const key='chat_'+guildId+'_'+userId; const lista=get(key)||[];
    lista.push({userId,userName,displayName,canal:canalNome,mensagem:mensagem.substring(0,500),timestamp:Date.now(),data:new Date().toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})});
    if(lista.length>200) lista.splice(0,lista.length-200); set(key,lista);
}
function getChatLog(userId, guildId) { return get('chat_'+guildId+'_'+userId)||[]; }

// ─── PUNIÇÕES ────────────────────────────────────────────────────
function logPunicao(userId, userName, guildId, motivo, tipo) {
    const key='punicao_'+guildId+'_'+userId; const lista=get(key)||[];
    lista.push({userId,userName,motivo,tipo,data:new Date().toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}),timestamp:Date.now()});
    if(lista.length>100) lista.splice(0,lista.length-100); set(key,lista);
}
function getPunicoes(userId, guildId) { return get('punicao_'+guildId+'_'+userId)||[]; }

// ─── LIMPEZA ─────────────────────────────────────────────────────
function getLimpezaConfig(guildId)      { return get('limpeza_'+guildId)||{ativo:false,horario:'03:00',diasDaSemana:[1,2,3,4,5],canais:[]}; }
function setLimpezaConfig(guildId,cfg)  { set('limpeza_'+guildId,cfg); }

// ─── VOTAÇÕES ────────────────────────────────────────────────────
function getVotoEvento(eKey,userId)          { return get('voto_'+eKey+'_'+userId)||null; }
function setVotoEvento(eKey,userId,escolha)  { set('voto_'+eKey+'_'+userId,{escolha,data:new Date().toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})}); }
function getVotosEvento(eKey)                { return get('votos_'+eKey)||{}; }
function addVotoEvento(eKey,userId,escolha)  { const t=getVotosEvento(eKey); t[userId]={escolha,data:new Date().toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})}; set('votos_'+eKey,t); }

// ─── RESPOSTAS AUTOMÁTICAS ───────────────────────────────────────
function getRespostas() { const s=get('respostas_auto'); if(s) return s; const cfg=require('../config.json'); const r=cfg.chat?.respostasAutomaticas||{}; set('respostas_auto',r); return r; }
function setRespostas(obj)                  { set('respostas_auto',obj); }
function adicionarResposta(gatilho,texto)   { const r=getRespostas(); r[gatilho.toLowerCase()]=texto; set('respostas_auto',r); }
function removerResposta(gatilho)           { const r=getRespostas(); delete r[gatilho.toLowerCase()]; set('respostas_auto',r); }

// ─── TRANSAÇÕES ──────────────────────────────────────────────────
function getHistoricoTransacoes(userId) { return get('transacoes_'+userId)||[]; }
function registrarTransacao(userId,tipo,referencia,pontos,quantidade) {
    const lista=getHistoricoTransacoes(userId); const id=Date.now()+'_'+Math.random().toString(36).slice(2,7);
    lista.push({id,tipo,referencia,pontos,quantidade:quantidade||1,timestamp:Date.now()});
    if(lista.length>1000) lista.splice(0,lista.length-1000); set('transacoes_'+userId,lista); return id;
}
function calcularDesconto(userId,tipoDinheiro,valorRetirado) {
    const lista=getHistoricoTransacoes(userId); const tipo='dinheiro_'+tipoDinheiro;
    const deps=lista.filter(t=>t.tipo===tipo); if(!deps.length) return 0;
    const totalDep=deps.reduce((a,t)=>a+(t.referencia||0),0); const totalPts=deps.reduce((a,t)=>a+(t.pontos||0),0);
    if(totalDep<=0) return 0; return Math.round(totalPts*Math.min(1,valorRetirado/totalDep));
}
function calcularDescontoItem(userId,nomeItem,qtdRetirada) {
    const lista=getHistoricoTransacoes(userId); const key=nomeItem.toLowerCase().trim();
    const deps=lista.filter(t=>t.tipo==='item'&&t.referencia?.toLowerCase().trim()===key); if(!deps.length) return 0;
    const totalQtd=deps.reduce((a,t)=>a+(t.quantidade||1),0); const totalPts=deps.reduce((a,t)=>a+(t.pontos||0),0);
    if(totalQtd<=0) return 0; return Math.round(totalPts*Math.min(1,qtdRetirada/totalQtd));
}

// ─── NÍVEIS ──────────────────────────────────────────────────────
function getNiveisConfig()     { return get('niveis_config')||null; }
function setNiveisConfig(obj)  { set('niveis_config',obj); }

// ─── ENQUETES ────────────────────────────────────────────────────
function getEnquetes(guildId)            { return get('enquetes_'+guildId)||{}; }
function setEnquetes(guildId,obj)        { set('enquetes_'+guildId,obj); }
function getEnquete(guildId,id)          { return getEnquetes(guildId)[id]||null; }
function salvarEnquete(guildId,id,obj)   { const todos=getEnquetes(guildId); todos[id]=obj; setEnquetes(guildId,todos); }

module.exports = {
    normKey,
    getBauDinheiro, getDinheiroBau, adicionarDinheiroBau, retirarDinheiroBau, getTotalDinheiroBau,
    getBauItens, adicionarItemBau, retirarItemBau, itemExisteNoBau,
    getMesKey, getRankMes, adicionarAoRank, getRankOrdenado, resetarRankMes,
    getPontos, setPontos, adicionarPontos, removerPontos, getRankingPontos,
    getRegras, setRegras,
    baterPonto, getPonto, getUltimoPonto,
    logChat, getChatLog,
    logPunicao, getPunicoes,
    getLimpezaConfig, setLimpezaConfig,
    getVotoEvento, setVotoEvento, getVotosEvento, addVotoEvento,
    getRespostas, setRespostas, adicionarResposta, removerResposta,
    getNiveisConfig, setNiveisConfig,
    getEnquetes, setEnquetes, getEnquete, salvarEnquete,
    getHistoricoTransacoes, registrarTransacao, calcularDesconto, calcularDescontoItem,
};
