const express = require('express');
const cors = require('cors');
const { Groq } = require('groq-sdk');

const app = express();

// Configuração do CORS para permitir que seu site acesse o agente
app.use(cors());
app.use(express.json());

// Inicialização da Groq usando a variável de ambiente que você configurou nos Secrets
const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

// Endpoint principal para o chat
app.post('/chat', async (req, res) => {
    try {
        const { message } = req.body;

        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: "Você é o assistente técnico da Trindade Assistência. Seja direto e profissional."
                },
                {
                    role: "user",
                    content: message
                }
            ],
            model: "llama-3.3-70b-versatile",
        });

        res.json({ response: completion.choices[0].message.content });
    } catch (error) {
        console.error("Erro na requisição:", error);
        res.status(500).json({ error: "Erro interno no servidor" });
    }
});

// Rota de teste para verificar se o servidor está vivo
app.get('/', (req, res) => {
    res.send('Agente Trindade Assistência Rodando com Sucesso!');
});

// CONFIGURAÇÃO DE PORTA OBRIGATÓRIA PARA HUGGING FACE
const port = process.env.PORT || 7860;
app.listen(port, '0.0.0.0', () => {
    console.log(`Servidor ativo na porta ${port}`);
});