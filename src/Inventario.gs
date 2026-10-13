/**
 * MÓDULO DE INVENTARIO Y CONTROL MENSUAL
 */

// 1. Descontar stock
function descontarStockInsumos(items) {
  // Manejado en tiempo real por fórmula en Google Sheets.
  return;
}

// 2. Reponer stock
// Manejado automáticamente al actualizar o anular filas en Detalle_Pedidos.
function devolverStockInsumos(items) {
  return;
}

// 3. Ajustar diferencia de stock
// Manejado automáticamente al actualizar las cantidades en Detalle_Pedidos.
function ajustarDiferenciaStock(itemsViejos, itemsNuevos) {
  return;
}

// 4. CIERRE MENSUAL AUTOMÁTICO
// Guarda el consolidado en Historico_Mensual y reinicia la bodega para el nuevo ciclo
function ejecutarCierreMensual() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const shInsumos = ss.getSheetByName('Insumos');
  const shHist = ss.getSheetByName('Historico_Mensual');
  if (!shInsumos || !shHist) return;

  const lastRow = shInsumos.getLastRow();
  if (lastRow <= 1) return;

  const fechaActual = new Date();
  const nombresMeses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", 
                        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const mesNombre = nombresMeses[fechaActual.getMonth()];
  const anio = fechaActual.getFullYear();

  // Leemos de la columna A (1) a la L (12)
  const data = shInsumos.getRange(2, 1, lastRow - 1, 12).getValues();
  const filasHistorico = [];
  const nuevoStockInicial = [];
  const cerosCompras = [];

  data.forEach(r => {
    const id = r[0];               // Col A
    const nombre = r[1];           // Col B
    const cat = r[2];              // Col C
    const stockDisponible = Number(r[10]) || 0; // Col D (remanente real en bodega)
    const costoUnidad = Number(r[5]) || 0;     // Col F (costo por unidad de consumo)
    const pedidosMes = Number(r[9]) || 0;      // Col J (total despachado a oficinas)
    const gastoMes = Number(r[11]) || 0;       // Col L (total gasto en $)

    if (nombre && String(nombre).trim() !== "") {
      filasHistorico.push([
        anio,
        mesNombre,
        id,
        nombre,
        cat,
        costoUnidad,
        pedidosMes,
        gastoMes,
        fechaActual
      ]);

      // Para el mes siguiente: el remanente en bodega pasa a ser el Stock Inicial (Col G)
      nuevoStockInicial.push([stockDisponible]);
      cerosCompras.push([0]);
    }
  });

  // Guardar en Historico_Mensual
  if (filasHistorico.length > 0) {
    shHist.getRange(shHist.getLastRow() + 1, 1, filasHistorico.length, 9).setValues(filasHistorico);
  }

  // Reiniciar valores manuales en la hoja Insumos:
  // Col G (7: Stock Inicial) = Saldo remanente de bodega
  shInsumos.getRange(2, 7, nuevoStockInicial.length, 1).setValues(nuevoStockInicial);
  
  // Col H (8: Nueva Compra Cantidad) = 0
  shInsumos.getRange(2, 8, cerosCompras.length, 1).setValues(cerosCompras);

  // NOTA: No tocamos la columna J (Total Pedidos) porque es una fórmula matricial.
  // Para reiniciar los pedidos del mes, se archiva o limpia la pestaña Detalle_Pedidos.
}





