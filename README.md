# Visor de Mapas - Reserva de la Biosfera Sierra del Rincón

## Créditos

Desarrollado por **Carles Gutiérrez** ([https://carlesgutierrez.github.io](https://carlesgutierrez.github.io)).

Perfil polifacético que se resume como **Creative Technologist** (programación web, Apps Interactivas, Iluminación, Videojuegos, Visualizaciones de datos, electrónicas programables, etc).

Para más información ver perfil de LinkedIn: [https://es.linkedin.com/in/carlesgutierrez](https://es.linkedin.com/in/carlesgutierrez)

---

## Sobre el Proyecto

Este proyecto es un visor de mapas interactivo diseñado para explorar los recursos, productores y actividades de la **Reserva de la Biosfera Sierra del Rincón**. Su objetivo es ofrecer una herramienta visual, accesible y fácil de usar para descubrir la riqueza de este territorio.

El mapa permite visualizar diferentes capas de información, como municipios, productores locales y actividades turísticas, facilitando la localización y el acceso a información detallada de cada punto de interés.

## Características Principales

*   **Visualización Interactiva:** Navegación fluida por el mapa con controles de zoom y desplazamiento.
*   **Capas de Información:** Activación y desactivación de capas (Productores, Actividades) para personalizar la vista.
*   **Información Detallada:** Al hacer clic en un punto, se despliega un panel lateral con información completa (descripción, contacto, imágenes, enlaces).
*   **Diseño Responsivo:** Adaptado para funcionar correctamente tanto en ordenadores de escritorio como en dispositivos móviles.
*   **Modo Pantalla Completa:** Botón dedicado para abrir el mapa en una nueva pestaña y aprovechar todo el espacio de la pantalla.

## Cómo Actualizar los Datos del Mapa (KML)

La información que se muestra en el mapa se carga dinámicamente desde archivos **KML** (Keyhole Markup Language). Esto permite actualizar el contenido sin necesidad de modificar el código de la aplicación.

1.  **Localizar los archivos:** Los archivos KML se encuentran en las carpetas `productores/` y `actividades/` dentro del directorio del proyecto.
    *   `productores/doc.kml`: Contiene los datos de los productores.
    *   `actividades/doc.kml`: Contiene los datos de las actividades.
2.  **Editar el KML:** Puedes editar estos archivos con cualquier editor de texto o utilizando herramientas como Google Earth Pro.
    *   Asegúrate de mantener la estructura de etiquetas KML estándar.
    *   Los campos de datos extendidos (`ExtendedData`) se utilizan para mostrar información adicional en el panel lateral.
3.  **Imágenes e Iconos:** Si añades nuevos puntos con imágenes o iconos personalizados, asegúrate de subir los archivos correspondientes a las carpetas de imágenes dentro de `productores/` o `actividades/` y referenciarlos correctamente en el KML.

## Cómo Incrustar el Mapa (Iframe)

Puedes integrar este visor de mapas en cualquier página web utilizando un `iframe`. Esto es ideal para mostrar el mapa dentro de la web oficial de la Reserva de la Biosfera o en blogs relacionados.

Copia y pega el siguiente código HTML en tu sitio web:

```html
<iframe 
    src="https://carlesgutierrez.github.io/mapa-biosfera/" 
    width="100%" 
    height="600" 
    style="border:0;" 
    allowfullscreen="" 
    loading="lazy" 
    referrerpolicy="no-referrer-when-downgrade">
</iframe>
```

**Nota:** Ajusta el atributo `height` (altura) según tus necesidades para que se adapte mejor al diseño de tu página. El atributo `src` debe apuntar a la URL donde esté alojado este proyecto.
