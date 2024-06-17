import http.server
import socketserver
import webbrowser
import time
import os

PORT = 8000
DIRECTORY = "dist"

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print(f"Sirviendo al puerto {PORT}")
    print("Para ver la página, ingrese a: http://localhost:8000/")
    
    # Espera un momento para asegurarse de que el servidor esté listo antes de abrir el navegador
    time.sleep(1)
    webbrowser.open(f"http://localhost:{PORT}/")

    httpd.serve_forever()
