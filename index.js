const express = require('express');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
app.use(express.json());

// CARREGAMENTO DA TABELA TÉCNICA
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

// CONFIGURAÇÃO DE ACESSO
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

// ROTA PARA O CHAT HTML
app.get('/', (req, res) => {
    const htmlPath = path.join(process.cwd(), 'index.html');
    if (fs.existsSync(htmlPath)) {
        res.sendFile(htmlPath);
    } else {
        res.status(404).send("Erro: Arquivo index.html não encontrado.");
    }
});

// PROMPT DO SISTEMA
const systemPrompt = `Você é o Consultor Trindade, especialista técnico da Trindade Assistência.

BASE DE CONHECIMENTO TÉCNICO:
${tabelaDiagnostico}

REGRAS DE ATENDIMENTO (SIGA A ORDEM RIGOROSAMENTE):
1. Identifique o sintoma na tabela e faça as Perguntas de Diagnóstico.
2. Após a resposta do cliente, sugira a parte do teste prático do Procedimento Orientado.
3. PARE E AGUARDE. Pergunte se o teste resolveu e espere a resposta do cliente.
4. SOMENTE SE o cliente confirmar que a ação simples não resolveu, direcione para o Fale Conosco.
5. Seja direto, técnico e específico. Não explique demais.
6. Não sugira venda de peças.`;

// ROTA DE COMUNICAÇÃO COM O CHAT (COM MEMÓRIA)
app.post('/chat', async (req, res) => {
    // Recebe a mensagem e o histórico enviado pelo index.html
    const { message, history = [] } = req.body; 

    try {
        // Constrói a memória: Prompt + Histórico + Mensagem Nova
        const messages = [
            { role: "system", content: systemPrompt },
            ...history,
            { role: "user", content: message }
        ];

        const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
            model: "llama-3.3-70b-versatile",
            messages: messages,
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
