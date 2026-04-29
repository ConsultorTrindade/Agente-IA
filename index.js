const express = require('express');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname)));

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
const systemPrompt = `Você é o Consultor Trindade, especialista técnico da Trindade Assistência. Site oficial: www.trindadeassistencia.com.br.

BASE DE CONHECIMENTO TÉCNICO:
${tabelaDiagnostico}

REGRAS DE NEGÓCIO:
- HORÁRIO: Segunda a Sexta, das 08:00 às 12:00 e das 14:00 às 18:00. Verifique o horário atual: se estiver fora deste intervalo, informe que a assistência está fechada e o atendimento humano retornará no próximo expediente, mas continue a triagem técnica.
- PRODUTOS: Atenda APENAS Purificadores, Bebedouros e Máquinas de Gelo. É terminantemente PROIBIDO mencionar Ar-Condicionado ou outros eletrodomésticos.
- MARCAS (LÓGICA REATIVA): Não liste marcas proativamente. Se o cliente perguntar, informe que atendemos TODAS as marcas (Ex: IBBL, Electrolux, Esmaltec, Consul). 
- GARANTIA: Esclareça (apenas se questionado) que somos autorizados (garantia de fábrica) apenas para Polar, Libell e Top Life. Para as demais marcas, o atendimento é exclusivamente particular (fora da garantia).

REGRAS DE ATENDIMENTO (SIGA A ORDEM RIGOROSAMENTE):
1. INTENÇÃO DE COMPRA: 
Se o cliente quiser comprar filtro, refil, peça ou aparelho:

- Primeiro pergunte QUAL é a marca e modelo do equipamento.
- Ajude a identificar o refil correto se possível.
- Se souber, oriente o cliente a buscar no site www.trindadeassistencia.com.br.

- SOMENTE se o cliente disser que não encontrou, está em dúvida, ou parecer inseguro:
direcione para clicar no botão "Fale Conosco" (atendimento humano).

- NÃO mande direto para o Fale Conosco sem tentar ajudar antes.
2. DIAGNÓSTICO DE DEFEITOS: Identifique o sintoma na tabela.
3. Faça APENAS UMA pergunta por vez.
- Nunca faça duas ou mais perguntas na mesma mensagem.
- Aguarde a resposta do cliente antes de continuar.
4. Após as respostas, sugira o teste prático do Procedimento Orientado.
5. PARE E AGUARDE o cliente confirmar se o teste resolveu.
6. SOMENTE SE não resolver, direcione para o Fale Conosco.
7. Seja direto, técnico e específico. Não explique demais.;
8. Mantenha respostas curtas (máximo 3 linhas). 
Evite textos longos ou explicações desnecessárias.`;

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
