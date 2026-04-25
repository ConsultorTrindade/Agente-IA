const express = require('express');
const axios = require('axios');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json());

// CORS simples
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");

    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

// Página inicial
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 🧠 PROMPT VENDEDOR - VERSÃO CORRIGIDA
const systemPrompt = `Você é o Consultor Trindade, atendente humano da Trindade Assistência em Porto Alegre.
REGRAS ABSOLUTAS:
1. Máximo 2 frases por mensagem
2. Fale como humano (WhatsApp) - informal e natural
3. NUNCA diga que é IA ou bot
4. Responda EXATAMENTE o que perguntaram...
FLUXO PARA PROBLEMA/DEFEITO:
- Primeiro: Entender o problema
- Depois: Fazer 1 pergunta sobre marca/modelo/detalhes
- Finalmente: "Ótimo! Clica ali no FALE CONOSCO que a gente resolve 😉"
FLUXO PARA REFIL:
- Pergunta 1: "Qual marca?"
- Pergunta 2: "Qual modelo?"
- Depois: "Clica ali no FALE CONOSCO que a gente te envia 😊"
FLUXO PARA AGENDAMENTO/SERVIÇO:
- SEMPRE: "Ótimo! Clica ali no FALE CONOSCO que a gente agenda direitinho com você 😊"
- NUNCA diga "pode trazer", "pode vir", "marca aí" - sempre redirecione para o botão
COBERTURA:
- Atendemos SOMENTE Porto Alegre e região metropolitana
- Outra cidade: "Poxa, a gente só tá em POA e região 😊"
INFORMAÇÕES ÚTEIS:
- Horário: seg-sex 8h às 12h e 14h às 18h (só responda se perguntarem)
- Nunca peça fotos de aparelhos
TONS CORRETOS:
- "Entendi... ele parou de gelar completamente ou só diminuiu?"
- "Qual marca você tem?"
- "Que legal! Clica ali que a gente agenda 😊"
- "Infelizmente a gente não chega aí, mas encontra um técnico por aí!"
TONS INCORRETOS:
- "Tive um probleminha aqui" (resposta de erro - nunca fale isso)
- Repetir a mesma frase que já disse antes
- Respostas muito genéricas ou aleatórias
- Ignorar a pergunta feita`;

const MODELS = [
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant"
];

// ⏰ Verificar horário de funcionamento
function verificarHorario() {
    const agora = new Date(new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }));
    const dia = agora.getDay();
    const hora = agora.getHours();
    
    const horaAbertura = 8;
    const horaFechamento = 18;
    const inicioAlmoco = 12;
    const fimAlmoco = 14;
    
    if (dia === 0 || dia === 6) {
        return {
            aberto: false,
            mensagem: "A gente não trabalha no fim de semana, mas sua mensagem fica registrada e respondemos segunda de manhã 🙌"
        };
    }
    
    if (hora >= inicioAlmoco && hora < fimAlmoco) {
        return {
            aberto: false,
            mensagem: "Estamos em almoço agora, mas já voltamos! Sua mensagem fica anotada 😊"
        };
    }
    
    if (hora < horaAbertura || hora >= horaFechamento) {
        return {
            aberto: false,
            mensagem: "A gente atende de seg-sex das 8h às 18h. Sua mensagem já foi registrada e respondemos assim que voltar! 🙌"
        };
    }
    
    return {
        aberto: true,
        mensagem: null
    };
}

// 🔄 Chamada à API Groq com fallback automático
async function callGroq(messages, modelIndex = 0) {
    if (!process.env.GROQ_API_KEY) {
        throw new Error("GROQ_API_KEY não está configurada!");
    }

    try {
        console.log(`📡 Tentando modelo: ${MODELS[modelIndex]}`);
        
        const response = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                model: MODELS[modelIndex],
                messages,
                temperature: 0.5,
                max_tokens: 100
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000 // 10 segundos de timeout
            }
        );

        // Verificar se a resposta é válida
        if (!response.data || !response.data.choices || !response.data.choices[0]) {
            throw new Error("Resposta inválida da API Groq");
        }

        const content = response.data.choices[0].message.content.trim();
        
        if (!content || content.length === 0) {
            throw new Error("Resposta vazia da API");
        }

        console.log(`✅ Resposta recebida: "${content}"`);
        return content;

    } catch (error) {
        console.error(`❌ Erro no modelo ${MODELS[modelIndex]}:`, error.message);

        // Tentar próximo modelo
        if (modelIndex < MODELS.length - 1) {
            console.log(`🔄 Tentando fallback para ${MODELS[modelIndex + 1]}...`);
            return callGroq(messages, modelIndex + 1);
        }

        // Se todos os modelos falharam, relançar o erro
        throw new Error(`Todos os modelos falharam. Último erro: ${error.message}`);
    }
}

// 🚀 Rota principal do chat
app.post('/chat', async (req, res) => {
    try {
        const { conversationHistory } = req.body;
        
        console.log(`\n📨 Nova mensagem recebida`);
        console.log(`Histórico: ${conversationHistory.length} mensagens`);
        
        // Validar entrada
        if (!conversationHistory || !Array.isArray(conversationHistory) || conversationHistory.length === 0) {
            console.error("❌ Histórico inválido ou vazio");
            return res.json({ response: "Desculpa, não consegui entender sua mensagem 😅" });
        }
        
        // ⏰ VERIFICAR HORÁRIO ANTES DE RESPONDER
        const statusHorario = verificarHorario();
        if (!statusHorario.aberto) {
            console.log(`⏰ Fora do horário: ${statusHorario.mensagem}`);
            return res.json({ response: statusHorario.mensagem });
        }
        
        // Pegar últimas 8 mensagens para manter contexto melhor
        const history = conversationHistory.slice(-8);
        
        console.log(`📝 Histórico a ser enviado para IA (últimas ${history.length} mensagens)`);

        // Preparar mensagens para a API
        const messages = [
            { role: "system", content: systemPrompt },
            ...history
        ];

        // Chamar Groq
        const reply = await callGroq(messages);

        // Validar resposta final
        if (!reply || reply.length === 0) {
            console.error("❌ Resposta vazia após fallback");
            return res.json({ 
                response: "Desculpa, não consegui processar sua mensagem agora 😅 Mas estou aqui!" 
            });
        }

        // Se chegou aqui, tudo funcionou
        console.log(`✅ Resposta enviada com sucesso\n`);
        res.json({ response: reply });

    } catch (error) {
        console.error(`\n🚨 ERRO NA ROTA /chat:`, error.message);
        console.error(error.stack);

        // Resposta de erro amigável (mas diferente da mensagem genérica)
        res.json({
            response: "Desculpa, tive um probleminha agora 😅 Mas você pode clicar no FALE CONOSCO que a gente te atende!"
        });
    }
});

// 🔊 Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok',
        timestamp: new Date().toISOString(),
        groqApiKey: process.env.GROQ_API_KEY ? 'configurada' : '❌ NÃO CONFIGURADA'
    });
});

// 🔊 Iniciar servidor
const PORT = process.env.PORT || 7860;

app.listen(PORT, () => {
    console.log(`\n🚀 SERVIDOR INICIADO`);
    console.log(`📍 http://localhost:${PORT}`);
    console.log(`✅ GROQ_API_KEY: ${process.env.GROQ_API_KEY ? 'Configurada ✓' : '❌ NÃO CONFIGURADA'}`);
    console.log(`\n⏳ Aguardando mensagens...\n`);
});
