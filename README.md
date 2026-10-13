# LibOf - Sistema de Control de Inventario, Trazabilidad y Auditoria de Activos

LibOf es una solucion web diseñada para la gestion operativa, control estricto de existencias y trazabilidad integral del flujo de insumos y recursos institucionales.

La plataforma resuelve el descalce entre la recepcion de insumos por empaque mayorista y la imputacion de consumo por unidad, implementando una arquitectura transaccional desacoplada que asegura la integridad del inventario fisico, previene inconsistencias presupuestarias y genera registros historicos inmutables para fiscalizacion interna y reporteria directiva.

---

## Enfoque de Seguridad e Integridad Operativa

- Trazabilidad de Movimientos: Cada requerimiento genera una transaccion atomica con marca temporal, funcionario solicitante, departamento y desglose unitario.
- Verificacion y Control de Despacho: Modulo administrativo protegido por clave de autenticacion (PIN) para revision, modificacion de cantidades segun stock real y autorizacion de entrega.
- Inmutabilidad y Prevencion de Alteraciones: Mecanismo de anulacion y devolucion de material que neutraliza saldos sin eliminacion destructiva de registros en la base de datos.
- Desacople de Valorizacion: Registro diferenciado entre costo de adquisicion por empaque y costo de imputacion por pieza fijado por administracion, evitando distorsiones contables.
- Auditoria Periodica Automatizada: Procedimiento de consolidacion mensual y cierre anual con generacion automatica de respaldos de seguridad en la nube previa depuracion de tablas operativas.

---

## Stack Tecnologico

- Interfaz de Usuario: HTML5, CSS3 responsivo, JavaScript (ES6+).
- Backend y Logica Transaccional: Google Apps Script (entorno V8).
- Base de Datos y Motor de Calculo: Google Sheets estructurado con formulas matriciales (MAP, LAMBDA, SUMAR.SI).
- Modulo de Notificacion: Integracion con API de mensajeria instantanea para derivacion operativa directa al encargado de custodia.
- Inteligencia de Negocios (BI): Looker Studio para cuadros de mando, control de gasto acumulado y reporteria analitica.

---

## Arquitectura del Sistema

El flujo transaccional separa la captura de datos, la autorizacion y el almacenamiento analitico:

[ Solicitud de Insumos: Web App ]
|
v (Transaccion atomica)
[ Base de Datos: Detalle_Pedidos / Registro_Pedidos ]
|
+------+------------------------------+
v                                     v
[ Alerta de Gestion ]                 [ Motor de Inventario ]
[ Acceso Seguro con PIN ]             [ Calculo Matricial Kardex ]
|                                     |
+--------------+----------------------+
v
[ Script de Cierre Periodico ]
|
v
[ Historico_Mensual ]
|
v
[ Dashboards Analiticos ]

### Modelo de Datos y Capas de Informacion:
1. Insumos (Kardex Central): Control de catalogo, costo unitario por paquete, valor fijado de imputacion por unidad suelta, remanente fisico en bodega y gasto acumulado por articulo.
2. Registro_Pedidos (Cabecera): Registro consolidado por solicitud con identificador unico, fecha, solicitante, departamento, resumen de items y costo total estimado.
3. Detalle_Pedidos (Transacciones Operativas): Registro atomico por articulo solicitado. Constituye la fuente unica de verdad para el descuento de existencias en tiempo real.
4. Historico_Mensual (Capa Analitica): Repositorio inmutable generado al termino de cada ciclo mensual para alimentar cuadros de mando sin interferir con la operacion diaria.

---

## Funcionalidades Principales

- Modulo de Solicitud Institucional: Formulario con autodeteccion de unidad y dependencia segun funcionario, busqueda dinamica de insumos y especificacion de cantidades.
- Notificacion y Derivacion Inmediata: Generacion de comprobante digital con enlace parametrizado para la recepcion por parte del encargado de bodega.
- Gestion Administrativa y Devoluciones: Panel de ajuste para conciliar diferencias de stock y registrar retornos de material sin vulnerar la integridad referencial de las planillas.
- Automatizacion de Cierres de Gestion:
  - Cierre Mensual: Traspaso del saldo remanente al stock inicial del periodo entrante y congelamiento de consumos en la capa historica.
  - Cierre Anual: Generacion de copia de seguridad fechada en almacenamiento centralizado y reinicio de tablas operativas para el nuevo ejercicio.
- Monitoreo y Fiscalizacion: Visualizacion en Looker Studio de gasto por departamento, tendencias de consumo semestral y balance anual presupuestario.

---

## Estructura del Repositorio

|-- src/
|   |-- CierreMensual.gs     # Rutinas de cierre periódico, consolidación y respaldos
|   |-- codigoApp.gs         # Endpoints, lógica transaccional y validación de PIN
|   |-- Estilos.html         # Hojas de estilo y diseño responsivo
|   |-- Index.html           # Estructura base de la aplicación web
|   |-- Inventario.gs        # Motor de cálculo de existencias y kardex
|   |-- JsEncargado.html     # Lógica frontend de la consola administrativa
|   `-- JsUsuario.html       # Lógica frontend del flujo de solicitud
|-- .gitattributes
`-- README.md

