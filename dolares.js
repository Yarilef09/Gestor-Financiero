// --- CONFIGURACIÓN DE SUPABASE Y VARIABLES GLOBALES ---
const SUPABASE_URL = "https://abghxxvrwabdtlgbffej.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_fgwi1zhb4wT5xullWqLXHg_MBWA7Zh-";

const SUPABASE_HEADERS = {
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json",
    "Prefer": "return=representation"
};

let listaDolares = [];
let categoriasNubeDolar = { INGRESOS: [], EGRESOS: [] };
let chartIngresosDolarInst = null;
let chartEgresosDolarInst = null;
const hoy = new Date().toISOString().split('T')[0];

const categoriasDolarBase = {
    INGRESOS: ["INICIAL", "UNIQUE SWEETS", "DOLARES COMPRADOS", "REGALOS", "REMESAS"],
    EGRESOS: [
        "INSUMOS US", "BELLEZA E HIGIENE", "ROPA/ACCESORIOS/ZAPATOS", "DIVERSIÓN / RECREACIÓN",
        "COMIDA Y BEBIDA", "OTROS", "VIAJES", "REGALOS", "MEDICINA Y SALUD",
        "CARRO/GASOLINA", "PRESTAMO", "TECNOLOGÍA", "VENTA DE $"
    ]
};

document.addEventListener('DOMContentLoaded', async () => {
    const inputFecha = document.getElementById('dolar-fecha');
    if (inputFecha) inputFecha.value = hoy;

    const tipoTransaccionSelect = document.getElementById('dolar-tipo');
    if (tipoTransaccionSelect) {
        tipoTransaccionSelect.addEventListener('change', actualizarSelectCategoriasDolar);
    }

    const formDolar = document.getElementById('form-dolar');
    if (formDolar) {
        formDolar.addEventListener('submit', (e) => {
            e.preventDefault();
            agregarMovimientoDolar();
        });
    }

    await cargarDolaresNube();
    configurarRealtimeDolares();
});

// --- FUNCIONES DE NORMALIZACIÓN Y CATEGORÍAS ---

function obtenerTipoNormalizado(tipoHtml) {
    const limpio = (tipoHtml || '').toUpperCase();
    return (limpio.includes('ING') || limpio.includes('INGRESO')) ? 'INGRESOS' : 'EGRESOS';
}

function obtenerCategoriasDinamicasDolar(tipoHtml) {
    const tipoDb = obtenerTipoNormalizado(tipoHtml);
    const base = categoriasDolarBase[tipoDb] || [];
    const nube = categoriasNubeDolar[tipoDb] || [];
    
    const dinamicasMovimientos = listaDolares
        .filter(m => {
            const mTipo = (m.tipoTransaccion || '').toUpperCase();
            const mEsIngreso = mTipo.includes('ING') || mTipo.includes('INGRESO');
            const targetEsIngreso = tipoDb === 'INGRESOS';
            return mEsIngreso === targetEsIngreso && m.categoria;
        })
        .map(m => m.categoria.toUpperCase());
        
    return Array.from(new Set([...base, ...nube, ...dinamicasMovimientos])).sort();
}

function actualizarSelectCategoriasDolar() {
    const selectTipo = document.getElementById('dolar-tipo');
    const selectCategoria = document.getElementById('dolar-categoria');
    if (!selectTipo || !selectCategoria) return;

    const tipoSeleccionado = selectTipo.value; 
    const catsDisponibles = obtenerCategoriasDinamicasDolar(tipoSeleccionado);

    if (selectCategoria.tagName === 'SELECT') {
        const valorActual = selectCategoria.value;
        selectCategoria.innerHTML = catsDisponibles.map(c => `<option value="${c}">${c}</option>`).join('');
        if (catsDisponibles.includes(valorActual)) {
            selectCategoria.value = valorActual;
        }
    }
}

// --- CONEXIÓN Y DATOS DE SUPABASE ---

function configurarRealtimeDolares() {
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
                    await cargarDolaresNubeSilencioso();
                }
            } catch (err) {}
        };
    } catch (e) {}
}

async function cargarDolaresNube() {
    try {
        let res = await fetch(`${SUPABASE_URL}/rest/v1/dolares?select=*&order=fecha.asc,ID.asc`, {
            headers: SUPABASE_HEADERS
        });
        if (res.ok) {
            listaDolares = await res.json();
        }

        let resCat = await fetch(`${SUPABASE_URL}/rest/v1/categorias?select=*`, {
            headers: SUPABASE_HEADERS
        });
        if (resCat.ok) {
            let dataCats = await resCat.json();
            categoriasNubeDolar = { INGRESOS: [], EGRESOS: [] };
            dataCats.forEach(c => {
                if (c.tipo && c.nombre) {
                    let t = c.tipo.toUpperCase();
                    let tipoKey = (t.includes('ING') || t.includes('INGRESO')) ? 'INGRESOS' : 'EGRESOS';
                    categoriasNubeDolar[tipoKey].push(c.nombre.toUpperCase());
                }
            });
        }

        actualizarSelectCategoriasDolar();
        procesarYRenderizarDolares();
    } catch (error) {
        console.error("Error al cargar datos de dólares:", error);
    }
}

async function cargarDolaresNubeSilencioso() {
    try {
        let res = await fetch(`${SUPABASE_URL}/rest/v1/dolares?select=*&order=fecha.asc,ID.asc`, {
            headers: SUPABASE_HEADERS
        });
        if (res.ok) {
            listaDolares = await res.json();
            actualizarSelectCategoriasDolar();
            procesarYRenderizarDolares();
        }
    } catch (error) {}
}

async function agregarMovimientoDolar() {
    const fecha = document.getElementById('dolar-fecha').value;
    const metodo = document.getElementById('dolar-metodo').value;
    
    const tipoHtml = document.getElementById('dolar-tipo').value;
    const tipoTransaccion = obtenerTipoNormalizado(tipoHtml);
    
    const categoriaInput = document.getElementById('dolar-categoria');
    const categoria = categoriaInput.value.trim().toUpperCase();
    
    let montoUsd = parseFloat(document.getElementById('dolar-monto').value) || 0;
    const tasa = parseFloat(document.getElementById('dolar-tasa').value) || 1;
    const retire = document.getElementById('dolar-retire').value;
    const descripcion = document.getElementById('dolar-desc').value.trim();

    if (!categoria) return;

    if (!categoriasDolarBase[tipoTransaccion]) {
        categoriasDolarBase[tipoTransaccion] = [];
    }
    if (!categoriasDolarBase[tipoTransaccion].includes(categoria)) {
        categoriasDolarBase[tipoTransaccion].push(categoria);
        categoriasDolarBase[tipoTransaccion].sort();
    }

    const nuevoRegistro = {
        fecha,
        metodo,
        tipoTransaccion,
        categoria,
        montoUsd: Number(montoUsd.toFixed(2)),
        tasa: Number(tasa.toFixed(2)),
        retire,
        descripcion
    };

    try {
        let response = await fetch(`${SUPABASE_URL}/rest/v1/dolares`, {
            method: 'POST',
            headers: SUPABASE_HEADERS,
            body: JSON.stringify(nuevoRegistro)
        });

        if (response.ok) {
            document.getElementById('form-dolar').reset();
            document.getElementById('dolar-fecha').value = hoy;
            await cargarDolaresNube();
            mostrarNotificacion('Movimiento guardado con éxito', 'success');
        } else {
            mostrarNotificacion('Error al guardar en Supabase', 'error');
        }
    } catch (e) {
        mostrarNotificacion('Error de conexión', 'error');
    }
}

async function eliminarMovimientoDolar(id) {
    try {
        let response = await fetch(`${SUPABASE_URL}/rest/v1/dolares?"ID"=eq.${encodeURIComponent(id)}`, {
            method: 'DELETE',
            headers: SUPABASE_HEADERS
        });

        if (response.ok) {
            await cargarDolaresNube();
            mostrarNotificacion('Registro eliminado', 'info');
        } else {
            mostrarNotificacion('No se pudo eliminar', 'error');
        }
    } catch (e) {}
}

async function actualizarRetiroDolar(id, nuevoRetire) {
    try {
        let response = await fetch(`${SUPABASE_URL}/rest/v1/dolares?"ID"=eq.${encodeURIComponent(id)}`, {
            method: 'PATCH',
            headers: SUPABASE_HEADERS,
            body: JSON.stringify({ retire: nuevoRetire })
        });

        if (response.ok) {
            const index = listaDolares.findIndex(m => String(m.ID !== undefined ? m.ID : m.id) === String(id));
            if (index !== -1) {
                listaDolares[index].retire = nuevoRetire;
            }
            mostrarNotificacion('Estado de retiro actualizado', 'success');
        } else {
            mostrarNotificacion('No se pudo actualizar el retiro', 'error');
            await cargarDolaresNube();
        }
    } catch (e) {
        mostrarNotificacion('Error de conexión', 'error');
        await cargarDolaresNube();
    }
}

// --- RENDERIZADO Y GRÁFICOS ---

function procesarYRenderizarDolares() {
    const tbody = document.getElementById('tabla-dolares');
    if (!tbody) return;
    tbody.innerHTML = '';

    let saldoEfectivoAcumulado = 0;
    let saldoZelleAcumulado = 0;
    let totalIngEfectivo = 0;
    let totalEgrEfectivo = 0;
    let totalIngZelle = 0;
    let totalEgrZelle = 0;
    let ingresosPorCat = {};
    let egresosPorCat = {};

    const datosConSaldo = listaDolares.map(m => {
        let monto = Number(m.montoUsd) || 0;
        let saldoActualFila = 0;
        const tTrans = (m.tipoTransaccion || '').toUpperCase();
        const esIngreso = tTrans.includes('ING');

        if (m.metodo === 'EFECTIVO') {
            if (esIngreso) {
                saldoEfectivoAcumulado += monto;
                totalIngEfectivo += monto;
                ingresosPorCat[m.categoria] = (ingresosPorCat[m.categoria] || 0) + monto;
            } else {
                saldoEfectivoAcumulado -= monto;
                totalEgrEfectivo += monto;
                egresosPorCat[m.categoria] = (egresosPorCat[m.categoria] || 0) + monto;
            }
            saldoActualFila = saldoEfectivoAcumulado;
        } else { 
            if (esIngreso) {
                saldoZelleAcumulado += monto;
                totalIngZelle += monto;
                ingresosPorCat[m.categoria] = (ingresosPorCat[m.categoria] || 0) + monto;
            } else {
                saldoZelleAcumulado -= monto;
                totalEgrZelle += monto;
                egresosPorCat[m.categoria] = (egresosPorCat[m.categoria] || 0) + monto;
            }
            saldoActualFila = saldoZelleAcumulado;
        }
        return { ...m, saldoActualFila };
    });

    const lblSaldoEfe = document.getElementById('lbl-saldo-efectivo');
    const lblIngEfe = document.getElementById('lbl-ing-efectivo');
    const lblEgrEfe = document.getElementById('lbl-egr-efectivo');
    if (lblSaldoEfe) lblSaldoEfe.innerText = `$${saldoEfectivoAcumulado.toFixed(2)}`;
    if (lblIngEfe) lblIngEfe.innerText = `$${totalIngEfectivo.toFixed(2)}`;
    if (lblEgrEfe) lblEgrEfe.innerText = `$${totalEgrEfectivo.toFixed(2)}`;

    const lblSaldoZel = document.getElementById('lbl-saldo-zelle');
    const lblIngZel = document.getElementById('lbl-ing-zelle');
    const lblEgrZel = document.getElementById('lbl-egr-zelle');
    if (lblSaldoZel) lblSaldoZel.innerText = `$${saldoZelleAcumulado.toFixed(2)}`;
    if (lblIngZel) lblIngZel.innerText = `$${totalIngZelle.toFixed(2)}`;
    if (lblEgrZel) lblEgrZel.innerText = `$${totalEgrZelle.toFixed(2)}`;

    const datosInvertidos = [...datosConSaldo].reverse().sort((a, b) => {
        let comparacionFecha = new Date(b.fecha) - new Date(a.fecha);
        if (comparacionFecha !== 0) return comparacionFecha;
        let idA = Number(a.ID !== undefined ? a.ID : a.id) || 0;
        let idB = Number(b.ID !== undefined ? b.ID : b.id) || 0;
        return idB - idA;
    });

    datosInvertidos.forEach(m => {
        const idUnico = m.ID !== undefined ? m.ID : m.id;
        const tr = document.createElement('tr');

        let fechaFormateada = m.fecha;
        if (m.fecha) {
            const partes = m.fecha.split('-');
            if (partes.length === 3) {
                const anio = parseInt(partes[0], 10);
                const mes = parseInt(partes[1], 10) - 1;
                const dia = parseInt(partes[2], 10);
                const fechaObj = new Date(anio, mes, dia);
                fechaFormateada = fechaObj.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
            }
        }

        const esIngreso = (m.tipoTransaccion || '').toUpperCase().includes('ING');

        tr.innerHTML = `
            <td data-label="ID">${idUnico}</td>
            <td data-label="Fecha">${fechaFormateada}</td>
            <td data-label="Método"><span class="badge ${m.metodo.toLowerCase()}">${m.metodo}</span></td>
            <td data-label="Tipo"><span class="badge ${esIngreso ? 'success' : 'danger'}">${m.tipoTransaccion}</span></td>
            <td data-label="Categoría">${m.categoria}</td>
            <td data-label="Monto ($)">$${Number(m.montoUsd).toFixed(2)}</td>
            <td data-label="Saldo Actual"><strong>$${Number(m.saldoActualFila).toFixed(2)}</strong></td>
            <td data-label="Tasa">Bs.S ${Number(m.tasa).toFixed(2)}</td>
            <td data-label="Descripción">${m.descripcion || ''}</td>
            <td data-label="Retiro">
                <select onchange="actualizarRetiroDolar('${idUnico}', this.value)" style="width: 70px; padding: 3px 6px; border-radius: 4px; font-size: 0.9rem; text-align: center;">
                    <option value="NO" ${(!m.retire || m.retire === 'NO') ? 'selected' : ''}>NO</option>
                    <option value="SI" ${m.retire === 'SI' ? 'selected' : ''}>SÍ</option>
                </select>
            </td>
            <td data-label="Acciones">
                <button class="btn-icon text-red" onclick="eliminarMovimientoDolar('${idUnico}')" title="Eliminar" style="background:none; border:none; cursor:pointer; font-size: 1rem;">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    renderizarGraficosDolares(ingresosPorCat, egresosPorCat);
}

function renderizarGraficosDolares(ingresosPorCat, egresosPorCat) {
    const pluginDatalabelsConfig = {
        anchor: (context) => context.dataset.data[context.dataIndex] === 0 ? 'end' : 'center',
        align: (context) => context.dataset.data[context.dataIndex] === 0 ? 'top' : 'center',
        formatter: (value) => `$${Number(value || 0).toFixed(2)}`,
        font: { weight: 'bold', size: 11 },
        color: (context) => context.dataset.data[context.dataIndex] === 0 ? '#888' : '#fff',
        backgroundColor: (context) => context.dataset.data[context.dataIndex] === 0 ? 'transparent' : 'rgba(0, 0, 0, 0.4)',
        borderColor: 'transparent',
        borderRadius: 4,
        padding: 4
    };

    const canvasIng = document.getElementById('graficoIngresosDolar');
    if (canvasIng) {
        if (chartIngresosDolarInst) chartIngresosDolarInst.destroy();
        chartIngresosDolarInst = new Chart(canvasIng, {
            type: 'bar',
            data: {
                labels: Object.keys(ingresosPorCat),
                datasets: [{
                    label: 'Ingresos Dólares ($)',
                    data: Object.values(ingresosPorCat),
                    backgroundColor: 'rgba(40, 167, 69, 0.7)',
                    borderColor: 'rgba(40, 167, 69, 1)',
                    borderWidth: 1
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { datalabels: pluginDatalabelsConfig } },
            plugins: [ChartDataLabels]
        });
    }

    const canvasEgr = document.getElementById('graficoEgresosDolar');
    if (canvasEgr) {
        if (chartEgresosDolarInst) chartEgresosDolarInst.destroy();
        chartEgresosDolarInst = new Chart(canvasEgr, {
            type: 'bar',
            data: {
                labels: Object.keys(egresosPorCat),
                datasets: [{
                    label: 'Egresos Dólares ($)',
                    data: Object.values(egresosPorCat),
                    backgroundColor: 'rgba(220, 53, 69, 0.7)',
                    borderColor: 'rgba(220, 53, 69, 1)',
                    borderWidth: 1
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { datalabels: pluginDatalabelsConfig } },
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
    setTimeout(() => { alerta.className = 'toast-alerta'; }, 3000);
}