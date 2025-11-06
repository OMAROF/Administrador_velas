document.addEventListener('DOMContentLoaded', function() {
    // =================================================================
    // 1. INICIALIZACIÓN Y CONFIGURACIÓN DE FIREBASE
    // =================================================================
    const firebaseConfig = {
        apiKey: "AIzaSyCHGc-cNmZoP_ieRCP6Qxr-EG8QGGU7LgU",
        authDomain: "adminvelas.firebaseapp.com",
        projectId: "adminvelas",
        storageBucket: "adminvelas.firebasestorage.app",
        messagingSenderId: "765865245335",
        appId: "1:765865245335:web:f8bb3269151cdbce8607d2"
    };

    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();

    // =================================================================
    // 2. DECLARACIÓN DE ELEMENTOS DE LA UI
    // =================================================================
    const catalogoClientesContainer = document.getElementById('catalogo-clientes-container');
    const catalogoClientesVacioMsg = document.getElementById('catalogo-clientes-vacio-msg');
    const filtroPublicoNombre = document.getElementById('filtro-publico-nombre');
    const filtroPublicoCategoria = document.getElementById('filtro-publico-categoria');
    const imageModalOverlay = document.getElementById('image-modal-overlay');
    const imageModalContent = document.getElementById('image-modal-content');
    const imageModalClose = document.getElementById('image-modal-close');

    let catalogoPublicoCompleto = []; // Almacenará todos los productos para filtrar

    // =================================================================
    // 3. DEFINICIÓN DE FUNCIONES
    // =================================================================

    /**
     * Calcula el costo total de producción de una vela.
     * @param {object} vela - El objeto de la vela del catálogo.
     * @returns {number} El costo total de producción.
     */
    function calcularCostoTotalVela(vela) {
        const costoIngredientes = vela.receta.reduce((total, item) => total + item.costo, 0);
        const costoGastosManuales = vela.gastosAdicionales.reduce((total, gasto) => total + gasto.monto, 0);
        const pctPerdida = vela.pctGastoPerdida || 0;
        const pctProduccion = vela.pctGastoProduccion || 0;
        const sumaPorcentajes = (pctPerdida + pctProduccion) / 100;
        const costoBase = costoIngredientes + costoGastosManuales;
        return (sumaPorcentajes < 1) ? costoBase / (1 - sumaPorcentajes) : costoBase;
    }

    /**
     * Renderiza el catálogo público en el contenedor HTML.
     * @param {Array<object>} catalogo - La lista de productos a renderizar.
     */
    function renderPublicCatalog(catalogo) {
        catalogoClientesContainer.innerHTML = '';

        if (!catalogo || catalogo.length === 0) {
            catalogoClientesVacioMsg.textContent = 'De momento no hay productos en este catálogo.';
            catalogoClientesContainer.appendChild(catalogoClientesVacioMsg);
            return;
        }

        catalogo.forEach(vela => {
            const card = document.createElement('div');
            card.className = 'card flex flex-col overflow-hidden rounded-lg shadow-lg p-0'; // Padding a 0 para que la imagen ocupe todo el ancho

            const costoTotal = calcularCostoTotalVela(vela);
            let precioVentaMinorista = costoTotal * (1 + (vela.margenGananciaMinorista || 0) / 100);
            precioVentaMinorista = Math.ceil(precioVentaMinorista); // Redondeo hacia arriba

            const imagenHtml = vela.imagenUrl 
                ? `<img src="${vela.imagenUrl}" alt="${vela.nombre}" class="w-full h-80 object-cover rounded-t-lg shadow-sm cursor-pointer" data-src="${vela.imagenUrl}">`
                : '<div class="w-full h-80 bg-gray-200 flex items-center justify-center rounded-t-lg"><span class="text-gray-500">Imagen no disponible</span></div>';

            card.innerHTML = `
                ${imagenHtml}
                <div class="p-6 flex-grow flex flex-col">
                    <h3 class="text-xl font-bold text-gray-900 mb-2">${vela.nombre}</h3>
                    <p class="text-gray-600 text-sm mb-4 flex-grow">${vela.caracteristicas || 'Descripción no disponible.'}</p>
                    <div class="mt-auto">
                        <p class="text-2xl font-extrabold text-gray-900 text-center mb-4">$${precioVentaMinorista.toFixed(2)} MXN</p>
                        <a href="https://wa.me/5211234567890?text=Hola,%20me%20interesa%20el%20producto%20'${encodeURIComponent(vela.nombre)}'" target="_blank" rel="noopener noreferrer" class="block w-full text-center bg-green-500 text-white font-bold py-3 px-4 rounded-lg hover:bg-green-600 transition-colors duration-300">
                            Contactar por WhatsApp
                        </a>
                    </div>
                </div>
            `;
            catalogoClientesContainer.appendChild(card);
        });
    }

    /**
     * Obtiene los datos del catálogo público desde Firestore.
     */
    async function fetchPublicCatalogData() {
        // UID específico del usuario cuyo catálogo se mostrará
        const userId = 'MeVpNiYcH6RSwWzkzLGnvdROYgE3';

        try {
            const snapshot = await db.collection('usuarios').doc(userId).collection('catalogo').orderBy('createdAt', 'desc').get();
            
            if (snapshot.empty) {
                renderPublicCatalog([]);
                return;
            }
            
            catalogoPublicoCompleto = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // Poblar filtro de categorías
            const categorias = [...new Set(
                catalogoPublicoCompleto.flatMap(p => p.categoria || [])
            )].sort();
            
            filtroPublicoCategoria.innerHTML = '<option value="">Todas las categorías</option>';
            categorias.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat;
                option.textContent = cat;
                filtroPublicoCategoria.appendChild(option);
            });

            // Renderizar el catálogo completo inicialmente
            renderPublicCatalog(catalogoPublicoCompleto);

        } catch (error) {
            console.error("Error al cargar el catálogo público:", error);
            catalogoClientesVacioMsg.textContent = 'No se pudo cargar el catálogo. Inténtalo de nuevo más tarde.';
        }
    }

    /**
     * Filtra y renderiza el catálogo basado en los inputs de búsqueda y categoría.
     */
    function filtrarCatalogo() {
        const textoBusqueda = filtroPublicoNombre.value.toLowerCase();
        const categoriaSeleccionada = filtroPublicoCategoria.value;

        const catalogoFiltrado = catalogoPublicoCompleto.filter(vela => {
            const matchNombre = !textoBusqueda || vela.nombre.toLowerCase().includes(textoBusqueda);
            
            let matchCategoria = !categoriaSeleccionada;
            if (vela.categoria && categoriaSeleccionada) {
                if (Array.isArray(vela.categoria)) {
                    matchCategoria = vela.categoria.includes(categoriaSeleccionada);
                }
            }
            return matchNombre && matchCategoria;
        });

        renderPublicCatalog(catalogoFiltrado);
    }

    // =================================================================
    // 4. ASIGNACIÓN DE EVENT LISTENERS
    // =================================================================
    filtroPublicoNombre.addEventListener('input', filtrarCatalogo);
    filtroPublicoCategoria.addEventListener('change', filtrarCatalogo);

    // --- Event Listeners para Image Modal ---
    catalogoClientesContainer.addEventListener('click', function(e) {
        if (e.target && e.target.dataset.src) {
            imageModalContent.src = e.target.dataset.src;
            imageModalOverlay.classList.remove('hidden');
        }
    });

    function closeModal() {
        imageModalOverlay.classList.add('hidden');
        imageModalContent.src = ''; // Limpia el src para detener la carga si se cierra rápido
    }

    imageModalClose.addEventListener('click', closeModal);
    imageModalOverlay.addEventListener('click', function(e) {
        // Cierra el modal solo si se hace clic en el fondo (overlay)
        if (e.target === imageModalOverlay) {
            closeModal();
        }
    });


    // =================================================================
    // 5. EJECUCIÓN INICIAL
    // =================================================================
    fetchPublicCatalogData();
});
