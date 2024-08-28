# looker_csv_connector
Conector csv para Looker Studio

Basado en https://github.com/googledatastudio/community-connectors/blob/master/fetch-csv Author: diminishedprime Matt Hamrick

El anterior presentaba un problema al ya que ordenaba las columnas alfabeticamente y al obtener los datos los hacia en columnas equivocadas. Para solucionarlo en vez de trabajar con arreglos trabaja con arreglos de diccionarios asi selecciona la clave que corresponde.

## Cosas para mejorar:

- Solo detecta y acepta fechas con formato YYYY-MM-DD o YYYT/MM/DD ya que el formato de fecha de loker es YYYYMMDD (sin separador), habria que reconocer y transformar otros formatos de fecha. tambien se podrian incorporar formatos de fecha y hora.

- Solo esta pensado para numeracio en en_US. Se podria generar un script que detecte el formato latino y elimine los puntos y cambie comas por puntos.

- Tambien habria que contemplar los casos de comillas simples en lugar de dobles. Si alguien tiene ganas de meterle mano me chifla y le paso un poco de lo que aprendi haciendolo.



![alt text](https://github.com/garzamorada/looker_csv_connector/blob/main/connector.png?raw=true)
