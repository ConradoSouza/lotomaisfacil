# Cron pontual dos avisos (Cloudflare Worker)

O cron do GitHub atrasa/pula (por isso um aviso chegou 01h da manhã). Este Worker roda no
cron confiável da Cloudflare e **dispara o robô do GitHub** logo após os sorteios, que então
busca o resultado e envia o push. Não reimplementa nada — só melhora a **pontualidade**.

## 1. Criar o token do GitHub (uma vez)
GitHub → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate**:
- **Repository access:** só o repositório `lotomaisfacil`.
- **Permissions → Actions:** **Read and write**.
- Gere e **copie o token** (começa com `github_pat_...`). ⚠️ É secreto.

## 2. Deploy do Worker

### Opção fácil — pelo painel da Cloudflare (sem instalar nada)
1. Cloudflare Dashboard → **Workers & Pages → Create → Worker** → dê o nome `lotomais-cron` → **Deploy**.
2. **Edit code** → apague o exemplo e cole o conteúdo de [`worker.js`](worker.js) → **Deploy**.
3. Aba **Settings → Variables and Secrets → Add** → tipo **Secret** → nome `GH_TOKEN` → cole o token → **Deploy**.
4. Aba **Settings → Triggers → Cron Triggers → Add Cron Trigger** e adicione estes (UTC):
   `15 23 * * *`, `45 23 * * *`, `30 0 * * *`, `30 1 * * *`, `0 3 * * *`, `0 12 * * *`.

### Opção via terminal (wrangler)
```bash
cd cron-worker
npx wrangler deploy
npx wrangler secret put GH_TOKEN   # cole o token quando pedir
```
(os horários já estão no `wrangler.toml`.)

## 3. Testar
No painel do Worker → **Triggers → “Trigger scheduled event”** (ou aguarde um horário).
Depois veja em **GitHub → Actions** se o workflow "Atualizar loterias" rodou por conta do disparo.

Pronto: a partir daí, quando sair um sorteio à noite, o robô roda no horário certo e o aviso
chega na mesma noite — sem depender do cron irregular do GitHub.
