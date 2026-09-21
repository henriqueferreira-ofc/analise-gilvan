# Conexão online independente do computador

Produção: https://analise-gilvan.vercel.app/.
API: https://analise-gilvan.vercel.app/api/painel.
As variáveis privadas estão configuradas na Vercel. O build do GitHub Pages
usa `.env.pages` para consultar essa mesma API. Execute `npm run build:docs`
e publique `docs/` ao alterar a interface. Novas respostas da planilha não
precisam de novo build.

O GitHub Pages serve arquivos estáticos. O diretório `docs/` não executa o
servidor Vite nem lê `.env.local`. Reconstruir esse diretório apenas troca uma
cópia dos dados e não resolve atualização contínua.

O projeto inclui uma função compatível com Vercel em `api/painel.js`, que usa
o mesmo leitor do localhost. Ela consulta o Apps Script no servidor, mantém a
chave privada e retorna apenas os totais agregados do painel.

## Ativação

1. Importe este repositório na Vercel.
2. Configure `PAINEL_APPS_SCRIPT_URL` e `PAINEL_SYNC_KEY` nas variáveis privadas
   do ambiente de produção, com os valores já usados no `.env.local`.
   Não use o prefixo `VITE_` para essas duas variáveis.
3. Publique e confira `/api/painel`: deve retornar `live: true`, `checkedAt`
   recente e os totais da planilha.
4. Para manter a interface no GitHub Pages, gere seu build com
   `VITE_DASHBOARD_DATA_URL=https://SEU-PROJETO.vercel.app/api/painel npm run build:docs`
   e publique `docs/` no GitHub. Substitua pelo domínio real verificado.
   Se a interface também estiver na Vercel, ela usa `/api/painel` automaticamente.
5. Compare a página inicial e `dados.html` nas duas hospedagens. Ambas devem
   indicar **Fonte conectada** e apresentar a mesma contagem após a próxima leitura.

O navegador consulta a cada 5 segundos enquanto visível e ao voltar à janela.
O servidor online atende independentemente do computador local. O cache do
leitor dura até 5 segundos. A latência do Google e indisponibilidades externas
podem atrasar atualizações; não há garantia de simultaneidade ou disponibilidade
absoluta. Em falhas, a interface identifica a última leitura e tenta novamente.

Não publique apenas o novo `docs/` antes de configurar e verificar o endpoint:
a versão corrigida exige fonte online e não recorre ao JSON importado.

Validação local: `node --test tests/*.test.mjs`, `npm run lint`, `npm run build`.
