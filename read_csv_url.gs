var cc = DataStudioApp.createCommunityConnector();

function getAuthType() {
  var AuthTypes = cc.AuthType;
  return cc
    .newAuthTypeResponse()
    .setAuthType(AuthTypes.NONE)
    .build();
}

//Configuracion

function getConfig(request) {
  var config = cc.getConfig();
  
  config.newInfo()
    .setId('Instrucciiones')
    .setText('Ingresar la url y el tipo de separador del archivo a conectar');
  
  config.newTextInput()
    .setId('url')
    .setName('Dirección URL')
    .setHelpText('e.g. https://misitio.com/mi-csv/')
    .setPlaceholder('https://...');

  config.newSelectSingle()
  .setId('sepatator')
  .setName('Separador')
  .setHelpText('e.g. ";" - "," - "|"')
  .addOption(
    config
      .newOptionBuilder()
      .setLabel('puntoycoma')
      .setValue(';')
    )
  .addOption(
    config
      .newOptionBuilder()
      .setLabel('coma')
      .setValue(',')
    )
  .addOption(
    config
      .newOptionBuilder()
      .setLabel('pipe')
      .setValue('|')
    )
  .addOption(
    config
      .newOptionBuilder()
      .setLabel('tabulador')
      .setValue('\t')
    );
  

  config.newCheckbox()
  .setId('quotes')
  .setName('Campos de texto encerrados por comillas?');

  config.newCheckbox()
  .setId('headers')
  .setName('Los datos contienen los nombres de las columnas?');

  config.setDateRangeRequired(true);
  
  return config.build();
}


//Busca el econtenido
function fetchData(url) {
  if (!url || !url.match(/^https?:\/\/.+$/g)) {
    sendUserError('"' + url + '" no es una url valida.');
  }
  var response = UrlFetchApp.fetch(url);
  var content = response.getContentText();
  if (!content) {
    sendUserError('"' + url + '" no retorno contenido.');
  }
  return content;
}

//Separador de linea de acuerdo al S.O.
function findLineSeparator(content) {
  if (!content) {
    return undefined;
  }
  if (content.indexOf('\r\n') >= 0) {
    // Windows
    return '\r\n';
  } else if (content.indexOf('\r') >= 0) {
    // MacOS
    return '\r';
  } else if (content.indexOf('\n') >= 0) {
    // Linux / OSX
    return '\n';
  } else {
    return undefined;
  }
}

//Obtiene las columnas
function getFields(request, content) {
  var communityConnector = DataStudioApp.createCommunityConnector();
  var fields = communityConnector.getFields();
  var types = communityConnector.FieldType;
  var textQualifier = request.configParams.quotes;
  var containsHeader = request.configParams.headers;
  
  var valueSeparator = request.configParams.sepatator;
  var haveQuotes = request.configParams.quotes;

  // Si es verdadero agrego las comillas al separador
  if (haveQuotes == true) { 
    var textQualifier = '"';
    valueSeparator = textQualifier + valueSeparator + textQualifier;
   }
  
  var lineSeparator = findLineSeparator(content);
  var firstLineContent;

  if (lineSeparator) {
    firstLineContent = content.substring(0, content.indexOf(lineSeparator));
  } else {
    firstLineContent = content;
  }
  
  firstLineContent = firstLineContent.substring(
      1,
      firstLineContent.length - 1
    );
  
  var firstLineColumns = firstLineContent.split(valueSeparator);

  var i = 1;
  firstLineColumns.forEach(function(value) {
    var field = fields.newDimension().setType(types.TEXT);
    
    // si tiene encabezado defino los nombre de columnas
    if (containsHeader === 'true') {
      // Si tiene espacios los remplazo por _
      field.setId(value.replace(/\s/g, '_').toLowerCase());
      field.setName(value);
    } else {
      field.setId('column_' + i);
      i++;
    }
  });

  return fields;
}

// obtiene la estructura
function getSchema(request) {
  var content = fetchData(request.configParams.url);
  var fields = getFields(request, content).build();
  return {schema: fields};
}

//Obtiene los datos
function getData(request) {
  var content = fetchData(request.configParams.url);
  var requestedFieldIds = request.fields.map(function(field) {
    return field.name;
  });
  var fields = getFields(request, content);
  var requestedFields = fields.forIds(requestedFieldIds);
  var buildedFields = fields.build();

  var requestedFieldsIndex = buildedFields.reduce(function(
    filtered,
    field,
    index
  ) {
    if (requestedFieldIds.indexOf(field.name) >= 0) {
      filtered.push(index);
    }
    return filtered;
  },
  []);


  var containsHeader = request.configParams.headers;
  
  var delimiter = request.configParams.sepatator;
  var haveQuotes = request.configParams.quotes;

  // Si es verdadero agrego las comillas al separador
  if (haveQuotes == true) { 
    var textQualifier = '"';
    delimiter = textQualifier + delimiter + textQualifier;
   }
  
  var lineSeparator = findLineSeparator(content);
  var valueSeparator = delimiter;
  var contentRows;

  if (lineSeparator) {
    contentRows = content.split(lineSeparator);
  } else {
    contentRows = [content];
  }

  var rows = contentRows
    .filter(function(contentRow) {
      // Borra las filas vacias.
      return contentRow.trim() !== '';
    })
    .map(function(contentRow, idx) {
      if (haveQuotes == true) {
        contentRow = contentRow.substring(1, contentRow.length - 1);
      }
      var allValues = contentRow.split(valueSeparator);
      if (buildedFields.length !== allValues.length) {
        sendUserError(
          'Error parsing content. Row: ' +
            idx +
            ' has ' +
            allValues.length +
            ' field(s), but ' +
            buildedFields.length +
            ' field(s) were expected.'
        );
      }
      var requestedValues = allValues.filter(function(value, index) {
        return requestedFieldsIndex.indexOf(index) >= 0;
      });
      return {values: requestedValues};
    });
  if (containsHeader === 'true') {
    rows = rows.slice(1);
  }

  var result = {
    schema: requestedFields.build(),
    rows: rows
  };

  return result;
}
