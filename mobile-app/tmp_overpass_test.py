import urllib.request, urllib.parse, traceback
query='[out:json][timeout:20];(node["amenity"~"doctors|doctor|hospital|clinic"](around:1000,30.0444,31.2357);way["amenity"~"doctors|doctor|hospital|clinic"](around:1000,30.0444,31.2357);relation["amenity"~"doctors|doctor|hospital|clinic"](around:1000,30.0444,31.2357););out center 30;'
url='https://overpass-api.de/api/interpreter'
headers={'Content-Type':'application/x-www-form-urlencoded','Accept':'application/json'}
data=urllib.parse.urlencode({'data':query}).encode('utf-8')
req=urllib.request.Request(url,data=data,headers=headers)
try:
    with urllib.request.urlopen(req, timeout=30) as r:
        print('status', r.status)
        print(r.read(200).decode('utf-8', errors='replace'))
except Exception:
    traceback.print_exc()
