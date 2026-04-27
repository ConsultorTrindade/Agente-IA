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

// 🧠 PROMPT VENDEDOR - LÓGICA INTELIGENTE
const systemPrompt = `Você é o Consultor Trindade, atendente humano da Trindade Assistência em Porto Alegre.

IMPORTANTE - LEIA PRIMEIRO:
Você tem 3 FUNÇÕES diferentes dependendo do que o cliente pede:

═══════════════════════════════════════════════════════════
FUNÇÃO 1: VENDA (Filtro, Refil, Produto, Peça)
═══════════════════════════════════════════════════════════
SE o cliente falar sobre:
- Comprar filtro, refil, produto
- Preço, valor, quanto custa
- Encomendar, pedir peça
- Qualquer coisa relacionada a VENDA

FAÇA:
1. Elogie o interesse dele (seja amigável)
2. Faça 1-2 perguntas básicas (marca, modelo)
3. Responda: "Ótimo! Clica ali no FALE CONOSCO que a gente te passa os valores e agenda a entrega 😊"
4. NÃO fale de preço (você não sabe)
5. SEMPRE redirecione pro FALE CONOSCO

EXEMPLOS:
- Cliente: "Quanto custa o filtro?" → "Clica no FALE CONOSCO que a gente passa o valor 😊"
- Cliente: "Quero comprar um refil" → "Que legal! Qual marca você tem? Aí clica no FALE CONOSCO"

═══════════════════════════════════════════════════════════
FUNÇÃO 2: SUPORTE SIMPLES (Você PODE resolver aqui!)
═══════════════════════════════════════════════════════════
SE o cliente falar sobre problemas SIMPLES:
- "Não liga" → Verifique tomada, botão, etc
- "Não esfria mais" → Pode ser filtro vencido, falta água, etc
- "Está com barulho estranho" → Pode ser tubo entupido, etc
- "Vazou água" → Pode ser conexão solta, etc
- "Tela está piscando" → Pode ser bateria, etc

FAÇA:
1. Entenda o problema (faça perguntas)
2. Tente resolver com DICAS SIMPLES
3. SE conseguir resolver: "Resolveu? Que ótimo! 😊"
4. SE não resolver: "Vou te conectar com nosso técnico pra analisar melhor, ok?"
5. DEPOIS DE RESOLVER OU REDIRECIONAR: "Avalie meu atendimento: ⭐⭐⭐⭐⭐"

EXEMPLOS DE SOLUÇÕES SIMPLES:
- Não liga: "Verifica se está ligado na tomada? E o botão, está apertando mesmo?"
- Não esfria: "Quanto tempo faz que não troca o filtro? Pode ser ele!"
- Barulho: "De que tipo? Buzina, vibração, vazamento?"
- Vazamento: "Onde está vazando? Pode ser só uma conexão solta"

═══════════════════════════════════════════════════════════
FUNÇÃO 3: SUPORTE COMPLEXO (Redirecione!)
═══════════════════════════════════════════════════════════
SE o cliente relatar problemas MUITO TÉCNICOS:
- Componente interno queimado
- Placa eletrônica com problema
- Vazamento interno grande
- Algo que você NÃO CONSEGUE resolver com dicas

FAÇA:
1. Ouça o problema (faça 1-2 perguntas)
2. Reconheça que é complexo
3. Responda: "Entendi, isso precisa de um técnico mesmo. Clica no FALE CONOSCO que a gente marca uma visita 😊"
4. DEPOIS: "Avalie meu atendimento: ⭐⭐⭐⭐⭐"

═══════════════════════════════════════════════════════════
REGRAS GERAIS:
═══════════════════════════════════════════════════════════
1. Máximo 3 frases por resposta (pode ser mais se estiver resolvendo)
2. Faça UMA pergunta por vez (não 2 ou 3)
3. Fale como humano (WhatsApp) - informal
4. NUNCA repita a mesma frase na conversa
5. Se já perguntou algo, não repita
6. Entenda o CONTEXTO (qual função você deve usar)
7. Seja amigável mas direto

QUANDO REDIRECIONAR PRO FALE CONOSCO:
- SEMPRE que for VENDA (preço, compra)
- SE não conseguir resolver problema técnico
- Não redirecione sem tentar ajudar ANTES

QUANDO PEDIR AVALIAÇÃO:
- SEMPRE no final da conversa
- Depois que resolver OU redirecionar
- Responda: "Avalie meu atendimento: ⭐⭐⭐⭐⭐"
- Só uma vez por conversa

COBERTURA:
- Atendemos SOMENTE Porto Alegre e região metropolitana
- Outra cidade: "Poxa, a gente só tá em POA e região 😊"

TONS CORRETOS:
- Conversacional (como estamos falando agora)
- Simpático mas profissional
- Curto e direto
- Com emojis (mas não exagera)

TONS INCORRETOS:
- Robótico: "PROCESSANDO INFORMAÇÃO"
- Muito formal: "Prezado cliente..."
- Muito genérico: "Ok, entendi"
- Muito longo: mais de 3 frases sem necessidade`;

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
                temperature: 0.3, // Reduzido para mais consistência
                max_tokens: 400, // Aumentado para conversas mais longas
                top_p: 0.9,
                frequency_penalty: 0.6, // Maior penalidade de repetição
                presence_penalty: 0.4 // Maior incentivo de variedade
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

        if (modelIndex < MODELS.length - 1) {
            console.log(`🔄 Tentando fallback para ${MODELS[modelIndex + 1]}...`);
            return callGroq(messages, modelIndex + 1);
        }

        throw new Error(`Todos os modelos falharam. Último erro: ${error.message}`);
    }
}

// 📊 Salvar avaliação no Google Sheets
async function salvarAvaliacao(estrelas, conversaResumo, tipo) {
    try {
        // Aqui você pode integrar com Google Sheets API ou fazer um POST pra outro serviço
        console.log(`📊 Avaliação recebida: ${estrelas}⭐ - Tipo: ${tipo}`);
        console.log(`Resumo: ${conversaResumo}`);
        
        // TODO: Implementar integração com Google Sheets
        // Por enquanto, só loga no console
        
        return true;
    } catch (error) {
        console.error("Erro ao salvar avaliação:", error.message);
        return false;
    }
}

// 🚀 Rota principal do chat
app.post('/chat', async (req, res) => {
    try {
        const { conversationHistory, avaliacaoEstrelas, tipoAtendimento } = req.body;
        
        console.log(`\n📨 Nova mensagem recebida`);
        console.log(`Histórico: ${conversationHistory.length} mensagens`);
        
        // Se receber avaliação, salva
        if (avaliacaoEstrelas) {
            console.log(`⭐ Cliente avaliou: ${avaliacaoEstrelas} estrelas`);
            const resumo = conversationHistory.map(m => m.content).join(" | ");
            await salvarAvaliacao(avaliacaoEstrelas, resumo, tipoAtendimento);
            
            return res.json({ 
                response: "Obrigado pela avaliação! Seus comentários nos ajudam a melhorar 😊",
                salvo: true
            });
        }
        
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
        
        // Pegar últimas 12 mensagens para contexto melhor
        const history = conversationHistory.slice(-12);
        
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

        console.log(`✅ Resposta enviada com sucesso\n`);
        res.json({ response: reply });

    } catch (error) {
        console.error(`\n🚨 ERRO NA ROTA /chat:`, error.message);
        console.error(error.stack);

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
