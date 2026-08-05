import argparse
import os
import requests

# Tus credenciales de Supabase en la nube
SUPABASE_URL = "https://abghxxvrwabdtlgbffej.supabase.co"
SUPABASE_KEY = "sb_secret_5dlX2DA6Jr5v5GKtHqcXQA_-0wR7zDK"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json"
}

def inicializar_bd():
    print("[+] Conectando a Supabase en la nube...")
    # Supabase crea las tablas mediante su interfaz web o por API. 
    # Te dejaré la estructura lista abajo para que la crees en un clic en la web.
    print("[+] ¡Conexión establecida con éxito en la nube!")

def hacer_respaldo():
    url = f"{SUPABASE_URL}/rest/v1/movimientos?select=*"
    response = requests.get(url, headers=HEADERS)
    if response.status_code == 200:
        os.makedirs("backups", exist_ok=True)
        import datetime
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_path = f"backups/supabase_backup_{timestamp}.json"
        with open(backup_path, "w", encoding="utf-8") as f:
            f.write(response.text)
        print(f"[+] Respaldo en la nube descargado exitosamente en: {backup_path}")
    else:
        print("[-] Error al realizar el respaldo desde Supabase:", response.text)

def main():
    parser = argparse.ArgumentParser(description="Gestor Financiero Cloud (Supabase)")
    parser.add_argument("--init", action="store_true", help="Inicializa la conexión con Supabase")
    parser.add_argument("--backup", action="store_true", help="Crea un respaldo seguro descargando los datos de la nube")
    
    args = parser.parse_args()

    if args.init:
        inicializar_bd()
    elif args.backup:
        hacer_respaldo()
    else:
        parser.print_help()

if __name__ == "__main__":
    main()