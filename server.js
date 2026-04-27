const express = require('express');
const axios = require('axios');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json());

// 🔹 CONTROLE DE FLUXO POR CLIENTE
const estadoFluxo = {};

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const systemPrompt = `Você é o Consultor Trindade... (mantive igual ao seu, não alterei)`;

// MODELOS
const MODELS = [
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant"
];

function verificarHorario() {
    const agora = new Date(new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }));
    const dia = agora.getDay();
    const hora = agora.getHours();
    
    if (dia === 0 || dia === 6) {
        return { aberto: false, mensagem: "A gente não trabalha no fim de semana..." };
    }
    if (hora >= 12 && hora < 14) {
        return { aberto: false, mensagem: "Estamos em almoço agora..." };
    }
    if (hora < 8 || hora >= 18) {
        return { aberto: false, mensagem: "Atendemos das 8h às 18h..." };
    }
    return { aberto: true, mensagem: null };
}

async function callGroq(messages, modelIndex = 0) {
    try {
        const response = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                model: MODELS[modelIndex],
                messages,
                temperature: 0.35,
                max_tokens: 400
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        return response.data.choices[0].message.content.trim();

    } catch (error) {
        if (modelIndex < MODELS.length - 1) {
            return callGroq(messages, modelIndex + 1);
        }
        throw error;
    }
}

app.post('/chat', async (req, res) => {
    try {
        const { conversationHistory } = req.body;

        const statusHorario = verificarHorario();
        if (!statusHorario.aberto) {
            return res.json({ response: statusHorario.mensagem });
        }

        const ultimaMensagem = conversationHistory[conversationHistory.length - 1].content.toLowerCase();
        const clienteId = "cliente_unico";

        // 🔥 ATIVAR FLUXO "NÃO GELA"
        if (!estadoFluxo[clienteId]) {
            if (ultimaMensagem.includes("não gela") || ultimaMensagem.includes("nao gela")) {
                estadoFluxo[clienteId] = { etapa: "inicio" };
                return res.json({ response: "Ele fica ligado direto ou liga e desliga rápido?" });
            }
        }

        // 🔥 CONTROLE DO FLUXO
        if (estadoFluxo[clienteId]) {
            const etapa = estadoFluxo[clienteId].etapa;

            if (etapa === "inicio") {
                if (ultimaMensagem.includes("desliga")) {
                    estadoFluxo[clienteId].etapa = "clicando";
                    return res.json({ response: "Você escuta um clique antes de desligar?" });
                }

                if (ultimaMensagem.includes("direto")) {
                    estadoFluxo[clienteId].etapa = "barulho";
                    return res.json({ response: "Você escuta barulho de motor ou está silencioso?" });
                }

                return res.json({ response: "Ele fica ligado direto ou desliga sozinho?" });
            }

            if (etapa === "clicando") {
                delete estadoFluxo[clienteId];
                return res.json({
                    response: "Isso indica possível problema no relé ou proteção térmica. O ideal é assistência técnica. Clique no FALE CONOSCO 😊"
                });
            }

            if (etapa === "barulho") {
                delete estadoFluxo[clienteId];
                return res.json({
                    response: "Pode ser gás ou compressor. Melhor um técnico analisar. Clique no FALE CONOSCO 😊"
                });
            }
        }

        // 🔹 IA NORMAL
        const history = conversationHistory.slice(-12);

        const messages = [
            { role: "system", content: systemPrompt },
            ...history
        ];

        const reply = await callGroq(messages);

        res.json({ response: reply });

    } catch (error) {
        res.json({ response: "Desculpa, tive um probleminha 😅 Clique no FALE CONOSCO!" });
    }
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 7860;

app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
