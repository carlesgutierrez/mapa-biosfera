/**
 * Lógica principal de la aplicación
 */

// --- Variables Globales ---
let map;
let group; // FeatureGroup para ajustar el zoom
let sharedClusterGroup; // Grupo de clusters compartido
let layerGroups = {}; // Almacén de capas para filtrado
let capasCargadas = 0;
const totalCapas = CONFIG.layers.length;
let selectedMarker = null; // Referencia al marcador seleccionado actualmente
let selectedHalo = null; // Referencia al halo visual
let initialBounds = null; // Para guardar la vista inicial

// --- Inicialización ---
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    initUI();
    initLegend();
    loadLayers();
    initMobileGestures();
});

// --- Inicialización del Mapa ---
function initMap() {
    map = L.map('map', {
        preferCanvas: false,
        zoomControl: false // Desactivamos el control de zoom por defecto
    }).setView(CONFIG.map.center, CONFIG.map.zoom);

    // Guardar zoom anterior para detectar dirección del zoom
    let lastZoom = map.getZoom();
    map.on('zoomend', () => {
        const currentZoom = map.getZoom();
        if (currentZoom < lastZoom) {
            // Zoom Out detectado -> Cerrar panel y limpiar selección
            // Esto soluciona el bug de que el halo se quede visible sobre un cluster
            //closeInfoPanel();
        }
        lastZoom = currentZoom;
    });

    // Configurar capas base dinámicamente desde CONFIG
    const baseLayers = {};
    
    Object.entries(CONFIG.map.tileLayers).forEach(([key, layerConfig]) => {
        // Crear nombre legible (ej: 'standard' -> 'Standard')
        const layerName = key.charAt(0).toUpperCase() + key.slice(1);
        
        const tileLayer = L.tileLayer(layerConfig.url, {
            attribution: layerConfig.attribution,
            keepBuffer: 8 // Mantener más teselas en memoria (default 2) para evitar recargas al volver atrás
        });
        
        baseLayers[layerName] = tileLayer;

        // Añadir capa por defecto
        if (key === CONFIG.map.defaultLayer) {
            tileLayer.addTo(map);
        }
    });

    // Control de capas
    // L.control.layers(baseLayers).addTo(map);

    // Grupo para ajustar límites
    group = new L.FeatureGroup();

    // Inicializar grupo de clusters compartido
    sharedClusterGroup = L.markerClusterGroup({
        chunkedLoading: true // Carga progresiva para evitar congelar la UI
    });
    
    // Evento click en cluster (nodo verde)
    sharedClusterGroup.on('clusterclick', function (a) {
        // Comportamiento por defecto de la librería
    });

    // Detectar cuando se reagrupan los clusters (zoom out)
    // Si un marcador seleccionado se agrupa en un cluster, debemos cerrar el panel y limpiar selección.
    sharedClusterGroup.on('animationend', function() {
        console.log('♻️ Clusters reagrupados (animationend)');
        checkSelectionVisibility();
    });

    // Asegurar comprobación al terminar zoom (por si animationend no salta o es insuficiente)
    map.on('zoomend', function() {
        checkSelectionVisibility();
    });

    // También cuando se cierra un spiderfy
    sharedClusterGroup.on('unspiderfied', function(e) {
        console.log('🕸️ Spiderfy cerrado (agrupado de nuevo)');
        // e.markers contiene los marcadores que se acaban de reagrupar (ocultar)
        if (selectedMarker && e.markers.includes(selectedMarker)) {
            clearSelection();
        }
    });

    function checkSelectionVisibility() {
        if (selectedMarker && sharedClusterGroup.hasLayer(selectedMarker)) {
            // Comprobamos quién es el "padre visible" del marcador seleccionado
            const visibleParent = sharedClusterGroup.getVisibleParent(selectedMarker);

            // Si visibleParent existe y NO es el marcador mismo, significa que está dentro de un cluster
            // Si visibleParent es null, puede estar fuera de pantalla (no limpiamos) o no añadido
            if (visibleParent && visibleParent !== selectedMarker) {
                // El marcador ha sido agrupado y ocultado
                console.log('🔒 Marcador seleccionado ha sido agrupado en un cluster - Limpiando selección');
                clearSelection();
            }
        }
    }

    map.addLayer(sharedClusterGroup);
    
    // Evento de zoom del mapa para cerrar panel si es zoom out significativo que agrupa cosas
    map.on('zoomend', function() {
        // ... (lógica ya implementada en initMap con lastZoom)
    });

    // Evento click en el mapa para deseleccionar
    map.on('click', onMapClick);
}

function onMapClick(e) {
    console.log('🗺️ Click en mapa detectado - Limpiando selección');
    closeInfoPanel();
}

// --- Gestión del Menú Interactivo de Items ---

// Inicializar estructura del menú (solo una vez)
function initItemsMenuStructure() {
    const menuContainer = document.getElementById('items-menu');
    if (!menuContainer || menuContainer.children.length > 0) return;

    // Crear contenedores fijos para grupos
    const grupos = ['productores', 'actividades'];
    grupos.forEach(key => {
        const div = document.createElement('div');
        div.id = `group-${key}`; // ID para acceso rápido
        div.className = `items-group group-${key}`;
        div.style.display = 'none'; // Oculto por defecto hasta que haya datos
        menuContainer.appendChild(div);
    });
}

// Actualizar un grupo específico
function updateItemsGroup(type, isActive) {
    const groupContainer = document.getElementById(`group-${type}`);
    if (!groupContainer) return;

    if (!isActive) {
        groupContainer.style.display = 'none';
        return;
    }

    groupContainer.style.display = 'flex';
    
    // Si ya tiene contenido, no regenerar (optimización)
    // PERO: Si los datos cambian dinámicamente, habría que regenerar.
    // Asumimos datos estáticos por ahora. Si ya tiene hijos, solo mostramos.
    if (groupContainer.children.length > 0) return;

    const layerGroup = layerGroups[type];
    if (!layerGroup) return;

    layerGroup.eachLayer(layer => {
        const props = layer.feature.properties;
        const name = props.name || 'Sin nombre';
        
        const btn = document.createElement('button');
        btn.className = `menu-item-btn type-${type}`;
        
        // Icono
        if (props.iconUrl) {
            const fullIconPath = `${type}/${props.iconUrl}`;
            const img = document.createElement('img');
            img.src = fullIconPath;
            btn.appendChild(img);
        }

        const span = document.createElement('span');
        span.textContent = name;
        btn.appendChild(span);

        // Añadir delay para animación escalonada
        btn.style.animationDelay = `${Math.random() * 0.3}s`;

        btn.addEventListener('click', (e) => {
            e.stopPropagation(); // Evitar click en mapa
            zoomToFeature(layer);
        });

        groupContainer.appendChild(btn);
    });
}

// Función global para inicializar todo (llamada al inicio)
function updateItemsMenu() {
    initItemsMenuStructure();
    // Actualizar todos los grupos según estado inicial
    Object.keys(layerGroups).forEach(type => {
        const legendItem = document.getElementById(`legend-${type}`);
        const isActive = legendItem && legendItem.classList.contains('active');
        updateItemsGroup(type, isActive);
    });
}

// Función unificada para seleccionar un feature (desde mapa o menú)
function selectFeature(layer) {
    const feature = layer.feature;
    const folder = feature.properties._folder; // Recuperamos la carpeta guardada

    // Si ya hay uno seleccionado, restaurarlo al cluster
    if (selectedMarker && selectedMarker !== layer) {
        clearSelection();
    }

    // Comprobar si es parte de un spiderfy (varios nodos conectados)
    const isSpiderfied = !!layer._spiderLeg;

    selectedMarker = layer;
    
    // Efecto visual selección
    createHalo(layer.getLatLng());

    if (isSpiderfied) {
        console.log("Marker spiderfied: Manteniendo posición.");
        displayFeatureInfo(feature, folder);
    } else {
        // Comportamiento normal: Mover cámara si es necesario
        let targetLatLng = layer.getLatLng();
        let shouldMove = true;
        const targetZoom = Math.max(map.getZoom(), 16);
        
        // Comprobar si estamos en modo escritorio (ancho > 600px)
        if (window.innerWidth > 600) {
            const point = map.project(targetLatLng, targetZoom);
            const newPoint = point.add([200, 0]); // Desplazar 200px a la derecha
            targetLatLng = map.unproject(newPoint, targetZoom);
            
            if (map.getCenter().distanceTo(targetLatLng) < 50) {
                shouldMove = false;
            }
        } else {
            if (map.getCenter().distanceTo(targetLatLng) < 50) {
                shouldMove = false;
            }
        }

        if (shouldMove) {
            // Primero mover, luego mostrar info al terminar
            map.flyTo(targetLatLng, targetZoom, { duration: 1.5 });
            map.once('moveend', () => {
                displayFeatureInfo(feature, folder);
            });
        } else {
            // Si no hay movimiento, mostrar directamente
            displayFeatureInfo(feature, folder);
        }
    }
}

function zoomToFeature(layer) {
    // Lógica mejorada para zoom profundo y selección directa
    
    // 1. Comprobar si está visible directamente (no agrupado)
    const visibleParent = sharedClusterGroup.getVisibleParent(layer);
    
    if (visibleParent === layer) {
        // CASO A: Marcador visible -> Selección directa
        console.log('📍 Item visible -> Selección directa');
        selectFeature(layer);
        
    } else if (visibleParent instanceof L.MarkerCluster) {
        // CASO B: Agrupado en cluster
        console.log('🔍 Item en cluster -> Zoom profundo');
        
        sharedClusterGroup.zoomToShowLayer(layer, () => {
            // Callback cuando el marcador ya es visible (después de zoom/spiderfy)
            console.log('✅ Marcador revelado -> Seleccionando');
            
            setTimeout(() => {
                selectFeature(layer);
            }, 200);
        });
    } else {
        // Fallback
        const duration = L.Browser.mobile ? 2.5 : 1.5;
        map.flyTo(layer.getLatLng(), 18, { duration: duration });
        
        if (L.Browser.mobile) {
             map.once('moveend', () => {
                 setTimeout(() => {
                     selectFeature(layer);
                 }, 1000);
             });
        } else {
             setTimeout(() => {
                 selectFeature(layer);
             }, duration * 1000 + 100);
        }
    }
}

// --- Inicialización de UI ---
function initUI() {
    // Panel Lateral
    const closePanelBtn = document.getElementById('close-panel-btn');
    const mapOverlay = document.getElementById('map-overlay');

    if (closePanelBtn) closePanelBtn.addEventListener('click', closeInfoPanel);
    if (mapOverlay) mapOverlay.addEventListener('click', closeInfoPanel);

    // Botón de Contraste
    const contrastBtn = document.getElementById('contrast-btn');
    if (contrastBtn) {
        contrastBtn.addEventListener('click', toggleContrastMode);
    }

    // Botón Reset Vista (Centrar Mapa)
    const resetViewBtn = document.getElementById('reset-view-btn');
    if (resetViewBtn) {
        resetViewBtn.addEventListener('click', () => resetMapView(1)); // Zoom extra por defecto
    }

    // Botones de Zoom Personalizados
    const zoomInBtn = document.getElementById('zoom-in-btn');
    const zoomOutBtn = document.getElementById('zoom-out-btn');
    if (zoomInBtn) {
        zoomInBtn.addEventListener('click', () => map.zoomIn());
    }
    if (zoomOutBtn) {
        zoomOutBtn.addEventListener('click', () => map.zoomOut());
    }

    // Botón Fullscreen (Nueva Pestaña)
    const fullscreenBtn = document.getElementById('fullscreen-toggle');
    if (fullscreenBtn) {
        fullscreenBtn.addEventListener('click', () => {
            // Abrir la misma URL en una nueva pestaña
            window.open(window.location.href, '_blank');
        });
    }

    // Botón Toggle Menú Items
    const menuToggleBtn = document.getElementById('menu-toggle-btn');
    if (menuToggleBtn) {
        menuToggleBtn.addEventListener('click', toggleItemsMenu);
    }
}

function toggleItemsMenu() {
    const menu = document.getElementById('items-menu');
    const btn = document.getElementById('menu-toggle-btn');
    const headerContainer = document.querySelector('.map-header-container'); // O body
    
    if (menu) {
        const isVisible = menu.classList.toggle('visible');
        
        if (btn) {
            if (isVisible) {
                btn.classList.add('active');
                document.body.classList.add('menu-open'); // Añadir clase global para estilos dependientes
            } else {
                btn.classList.remove('active');
                document.body.classList.remove('menu-open');
            }
        }

        // Actualizar items si se abre y estaba vacío (opcional, ya se actualiza al cargar/filtrar)
        if (isVisible && menu.children.length === 0) {
            updateItemsMenu();
        }
    }
}

function toggleContrastMode() {
    document.body.classList.toggle('high-contrast');
    const btn = document.getElementById('contrast-btn');
    if (btn) btn.classList.toggle('active');
}

function closeInfoPanel() {
    const infoPanel = document.getElementById('info-panel');
    const mapOverlay = document.getElementById('map-overlay');
    
    if (infoPanel.classList.contains('visible')) {
        infoPanel.classList.remove('visible');
        mapOverlay.classList.remove('visible');

        // Limpiar selección visual
        clearSelection();
        
        // Limpiar historial si estamos en móvil y el estado es panelOpen
        // Esto evita que el usuario tenga que dar atrás dos veces si cerró con la X
        if (L.Browser.mobile && history.state && history.state.panelOpen) {
            history.back();
        }
    }

    // Zoom out a posición intermedia
    /*
    if (initialBounds) {
        // Opción A: Volver a la vista inicial completa
        // map.fitBounds(initialBounds, { padding: [50, 50], animate: true, duration: 1 });
        
        // Opción B: Zoom out intermedio (ej. zoom actual - 2, o un nivel fijo si estamos muy cerca)
        const currentZoom = map.getZoom();
        const targetZoom = Math.max(CONFIG.map.zoom, currentZoom - 2); // No alejar más que el zoom inicial config
        
        // Si queremos volver al centro inicial o mantener centro actual pero alejar
        // map.setZoom(targetZoom, { animate: true });
        
        // Opción C (Solicitada): Posición intermedia entre inicial y actual.
        // Es complejo definir "intermedia" en coordenadas.
        // Simplificación efectiva: Volver a encuadrar todo el grupo (vista inicial) es lo más estándar "salir".
        // Pero el usuario pide "posición intermedia".
        // Vamos a hacer un fitBounds con un padding grande para alejar, o simplemente volver a initialBounds.
        // Interpretando "salir de la descripción": volver a ver el contexto general.
        map.fitBounds(initialBounds, { padding: [50, 50], animate: true, duration: 1.5 });
    }
    */
}

let hoverHalo = null; // Halo temporal para hover

// Variables para reutilizar marcadores de halo y evitar GC
let sharedHoverHalo = null;
let sharedSelectedHalo = null;

function getHaloMarker(isHover) {
    const haloSize = 50;
    const iconHeight = CONFIG.icons.size[1]; // 40
    
    // Crear icono si no existe (es el mismo para ambos)
    const createIcon = () => L.divIcon({
        className: 'marker-selected-halo',
        iconSize: [haloSize, haloSize],
        iconAnchor: [haloSize/2, haloSize/2 + iconHeight/2]
    });

    if (isHover) {
        if (!sharedHoverHalo) {
            sharedHoverHalo = L.marker([0,0], {
                icon: createIcon(),
                zIndexOffset: -1000,
                interactive: false
            });
        }
        return sharedHoverHalo;
    } else {
        if (!sharedSelectedHalo) {
            sharedSelectedHalo = L.marker([0,0], {
                icon: createIcon(),
                zIndexOffset: -1000,
                interactive: false
            });
        }
        return sharedSelectedHalo;
    }
}

function clearSelection(onlyHover = false) {
    if (onlyHover) {
        if (hoverHalo) {
            hoverHalo.remove();
            hoverHalo = null;
        }
        return;
    }

    if (selectedHalo) {
        selectedHalo.remove();
        selectedHalo = null;
    }
    if (hoverHalo) {
        hoverHalo.remove();
        hoverHalo = null;
    }
    
    // Restaurar marcador al cluster si estaba seleccionado
    if (selectedMarker) {
        // Ya no extraemos del cluster, así que solo limpiamos la referencia
        selectedMarker = null;
    }
}

function createHalo(latlng, isHover = false) {
    if (!isHover) {
        clearSelection(); // Limpiar todo si es selección fija
    } else {
        if (hoverHalo) hoverHalo.remove(); // Limpiar anterior hover
    }
    
    const haloMarker = getHaloMarker(isHover);
    haloMarker.setLatLng(latlng);
    
    if (!map.hasLayer(haloMarker)) {
        haloMarker.addTo(map);
    }

    if (isHover) {
        hoverHalo = haloMarker;
    } else {
        selectedHalo = haloMarker;
    }
}

// --- Lógica de Leyenda y Filtrado ---
function initLegend() {
    const legendItems = {
        'actividades': document.getElementById('legend-actividades'),
        'productores': document.getElementById('legend-productores')
    };

    Object.entries(legendItems).forEach(([key, element]) => {
        if (element) {
            // Estado inicial activo
            element.classList.add('active');
            
            element.addEventListener('click', () => {
                toggleLayer(key, element);
            });
        }
    });
}

function resetMapView(zoomOffset = 0) {
    if (initialBounds) {
        // Ajustar bounds con padding
        map.fitBounds(initialBounds, { padding: [50, 50] });
        
        // Si hay offset de zoom, aplicarlo después del fitBounds
        if (zoomOffset !== 0) {
            // Usamos un timeout pequeño o el evento moveend para asegurar que fitBounds terminó
            // Pero fitBounds es asíncrono en animación.
            // Una forma más directa es calcular el zoom resultante y sumarle el offset.
            
            // Opción simple: setZoom después de un breve retardo o usar setView con el centro de bounds
            // map.setZoom(map.getBoundsZoom(initialBounds) + zoomOffset);
            
            // Mejor: fitBounds y luego zoomIn
            // Pero fitBounds ya ajusta el zoom.
            
            // Vamos a usar setView con el centro de los bounds y un zoom calculado manualmente
            const targetZoom = map.getBoundsZoom(initialBounds) + zoomOffset;
            map.setView(initialBounds.getCenter(), targetZoom, { animate: true });
        }
    } else {
        // Fallback a config inicial
        map.setView(CONFIG.map.center, CONFIG.map.zoom + zoomOffset, { animate: true });
    }
}

function toggleLayer(type, element) {
    const layer = layerGroups[type];
    if (!layer) return;

    const isActive = element.classList.contains('active');

    if (isActive) {
        // Desactivar
        element.classList.remove('active');
        element.classList.add('inactive');
        sharedClusterGroup.removeLayer(layer);
    } else {
        // Activar
        element.classList.remove('inactive');
        element.classList.add('active');
        if (!sharedClusterGroup.hasLayer(layer)) {
            sharedClusterGroup.addLayer(layer);
        }
    }
    // Actualizar solo el grupo afectado en el menú
    updateItemsGroup(type, !isActive);
}

// --- Carga de Capas ---
function loadLayers() {
    CONFIG.layers.forEach(layerConfig => {
        if (layerConfig.type === 'municipios') {
            loadMunicipios(layerConfig);
        } else if (layerConfig.type === 'puntos') {
            loadPuntos(layerConfig);
        }
    });
}

function verificarCargaCompleta() {
    capasCargadas++;
    if (capasCargadas === totalCapas) {
        if (group.getLayers().length > 0) {
            initialBounds = group.getBounds();
            // Usar la nueva función de reset para aplicar el zoom inicial con offset
            resetMapView(1); // Zoom extra inicial
        }
    }
}

// --- Lógica de Municipios ---
function loadMunicipios(layerConfig) {
    // Usamos VectorGrid para renderizar los polígonos como teselas vectoriales
    
    fetch(layerConfig.url)
        .then(response => response.text())
        .then(kmlText => {
            // 1. Parsear KML a GeoJSON usando omnivore
            const tempLayer = omnivore.kml.parse(kmlText);
            
            // Pre-calcular centros para los tooltips
            tempLayer.eachLayer(l => {
                if (l.getBounds) {
                    const center = l.getBounds().getCenter();
                    // Guardamos el centro en las propiedades para usarlo en VectorGrid
                    l.feature.properties._center = { lat: center.lat, lng: center.lng };
                }
            });

            const geoJsonData = tempLayer.toGeoJSON();
            
            // 2. Crear capa VectorGrid
            const vectorGridLayer = L.vectorGrid.slicer(geoJsonData, {
                rendererFactory: L.canvas.tile,
                vectorTileLayerStyles: {
                    sliced: CONFIG.styles.municipios
                },
                interactive: true,
                getFeatureId: function(f) {
                    return f.properties.name;
                }
            });
            
            // 3. Eventos
            const hoverTooltip = L.tooltip({
                direction: 'center',
                className: 'municipio-tooltip',
                permanent: false,
                opacity: 1
            });

            vectorGridLayer.on('mouseover', function(e) {
                const props = e.layer.properties;
                if (props.name) {
                    hoverTooltip.setContent(props.name);
                    
                    // Usar centro pre-calculado si existe, si no la posición del ratón
                    let pos = e.latlng;
                    if (props._center) {
                        pos = props._center;
                    }
                    
                    hoverTooltip.setLatLng(pos);
                    map.openTooltip(hoverTooltip);
                }
            });

            vectorGridLayer.on('mouseout', function(e) {
                map.closeTooltip(hoverTooltip);
            });

            if (CONFIG.enableMunicipalityPopups) {
                vectorGridLayer.on('click', function(e) {
                    L.popup()
                        .setLatLng(e.latlng)
                        .setContent(`<b>${e.layer.properties.name}</b>`)
                        .openOn(map);
                });
            }
            
            // 4. Añadir al grupo para calcular bounds
            tempLayer.eachLayer(layer => group.addLayer(layer));
            
            // 5. Añadir al mapa si está habilitado
            if (CONFIG.renderMunicipios) {
                vectorGridLayer.addTo(map);
            }
            
            verificarCargaCompleta();
        })
        .catch(error => {
            console.error(`Error al cargar ${layerConfig.url}:`, error);
            verificarCargaCompleta();
        });
}

// --- Lógica de Puntos (Productores y Actividades) ---
async function loadPuntos(layerConfig) {
    try {
        // 1. Fetch del KML (texto) una sola vez
        const response = await fetch(layerConfig.url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const kmlText = await response.text();

        // 2. Parsear estilos del texto
        const { styles, styleMaps } = parseKmlStylesFromText(kmlText);

        // Usamos el grupo compartido en lugar de crear uno nuevo
        // const clusterGroup = L.markerClusterGroup();

        const customLayer = L.geoJson(null, {
            onEachFeature: (feature, layer) => {
                // Guardar carpeta en propiedades para usarla en selectFeature
                feature.properties._folder = layerConfig.folder;

                // Resolver icono
                let styleUrl = feature.properties.styleUrl;
                if (styleMaps.has(styleUrl)) {
                    styleUrl = styleMaps.get(styleUrl);
                }
                const iconPath = styles.get(styleUrl);
                if (iconPath) {
                    feature.properties.iconUrl = iconPath;
                }
                
                // Evento Click
                layer.on('click', (e) => {
                    L.DomEvent.stopPropagation(e);
                    selectFeature(layer);
                });
                
                // Evento Hover (opcional según petición "click (o un hover)")
                // Si ponemos hover, puede ser molesto si hay muchos puntos.
                // El usuario dijo "Cuando se haga click ( o un hover ) al item , muestra un circulo..."
                // Vamos a añadir el halo en hover también, pero temporal?
                // Mejor solo click para selección persistente con el panel.
                // Si quiere hover style, podemos usar CSS en el icono o evento mouseover.
                layer.on('mouseover', (e) => {
                    // Mostrar halo en hover si no es el seleccionado
                    if (selectedMarker !== layer) {
                        createHalo(e.latlng, true); // true = isHover
                    }
                    
                    // Mostrar tooltip con nombre
                    if (feature.properties.name) {
                        layer.bindTooltip(feature.properties.name, {
                            permanent: false,
                            direction: 'top',
                            className: 'marker-hover-tooltip',
                            offset: [0, -40] // Ajustar para que salga encima del icono
                        }).openTooltip();
                    }
                });

                layer.on('mouseout', (e) => {
                    // Quitar halo de hover
                    if (selectedMarker !== layer) {
                        clearSelection(true); // true = onlyHover
                    }
                    layer.closeTooltip();
                });
            },
            pointToLayer: (feature, latlng) => {
                let styleUrl = feature.properties.styleUrl;
                if (styleMaps.has(styleUrl)) {
                    styleUrl = styleMaps.get(styleUrl);
                }
                const iconPath = styles.get(styleUrl);
                
                let finalIconUrl = `${layerConfig.folder}/iconoDoc.png`; // Fallback
                if (iconPath) {
                    finalIconUrl = `${layerConfig.folder}/${iconPath}`;
                }

                return L.marker(latlng, {
                    icon: L.icon({
                        iconUrl: finalIconUrl,
                        iconSize: CONFIG.icons.size,
                        iconAnchor: CONFIG.icons.anchor,
                        popupAnchor: CONFIG.icons.popupAnchor
                    })
                });
            }
        });

        // 3. Parsear KML con omnivore usando el texto ya descargado
        omnivore.kml.parse(kmlText, null, customLayer);

        // Ejecutar lógica de carga inmediatamente (parse es síncrono y no dispara 'ready')
        // Guardar referencia para filtrado
        const key = layerConfig.folder; // 'actividades' o 'productores'
        layerGroups[key] = customLayer;

        sharedClusterGroup.addLayer(customLayer); // Añadir al grupo compartido
        
        customLayer.eachLayer(layer => group.addLayer(layer));
        verificarCargaCompleta();
        updateItemsMenu(); // Actualizar menú al cargar

    } catch (error) {
        console.error(`Error al cargar ${layerConfig.url}:`, error);
        verificarCargaCompleta();
    }
}

// --- Parsing de Estilos KML ---
function parseKmlStylesFromText(kmlText) {
    try {
        const parser = new DOMParser();
        const kmlDoc = parser.parseFromString(kmlText, 'application/xml');
        
        const styles = new Map();
        const styleMaps = new Map();

        // Parsear StyleMap
        kmlDoc.querySelectorAll('StyleMap').forEach(styleMap => {
            const id = styleMap.getAttribute('id');
            let normalStyleUrl = null;
            styleMap.querySelectorAll('Pair').forEach(pair => {
                const key = pair.querySelector('key');
                if (key && key.textContent.trim() === 'normal') {
                    normalStyleUrl = pair.querySelector('styleUrl');
                }
            });
            if (id && normalStyleUrl) {
                styleMaps.set(`#${id}`, normalStyleUrl.textContent.trim());
            }
        });

        // Parsear Style
        kmlDoc.querySelectorAll('Style').forEach(style => {
            const id = style.getAttribute('id');
            const iconHref = style.querySelector('Icon > href');
            if (id && iconHref) {
                styles.set(`#${id}`, iconHref.textContent.trim());
            }
        });

        return { styles, styleMaps };
    } catch (e) {
        console.error("Error parsing KML styles:", e);
        return { styles: new Map(), styleMaps: new Map() };
    }
}

// --- Mostrar Información en Panel ---
function displayFeatureInfo(feature, carpetaBase) {
    const properties = feature.properties;
    const name = properties.name || 'Sin título';
    const infoPanel = document.getElementById('info-panel');
    const panelTitle = document.getElementById('panel-title');
    const panelContent = document.getElementById('panel-content');
    const mapOverlay = document.getElementById('map-overlay');

    // Icono
    let iconHtml = '';
    if (properties.iconUrl) {
        const iconPath = `${carpetaBase}/${properties.iconUrl}`;
        iconHtml = `<img src="${iconPath}" class="popup-icon" onerror="this.style.display='none'">`;
    }

    // Mapeo de claves a iconos
    const keyIcons = {
        'telefono': '📞',
        'teléfono': '📞',
        'email': '✉️',
        'correo': '✉️',
        'web': '🌐',
        'Google Maps': '🗺️',
        'dirección': '📍',
        'direccion': '📍',
        'horario': '🕒',
        'estado': '⚪',                // estado genérico
        'descripcion': '📝',           // descripción / nota
        'detalle': '📝',                // alias
        'info': '📝',                   // alias
        'persona referencia': '👤',    // persona / contacto
        'referencia': '👤',             // alias más corto
        'pueblo': '🏘️',                // pueblo / localidad
        'localidad': '🏘️',             // alias
        'red social': '📡',             // enlace a redes sociales
        'social': '📡'                  // alias alternativo
    };

    // Detalles
    let detailsHtml = '';
    const details = Object.entries(properties)
        .filter(([key, value]) => value && !CONFIG.excludedDataFields.includes(key.toLowerCase()))
        .map(([key, value]) => {
            let displayValue = value;
            let displayKey = key;

            // Formatear Teléfono
            if (key.toLowerCase().includes('telefono') || key.toLowerCase().includes('teléfono')) {
                // Limpiar caracteres no numéricos excepto +
                const cleanPhone = value.toString().replace(/[^\d+]/g, '');
                // Formatear visualmente (opcional, aquí solo aseguramos entero limpio)
                displayValue = `<a href="tel:${cleanPhone}" class="phone-link">${value}</a>`;
            }

            // Formatear Email
            if (key.toLowerCase().includes('email') || key.toLowerCase().includes('correo')) {
                // En móvil clickable, en escritorio texto (según petición: "En escritorio prefiero que no se haga nada")
                // Detectamos móvil con L.Browser.mobile
                if (L.Browser.mobile) {
                    displayValue = `<a href="mailto:${value}">${value}</a>`;
                } else {
                    displayValue = value;
                }
            }

            // Formatear Web
            if (typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://'))) {
                displayValue = `<a href="${value}" target="_blank" rel="noopener noreferrer">${value}</a>`;
            }

            // Iconos para claves
            // Normalizar clave para búsqueda (quitar acentos y minúsculas)
            const normalizedKey = key.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            
            let icon = '';
            for (const [k, i] of Object.entries(keyIcons)) {
                // Normalizar también la clave del mapa
                const normalizedMapKey = k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                
                if (normalizedKey.includes(normalizedMapKey)) {
                    icon = `<span class="popup-key-icon">${i}</span>`;
                    break;
                }
            }
            
            // Si hay icono, ocultamos el texto de la clave o lo ponemos al lado?
            // "cambiar los conceptos por iconos" -> Solo icono
            if (icon) {
                displayKey = icon;
            } else {
                // Capitalizar primera letra si es texto
                displayKey = key.charAt(0).toUpperCase() + key.slice(1);
            }

            return `<tr><td>${displayKey}</td><td>${displayValue}</td></tr>`;
        })
        .join('');
    
    if (details) {
        detailsHtml = `<table class="popup-details-table">${details}</table>`;
    }

    // Navegación
    let navLinkHtml = '';
    if (properties.gx_media_links) {
        navLinkHtml = `<a href="${properties.gx_media_links}" class="popup-nav-link" target="_blank" rel="noopener noreferrer">📍 Cómo llegar</a>`;
    }

    // Render
    const panelBody = `
        ${detailsHtml}
        ${navLinkHtml}`;
    
    panelTitle.textContent = name;
    panelContent.innerHTML = panelBody;
    
    // Gestionar icono en título
    const oldIcon = panelTitle.parentElement.querySelector('.popup-icon');
    if (oldIcon) oldIcon.remove();
    if (iconHtml) panelTitle.insertAdjacentHTML('afterend', iconHtml);

    // Mostrar
    infoPanel.classList.add('visible');
    mapOverlay.classList.add('visible');

    // Gestión del historial para botón "Atrás" en móvil
    if (L.Browser.mobile) {
        // Añadir estado al historial
        history.pushState({ panelOpen: true }, null, "");
        
        // Escuchar evento popstate (botón atrás)
        // Usamos una función nombrada para poder removerla después y evitar duplicados
        window.onpopstate = function(event) {
            if (infoPanel.classList.contains('visible')) {
                closeInfoPanel();
                // Si el evento fue por el botón atrás, no hacemos nada más.
                // Si cerramos el panel manualmente, deberíamos hacer history.back() para limpiar el estado?
                // Mejor: Si cerramos manualmente, hacemos history.back() si el estado actual es panelOpen.
            }
        };
    }
}

// --- Gestión de Gestos Móviles (Google Maps style) ---
function initMobileGestures() {
    // Si está desactivado en config, usamos interacción nativa de Leaflet.
    // Importante: también evitamos que aparezca el mensaje de “dos dedos”.
    if (!CONFIG.mobileGestures || !CONFIG.mobileGestures.enableTwoFingerPanProtection) {
        const gestureOverlay = document.getElementById('gesture-overlay');
        if (gestureOverlay) {
            gestureOverlay.style.display = 'none';
            // Para asegurar que nunca aparezca por CSS/JS accidental, lo quitamos del DOM.
            gestureOverlay.remove();
        }
        return;
    }

    // Solo aplicar en dispositivos móviles
    if (!L.Browser.mobile) return;

    const mapContainer = map.getContainer();
    const gestureOverlay = document.getElementById('gesture-overlay');
    const gestureMsg = gestureOverlay ? gestureOverlay.querySelector('.gesture-msg') : null;
    if (gestureMsg && typeof CONFIG.mobileGestures.twoFingerMessage === 'string') {
        gestureMsg.textContent = CONFIG.mobileGestures.twoFingerMessage;
    }

    // Deshabilitar interacciones de movimiento por defecto en móvil
    // Mantenemos touchZoom habilitado para permitir pinch sin necesidad de lógica compleja,
    // ya que pinch requiere 2 dedos de forma nativa y no interfiere con el scroll de 1 dedo.
    map.dragging.disable();
    map.touchZoom.enable();
    
    // Usamos capture: true para interceptar el evento antes que Leaflet
    // y habilitar el dragging si es necesario.
    mapContainer.addEventListener('touchstart', (e) => {
        if (e.touches.length > 1) {
            // Dos o más dedos: Habilitar mapa
            if (!map.dragging.enabled()) {
                map.dragging.enable();
                map.touchZoom.enable();
            }
            if (gestureOverlay) gestureOverlay.style.display = 'none';
        } else {
            // Un dedo: Asegurar deshabilitado para permitir scroll de página
            // PERO: Si estamos en escritorio (L.Browser.mobile es false), esto no debería ejecutarse.
            // La función tiene un guard al principio: if (!L.Browser.mobile) return;
            // Así que esto solo afecta a móviles.
            
            if (map.dragging.enabled()) {
                map.dragging.disable();
                map.touchZoom.disable();
            }
        }
    }, { capture: true, passive: true });

    mapContainer.addEventListener('touchmove', (e) => {
        // Si estamos moviendo con un dedo y el mapa está deshabilitado, mostramos overlay
        if (e.touches.length === 1 && !map.dragging.enabled()) {
            if (gestureOverlay && gestureOverlay.style.display !== 'flex') {
                gestureOverlay.style.display = 'flex';
            }
        } else {
             if (gestureOverlay) gestureOverlay.style.display = 'none';
        }
    }, { passive: true });

    mapContainer.addEventListener('touchend', (e) => {
        // Si no quedan dedos, ocultar overlay y resetear
        if (e.touches.length === 0) {
            if (gestureOverlay) gestureOverlay.style.display = 'none';
            map.dragging.disable();
            // No deshabilitar touchZoom al terminar, para que esté listo para el próximo gesto
            // map.touchZoom.disable();
        }
    });
}
