# ⚙️ API_BACKEND

API central desenvolvida em **Node.js + Express**, responsável por toda a lógica de gestão de produtos, stocks, encomendas, pagamentos e notificações.  
Serve de núcleo para os outros módulos do sistema — nomeadamente a **loja (Shop)** e o **painel administrativo (DatabaseUI)**.

---

## 🚀 Principais Funcionalidades
- **Gestão de Produtos:** criação, atualização e eliminação de produtos com controlo de stock em tempo real.  
- **Sistema de Encomendas:**  
  - Criação automática de encomendas quando o cliente faz checkout no **Shop**.  
  - Edição e atualização manual através do **DatabaseUI**.  
- **Pagamentos Online (Stripe):** integração total com **Stripe API**, incluindo produtos, preços e webhooks de confirmação de pagamento.  
- **Pagamentos Manuais (Wise):** suporte a transferências manuais via **Wise**, com atualização automática no **DatabaseUI** quando o pagamento é validado.  
- **Notificações e E-mails (Brevo):**  
  - Sistema de envio de e-mails automáticos através da plataforma **Brevo (Sendinblue)**.  
  - Envio de e-mail com fatura PDF após compra confirmada.  
  - Envio de código de envio **CTT** quando a encomenda é despachada.  
  - Gestão de subscrições e newsletters.  
- **Faturação Automática:** geração e envio de faturas PDF diretamente ao cliente.  
- **Seguimento de Encomendas:** integração com o código de tracking dos **CTT**.  

---

## 🧩 Integração com Outros Projetos
| Projeto | Função | Ligação com a API |
|----------|---------|-------------------|
| **Shop** | Interface pública de compras | Faz pedidos à API para listar produtos, criar encomendas e processar pagamentos |
| **DatabaseUI** | Painel administrativo | Controla produtos, stock, encomendas, pagamentos e atualizações manuais (Stripe e Wise) |

---

## 💻 Stack Técnica
- **Linguagem:** Node.js (ES Modules)
- **Framework:** Express  
- **Base de Dados:** PostgreSQL  
- **Pagamentos:** Stripe API + Wise (manual)  
- **Emails:** Brevo (Sendinblue API)  
- **Faturação:** PDFKit  
- **Testes:** Postman  
- **Ambiente:** Docker (local) / Render (produção)

---

api/ → Rotas e controladores (Orders, Products, Users)
services/ → Lógica de negócio e integração com Stripe, Brevo e Wise e brevo
middleware/ → Gestão de erros, CORS e autenticação
database/ → Queries e ligação PostgreSQL
stripe/ → Webhooks e funções Stripe
utils/ → Funções auxiliares (PDF, email, validações)

## 🧠 Estrutura do Projeto


---

## 🔄 Fluxo do Sistema
1. Cliente compra um produto no **Shop**.  
2. A API cria uma **encomenda** e comunica com o **Stripe** (ou aguarda pagamento manual via **Wise**).  
3. Quando o pagamento é confirmado, gera-se uma **fatura PDF** e envia-se por e-mail (via **Brevo**).  
4. Quando o produto é despachado, o sistema envia outro e-mail com o **código de tracking dos CTT**.  
5. Todos os estados são atualizados em tempo real no **DatabaseUI**.

---

## 🧩 Próximas Melhorias
- Dashboard de estatísticas (vendas, clientes, entregas)  
- Gestão avançada de subscrições e campanhas de e-mail  
- Autenticação JWT para acesso ao painel de administração  
- Sistema de cache e otimização de queries

---

## 📦 Deploy
- **Backend:** Render.com  
- **Frontend (Shop):** Vercel  
- **Painel (DatabaseUI):** Vercel  
- **Emails:** Brevo (API integrada)

---

## 🧰 Resumo
> O **API_BACKEND** funciona como o motor principal de um sistema modular de e-commerce.  
> Gere produtos, encomendas e pagamentos, automatiza e-mails via Brevo,  
> emite faturas PDF e integra com **Stripe**, **Wise** e **CTT**.  
> Totalmente escalável e conectado ao frontend **Shop** e ao painel **DatabaseUI**.




