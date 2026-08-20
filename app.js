// Configuración de Supabase en la nube
const SUPABASE_URL = "https://abghxxvrwabdtlgbffej.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_fgwi1zhb4wT5xullWqLXHg_MBWA7Zh-";

const SUPABASE_HEADERS = {
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json",
    "Prefer": "return=representation"
};

let movimientos = [];
let presupuestosMensuales = {}; 

const categoriasBase = {
    Ingreso: [
        "REMESSAS JR", "UNIQUE SWEETS", "SOLMICO", "CESTATICKET", "YARS SHOP",
        "REGALO", "DEVOLUCIÓN", "NOMINA", "FLYERS", "INICIAL", "OTRO", "CURSOS", "DOLARES COMPRADOS"
    ],
    Gasto: [
        "INSUMOS US", "BELLEZA E HIGIENE", "ROPA/ACCESORIOS/ZAPATOS", "DIVERSIÓN / RECREACIÓN",
        "COMIDA Y BEBIDA", "MERCADO", "GYM", "COMPRA DE $", "OTROS", "VIAJES", "MOTO TAXI",
        "REGALOS", "MEDICINA Y SALUD", "CARRO/GASOLINA", "YARS SHOP", "PRESTAMO",
        "COMISIONES", "CURSOS", "TECNOLOGÍA", "UBER", "VENTA DE $"
    ]
};

// Arreglo en memoria para almacenar las categorías creadas en la nube
let categoriasNube = {
    Ingreso: [],
    Gasto: []
};

const hoy = new Date().toISOString().split('T')[0];
const mesActualStr = hoy.slice(0, 7);

let chartIngresosInstance = null;
let chartGastosInstance = null;
let chartPresupuestosInstance = null;
let chartImpactoTasasInstance = null;

// Registrar el plugin globalmente para Chart.js v4+
if (typeof ChartDataLabels !== 'undefined' && typeof Chart !== 'undefined') {
    Chart.register(ChartDataLabels);
}

document.addEventListener('DOMContentLoaded', async () => {
    const presupuestoMesSelector = document.getElementById('presupuesto-mes-selector');
    const filtroDesde = document.getElementById('filtro-desde');
    const filtroHasta = document.getElementById('filtro-hasta');
    const filtroCategoria = document.getElementById('filtro-categoria');
    const ingresoFecha = document.getElementById('ingreso-fecha');
    const gastoFecha = document.getElementById('gasto-fecha');

    if (ingresoFecha) ingresoFecha.value = hoy;
    if (gastoFecha) gastoFecha.value = hoy;

    if (presupuestoMesSelector) {
        presupuestoMesSelector.value = mesActualStr;
        presupuestoMesSelector.addEventListener('change', () => {
            sincronizarDatosGlobales();
        });
    }

    if (filtroDesde) filtroDesde.addEventListener('change', sincronizarDatosGlobales);
    if (filtroHasta) filtroHasta.addEventListener('change', sincronizarDatosGlobales);
    if (filtroCategoria) filtroCategoria.addEventListener('change', sincronizarDatosGlobales);

    // Cargar datos principales (incluyendo categorías) antes de pintar los selects
    await cargarDatosNube();
    configurarRealtimeSupabase();

    const ingresoTasa = document.getElementById('ingreso-tasa');
    const gastoTasa = document.getElementById('gasto-tasa');
    if (ingresoTasa) obtenerTasaBCV(ingresoTasa);
    if (gastoTasa) obtenerTasaBCV(gastoTasa);

    setupEventListeners();
});

function configurarRealtimeSupabase() {
    const wsProtocol = SUPABASE_URL.startsWith('https') ? 'wss://' : 'ws://';
    const host = SUPABASE_URL.replace(/^https?:\/\//, '');
    const realtimeUrl = `${wsProtocol}${host}/realtime/v1/websocket?apikey=${SUPABASE_ANON_KEY}&vsn=1.0.0`;

    try {
        let ws = new WebSocket(realtimeUrl);
        ws.onopen = () => {
            let joinMsg = {
                topic: "realtime:public:*",
                event: "phx_join",
                payload: {},
                ref: "1"
            };
            ws.send(JSON.stringify(joinMsg));
        };
        ws.onmessage = async (event) => {
            try {
                let data = JSON.parse(event.data);
                if (data.event === "INSERT" || data.event === "UPDATE" || data.event === "DELETE") {
                    await cargarDatosNubeSilencioso();
                }
            } catch (err) {}
        };
    } catch (e) {}
}

function formatearNumeroConMiles(valor) {
    if (isNaN(valor) || valor === '') return '';
    const partes = Number(valor).toFixed(2).split('.');
    partes[0] = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return partes.join(',');
}

function limpiarFormatoMiles(texto) {
    if (!texto) return 0;
    let limpio = texto.toString().replace(/\./g, '').replace(',', '.');
    return parseFloat(limpio) || 0;
}

function setupEventListeners() {
    const formIngreso = document.getElementById('form-ingreso');
    if (formIngreso) {
        formIngreso.addEventListener('submit', (e) => {
            e.preventDefault();
            agregarMovimiento('Ingreso');
        });
    }

    const formGasto = document.getElementById('form-gasto');
    if (formGasto) {
        formGasto.addEventListener('submit', (e) => {
            e.preventDefault();
            agregarMovimiento('Gasto');
        });
    }

    const formPresupuesto = document.getElementById('form-presupuesto');
    if (formPresupuesto) {
        formPresupuesto.addEventListener('submit', (e) => {
            e.preventDefault();
            guardarPresupuestoCategoria();
        });
    }

    const formNuevaCat = document.getElementById('form-nueva-categoria');
    if (formNuevaCat) {
        formNuevaCat.addEventListener('submit', (e) => {
            e.preventDefault();
            agregarNuevaCategoria();
        });
    }

    const btnTasaIngreso = document.getElementById('btn-tasa-ingreso');
    if (btnTasaIngreso) {
        btnTasaIngreso.addEventListener('click', () => obtenerTasaBCV(document.getElementById('ingreso-tasa')));
    }

    const btnTasaGasto = document.getElementById('btn-tasa-gasto');
    if (btnTasaGasto) {
        btnTasaGasto.addEventListener('click', () => obtenerTasaBCV(document.getElementById('gasto-tasa')));
    }

    const btnQuitarFiltro = document.getElementById('btn-quitar-filtro');
    if (btnQuitarFiltro) {
        btnQuitarFiltro.addEventListener('click', () => {
            const filtroDesde = document.getElementById('filtro-desde');
            const filtroHasta = document.getElementById('filtro-hasta');
            const filtroCategoria = document.getElementById('filtro-categoria');
            const presupuestoMesSelector = document.getElementById('presupuesto-mes-selector');
            if (filtroDesde) filtroDesde.value = '';
            if (filtroHasta) filtroHasta.value = '';
            if (filtroCategoria) filtroCategoria.value = '';
            if (presupuestoMesSelector) presupuestoMesSelector.value = mesActualStr;
            sincronizarDatosGlobales();
        });
    }

    ['ingreso', 'gasto'].forEach(tipo => {
        const usdInput = document.getElementById(`${tipo}-monto-usd`);
        const bsInput = document.getElementById(`${tipo}-monto-bs`);
        const tasaInput = document.getElementById(`${tipo}-tasa`);

        let actualizando = false;

        if (usdInput && bsInput && tasaInput) {
            usdInput.addEventListener('input', () => {
                if (actualizando) return;
                actualizando = true;
                const usd = parseFloat(usdInput.value) || 0;
                const tasa = parseFloat(tasaInput.value.toString().replace(',', '.')) || 0;
                
                if (usd > 0 && tasa > 0) {
                    const totalBs = usd * tasa;
                    bsInput.value = formatearNumeroConMiles(totalBs);
                } else if (usd === 0) {
                    bsInput.value = '';
                }
                actualizando = false;
            });

            bsInput.addEventListener('input', () => {
                if (actualizando) return;
                actualizando = true;

                let valorCrudo = bsInput.value;
                const bs = limpiarFormatoMiles(valorCrudo);
                const tasa = parseFloat(tasaInput.value.toString().replace(',', '.')) || 0;

                if (bs > 0 && tasa > 0) {
                    const totalUsd = bs / tasa;
                    usdInput.value = totalUsd.toFixed(2);
                } else if (bs === 0) {
                    usdInput.value = '';
                }
                actualizando = false;
            });

            tasaInput.addEventListener('input', () => {
                if (actualizando) return;
                actualizando = true;
                const tasa = parseFloat(tasaInput.value.toString().replace(',', '.')) || 0;
                const usd = parseFloat(usdInput.value) || 0;
                
                if (usd > 0 && tasa > 0) {
                    bsInput.value = formatearNumeroConMiles(usd * tasa);
                }
                actualizando = false;
            });
        }
    });
}

async function cargarDatosNube() {
    try {
        let resMov = await fetch(`${SUPABASE_URL}/rest/v1/movimientos?select=*`, {
            headers: SUPABASE_HEADERS
        });
        if (resMov.ok) {
            movimientos = await resMov.json();
        }

        let resPres = await fetch(`${SUPABASE_URL}/rest/v1/presupuestos?select=*`, {
            headers: SUPABASE_HEADERS
        });
        if (resPres.ok) {
            let dataPresupuestos = await resPres.json();
            presupuestosMensuales = {}; 
            
            dataPresupuestos.forEach(p => {
                if (!p.mes) return;
                let mesLimpio = p.mes.toString().trim().substring(0, 7);
                if (!mesLimpio) return;

                if (!presupuestosMensuales[mesLimpio]) {
                    presupuestosMensuales[mesLimpio] = {};
                }
                
                let idReal = p.id !== undefined ? p.id : (p.ID !== undefined ? p.ID : null);

                presupuestosMensuales[mesLimpio][p.categoria] = {
                    monto: Number(p.monto),
                    id: idReal
                };
            });
        }

        // Cargar categorías desde la nueva tabla 'categorias' de Supabase
        let resCat = await fetch(`${SUPABASE_URL}/rest/v1/categorias?select=*`, {
            headers: SUPABASE_HEADERS
        });
        if (resCat.ok) {
            let dataCats = await resCat.json();
            categoriasNube = { Ingreso: [], Gasto: [] };
            dataCats.forEach(c => {
                if (c.tipo && c.nombre) {
                    if (!categoriasNube[c.tipo]) categoriasNube[c.tipo] = [];
                    categoriasNube[c.tipo].push(c.nombre.toUpperCase());
                }
            });
        }
    } catch (error) {
        console.error("Error al cargar datos de la nube:", error);
    }
    
    sincronizarDatosGlobales();
    await calcularYMostrarImpactoTasas();
}

async function cargarDatosNubeSilencioso() {
    try {
        let resMov = await fetch(`${SUPABASE_URL}/rest/v1/movimientos?select=*`, { headers: SUPABASE_HEADERS });
        if (resMov.ok) movimientos = await resMov.json();

        let resPres = await fetch(`${SUPABASE_URL}/rest/v1/presupuestos?select=*`, { headers: SUPABASE_HEADERS });
        if (resPres.ok) {
            let dataPresupuestos = await resPres.json();
            presupuestosMensuales = {};
            dataPresupuestos.forEach(p => {
                if (!p.mes) return;
                let mesLimpio = p.mes.toString().trim().substring(0, 7);
                if (!mesLimpio) return;

                if (!presupuestosMensuales[mesLimpio]) presupuestosMensuales[mesLimpio] = {};
                
                let idReal = p.id !== undefined ? p.id : (p.ID !== undefined ? p.ID : null);
                presupuestosMensuales[mesLimpio][p.categoria] = {
                    monto: Number(p.monto),
                    id: idReal
                };
            });
        }

        let resCat = await fetch(`${SUPABASE_URL}/rest/v1/categorias?select=*`, { headers: SUPABASE_HEADERS });
        if (resCat.ok) {
            let dataCats = await resCat.json();
            categoriasNube = { Ingreso: [], Gasto: [] };
            dataCats.forEach(c => {
                if (c.tipo && c.nombre) {
                    if (!categoriasNube[c.tipo]) categoriasNube[c.tipo] = [];
                    categoriasNube[c.tipo].push(c.nombre.toUpperCase());
                }
            });
        }

        sincronizarDatosGlobales();
        await calcularYMostrarImpactoTasas();
    } catch (e) {}
}

function obtenerCategoriasDinamicas(tipo) {
    const base = categoriasBase[tipo] || [];
    const extraNube = categoriasNube[tipo] || [];
    const dinamicasMov = movimientos
        .filter(m => m.tipo === tipo && m.categoria)
        .map(m => m.categoria.toUpperCase());
    return Array.from(new Set([...base, ...extraNube, ...dinamicasMov])).sort();
}

function sincronizarDatosGlobales() {
    actualizarSelectsCategorias();
    actualizarTablaYResumen();
    renderizarProgresoCategoriasGeneral();
    calcularYMostrarResumenGeneral();
    calcularYMostrarTotalBsHistorial();
    actualizarGraficos();
}

function calcularYMostrarTotalBsHistorial() {
    const lblTotalBs = document.getElementById('lbl-historial-total-bs');
    if (!lblTotalBs) return;

    let movimientosVisibles = obtenerMovimientosFiltrados();
    let sumaBs = 0;

    movimientosVisibles.forEach(m => {
        const montoVesVal = m.montoVes !== undefined ? m.montoVes : (m.montoUsd * (m.tasa || 1));
        const valorNumerico = Number(montoVesVal) || 0;

        if (m.tipo === 'Ingreso') {
            sumaBs += valorNumerico;
        } else if (m.tipo === 'Gasto') {
            sumaBs -= valorNumerico;
        }
    });

    lblTotalBs.innerText = `Bs. ${formatearNumeroConMiles(sumaBs)}`;
    lblTotalBs.style.color = sumaBs < 0 ? 'var(--danger, #dc3545)' : '#007bff';
}

async function calcularYMostrarImpactoTasas() {
    const movimientosVisibles = obtenerMovimientosFiltrados();
    const tasaActualBcv = await obtenerTasaActualBCV();

    let sumaTasasPonderadas = 0;
    let totalUsdConTasa = 0;
    let valorNominalTotalUsd = 0;
    let diferenciaTotalCambiaria = 0;

    movimientosVisibles.forEach(m => {
        const usd = Number(m.montoUsd) || 0;
        const tasaHistorica = Number(m.tasa) || 0;
        
        if (usd > 0) {
            if (m.tipo === 'Ingreso') {
                valorNominalTotalUsd += usd;
            } else if (m.tipo === 'Gasto') {
                valorNominalTotalUsd -= usd;
            }
        }

        if (usd > 0 && tasaHistorica > 0) {
            sumaTasasPonderadas += (tasaHistorica * usd);
            totalUsdConTasa += usd;

            const valorBsAplicado = usd * tasaHistorica;
            const valorBsReferenciaBcv = usd * tasaActualBcv;
            
            const diferencialMovimientoBs = valorBsAplicado - valorBsReferenciaBcv;
            const diferencialMovimientoUsd = tasaActualBcv > 0 ? (diferencialMovimientoBs / tasaActualBcv) : 0;

            if (m.tipo === 'Ingreso') {
                diferenciaTotalCambiaria += diferencialMovimientoUsd;
            } else if (m.tipo === 'Gasto') {
                diferenciaTotalCambiaria -= diferencialMovimientoUsd;
            }
        }
    });

    const tasaPromedioPonderada = totalUsdConTasa > 0 ? (sumaTasasPonderadas / totalUsdConTasa) : 0;
    const valorRealConDiferencial = valorNominalTotalUsd + diferenciaTotalCambiaria;

    const elTasa = document.getElementById('lbl-tasa-promedio-periodo');
    if (elTasa) {
        elTasa.innerText = `${formatearNumeroConMiles(tasaPromedioPonderada)} Bs/$`;
    }

    const elDesfase = document.getElementById('lbl-desfase-neto');
    if (elDesfase) {
        elDesfase.innerText = `${diferenciaTotalCambiaria >= 0 ? '+' : ''}$${diferenciaTotalCambiaria.toFixed(2)} USD`;
        elDesfase.style.color = diferenciaTotalCambiaria < 0 ? 'var(--danger, #dc3545)' : 'var(--success, #28a745)';
    }

    const canvasTasas = document.getElementById('graficoImpactoTasas');
    if (canvasTasas) {
        if (chartImpactoTasasInstance) chartImpactoTasasInstance.destroy();

        const colorNominal = valorNominalTotalUsd >= 0 ? 'rgba(40, 167, 69, 0.7)' : 'rgba(220, 53, 69, 0.7)';
        const colorReal = valorRealConDiferencial >= 0 ? 'rgba(40, 167, 69, 0.7)' : 'rgba(220, 53, 69, 0.7)';
        const colorDiferencial = diferenciaTotalCambiaria >= 0 ? 'rgba(40, 167, 69, 0.7)' : 'rgba(220, 53, 69, 0.7)';

        chartImpactoTasasInstance = new Chart(canvasTasas, {
            type: 'bar',
            data: {
                labels: ['Valor Nominal', 'Valor Real con Tasas', 'Diferencial Cambiario Neto'],
                datasets: [{
                    label: 'Impacto ($ USD)',
                    data: [valorNominalTotalUsd, valorRealConDiferencial, diferenciaTotalCambiaria],
                    backgroundColor: [colorNominal, colorReal, colorDiferencial],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    datalabels: {
                        anchor: 'center',
                        align: 'center',
                        formatter: (value) => `${value >= 0 ? '+' : ''}$${Number(value || 0).toFixed(2)}`,
                        font: { weight: 'bold', size: 11 },
                        color: '#fff',
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        borderRadius: 4,
                        padding: 4
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(200, 200, 200, 0.2)' }
                    }
                }
            }
        });
    }
}

async function obtenerTasaBCV(inputElement) {
    if (!inputElement) return;
    try {
        inputElement.placeholder = "Consultando BCV...";
        const timestampUnico = new Date().getTime();
        const response = await fetch(`https://ve.dolarapi.com/v1/dolares/oficial?_=${timestampUnico}`);
        const data = await response.json();
        
        if (data && data.promedio) {
            inputElement.value = Number(data.promedio).toFixed(2);
        } else {
            inputElement.value = "36.50";
        }
    } catch (error) {
        inputElement.value = "36.50";
    }
    inputElement.dispatchEvent(new Event('input'));
}

async function obtenerTasaActualBCV() {
    try {
        const response = await fetch(`https://ve.dolarapi.com/v1/dolares/oficial?_=${new Date().getTime()}`);
        const data = await response.json();
        if (data && data.promedio) {
            return Number(data.promedio);
        }
    } catch (error) {}
    return 36.50; 
}

async function agregarMovimiento(tipo) {
    const tipoLower = tipo.toLowerCase();
    const desc = document.getElementById(`${tipoLower}-desc`).value.trim();
    
    const usdInputVal = parseFloat(document.getElementById(`${tipoLower}-monto-usd`).value) || 0;
    const bsInputRaw = document.getElementById(`${tipoLower}-monto-bs`).value;
    const bsInputVal = limpiarFormatoMiles(bsInputRaw);
    
    let tasaInputRaw = document.getElementById(`${tipoLower}-tasa`).value;
    let tasa = parseFloat(tasaInputRaw.toString().replace(',', '.')) || 1;
    tasa = parseFloat(tasa.toFixed(2));
    
    let montoUsd = 0;
    let montoVes = 0;

    if (usdInputVal > 0) {
        montoUsd = usdInputVal;
        montoVes = bsInputVal > 0 ? bsInputVal : (montoUsd * tasa);
    } else if (bsInputVal > 0) {
        montoVes = bsInputVal;
        montoUsd = tasa > 0 ? (montoVes / tasa) : 0;
    }

    const categoria = document.getElementById(`${tipoLower}-categoria`).value;
    const fechaInput = document.getElementById(`${tipoLower}-fecha`).value;
    
    let fecha = hoy;
    if (fechaInput) fecha = fechaInput;

    const nuevoMov = {
        tipo: tipo,
        descripcion: desc,
        montoOriginal: Number(montoUsd.toFixed(2)),
        moneda: 'USD',
        tasa: Number(tasa.toFixed(2)),
        montoUsd: Number(montoUsd.toFixed(2)),
        montoVes: Number(montoVes.toFixed(2)),
        categoria: categoria,
        fecha: fecha
    };

    try {
        let response = await fetch(`${SUPABASE_URL}/rest/v1/movimientos`, {
            method: 'POST',
            headers: SUPABASE_HEADERS,
            body: JSON.stringify(nuevoMov)
        });

        if (response.ok) {
            let dataRegistrada = await response.json();
            if (Array.isArray(dataRegistrada) && dataRegistrada.length > 0) {
                movimientos.push(dataRegistrada[0]);
            } else {
                await cargarDatosNube();
            }

            document.getElementById(`form-${tipoLower}`).reset();
            document.getElementById(`${tipoLower}-fecha`).value = hoy;
            obtenerTasaBCV(document.getElementById(`${tipoLower}-tasa`));

            sincronizarDatosGlobales();
            await calcularYMostrarImpactoTasas();
            mostrarNotificacion(`${tipo} agregado exitosamente`, 'success');
        } else {
            mostrarNotificacion('Error al guardar en la nube', 'error');
        }
    } catch (e) {
        mostrarNotificacion('Error de conexión', 'error');
    }
}

async function eliminarMovimiento(idMovimiento) {
    try {
        let response = await fetch(`${SUPABASE_URL}/rest/v1/movimientos?"ID"=eq.${encodeURIComponent(idMovimiento)}`, {
            method: 'DELETE',
            headers: SUPABASE_HEADERS
        });

        if (response.ok) {
            movimientos = movimientos.filter(m => (m.id != idMovimiento && m.ID != idMovimiento));
            sincronizarDatosGlobales();
            await calcularYMostrarImpactoTasas();
            mostrarNotificacion('Movimiento eliminado', 'info');
        } else {
            mostrarNotificacion('No se pudo eliminar', 'error');
        }
    } catch (e) {}
}

async function guardarPresupuestoCategoria() {
    const mes = document.getElementById('presupuesto-mes-selector') ? document.getElementById('presupuesto-mes-selector').value : mesActualStr;
    const categoria = document.getElementById('presupuesto-categoria').value;
    const monto = parseFloat(document.getElementById('presupuesto-monto').value) || 0;

    if (!mes || !categoria) return;

    const datosPresupuesto = {
        mes: mes,
        categoria: categoria,
        monto: Number(monto.toFixed(2))
    };

    try {
        let headersUpsert = {
            ...SUPABASE_HEADERS,
            "Prefer": "resolution=merge-duplicates,return=representation"
        };
        
        let response = await fetch(`${SUPABASE_URL}/rest/v1/presupuestos`, {
            method: 'POST',
            headers: headersUpsert,
            body: JSON.stringify(datosPresupuesto)
        });

        if (response.ok) {
            let dataReg = await response.json();
            let idReg = (Array.isArray(dataReg) && dataReg.length > 0) ? (dataReg[0].id || dataReg[0].ID) : null;

            if (!presupuestosMensuales[mes]) presupuestosMensuales[mes] = {};
            presupuestosMensuales[mes][categoria] = { monto, id: idReg };

            const formPresupuesto = document.getElementById('form-presupuesto');
            if (formPresupuesto) formPresupuesto.reset();
            
            sincronizarDatosGlobales();
            mostrarNotificacion('Presupuesto guardado correctamente', 'success');
        } else {
            mostrarNotificacion('Error al guardar presupuesto', 'error');
        }
    } catch (e) {
        mostrarNotificacion('Error de conexión', 'error');
    }
}

async function eliminarPresupuesto(categoria) {
    const mes = document.getElementById('presupuesto-mes-selector') ? document.getElementById('presupuesto-mes-selector').value : mesActualStr;
    const presupuestoInfo = presupuestosMensuales[mes] && presupuestosMensuales[mes][categoria];
    
    try {
        let urlDelete = "";
        if (presupuestoInfo && presupuestoInfo.id) {
            urlDelete = `${SUPABASE_URL}/rest/v1/presupuestos?id=eq.${encodeURIComponent(presupuestoInfo.id)}`;
        } else {
            urlDelete = `${SUPABASE_URL}/rest/v1/presupuestos?mes=eq.${mes}&categoria=eq.${encodeURIComponent(categoria)}`;
        }

        let response = await fetch(urlDelete, { method: 'DELETE', headers: SUPABASE_HEADERS });

        if (response.ok) {
            if (presupuestosMensuales[mes]) delete presupuestosMensuales[mes][categoria];
            sincronizarDatosGlobales();
            mostrarNotificacion('Presupuesto eliminado', 'info');
        } else {
            mostrarNotificacion('No se pudo eliminar el presupuesto', 'error');
        }
    } catch (e) {}
}

async function agregarNuevaCategoria() {
    const tipo = document.getElementById('nueva-cat-tipo').value;
    const nombre = document.getElementById('nueva-cat-nombre').value.trim().toUpperCase();

    if (!nombre) return;

    // Validar si ya existe en las listas base o en las de la nube
    const existentes = obtenerCategoriasDinamicas(tipo);
    if (existentes.includes(nombre)) {
        mostrarNotificacion(`La categoría ${nombre} ya existe`, 'error');
        return;
    }

    const nuevaCatObj = {
        tipo: tipo,
        nombre: nombre
    };

    try {
        let response = await fetch(`${SUPABASE_URL}/rest/v1/categorias`, {
            method: 'POST',
            headers: SUPABASE_HEADERS,
            body: JSON.stringify(nuevaCatObj)
        });

        if (response.ok) {
            if (!categoriasNube[tipo]) categoriasNube[tipo] = [];
            categoriasNube[tipo].push(nombre);

            actualizarSelectsCategorias();
            
            const formCat = document.getElementById('form-nueva-categoria');
            if (formCat) formCat.reset();
            
            mostrarNotificacion(`Categoría ${nombre} creada exitosamente`, 'success');
        } else {
            mostrarNotificacion('Error al guardar la categoría en Supabase', 'error');
        }
    } catch (e) {
        mostrarNotificacion('Error de conexión', 'error');
    }
}

function actualizarSelectsCategorias() {
    const catsIngreso = obtenerCategoriasDinamicas('Ingreso');
    const catsGasto = obtenerCategoriasDinamicas('Gasto');

    const selectIngresoCat = document.getElementById('ingreso-categoria');
    const selectGastoCat = document.getElementById('gasto-categoria');
    const selectPresupuestoCat = document.getElementById('presupuesto-categoria');
    const filtroCat = document.getElementById('filtro-categoria');

    if (selectIngresoCat) {
        selectIngresoCat.innerHTML = catsIngreso.map(c => `<option value="${c}">${c}</option>`).join('');
    }
    
    if (selectGastoCat) {
        selectGastoCat.innerHTML = catsGasto.map(c => `<option value="${c}">${c}</option>`).join('');
    }
    
    if (selectPresupuestoCat) {
        selectPresupuestoCat.innerHTML = catsGasto.map(c => `<option value="${c}">${c}</option>`).join('');
    }

    if (filtroCat) {
        const valorActual = filtroCat.value;
        const todasCatsUnicas = Array.from(new Set([...catsIngreso, ...catsGasto])).sort();
        filtroCat.innerHTML = `<option value="">Todas</option>` + todasCatsUnicas.map(c => `<option value="${c}">${c}</option>`).join('');
        filtroCat.value = valorActual;
    }
}

function obtenerMovimientosFiltrados() {
    const filtroDesde = document.getElementById('filtro-desde') ? document.getElementById('filtro-desde').value : '';
    const filtroHasta = document.getElementById('filtro-hasta') ? document.getElementById('filtro-hasta').value : '';
    const filtroCat = document.getElementById('filtro-categoria') ? document.getElementById('filtro-categoria').value : '';
    const mesSelector = document.getElementById('presupuesto-mes-selector') ? document.getElementById('presupuesto-mes-selector').value : mesActualStr;

    return movimientos.filter(m => {
        if (!m.fecha) return false;
        
        let cumpleFecha = false;
        if (filtroDesde && filtroHasta) {
            cumpleFecha = (m.fecha >= filtroDesde && m.fecha <= filtroHasta);
        } else if (filtroDesde) {
            cumpleFecha = (m.fecha >= filtroDesde);
        } else if (filtroHasta) {
            cumpleFecha = (m.fecha <= filtroHasta);
        } else {
            cumpleFecha = m.fecha.startsWith(mesSelector);
        }

        let cumpleCategoria = true;
        if (filtroCat) {
            cumpleCategoria = (m.categoria === filtroCat);
        }

        return cumpleFecha && cumpleCategoria;
    });
}

function actualizarTablaYResumen() {
    const tbody = document.getElementById('tabla-movimientos');
    if (!tbody) return;

    let movimientosVisibles = obtenerMovimientosFiltrados();
    
    movimientosVisibles.sort((a, b) => {
        let comparacionFecha = new Date(b.fecha) - new Date(a.fecha);
        if (comparacionFecha !== 0) return comparacionFecha;
        
        let idA = Number(a.ID !== undefined ? a.ID : a.id) || 0;
        let idB = Number(b.ID !== undefined ? b.ID : b.id) || 0;
        return idB - idA;
    });
    
    tbody.innerHTML = '';

    movimientosVisibles.forEach(m => {
        const idUnico = m.ID !== undefined ? m.ID : m.id;
        const tr = document.createElement('tr');
        
        const montoVesVal = m.montoVes !== undefined ? m.montoVes : (m.montoUsd * (m.tasa || 1));
        const descripcionTexto = m.descripcion || '';

        let fechaFormateada = m.fecha;
        if (m.fecha) {
            const partesFecha = m.fecha.split('-');
            if (partesFecha.length === 3) {
                const anio = parseInt(partesFecha[0], 10);
                const mes = parseInt(partesFecha[1], 10) - 1;
                const dia = parseInt(partesFecha[2], 10);
                const fechaObj = new Date(anio, mes, dia);
                
                fechaFormateada = fechaObj.toLocaleDateString('es-ES', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long'
                });
            }
        }

        tr.innerHTML = `
            <td data-label="Fecha">${fechaFormateada}</td>
            <td data-label="Tipo"><span class="badge ${m.tipo.toLowerCase()}">${m.tipo}</span></td>
            <td data-label="Descripción">
                <div class="desc-celda">${descripcionTexto}</div>
            </td>
            <td data-label="Categoría">${m.categoria}</td>
            <td data-label="Monto Bs. (VES)">Bs. ${formatearNumeroConMiles(montoVesVal)}</td>
            <td data-label="Monto $ (USD)">$${Number(m.montoUsd).toFixed(2)}</td>
            <td data-label="Acciones">
                <button class="btn-icon text-red" onclick="eliminarMovimiento('${idUnico}')" title="Eliminar" style="background:none; border:none; cursor:pointer; font-size: 1rem;">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function calcularYMostrarResumenGeneral() {
    const lblIngresos = document.getElementById('lbl-ingresos');
    const lblGastos = document.getElementById('lbl-gastos');
    const lblDisponible = document.getElementById('lbl-disponible');
    const lblPresupuestoTotal = document.getElementById('lbl-presupuesto-total');

    let movimientosVisibles = obtenerMovimientosFiltrados();
    let totalIngresosUsd = 0;
    let totalGastosUsd = 0;
    let sumaBsNeto = 0;

    movimientosVisibles.forEach(m => {
        const usd = Number(m.montoUsd) || 0;
        const ves = m.montoVes !== undefined ? Number(m.montoVes) : (usd * (Number(m.tasa) || 1));

        if (m.tipo === 'Ingreso') {
            totalIngresosUsd += usd;
            sumaBsNeto += ves;
        }
        if (m.tipo === 'Gasto') {
            totalGastosUsd += usd;
            sumaBsNeto -= ves;
        }
    });

    if (lblIngresos) lblIngresos.innerText = `$${totalIngresosUsd.toFixed(2)}`;
    if (lblGastos) lblGastos.innerText = `$${totalGastosUsd.toFixed(2)}`;
    
    const tasaActual = await obtenerTasaActualBCV();
    const disponibleNeto = tasaActual > 0 ? (sumaBsNeto / tasaActual) : (totalIngresosUsd - totalGastosUsd);

    if (lblDisponible) {
        lblDisponible.innerText = `$${disponibleNeto.toFixed(2)}`;
        lblDisponible.style.color = disponibleNeto < 0 ? 'var(--danger, #dc3545)' : 'var(--success, #28a745)';
    }

    if (lblPresupuestoTotal) {
        const mesSel = document.getElementById('presupuesto-mes-selector') ? document.getElementById('presupuesto-mes-selector').value : mesActualStr;
        const presupuestosCatsMes = presupuestosMensuales[mesSel] || {};
        let sumaPresupuestos = 0;
        Object.values(presupuestosCatsMes).forEach(p => {
            sumaPresupuestos += (typeof p === 'object' ? p.monto : p);
        });
        lblPresupuestoTotal.innerText = `$${sumaPresupuestos.toFixed(2)}`;
    }
}

function renderizarProgresoCategoriasGeneral() {
    const contenedor = document.getElementById('contenedor-progreso-categorias');
    if (!contenedor) return;

    const mesSel = document.getElementById('presupuesto-mes-selector') ? document.getElementById('presupuesto-mes-selector').value : mesActualStr;
    const presupuestosCatsMes = presupuestosMensuales[mesSel] || {};
    let movimientosMes = movimientos.filter(m => m.tipo === 'Gasto' && m.fecha && m.fecha.startsWith(mesSel));

    const gastosPorCat = {};
    movimientosMes.forEach(m => {
        gastosPorCat[m.categoria] = (gastosPorCat[m.categoria] || 0) + Number(m.montoUsd);
    });

    contenedor.innerHTML = '';

    if (Object.keys(presupuestosCatsMes).length === 0) {
        contenedor.innerHTML = `<p class="text-muted">No hay presupuestos por categoría configurados para ${mesSel}.</p>`;
        return;
    }

    for (const [cat, datosPresupuesto] of Object.entries(presupuestosCatsMes)) {
        const presupuesto = typeof datosPresupuesto === 'object' ? datosPresupuesto.monto : datosPresupuesto;
        const gastado = gastosPorCat[cat] || 0;
        const diferencia = presupuesto - gastado;
        const porcentaje = presupuesto > 0 ? Math.min((gastado / presupuesto) * 100, 100) : 0;
        
        let claseBarra = 'bg-green';
        let alertaTexto = '';
        if (gastado > presupuesto) {
            claseBarra = 'bg-red';
            alertaTexto = `<span class="text-red" style="font-weight: 700;"><i class="fas fa-exclamation-triangle"></i> ¡Te pasaste por $${Math.abs(diferencia).toFixed(2)}!</span>`;
        } else {
            alertaTexto = `<span class="text-green" style="font-weight: 700;"><i class="fas fa-check-circle"></i> Te restan $${diferencia.toFixed(2)}</span>`;
        }

        const div = document.createElement('div');
        div.className = 'progress-item';
        div.innerHTML = `
            <div class="progress-info">
                <span><strong>${cat}</strong> (Límite: $${presupuesto.toFixed(2)} | Gastado: $${gastado.toFixed(2)})</span>
                <button class="text-red" onclick="eliminarPresupuesto('${cat}')" style="background:none; border:none; cursor:pointer;" title="Eliminar"><i class="fas fa-trash-alt"></i></button>
            </div>
            <div class="progress-bar-container" style="margin: 8px 0;">
                <div class="progress-bar-fill ${claseBarra}" style="width: ${porcentaje}%"></div>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 0.85rem;">
                ${alertaTexto}
                <span>${porcentaje.toFixed(0)}% utilizado</span>
            </div>
        `;
        contenedor.appendChild(div);
    }
}

function actualizarGraficos() {
    const movimientosVisibles = obtenerMovimientosFiltrados();
    const mesSel = document.getElementById('presupuesto-mes-selector') ? document.getElementById('presupuesto-mes-selector').value : mesActualStr;

    const ingresosPorCat = {};
    movimientosVisibles.filter(m => m.tipo === 'Ingreso').forEach(m => {
        ingresosPorCat[m.categoria] = (ingresosPorCat[m.categoria] || 0) + Number(m.montoUsd);
    });

    const gastosPorCat = {};
    movimientosVisibles.filter(m => m.tipo === 'Gasto').forEach(m => {
        gastosPorCat[m.categoria] = (gastosPorCat[m.categoria] || 0) + Number(m.montoUsd);
    });

    const pluginDatalabelsConfig = {
        anchor: 'center',
        align: 'center',
        formatter: (value) => `$${Number(value || 0).toFixed(2)}`,
        font: {
            weight: 'bold',
            size: 11
        },
        color: '#fff',
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        borderColor: 'transparent',
        borderRadius: 4,
        padding: 4
    };

    const canvasIngresos = document.getElementById('graficoIngresos');
    if (canvasIngresos) {
        if (chartIngresosInstance) chartIngresosInstance.destroy();
        chartIngresosInstance = new Chart(canvasIngresos, {
            type: 'bar',
            data: {
                labels: Object.keys(ingresosPorCat),
                datasets: [{
                    label: 'Ingresos ($)',
                    data: Object.values(ingresosPorCat),
                    backgroundColor: 'rgba(40, 167, 69, 0.7)',
                    borderColor: 'rgba(40, 167, 69, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    datalabels: pluginDatalabelsConfig
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    const canvasGastos = document.getElementById('graficoGastos');
    if (canvasGastos) {
        if (chartGastosInstance) chartGastosInstance.destroy();
        chartGastosInstance = new Chart(canvasGastos, {
            type: 'bar',
            data: {
                labels: Object.keys(gastosPorCat),
                datasets: [{
                    label: 'Gastos ($)',
                    data: Object.values(gastosPorCat),
                    backgroundColor: 'rgba(220, 53, 69, 0.7)',
                    borderColor: 'rgba(220, 53, 69, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    datalabels: pluginDatalabelsConfig
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    const canvasPresupuestos = document.getElementById('graficoPresupuestos');
    if (canvasPresupuestos) {
        const presupuestosCatsMes = presupuestosMensuales[mesSel] || {};
        const todasCategoriasGasto = Array.from(new Set([...Object.keys(presupuestosCatsMes), ...Object.keys(gastosPorCat)]));
        
        const dataPresupuestoArr = [];
        const dataGastadoArr = [];

        todasCategoriasGasto.forEach(cat => {
            const pInfo = presupuestosCatsMes[cat];
            const pMonto = pInfo ? (typeof pInfo === 'object' ? pInfo.monto : pInfo) : 0;
            const gMonto = gastosPorCat[cat] || 0;
            dataPresupuestoArr.push(pMonto);
            dataGastadoArr.push(gMonto);
        });

        if (chartPresupuestosInstance) chartPresupuestosInstance.destroy();
        chartPresupuestosInstance = new Chart(canvasPresupuestos, {
            type: 'bar',
            data: {
                labels: todasCategoriasGasto,
                datasets: [
                    {
                        label: 'Presupuesto ($)',
                        data: dataPresupuestoArr,
                        backgroundColor: 'rgba(23, 184, 69, 0.83)',
                        borderColor: 'rgb(23, 184, 69)',
                        borderWidth: 1
                    },
                    {
                        label: 'Gasto Real ($)',
                        data: dataGastadoArr,
                        backgroundColor: 'rgba(248, 65, 65, 0.86)',
                        borderColor: 'rgb(248, 65, 65)',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    datalabels: pluginDatalabelsConfig
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }
}

function mostrarNotificacion(mensaje, tipo = 'info') {
    let alerta = document.getElementById('toast-alerta');
    if (!alerta) {
        alerta = document.createElement('div');
        alerta.id = 'toast-alerta';
        alerta.className = 'toast-alerta';
        document.body.appendChild(alerta);
    }

    alerta.innerText = mensaje;
    alerta.className = `toast-alerta show ${tipo}`;

    setTimeout(() => {
        alerta.className = 'toast-alerta';
    }, 3000);
}