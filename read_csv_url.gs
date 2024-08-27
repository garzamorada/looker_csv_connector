var cc = DataStudioApp.createCommunityConnector();

function isAdminUser() { return true }

function sendUserError(message) {
  var cc = DataStudioApp.createCommunityConnector();
  cc.newUserError()
    .setText(message)
    .throwException();
}

function getAuthType() {
  var AuthTypes = cc.AuthType;
  return cc
    .newAuthTypeResponse()
    .setAuthType(AuthTypes.NONE)
    .build();
}

/**
* Configuracion
*/
function getConfig(request) {
  var config = cc.getConfig();
  
  config.newInfo()
    .setId('Instrucciones')
    .setText('Ingresar la url y el tipo de separador del archivo a conectar -2');
  
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
  

  config.newSelectSingle()
  .setId('quotes')
  .setName('Campos de texto encerrados por comillas?')
  .addOption(
    config
      .newOptionBuilder()
      .setLabel('SI')
      .setValue('true')
    )
  .addOption(
    config
      .newOptionBuilder()
      .setLabel('NO')
      .setValue('false')
    );

  config.newSelectSingle()
  .setId('headers')
  .setName('Los datos contienen los nombres de las columnas?')
  .addOption(
    config
      .newOptionBuilder()
      .setLabel('SI')
      .setValue('true')
    )
  .addOption(
    config
      .newOptionBuilder()
      .setLabel('NO')
      .setValue('false')
    );

  config.setDateRangeRequired(true);
  
  return config.build();
}


/**
* Busca el econtenido
*/
function fetchData(url) {
  if (!url || !url.match(/^https?:\/\/.+$/g)) {
    sendUserError('"' + url + '" no es una url valida.');
  }
  var response = UrlFetchApp.fetch(url);
  var content = response.getContentText();
  if (!content) {
    sendUserError('"' + url + '" no retorna contenido.');
  }
  return content;
}

/**
* Determina el tipo de columna
* retora un diccionario con el nombre de la columna y tres tipos posibles, fecha, texto o numero
*/
function determinarTipos(datos) {
    try {
        // solo reconoce feca en formato YYYY MM DD
        const regexFecha = /^(?:\d{4}[-\/]\d{2}[-\/]\d{2})$/;
        const regexNumero = /^-?\d+(\.\d+)?$/;

        var tipos = {}

        for (var clave in datos) {
            var valor = datos[clave];

            if (regexFecha.test(valor)) {
                tipos[clave] = 'fecha';
            } else if (regexNumero.test(valor)) {
                tipos[clave] = 'número';
            } else {
                tipos[clave] = 'texto';
            }
        }

        return tipos;
    } catch (error) {
        sendUserError("Error en determinarTipos: " + error.message);
    }
}


/**
* Convierte el texto en un array multidimensional
*/
function parseCsv(data, separator, quotes) {
    // Detectar el tipo de salto de línea
    var salto = "\n"; // Por defecto, suponemos \n
    if (data.indexOf("\r\n") >= 0) {
        salto = "\r\n";
    } else if (data.indexOf("\r") >= 0) {
        salto = "\r";
    }
    var textQualifier = '"';
    var separador = '|'
    var valueSeparator = separator
    var haveQuotes = quotes

    //remplazo los separadores por pipe ya que es mas eficiente
    if (haveQuotes == 'true') {
        var valueSeparator1 = textQualifier + valueSeparator + textQualifier;
        var valueSeparator2 = textQualifier + valueSeparator;
        var valueSeparator3 = valueSeparator + textQualifier;
        var regex1 = new RegExp(valueSeparator1, 'g');
        var regex2 = new RegExp(valueSeparator2, 'g');
        var regex3 = new RegExp(valueSeparator3, 'g');
        var regex4 = new RegExp(textQualifier, 'g');
        data=data.replace(regex1,'|')
        data=data.replace(regex2,'|')
        data=data.replace(regex3,'|')
        data=data.replace(regex4,'')
    } else {
      var regex1 = new RegExp(valueSeparator, 'g');
      data=data.replace(regex1,'|')
    }

    // Separar las filas por el salto de línea detectado
    var filas = data.split(salto);

    // Eliminar filas vacías
    filas = filas.filter(function(fila) {
        return fila.trim().length > 1;
    });

    // Separar las columnas por el separador pasado
    const result = filas.map(function(fila) {
        return fila.split(separador);
    });

    return result;
}


/**
* Convierte el CSV en diccionarios para los datos y para las columnas
* retorna un vector con los 2 diccionarios
*/
function csv_to_dict(request, content) {
    try {
        var containsHeader = request.configParams.headers;
        var sepatator = request.configParams.sepatator;
        var quotes = request.configParams.quotes;

        try {
          var dataArray = parseCsv(content, sepatator, quotes);
        } 
        catch (error) {
          sendUserError("Error llamando a parseCsv: " + error.message);
        }

        var headers = [];
        if (containsHeader == 'true') {
            headers = dataArray.shift();
        } else {
            var firstLineContent = dataArray[0];
            for (var i = 0; i < firstLineContent.length; i++) {
                headers[i] = "columna_" + i.toString().padStart(3, "0");
            }
        }

        for (var i = 0; i < headers.length; i++) {
            headers[i] = headers[i].replace(/\s/g, '_').toLowerCase();
        }

        var dataDictionary = [];
        for (var i = 0; i < dataArray.length; i++) {
            var row = dataArray[i];
            var dataRow = {};
            if (dataArray[i].length != headers.length) {
                sendUserError("El número de celdas ("+dataArray[i].length+") no coincide con el número de columnas ("+headers.length+") para la fila " + i);
            }
            for (var j = 0; j < headers.length; j++) {
                dataRow[headers[j]] = row[j];
            }
              dataRow['cantidad'] = 1
            dataDictionary.push(dataRow);
        }

        var columnTypes = determinarTipos(dataDictionary[0]);
        var data = dataDictionary;

        return [data, columnTypes];
    } catch (error) {
        sendUserError("Error en csv_to_dict: " + error.message);
    }
}

/**
* Obtiene las columnas
* genera los objetos field desde el array con los los nombres y tipos de columnas
* retorna una lista de objetos tipo fields
*/
function getFields(columnTypes) {
    try {
        var communityConnector = DataStudioApp.createCommunityConnector();
        var fields = communityConnector.getFields();
        var types = communityConnector.FieldType;
        var aggregations = communityConnector.AggregationType;

        for (var clave in columnTypes) {
            var field;
            if (columnTypes[clave] == 'fecha') {
                field = fields.newDimension().setType(types.YEAR_MONTH_DAY);
            } else if (columnTypes[clave] == 'número') {
                field = fields.newDimension().setType(types.NUMBER);
            } else {
                field = fields.newDimension().setType(types.TEXT);
            }
            field.setName(clave);
            field.setId(clave);
        }

      field = fields.newMetric()
      .setId('cantidad')
      .setName('cantidad')
      .setType(types.NUMBER)
      .setAggregation(aggregations.COUNT);

        return fields;
    } catch (error) {
        sendUserError("Error en getFields: " + error.message);
    }
}

/**
* Obtiene el esquema de la tabla
*/
function getSchema(request) {
    try {
        var content = fetchData(request.configParams.url);
        var [data, columnTypes]  = csv_to_dict(request, content);
        var fields = getFields(columnTypes).build();

        return { schema: fields };
    } catch (error) {
        sendUserError("Error en getSchema: " + error.message);
    }
}


/**
 * Obtiene las columnas de una lista solicitada
 * Devuelve un array con diccionarios
 */

function getColumns(content, requestedFields) {
  try {
    var rowValues = [];
    content.forEach(function(fila) {
            var row = {};
            values = []
            requestedFields.asArray().forEach(function(field) {
                clave=field.getId();
                tipo=field.getType();
                valor=fila[clave]
                regex1= new RegExp('-','g');
                regex2= new RegExp('/','g');
                if (tipo == 'YEAR_MONTH_DAY') { valor = valor.replace(regex1,'').replace(regex2,'')}
                values.push(valor);
            });
            row = {'values':values}

            rowValues.push(row);
        });
      return rowValues;

  } catch (error) {
        sendUserError("Error en getColumns: " + error.message);
  }
}

/**
 * Retorna una tabla con las columnas solicitadas.
 */
function getData(request) {
  try {
    var content = fetchData(request.configParams.url);
    var [data, columnTypes] = csv_to_dict(request, content);
    
    var fields = getFields(columnTypes);
    var requestedFieldIds = request.fields.map(function(field) { return field.name;  });
    var requestedFields = fields.forIds(requestedFieldIds);
    var schema = requestedFields.build();
    var rows = getColumns(data, requestedFields);

    return {
      schema: schema,
      rows: rows
    };
  } catch (error) {
        sendUserError("Error en getData: " + error.message);
  }

}
