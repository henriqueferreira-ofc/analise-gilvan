/** Cole no Apps Script vinculado à planilha. Retorna somente totais agregados. */
function doPost(e) {
  var properties = PropertiesService.getScriptProperties();
  var key = properties.getProperty('PAINEL_SYNC_KEY');
  var input;
  try { input = JSON.parse(e.postData.contents); } catch (err) { return jsonOutput({error: 'Acesso não autorizado'}); }
  if (!key || !input || input.key !== key) return jsonOutput({error: 'Acesso não autorizado'});
  try {
    var spreadsheet = SpreadsheetApp.openById('1mUPGlFavQwKwlpTVH4QuVLSqcgVFJvq6cOthSIOQ8mA');
    return jsonOutput(aggregateSheets(spreadsheet.getSheets().map(function(sheet) {
      return {name: sheet.getName(), rows: sheet.getDataRange().getDisplayValues()};
    })));
  } catch (err) { return jsonOutput({error: 'Não foi possível ler a planilha'}); }
}
function doGet() { return jsonOutput({error: 'Acesso não autorizado'}); }
function jsonOutput(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }
function normalizeText(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}
function aggregateSheets(sheets) {
  var result = { updatedAt: new Date().toISOString(), source: 'Formulário das Igrejas - ADEB', countingBasis: 'Uma unidade por aba de respostas da planilha (cidades/setores). Com dados: ao menos uma resposta com carimbo de data/hora.', churches: [], cargo: {}, departments: {}, politics: {}, evangelical: {} };
  function increment(group, label) { group[label] = (group[label] || 0) + 1; }
  sheets.forEach(function(sheet) {
    var headerRow = sheet.rows.findIndex(function(row) { return row.some(function(value) { return normalizeText(value).indexOf('carimbo') !== -1; }); });
    // Abas auxiliares não contam como unidades. Abas de respostas vazias contam.
    if (headerRow < 0) return;
    var headers = sheet.rows[headerRow].map(normalizeText);
    function index(keyword) { return headers.findIndex(function(value) { return value.indexOf(keyword) !== -1; }); }
    var timestamp = index('carimbo');
    var rows = sheet.rows.slice(headerRow + 1).filter(function(row) { return String(row[timestamp] || '').trim() !== ''; });
    result.churches.push({name: sheet.name.trim(), responses: rows.length});
    rows.forEach(function(row) {
      function get(keyword) { return normalizeText(row[index(keyword)]); }
      var cargo = get('cargo');
      if (cargo) increment(result.cargo, cargo.indexOf('pastor') !== -1 ? 'Pastor' : cargo.indexOf('obreiro') !== -1 ? 'Obreiro' : cargo.indexOf('membro') !== -1 ? 'Membro' : 'Outro');
      var dept = get('departamento');
      ['UFADEB', 'UMADEB', 'UNAADEB', 'UDVADEB'].forEach(function(name) { if (dept.indexOf(name.toLowerCase()) !== -1) increment(result.departments, name); });
      if (dept.indexOf('nenhum') !== -1 || dept === 'nao') increment(result.departments, 'Nenhum');
      [['politica', result.politics], ['evangelico', result.evangelical]].forEach(function(entry) {
        var value = get(entry[0]), yes = value.indexOf('sim') !== -1, no = value.indexOf('nao') !== -1;
        if (yes !== no) increment(entry[1], yes ? 'Sim' : 'Não');
      });
    });
  });
  if (!result.churches.length) throw new Error('Nenhuma aba de respostas reconhecida');
  return result;
}
