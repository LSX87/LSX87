const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const nodeModules = path.join(__dirname, 'node_modules');
const hasDiscord = fs.existsSync(path.join(nodeModules, 'discord.js'));
const hasDotenv  = fs.existsSync(path.join(nodeModules, 'dotenv'));

if (!hasDiscord || !hasDotenv) {
    console.log('📦 Instalando dependências...');
    try {
        const cacheDir = path.join(__dirname, '.cache');

        // Apagar cache corrompido/root e recriar com permissão certa
        try { fs.rmSync(cacheDir, { recursive: true, force: true }); } catch(_) {}
        fs.mkdirSync(cacheDir, { recursive: true });

        execSync(`npm install discord.js@14.16.3 dotenv@16.4.5 --cache "${cacheDir}" --no-audit --no-fund --no-optional`, {
            cwd: __dirname,
            stdio: 'inherit'
        });

        try { fs.rmSync(cacheDir, { recursive: true, force: true }); } catch(_) {}
        console.log('✅ Dependências instaladas!');
    } catch (err) {
        console.error('❌ Erro:', err.message);
        process.exit(1);
    }
} else {
    console.log('✅ Dependências já instaladas.');
}

require('./index.js');
