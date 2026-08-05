import sqlite3

# Esto crea la base de datos y una tabla de prueba de inmediato
conexion = sqlite3.connect('finanzas.db')
cursor = conexion.cursor()

cursor.execute('''
    CREATE TABLE IF NOT EXISTS movimientos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tipo TEXT,
        monto REAL
    )
''')

conexion.commit()
conexion.close()

print("¡LISTO! La base de datos finanzas.db fue creada con éxito.")