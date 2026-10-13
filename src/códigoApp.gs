function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function doGet(e) {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('LibOf - Insumos')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function obtenerDatosIniciales() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Personal
  const shPersonal = ss.getSheetByName('Personal');
  let personal = [];
  if (shPersonal) {
    const lastRowPersonal = shPersonal.getLastRow();
    if (lastRowPersonal > 1) {
      const personalData = shPersonal.getRange(2, 1, lastRowPersonal - 1, 3).getValues();
      personal = personalData
        .filter(r => String(r[0]).trim() !== '')
        .map(r => ({
          nombre: String(r[0]).trim(),
          entidad: String(r[1]).trim(),
          departamento: String(r[2]).trim()
        }));
    }
  }

  // 2. Insumos
  const shInsumos = ss.getSheetByName('Insumos');
  let insumos = [];
  if (shInsumos) {
    const lastRowInsumos = shInsumos.getLastRow();
    if (lastRowInsumos > 1) {
      // Tomamos hasta la columna 6 (F: COSTO POR UNIDAD)
      const numCols = Math.max(shInsumos.getLastColumn(), 6);
      const insumosData = shInsumos.getRange(2, 1, lastRowInsumos - 1, numCols).getValues();
      
      insumos = insumosData
        .filter(r => String(r[1]).trim() !== '') // Muestra mientras tenga NOMBRE en Columna B
        .map(r => ({
          id: String(r[0]).trim(),
          nombre: String(r[1]).trim(),
          categoria: String(r[2]).trim(),
          precio: Number(r[5]) || 0 // Columna F: COSTO POR UNIDAD
        }));
    }
  }

  return { personal: personal, insumos: insumos };
}

function registrarPedido(datos) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Registro_Pedidos');
  const sheetDetalle = ss.getSheetByName('Detalle_Pedidos');
  const fecha = new Date();
  const pedidoId = 'PED-' + Date.now().toString().slice(-6);

  let totalEstimado = 0;
  const filasDetalle = [];

  const itemsGuardar = datos.items.map(it => {
    const subtotal = Number(it.cantidad) * Number(it.precioUnitario || 0);
    totalEstimado += subtotal;

    filasDetalle.push([
      pedidoId,
      fecha,
      datos.nombre,
      datos.entidad,
      datos.departamento,
      it.nombre,
      Number(it.cantidad),
      Number(it.precioUnitario || 0),
      subtotal,
      'Aprobado'
    ]);

    return {
      nombre: it.nombre,
      cantidad: it.cantidad,
      precioUnitario: it.precioUnitario
    };
  });

  let lineasTexto = itemsGuardar.map(it => `${it.cantidad}x ${it.nombre}`).join(' | ');
  if (datos.comentario) {
    lineasTexto += ` (Nota: ${datos.comentario})`;
  }

  const detalleCompleto = `${lineasTexto} [[JSON:${JSON.stringify({ items: itemsGuardar, comentario: datos.comentario || '' })}]]`;

  if (sheet) {
    sheet.appendRow([
      pedidoId,
      fecha,
      datos.nombre,
      datos.entidad,
      datos.departamento,
      detalleCompleto,
      totalEstimado
    ]);
  }

  if (sheetDetalle && filasDetalle.length > 0) {
    sheetDetalle.getRange(sheetDetalle.getLastRow() + 1, 1, filasDetalle.length, 10).setValues(filasDetalle);
  }

  descontarStockInsumos(itemsGuardar);

  return { 
    exito: true, 
    pedidoId: pedidoId,
    appUrl: ScriptApp.getService().getUrl()
  };
}

function obtenerDetallePedido(pedidoId, pinIngresado) {
  const PIN_CORRECTO = '1234';
  if (pinIngresado !== PIN_CORRECTO) {
    return { error: 'PIN incorrecto' };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Registro_Pedidos');
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { error: 'No hay pedidos registrados' };

  const data = sheet.getRange(2, 1, lastRow - 1, 7).getValues();

  for (let i = 0; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(pedidoId).trim()) {
      const detalleRaw = String(data[i][5]);
      let items = [];
      let comentario = '';

      const match = detalleRaw.match(/\[\[JSON:(.*?)\]\]/);
      if (match && match[1]) {
        try {
          const parsed = JSON.parse(match[1]);
          items = parsed.items || [];
          comentario = parsed.comentario || '';
        } catch(e) {}
      } else {
        const partes = detalleRaw.split('|');
        items = partes.map(p => {
          const limpio = p.trim().replace(/\(Nota:.*?\)/, '').trim();
          const matchCant = limpio.match(/^(\d+)x\s*(.*)$/);
          if (matchCant) {
            return {
              nombre: matchCant[2],
              cantidad: parseInt(matchCant[1]),
              precioUnitario: 0
            };
          }
          return { nombre: limpio, cantidad: 1, precioUnitario: 0 };
        });
      }

      return {
        fila: i + 2,
        pedidoId: data[i][0],
        solicitante: data[i][2],
        entidad: data[i][3],
        departamento: data[i][4],
        comentario: comentario,
        items: items
      };
    }
  }

  return { error: 'No se encontró el pedido.' };
}

function actualizarDetalleEncargado(fila, itemsActualizados, comentario, pinIngresado) {
  const PIN_CORRECTO = '1234';
  if (pinIngresado !== PIN_CORRECTO) {
    return { error: 'PIN incorrecto' };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Registro_Pedidos');
  const sheetDetalle = ss.getSheetByName('Detalle_Pedidos');

  const detallePrevio = String(sheet.getRange(fila, 6).getValue());
  const pedidoId = sheet.getRange(fila, 1).getValue();
  let itemsViejos = [];
  const match = detallePrevio.match(/\[\[JSON:(.*?)\]\]/);
  if (match && match[1]) {
    try {
      const parsed = JSON.parse(match[1]);
      itemsViejos = parsed.items || [];
    } catch(e) {}
  }

  const itemsFinales = itemsActualizados.filter(it => it.cantidad > 0);

  let totalEstimado = 0;
  itemsFinales.forEach(it => {
    totalEstimado += it.cantidad * (it.precioUnitario || 0);
  });

  let lineasTexto = itemsFinales.map(it => `${it.cantidad}x ${it.nombre}`).join(' | ');
  if (comentario) {
    lineasTexto += ` (Nota: ${comentario})`;
  }

  const detalleCompleto = `${lineasTexto} [[JSON:${JSON.stringify({ items: itemsFinales, comentario: comentario || '' })}]]`;

  sheet.getRange(fila, 6).setValue(detalleCompleto);
  sheet.getRange(fila, 7).setValue(totalEstimado);

  if (sheetDetalle) {
    const lastRowD = sheetDetalle.getLastRow();
    if (lastRowD > 1) {
      const dataDetalle = sheetDetalle.getRange(2, 1, lastRowD - 1, 9).getValues();
      for (let i = 0; i < dataDetalle.length; i++) {
        if (String(dataDetalle[i][0]).trim() === String(pedidoId).trim()) {
          const nombreInsumo = String(dataDetalle[i][5]).trim().toLowerCase();
          const itemNuevo = itemsFinales.find(it => String(it.nombre).trim().toLowerCase() === nombreInsumo);
          
          if (itemNuevo) {
            sheetDetalle.getRange(i + 2, 7).setValue(itemNuevo.cantidad);
            sheetDetalle.getRange(i + 2, 9).setValue(itemNuevo.cantidad * Number(dataDetalle[i][7] || 0));
          } else {
            sheetDetalle.getRange(i + 2, 7).setValue(0);
            sheetDetalle.getRange(i + 2, 9).setValue(0);
            sheetDetalle.getRange(i + 2, 10).setValue('Cancelado');
          }
        }
      }
    }
  }

  ajustarDiferenciaStock(itemsViejos, itemsFinales);

  return { exito: true };
}

function anularPedidoEncargado(fila, pedidoId, solicitante, motivo, pinIngresado) {
  const PIN_CORRECTO = '0000';
  if (pinIngresado !== PIN_CORRECTO) {
    return { error: 'PIN incorrecto' };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Registro_Pedidos');
  const sheetDetalle = ss.getSheetByName('Detalle_Pedidos');

  const detallePrevio = String(sheet.getRange(fila, 6).getValue());

  let detalleAnulado = `PEDIDO CANCELADO`;
  if (motivo && motivo.trim() !== '') {
    detalleAnulado += ` (Motivo: ${motivo.trim()})`;
  }

  sheet.getRange(fila, 6).setValue(detalleAnulado);
  sheet.getRange(fila, 7).setValue(0);

  if (sheetDetalle) {
    const lastRowD = sheetDetalle.getLastRow();
    if (lastRowD > 1) {
      const dataIds = sheetDetalle.getRange(2, 1, lastRowD - 1, 1).getValues();
      for (let i = 0; i < dataIds.length; i++) {
        if (String(dataIds[i][0]).trim() === String(pedidoId).trim()) {
          sheetDetalle.getRange(i + 2, 10).setValue('Cancelado');
        }
      }
    }
  }

  const match = detallePrevio.match(/\[\[JSON:(.*?)\]\]/);
  if (match && match[1]) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed.items) {
        devolverStockInsumos(parsed.items);
      }
    } catch(e) {}
  }

  return { exito: true };
}


























