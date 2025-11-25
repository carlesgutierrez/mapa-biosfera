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

El proyecto ha sido refactorizado para mejorar su mantenibilidad y escalabilidad.

```
.
├── index.html           # Estructura principal
├── css/
│   └── styles.css       # Todos los estilos de la aplicación
├── js/
│   ├── config.js        # Configuración centralizada (capas, estilos, iconos)
│   └── app.js           # Lógica principal de la aplicación
├── municipios/
│   └── doc.kml          # KML con los polígonos de los límites municipales
├── productores/
│   ├── doc.kml          # KML con los puntos de interés de los productores
│   ├── iconoDoc.png     # Icono principal para esta capa
│   └── images/          # Imágenes usadas en los popups
└── actividades/
    ├── doc.kml          # KML con los puntos de interés de las actividades
    ├── iconoDoc.png     # Icono principal para esta capa
    └── images/          # Imágenes usadas en los popups
```

## 3. Funcionalidades Clave

### A. Visualización y Capas
- **Múltiples Capas Base:**
  - **Gray (Por defecto):** CartoDB Positron, ideal para resaltar los iconos.
  - **Voyager:** CartoDB Voyager, diseño limpio y moderno.
  - **Standard:** OpenStreetMap clásico.
  - **Transporte:** ÖPNVKarte (Transporte público).
- **Filtrado Interactivo:**
  - Los elementos de la leyenda ("Actividades" y "Productores") funcionan como botones para activar/desactivar las capas correspondientes.
- **Clustering Inteligente:**
  - Los marcadores de Actividades y Productores se agrupan en un mismo sistema de clústeres para evitar solapamientos y mantener el mapa limpio.

### B. Experiencia de Usuario
- **Modo Alto Contraste:**
  - Botón dedicado en el header para activar un modo de alto contraste.
  - Aumenta el tamaño de las fuentes y mejora la visibilidad del mapa.
- **Panel de Información:**
  - Al hacer clic en un marcador, se abre un panel lateral con información detallada, imágenes y enlaces.
- **Tooltips Mejorados:**
  - Los nombres de los municipios aparecen al pasar el ratón, con un tamaño de fuente optimizado para lectura.

### C. Configuración Fácil
- Todo el comportamiento del mapa se puede ajustar desde `js/config.js`:
  - Cambiar la capa por defecto.
  - Ajustar el tamaño de los iconos.
  - Habilitar/deshabilitar popups en municipios.
  - Modificar estilos y colores.

## 4. Cómo Actualizar la Página (GitHub Pages)

Si este proyecto está alojado en GitHub Pages, sigue estos pasos para actualizar la versión online con los últimos cambios:

1.  **Guardar Cambios:** Asegúrate de haber guardado todos los archivos modificados en tu editor.
2.  **Commit y Push:**
    Desde tu terminal o cliente de Git, ejecuta los siguientes comandos:

    ```bash
    # Añadir todos los cambios al área de preparación
    git add .

    # Crear un commit con un mensaje descriptivo
    git commit -m "Refactorización del mapa: nuevas capas, filtrado y alto contraste"

    # Subir los cambios al repositorio remoto (GitHub)
    git push origin main
    ```
    *(Nota: Si tu rama principal se llama `master`, usa `git push origin master`)*.

3.  **Verificación:**
    - Ve a la pestaña "Actions" o "Settings > Pages" en tu repositorio de GitHub para ver el estado del despliegue.
    - Una vez completado, los cambios estarán visibles en la URL de tu GitHub Pages (ej. `https://tu-usuario.github.io/mapa-biosfera/`).
    - **Importante:** Puede tardar unos minutos en actualizarse. Si no ves los cambios, prueba a limpiar la caché de tu navegador (Ctrl+F5 o Cmd+Shift+R).

## 5. Integración

Para insertar este mapa en otra web:

```html
<iframe 
  src="https://carlesgutierrez.github.io/mapa-biosfera/" 
  width="100%" 
  height="800" 
  style="border:1px solid #ccc; display: block; margin: 0 auto;" 
  title="Mapa de la Reserva de la Biosfera">
</iframe>
