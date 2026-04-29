const express = require('express');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// =====================
// TABELA
// =====================
const csvPath = path.join(process.cwd(), 'tabela_diagnostico.csv');
let tabelaDiagnostico = "";

try {
    if (fs.existsSync(csvPath)) {
        tabelaDiagnostico = fs.readFileSync(csvPath, 'utf8')
            .replace(/\r/g, '')
            .trim();

        console.log("✅ Tabela carregada com sucesso");
    } else {
        console.error("❌ Arquivo tabela_diagnostico.csv não encontrado");
    }
} catch (err) {
    console.error("❌ Erro ao ler tabela:", err.message);
}

// =====================
// CORS
// =====================
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

// =====================
// FRONT
// =====================
app.get('/', (req, res) => {
    const htmlPath = path.join(process.cwd(), 'index.html');
    if (fs.existsSync(htmlPath)) {
        res.sendFile(htmlPath);
    } else {
        res.status(404).send("Erro: index.html não encontrado.");
    }
});

// =====================
// SYSTEM PROMPT
// =====================
const systemPrompt = `
Você é o Consultor Trindade, especialista técnico da Trindade Assistência.

BASE DE CONHECIMENTO:
${tabelaDiagnostico.slice(0, 6000)}

REGRAS:
- Seja direto e técnico
- Nunca peça horário ao cliente
- Nunca mencione "atendimento humano"
- Respostas curtas
`;

// =====================
// CHAT
// =====================
app.post('/chat', async (req, res) => {

    const { message, history } = req.body;

    // 🔴 validação básica
    if (!message || typeof message !== "string") {
        return res.status(400).json({ response: "Mensagem inválida." });
    }

    const agora = new Date();

    const hora = agora.toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
    }).split(":");

    const h = parseInt(hora[0]);
    const m = parseInt(hora[1]);

    const HORA_ATUAL = `${h}:${m.toString().padStart(2, '0')}`;
    const minutosAgora = h * 60 + m;
    const minutosFechamento = 18 * 60;
    const minutosRestantes = minutosFechamento - minutosAgora;

    let STATUS_ATENDIMENTO = "";

    if (h >= 12 && h < 14) {
        STATUS_ATENDIMENTO = "ALMOCO";
    } else if (h >= 8 && h < 18) {
        STATUS_ATENDIMENTO = "ABERTO";
    } else {
        STATUS_ATENDIMENTO = "FECHADO";
    }

    try {

        const messages = [
            {
                role: "system",
                content: (systemPrompt + `

STATUS_ATENDIMENTO: ${STATUS_ATENDIMENTO}
MINUTOS_RESTANTES: ${minutosRestantes}
HORA_ATUAL: ${HORA_ATUAL}
`).slice(0, 12000)
            },

            ...(Array.isArray(history) ? history : []),

            { role: "user", content: message }
        ];

        const response = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                model: "llama-3.3-70b-versatile",
                messages,
                temperature: 0.5
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        res.json({
            response: response.data.choices[0].message.content
        });

    } catch (error) {
        console.error("❌ ERRO GROQ:", error?.response?.data || error.message);

        res.status(500).json({
            response: "Erro ao processar sua solicitação."
        });
    }
});

// =====================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
