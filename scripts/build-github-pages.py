#!/usr/bin/env python3
"""Build a secret-free Pages tree, optionally connected to the Mdaar Worker."""
import argparse
import html
import json
from pathlib import Path
import re
import shutil
import tomllib

ROOT = Path(__file__).resolve().parent.parent


def build(output, base, service_origin=''):
    if not re.fullmatch(r'/[A-Za-z0-9_-]+/', base):
        raise ValueError('Expected a project prefix such as /Mdaar21/')
    if service_origin and not re.fullmatch(r'https://[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?(?::[0-9]{1,5})?', service_origin):
        raise ValueError('Service origin must be a plain HTTPS origin without a path or credentials')
    output = output.resolve()
    if output == ROOT or ROOT in output.parents:
        raise ValueError('Build outside the source repository')
    output.mkdir(parents=True, exist_ok=True)
    if any(output.iterdir()):
        raise ValueError('Output directory must be empty')
    shutil.copytree(ROOT / 'public', output, dirs_exist_ok=True)
    # Rebase literal local URLs, including CSS, JSON data, module fetches and SW.
    local = re.compile(r'''(["'`(])/(?!/)(?=(?:assets/|data/|index\.html|privacy\.html|sw\.js|manifest\.webmanifest))''')
    for path in output.rglob('*'):
        if path.suffix not in {'.html', '.css', '.js', '.mjs', '.json', '.webmanifest'}:
            continue
        text = local.sub(lambda m: m[1] + base, path.read_text())
        if path.name == 'privacy.html':
            text = text.replace('href="/"', f'href="{base}"')
        if path.name == 'sw.js':
            text = text.replace("['/',", f"['{base}',")
            text = text.replace('mdaar-public-v11', 'mdaar-pages-v3')
            text = text.replace("key.startsWith('mdaar-public-')", "(key.startsWith('mdaar-public-') || key.startsWith('mdaar-pages-'))")
        path.write_text(text)
    manifest_path = output / 'manifest.webmanifest'
    manifest = json.loads(manifest_path.read_text())
    for key in ('id', 'scope', 'start_url'):
        manifest[key] = base
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    config = tomllib.loads((ROOT / 'netlify.toml').read_text())
    policy = config['headers'][0]['values']['Content-Security-Policy']
    # frame-ancestors only works as an HTTP header, not a meta policy.
    policy = policy.replace("; frame-ancestors 'none'", '')
    if service_origin:
        policy = policy.replace("connect-src 'self'", "connect-src 'self' " + service_origin)
    metadata = ('<meta name="mdaar-hosting" content="static">\n'
                + (f'<meta name="mdaar-service-origin" content="{html.escape(service_origin, quote=True)}">\n' if service_origin else '') +
                f'<meta http-equiv="Content-Security-Policy" content="{html.escape(policy, quote=True)}">\n'
                '<meta name="referrer" content="strict-origin-when-cross-origin">\n')
    for name in ('index.html', 'privacy.html'):
        path = output / name
        text = path.read_text().replace('<head>', '<head>\n' + metadata, 1)
        if name == 'privacy.html' and service_origin:
            text = text.replace('يرسل طلبك عبر Netlify إلى Groq.', 'يرسل طلبك عبر خدمة مدار على Cloudflare إلى Groq.')
            text = text.replace('go through Netlify to Groq', 'go through Cloudflare to Groq')
            start = text.index('<h2>الدخول والحماية</h2>')
            end = text.index('<h2>دون اتصال</h2>', start)
            text = text[:start] + ('<h2>الدخول والحماية</h2><p>تبدأ جلسة قصيرة تلقائياً عند إرسال طلبك. يبقى رمزها في ذاكرة الصفحة لمدة تصل إلى 15 دقيقة، ولا يُحفظ في التخزين المحلي ولا يستخدم ملف ارتباط عبر المواقع. ترتبط الجلسة بأصل الموقع ومعرّف اتصال مشتق يومياً. تحفظ خدمة مدار عدادات استخدام مشتركة ومعرّفات مشتقة لحماية حصص الطلبات؛ لا ترسل نصوص أسئلتك أو سجلات طعامك إلى العدادات. لا يسجل التطبيق عمداً نصوص الطلبات أو مفاتيح الخدمة. تعالج Cloudflare بيانات الاتصال والتشغيل وفق سياساتها وإعدادات الحساب.</p>') + text[end:]
            text = re.sub(r'<p>Mdaar uses a secure HttpOnly.*?</p>', '<p>A signed session starts when you send a request. Its token stays in page memory for up to 15 minutes, without localStorage or cross-site cookies. Sessions are bound to the site origin and a daily derived connection identifier. Durable storage holds shared usage counters, not question or food contents. Cloudflare and Groq processing and retention depend on their policies and account settings. Closing the assistant cannot retract data already received by a provider.</p>', text)
        if name == 'index.html' and not service_origin:
            note = ('<p class="notice" role="status" data-ex-ar="ميزات مدار المتصلة غير متاحة حالياً على هذا الرابط. أدوات الغذاء والتدريب تعمل، وسجلات الرابط السابق تبقى في متصفحك على الرابط السابق." '
                    'data-ex-en="Connected Mdaar features are currently unavailable on this address. Food and training tools work. Records from the previous address remain in your browser on that address.">'
                    'ميزات مدار المتصلة غير متاحة حالياً على هذا الرابط. أدوات الغذاء والتدريب تعمل، وسجلات الرابط السابق تبقى في متصفحك على الرابط السابق.</p>')
            text = text.replace('<main id="main-content" tabindex="-1">', '<main id="main-content" tabindex="-1">' + note, 1)
        path.write_text(text)
    (output / '.nojekyll').touch()
    print(f'Prepared {sum(p.is_file() for p in output.rglob("*"))} public files for {base}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--base', default='/Mdaar21/')
    parser.add_argument('--service-origin', default='', help='Public HTTPS Worker origin; never a secret or API key')
    args = parser.parse_args()
    build(args.output, args.base, args.service_origin)
