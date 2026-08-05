// FUNCIÓN PARA RENDERIZAR LOS GRÁFICOS CON CHART.JS Y ETIQUETAS DE MONTO
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

    // 1. Gráfico de Ingresos
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
                    datalabels: {
                        anchor: 'end',
                        align: 'top',
                        formatter: (value) => `$${value.toFixed(2)}`,
                        color: '#333',
                        font: { weight: 'bold', size: 11 }
                    }
                }
            },
            plugins: [ChartDataLabels] // Activa el plugin explícitamente si es necesario
        });
    }

    // 2. Gráfico de Gastos
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
                    datalabels: {
                        anchor: 'end',
                        align: 'top',
                        formatter: (value) => `$${value.toFixed(2)}`,
                        color: '#333',
                        font: { weight: 'bold', size: 11 }
                    }
                }
            },
            plugins: [ChartDataLabels]
        });
    }

    // 3. Gráfico de Presupuestos vs Gasto Real
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
                        backgroundColor: 'rgba(23, 162, 184, 0.7)',
                        borderColor: 'rgba(23, 162, 184, 1)',
                        borderWidth: 1
                    },
                    {
                        label: 'Gasto Real ($)',
                        data: datosGastadoArr,
                        backgroundColor: 'rgba(255, 193, 7, 0.7)',
                        borderColor: 'rgba(255, 193, 7, 1)',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    datalabels: {
                        anchor: 'end',
                        align: 'top',
                        formatter: (value) => value > 0 ? `$${value.toFixed(2)}` : '', // Oculta los ceros para no saturar
                        color: '#333',
                        font: { weight: 'bold', size: 10 }
                    }
                }
            },
            plugins: [ChartDataLabels]
        });
    }
}