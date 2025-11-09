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
    // 2. DECLARACIÓN DE ELEMENTOS Y ESTADO GLOBAL
    // =================================================================
    const catalogoClientesContainer = document.getElementById('catalogo-clientes-container');
    const catalogoClientesVacioMsg = document.getElementById('catalogo-clientes-vacio-msg');
    const filtroPublicoNombre = document.getElementById('filtro-publico-nombre');
    const filtroPublicoCategoria = document.getElementById('filtro-publico-categoria');
    const paginacionContainer = document.getElementById('catalogo-publico-paginacion');
    
    // Modales
    const imageModalOverlay = document.getElementById('image-modal-overlay');
    const imageModalContent = document.getElementById('image-modal-content');
    const imageModalClose = document.getElementById('image-modal-close');
    const detailsModalOverlay = document.getElementById('details-modal-overlay');
    const detailsModalContent = document.getElementById('details-modal-content');
    const detailsModalClose = document.getElementById('details-modal-close');

    let catalogoPublicoCompleto = [];
    let paginaActual = 1;
    const itemsPorPagina = 10;

    // =================================================================
    // 3. DEFINICIÓN DE FUNCIONES
    // =================================================================

    function calcularCostoTotalVela(vela) {
        const costoIngredientes = vela.receta.reduce((total, item) => total + item.costo, 0);
        const costoGastosManuales = vela.gastosAdicionales.reduce((total, gasto) => total + gasto.monto, 0);
        const pctPerdida = vela.pctGastoPerdida || 0;
        const pctProduccion = vela.pctGastoProduccion || 0;
        const sumaPorcentajes = (pctPerdida + pctProduccion) / 100;
        const costoBase = costoIngredientes + costoGastosManuales;
        return (sumaPorcentajes < 1) ? costoBase / (1 - sumaPorcentajes) : costoBase;
    }

    function renderPublicCatalog(catalogo) {
        catalogoClientesContainer.innerHTML = '';

        if (!catalogo || catalogo.length === 0) {
            catalogoClientesVacioMsg.textContent = 'No se encontraron productos con los filtros actuales.';
            catalogoClientesContainer.appendChild(catalogoClientesVacioMsg);
            return;
        }

        catalogo.forEach(vela => {
            const card = document.createElement('div');
            card.className = 'card flex flex-col overflow-hidden rounded-lg shadow-lg p-0';

            const costoTotal = calcularCostoTotalVela(vela);
            let precioVentaMinorista = costoTotal * (1 + (vela.margenGananciaMinorista || 0) / 100);
            precioVentaMinorista = Math.ceil(precioVentaMinorista);

            let imageGalleryHtml = '';
            if (vela.imagenUrls && vela.imagenUrls.length > 0) {
                const images = vela.imagenUrls.map((url, index) => 
                    `<div class="gallery-slide ${index === 0 ? 'active' : ''}" style="background-image: url('${url}');"></div>`
                ).join('');
                const dots = vela.imagenUrls.map((_, index) => 
                    `<span class="gallery-dot ${index === 0 ? 'active' : ''}" data-slide-to="${index}"></span>`
                ).join('');

                imageGalleryHtml = `
                    <div class="gallery-container" data-vela-id="${vela.id}">
                        <div class="gallery-slides">${images}</div>
                        <button class="gallery-prev">&lt;</button>
                        <button class="gallery-next">&gt;</button>
                        <div class="gallery-dots">${dots}</div>
                    </div>
                `;
            } else {
                imageGalleryHtml = '<div class="w-full h-72 bg-gray-200 flex items-center justify-center rounded-t-lg"><span class="text-gray-500">Imagen no disponible</span></div>';
            }

            const descripcionEscapada = (vela.caracteristicas || 'Descripción no disponible.').replace(/"/g, '&quot;');

            card.innerHTML = `
                ${imageGalleryHtml}
                <div class="px-4 py-6 flex-grow flex flex-col">
                    <h3 class="text-xl font-bold text-gray-900 mb-2 flex-grow">${vela.nombre}</h3>
                    <button data-description="${descripcionEscapada}" class="text-sm text-indigo-600 hover:text-indigo-800 font-semibold mt-2 mb-4 focus:outline-none self-start">Más detalles</button>
                    <div class="mt-auto">
                        <p class="text-2xl font-extrabold text-gray-900 text-center mb-4">$${precioVentaMinorista.toFixed(2)} MXN</p>
                        <a href="https://wa.me/529994975170?text=Hola,%20me%20interesa%20el%20producto%20'${encodeURIComponent(vela.nombre)}'" target="_blank" rel="noopener noreferrer" class="block w-full text-center bg-green-500 text-white font-bold py-2 px-3 text-sm rounded-lg hover:bg-green-600 transition-colors duration-300">
                            Contactar por WhatsApp
                        </a>
                    </div>
                </div>
            `;
            catalogoClientesContainer.appendChild(card);
        });

        setupGalleries();
    }

    function setupGalleries() {
        const galleries = document.querySelectorAll('.gallery-container');
        galleries.forEach(gallery => {
            let currentIndex = 0;
            const slides = gallery.querySelectorAll('.gallery-slide');
            const dots = gallery.querySelectorAll('.gallery-dot');
            const totalSlides = slides.length;
            let intervalId = null;

            if (totalSlides <= 1) {
                gallery.querySelector('.gallery-prev').style.display = 'none';
                gallery.querySelector('.gallery-next').style.display = 'none';
                gallery.querySelector('.gallery-dots').style.display = 'none';
                
                if (totalSlides === 1) {
                    slides[0].addEventListener('click', () => {
                        const velaId = gallery.dataset.velaId;
                        const vela = catalogoPublicoCompleto.find(v => v.id === velaId);
                        if (vela && vela.imagenUrls) {
                            openImageModal(vela.imagenUrls, 0);
                        }
                    });
                }
                return;
            }

            function showSlide(index) {
                slides.forEach((slide, i) => {
                    slide.classList.toggle('active', i === index);
                });
                dots.forEach((dot, i) => {
                    dot.classList.toggle('active', i === index);
                });
                currentIndex = index;
            }

            function nextSlide() {
                const nextIndex = (currentIndex + 1) % totalSlides;
                showSlide(nextIndex);
            }

            function startSlideshow() {
                stopSlideshow(); // Evita multiples intervalos
                intervalId = setInterval(nextSlide, 2500);
            }

            function stopSlideshow() {
                clearInterval(intervalId);
            }

            gallery.querySelector('.gallery-next').addEventListener('click', () => {
                nextSlide();
                stopSlideshow(); // Para la rotación automática si el usuario interactúa
            });

            gallery.querySelector('.gallery-prev').addEventListener('click', () => {
                const prevIndex = (currentIndex - 1 + totalSlides) % totalSlides;
                showSlide(prevIndex);
                stopSlideshow();
            });

            dots.forEach(dot => {
                dot.addEventListener('click', (e) => {
                    const slideIndex = parseInt(e.target.dataset.slideTo, 10);
                    showSlide(slideIndex);
                    stopSlideshow();
                });
            });

            slides.forEach((slide, index) => {
                slide.addEventListener('click', () => {
                    const velaId = gallery.dataset.velaId;
                    const vela = catalogoPublicoCompleto.find(v => v.id === velaId);
                    if (vela && vela.imagenUrls) {
                        openImageModal(vela.imagenUrls, index);
                    }
                });
            });

            gallery.addEventListener('mouseenter', stopSlideshow);
            gallery.addEventListener('mouseleave', startSlideshow);

            startSlideshow();
        });
    }

    function renderizarPaginacion(itemsFiltrados) {
        paginacionContainer.innerHTML = '';
        const totalPaginas = Math.ceil(itemsFiltrados.length / itemsPorPagina);

        if (totalPaginas <= 1) return;

        const btnAnterior = document.createElement('button');
        btnAnterior.textContent = 'Anterior';
        btnAnterior.className = 'btn-neutral';
        btnAnterior.disabled = paginaActual === 1;
        btnAnterior.addEventListener('click', () => {
            if (paginaActual > 1) {
                paginaActual--;
                actualizarVistaCatalogo();
            }
        });
        paginacionContainer.appendChild(btnAnterior);

        const indicadorPagina = document.createElement('span');
        indicadorPagina.className = 'text-lg font-medium';
        indicadorPagina.textContent = `Página ${paginaActual} de ${totalPaginas}`;
        paginacionContainer.appendChild(indicadorPagina);

        const btnSiguiente = document.createElement('button');
        btnSiguiente.textContent = 'Siguiente';
        btnSiguiente.className = 'btn-neutral';
        btnSiguiente.disabled = paginaActual === totalPaginas;
        btnSiguiente.addEventListener('click', () => {
            if (paginaActual < totalPaginas) {
                paginaActual++;
                actualizarVistaCatalogo();
            }
        });
        paginacionContainer.appendChild(btnSiguiente);
    }

    function actualizarVistaCatalogo() {
        const textoBusqueda = filtroPublicoNombre.value.toLowerCase();
        const categoriaSeleccionada = filtroPublicoCategoria.value;

        const catalogoFiltrado = catalogoPublicoCompleto.filter(vela => {
            const matchNombre = !textoBusqueda || vela.nombre.toLowerCase().includes(textoBusqueda);
            const matchCategoria = !categoriaSeleccionada || (Array.isArray(vela.categoria) && vela.categoria.includes(categoriaSeleccionada));
            return matchNombre && matchCategoria;
        });

        const inicio = (paginaActual - 1) * itemsPorPagina;
        const fin = inicio + itemsPorPagina;
        const itemsPagina = catalogoFiltrado.slice(inicio, fin);

        renderPublicCatalog(itemsPagina);
        renderizarPaginacion(catalogoFiltrado);
    }

    async function fetchPublicCatalogData() {
        const params = new URLSearchParams(window.location.search);
        const userId = params.get('user');

        if (!userId) {
            catalogoClientesVacioMsg.textContent = 'No se ha especificado un catálogo. El enlace puede ser incorrecto.';
            return;
        }

        try {
            const snapshot = await db.collection('usuarios').doc(userId).collection('catalogo').orderBy('createdAt', 'desc').get();
            
            if (snapshot.empty) {
                catalogoClientesVacioMsg.textContent = 'De momento no hay productos en este catálogo.';
                return;
            }
            
            catalogoPublicoCompleto = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            const categorias = [...new Set(catalogoPublicoCompleto.flatMap(p => p.categoria || []))].sort();
            filtroPublicoCategoria.innerHTML = '<option value="">Todas las categorías</option>';
            categorias.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat;
                option.textContent = cat;
                filtroPublicoCategoria.appendChild(option);
            });

            actualizarVistaCatalogo();

        } catch (error) {
            console.error("Error al cargar el catálogo público:", error);
            catalogoClientesVacioMsg.textContent = 'No se pudo cargar el catálogo. Verifica el enlace o inténtalo de nuevo más tarde.';
        }
    }

    // =================================================================
    // 4. ASIGNACIÓN DE EVENT LISTENERS
    // =================================================================
    filtroPublicoNombre.addEventListener('input', () => {
        paginaActual = 1;
        actualizarVistaCatalogo();
    });
    filtroPublicoCategoria.addEventListener('change', () => {
        paginaActual = 1;
        actualizarVistaCatalogo();
    });

    function openImageModal(imageUrls, startIndex) {
        const modalSlidesContainer = document.getElementById('modal-slides-container');
        if (!modalSlidesContainer) return;

        modalSlidesContainer.innerHTML = imageUrls.map((url, index) => 
            `<div class="gallery-slide ${index === startIndex ? 'active' : ''}" style="background-image: url('${url}');"></div>`
        ).join('');
        
        imageModalOverlay.classList.remove('hidden');

        let currentIndex = startIndex;
        const slides = modalSlidesContainer.querySelectorAll('.gallery-slide');
        const totalSlides = slides.length;

        function showModalSlide(index) {
            slides.forEach((slide, i) => {
                slide.classList.toggle('active', i === index);
            });
            currentIndex = index;
        }

        // Eliminar event listeners anteriores para evitar duplicados
        const nextBtn = document.getElementById('modal-gallery-next');
        const prevBtn = document.getElementById('modal-gallery-prev');
        const newNextBtn = nextBtn.cloneNode(true);
        const newPrevBtn = prevBtn.cloneNode(true);
        nextBtn.parentNode.replaceChild(newNextBtn, nextBtn);
        prevBtn.parentNode.replaceChild(newPrevBtn, prevBtn);

        if (totalSlides <= 1) {
            newNextBtn.style.display = 'none';
            newPrevBtn.style.display = 'none';
        } else {
            newNextBtn.style.display = 'block';
            newPrevBtn.style.display = 'block';
            
            newNextBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const nextIndex = (currentIndex + 1) % totalSlides;
                showModalSlide(nextIndex);
            });

            newPrevBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const prevIndex = (currentIndex - 1 + totalSlides) % totalSlides;
                showModalSlide(prevIndex);
            });
        }
    }

    // --- Event Listeners para Modales ---
    catalogoClientesContainer.addEventListener('click', function(e) {
        // Modal de Detalles
        if (e.target && e.target.dataset.description) {
            detailsModalContent.textContent = e.target.dataset.description;
            detailsModalOverlay.classList.remove('hidden');
        }
    });

    function closeImageModal() {
        imageModalOverlay.classList.add('hidden');
        imageModalContent.src = '';
    }

    function closeDetailsModal() {
        detailsModalOverlay.classList.add('hidden');
        detailsModalContent.textContent = '';
    }

    imageModalClose.addEventListener('click', closeImageModal);
    imageModalOverlay.addEventListener('click', (e) => {
        if (e.target === imageModalOverlay) closeImageModal();
    });

    detailsModalClose.addEventListener('click', closeDetailsModal);
    detailsModalOverlay.addEventListener('click', (e) => {
        if (e.target === detailsModalOverlay) closeDetailsModal();
    });

    // =================================================================
    // 5. EJECUCIÓN INICIAL
    // =================================================================
    fetchPublicCatalogData();
});
