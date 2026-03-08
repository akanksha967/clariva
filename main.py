from http.server import SimpleHTTPRequestHandler
import os

def handler(request, response):
    with open(os.path.join(os.path.dirname(__file__), 'index.html'), 'r') as f:
        html = f.read()
    response.status_code = 200
    response.headers['Content-Type'] = 'text/html'
    response.body = html
    return response
