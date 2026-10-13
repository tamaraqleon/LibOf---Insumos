/**
 * Menú principal en Google Sheets.
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Gestión Bodega')
    .addItem('Ejecutar Cierre Mensual', 'solicitarCierreMensual')
    .addSeparator()
    .addItem('Informe Mensual', 'abrirInformeMensual')
    .addItem('Informe Semestral', 'abrirInformeSemestral')
    .addItem('Informe Anual', 'abrirInformeAnual')
    .addSeparator()
    .addItem('Ejecutar Cierre Anual y Limpiar', 'solicitarCierreAnual')
    .addToUi();
}

/**
 * URLs de cada página en Looker Studio.
 */
const CONFIG_REPORTES = {
  urlMensual: 'https://datastudio.google.com/u/0/reporting/d0c0cadf-5113-4b51-8100-8670786136d1/page/91OAG/edit',
  urlSemestral: 'https://datastudio.google.com/u/0/reporting/d0c0cadf-5113-4b51-8100-8670786136d1/page/p_apjllyq37d/edit',
  urlAnual: 'https://datastudio.google.com/u/0/reporting/d0c0cadf-5113-4b51-8100-8670786136d1/page/p_xiuh1mr37d/edit'
};

function abrirInformeMensual() {
  mostrarDialogoEnlace(
    'Informe Mensual',
    'Abre el reporte mensual. Puedes cambiar el mes usando el selector de fecha superior antes de descargar el PDF.',
    CONFIG_REPORTES.urlMensual
  );
}

function abrirInformeSemestral() {
  mostrarDialogoEnlace(
    'Informe Semestral',
    'Abre el reporte consolidado de los últimos 6 meses listo para descargar en PDF.',
    CONFIG_REPORTES.urlSemestral
  );
}

function abrirInformeAnual() {
  mostrarDialogoEnlace(
    'Informe Anual',
    'Abre el balance anual acumulado listo para descargar en PDF.',
    CONFIG_REPORTES.urlAnual
  );
}

function mostrarDialogoEnlace(titulo, descripcion, url) {
  const html = HtmlService.createHtmlOutput(`
    <div style="font-family: Arial, sans-serif; padding: 15px; text-align: center;">
      <h3 style="color: #333333; margin-bottom: 10px;">${titulo}</h3>
      <p style="color: #666666; font-size: 13px; margin-bottom: 20px; line-height: 1.4;">
        ${descripcion}
      </p>
      <a href="${url}" target="_blank" 
         style="display: inline-block; background-color: #1a73e8; color: #ffffff; padding: 10px 18px; 
                border-radius: 4px; text-decoration: none; font-size: 13px; font-weight: bold;">
        Abrir Informe
      </a>
    </div>
  `)
  .setWidth(360)
  .setHeight(170);

  SpreadsheetApp.getUi().showModalDialog(html, titulo);
}

/**
 * Cierre Mensual: consolida pedidos aprobados en Historico_Mensual y renueva el inventario.
 */
function solicitarCierreMensual() {
  const ui = SpreadsheetApp.getUi();

  const respuesta = ui.alert(
    'Confirmación de Cierre Mensual',
    '¿Deseas ejecutar el cierre mensual ahora?\n\n' +
    'Esto consolidará los pedidos aprobados en el histórico y actualizará el inventario para el nuevo periodo.',
    ui.ButtonSet.YES_NO
  );

  if (respuesta !== ui.Button.YES) {
    ui.alert('Operación cancelada. No se realizaron cambios.');
    return;
  }

  const hoy = new Date();
  const periodoDefault = Utilities.formatDate(hoy, Session.getScriptTimeZone(), 'yyyy-MM');

  const promptPeriodo = ui.prompt(
    'Periodo a Consolidar',
    'Ingresa el periodo correspondiente (formato AAAA-MM):',
    ui.ButtonSet.OK_CANCEL
  );

  if (promptPeriodo.getSelectedButton() !== ui.Button.OK) {
    ui.alert('Operación cancelada.');
    return;
  }

  let periodoElegido = promptPeriodo.getResponseText().trim();
  if (!periodoElegido) {
    periodoElegido = periodoDefault;
  }

  const partes = periodoElegido.split('-');
  const anioElegido = partes[0] || '2026';
  const mesElegido = partes[1] || '01';

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const shDetalle = ss.getSheetByName('Detalle_Pedidos');
  const shHistorico = ss.getSheetByName('Historico_Mensual');
  const shInsumos = ss.getSheetByName('Insumos');

  if (!shDetalle || !shHistorico) {
    ui.alert('Error: Asegúrate de que existan las pestañas "Detalle_Pedidos" e "Historico_Mensual".');
    return;
  }

  const lastRow = shDetalle.getLastRow();
  if (lastRow <= 1) {
    ui.alert('Aviso: No hay registros en "Detalle_Pedidos" para consolidar.');
    return;
  }

  const datos = shDetalle.getRange(2, 1, lastRow - 1, 10).getValues();
  const resumen = {};

  datos.forEach(fila => {
    const fechaFila = fila[1];
    let periodoFila = '';

    if (fechaFila instanceof Date) {
      periodoFila = Utilities.formatDate(fechaFila, Session.getScriptTimeZone(), 'yyyy-MM');
    }

    const estado = String(fila[9]).trim().toLowerCase();

    if (periodoFila === periodoElegido && estado !== 'cancelado') {
      const departamento = String(fila[4]).trim() || 'General';
      const insumo = String(fila[5]).trim();
      const cantidad = Number(fila[6]) || 0;
      const subtotal = Number(fila[8]) || 0;

      const clave = `${departamento}|${insumo}`;

      if (!resumen[clave]) {
        resumen[clave] = {
          departamento: departamento,
          insumo: insumo,
          cantidad: 0,
          gasto: 0
        };
      }

      resumen[clave].cantidad += cantidad;
      resumen[clave].gasto += subtotal;
    }
  });

  const claves = Object.keys(resumen);
  if (claves.length === 0) {
    ui.alert(`Aviso: No se encontraron pedidos aprobados para el periodo "${periodoElegido}".`);
    return;
  }

  const filasParaHistorico = claves.map(k => [
    anioElegido,
    mesElegido,
    resumen[k].departamento,
    resumen[k].insumo,
    resumen[k].cantidad,
    resumen[k].gasto,
    new Date()
  ]);

  shHistorico.getRange(shHistorico.getLastRow() + 1, 1, filasParaHistorico.length, 7).setValues(filasParaHistorico);

  if (shInsumos) {
    const lastRowIns = shInsumos.getLastRow();
    if (lastRowIns > 1) {
      // Tomamos Columna K (11: TOTAL UNIDADES ACTUAL / Remanente real al cierre)
      const dataDisp = shInsumos.getRange(2, 11, lastRowIns - 1, 1).getValues();
      const cerosCompras = [];
      const nuevoInicial = [];

      dataDisp.forEach(r => {
        nuevoInicial.push([r[0]]); // El saldo remanente pasa a ser el Inicial
        cerosCompras.push([0]);     // Se resetean las compras nuevas
      });

      // Escribimos en Columna G (7: STOCK INICIAL)
      shInsumos.getRange(2, 7, nuevoInicial.length, 1).setValues(nuevoInicial);
      // Escribimos en Columna H (8: NUEVA COMPRA CANTIDAD)
      shInsumos.getRange(2, 8, cerosCompras.length, 1).setValues(cerosCompras);
    }
  }

  ui.alert(
    'Cierre Completado',
    `Se consolidaron ${filasParaHistorico.length} líneas resumen para ${periodoElegido}.\n` +
    'Los datos quedaron registrados en "Historico_Mensual" y la bodega renovada.',
    ui.ButtonSet.OK
  );
}

/**
 * Cierre Anual: crea respaldo en Drive y vacía Detalle_Pedidos y Registro_Pedidos.
 */
function solicitarCierreAnual() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const confirmacion1 = ui.alert(
    'ADVERTENCIA: Cierre Anual y Limpieza',
    'Esta operación realiza las siguientes acciones:\n\n' +
    '1. Crea una copia de respaldo completa de esta planilla en tu Google Drive.\n' +
    '2. Mantiene intacta la hoja "Historico_Mensual".\n' +
    '3. BORRA todos los pedidos de "Detalle_Pedidos" y "Registro_Pedidos" para iniciar el nuevo periodo.\n\n' +
    '¿Deseas continuar?',
    ui.ButtonSet.YES_NO
  );

  if (confirmacion1 !== ui.Button.YES) {
    ui.alert('Operación cancelada.');
    return;
  }

  const anioActual = new Date().getFullYear();
  const promptAnio = ui.prompt(
    'Confirmar Año de Cierre',
    `Indica el año que finaliza (por ejemplo: ${anioActual}):`,
    ui.ButtonSet.OK_CANCEL
  );

  if (promptAnio.getSelectedButton() !== ui.Button.OK) {
    ui.alert('Operación cancelada.');
    return;
  }

  const anioCierre = promptAnio.getResponseText().trim() || String(anioActual);

  try {
    const archivoActual = DriveApp.getFileById(ss.getId());
    const nombreRespaldo = `Respaldo_Bodega_${anioCierre}_(${Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmm')})`;
    
    const carpetasPadre = archivoActual.getParents();
    let archivoCopia;
    if (carpetasPadre.hasNext()) {
      const carpeta = carpetasPadre.next();
      archivoCopia = archivoActual.makeCopy(nombreRespaldo, carpeta);
    } else {
      archivoCopia = archivoActual.makeCopy(nombreRespaldo);
    }

    const shDetalle = ss.getSheetByName('Detalle_Pedidos');
    if (shDetalle) {
      const lastRowD = shDetalle.getLastRow();
      const lastColD = shDetalle.getLastColumn();
      if (lastRowD > 1) {
        shDetalle.getRange(2, 1, lastRowD - 1, lastColD).clearContent();
      }
    }

    const shRegistro = ss.getSheetByName('Registro_Pedidos');
    if (shRegistro) {
      const lastRowR = shRegistro.getLastRow();
      const lastColR = shRegistro.getLastColumn();
      if (lastRowR > 1) {
        shRegistro.getRange(2, 1, lastRowR - 1, lastColR).clearContent();
      }
    }

    ui.alert(
      'Cierre Anual Completado con Éxito',
      `Acciones realizadas:\n\n` +
      `- Copia guardada en Drive: "${nombreRespaldo}"\n` +
      `- Hojas "Detalle_Pedidos" y "Registro_Pedidos" vaciadas y listas para el nuevo periodo.\n` +
      `- "Historico_Mensual" se mantiene intacto.`,
      ui.ButtonSet.OK
    );

  } catch (error) {
    ui.alert(`Ocurrió un error durante el proceso: ${error.message}`);
  }
}

