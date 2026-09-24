// ============================================================
// PARTE 1 - CONFIGURACIÓN, SUPABASE, FILTRO Y MOVIMIENTOS
// ============================================================

// ------------------------------------------------------------
// CONFIGURACIÓN DE SUPABASE
// ------------------------------------------------------------

const SUPABASE_URL =
    "https://abghxxvrwabdtlgbffej.supabase.co";

const SUPABASE_ANON_KEY =
    "sb_publishable_fgwi1zhb4wT5xullWqLXHg_MBWA7Zh-";

const SUPABASE_HEADERS = {
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json",
    "Prefer": "return=representation"
};


// ------------------------------------------------------------
// VARIABLES GLOBALES
// ------------------------------------------------------------

let listaDolares = [];

let categoriasNubeDolar = {
    INGRESOS: [],
    EGRESOS: []
};

let chartIngresosDolarInst = null;
let chartEgresosDolarInst = null;

let ultimaCategoriaIngresosSeleccionada = null;
let ultimaCategoriaEgresosSeleccionada = null;

const hoy =
    new Date()
        .toISOString()
        .split('T')[0];


// ------------------------------------------------------------
// CATEGORÍAS BASE
// ------------------------------------------------------------

const categoriasDolarBase = {

    INGRESOS: [
        "INICIAL",
        "UNIQUE SWEETS",
        "DOLARES COMPRADOS",
        "REGALOS",
        "REMESAS"
    ],

    EGRESOS: [
        "INSUMOS US",
        "BELLEZA E HIGIENE",
        "ROPA/ACCESORIOS/ZAPATOS",
        "DIVERSIÓN / RECREACIÓN",
        "COMIDA Y BEBIDA",
        "OTROS",
        "VIAJES",
        "REGALOS",
        "MEDICINA Y SALUD",
        "CARRO/GASOLINA",
        "PRESTAMO",
        "TECNOLOGÍA",
        "VENTA DE $"
    ]
};


// ============================================================
// INICIALIZACIÓN
// ============================================================

document.addEventListener(
    'DOMContentLoaded',
    async () => {

        // ----------------------------------------------------
        // FECHA DEL FORMULARIO
        // ----------------------------------------------------

        const inputFecha =
            document.getElementById(
                'dolar-fecha'
            );

        if (inputFecha) {
            inputFecha.value = hoy;
        }


        // ----------------------------------------------------
        // TIPO DE TRANSACCIÓN
        // ----------------------------------------------------

        const tipoTransaccionSelect =
            document.getElementById(
                'dolar-tipo'
            );

        if (tipoTransaccionSelect) {

            tipoTransaccionSelect.addEventListener(
                'change',
                actualizarSelectCategoriasDolar
            );

        }


        // ----------------------------------------------------
        // FILTRO MENSUAL
        // ----------------------------------------------------

        const filtroMes =
            document.getElementById(
                'filtro-mes-dolar'
            );

        if (filtroMes) {

            // IMPORTANTE:
            // NO ponemos mesActual.
            // Al abrir la página queda vacío.
            // Vacío = mostrar todos los registros.

            filtroMes.value = '';

            filtroMes.addEventListener(
                'change',
                () => {

                    // Al cambiar el mes se
                    // vuelve a renderizar todo.

                    procesarYRenderizarDolares();

                }
            );
        }


        // ----------------------------------------------------
        // FORMULARIO
        // ----------------------------------------------------

        const formDolar =
            document.getElementById(
                'form-dolar'
            );

        if (formDolar) {

            formDolar.addEventListener(
                'submit',
                (e) => {

                    e.preventDefault();

                    agregarMovimientoDolar();

                }
            );

        }


        // ----------------------------------------------------
        // CARGAR DATOS
        // ----------------------------------------------------

        await cargarDolaresNube();


        // ----------------------------------------------------
        // REALTIME
        // ----------------------------------------------------

        configurarRealtimeDolares();

    }
);


// ============================================================
// NORMALIZACIÓN
// ============================================================

function obtenerTipoNormalizado(tipoHtml) {

    const limpio =
        String(
            tipoHtml || ''
        )
        .trim()
        .toUpperCase();

    if (
        limpio.includes('INGRESO') ||
        limpio === 'INGRESOS' ||
        limpio === 'ING'
    ) {
        return 'INGRESOS';
    }

    return 'EGRESOS';
}


function obtenerMetodoNormalizado(metodo) {

    const limpio =
        String(
            metodo || 'EFECTIVO'
        )
        .trim()
        .toUpperCase();

    // EFECTIVO
    if (
        limpio.includes('EFECTIVO') ||
        limpio.includes('CASH')
    ) {
        return 'EFECTIVO';
    }

    // ZELLE
    if (
        limpio.includes('ZELLE')
    ) {
        return 'ZELLE';
    }

    // BINANCE
    if (
        limpio.includes('BINANCE')
    ) {
        return 'BINANCE';
    }

    // Si llega algo desconocido,
    // conservar la compatibilidad
    // con el comportamiento anterior.
    return 'EFECTIVO';
}


// ============================================================
// CATEGORÍAS DINÁMICAS
// ============================================================

function obtenerCategoriasDinamicasDolar(
    tipoHtml
) {

    const tipoDb =
        obtenerTipoNormalizado(
            tipoHtml
        );

    const base =
        categoriasDolarBase[tipoDb] || [];

    const nube =
        categoriasNubeDolar[tipoDb] || [];


    // Categorías que ya existen
    // dentro de movimientos guardados.

    const dinamicasMovimientos =
        listaDolares
            .filter(m => {

                const mTipo =
                    obtenerTipoNormalizado(
                        m.tipoTransaccion
                    );

                return (
                    mTipo === tipoDb &&
                    m.categoria
                );

            })
            .map(m => {

                return String(
                    m.categoria
                )
                .trim()
                .toUpperCase();

            });


    return Array.from(
        new Set([
            ...base,
            ...nube,
            ...dinamicasMovimientos
        ])
    )
    .filter(Boolean)
    .sort(
        (a, b) =>
            String(a).localeCompare(
                String(b),
                'es',
                {
                    sensitivity: 'base'
                }
            )
    );
}


function actualizarSelectCategoriasDolar() {

    const selectTipo =
        document.getElementById(
            'dolar-tipo'
        );

    const selectCategoria =
        document.getElementById(
            'dolar-categoria'
        );

    if (
        !selectTipo ||
        !selectCategoria
    ) {
        return;
    }


    const tipoSeleccionado =
        selectTipo.value;


    const catsDisponibles =
        obtenerCategoriasDinamicasDolar(
            tipoSeleccionado
        );


    const valorActual =
        selectCategoria.value;


    selectCategoria.innerHTML =
        catsDisponibles
            .map(categoria => {

                return `
                    <option value="${escapeHtml(categoria)}">
                        ${escapeHtml(categoria)}
                    </option>
                `;

            })
            .join('');


    if (
        catsDisponibles.includes(
            valorActual
        )
    ) {

        selectCategoria.value =
            valorActual;

    }
}


// ============================================================
// FILTRO POR MES
// ============================================================

function obtenerMesFiltradoDolar() {

    const filtro =
        document.getElementById(
            'filtro-mes-dolar'
        );

    if (!filtro) {
        return '';
    }


    const valor =
        String(
            filtro.value || ''
        ).trim();


    // IMPORTANTE:
    // Si está vacío, NO filtrar.
    if (!valor) {
        return '';
    }


    // El input type="month"
    // devuelve YYYY-MM.

    return valor;
}


function obtenerDolaresFiltrados(
    datos = listaDolares
) {

    const mes =
        obtenerMesFiltradoDolar();


    // Sin filtro:
    // todos los registros.

    if (!mes) {
        return [...datos];
    }


    return datos.filter(m => {

        if (!m.fecha) {
            return false;
        }


        const fecha =
            String(
                m.fecha
            );


        return fecha.slice(0, 7) === mes;

    });
}


// ============================================================
// ESCAPE HTML
// ============================================================

function escapeHtml(valor) {

    return String(
        valor ?? ''
    )
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}


// ============================================================
// NOTIFICACIONES
// ============================================================

function mostrarNotificacion(
    mensaje,
    tipo = 'info'
) {

    const toast =
        document.getElementById(
            'toast-alerta'
        );

    if (!toast) {
        return;
    }


    toast.innerText =
        mensaje;


    toast.className =
        `toast-alerta show ${tipo}`;


    setTimeout(
        () => {

            toast.className =
                'toast-alerta';

        },
        3000
    );
}


// ============================================================
// REALTIME SUPABASE
// ============================================================

function configurarRealtimeDolares() {

    const wsProtocol =
        SUPABASE_URL.startsWith(
            'https'
        )
            ? 'wss://'
            : 'ws://';


    const host =
        SUPABASE_URL.replace(
            /^https?:\/\//,
            ''
        );


    const realtimeUrl =
        `${wsProtocol}${host}/realtime/v1/websocket?apikey=${SUPABASE_ANON_KEY}&vsn=1.0.0`;


    try {

        const ws =
            new WebSocket(
                realtimeUrl
            );


        ws.onopen = () => {

            const joinMsg = {

                topic:
                    "realtime:public:*",

                event:
                    "phx_join",

                payload:
                    {},

                ref:
                    "1"

            };


            ws.send(
                JSON.stringify(
                    joinMsg
                )
            );

        };


        ws.onmessage =
            async (event) => {

                try {

                    const data =
                        JSON.parse(
                            event.data
                        );


                    if (
                        data.event === 'INSERT' ||
                        data.event === 'UPDATE' ||
                        data.event === 'DELETE'
                    ) {

                        await cargarDolaresNubeSilencioso();

                    }

                } catch (err) {

                    console.error(
                        'Error procesando Realtime:',
                        err
                    );

                }

            };


        ws.onerror = () => {
            // No interrumpir la aplicación
        };


    } catch (e) {

        console.error(
            'No se pudo configurar Realtime:',
            e
        );

    }
}


// ============================================================
// CARGAR DÓLARES DESDE SUPABASE
// ============================================================

async function cargarDolaresNube() {

    try {

        const res =
            await fetch(
                `${SUPABASE_URL}/rest/v1/dolares?select=*&order=fecha.asc,ID.asc`,
                {
                    headers:
                        SUPABASE_HEADERS
                }
            );


        if (res.ok) {

            listaDolares =
                await res.json();

        } else {

            console.error(
                'Error cargando movimientos:',
                res.status,
                await res.text()
            );

        }


        // ----------------------------------------------------
        // CATEGORÍAS
        // ----------------------------------------------------

        const resCat =
            await fetch(
                `${SUPABASE_URL}/rest/v1/categorias?select=*`,
                {
                    headers:
                        SUPABASE_HEADERS
                }
            );


        if (resCat.ok) {

            const dataCats =
                await resCat.json();


            categoriasNubeDolar = {
                INGRESOS: [],
                EGRESOS: []
            };


            dataCats.forEach(c => {

                if (
                    c.tipo &&
                    c.nombre
                ) {

                    const tipo =
                        String(
                            c.tipo
                        )
                        .trim()
                        .toUpperCase();


                    const tipoKey =
                        (
                            tipo.includes(
                                'INGRESO'
                            ) ||
                            tipo === 'INGRESOS'
                        )
                            ? 'INGRESOS'
                            : 'EGRESOS';


                    categoriasNubeDolar[
                        tipoKey
                    ].push(
                        String(
                            c.nombre
                        )
                        .trim()
                        .toUpperCase()
                    );

                }

            });

        }


        actualizarSelectCategoriasDolar();

        procesarYRenderizarDolares();


    } catch (error) {

        console.error(
            "Error al cargar datos de dólares:",
            error
        );

        mostrarNotificacion(
            'No se pudieron cargar los datos',
            'error'
        );

    }
}


// ============================================================
// CARGA SILENCIOSA
// ============================================================

async function cargarDolaresNubeSilencioso() {

    try {

        const res =
            await fetch(
                `${SUPABASE_URL}/rest/v1/dolares?select=*&order=fecha.asc,ID.asc`,
                {
                    headers:
                        SUPABASE_HEADERS
                }
            );


        if (res.ok) {

            listaDolares =
                await res.json();


            actualizarSelectCategoriasDolar();

            procesarYRenderizarDolares();

        }

    } catch (error) {

        console.error(
            'Error en actualización silenciosa:',
            error
        );

    }
}


// ============================================================
// AGREGAR MOVIMIENTO
// ============================================================

async function agregarMovimientoDolar() {

    const elementoFecha =
        document.getElementById(
            'dolar-fecha'
        );

    const elementoMetodo =
        document.getElementById(
            'dolar-metodo'
        );

    const elementoTipo =
        document.getElementById(
            'dolar-tipo'
        );

    const elementoCategoria =
        document.getElementById(
            'dolar-categoria'
        );

    const elementoMonto =
        document.getElementById(
            'dolar-monto'
        );

    const elementoTasa =
        document.getElementById(
            'dolar-tasa'
        );

    const elementoRetiro =
        document.getElementById(
            'dolar-retire'
        );

    const elementoDescripcion =
        document.getElementById(
            'dolar-desc'
        );


    if (
        !elementoFecha ||
        !elementoMetodo ||
        !elementoTipo ||
        !elementoCategoria ||
        !elementoMonto
    ) {

        mostrarNotificacion(
            'Faltan campos del formulario',
            'error'
        );

        return;

    }


    const fecha =
        elementoFecha.value;


    const metodo =
        obtenerMetodoNormalizado(
            elementoMetodo.value
        );


    const tipoTransaccion =
        obtenerTipoNormalizado(
            elementoTipo.value
        );


    const categoria =
        String(
            elementoCategoria.value || ''
        )
        .trim()
        .toUpperCase();


    const montoUsd =
        parseFloat(
            elementoMonto.value
        ) || 0;


    const tasa =
        parseFloat(
            elementoTasa?.value
        ) || 1;


    const retire =
        elementoRetiro?.value ||
        'NO';


    const descripcion =
        String(
            elementoDescripcion?.value || ''
        )
        .trim();


    if (!fecha) {

        mostrarNotificacion(
            'Debes indicar la fecha',
            'error'
        );

        return;

    }


    if (!categoria) {

        mostrarNotificacion(
            'Debes seleccionar una categoría',
            'error'
        );

        return;

    }


    if (montoUsd <= 0) {

        mostrarNotificacion(
            'El monto debe ser mayor que 0',
            'error'
        );

        return;

    }


    // --------------------------------------------------------
    // GUARDAR CATEGORÍA NUEVA EN MEMORIA
    // --------------------------------------------------------

    if (
        !categoriasDolarBase[
            tipoTransaccion
        ]
    ) {

        categoriasDolarBase[
            tipoTransaccion
        ] = [];

    }


    if (
        !categoriasDolarBase[
            tipoTransaccion
        ].includes(
            categoria
        )
    ) {

        categoriasDolarBase[
            tipoTransaccion
        ].push(
            categoria
        );


        categoriasDolarBase[
            tipoTransaccion
        ].sort();

    }


    // --------------------------------------------------------
    // NUEVO REGISTRO
    // --------------------------------------------------------

    const nuevoRegistro = {

        fecha,

        metodo,

        tipoTransaccion,

        categoria,

        montoUsd:
            Number(
                montoUsd.toFixed(2)
            ),

        tasa:
            Number(
                tasa.toFixed(2)
            ),

        retire,

        descripcion

    };


    try {

        const response =
            await fetch(
                `${SUPABASE_URL}/rest/v1/dolares`,
                {
                    method:
                        'POST',

                    headers:
                        SUPABASE_HEADERS,

                    body:
                        JSON.stringify(
                            nuevoRegistro
                        )
                }
            );


        if (response.ok) {

            const formulario =
                document.getElementById(
                    'form-dolar'
                );


            if (formulario) {
                formulario.reset();
            }


            const fechaForm =
                document.getElementById(
                    'dolar-fecha'
                );


            if (fechaForm) {
                fechaForm.value = hoy;
            }


            // Después de guardar,
            // mantener filtro actual.
            await cargarDolaresNube();


            mostrarNotificacion(
                'Movimiento guardado con éxito',
                'success'
            );

        } else {

            let detalleError = '';

            try {

                detalleError =
                    await response.text();

            } catch (e) {}


            console.error(
                'Error Supabase:',
                response.status,
                detalleError
            );


            mostrarNotificacion(
                'Error al guardar en Supabase',
                'error'
            );

        }

    } catch (e) {

        console.error(
            'Error de conexión:',
            e
        );


        mostrarNotificacion(
            'Error de conexión',
            'error'
        );

    }
}


// ============================================================
// ELIMINAR MOVIMIENTO
// ============================================================

async function eliminarMovimientoDolar(id) {

    if (!id) {
        return;
    }


    try {

        const response =
            await fetch(
                `${SUPABASE_URL}/rest/v1/dolares?"ID"=eq.${encodeURIComponent(id)}`,
                {
                    method:
                        'DELETE',

                    headers:
                        SUPABASE_HEADERS
                }
            );


        if (response.ok) {

            await cargarDolaresNube();


            mostrarNotificacion(
                'Registro eliminado',
                'info'
            );

        } else {

            console.error(
                'Error eliminando:',
                response.status,
                await response.text()
            );


            mostrarNotificacion(
                'No se pudo eliminar',
                'error'
            );

        }

    } catch (e) {

        console.error(
            'Error al eliminar:',
            e
        );


        mostrarNotificacion(
            'Error de conexión',
            'error'
        );

    }
}


// ============================================================
// ACTUALIZAR RETIRO
// ============================================================

async function actualizarRetiroDolar(
    id,
    nuevoRetire
) {

    if (!id) {
        return;
    }


    try {

        const response =
            await fetch(
                `${SUPABASE_URL}/rest/v1/dolares?"ID"=eq.${encodeURIComponent(id)}`,
                {
                    method:
                        'PATCH',

                    headers:
                        SUPABASE_HEADERS,

                    body:
                        JSON.stringify({
                            retire:
                                nuevoRetire
                        })
                }
            );


        if (response.ok) {

            const index =
                listaDolares.findIndex(
                    m => {

                        const registroId =
                            m.ID !== undefined
                                ? m.ID
                                : m.id;

                        return (
                            String(
                                registroId
                            ) ===
                            String(id)
                        );

                    }
                );


            if (index !== -1) {

                listaDolares[
                    index
                ].retire =
                    nuevoRetire;

            }


            mostrarNotificacion(
                'Estado de retiro actualizado',
                'success'
            );


            procesarYRenderizarDolares();

        } else {

            mostrarNotificacion(
                'No se pudo actualizar el retiro',
                'error'
            );


            await cargarDolaresNube();

        }

    } catch (e) {

        console.error(
            'Error actualizando retiro:',
            e
        );


        mostrarNotificacion(
            'Error de conexión',
            'error'
        );


        await cargarDolaresNube();

    }
}


// ============================================================
// FIN DE LA PARTE 1
// La PARTE 2 continúa aquí.
// ============================================================// ============================================================
// PARTE 2 - RESÚMENES, HISTORIAL Y DETALLE POR CATEGORÍA
// ============================================================

function formatearMontoDolar(valor) {
    const numero = Number(valor) || 0;
    return `$${numero.toFixed(2)}`;
}

function formatearFechaDolar(fecha) {
    if (!fecha) return '';

    const partes = String(fecha).split('-');

    if (partes.length === 3) {
        const anio = parseInt(partes[0], 10);
        const mes = parseInt(partes[1], 10) - 1;
        const dia = parseInt(partes[2], 10);

        if (!isNaN(anio) && !isNaN(mes) && !isNaN(dia)) {
            const fechaObj = new Date(anio, mes, dia);

            return fechaObj.toLocaleDateString('es-ES', {
                weekday: 'long',
                day: 'numeric',
                month: 'long'
            });
        }
    }

    return fecha;
}

function ordenarMovimientosDolarAsc(lista) {
    return [...lista].sort((a, b) => {
        const fechaA = new Date(a.fecha || 0);
        const fechaB = new Date(b.fecha || 0);

        const diferenciaFecha = fechaA - fechaB;

        if (diferenciaFecha !== 0) {
            return diferenciaFecha;
        }

        const idA = Number(a.ID !== undefined ? a.ID : a.id) || 0;
        const idB = Number(b.ID !== undefined ? b.ID : b.id) || 0;

        return idA - idB;
    });
}

function ordenarMovimientosDolarDesc(lista) {
    return [...lista].sort((a, b) => {
        const fechaA = new Date(a.fecha || 0);
        const fechaB = new Date(b.fecha || 0);

        const diferenciaFecha = fechaB - fechaA;

        if (diferenciaFecha !== 0) {
            return diferenciaFecha;
        }

        const idA = Number(a.ID !== undefined ? a.ID : a.id) || 0;
        const idB = Number(b.ID !== undefined ? b.ID : b.id) || 0;

        return idB - idA;
    });
}

function obtenerSaldoInicialMetodosDolar() {
    return {
        EFECTIVO: 0,
        ZELLE: 0,
        BINANCE: 0
    };
}

function obtenerTotalesMetodosDolar() {
    return {
        EFECTIVO: {
            ingresos: 0,
            egresos: 0,
            saldo: 0
        },
        ZELLE: {
            ingresos: 0,
            egresos: 0,
            saldo: 0
        },
        BINANCE: {
            ingresos: 0,
            egresos: 0,
            saldo: 0
        }
    };
}

function actualizarResumenMetodoDolar(metodo, resumen) {
    const sufijo = metodo.toLowerCase();

    const lblSaldo = document.getElementById(`lbl-saldo-${sufijo}`);
    const lblIngresos = document.getElementById(`lbl-ing-${sufijo}`);
    const lblEgresos = document.getElementById(`lbl-egr-${sufijo}`);

    if (lblSaldo) {
        lblSaldo.innerText = formatearMontoDolar(resumen.saldo);
    }

    if (lblIngresos) {
        lblIngresos.innerText = formatearMontoDolar(resumen.ingresos);
    }

    if (lblEgresos) {
        lblEgresos.innerText = formatearMontoDolar(resumen.egresos);
    }
}

function actualizarResumenGeneralDolar(totales) {
    const totalGeneral =
        (Number(totales.EFECTIVO.saldo) || 0) +
        (Number(totales.ZELLE.saldo) || 0) +
        (Number(totales.BINANCE.saldo) || 0);

    const lblTotalGeneral = document.getElementById('lbl-total-general');

    if (lblTotalGeneral) {
        lblTotalGeneral.innerText = formatearMontoDolar(totalGeneral);
    }

    return totalGeneral;
}

function prepararDatosDolarParaRender() {
    const listaOrdenada = ordenarMovimientosDolarAsc(listaDolares);

    const saldos = obtenerSaldoInicialMetodosDolar();
    const totales = obtenerTotalesMetodosDolar();

    const ingresosPorCatMetodo = {
        EFECTIVO: {},
        ZELLE: {},
        BINANCE: {}
    };

    const egresosPorCatMetodo = {
        EFECTIVO: {},
        ZELLE: {},
        BINANCE: {}
    };

    const datosConSaldo = listaOrdenada.map(m => {
        const monto = Number(m.montoUsd) || 0;
        const metodo = obtenerMetodoNormalizado(m.metodo);
        const tipo = obtenerTipoNormalizado(m.tipoTransaccion);

        let saldoActualFila = saldos[metodo];

        if (tipo === 'INGRESOS') {
            saldos[metodo] += monto;
            totales[metodo].ingresos += monto;

            if (!ingresosPorCatMetodo[metodo]) {
                ingresosPorCatMetodo[metodo] = {};
            }

            const categoria = String(m.categoria || 'SIN CATEGORÍA').trim().toUpperCase();

            ingresosPorCatMetodo[metodo][categoria] =
                (ingresosPorCatMetodo[metodo][categoria] || 0) + monto;
        } else {
            saldos[metodo] -= monto;
            totales[metodo].egresos += monto;

            if (!egresosPorCatMetodo[metodo]) {
                egresosPorCatMetodo[metodo] = {};
            }

            const categoria = String(m.categoria || 'SIN CATEGORÍA').trim().toUpperCase();

            egresosPorCatMetodo[metodo][categoria] =
                (egresosPorCatMetodo[metodo][categoria] || 0) + monto;
        }

        saldoActualFila = saldos[metodo];

        return {
            ...m,
            metodo,
            tipoTransaccion: tipo,
            saldoActualFila
        };
    });

    Object.keys(totales).forEach(metodo => {
        totales[metodo].saldo = saldos[metodo];
    });

    return {
        datosConSaldo,
        totales,
        ingresosPorCatMetodo,
        egresosPorCatMetodo
    };
}

function obtenerDatosFiltradosParaDolar(datosConSaldo) {
    const mesSeleccionado = obtenerMesFiltradoDolar();

    // Sin mes seleccionado = mostrar TODO
    if (!mesSeleccionado) {
        return [...datosConSaldo];
    }

    return datosConSaldo.filter(m => {
        if (!m.fecha) return false;

        return String(m.fecha).slice(0, 7) === mesSeleccionado;
    });
}

function construirTotalesPorCategoriaDolar(lista, tipoDeseado) {
    const resultado = {};

    lista.forEach(m => {
        const tipo = obtenerTipoNormalizado(m.tipoTransaccion);

        if (tipo !== tipoDeseado) {
            return;
        }

        const categoria = String(
            m.categoria || 'SIN CATEGORÍA'
        ).trim().toUpperCase();

        const metodo = obtenerMetodoNormalizado(m.metodo);
        const monto = Number(m.montoUsd) || 0;

        if (!resultado[metodo]) {
            resultado[metodo] = {};
        }

        resultado[metodo][categoria] =
            (resultado[metodo][categoria] || 0) + monto;
    });

    return resultado;
}

function procesarYRenderizarDolares() {
    const tbody = document.getElementById('tabla-dolares');

    if (!tbody) {
        console.warn('No se encontró el cuerpo de la tabla de dólares.');
        return;
    }

    const datosProcesados = prepararDatosDolarParaRender();

    const datosConSaldo = datosProcesados.datosConSaldo;
    const totales = datosProcesados.totales;

    actualizarResumenMetodoDolar(
        'EFECTIVO',
        totales.EFECTIVO
    );

    actualizarResumenMetodoDolar(
        'ZELLE',
        totales.ZELLE
    );

    actualizarResumenMetodoDolar(
        'BINANCE',
        totales.BINANCE
    );

    actualizarResumenGeneralDolar(totales);

    // ------------------------------------------------------------
    // APLICACIÓN DEL FILTRO MENSUAL
    // El filtro NO altera los saldos actuales de las tarjetas.
    // Solo afecta historial y gráficos.
    // ------------------------------------------------------------

    const datosFiltrados = obtenerDatosFiltradosParaDolar(
        datosConSaldo
    );

    // ------------------------------------------------------------
    // TOTALES PARA LOS GRÁFICOS
    // ------------------------------------------------------------

    const ingresosPorCatMetodo = construirTotalesPorCategoriaDolar(
        datosFiltrados,
        'INGRESOS'
    );

    const egresosPorCatMetodo = construirTotalesPorCategoriaDolar(
        datosFiltrados,
        'EGRESOS'
    );

    // ------------------------------------------------------------
    // HISTORIAL
    // ------------------------------------------------------------

    renderizarTablaDolares(
        datosFiltrados
    );

    // ------------------------------------------------------------
    // GRÁFICOS
    // ------------------------------------------------------------

    renderizarGraficosDolares(
        ingresosPorCatMetodo,
        egresosPorCatMetodo
    );

    // ------------------------------------------------------------
    // SI HABÍA UN DETALLE ABIERTO, ACTUALIZARLO CON EL FILTRO
    // ------------------------------------------------------------

    if (ultimaCategoriaIngresosSeleccionada) {
        mostrarDetalleCategoriaDolar(
            ultimaCategoriaIngresosSeleccionada,
            'INGRESOS',
            false
        );
    }

    if (ultimaCategoriaEgresosSeleccionada) {
        mostrarDetalleCategoriaDolar(
            ultimaCategoriaEgresosSeleccionada,
            'EGRESOS',
            false
        );
    }
}

function renderizarTablaDolares(datos) {
    const tbody = document.getElementById('tabla-dolares');

    if (!tbody) return;

    tbody.innerHTML = '';

    const datosInvertidos = ordenarMovimientosDolarDesc(
        datos
    );

    if (datosInvertidos.length === 0) {
        const filaVacia = document.createElement('tr');

        filaVacia.innerHTML = `
            <td colspan="11" style="text-align:center; padding:20px; color:#777;">
                No hay movimientos para el período seleccionado.
            </td>
        `;

        tbody.appendChild(filaVacia);
        return;
    }

    datosInvertidos.forEach(m => {
        const idUnico =
            m.ID !== undefined
                ? m.ID
                : m.id;

        const tr = document.createElement('tr');

        const fechaFormateada = formatearFechaDolar(
            m.fecha
        );

        const metodo = obtenerMetodoNormalizado(
            m.metodo
        );

        const tipoTransaccion = obtenerTipoNormalizado(
            m.tipoTransaccion
        );

        const esIngreso =
            tipoTransaccion === 'INGRESOS';

        const categoria = String(
            m.categoria || ''
        ).toUpperCase();

        const descripcion = String(
            m.descripcion || ''
        );

        const claseMetodo = metodo.toLowerCase();

        const idParaFuncion = String(
            idUnico
        ).replace(/\\/g, '\\\\').replace(/'/g, "\\'");

        tr.innerHTML = `
            <td data-label="ID">
                ${escapeHtml(String(idUnico))}
            </td>

            <td data-label="Fecha">
                ${escapeHtml(fechaFormateada)}
            </td>

            <td data-label="Método">
                <span class="badge ${claseMetodo}">
                    ${escapeHtml(metodo)}
                </span>
            </td>

            <td data-label="Tipo">
                <span class="badge ${esIngreso ? 'success' : 'danger'}">
                    ${escapeHtml(tipoTransaccion)}
                </span>
            </td>

            <td data-label="Categoría">
                ${escapeHtml(categoria)}
            </td>

            <td data-label="Monto ($)">
                ${formatearMontoDolar(m.montoUsd)}
            </td>

            <td data-label="Saldo Actual">
                <strong>
                    ${formatearMontoDolar(m.saldoActualFila)}
                </strong>
            </td>

            <td data-label="Tasa">
                Bs.S ${Number(m.tasa || 0).toFixed(2)}
            </td>

            <td data-label="Descripción">
                ${escapeHtml(descripcion)}
            </td>

            <td data-label="Retiro">
                <select
                    onchange="actualizarRetiroDolar('${idParaFuncion}', this.value)"
                    style="
                        width:70px;
                        padding:3px 6px;
                        border-radius:4px;
                        font-size:0.9rem;
                        text-align:center;
                    "
                >
                    <option
                        value="NO"
                        ${(!m.retire || String(m.retire).toUpperCase() === 'NO') ? 'selected' : ''}
                    >
                        NO
                    </option>

                    <option
                        value="SI"
                        ${String(m.retire || '').toUpperCase() === 'SI' ? 'selected' : ''}
                    >
                        SÍ
                    </option>
                </select>
            </td>

            <td data-label="Acciones">
                <button
                    class="btn-icon text-red"
                    onclick="eliminarMovimientoDolar('${idParaFuncion}')"
                    title="Eliminar"
                    style="
                        background:none;
                        border:none;
                        cursor:pointer;
                        font-size:1rem;
                    "
                >
                    <i class="fas fa-trash-alt"></i>
                </button>
            </td>
        `;

        tbody.appendChild(tr);
    });
}

// ============================================================
// DETALLE DESPLEGABLE AL HACER CLICK EN UNA BARRA
// ============================================================

function obtenerContenedorDetalleDolar(tipo) {
    if (tipo === 'INGRESOS') {
        return document.getElementById(
            'detalleGraficoIngresosDolar'
        );
    }

    return document.getElementById(
        'detalleGraficoEgresosDolar'
    );
}

function limpiarDetalleGraficoDolar(tipo) {
    const contenedor = obtenerContenedorDetalleDolar(tipo);

    if (!contenedor) return;

    contenedor.innerHTML = '';
    contenedor.style.display = 'none';
}

function mostrarDetalleCategoriaDolar(
    categoria,
    tipo,
    hacerScroll = true
) {
    categoria = String(
        categoria || ''
    ).trim().toUpperCase();

    tipo = obtenerTipoNormalizado(tipo);

    const contenedor = obtenerContenedorDetalleDolar(
        tipo
    );

    if (!contenedor) return;

    const datosProcesados =
        prepararDatosDolarParaRender();

    const datosFiltrados =
        obtenerDatosFiltradosParaDolar(
            datosProcesados.datosConSaldo
        );

    const registrosCategoria =
        datosFiltrados
            .filter(m => {
                return (
                    obtenerTipoNormalizado(
                        m.tipoTransaccion
                    ) === tipo &&
                    String(
                        m.categoria || ''
                    ).trim().toUpperCase() === categoria
                );
            })
            .sort((a, b) => {
                const fechaB = new Date(b.fecha || 0);
                const fechaA = new Date(a.fecha || 0);

                if (fechaB - fechaA !== 0) {
                    return fechaB - fechaA;
                }

                const idA =
                    Number(
                        a.ID !== undefined
                            ? a.ID
                            : a.id
                    ) || 0;

                const idB =
                    Number(
                        b.ID !== undefined
                            ? b.ID
                            : b.id
                    ) || 0;

                return idB - idA;
            });

    if (tipo === 'INGRESOS') {
        ultimaCategoriaIngresosSeleccionada = categoria;
    } else {
        ultimaCategoriaEgresosSeleccionada = categoria;
    }

    let nombreTipo =
        tipo === 'INGRESOS'
            ? 'Ingresos'
            : 'Egresos';

    let contenido = `
        <details open style="
            margin-top:15px;
            border:1px solid #ddd;
            border-radius:8px;
            padding:10px 12px;
            background:#fff;
        ">
            <summary style="
                cursor:pointer;
                font-weight:bold;
                font-size:1rem;
                padding:5px 0;
            ">
                Registros de ${nombreTipo}:
                ${escapeHtml(categoria)}
                (${registrosCategoria.length})
            </summary>

            <div style="margin-top:12px;">
    `;

    if (registrosCategoria.length === 0) {
        contenido += `
            <div style="
                padding:15px;
                text-align:center;
                color:#777;
            ">
                No hay registros de esta categoría
                para el período seleccionado.
            </div>
        `;
    } else {
        contenido += `
            <div style="
                overflow-x:auto;
                width:100%;
            ">
                <table style="
                    width:100%;
                    border-collapse:collapse;
                    font-size:0.9rem;
                ">
                    <thead>
                        <tr>
                            <th style="padding:8px; text-align:left;">Fecha</th>
                            <th style="padding:8px; text-align:left;">Método</th>
                            <th style="padding:8px; text-align:left;">Categoría</th>
                            <th style="padding:8px; text-align:right;">Monto</th>
                            <th style="padding:8px; text-align:left;">Descripción</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        registrosCategoria.forEach(m => {
            const metodo = obtenerMetodoNormalizado(
                m.metodo
            );

            contenido += `
                <tr>
                    <td style="padding:8px; border-top:1px solid #eee;">
                        ${escapeHtml(
                            formatearFechaDolar(m.fecha)
                        )}
                    </td>

                    <td style="padding:8px; border-top:1px solid #eee;">
                        <span class="badge ${metodo.toLowerCase()}">
                            ${escapeHtml(metodo)}
                        </span>
                    </td>

                    <td style="padding:8px; border-top:1px solid #eee;">
                        ${escapeHtml(
                            String(m.categoria || '').toUpperCase()
                        )}
                    </td>

                    <td style="
                        padding:8px;
                        border-top:1px solid #eee;
                        text-align:right;
                        font-weight:bold;
                    ">
                        ${formatearMontoDolar(m.montoUsd)}
                    </td>

                    <td style="padding:8px; border-top:1px solid #eee;">
                        ${escapeHtml(String(m.descripcion || ''))}
                    </td>
                </tr>
            `;
        });

        contenido += `
                    </tbody>
                </table>
            </div>
        `;
    }

    contenido += `
            </div>

            <div style="
                display:flex;
                justify-content:flex-end;
                margin-top:10px;
            ">
                <button
                    type="button"
                    onclick="limpiarDetalleGraficoDolar('${tipo}')"
                    style="
                        border:none;
                        background:#eee;
                        border-radius:5px;
                        padding:6px 12px;
                        cursor:pointer;
                    "
                >
                    Cerrar
                </button>
            </div>
        </details>
    `;

    contenedor.innerHTML = contenido;
    contenedor.style.display = 'block';

    if (hacerScroll) {
        setTimeout(() => {
            contenedor.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest'
            });
        }, 50);
    }
}

function limpiarTodosLosDetallesDolar() {
    limpiarDetalleGraficoDolar('INGRESOS');
    limpiarDetalleGraficoDolar('EGRESOS');
}

// ============================================================
// UTILIDAD PARA OBTENER EL MES COMO TEXTO LEGIBLE
// ============================================================

function obtenerNombreMesDolar(valorMes) {
    if (!valorMes) {
        return 'Todos los meses';
    }

    const partes = String(valorMes).split('-');

    if (partes.length !== 2) {
        return valorMes;
    }

    const anio = Number(partes[0]);
    const mes = Number(partes[1]);

    if (!anio || !mes) {
        return valorMes;
    }

    const fecha = new Date(
        anio,
        mes - 1,
        1
    );

    return fecha.toLocaleDateString(
        'es-ES',
        {
            month: 'long',
            year: 'numeric'
        }
    );
}

// ============================================================
// FIN DE LA PARTE 2
// La PARTE 3 continúa con renderizarGraficosDolares()
// y el gráfico de INGRESOS + EGRESOS con BINANCE,
// totales arriba y click para abrir los registros.
// ============================================================// ============================================================
// ============================================================
// ============================================================
// PARTE 3 - GRÁFICOS DE DÓLARES
// BARRAS SEPARADAS POR MÉTODO
// EFECTIVO + ZELLE + BINANCE
// TOTAL FILTRADO DE INGRESOS / EGRESOS
// CLICK = REGISTROS DE ESA CATEGORÍA + MÉTODO + TIPO
// ============================================================

function renderizarGraficosDolares(
    ingresosPorCatMetodo,
    egresosPorCatMetodo
) {

    if (typeof Chart === 'undefined') {
        console.error('Chart.js no está disponible.');
        return;
    }


    // --------------------------------------------------------
    // MÉTODOS
    // --------------------------------------------------------

    const metodosDolar = [
        'EFECTIVO',
        'ZELLE',
        'BINANCE'
    ];


    // --------------------------------------------------------
    // CONSTRUIR DATOS
    // --------------------------------------------------------

    function construirDatosGrafico(
        catMetodoObj,
        esIngreso
    ) {

        catMetodoObj = catMetodoObj || {};


        metodosDolar.forEach(metodo => {

            if (!catMetodoObj[metodo]) {
                catMetodoObj[metodo] = {};
            }

        });


        // ----------------------------------------------------
        // CATEGORÍAS
        // ----------------------------------------------------

        const categorias =
            Array.from(
                new Set([
                    ...Object.keys(
                        catMetodoObj.EFECTIVO || {}
                    ),

                    ...Object.keys(
                        catMetodoObj.ZELLE || {}
                    ),

                    ...Object.keys(
                        catMetodoObj.BINANCE || {}
                    )
                ])
            )
            .filter(categoria => {

                const efectivo =
                    Number(
                        catMetodoObj.EFECTIVO?.[categoria]
                    ) || 0;

                const zelle =
                    Number(
                        catMetodoObj.ZELLE?.[categoria]
                    ) || 0;

                const binance =
                    Number(
                        catMetodoObj.BINANCE?.[categoria]
                    ) || 0;

                return (
                    efectivo > 0 ||
                    zelle > 0 ||
                    binance > 0
                );

            })
            .sort(
                (a, b) =>
                    String(a).localeCompare(
                        String(b),
                        'es',
                        {
                            sensitivity: 'base'
                        }
                    )
            );


        // ----------------------------------------------------
        // EFECTIVO
        // ----------------------------------------------------

        const dataEfectivo =
            categorias.map(categoria => {

                const valor =
                    Number(
                        catMetodoObj.EFECTIVO?.[categoria]
                    ) || 0;

                return valor > 0
                    ? Number(
                        valor.toFixed(2)
                    )
                    : null;

            });


        // ----------------------------------------------------
        // ZELLE
        // ----------------------------------------------------

        const dataZelle =
            categorias.map(categoria => {

                const valor =
                    Number(
                        catMetodoObj.ZELLE?.[categoria]
                    ) || 0;

                return valor > 0
                    ? Number(
                        valor.toFixed(2)
                    )
                    : null;

            });


        // ----------------------------------------------------
        // BINANCE
        // ----------------------------------------------------

        const dataBinance =
            categorias.map(categoria => {

                const valor =
                    Number(
                        catMetodoObj.BINANCE?.[categoria]
                    ) || 0;

                return valor > 0
                    ? Number(
                        valor.toFixed(2)
                    )
                    : null;

            });


        // ----------------------------------------------------
        // TOTAL POR CATEGORÍA
        // ----------------------------------------------------

        const totalesCategorias =
            categorias.map(categoria => {

                const efectivo =
                    Number(
                        catMetodoObj.EFECTIVO?.[categoria]
                    ) || 0;

                const zelle =
                    Number(
                        catMetodoObj.ZELLE?.[categoria]
                    ) || 0;

                const binance =
                    Number(
                        catMetodoObj.BINANCE?.[categoria]
                    ) || 0;

                return Number(
                    (
                        efectivo +
                        zelle +
                        binance
                    ).toFixed(2)
                );

            });


        return {

            labels:
                categorias,

            datasets: [

                {
                    label: 'Efectivo',

                    data:
                        dataEfectivo,

                    backgroundColor:
                        esIngreso
                            ? 'rgba(40, 167, 69, 0.75)'
                            : 'rgba(220, 53, 69, 0.78)',

                    borderColor:
                        esIngreso
                            ? 'rgba(40, 167, 69, 1)'
                            : 'rgba(220, 53, 69, 1)',

                    borderWidth: 1,

                    barPercentage: 0.70,

                    categoryPercentage: 0.75,

                    borderRadius: 2
                },

                {
                    label: 'Zelle',

                    data:
                        dataZelle,

                    backgroundColor:
                        esIngreso
                            ? 'rgba(0, 51, 153, 0.80)'
                            : 'rgba(255, 159, 64, 0.82)',

                    borderColor:
                        esIngreso
                            ? 'rgba(0, 51, 153, 1)'
                            : 'rgba(255, 159, 64, 1)',

                    borderWidth: 1,

                    barPercentage: 0.70,

                    categoryPercentage: 0.75,

                    borderRadius: 2
                },

                {
                    label: 'Binance',

                    data:
                        dataBinance,

                    backgroundColor:
                        esIngreso
                            ? 'rgba(245, 194, 41, 0.88)'
                            : 'rgba(244, 180, 0, 0.88)',

                    borderColor:
                        esIngreso
                            ? 'rgba(210, 160, 10, 1)'
                            : 'rgba(210, 145, 0, 1)',

                    borderWidth: 1,

                    barPercentage: 0.70,

                    categoryPercentage: 0.75,

                    borderRadius: 2
                }

            ],

            totalesCategorias

        };

    }


    // ========================================================
    // TOTAL COMPLETO DEL GRÁFICO
    // ========================================================

    function calcularTotalGrafico(config) {

        let total = 0;


        config.datasets.forEach(dataset => {

            dataset.data.forEach(valor => {

                if (
                    valor !== null &&
                    valor !== undefined
                ) {

                    total +=
                        Number(valor) || 0;

                }

            });

        });


        return Number(
            total.toFixed(2)
        );
    }


    // ========================================================
    // ACTUALIZAR TOTAL INGRESOS / EGRESOS FILTRADO
    // ========================================================

    function actualizarTotalFiltrado(
        id,
        total
    ) {

        const elemento =
            document.getElementById(id);


        if (!elemento) {
            return;
        }


        elemento.innerText =
            `$${Number(total).toFixed(2)}`;

    }


    // ========================================================
    // DATALABELS
    // ========================================================

    const pluginDatalabelsConfig = {

        anchor: 'center',

        align: 'center',

        clamp: true,

        formatter: value => {

            if (
                value === null ||
                value === undefined ||
                Number(value) <= 0
            ) {
                return null;
            }

            return `$${Number(value).toFixed(2)}`;

        },

        font: {

            weight: 'bold',

            size: 9

        },

        color: '#ffffff',

        backgroundColor: context => {

            const value =
                context.dataset.data[
                    context.dataIndex
                ];


            if (
                value === null ||
                value === undefined ||
                Number(value) <= 0
            ) {

                return 'transparent';

            }


            return 'rgba(0, 0, 0, 0.70)';

        },

        borderRadius: context => {

            const value =
                context.dataset.data[
                    context.dataIndex
                ];


            return (
                value &&
                Number(value) > 0
            )
                ? 4
                : 0;

        },

        padding: context => {

            const value =
                context.dataset.data[
                    context.dataIndex
                ];


            return (
                value &&
                Number(value) > 0
            )
                ? 3
                : 0;

        }

    };


    // ========================================================
    // TOTAL ENCIMA DE CADA GRUPO
    // ========================================================

    const pluginTotalEncima = {

        id:
            'pluginTotalEncimaDolar',

        afterDatasetsDraw(chart) {

            const datasets =
                chart.data.datasets || [];

            const labels =
                chart.data.labels || [];


            if (!labels.length) {
                return;
            }


            const ctx =
                chart.ctx;


            ctx.save();


            ctx.font =
                'bold 10px Arial, sans-serif';


            ctx.fillStyle =
                '#333';


            ctx.textAlign =
                'center';


            ctx.textBaseline =
                'bottom';


            labels.forEach(
                (categoria, index) => {

                    let total = 0;

                    const posicionesX = [];

                    let ySuperior =
                        Number.POSITIVE_INFINITY;


                    datasets.forEach(
                        (
                            dataset,
                            datasetIndex
                        ) => {

                            const valor =
                                Number(
                                    dataset.data?.[index]
                                ) || 0;


                            if (valor <= 0) {
                                return;
                            }


                            total += valor;


                            const meta =
                                chart.getDatasetMeta(
                                    datasetIndex
                                );


                            const barra =
                                meta.data?.[index];


                            if (barra) {

                                posicionesX.push(
                                    barra.x
                                );


                                ySuperior =
                                    Math.min(
                                        ySuperior,
                                        barra.y
                                    );

                            }

                        }
                    );


                    if (
                        total <= 0 ||
                        !posicionesX.length
                    ) {
                        return;
                    }


                    const xCoord =
                        (
                            Math.min(
                                ...posicionesX
                            ) +
                            Math.max(
                                ...posicionesX
                            )
                        ) / 2;


                    const yCoord =
                        ySuperior - 10;


                    ctx.fillText(
                        `Total: $${total.toFixed(2)}`,
                        xCoord,
                        yCoord
                    );

                }
            );


            ctx.restore();

        }

    };


    // ========================================================
    // CLICK EN BARRA
    // ========================================================

    function manejarClickGraficoDolar(
        event,
        elementos,
        chart,
        tipo
    ) {

        if (
            !elementos ||
            elementos.length === 0
        ) {
            return;
        }


        const elemento =
            elementos[0];


        const indiceCategoria =
            elemento.index;


        const indiceMetodo =
            elemento.datasetIndex;


        if (
            indiceCategoria === undefined ||
            indiceMetodo === undefined
        ) {
            return;
        }


        const categoria =
            chart.data.labels?.[
                indiceCategoria
            ];


        const dataset =
            chart.data.datasets?.[
                indiceMetodo
            ];


        if (
            !categoria ||
            !dataset
        ) {
            return;
        }


        const metodo =
            String(
                dataset.label || ''
            )
            .trim()
            .toUpperCase();


        mostrarDetalleBarraDolar(
            categoria,
            tipo,
            metodo
        );

    }


    // ========================================================
    // CREAR GRÁFICO
    // ========================================================

    function crearGraficoDolar(
        canvas,
        config,
        tipo
    ) {

        if (!canvas) {
            return null;
        }


        const plugins = [
            pluginTotalEncima
        ];


        if (
            typeof ChartDataLabels !==
            'undefined'
        ) {

            plugins.unshift(
                ChartDataLabels
            );

        }


        return new Chart(
            canvas,
            {

                type: 'bar',


                data: {

                    labels:
                        config.labels,

                    datasets:
                        config.datasets

                },


                options: {

                    responsive: true,

                    maintainAspectRatio:
                        false,


                    interaction: {

                        mode: 'nearest',

                        intersect: true

                    },


                    onClick: function(
                        event,
                        elementos,
                        chart
                    ) {

                        manejarClickGraficoDolar(
                            event,
                            elementos,
                            chart,
                            tipo
                        );

                    },


                    layout: {

                        padding: {

                            top: 30,

                            right: 15,

                            bottom: 5,

                            left: 10

                        }

                    },


                    scales: {

                        x: {

                            stacked: false,

                            ticks: {

                                autoSkip: false,

                                maxRotation: 35,

                                minRotation: 0,

                                font: {
                                    size: 11
                                }

                            },

                            // SIN TITULO DEL EJE X
                            title: {
                                display: false
                            }

                        },


                        y: {

                            stacked: false,

                            beginAtZero: true,

                            grace: '20%',

                            // SIN TITULO DEL EJE Y
                            title: {
                                display: false
                            },

                            ticks: {

                                callback:
                                    function(value) {

                                        return `$${Number(
                                            value
                                        ).toFixed(2)}`;

                                    }

                            }

                        }

                    },


                    plugins: {

                        legend: {

                            display: true,

                            position: 'top',

                            labels: {

                                boxWidth: 38,

                                padding: 12

                            }

                        },


                        tooltip: {

                            callbacks: {

                                title:
                                    function(
                                        tooltipItems
                                    ) {

                                        if (
                                            !tooltipItems ||
                                            !tooltipItems.length
                                        ) {
                                            return '';
                                        }


                                        return tooltipItems[0]
                                            .label;

                                    },


                                label:
                                    function(
                                        context
                                    ) {

                                        const valor =
                                            Number(
                                                context.raw
                                            ) || 0;


                                        return `${context.dataset.label}: $${valor.toFixed(2)}`;

                                    },


                                afterBody:
                                    function(
                                        tooltipItems
                                    ) {

                                        if (
                                            !tooltipItems ||
                                            !tooltipItems.length
                                        ) {
                                            return '';
                                        }


                                        const indice =
                                            tooltipItems[0]
                                                .dataIndex;


                                        const total =
                                            config
                                                .totalesCategorias[
                                                    indice
                                                ] || 0;


                                        return `Total categoría: $${Number(
                                            total
                                        ).toFixed(2)}`;

                                    }

                            }

                        },


                        datalabels:
                            pluginDatalabelsConfig

                    }

                },


                plugins

            }
        );

    }


    // ========================================================
    // GRÁFICO INGRESOS
    // ========================================================

    const canvasIng =
        document.getElementById(
            'graficoIngresosDolar'
        );


    if (canvasIng) {

        if (
            chartIngresosDolarInst
        ) {

            chartIngresosDolarInst.destroy();

            chartIngresosDolarInst =
                null;

        }


        limpiarDetalleGraficoDolar(
            'INGRESOS'
        );


        const configIng =
            construirDatosGrafico(
                ingresosPorCatMetodo,
                true
            );


        // TOTAL DE INGRESOS DEL MES/FILTRO
        const totalIngresos =
            calcularTotalGrafico(
                configIng
            );


        actualizarTotalFiltrado(
            'total-ingresos-filtrado-dolar',
            totalIngresos
        );


        chartIngresosDolarInst =
            crearGraficoDolar(
                canvasIng,
                configIng,
                'INGRESOS'
            );

    }


    // ========================================================
    // GRÁFICO EGRESOS
    // ========================================================

    const canvasEgr =
        document.getElementById(
            'graficoEgresosDolar'
        );


    if (canvasEgr) {

        if (
            chartEgresosDolarInst
        ) {

            chartEgresosDolarInst.destroy();

            chartEgresosDolarInst =
                null;

        }


        limpiarDetalleGraficoDolar(
            'EGRESOS'
        );


        const configEgr =
            construirDatosGrafico(
                egresosPorCatMetodo,
                false
            );


        // TOTAL DE EGRESOS DEL MES/FILTRO
        const totalEgresos =
            calcularTotalGrafico(
                configEgr
            );


        actualizarTotalFiltrado(
            'total-egresos-filtrado-dolar',
            totalEgresos
        );


        chartEgresosDolarInst =
            crearGraficoDolar(
                canvasEgr,
                configEgr,
                'EGRESOS'
            );

    }

}


// ============================================================
// DETALLE DE UNA BARRA ESPECÍFICA
// CATEGORÍA + TIPO + MÉTODO
// ============================================================

function mostrarDetalleBarraDolar(
    categoria,
    tipo,
    metodo
) {

    categoria =
        String(
            categoria || ''
        )
        .trim()
        .toUpperCase();


    tipo =
        obtenerTipoNormalizado(
            tipo
        );


    metodo =
        obtenerMetodoNormalizado(
            metodo
        );


    const contenedor =
        tipo === 'INGRESOS'
            ? document.getElementById(
                'detalleGraficoIngresosDolar'
            )
            : document.getElementById(
                'detalleGraficoEgresosDolar'
            );


    if (!contenedor) {
        return;
    }


    // --------------------------------------------------------
    // DATOS
    // --------------------------------------------------------

    const datosProcesados =
        prepararDatosDolarParaRender();


    const datosBase =
        datosProcesados.datosConSaldo || [];


    const mes =
        obtenerMesFiltradoDolar();


    // --------------------------------------------------------
    // FILTRAR POR:
    // TIPO + MÉTODO + CATEGORÍA + MES
    // --------------------------------------------------------

    const registros =
        datosBase
            .filter(m => {

                if (
                    obtenerTipoNormalizado(
                        m.tipoTransaccion
                    ) !== tipo
                ) {
                    return false;
                }


                if (
                    obtenerMetodoNormalizado(
                        m.metodo
                    ) !== metodo
                ) {
                    return false;
                }


                if (
                    String(
                        m.categoria || ''
                    )
                    .trim()
                    .toUpperCase() !==
                    categoria
                ) {
                    return false;
                }


                if (mes) {

                    if (!m.fecha) {
                        return false;
                    }


                    if (
                        String(
                            m.fecha
                        ).slice(0, 7) !== mes
                    ) {
                        return false;
                    }

                }


                return true;

            })
            .sort((a, b) => {

                const fechaA =
                    new Date(
                        a.fecha || 0
                    );

                const fechaB =
                    new Date(
                        b.fecha || 0
                    );


                if (
                    fechaB - fechaA !== 0
                ) {
                    return fechaB - fechaA;
                }


                const idA =
                    Number(
                        a.ID !== undefined
                            ? a.ID
                            : a.id
                    ) || 0;


                const idB =
                    Number(
                        b.ID !== undefined
                            ? b.ID
                            : b.id
                    ) || 0;


                return idB - idA;

            });


    // --------------------------------------------------------
    // TOTAL DEL DETALLE
    // --------------------------------------------------------

    const total =
        registros.reduce(
            (acumulado, registro) => {

                return (
                    acumulado +
                    (
                        Number(
                            registro.montoUsd
                        ) || 0
                    )
                );

            },
            0
        );


    const periodo =
        mes
            ? obtenerNombreMesDolar(mes)
            : 'Todos los meses';


    // --------------------------------------------------------
    // HTML DETALLE
    // --------------------------------------------------------

    let html = `

        <details open style="
            border:1px solid #dfe4ea;
            border-radius:8px;
            padding:10px 12px;
            background:#ffffff;
        ">

            <summary style="
                cursor:pointer;
                font-weight:bold;
                padding:5px 0;
                color:#1f3864;
            ">

                ${escapeHtml(tipo)}
                ·
                ${escapeHtml(categoria)}
                ·
                ${escapeHtml(metodo)}

                — ${registros.length} registro(s)

            </summary>

            <div style="
                margin-top:12px;
            ">
    `;


    if (!registros.length) {

        html += `

            <div style="
                padding:15px;
                text-align:center;
                color:#777;
            ">

                No hay registros para esta combinación
                en ${escapeHtml(periodo)}.

            </div>

        `;

    } else {

        html += `

            <div style="
                overflow-x:auto;
            ">

                <table style="
                    width:100%;
                    border-collapse:collapse;
                    font-size:0.9rem;
                ">

                    <thead>

                        <tr>

                            <th style="padding:8px;">
                                Fecha
                            </th>

                            <th style="padding:8px;">
                                Método
                            </th>

                            <th style="padding:8px;">
                                Tipo
                            </th>

                            <th style="padding:8px;">
                                Categoría
                            </th>

                            <th style="
                                padding:8px;
                                text-align:right;
                            ">
                                Monto
                            </th>

                            <th style="padding:8px;">
                                Descripción
                            </th>

                        </tr>

                    </thead>

                    <tbody>
        `;


        registros.forEach(m => {

            html += `

                <tr>

                    <td style="padding:8px; border-top:1px solid #eee;">
                        ${escapeHtml(
                            formatearFechaDolar(
                                m.fecha
                            )
                        )}
                    </td>


                    <td style="padding:8px; border-top:1px solid #eee;">

                        <span class="badge ${metodo.toLowerCase()}">
                            ${escapeHtml(metodo)}
                        </span>

                    </td>


                    <td style="padding:8px; border-top:1px solid #eee;">

                        <span class="badge ${
                            tipo === 'INGRESOS'
                                ? 'success'
                                : 'danger'
                        }">

                            ${escapeHtml(tipo)}

                        </span>

                    </td>


                    <td style="padding:8px; border-top:1px solid #eee;">
                        ${escapeHtml(
                            String(
                                m.categoria || ''
                            ).toUpperCase()
                        )}
                    </td>


                    <td style="
                        padding:8px;
                        border-top:1px solid #eee;
                        text-align:right;
                        font-weight:bold;
                    ">

                        $${Number(
                            m.montoUsd || 0
                        ).toFixed(2)}

                    </td>


                    <td style="padding:8px; border-top:1px solid #eee;">

                        ${escapeHtml(
                            String(
                                m.descripcion || ''
                            )
                        )}

                    </td>

                </tr>

            `;

        });


        html += `

                    </tbody>

                </table>

            </div>


            <div style="
                margin-top:10px;
                text-align:right;
                font-weight:bold;
                color:#1f3864;
            ">

                Total:
                $${total.toFixed(2)}

            </div>

        `;

    }


    html += `

            </div>


            <div style="
                display:flex;
                justify-content:flex-end;
                margin-top:10px;
            ">

                <button
                    type="button"
                    onclick="limpiarDetalleGraficoDolar('${tipo}')"
                    style="
                        border:none;
                        background:#eeeeee;
                        border-radius:5px;
                        padding:6px 12px;
                        cursor:pointer;
                    "
                >
                    Cerrar
                </button>

            </div>

        </details>

    `;


    contenedor.innerHTML =
        html;


    contenedor.style.display =
        'block';


    setTimeout(() => {

        contenedor.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest'
        });

    }, 50);

}


// ============================================================
// LIMPIAR DETALLE
// ============================================================

function limpiarDetalleGraficoDolar(
    tipo
) {

    const contenedor =
        tipo === 'INGRESOS'
            ? document.getElementById(
                'detalleGraficoIngresosDolar'
            )
            : document.getElementById(
                'detalleGraficoEgresosDolar'
            );


    if (!contenedor) {
        return;
    }


    contenedor.innerHTML =
        '';


    contenedor.style.display =
        'none';

}