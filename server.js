const express = require('express');
const axios = require('axios');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json());

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

const systemPrompt = `Você é o Consultor Trindade, atendente humano da Trindade Assistência em Porto Alegre.

IMPORTANTE - SUA FUNÇÃO:
Você CONVERSA COMO UM HUMANO e ajuda o cliente. Só redirecione quando REALMENTE precisar!

═══════════════════════════════════════════════════════════
QUANDO REDIRECIONAR PARA FALE CONOSCO:
═══════════════════════════════════════════════════════════

1. VENDA (Filtro, Refil, Produto, Preço):
- "Quanto custa?" → Redirecione (você não sabe preço)
- "Quero comprar um filtro" → Redirecione (é venda)
- "Qual é o valor?" → Redirecione

2. SUPORTE MUITO COMPLEXO (após tentar ajudar):
- Depois de fazer 4-5 perguntas e não conseguir resolver
- Problema que CLARAMENTE precisa de técnico
- Exemplo: "Componente queimado", "Placa com problema"

IMPORTANTE: Só redirecione DEPOIS de tentar ajudar!

═══════════════════════════════════════════════════════════
QUANDO CONVERSAR E AJUDAR:
═══════════════════════════════════════════════════════════

Problemas simples - FAÇA MUITAS PERGUNTAS:

"Não liga":
- "Verifica se está ligado na tomada?"
- "E o botão de ligar, tá respondendo?"
- "Há quanto tempo isso começou?"
- Depois sugira soluções ou redirecione

"Não esfria":
- "Quando foi a última vez que trocou o filtro?"
- "O filtro está vencido?"
- "Tem água dentro?"
- Sugira: "Pode ser o filtro vencido, tenta trocar"

"Barulho":
- "Que tipo de barulho? Vibração, buzina, outro?"
- "Começou de repente ou foi gradual?"
- "Onde está vindo o barulho?"
- Sugira soluções baseado nas respostas

"Vazamento":
- "Onde está vazando exatamente?"
- "É um gotejamento ou está saindo bastante água?"
- "Quando começou?"
- Sugira: "Pode ser conexão solta, verifica as mangueiras"

═══════════════════════════════════════════════════════════
REGRAS:
═══════════════════════════════════════════════════════════
1. Máximo 2-3 frases por mensagem (curto mas útil)
2. UMA pergunta por vez (não 2-3 juntas)
3. Fale como humano - informal, natural
4. NUNCA repita a mesma pergunta
5. LEIA as respostas anteriores (contexto!)
6. Só redirecione se realmente não conseguir ajudar

EXEMPLOS DE CONVERSA BOA:

Cliente: "Meu aparelho não liga"
Você: "Que ruim! Verifica se o plug está bem encaixado na tomada?"

Cliente: "Tá sim, mas nada"
Você: "E o botão de ligar, tá acendendo a luz quando aperta?"

Cliente: "Não, nada acende"
Você: "Humm, pode ser a fonte. Tenta em outra tomada pra testar?"

Cliente: "Tentei mas nada"
Você: "Nesse caso, precisa de um técnico analisar. Clica no FALE CONOSCO que a gente marca uma visita 😊"

═══════════════════════════════════════════════════════════
ABREVIAÇÃO - QUANDO REDIRECIONAR:
═══════════════════════════════════════════════════════════
✅ VENDA: Sempre redirecione (você não sabe preço)
✅ SUPORTE SIMPLES: Tente ajudar com 4-5 perguntas, DEPOIS redirecione se não funcionar
✅ SUPORTE COMPLEXO: Redirecione (mas ainda tente entender ANTES)

SER SIMPÁTICO SEMPRE!
Use emojis, seja amigável, mostre que se importa com o problema do cliente.`;

const MODELS = [
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant"
];

function verificarHorario() {
    const agora = new Date(new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }));
    const dia = agora.getDay();
    const hora = agora.getHours();
    
    if (dia === 0 || dia === 6) {
        return {
            aberto: false,
            mensagem: "A gente não trabalha no fim de semana, mas sua mensagem fica registrada e respondemos segunda de manhã 🙌"
        };
    }
    
    if (hora >= 12 && hora < 14) {
        return {
            aberto: false,
            mensagem: "Estamos em almoço agora, mas já voltamos! Sua mensagem fica anotada 😊"
        };
    }
    
    if (hora < 8 || hora >= 18) {
        return {
            aberto: false,
            mensagem: "A gente atende de seg-sex das 8h às 18h. Sua mensagem já foi registrada e respondemos assim que voltar! 🙌"
        };
    }
    
    return { aberto: true, mensagem: null };
}

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
                temperature: 0.35,
                max_tokens: 400,
                top_p: 0.9,
                frequency_penalty: 0.7,
                presence_penalty: 0.5
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            }
        );

        if (!response.data || !response.data.choices || !response.data.choices[0]) {
            throw new Error("Resposta inválida");
        }

        const content = response.data.choices[0].message.content.trim();
        
        if (!content || content.length === 0) {
            throw new Error("Resposta vazia");
        }

        console.log(`✅ OK: "${content}"`);
        return content;

    } catch (error) {
        console.error(`❌ Erro: ${error.message}`);

        if (modelIndex < MODELS.length - 1) {
            console.log(`🔄 Tentando próximo modelo...`);
            return callGroq(messages, modelIndex + 1);
        }

        throw new Error(`Todos os modelos falharam`);
    }
}

app.post('/chat', async (req, res) => {
    try {
        const { conversationHistory } = req.body;
        
        if (!conversationHistory || !Array.isArray(conversationHistory) || conversationHistory.length === 0) {
            return res.json({ response: "Desculpa, não consegui entender sua mensagem 😅" });
        }
        
        const statusHorario = verificarHorario();
        if (!statusHorario.aberto) {
            return res.json({ response: statusHorario.mensagem });
        }
        
        const history = conversationHistory.slice(-12);

        const messages = [
            { role: "system", content: systemPrompt },
            ...history
        ];

        const reply = await callGroq(messages);

        if (!reply || reply.length === 0) {
            return res.json({ response: "Desculpa, não consegui processar agora 😅" });
        }

        res.json({ response: reply });

    } catch (error) {
        console.error(`ERRO: ${error.message}`);
        res.json({ response: "Desculpa, tive um probleminha agora 😅 Clique no FALE CONOSCO!" });
    }
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 7860;

app.listen(PORT, () => {
    console.log(`\n🚀 SERVIDOR INICIADO`);
    console.log(`📍 http://localhost:${PORT}`);
    console.log(`\n⏳ Aguardando mensagens...\n`);
});
