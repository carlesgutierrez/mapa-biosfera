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
    initColors();
    initMap();
    initUI();
    initLegend();
    loadLayers();
    initMobileGestures();
});

function initColors() {
    const root = document.documentElement;
    const c = CONFIG.colors;
    const ui = CONFIG.ui;
    if (c) {
        root.style.setProperty('--color-actividades', c.actividades);
        root.style.setProperty('--color-productores', c.productores);
        root.style.setProperty('--color-municipio-border', c.municipios.borderDefault);
        root.style.setProperty('--color-municipio-border-hover', c.municipios.borderHover);
        if (c.items) {
            root.style.setProperty('--halo-color', c.items.haloColor);
            root.style.setProperty('--halo-fill', c.items.haloFillColor);
            root.style.setProperty('--halo-weight', c.items.haloWeight + 'px');
        }
    }
    if (ui && ui.buttonGap) {
        root.style.setProperty('--button-gap', ui.buttonGap + 'px');
    }
    if (ui && ui.buttonGapMobile) {
        root.style.setProperty('--button-gap-mobile', ui.buttonGapMobile + 'px');
    }
}

function mostrarNotificacion(mensaje) {
    // Eliminar notificación existente si hay
    const existingToast = document.querySelector('.toast-notification');
    if (existingToast) {
        existingToast.remove();
    }

    // Crear nueva notificación
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.textContent = mensaje;

    // Agregar al body
    document.body.appendChild(toast);

    // Mostrar con animación
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    // Ocultar y eliminar después de 3 segundos
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300); // Esperar la transición
    }, 3000);
}

// --- Inicialización del Mapa ---
function initMap() {
    map = L.map('map', {
        zoomControl: true, // Desactivamos el control de zoom por defecto
        // Aumentamos el padding del renderizador (SVG) para que dibuje más área fuera de la vista
        renderer: L.svg({ padding: 1.0 }),
        tap: false
    }).setView(CONFIG.map.center, CONFIG.map.zoom);

    // Guardar zoom anterior para detectar dirección del zoom
    let lastZoom = map.getZoom();
    map.on('zoomend', () => {
        const currentZoom = map.getZoom();
        if (currentZoom < lastZoom) {
            // Zoom Out detectado
        }
        lastZoom = currentZoom;
    });

    // Configurar capas base dinámicamente desde CONFIG
    const baseLayers = {};

    Object.entries(CONFIG.map.tileLayers).forEach(([key, layerConfig]) => {
        const layerName = key.charAt(0).toUpperCase() + key.slice(1);

        const tileLayer = L.tileLayer(layerConfig.url, {
            attribution: layerConfig.attribution,
            keepBuffer: 8 // Mantener más teselas en memoria
        });

        baseLayers[layerName] = tileLayer;

        if (key === CONFIG.map.defaultLayer) {
            tileLayer.addTo(map);
        }
    });

    // Grupo para ajustar límites
    group = new L.FeatureGroup();

    // Inicializar grupo de clusters compartido
    sharedClusterGroup = L.markerClusterGroup({
        chunkedLoading: true, // Carga progresiva
        iconCreateFunction: function (cluster) {
            const markers = cluster.getAllChildMarkers();
            let hasProd = false;
            let hasAct = false;

            for (let i = 0; i < markers.length; i++) {
                const folder = markers[i].feature.properties._folder;
                if (folder === 'productores') hasProd = true;
                if (folder === 'actividades') hasAct = true;
                if (hasProd && hasAct) break;
            }

            let className = 'cluster-mix'; // Verde musgo por defecto (mezcla)
            if (hasProd && !hasAct) className = 'cluster-productores'; // Amarillo
            if (!hasProd && hasAct) className = 'cluster-actividades'; // Azul

            return L.divIcon({
                html: '<div><span>' + cluster.getChildCount() + '</span></div>',
                className: 'marker-cluster ' + className,
                iconSize: new L.Point(40, 40)
            });
        }
    });

    sharedClusterGroup.on('animationend', function () {
        console.log('♻️ Clusters reagrupados (animationend)');
        checkSelectionVisibility();
    });

    map.on('zoomend', function () {
        checkSelectionVisibility();
    });

    sharedClusterGroup.on('unspiderfied', function (e) {
        console.log('🕸️ Spiderfy cerrado (agrupado de nuevo)');
        if (selectedMarker && e.markers.includes(selectedMarker)) {
            clearSelection();
        }
    });

    function checkSelectionVisibility() {
        if (selectedMarker && sharedClusterGroup.hasLayer(selectedMarker)) {
            const visibleParent = sharedClusterGroup.getVisibleParent(selectedMarker);
            if (visibleParent && visibleParent !== selectedMarker) {
                console.log('🔒 Marcador seleccionado ha sido agrupado en un cluster - Limpiando selección');
                clearSelection();
            }
        }
    }

    map.addLayer(sharedClusterGroup);

    map.on('click', onMapClick);
}

function onMapClick(e) {
    console.log('🗺️ Click en mapa detectado - Limpiando selección');
    closeInfoPanel();
}

// --- Gestión del Menú Interactivo de Items ---

function initItemsMenuStructure() {
    const menuContainer = document.getElementById('items-menu');
    if (!menuContainer || menuContainer.children.length > 0) return;

    const grupos = ['productores', 'actividades'];
    grupos.forEach(key => {
        const div = document.createElement('div');
        div.id = `group-${key}`;
        div.className = `items-group group-${key}`;
        div.style.display = 'none';
        menuContainer.appendChild(div);
    });
}

function updateItemsGroup(type, isActive) {
    const groupContainer = document.getElementById(`group-${type}`);
    if (!groupContainer) return;

    if (!isActive) {
        groupContainer.style.display = 'none';
        return;
    }

    groupContainer.style.display = 'flex';

    if (groupContainer.children.length > 0) return;

    const layerGroup = layerGroups[type];
    if (!layerGroup) return;

    layerGroup.eachLayer(layer => {
        const props = layer.feature.properties;
        const name = props.name || 'Sin nombre';

        const btn = document.createElement('button');
        btn.className = `menu-item-btn type-${type}`;

        if (props.iconUrl) {
            const fullIconPath = `${type}/${props.iconUrl}`;
            const img = document.createElement('img');
            img.src = fullIconPath;
            btn.appendChild(img);
        }

        const span = document.createElement('span');
        span.textContent = name;
        btn.appendChild(span);

        btn.style.animationDelay = `${Math.random() * 0.3}s`;

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            zoomToFeature(layer);
        });

        groupContainer.appendChild(btn);
    });
}

function updateItemsMenu() {
    initItemsMenuStructure();
    Object.keys(layerGroups).forEach(type => {
        const legendItem = document.getElementById(`legend-${type}`);
        const isActive = legendItem && legendItem.classList.contains('active');
        updateItemsGroup(type, isActive);
    });
}

// Función unificada para seleccionar un feature (desde mapa o menú)
function selectFeature(layer) {
    const feature = layer.feature;
    const folder = feature.properties._folder;

    if (selectedMarker && selectedMarker !== layer) {
        clearSelection();
    }

    const isSpiderfied = !!layer._spiderLeg;

    selectedMarker = layer;
    createHalo(layer.getLatLng());

    if (isSpiderfied) {
        console.log("Marker spiderfied: Manteniendo posición.");
        displayFeatureInfo(feature, folder);
    } else {
        let targetLatLng = layer.getLatLng();
        let shouldMove = true;
        const targetZoom = Math.max(map.getZoom(), 16);

        if (window.innerWidth > 600) {
            const point = map.project(targetLatLng, targetZoom);
            const newPoint = point.add([200, 0]);
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
            map.flyTo(targetLatLng, targetZoom, { duration: 1.5 });
            map.once('moveend', () => {
                displayFeatureInfo(feature, folder);
            });
        } else {
            displayFeatureInfo(feature, folder);
        }
    }
}

function zoomToFeature(layer) {
    const visibleParent = sharedClusterGroup.getVisibleParent(layer);

    if (visibleParent === layer) {
        console.log('📍 Item visible -> Selección directa');
        selectFeature(layer);

    } else if (visibleParent instanceof L.MarkerCluster) {
        console.log('🔍 Item en cluster -> Zoom profundo');

        sharedClusterGroup.zoomToShowLayer(layer, () => {
            console.log('✅ Marcador revelado -> Seleccionando');
            setTimeout(() => {
                selectFeature(layer);
            }, 200);
        });
    } else {
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
    const closePanelBtn = document.getElementById('close-panel-btn');
    const mapOverlay = document.getElementById('map-overlay');

    if (closePanelBtn) closePanelBtn.addEventListener('click', closeInfoPanel);
    if (mapOverlay) mapOverlay.addEventListener('click', closeInfoPanel);

    const contrastBtn = document.getElementById('contrast-btn');
    if (contrastBtn) {
        contrastBtn.addEventListener('click', toggleContrastMode);
    }

    const shareBtn = document.getElementById('share-btn');
    if (shareBtn) {
        shareBtn.addEventListener('click', () => {
            const url = "https://www.sierradelrincon.org/productos-y-actividades/";
            const text = `Descubre los productos y actividades de la Sierra del Rincón en este mapa interactivo: ${url} #SierraDelRincón #ProductosLocales #Ecoturismo`;

            if (L.Browser.mobile && navigator.share) {
                navigator.share({
                    title: 'Reserva de la Biosfera Sierra del Rincón',
                    text: 'Descubre los productos y actividades de la Sierra del Rincón en este mapa interactivo:',
                    url: url
                }).catch(err => console.log('Error al compartir: ', err));
            } else if (L.Browser.mobile) {
                const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
                window.open(whatsappUrl, '_blank');
            } else {
                navigator.clipboard.writeText(text).then(() => {
                    mostrarNotificacion('¡Enlace copiado correctamente!');
                }).catch(err => {
                    console.error('Error al copiar: ', err);
                    mostrarNotificacion('No se pudo copiar al portapapeles. Por favor, copia el enlace manualmente.');
                });
            }
        });
    }

    const resetViewBtn = document.getElementById('reset-view-btn');
    if (resetViewBtn) {
        resetViewBtn.addEventListener('click', () => toggleMapView());
    }

    const zoomInBtn = document.getElementById('zoom-in-btn');
    const zoomOutBtn = document.getElementById('zoom-out-btn');
    if (zoomInBtn) {
        zoomInBtn.addEventListener('click', () => map.zoomIn());
    }
    if (zoomOutBtn) {
        zoomOutBtn.addEventListener('click', () => map.zoomOut());
    }

    // Lógica de botones Fullscreen / Nueva Pestaña
    const fullscreenBtn = document.getElementById('fullscreen-toggle'); // Nueva pestaña
    const fullscreenNativeBtn = document.getElementById('fullscreen-native-btn'); // Fullscreen nativo

    const isIframe = window.self !== window.top;

    if (isIframe) {
        // Estamos en iframe: Mostrar "Nueva Pestaña", Ocultar "Fullscreen"
        if (fullscreenBtn) {
            fullscreenBtn.style.display = 'flex';
            fullscreenBtn.addEventListener('click', () => {
                window.open(window.location.href, '_blank');
            });
        }
        if (fullscreenNativeBtn) fullscreenNativeBtn.style.display = 'none';
    } else {
        // NO estamos en iframe: Ocultar "Nueva Pestaña", Mostrar "Fullscreen"
        if (fullscreenBtn) fullscreenBtn.style.display = 'none';
        if (fullscreenNativeBtn) {
            fullscreenNativeBtn.style.display = 'flex';
            fullscreenNativeBtn.addEventListener('click', () => {
                if (!document.fullscreenElement) {
                    document.documentElement.requestFullscreen().catch(err => {
                        console.log(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
                    });
                } else {
                    if (document.exitFullscreen) {
                        document.exitFullscreen();
                    }
                }
            });
        }
    }

    // Posicionamiento de botones
    if (CONFIG.ui && CONFIG.ui.buttonPositions) {
        const controlsContainer = document.querySelector('.right-center-controls');
        const zoomContainer = document.querySelector('.custom-zoom-controls');

        if (controlsContainer && CONFIG.ui.buttonPositions.controls === 'left') {
            controlsContainer.classList.remove('right-center-controls');
            controlsContainer.classList.add('left-center-controls');

            const shareBtn = document.getElementById('share-btn');
            const contrastBtn = document.getElementById('contrast-btn');

            if (shareBtn) controlsContainer.appendChild(shareBtn);
            if (resetViewBtn) controlsContainer.appendChild(resetViewBtn);
            if (contrastBtn) controlsContainer.appendChild(contrastBtn);
            if (fullscreenBtn) controlsContainer.appendChild(fullscreenBtn);
            if (fullscreenNativeBtn) controlsContainer.appendChild(fullscreenNativeBtn);
        }

        if (zoomContainer && CONFIG.ui.buttonPositions.zoom === 'right') {
            zoomContainer.style.left = 'auto';
            zoomContainer.style.right = '20px';
        }
    }
}

function toggleItemsMenu() {
    const menu = document.getElementById('items-menu');
    const btn = document.getElementById('menu-toggle-btn');

    if (menu) {
        const isVisible = menu.classList.toggle('visible');

        if (btn) {
            if (isVisible) {
                btn.classList.add('active');
                document.body.classList.add('menu-open');
            } else {
                btn.classList.remove('active');
                document.body.classList.remove('menu-open');
            }
        }

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
        clearSelection();

        if (L.Browser.mobile && history.state && history.state.panelOpen) {
            history.back();
        }
    }
}

let hoverHalo = null;
let sharedHoverHalo = null;
let sharedSelectedHalo = null;

function getHaloMarker(isHover) {
    const haloSize = 50;
    const iconHeight = CONFIG.icons.size[1];

    const createIcon = () => L.divIcon({
        className: 'marker-selected-halo',
        iconSize: [haloSize, haloSize],
        iconAnchor: [haloSize / 2, haloSize / 2 + iconHeight / 2]
    });

    if (isHover) {
        if (!sharedHoverHalo) {
            sharedHoverHalo = L.marker([0, 0], {
                icon: createIcon(),
                zIndexOffset: -1000,
                interactive: false
            });
        }
        return sharedHoverHalo;
    } else {
        if (!sharedSelectedHalo) {
            sharedSelectedHalo = L.marker([0, 0], {
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

    if (selectedMarker) {
        selectedMarker = null;
    }
}

function createHalo(latlng, isHover = false) {
    if (!isHover) {
        clearSelection();
    } else {
        if (hoverHalo) hoverHalo.remove();
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
    const btnAll = document.getElementById('legend-all');
    if (btnAll) {
        btnAll.classList.add('active');
        btnAll.addEventListener('click', () => {
            selectCategory('all');
        });
    }

    const legendItems = {
        'actividades': document.getElementById('legend-actividades'),
        'productores': document.getElementById('legend-productores')
    };

    Object.entries(legendItems).forEach(([key, element]) => {
        if (element) {
            element.classList.add('active');

            element.addEventListener('click', () => {
                selectCategory(key);
            });
        }
    });
}

function selectCategory(selectedType) {
    const types = ['productores', 'actividades'];
    
    let isAlreadySelected = false;
    if (selectedType === 'all') {
        const allBtn = document.getElementById('legend-all');
        isAlreadySelected = allBtn && allBtn.classList.contains('active');
    } else {
        const btn = document.getElementById(`legend-${selectedType}`);
        const allBtn = document.getElementById('legend-all');
        isAlreadySelected = btn && btn.classList.contains('active') && allBtn && !allBtn.classList.contains('active');
    }

    const menu = document.getElementById('items-menu');
    if (menu && menu.children.length === 0) {
        initItemsMenuStructure(); // Esto crea los groupContainers
    }
    
    if (isAlreadySelected) {
        if (menu) {
            const isVisible = menu.classList.toggle('visible');
            if (isVisible) {
                document.body.classList.add('menu-open');
            } else {
                document.body.classList.remove('menu-open');
            }
        }
        return;
    }
    
    types.forEach(type => {
        const element = document.getElementById(`legend-${type}`);
        const layer = layerGroups[type];
        
        let shouldBeActive = (selectedType === 'all' || type === selectedType);
        
        if (shouldBeActive) {
            if (element) {
                element.classList.remove('inactive');
                element.classList.add('active');
            }
            if (layer) {
                sharedClusterGroup.removeLayer(layer); // Evitar duplicados por si acaso
                sharedClusterGroup.addLayer(layer);
            }
        } else {
            if (element) {
                element.classList.remove('active');
                element.classList.add('inactive');
            }
            if (layer) {
                sharedClusterGroup.removeLayer(layer);
            }
        }
        
        updateItemsGroup(type, shouldBeActive);
    });

    const btnAll = document.getElementById('legend-all');
    if (btnAll) {
        if (selectedType === 'all') {
            btnAll.classList.add('active');
            btnAll.classList.remove('inactive');
        } else {
            btnAll.classList.remove('active');
            btnAll.classList.add('inactive');
        }
    }

    if (menu && !menu.classList.contains('visible')) {
        menu.classList.add('visible');
        document.body.classList.add('menu-open');
    }
}

let savedView = null;

function toggleMapView() {
    const currentCenter = map.getCenter();
    const currentZoom = map.getZoom();
    const initialCenter = L.latLng(CONFIG.map.center);
    const initialZoom = CONFIG.map.zoom;

    // Comprobar si estamos en la vista inicial (con margen de error)
    const dist = currentCenter.distanceTo(initialCenter);
    const isAtInitial = dist < 500 && currentZoom === initialZoom;

    if (isAtInitial && savedView) {
        // Volver a la vista guardada
        map.setView(savedView.center, savedView.zoom, { animate: true });
        // Opcional: limpiar savedView si queremos que el siguiente click vuelva a inicial
        // savedView = null;
    } else {
        // Guardar vista actual y volver a inicial
        if (!isAtInitial) {
            savedView = { center: currentCenter, zoom: currentZoom };
        }
        map.setView(initialCenter, initialZoom, { animate: true });
    }
}

function resetMapView(zoomOffset = 0) {
    // Legacy support or fallback
    toggleMapView();
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
            resetMapView(1);
        }
    }
}

// --- Lógica de Municipios ---
function loadMunicipios(layerConfig) {
    fetch(layerConfig.url)
        .then(response => response.text())
        .then(kmlText => {
            const tempLayer = omnivore.kml.parse(kmlText);

            tempLayer.eachLayer(l => {
                if (l.getBounds) {
                    const center = l.getBounds().getCenter();
                    l.feature.properties._center = { lat: center.lat, lng: center.lng };
                }
            });

            const geoJsonData = tempLayer.toGeoJSON();

            const vectorGridLayer = L.vectorGrid.slicer(geoJsonData, {
                rendererFactory: L.canvas.tile,
                vectorTileLayerStyles: {
                    sliced: CONFIG.styles.municipios
                },
                interactive: true,
                getFeatureId: function (f) {
                    return f.properties.name;
                }
            });

            // Etiquetas fijas para municipios
            geoJsonData.features.forEach(feature => {
                if (feature.properties && feature.properties.name && feature.properties._center) {
                    const center = feature.properties._center;
                    L.marker(center, {
                        icon: L.divIcon({
                            className: 'municipio-label-icon',
                            html: `<div class="municipio-label-content">${feature.properties.name}</div>`,
                            iconSize: [120, 20],
                            iconAnchor: [60, 10]
                        }),
                        interactive: false,
                        zIndexOffset: -500
                    }).addTo(map);
                }
            });

            let highlightLayer = null;

            vectorGridLayer.on('mouseover', function (e) {
                const featureName = e.layer.properties.name;

                // Limpiar highlight anterior si existe
                if (highlightLayer) {
                    map.removeLayer(highlightLayer);
                }

                // Buscar el feature correspondiente
                const feature = geoJsonData.features.find(f => f.properties.name === featureName);

                if (feature) {
                    highlightLayer = L.geoJson(feature, {
                        style: {
                            color: CONFIG.colors.municipios.borderHover,
                            weight: 5,
                            opacity: 1,
                            fillColor: CONFIG.colors.municipios.fillDefault,
                            fillOpacity: CONFIG.colors.municipios.fillOpacityHover,
                            fill: true,
                            dashArray: null
                        },
                        interactive: false
                    }).addTo(map);
                }
            });

            vectorGridLayer.on('mouseout', function (e) {
                if (highlightLayer) {
                    map.removeLayer(highlightLayer);
                    highlightLayer = null;
                }
            });

            if (CONFIG.enableMunicipalityPopups) {
                vectorGridLayer.on('click', function (e) {
                    L.popup()
                        .setLatLng(e.latlng)
                        .setContent(`<b>${e.layer.properties.name}</b>`)
                        .openOn(map);
                });
            }

            tempLayer.eachLayer(layer => group.addLayer(layer));

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
        // Fetch para estilos (necesario para parseKmlStylesFromText)
        const response = await fetch(layerConfig.url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const kmlText = await response.text();

        const { styles, styleMaps } = parseKmlStylesFromText(kmlText);

        const customLayer = L.geoJson(null, {
            onEachFeature: (feature, layer) => {
                feature.properties._folder = layerConfig.folder;

                let styleUrl = feature.properties.styleUrl;
                if (styleMaps.has(styleUrl)) {
                    styleUrl = styleMaps.get(styleUrl);
                }
                const iconPath = styles.get(styleUrl);
                if (iconPath) {
                    feature.properties.iconUrl = iconPath;
                }

                layer.on('click', (e) => {
                    L.DomEvent.stopPropagation(e);
                    selectFeature(layer);
                });

                layer.on('mouseover', (e) => {
                    if (selectedMarker !== layer) {
                        createHalo(e.latlng, true);
                    }
                    if (feature.properties.name) {
                        layer.bindTooltip(feature.properties.name, {
                            permanent: false,
                            direction: 'top',
                            className: 'marker-hover-tooltip',
                            offset: [0, -40]
                        }).openTooltip();
                    }
                });

                layer.on('mouseout', (e) => {
                    if (selectedMarker !== layer) {
                        clearSelection(true);
                    }
                    layer.closeTooltip();
                });
            },
            pointToLayer: (feature, latlng) => {
                // 1. Prioridad: Icono Emoji (si existe en propiedades y no es URL)
                // Solo se aplica si NO está activada la preferencia por iconos KML en config
                if (!CONFIG.useKmlIcons && feature.properties.icon && !feature.properties.icon.startsWith('http') && !feature.properties.icon.startsWith('/')) {
                    return L.marker(latlng, {
                        icon: L.divIcon({
                            className: 'emoji-marker',
                            html: `<div style="font-size: 28px; line-height: 1; text-align: center;">${feature.properties.icon}</div>`,
                            iconSize: [30, 30],
                            iconAnchor: [15, 15],
                            popupAnchor: [0, -15]
                        })
                    });
                }

                // 2. Estilo KML estándar
                let styleUrl = feature.properties.styleUrl;
                if (styleMaps.has(styleUrl)) {
                    styleUrl = styleMaps.get(styleUrl);
                }
                const iconPath = styles.get(styleUrl);

                let finalIconUrl = `${layerConfig.folder}/iconoDoc.png`; // Fallback

                if (iconPath) {
                    // Detectar si es URL absoluta o relativa
                    if (iconPath.startsWith('http') || iconPath.startsWith('//')) {
                        // Si es la imagen genérica de Google, preferimos el fallback si no hay emoji
                        if (!iconPath.includes('blank_maps.png')) {
                            finalIconUrl = iconPath;
                        }
                    } else {
                        finalIconUrl = `${layerConfig.folder}/${iconPath}`;
                    }
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

        // Usar omnivore.kml(url) estándar para asegurar carga correcta de iconos
        omnivore.kml(layerConfig.url, null, customLayer)
            .on('ready', function () {
                const key = layerConfig.folder;
                layerGroups[key] = this;

                sharedClusterGroup.addLayer(this);

                this.eachLayer(layer => group.addLayer(layer));
                verificarCargaCompleta();
                updateItemsMenu();
            })
            .on('error', function (error) {
                console.error(`Error al cargar ${layerConfig.url}:`, error);
                verificarCargaCompleta();
            });

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

    let iconHtml = '';
    if (properties.iconUrl) {
        const iconPath = `${carpetaBase}/${properties.iconUrl}`;
        let secondaryIconHtml = '';

        // Lógica para logos circulares (en Productores y Actividades)
        if (properties.iconUrl && properties.iconUrl.includes('icon-')) {
            const iconIndexMatch = properties.iconUrl.match(/icon-(\d+)\.png/);
            if (iconIndexMatch) {
                const iconIndex = iconIndexMatch[1];
                let logoFilename = null;

                if (carpetaBase === 'productores' && CONFIG.producerLogos) {
                    logoFilename = CONFIG.producerLogos[iconIndex];
                } else if (carpetaBase === 'actividades' && CONFIG.actividadesLogos) {
                    logoFilename = CONFIG.actividadesLogos[iconIndex];
                }

                if (logoFilename) {
                    const logoPath = `${carpetaBase}/images/${logoFilename}`;
                    secondaryIconHtml = `<img src="${logoPath}" class="popup-icon popup-secondary-icon" onerror="this.style.display='none'">`;
                }
            }
        }

        if (secondaryIconHtml) {
            iconHtml = `
                <div class="popup-icon-container">
                    ${secondaryIconHtml}
                    <img src="${iconPath}" class="popup-icon" onerror="this.style.display='none'">
                </div>`;
        } else {
            iconHtml = `<img src="${iconPath}" class="popup-icon" onerror="this.style.display='none'">`;
        }
    }

    const keyIcons = {
        'telefono': '📞', 'teléfono': '📞', 'email': '✉️', 'correo': '✉️',
        'web': '🌐', 'Google Maps': '🗺️', 'dirección': '📍', 'direccion': '📍',
        'horario': '🕒', 'descripcion': '📝', 'detalle': '📝',
        'info': '📝', 'persona referencia': '👤', 'referencia': '👤',
        'pueblo': '🏘️', 'localidad': '🏘️', 'red social': '📡', 'social': '📡'
    };

    let detailsHtml = '';
    const details = Object.entries(properties)
        .filter(([key, value]) => value && !CONFIG.excludedDataFields.includes(key.toLowerCase()))
        .map(([key, value]) => {
            let displayValue = value;
            let displayKey = key;

            if (key.toLowerCase().includes('telefono') || key.toLowerCase().includes('teléfono')) {
                const cleanPhone = value.toString().replace(/[^\d+]/g, '');
                displayValue = `<a href="tel:${cleanPhone}" class="phone-link">${value}</a>`;
            }

            if (key.toLowerCase().includes('email') || key.toLowerCase().includes('correo')) {
                if (L.Browser.mobile) {
                    displayValue = `<a href="mailto:${value}">${value}</a>`;
                } else {
                    displayValue = value;
                }
            }

            if (typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://'))) {
                displayValue = `<a href="${value}" target="_blank" rel="noopener noreferrer">${value}</a>`;
            }

            const normalizedKey = key.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            let icon = '';

            if (normalizedKey === 'estado') {
                const isActivo = value.toString().toLowerCase().trim() === 'activo';
                icon = `<span class="popup-key-icon">${isActivo ? '🟢' : '🟡'}</span>`;
            } else {
                for (const [k, i] of Object.entries(keyIcons)) {
                    const normalizedMapKey = k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                    if (normalizedKey.includes(normalizedMapKey)) {
                        icon = `<span class="popup-key-icon">${i}</span>`;
                        break;
                    }
                }
            }

            if (icon) {
                displayKey = icon;
            } else {
                displayKey = key.charAt(0).toUpperCase() + key.slice(1);
            }

            return `<tr><td>${displayKey}</td><td>${displayValue}</td></tr>`;
        })
        .join('');

    if (details) {
        detailsHtml = `<table class="popup-details-table">${details}</table>`;
    }

    let navLinkHtml = '';
    if (properties.gx_media_links) {
        navLinkHtml = `<a href="${properties.gx_media_links}" class="popup-nav-link" target="_blank" rel="noopener noreferrer">📍 Cómo llegar</a>`;
    }

    const panelBody = `
        ${detailsHtml}
        ${navLinkHtml}`;

    panelTitle.textContent = name;
    panelContent.innerHTML = panelBody;

    const oldIcons = panelTitle.parentElement.querySelectorAll('.popup-icon, .popup-icon-container');
    oldIcons.forEach(icon => icon.remove());
    if (iconHtml) panelTitle.insertAdjacentHTML('afterend', iconHtml);

    infoPanel.classList.add('visible');
    mapOverlay.classList.add('visible');

    if (L.Browser.mobile) {
        history.pushState({ panelOpen: true }, null, "");
        window.onpopstate = function (event) {
            if (infoPanel.classList.contains('visible')) {
                closeInfoPanel();
            }
        };
    }
}

function initMobileGestures() {
    if (!CONFIG.mobileGestures || !CONFIG.mobileGestures.enableTwoFingerPanProtection) {
        const gestureOverlay = document.getElementById('gesture-overlay');
        if (gestureOverlay) {
            gestureOverlay.style.display = 'none';
            gestureOverlay.remove();
        }
        return;
    }

    if (!L.Browser.mobile) return;

    const mapContainer = map.getContainer();
    const gestureOverlay = document.getElementById('gesture-overlay');
    const gestureMsg = gestureOverlay ? gestureOverlay.querySelector('.gesture-msg') : null;
    if (gestureMsg && typeof CONFIG.mobileGestures.twoFingerMessage === 'string') {
        gestureMsg.textContent = CONFIG.mobileGestures.twoFingerMessage;
    }

    map.dragging.disable();
    map.touchZoom.enable();

    mapContainer.addEventListener('touchstart', (e) => {
        if (e.touches.length > 1) {
            if (!map.dragging.enabled()) {
                map.dragging.enable();
                map.touchZoom.enable();
            }
            if (gestureOverlay) gestureOverlay.style.display = 'none';
        } else {
            if (map.dragging.enabled()) {
                map.dragging.disable();
                map.touchZoom.disable();
            }
        }
    }, { capture: true, passive: true });

    mapContainer.addEventListener('touchmove', (e) => {
        if (e.touches.length === 1 && !map.dragging.enabled()) {
            if (gestureOverlay && gestureOverlay.style.display !== 'flex') {
                gestureOverlay.style.display = 'flex';
            }
        } else {
            if (gestureOverlay) gestureOverlay.style.display = 'none';
        }
    }, { passive: true });

    mapContainer.addEventListener('touchend', (e) => {
        if (e.touches.length === 0) {
            if (gestureOverlay) gestureOverlay.style.display = 'none';
            map.dragging.disable();
        }
    });
}
