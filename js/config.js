const CONFIG = {
    // Configuración inicial del mapa
    map: {
        center: [40.416775, -3.703790], // Centro en España
        zoom: 6,
        // Opciones de capas base
        tileLayers: {
            standard: {
                url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            },
            // Capa de transporte (Thunderforest requiere API Key, ÖPNVKarte es gratis pero a veces lento)
            // Para usar Thunderforest: 'https://{s}.tile.thunderforest.com/transport/{z}/{x}/{y}.png?apikey=TU_API_KEY'
            transport: {
                url: 'https://tile.memomaps.de/tilegen/{z}/{x}/{y}.png', // ÖPNVKarte (Transporte público)
                attribution: '&copy; <a href="https://memomaps.de/">memomaps.de</a> &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors'
            },
            // Capa Gris (CartoDB Positron) - Ideal para resaltar iconos
            gray: {
                url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            },
            // Capa Voyager (CartoDB Voyager) - Limpia y moderna
            voyager: {
                url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            }
        },
        // Capa activa por defecto
        defaultLayer: 'gray'
    },

    // Configuración de iconos
    useKmlIcons: true, // true: usar iconos del KML (images/...), false: usar emojis del campo 'icon'
    icons: {
        size: [40, 40], // Aumentado un 25% (de 32x32)
        anchor: [20, 40],
        popupAnchor: [0, -40]
    },

    // Habilitar popups en municipios al hacer click
    enableMunicipalityPopups: false,

    // Renderizar municipios en el mapa (desactivar para mejorar rendimiento si es necesario)
    renderMunicipios: true,

    // Configuración de estilos para capas KML
    styles: {
        municipios: {
            color: '#4a4a4a',
            weight: 2,
            opacity: 0.6,
            fillColor: '#808080',
            fillOpacity: 0.2,
            dashArray: '5, 5' // Línea discontinua
        }
    },

    // Campos de datos a excluir en el panel de información
    excludedDataFields: [
        'styleurl', 'stylehash', 'name', 'description', 'icon', 'visible',
        'gx_media_links', 'lat', 'long', 'media_url', 'color', 'nombre', 'iconurl',
        '_folder'
    ],

    // Rutas a los archivos KML y sus carpetas de recursos
    layers: [
        {
            type: 'municipios',
            url: 'municipios/doc.kml',
            name: 'Municipios'
        },
        {
            type: 'puntos',
            url: 'productores/doc.kml',
            folder: 'productores',
            name: 'Productores'
        },
        {
            type: 'puntos',
            url: 'actividades/doc.kml',
            folder: 'actividades',
            name: 'Actividades'
        }
    ],

    // Gestos en móvil
    // - false (por defecto): usar la interacción nativa de Leaflet (1 dedo mueve el mapa)
    // - true: activar la “protección” tipo Google Maps (solo 2 dedos mueven el mapa)
    mobileGestures: {
        enableTwoFingerPanProtection: false,
        twoFingerMessage: 'Usa dos dedos para mover el mapa'
    }
};
