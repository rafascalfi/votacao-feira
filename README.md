# 🏆 Sistema de Votação Popular - Feira de Projetos & Inovação

Sistema completo para votação popular de feiras acadêmicas e técnicas, desenvolvido com **Node.js**, **Express**, **SQLite nativo** e interface responsiva com **Tailwind CSS**.

---

## 👥 Equipes Participantes Cadastradas

1. **#01 - Rainhas do Amazonas** (Sustentabilidade & Meio Ambiente)
2. **#02 - The Gag** (Criatividade & Entretenimento)
3. **#03 - Factory on the Island** (Indústria & Automação)
4. **#04 - AgroLock** (Agrotecnologia & Segurança)
5. **#05 - SafeLift** (Segurança & Engenharia)
6. **#06 - Linha Omega** (Eficiência & Produção)
7. **#07 - Virtual Restorage** (Tecnologia da Informação)
8. **#08 - Simulador Torno CNC** (Manufatura Digital & CNC)

---

## 🛡️ Validação Anti-Fraude (1 Voto por Dispositivo)

O sistema conta com um motor de **Digital de Hardware/Navegador (Device Fingerprint)** combinando:
- **Canvas & WebGL Fingerprint**: Renderização de formas geométricas, gradientes e parâmetros de GPU.
- **AudioContext Fingerprint**: Análise de dinâmica de oscilador e buffer de áudio.
- **Assinatura de Hardware**: Resolução de tela, núcleos de CPU, toque em tela e memória do dispositivo.
- **Token Local Persistente & Cookie**: Prevenção instantânea de votos repetidos.
- **Proteção contra Aba Anônima**: Mesmo abrindo em janela privativa ou limpando cookies, o hardware do aparelho é identificado e bloqueia votos duplicados.
- **Compatível com o mesmo Wi-Fi**: Não bloqueia por IP coletivo, permitindo que centenas de visitantes conectados na mesma rede Wi-Fi da feira votem individualmente em seus próprios aparelhos.

---

## 🚀 Como Executar Localmente

No terminal, dentro da pasta do projeto:

```bash
# Iniciar o servidor
npm start
```

- **Página de Votação (Público):** [http://localhost:3000](http://localhost:3000)
- **Painel Administrativo (Organização):** [http://localhost:3000/admin](http://localhost:3000/admin)
- **Senha/PIN Padrão do Administrador:** `feira2024` *(pode ser alterada diretamente no painel)*

---

## 🌐 Como Colocar Online

### Opção 1: Instantâneo pelo Computador (Sem criar contas)
Para gerar um link público HTTPS imediato enquanto o sistema roda no seu computador:

```bash
npx localtunnel --port 3000
```
*O comando exibirá um link público seguro (ex: `https://feira-votacao.loca.lt`) que você pode abrir em qualquer celular 4G ou Wi-Fi.*

---

### Opção 2: Na Nuvem 24h Gratuita (Render.com)
1. Suba esta pasta para um repositório no seu GitHub.
2. Acesse [render.com](https://render.com) e crie uma conta gratuita.
3. Clique em **New +** > **Web Service** e conecte seu repositório.
4. Preencha as configurações:
   - **Environment:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
5. Clique em **Create Web Service**. Pronto! O Render fornecerá um link público seguro HTTPS 24 horas no ar (ex: `https://votacao-feira.onrender.com`).

---

## 📊 Recursos do Painel Administrativo (`/admin`)

- **Apuração em Tempo Real:** Gráfico de barras com total de votos, porcentagens e ranking dinâmico atualizado a cada 5 segundos.
- **Pódio com Medalhas:** Destaque automático para 1º 🥇, 2º 🥈 e 3º 🥉 lugares.
- **Controle de Votação:** Botão de 1 clique para pausar ou reabrir a votação a qualquer momento.
- **Gerador de QR Code:** Gera o QR Code automático da URL atual.
- **Impressão de Cartazes Oficiais:** Botão "Imprimir Cartaz" que formata uma folha A4 com QR Code gigante para colar nos estandes e murais do evento.
- **Exportação Excel (CSV):** Baixa a lista completa de votos auditados para conferência.
- **Zerar Votos:** Opção com confirmação de segurança para limpar votos de teste antes de abrir para o público.
