const express = require('express');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(express.json());

// 🔹 CONTROLE DE FLUXO
const estadoFluxo = {};

const MODELS = [
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant"
];

const systemPrompt = "Você é um atendente simpático.";

async function callGroq(messages, modelIndex = 0) {
    try {
        const response = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                model: MODELS[modelIndex],
                messages,
                temperature: 0.3
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        return response.data.choices[0].message.content;

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

        const clienteId = "cliente_unico";
        const ultimaMensagem = (message || "").toLowerCase();

        console.log("MENSAGEM RECEBIDA:", ultimaMensagem);

        // 🔥 ATIVA FLUXO
        if (!estadoFluxo[clienteId]) {
            if (ultimaMensagem.includes("gela")) {
                estadoFluxo[clienteId] = { etapa: "inicio" };
                return res.json({
                    response: "Ele fica ligado direto ou liga e desliga?"
                });
            }
        }

        // 🔥 CONTROLE DO FLUXO
        if (estadoFluxo[clienteId]) {

            const etapa = estadoFluxo[clienteId].etapa;

            if (etapa === "inicio") {

                if (ultimaMensagem.includes("desliga")) {
                    delete estadoFluxo[clienteId];
                    return res.json({
                        response: "Pode ser relé ou proteção térmica. Melhor assistência."
                    });
                }

                if (ultimaMensagem.includes("direto")) {
                    delete estadoFluxo[clienteId];
                    return res.json({
                        response: "Pode ser compressor ou gás. Precisa de técnico."
                    });
                }

                return res.json({
                    response: "Ele desliga sozinho ou fica ligado direto?"
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
        console.error(error);
        res.json({ response: "Erro 😅" });
    }
});

app.listen(process.env.PORT || 3000, () => {
    console.log("Servidor rodando 🚀");
});
