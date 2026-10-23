#!/usr/bin/env python3
"""Explicit direct deployment when the Netlify GitHub integration is unavailable.

Uses Netlify's official, integrity-pinned v2 function bootstrap, unchanged app
functions, digest uploads and headers from netlify.toml. No provider credentials
are copied into the deployment. Run only for an explicitly authorized site.
"""
import argparse
import base64
import concurrent.futures
import hashlib
import io
import json
import os
from pathlib import Path
import tarfile
import tomllib
import urllib.error
import urllib.parse
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parent.parent
API = 'https://api.netlify.com/api/v1/'
RUNTIME_VERSION = '2.25.0'
RUNTIME_INTEGRITY = 'sha512-O4F+jl8pip/RrmX1xgTJXna3CT3VnE+I/PVHgzIyDka1QZowL/sI5CItuZbla3Xcuwt3sybjm7rUJ396cbnWpw=='


def request(path, data=None, method=None, content_type='application/json'):
    headers = {'Authorization': 'Bearer ' + os.environ['NETLIFY_AUTH_TOKEN'],
               'Content-Type': content_type}
    if isinstance(data, dict):
        data = json.dumps(data).encode()
    req = urllib.request.Request(API + path, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=30) as response:
        body = response.read()
        return json.loads(body) if body else None


def bootstrap():
    url = ('https://registry.npmjs.org/@netlify/serverless-functions-api/-/'
           f'serverless-functions-api-{RUNTIME_VERSION}.tgz')
    with urllib.request.urlopen(url, timeout=20) as response:
        archive = response.read()
    actual = 'sha512-' + base64.b64encode(hashlib.sha512(archive).digest()).decode()
    if actual != RUNTIME_INTEGRITY:
        raise RuntimeError('Netlify bootstrap integrity mismatch')
    with tarfile.open(fileobj=io.BytesIO(archive), mode='r:gz') as tar:
        return tar.extractfile('package/dist/index.js').read()


def function_zip(name, runtime):
    output = io.BytesIO()
    with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
        archive.writestr('___netlify-bootstrap.mjs', runtime)
        archive.writestr('___netlify-entry-point.mjs',
                         "import * as bootstrap from './___netlify-bootstrap.mjs';\n"
                         f"export const handler = bootstrap.getLambdaHandler('./src/{name}.mjs');\n")
        archive.writestr('___netlify-metadata.json', json.dumps({
            'bootstrap_version': RUNTIME_VERSION,
            'branch': 'codex/mdaar-global-upgrade', 'version': 1}))
        archive.write(ROOT / f'netlify/functions/{name}.mjs', f'src/{name}.mjs')
        for file in sorted((ROOT / 'netlify/functions/lib').glob('*.mjs')):
            archive.write(file, 'src/lib/' + file.name)
    return output.getvalue()


def prepare():
    files = {'/' + file.relative_to(ROOT / 'public').as_posix(): file.read_bytes()
             for file in (ROOT / 'public').rglob('*') if file.is_file()}
    config = tomllib.loads((ROOT / 'netlify.toml').read_text())
    files['/_headers'] = ('\n'.join(section['for'] + '\n' + '\n'.join(
        '  ' + key + ': ' + value for key, value in section['values'].items())
        for section in config['headers']) + '\n').encode()
    runtime = bootstrap()
    functions = {name: function_zip(name, runtime) for name in ('ai', 'session')}
    return files, functions


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--site-id', required=True)
    parser.add_argument('--prepare-only', action='store_true')
    args = parser.parse_args()
    files, functions = prepare()
    if args.prepare_only:
        print(json.dumps({'files': len(files), 'functions': list(functions),
                          'bootstrap_integrity_verified': True}))
        return
    # Require an existing, explicit target. This script never creates a site.
    site = request('sites/' + urllib.parse.quote(args.site_id, safe=''))
    manifest = {
        'files': {path: hashlib.sha1(body).hexdigest() for path, body in files.items()},
        'functions': {name: hashlib.sha256(body).hexdigest() for name, body in functions.items()},
        'functions_config': {name: {'display_name': name,
            'routes': [{'pattern': '/api/' + name, 'literal': '/api/' + name,
                        'methods': []}],
            'build_data': {'runtimeAPIVersion': 2, 'bootstrapVersion': RUNTIME_VERSION}}
            for name in functions},
        'async': True,
    }
    deploy = request('sites/' + site['id'] + '/deploys', manifest)
    print(json.dumps({'deploy_id': deploy['id'], 'site': site['name'],
                      'state': deploy['state']}), flush=True)

    def upload(item):
        path, body = item
        request('deploys/' + deploy['id'] + '/files' + urllib.parse.quote(path),
                body, 'PUT', 'application/octet-stream')

    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(upload, files.items()))
    for name, body in functions.items():
        query = urllib.parse.urlencode({'runtime': 'js', 'invocation_mode': 'stream',
                                        'timeout': 30, 'size': len(body)})
        request('deploys/' + deploy['id'] + '/functions/' + name + '?' + query,
                body, 'PUT', 'application/octet-stream')
    status = request('deploys/' + deploy['id'])
    print(json.dumps({key: status.get(key) for key in
                      ('id', 'state', 'ssl_url', 'error_message')}))


if __name__ == '__main__':
    try:
        main()
    except urllib.error.HTTPError as error:
        # Never dump request headers, secret values or remote response bodies.
        raise SystemExit(f'Netlify deployment HTTP {error.code}') from None
