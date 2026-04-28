const express = require('express');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
app.use(express.json());

// 1. CARREGAMENTO DA TABELA TÉCNICA
const csvPath = path.join(process.cwd(), 'tabela_diagnostico.csv');
let tabelaDiagnostico = "";

try {
    if (fs.existsSync(csvPath)) {
        tabelaDiagnostico = fs.readFileSync(csvPath, 'utf8');
        console.log("✅ Tabela carregada com sucesso");
    } else {
        console.error("❌ Erro: Arquivo tabela_diagnostico.csv não encontrado");
    }
} catch (err) {
    console.error("❌ Erro ao ler a tabela:", err.message);
}

// 2. CONFIGURAÇÃO DE ACESSO (CORS)
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

// 3. ROTA PARA O CHAT HTML
app.get('/', (req, res) => {
    const htmlPath = path.join(process.cwd(), 'index.html');
    if (fs.existsSync(htmlPath)) {
        res.sendFile(htmlPath);
    } else {
        res.status(404).send("Erro: Arquivo index.html não encontrado.");
    }
});

// 4. PROMPT DO SISTEMA (AJUSTADO COM CRASE FINAL)
const systemPrompt = `Você é o Consultor Trindade, especialista técnico da Trindade Assistência em Porto Alegre.

BASE DE CONHECIMENTO TÉCNICO:
${tabelaDiagnostico}

REGRAS DE ATENDIMENTO:
1. Use estritamente os dados da tabela acima para guiar o diagnóstico.
2. Seja direto, técnico e específico. Não explique demais.
3. Se o diagnóstico for concluído, ofereça a peça com preço de venda final do site www.trindadeassistencia.com.br.
4. Proibido usar expressões como "Pulo do Gato".`;

// 5. ROTA DE COMUNICAÇÃO COM O CHAT
app.post('/chat', async (req, res) => {
    const { message } = req.body;

    try {
        const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
            model: "llama-3.3-70b-versatile",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: message }
            ],
            temperature: 0.5
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        res.json({ response: response.data.choices[0].message.content });
    } catch (error) {
        console.error("Erro na API Groq:", error.response?.data || error.message);
        res.status(500).json({ response: "Erro ao processar sua solicitação." });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
