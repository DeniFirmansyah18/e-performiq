import os
import zipfile

targets = [
    'src',
    'public',
    'package.json',
    'package-lock.json',
    'next.config.js',
    'tsconfig.json',
    'tailwind.config.js',
    'postcss.config.js',
    'next-env.d.ts',
    'neon.ts',
    '.env'
]

print("Packaging deploy.zip with explicit Unix permissions (0755 for dirs, 0644 for files)...")

with zipfile.ZipFile('deploy.zip', 'w', zipfile.ZIP_DEFLATED) as zf:
    for target in targets:
        if not os.path.exists(target):
            continue
        if os.path.isfile(target):
            zinfo = zipfile.ZipInfo(target)
            zinfo.create_system = 3  # Unix
            zinfo.external_attr = (0o644 | 0o100000) << 16
            with open(target, 'rb') as f:
                zf.writestr(zinfo, f.read(), compress_type=zipfile.ZIP_DEFLATED)
        else:
            for root, dirs, files in os.walk(target):
                rel_root = os.path.relpath(root, '.').replace('\\', '/')
                if rel_root != '.':
                    d_info = zipfile.ZipInfo(rel_root + '/')
                    d_info.create_system = 3  # Unix
                    d_info.external_attr = (0o755 | 0o040000) << 16
                    zf.writestr(d_info, '')
                for f in files:
                    filepath = os.path.join(root, f)
                    rel_path = os.path.relpath(filepath, '.').replace('\\', '/')
                    f_info = zipfile.ZipInfo(rel_path)
                    f_info.create_system = 3  # Unix
                    f_info.external_attr = (0o644 | 0o100000) << 16
                    with open(filepath, 'rb') as fp:
                        zf.writestr(f_info, fp.read(), compress_type=zipfile.ZIP_DEFLATED)

print("Selesai! deploy.zip siap diunggah ke Hostinger.")
