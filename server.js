const express = require('express');
const axios = require('axios');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json());

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

const systemPrompt = `Você é o Consultor Trindade...`;

const MODELS = [
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant"
];

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
        const { conversationHistory, message } = req.body;

        const ultimaMensagem = (message || "").toLowerCase();
        const clienteId = "cliente_unico";

        console.log("DEBUG:", ultimaMensagem);

        // 🔥 ATIVAR FLUXO
        if (!estadoFluxo[clienteId]) {
            if (
                ultimaMensagem.includes("gela") ||
                ultimaMensagem.includes("gelando") ||
                ultimaMensagem.includes("fria") ||
                ultimaMensagem.includes("esfria")
            ) {
                estadoFluxo[clienteId] = { etapa: "inicio" };
                return res.json({ response: "Ele fica ligado direto ou liga e desliga rápido?" });
            }
        }

        // 🔥 CONTROLE DO FLUXO
        if (estadoFluxo[clienteId]) {
            const etapa = estadoFluxo[clienteId].etapa;

            if (etapa === "inicio") {
                if (ultimaMensagem.includes("desliga") || ultimaMensagem.includes("sozinho")) {
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
                    response: "Isso indica problema no relé. Melhor assistência técnica. Clique no FALE CONOSCO 😊"
                });
            }

            if (etapa === "barulho") {
                delete estadoFluxo[clienteId];
                return res.json({
                    response: "Pode ser compressor ou gás. Melhor técnico analisar. Clique no FALE CONOSCO 😊"
                });
            }
        }

        // 🔹 IA NORMAL
        const messages = [
            { role: "system", content: systemPrompt },
            ...(conversationHistory || [])
        ];

        const reply = await callGroq(messages);

        res.json({ response: reply });

    } catch (error) {
        res.json({ response: "Erro 😅 Clique no FALE CONOSCO!" });
    }
});

app.listen(process.env.PORT || 7860, () => {
    console.log("Servidor rodando 🚀");
});
