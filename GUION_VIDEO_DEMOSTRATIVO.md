# Guion del Video Demostrativo

## Sistema POS de Ventas

**Duración sugerida:** 15 a 20 minutos  
**Audiencia:** docente, cliente, equipo de evaluación o usuarios finales  
**Usuario recomendado para la demostración:** `admin@demo.com`  
**Contraseña:** `admin123`

> Antes de grabar, verifica que el frontend y el API estén ejecutándose y que existan productos, clientes y al menos una venta de prueba.

## 1. Introducción del proyecto

### Qué mostrar

- Pantalla inicial del sistema.
- Logo y nombre del negocio.
- Una vista general de la aplicación.

### Narración sugerida

"En este video presentaré un sistema integral de punto de venta, diseñado para administrar productos, clientes, inventario, ventas, cotizaciones, fidelización y reportes desde una sola plataforma."

"El sistema permite registrar operaciones comerciales, controlar existencias, generar comprobantes, consultar el historial de cada cliente y mantener un registro de auditoría de las acciones realizadas."

### Herramientas y tecnologías utilizadas

"La solución está construida con una arquitectura full stack y un monorepo administrado con pnpm."

- **Frontend:** React, TypeScript, Vite, Tailwind CSS y componentes Radix UI.
- **Backend:** Node.js, Express y TypeScript.
- **Base de datos:** PostgreSQL.
- **Acceso a datos:** Drizzle ORM.
- **Validación:** Zod.
- **Consultas y cache:** TanStack Query.
- **Autenticación:** JWT y contraseñas protegidas con bcryptjs.
- **Gráficos:** Recharts.
- **Exportaciones:** SheetJS para archivos Excel.
- **Documentos:** jsPDF y AutoTable para boletas, tickets, cotizaciones y reportes PDF.
- **Correo:** Nodemailer mediante SMTP de Gmail para enviar boletas a clientes.

## 2. Inicio de sesión y control de acceso

### Qué mostrar

1. Abrir la pantalla de inicio de sesión.
2. Mostrar los campos de correo y contraseña.
3. Ingresar con el usuario administrador.
4. Mostrar que el usuario entra al dashboard.

### Narración sugerida

"El acceso está protegido mediante autenticación. Cada usuario inicia sesión con sus credenciales y recibe un token que se utiliza para autorizar las operaciones del sistema."

"La aplicación maneja distintos roles: administrador, vendedor, inventario y compras. Cada rol visualiza únicamente los módulos y acciones que le corresponden."

## 3. Dashboard principal

### Qué mostrar

- Total de productos.
- Total de clientes.
- Ventas realizadas durante el mes.
- Productos con stock bajo.
- Gráfico de ventas de los últimos días.
- Ventas de hoy y del mes.
- Productos más vendidos.
- Ventas por vendedor.
- Ventas recientes.

### Narración sugerida

"El dashboard presenta una vista ejecutiva del negocio. Los indicadores permiten conocer rápidamente el estado del inventario, el comportamiento de las ventas y los productos con mayor movimiento."

"Los gráficos ayudan a identificar tendencias y las ventas recientes permiten acceder rápidamente al historial de operaciones."

## 4. Módulo de productos

### Qué mostrar

1. Entrar a **Productos**.
2. Buscar un producto.
3. Filtrar por marca y categoría.
4. Mostrar precio de compra, precio de venta, stock y stock mínimo.
5. Crear un producto nuevo.
6. Registrar código de barras, precios, stock, categoría, marca e imagen.
7. Editar un producto.
8. Mostrar el estado de stock: disponible, bajo o agotado.
9. Eliminar un producto de prueba, si corresponde.

### Narración sugerida

"El módulo de productos centraliza la información comercial y de inventario. Cada producto puede tener código de barras, imagen, precio de compra, precio de venta, stock mínimo, categoría y marca."

"El sistema identifica automáticamente los productos con stock bajo o agotado para facilitar la reposición."

## 5. Categorías y marcas

### Qué mostrar

- Crear una categoría.
- Editar su nombre y descripción.
- Mostrar el conteo de productos asociados.
- Entrar a marcas.
- Crear y editar una marca.
- Relacionar posteriormente categorías y marcas con productos.

### Narración sugerida

"Las categorías y marcas permiten organizar el catálogo y facilitan la búsqueda de productos en el inventario y en el punto de venta."

## 6. Clientes

### Qué mostrar

1. Entrar a **Clientes**.
2. Buscar un cliente por nombre.
3. Crear un cliente con nombre, NIT o CI, correo, teléfono y dirección.
4. Editar sus datos.
5. Mostrar la cantidad de compras.
6. Seleccionar **Extracto**.
7. Mostrar el historial de compras del cliente.
8. Mostrar filtros por período y búsqueda.
9. Mostrar estadísticas: total gastado, número de compras, ticket promedio y última compra.
10. Descargar o imprimir el extracto en PDF.

### Narración sugerida

"El módulo de clientes permite mantener la información de contacto y consultar el comportamiento de compra de cada persona."

"El extracto muestra las transacciones, los totales y los principales indicadores del cliente. También puede filtrarse por período y descargarse como PDF."

## 7. Punto de venta: crear una venta

### Qué mostrar

1. Entrar a **Nueva Venta**.
2. Buscar un producto por nombre.
3. Agregar productos al carrito.
4. Aumentar o disminuir cantidades.
5. Eliminar un producto.
6. Mostrar validación de stock.
7. Seleccionar un cliente.
8. Seleccionar método de pago.
9. Aplicar un descuento a un producto.
10. Agregar una nota.
11. Mostrar subtotal, IVA y total.
12. Si está habilitado, mostrar puntos y cupones de fidelización.
13. Confirmar la venta.

### Narración sugerida

"El punto de venta es el flujo principal del sistema. El vendedor selecciona los productos, define cantidades, asigna el cliente y el método de pago, y el sistema calcula automáticamente subtotal, IVA y total."

"Antes de confirmar, se valida que exista stock suficiente. Esto evita registrar ventas por encima de las unidades disponibles."

### Funcionalidades adicionales para mostrar

- Lectura de código de barras.
- Cantidad pendiente para el escáner.
- Suspender una venta.
- Recuperar una venta suspendida.
- Descartar una venta en espera.
- Calcular cambio cuando se recibe efectivo.

## 8. Boleta, ticket y correo electrónico

### Qué mostrar

1. Después de confirmar la venta, mostrar el modal de venta registrada.
2. Mostrar la boleta en PDF.
3. Descargar la boleta A4.
4. Imprimir la boleta.
5. Descargar el ticket térmico de 80 mm.
6. Imprimir el ticket.
7. Mostrar que, si el cliente tiene correo registrado, la boleta se envía automáticamente.
8. Revisar el correo de destino y el PDF adjunto.

### Narración sugerida

"Al completar una venta se genera el comprobante con los datos de la empresa, cliente, vendedor, productos, impuestos y total."

"La boleta puede descargarse o imprimirse en formato A4, y también puede generarse un ticket térmico de 80 milímetros."

"Cuando el cliente tiene un correo registrado, el sistema envía automáticamente la boleta PDF como archivo adjunto mediante SMTP."

## 9. Historial de ventas y detalle individual

### Qué mostrar

1. Entrar a **Historial de Ventas**.
2. Filtrar por fecha inicial y fecha final.
3. Filtrar por cliente.
4. Mostrar número de venta, cliente, vendedor, fecha, método, estado y total.
5. Abrir **Ver detalle** de una venta.
6. Mostrar productos, cantidades, precios, subtotal, IVA y total.
7. Descargar o imprimir la boleta.
8. Mostrar la opción de anular una venta con un usuario autorizado.

### Narración sugerida

"El historial permite revisar todas las operaciones realizadas y aplicar filtros para encontrar rápidamente una venta."

"En el detalle individual se visualiza el contenido completo de la venta y se pueden volver a generar sus comprobantes."

"La anulación está restringida a los usuarios autorizados y restaura automáticamente el stock de los productos."

## 10. Cotizaciones o proformas

### Qué mostrar

1. Entrar a **Cotizaciones**.
2. Buscar productos.
3. Agregar productos a una proforma.
4. Seleccionar cliente.
5. Definir fecha de validez.
6. Agregar notas y método de pago.
7. Mostrar subtotal, IVA y total.
8. Guardar la cotización.
9. Descargar o imprimir el PDF.
10. Convertir una cotización en venta.
11. Mostrar los estados pendiente, convertida y vencida.

### Narración sugerida

"Las cotizaciones permiten preparar una propuesta comercial sin afectar el stock. Una vez aprobada por el cliente, puede convertirse directamente en una venta y aplicar las validaciones correspondientes."

## 11. Inventario general

### Qué mostrar

- Reporte completo de productos.
- Código de barras.
- Categoría.
- Precio de compra y venta.
- Stock actual y mínimo.
- Valor total del stock.
- Estado de cada producto.
- Botón de descarga en Excel.

### Narración sugerida

"El reporte de inventario ofrece una vista consolidada del valor y estado de las existencias. La información puede exportarse a Excel para análisis, respaldo o control administrativo."

## 12. Proveedores

### Qué mostrar

1. Crear un proveedor.
2. Registrar empresa, NIT o CI, persona de contacto, correo, teléfono y dirección.
3. Buscar proveedores.
4. Editar información.
5. Eliminar un proveedor autorizado.

### Narración sugerida

"El módulo de proveedores organiza los datos de las empresas y contactos relacionados con el abastecimiento del negocio."

## 13. Cierre de caja

### Qué mostrar

1. Entrar a **Cierre de Caja**.
2. Seleccionar una fecha.
3. Mostrar total recaudado.
4. Mostrar número de transacciones.
5. Mostrar ticket promedio.
6. Mostrar ventas anuladas.
7. Mostrar totales por método de pago.
8. Mostrar gráfico de distribución.
9. Mostrar detalle de transacciones.
10. Exportar a Excel.
11. Imprimir el cierre.

### Narración sugerida

"El cierre de caja resume la actividad de un día específico. Permite comparar los ingresos por método de pago, identificar ventas anuladas y emitir un documento de cierre para control administrativo."

## 14. Reportes

### Qué mostrar

#### Ventas por vendedor

- Seleccionar rango de fechas.
- Mostrar cantidad de ventas por vendedor.
- Mostrar ingresos por vendedor.
- Mostrar gráfico de barras.
- Exportar a Excel.

#### Ventas por categoría

- Mostrar unidades vendidas por categoría.
- Mostrar ingresos por categoría.
- Mostrar gráfico comparativo.
- Exportar a Excel.

#### Alertas de stock

- Mostrar productos bajos o agotados.
- Mostrar stock actual y stock mínimo.
- Exportar el reporte.

### Narración sugerida

"El módulo de reportes permite analizar el negocio desde distintas perspectivas: desempeño de vendedores, comportamiento por categoría y alertas de inventario. Cada reporte puede filtrarse por fechas y exportarse para continuar el análisis en Excel."

## 15. Programa de fidelización

### Qué mostrar

1. Activar el programa desde **Configuración**.
2. Definir puntos por unidad de moneda.
3. Definir el valor de canje de cada punto.
4. Entrar a **Fidelización**.
5. Mostrar niveles Bronce, Plata y Oro.
6. Buscar clientes.
7. Mostrar puntos acumulados y descuento disponible.
8. Mostrar progreso al siguiente nivel.
9. Abrir historial de puntos.
10. Abrir cupones.
11. Ajustar puntos manualmente.
12. Generar el resumen PDF de fidelización.
13. En una venta, mostrar el canje de puntos o uso de cupón.

### Narración sugerida

"El programa de fidelización premia la recurrencia de los clientes. Los puntos acumulados determinan niveles y multiplicadores, y pueden utilizarse como descuento en futuras compras."

"El sistema también administra cupones y conserva el historial de puntos ganados, canjeados o ajustados."

## 16. Métodos de pago

### Qué mostrar

- Crear un método de pago.
- Editar nombre y descripción.
- Activar o desactivar un método.
- Volver al POS y mostrar que solo aparecen los métodos activos.

### Narración sugerida

"Los métodos de pago son configurables. El administrador puede agregar nuevas opciones y desactivar temporalmente las que no estén disponibles."

## 17. Usuarios y permisos

### Qué mostrar

1. Entrar a **Usuarios**.
2. Crear un usuario.
3. Seleccionar su rol.
4. Mostrar el resumen de permisos.
5. Editar usuario y contraseña opcionalmente.
6. Eliminar un usuario de prueba.
7. Explicar brevemente las diferencias por rol.

### Narración sugerida

"El administrador puede crear y administrar usuarios. Los roles controlan el acceso: ventas para vendedores, catálogo e inventario para el personal de inventario, proveedores y cotizaciones para compras, y acceso completo para administradores."

## 18. Configuración del negocio

### Qué mostrar

- Nombre o razón social.
- RUC o NIT.
- Teléfono.
- Correo.
- Dirección.
- Logo.
- Moneda y símbolo.
- Activación del programa de fidelización.
- Puntos por unidad gastada.
- Valor de redención por punto.
- Vista previa de la configuración.
- Guardar cambios.

### Narración sugerida

"La configuración permite adaptar el sistema a cada negocio. Los datos de empresa y el logo aparecen en los documentos generados, mientras que la moneda y fidelización modifican la experiencia de venta."

## 19. Auditoría

### Qué mostrar

1. Entrar a **Auditoría**.
2. Mostrar registros de inicio de sesión.
3. Mostrar acciones de creación, edición, cancelación y conversión.
4. Filtrar por fechas.
5. Filtrar por usuario.
6. Filtrar por acción.
7. Filtrar por módulo.
8. Cambiar de página.
9. Actualizar registros.
10. Exportar a Excel.

### Narración sugerida

"El registro de auditoría proporciona trazabilidad de las operaciones. Cada entrada identifica fecha, usuario, rol, acción, módulo, elemento afectado, dirección IP y detalles de la operación."

"Esto facilita el control interno y permite revisar quién realizó cada cambio."

## 20. Cierre del video

### Qué mostrar

- Volver al dashboard.
- Mostrar brevemente los indicadores actualizados después de la venta.

### Narración sugerida

"Con este recorrido se puede observar que el sistema cubre el ciclo completo de operación de un negocio: configuración, catálogo, clientes, ventas, comprobantes, inventario, proveedores, reportes, fidelización, seguridad y auditoría."

"La arquitectura modular permite mantener la información centralizada, controlar el acceso por roles y generar documentos útiles para la operación diaria y la administración."

"Gracias por acompañarme en esta demostración."

## Checklist antes de grabar

- [ ] Frontend funcionando en `http://localhost:5173`.
- [ ] API funcionando en `http://localhost:5000`.
- [ ] Usuario administrador disponible.
- [ ] Productos con stock suficiente.
- [ ] Cliente con correo registrado.
- [ ] Métodos de pago activos.
- [ ] Una venta de prueba para mostrar el historial.
- [ ] Programa de fidelización activado, si se demostrará.
- [ ] Configuración SMTP probada, si se demostrará el envío de boletas.
- [ ] Datos de prueba preparados para no eliminar información real.

## Orden resumido recomendado

1. Introducción y tecnologías.
2. Login y roles.
3. Dashboard.
4. Productos, categorías y marcas.
5. Clientes y extracto.
6. POS y venta completa.
7. Boleta, ticket y correo.
8. Historial y detalle de venta.
9. Cotizaciones.
10. Inventario y proveedores.
11. Cierre de caja y reportes.
12. Fidelización.
13. Métodos de pago.
14. Usuarios y permisos.
15. Configuración.
16. Auditoría.
17. Cierre.