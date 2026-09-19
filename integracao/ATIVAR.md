# Ativar a atualização da planilha

A preparação local está concluída. A ativação exige autorização da conta que acessa a planilha privada. Não é necessário tornar a planilha pública.

1. Abra [Formulário das Igrejas - ADEB](https://docs.google.com/spreadsheets/d/1mUPGlFavQwKwlpTVH4QuVLSqcgVFJvq6cOthSIOQ8mA/edit) e selecione **Extensões → Apps Script**.
2. Crie um arquivo de script chamado `Painel`. Cole o conteúdo de `integracao/Instalar-Painel.local.gs`. Preserve outros scripts que já existam. Se já houver funções `doGet` ou `doPost`, pare e avise para integrar sem sobrescrever o serviço existente.
3. Salve, selecione a função **autorizarPainel** e clique em **Executar**. Autorize a leitura da planilha na sua conta Google.
4. Clique em **Implantar → Nova implantação → Aplicativo da Web**. Executar como: **Eu**. Quem pode acessar: **Qualquer pessoa**. O endereço aceita conexões pela internet, mas só retorna os totais quando recebe a chave privada configurada no passo anterior. Nomes, telefones e endereços não são enviados ao painel. Não compartilhe o arquivo `Instalar-Painel.local.gs`, pois ele contém essa chave.
5. Copie a URL terminada em `/exec` e envie nesta conversa. O assistente pode concluir a configuração e verificar a conexão. Alternativamente, cole a URL em `PAINEL_APPS_SCRIPT_URL` no arquivo `.env.local` e reinicie `npm run dev`.

A confirmação de funcionamento é o selo **Fonte conectada**. O painel consulta em intervalos de 5 segundos, enquanto está visível, e ao voltar à janela. Uma alteração pode levar alguns segundos adicionais para ser disponibilizada pelo Google; não é uma garantia de atualização instantânea. Abas novas precisam ter o cabeçalho de respostas com “Carimbo de data/hora”, mesmo quando ainda não têm cadastros. Abas auxiliares não entram na contagem.

A chave fica no servidor local e nas propriedades do script; não fica no JavaScript entregue ao navegador. Uma publicação estática em GitHub Pages não executa esse servidor: para manter a atualização nela será necessário hospedar também a conexão, com acesso protegido. `npm run dev` e `npm run preview` já incluem a conexão local.

Documentação do Google: [Aplicativos da Web e autorização](https://developers.google.com/apps-script/guides/web).
