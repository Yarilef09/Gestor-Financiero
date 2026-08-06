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

const hoy = new Date().toISOString().split('T')[0];
const mesActualStr = hoy.slice(0, 7);

// Instancias globales para Chart.js
let chartIngresosInstance = null;
let chartGastosInstance = null;
let chartPresupuestosInstance = null;

document.addEventListener('DOMContentLoaded', async () => {
    const presupuestoMesSelector = document.getElementById('presupuesto-mes-selector');
    const filtroDesde = document.getElementById('filtro-desde');
    const filtroHasta = document.getElementById('filtro-hasta');
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

    actualizarSelectsCategorias();

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
            if (filtroDesde) filtroDesde.value = '';
            if (filtroHasta) filtroHasta.value = '';
            sincronizarDatosGlobales();
        });
    }

    ['ingreso', 'gasto'].forEach(tipo => {
        const montoInput = document.getElementById(`${tipo}-monto`);
        const tasaInput = document.getElementById(`${tipo}-tasa`);
        const monedaSelect = document.getElementById(`${tipo}-moneda`);
        const equivalenteSpan = document.getElementById(`${tipo}-equivalente`);

        const calcularEquivalente = () => {
            if (!montoInput || !tasaInput || !monedaSelect || !equivalenteSpan) return;
            const monto = parseFloat(montoInput.value) || 0;
            const tasaVal = parseFloat(tasaInput.value.toString().replace(',', '.')) || 1;
            const moneda = monedaSelect.value;

            if (moneda === 'VES' && tasaVal > 0) {
                const enUsd = monto / tasaVal;
                equivalenteSpan.innerText = `Equivalente: $${enUsd.toFixed(2)} USD`;
            } else if (moneda === 'USD' && tasaVal > 0) {
                equivalenteSpan.innerText = `Equivalente: Bs. ${(monto * tasaVal).toFixed(2)}`;
            } else {
                equivalenteSpan.innerText = '';
            }
        };

        if (montoInput) montoInput.addEventListener('input', calcularEquivalente);
        if (tasaInput) tasaInput.addEventListener('input', calcularEquivalente);
        if (monedaSelect) monedaSelect.addEventListener('change', calcularEquivalente);
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
    } catch (error) {
        console.error("Error al cargar datos de la nube:", error);
    }
    sincronizarDatosGlobales();
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
        sincronizarDatosGlobales();
    } catch (e) {}
}

function obtenerCategoriasDinamicas(tipo) {
    const base = categoriasBase[tipo] || [];
    const dinamicas = movimientos
        .filter(m => m.tipo === tipo && m.categoria)
        .map(m => m.categoria.toUpperCase());
    return Array.from(new Set([...base, ...dinamicas])).sort();
}

function sincronizarDatosGlobales() {
    actualizarSelectsCategorias();
    actualizarTablaYResumen();
    renderizarProgresoCategoriasGeneral();
    calcularYMostrarResumenGeneral();
    
    if (typeof actualizarGraficos === 'function') {
        actualizarGraficos();
    }
}

async function obtenerTasaBCV(inputElement) {
    if (!inputElement) return;
    try {
        inputElement.placeholder = "Consultando BCV...";
        const response = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
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

async function agregarMovimiento(tipo) {
    const desc = document.getElementById(`${tipo.toLowerCase()}-desc`).value.trim();
    const montoOriginalInput = parseFloat(document.getElementById(`${tipo.toLowerCase()}-monto`).value) || 0;
    const moneda = document.getElementById(`${tipo.toLowerCase()}-moneda`).value;
    
    let tasaInputRaw = document.getElementById(`${tipo.toLowerCase()}-tasa`).value;
    let tasa = parseFloat(tasaInputRaw.toString().replace(',', '.')) || 1;
    tasa = parseFloat(tasa.toFixed(2));
    
    const categoria = document.getElementById(`${tipo.toLowerCase()}-categoria`).value;
    const fechaInput = document.getElementById(`${tipo.toLowerCase()}-fecha`).value;
    
    let fecha = hoy;
    if (fechaInput) fecha = fechaInput;

    let montoUsd = (moneda === 'VES') ? (montoOriginalInput / tasa) : montoOriginalInput;
    let montoVes = (moneda === 'VES') ? montoOriginalInput : (montoOriginalInput * tasa);

    const nuevoMov = {
        tipo: tipo,
        descripcion: desc,
        montoOriginal: Number(montoOriginalInput.toFixed(2)),
        moneda: moneda,
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

            document.getElementById(`form-${tipo.toLowerCase()}`).reset();
            document.getElementById(`${tipo.toLowerCase()}-fecha`).value = hoy;
            obtenerTasaBCV(document.getElementById(`${tipo.toLowerCase()}-tasa`));

            sincronizarDatosGlobales();
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
        let response = await fetch(`${SUPABASE_URL}/rest/v1/movimientos?ID=eq.${encodeURIComponent(idMovimiento)}`, {
            method: 'DELETE',
            headers: SUPABASE_HEADERS
        });

        if (response.ok) {
            movimientos = movimientos.filter(m => (m.id != idMovimiento && m.ID != idMovimiento));
            sincronizarDatosGlobales();
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

function agregarNuevaCategoria() {
    const tipo = document.getElementById('nueva-cat-tipo').value;
    const nombre = document.getElementById('nueva-cat-nombre').value.trim().toUpperCase();

    if (!nombre || categoriasBase[tipo].includes(nombre)) return;

    categoriasBase[tipo].push(nombre);
    actualizarSelectsCategorias();
    const formCat = document.getElementById('form-nueva-categoria');
    if (formCat) formCat.reset();
    mostrarNotificacion(`Categoría ${nombre} creada`, 'success');
}

function actualizarSelectsCategorias() {
    // Asegurar que siempre existan las categorías base aunque la nube tarde en responder
    const catsIngreso = obtenerCategoriasDinamicas('Ingreso');
    const catsGasto = obtenerCategoriasDinamicas('Gasto');

    const selectIngresoCat = document.getElementById('ingreso-categoria');
    const selectGastoCat = document.getElementById('gasto-categoria');
    const selectPresupuestoCat = document.getElementById('presupuesto-categoria');

    if (selectIngresoCat) {
        selectIngresoCat.innerHTML = catsIngreso.length > 0 
            ? catsIngreso.map(c => `<option value="${c}">${c}</option>`).join('') 
            : categoriasBase.Ingreso.map(c => `<option value="${c}">${c}</option>`).join('');
    }
    
    if (selectGastoCat) {
        selectGastoCat.innerHTML = catsGasto.length > 0 
            ? catsGasto.map(c => `<option value="${c}">${c}</option>`).join('') 
            : categoriasBase.Gasto.map(c => `<option value="${c}">${c}</option>`).join('');
    }
    
    if (selectPresupuestoCat) {
        selectPresupuestoCat.innerHTML = catsGasto.length > 0 
            ? catsGasto.map(c => `<option value="${c}">${c}</option>`).join('') 
            : categoriasBase.Gasto.map(c => `<option value="${c}">${c}</option>`).join('');
    }
}

function obtenerMovimientosFiltrados() {
    const filtroDesde = document.getElementById('filtro-desde') ? document.getElementById('filtro-desde').value : '';
    const filtroHasta = document.getElementById('filtro-hasta') ? document.getElementById('filtro-hasta').value : '';
    const mesSelector = document.getElementById('presupuesto-mes-selector') ? document.getElementById('presupuesto-mes-selector').value : mesActualStr;

    return movimientos.filter(m => {
        if (!m.fecha) return false;
        
        if (filtroDesde && filtroHasta) {
            return m.fecha >= filtroDesde && m.fecha <= filtroHasta;
        } else if (filtroDesde) {
            return m.fecha >= filtroDesde;
        } else if (filtroHasta) {
            return m.fecha <= filtroHasta;
        }

        return m.fecha.startsWith(mesSelector);
    });
}

function actualizarTablaYResumen() {
    const tbody = document.getElementById('tabla-movimientos');
    if (!tbody) return;

    let movimientosVisibles = obtenerMovimientosFiltrados();
    movimientosVisibles.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    
    tbody.innerHTML = '';

    movimientosVisibles.forEach(m => {
        const idUnico = m.ID !== undefined ? m.ID : m.id;
        const tr = document.createElement('tr');
        
        tr.innerHTML = `
            <td data-label="Fecha">${m.fecha}</td>
            <td data-label="Tipo"><span class="badge ${m.tipo.toLowerCase()}">${m.tipo}</span></td>
            <td data-label="Descripción">${m.descripcion}</td>
            <td data-label="Categoría">${m.categoria}</td>
            <td data-label="Monto Original">${m.moneda === 'USD' ? '$' : 'Bs.'} ${Number(m.montoOriginal).toFixed(2)}</td>
            <td data-label="USD ($)">$${Number(m.montoUsd).toFixed(2)}</td>
            <td data-label="Acciones">
                <button class="btn-icon text-red" onclick="eliminarMovimiento('${idUnico}')" title="Eliminar" style="background:none; border:none; cursor:pointer; font-size: 1rem;">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function calcularYMostrarResumenGeneral() {
    const lblIngresos = document.getElementById('lbl-ingresos');
    const lblGastos = document.getElementById('lbl-gastos');
    const lblDisponible = document.getElementById('lbl-disponible');
    const lblPresupuestoTotal = document.getElementById('lbl-presupuesto-total');

    let movimientosVisibles = obtenerMovimientosFiltrados();
    let totalIngresosUsd = 0;
    let totalGastosUsd = 0;

    movimientosVisibles.forEach(m => {
        if (m.tipo === 'Ingreso') totalIngresosUsd += Number(m.montoUsd);
        if (m.tipo === 'Gasto') totalGastosUsd += Number(m.montoUsd);
    });

    if (lblIngresos) lblIngresos.innerText = `$${totalIngresosUsd.toFixed(2)}`;
    if (lblGastos) lblGastos.innerText = `$${totalGastosUsd.toFixed(2)}`;
    
    const disponibleNeto = totalIngresosUsd - totalGastosUsd;
    if (lblDisponible) {
        lblDisponible.innerText = `$${disponibleNeto.toFixed(2)}`;
        lblDisponible.style.color = disponibleNeto < 0 ? 'var(--danger)' : 'var(--success)';
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

// FUNCIÓN PARA RENDERIZAR LOS GRÁFICOS CON CHART.JS Y ETIQUETAS VISIBLES
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

    // Configuración inteligente: si es 0 va abajo limpio, si tiene valor va centrado con fondo elegante
    const pluginDatalabelsConfig = {
        anchor: (context) => context.dataset.data[context.dataIndex] === 0 ? 'end' : 'center',
        align: (context) => context.dataset.data[context.dataIndex] === 0 ? 'top' : 'center',
        formatter: (value) => `$${Number(value || 0).toFixed(2)}`,
        font: {
            weight: 'bold',
            size: 11
        },
        color: (context) => context.dataset.data[context.dataIndex] === 0 ? '#888' : '#fff',
        backgroundColor: (context) => context.dataset.data[context.dataIndex] === 0 ? 'transparent' : 'rgba(0, 0, 0, 0.4)',
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
                }
            },
            plugins: [ChartDataLabels]
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
                }
            },
            plugins: [ChartDataLabels]
        });
    }

    const canvasPresupuestos = document.getElementById('graficoPresupuestos');
    if (canvasPresupuestos) {
        const presupuestosCatsMes = presupuestosMensuales[mesSel] || {};
        const todasCategoriasGasto = Array.from(new Set([...Object.keys(presupuestosCatsMes), ...Object.keys(gastosPorCat)]));
        
        const datosPresupuestoArr = [];
        const datosGastadoArr = [];

        todasCategoriasGasto.forEach(cat => {
            const pInfo = presupuestosCatsMes[cat];
            const pMonto = pInfo ? (typeof pInfo === 'object' ? pInfo.monto : pInfo) : 0;
            const gMonto = gastosPorCat[cat] || 0;
            datosPresupuestoArr.push(pMonto);
            datosGastadoArr.push(gMonto);
        });

        if (chartPresupuestosInstance) chartPresupuestosInstance.destroy();
        chartPresupuestosInstance = new Chart(canvasPresupuestos, {
            type: 'bar',
            data: {
                labels: todasCategoriasGasto,
                datasets: [
                    {
                        label: 'Presupuesto ($)',
                        data: datosPresupuestoArr,
                        backgroundColor: 'rgba(23, 184, 69, 0.83)',
                        borderColor: 'rgb(23, 184, 69)',
                        borderWidth: 1
                    },
                    {
                        label: 'Gasto Real ($)',
                        data: datosGastadoArr,
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
                }
            },
            plugins: [ChartDataLabels]
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