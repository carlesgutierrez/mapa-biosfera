# Visor de Mapas GIS para la Reserva de la Biosfera

Este proyecto es una aplicación de mapa web ligera y auto-contenida, diseñada para visualizar datos geoespaciales (GIS) en formato KML. La aplicación está construida con HTML5, JavaScript puro y CSS, utilizando la librería Leaflet.js para una representación de mapas interactiva y eficiente.

## 1. Stack Tecnológico

- **HTML5:** Para la estructura semántica de la página.
- **CSS3:** Para los estilos visuales del mapa, la leyenda y el panel de información.
- **JavaScript (ES6+):** Para toda la lógica funcional, incluyendo la carga de datos y la interacción del usuario.
- **Librerías Externas (vía CDN):**
  - **Leaflet.js:** Para la creación de mapas interactivos.
  - **Leaflet.markercluster:** Para agrupar marcadores en clústeres y mejorar el rendimiento.
  - **leaflet-omnivore:** Para facilitar la carga y el parseo de datos KML.

## 2. Estructura del Proyecto

Para que la aplicación funcione, los archivos deben mantener la siguiente estructura de carpetas, ya que los recursos se cargan mediante rutas relativas.

```
.
├── index.html           # La aplicación principal del mapa
├── municipios/
│   └── doc.kml          # KML con los polígonos de los límites municipales
├── productores/
│   ├── doc.kml          # KML con los puntos de interés de los productores
│   ├── iconoDoc.png     # Icono principal para esta capa
│   └── images/          # Imágenes usadas en los popups de los productores
└── actividades/
    ├── doc.kml          # KML con los puntos de interés de las actividades
    ├── iconoDoc.png     # Icono principal para esta capa
    └── images/          # Imágenes usadas en los popups de las actividades
```

## 3. Funcionalidades Clave

### A. Visualización del Mapa
- **Mapa Base:** Utiliza OpenStreetMap como capa de fondo.
- **Carga Asíncrona:** Las capas KML se cargan de forma asíncrona para no bloquear la interfaz.
- **Ajuste de Vista Automático:** El mapa se ajusta automáticamente (`fitBounds`) para mostrar todos los datos una vez que las capas han terminado de cargarse.

### B. Capas de Datos
- **Límites Municipales:** Polígonos estilizados que muestran el nombre del municipio al pasar el cursor.
- **Puntos de Interés (Productores y Actividades):**
  - **Clustering:** Los marcadores se agrupan en clústeres para mantener el mapa limpio en vistas alejadas.
  - **Iconos Personalizados:** Cada capa principal utiliza un icono distintivo para una fácil identificación en la leyenda y el mapa.
  - **Parseo de Iconos KML:** El sistema lee el icono específico definido para cada punto dentro del KML y lo asigna al marcador correspondiente.

### C. Interacción y Experiencia de Usuario
- **Panel de Información Detallada:**
  - Al hacer clic en un marcador, se abre un panel lateral que muestra la información del punto, en lugar de un popup sobre el mapa. Esto permite mostrar más contenido de forma limpia y es más amigable en dispositivos móviles.
  - El panel muestra dinámicamente el nombre, una tabla con atributos filtrados (excluyendo datos técnicos irrelevantes) y un icono representativo.
- **Enlace de Navegación:** El panel incluye un enlace "📍 Cómo llegar" que abre Google Maps con la ubicación del punto.
- **Diseño Responsivo:** La interfaz se adapta a diferentes tamaños de pantalla, optimizando la experiencia en escritorio y móvil.

## 4. Próximas Mejoras

- **Filtro de Capas:**
  - Implementar un control interactivo para mostrar u ocultar las capas de "Actividades" y "Productores".
  - La leyenda del mapa se actualizará visualmente (ej. cambiando a color gris) para reflejar qué capas están activas.

- **Listado Interactivo de Puntos:**
  - Añadir una sección en el panel lateral para listar todos los marcadores de la capa visible.
  - Al hacer clic en un elemento de la lista, el mapa se centrará en el marcador correspondiente y mostrará su información.
