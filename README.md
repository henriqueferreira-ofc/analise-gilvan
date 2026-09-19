# Mapa das Igrejas · ADEB

Painel organizado em Vite e JavaScript, com apresentação e três cartões na página inicial, e uma página separada para todos os dados (`dados.html`).

## Executar

Use Node.js 22.12+ (ou uma versão mais recente compatível).

```sh
npm install
npm run dev
```

Abra o endereço mostrado pelo terminal. O `index.html` deve ser servido pelo Vite durante o desenvolvimento.

## Comandos

- `npm run dev`: inicia o desenvolvimento.
- `npm run lint`: verifica o JavaScript.
- `npm run build`: gera o site em `dist/`.
- `npm run preview`: serve o build para conferência.
- `npm run build:docs`: gera o site em `docs/`, com `.nojekyll`, para publicação via GitHub Pages.

## Estrutura

```text
src/
  main.js             # navegação, integração e gráficos
  styles.css          # aparência responsiva
public/
  favicon.svg
  .nojekyll
index.html            # estrutura das páginas
package.json
package-lock.json
vite.config.js
eslint.config.js
dist/                 # gerado pelo build
docs/                 # gerado por build:docs
node_modules/         # dependências instaladas
mapa-igrejas.html     # versão HTML anterior preservada
```

Edite os arquivos de origem e execute o build novamente para atualizar `dist/` e `docs/`.
Os dois diretórios contêm saídas geradas; não edite seus arquivos diretamente.

## Dados e movimento

O painel abre com dados agregados de `public/dados-painel.json`, importados da planilha. Nenhum nome, telefone ou endereço dos participantes é incluído no arquivo do site.

A contagem usa uma unidade por aba de respostas (cidades/setores), não uma contagem validada de congregações individuais. “Com dados” significa ao menos uma resposta com carimbo de data/hora. Cadastros são respostas, sem deduplicação de pessoas. Respostas contraditórias de sim/não não entram nesses gráficos.

Para atualizar a cópia local com uma nova exportação XLSX:

```sh
python3 scripts/importar-planilha.py /caminho/planilha.xlsx
npm run build
```

A interface verifica a fonte a cada 5 segundos, ao retornar à janela e quando a rede volta. Uma nova aba de respostas, mesmo vazia, aparece na leitura seguinte; novos cadastros atualizam os totais e gráficos sem recarregar a página. Gráficos só são redesenhados quando o conteúdo muda.

O servidor local (`server/painel.mjs`) consulta um Apps Script autorizado na conta do responsável. A configuração fica em `.env.local`, com `PAINEL_APPS_SCRIPT_URL` e `PAINEL_SYNC_KEY`. A chave não é exposta no frontend. Siga [Ativar a conexão](integracao/ATIVAR.md). Sem configuração, o servidor informa que a leitura é da cópia importada; não simula uma conexão ao vivo. Falhas preservam os dados visíveis, exibem erro e disparam uma nova tentativa após 5 segundos. Várias páginas compartilham uma única consulta em voo e um cache de até 5 segundos.

`npm run dev` e `npm run preview` incluem esse servidor. Um site somente estático usa a cópia JSON e precisa de um backend separado para atualização contínua. `VITE_DASHBOARD_DATA_URL` permite apontar para um endpoint agregado compatível (campos `live` e `checkedAt` indicam o estado da fonte). O intervalo de 5 segundos é uma frequência de consulta; o Google pode levar mais tempo para disponibilizar uma alteração.

Verificação: `node --test tests/sync.test.mjs`, `npm run lint`, `npm run build`.

O movimento inclui ilustração flutuante, contadores animados, destaque das unidades na lista. O botão “Abrir Dashboards” abre `dados.html`; os três cartões abrem a seção correspondente nessa página. O link “Início” retorna à apresentação. A preferência do sistema por movimento reduzido é respeitada.

Nenhum site foi publicado automaticamente. `mapa-igrejas.html` é a versão antiga preservada; use o projeto Vite para ver as alterações.
