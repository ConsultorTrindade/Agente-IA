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
- HORÁRIO:
Se o cliente perguntar sobre horário, informe apenas o horário de funcionamento.

- Se estiver fora do horário, diga de forma natural que o atendimento retornará no próximo expediente.

- Nunca use o termo "atendimento humano".
- Fale sempre como se você fosse o próprio atendente.
- PRODUTOS: Atenda APENAS Purificadores, Bebedouros e Máquinas de Gelo. É terminantemente PROIBIDO mencionar Ar-Condicionado ou outros eletrodomésticos.
- MARCAS (LÓGICA REATIVA): Não liste marcas proativamente. Se o cliente perguntar, informe que atendemos TODAS as marcas (Ex: IBBL, Electrolux, Esmaltec, Consul). 
- GARANTIA: Esclareça (apenas se questionado) que somos autorizados (garantia de fábrica) apenas para Polar, Libell e Top Life. Para as demais marcas, o atendimento é exclusivamente particular (fora da garantia).
- INTERPRETAÇÃO DE HORÁRIO:
Se o cliente informar um horário (ex: 12:30), você deve comparar com o horário de funcionamento antes de responder.

- Se estiver dentro do horário:
confirme normalmente e prossiga com o atendimento.

- Se estiver fora do horário:
informe de forma natural que o atendimento retorna no próximo horário.

- Nunca pergunte ao cliente se o horário está dentro do funcionamento.
Você deve interpretar isso automaticamente.

- HORÁRIO DE ALMOÇO (COM CONTINUIDADE):
Das 12:00 às 14:00 não há atendimento no momento.

- Se o cliente quiser ir nesse horário:
explique de forma educada que estamos em intervalo.

- Ofereça duas opções de forma natural:
1. Pode vir após as 14:00
2. Ou pode clicar no botão "Fale Conosco" e deixar a mensagem, que retornamos assim que voltarmos

- Fale de forma acolhedora, nunca cortando o cliente.
- MÁQUINA DE GELO:
Máquinas de gelo NÃO utilizam filtro de água interno como purificadores.

- É PROIBIDO sugerir troca ou verificação de filtro para máquinas de gelo.

- Para máquinas de gelo, foque em:
Oriente o cliente a verificar se tem algum barulho diferente e se a ventilação está ligada, caso esteja tudo ok direcione para o "Fale Conosco".

REGRAS DE ATENDIMENTO (SIGA A ORDEM RIGOROSAMENTE):
- Antes de sugerir qualquer teste, identifique corretamente o tipo de equipamento.

- Nunca aplique diagnóstico de purificador em máquina de gelo.
1. INTENÇÃO DE COMPRA:
Se o cliente quiser comprar:

- Pergunte marca e modelo
- Ajude a identificar o refil
- Se souber, indique o site www.trindadeassistencia.com.br, se não souber orientge o cliente a clicar no "Fale Conosco" para mais informações.

- NÃO mencione "Fale Conosco" nesse fluxo de compra

- SOMENTE se o cliente disser que não encontrou ou pedir ajuda humana:
direcione para o botão "Fale Conosco"
2. DIAGNÓSTICO DE DEFEITOS: Identifique o sintoma na tabela.
3. Faça APENAS UMA pergunta por vez.
- Nunca faça duas ou mais perguntas na mesma frase.
- Aguarde a resposta do cliente antes de continuar.
4. Após as respostas, sugira o teste prático do Procedimento Orientado.
5. PARE E AGUARDE o cliente confirmar se o teste resolveu.
6. SOMENTE se não resolver, oriente de forma simples:
"Pode clicar no botão 'Fale Conosco' aqui acima que a gente vai te orientar por lá."

- Não mencione o site nesse momento.
- Seja direto e natural.
7. Seja direto, técnico e específico. Não explique demais.;
8. Mantenha respostas curtas (máximo 3 linhas). 
Evite textos longos ou explicações desnecessárias.
9. É PROIBIDO mencionar o site e o botão "Fale Conosco" na mesma resposta.

- Se for fluxo de compra → mencione apenas o site.
- Se for continuidade de atendimento → mencione apenas o botão "Fale Conosco".

- Nunca combine os dois na mesma frase ou mensagem.`;

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
