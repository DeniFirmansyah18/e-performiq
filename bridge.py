#!/usr/bin/env python3
"""MuseBridge - jembatan file antara VS Code di PC kamu dan Muse di chat.

Alur kerja:
  1. Copy bridge.py ke folder project-mu (atau jalankan dari sana).
  2. Jalankan:  python bridge.py snapshot
     -> membuat .musebridge/outbox/snapshot-<waktu>.txt berisi struktur
        folder + isi file project-mu.
  3. Upload file snapshot itu ke chat Muse, jelaskan maumu
     ("tambahkan fitur X", "betulkan bug Y", ...).
  4. Muse membalas dengan blok edit berformat:
         === FILE: path/relatif ===
         <isi baru lengkap>
         === END ===
     Simpan balasan itu sebagai .musebridge/inbox.txt
     (atau copy-paste langsung ke file itu).
  5. Jalankan:  python bridge.py apply
     -> file-file ditulis ke project-mu (yang lama di-backup jadi .bak).

Hanya standard library Python.
"""

import argparse
import json
import os
import shutil
import sys
import time

STATE_DIR = ".musebridge"

SKIP_DIRS = {
    ".git", ".idea", ".vscode", "node_modules", "__pycache__", ".venv", "venv",
    "env", ".env", "dist", "build", "target", "vendor", ".next", ".nuxt",
    "coverage", ".pytest_cache", ".musebridge", ".hg", ".svn",
}
SKIP_EXT = {
    ".pyc", ".pyo", ".o", ".so", ".dll", ".exe", ".bin", ".zip", ".tar",
    ".gz", ".7z", ".rar", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico",
    ".bmp", ".mp3", ".mp4", ".avi", ".mov", ".pdf", ".ttf", ".otf",
    ".woff", ".woff2", ".sqlite", ".db", ".pdb", ".class", ".jar",
}
MAX_FILE_BYTES = 200 * 1024      # file > 200KB di-skip
MAX_TOTAL_BYTES = 1500 * 1024    # total snapshot dibatasi ~1.5MB


def state_path(root, *parts):
    return os.path.join(root, STATE_DIR, *parts)


def is_text_file(path):
    try:
        with open(path, "rb") as f:
            chunk = f.read(8192)
        return b"\x00" not in chunk
    except OSError:
        return False


def load_ignore(root):
    pats = []
    p = os.path.join(root, ".musebridgeignore")
    if os.path.isfile(p):
        with open(p, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#"):
                    pats.append(line)
    return pats


def collect(root):
    """Kembalikan (tree_lines, files[(rel, abspath, size)], skipped[(rel, alasan)])."""
    ignore = load_ignore(root)
    tree = []
    files = []
    skipped = []
    total = 0

    def is_ignored(rel):
        return any(pat in rel for pat in ignore)

    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = sorted(d for d in dirnames if d not in SKIP_DIRS)
        filenames = sorted(filenames)
        rel_dir = os.path.relpath(dirpath, root).replace(os.sep, "/")
        if rel_dir == ".":
            rel_dir = ""
        depth = 0 if not rel_dir else rel_dir.count("/") + 1

        for d in list(dirnames):
            rel = (rel_dir + "/" + d) if rel_dir else d
            if is_ignored(rel):
                dirnames.remove(d)
                continue
            tree.append(("  " * depth + d + "/", True))

        for fn in filenames:
            rel = (rel_dir + "/" + fn) if rel_dir else fn
            if is_ignored(rel):
                continue
            tree.append(("  " * depth + fn, False))
            ap = os.path.join(dirpath, fn)
            try:
                size = os.path.getsize(ap)
            except OSError:
                skipped.append((rel, "tidak bisa dibaca"))
                continue
            ext = os.path.splitext(fn)[1].lower()
            if ext in SKIP_EXT:
                skipped.append((rel, "tipe file biner/arsip"))
                continue
            if size > MAX_FILE_BYTES:
                skipped.append((rel, "terlalu besar (>200KB)"))
                continue
            if not is_text_file(ap):
                skipped.append((rel, "biner"))
                continue
            if total + size > MAX_TOTAL_BYTES:
                skipped.append((rel, "melebihi batas total snapshot"))
                continue
            total += size
            files.append((rel, ap, size))

    return tree, files, skipped, total


def cmd_snapshot(root):
    root = os.path.abspath(root)
    outbox = state_path(root, "outbox")
    os.makedirs(outbox, exist_ok=True)

    tree, files, skipped, total = collect(root)
    stamp = time.strftime("%Y%m%d-%H%M%S")
    snap_path = os.path.join(outbox, "snapshot-%s.txt" % stamp)

    with open(snap_path, "w", encoding="utf-8") as f:
        f.write("# MuseBridge snapshot %s\n" % time.strftime("%Y-%m-%d %H:%M:%S"))
        f.write("# root: %s\n\n" % os.path.basename(root))
        f.write("## TREE\n")
        for line, _is_dir in tree:
            f.write(line + "\n")
        f.write("\n## FILES (%d file, %d KB)\n\n" % (len(files), total // 1024))
        for rel, ap, _size in files:
            f.write("=== FILE: %s ===\n" % rel)
            try:
                with open(ap, "r", encoding="utf-8", errors="replace") as sf:
                    f.write(sf.read())
            except OSError as exc:
                f.write("[gagal dibaca: %s]" % exc)
            f.write("\n=== END ===\n\n")
        if skipped:
            f.write("## SKIPPED\n")
            for rel, reason in skipped:
                f.write("- %s (%s)\n" % (rel, reason))

    with open(state_path(root, "config.json"), "w", encoding="utf-8") as f:
        json.dump({"root": root, "last_snapshot": os.path.basename(snap_path)},
                  f, ensure_ascii=False, indent=2)

    print("Snapshot dibuat: %s" % snap_path)
    print("  %d file disertakan (%d KB), %d dilewati" % (len(files), total // 1024, len(skipped)))
    print()
    print("Langkah berikut: upload file snapshot itu ke chat Muse,")
    print("lalu jelaskan perubahan yang kamu mau.")


def parse_blocks(text):
    """Parse blok '=== FILE: path === ... === END ===' -> [(path, content)]."""
    blocks = []
    cur_path = None
    cur_lines = None
    for line in text.splitlines():
        s = line.strip()
        if s.startswith("=== FILE:") and s.endswith("==="):
            inner = s[len("=== FILE:"):].strip()
            if inner.endswith("==="):
                inner = inner[:-3].strip()
            cur_path = inner
            cur_lines = []
        elif s == "=== END ===" and cur_lines is not None:
            blocks.append((cur_path, "\n".join(cur_lines)))
            cur_path, cur_lines = None, None
        elif cur_lines is not None:
            cur_lines.append(line)
    return blocks


def safe_join(root, rel):
    rel = rel.replace("\\", "/").strip()
    norm = os.path.normpath(rel).replace("\\", "/")
    if not norm or norm == "." or os.path.isabs(rel) or norm.startswith(".."):
        return None
    if ".." in norm.split("/"):
        return None
    return os.path.join(root, *norm.split("/"))


def cmd_apply(root, inbox):
    root = os.path.abspath(root)
    inbox = os.path.abspath(inbox)
    if not os.path.isfile(inbox):
        print("Inbox tidak ditemukan: %s" % inbox)
        print("Simpan balasan Muse sebagai file itu dulu, lalu jalankan lagi.")
        return 1
    with open(inbox, "r", encoding="utf-8") as f:
        text = f.read()
    blocks = parse_blocks(text)
    if not blocks:
        print("Tidak ada blok '=== FILE: ... ===' yang terbaca di inbox.")
        print("Pastikan kamu menyimpan balasan Muse apa adanya.")
        return 1

    written, backed_up, rejected = [], [], []
    for rel, content in blocks:
        target = safe_join(root, rel)
        if target is None or not rel:
            rejected.append(rel or "(path kosong)")
            continue
        os.makedirs(os.path.dirname(target) or root, exist_ok=True)
        if os.path.isfile(target):
            shutil.copy2(target, target + ".bak")
            backed_up.append(rel)
        with open(target, "w", encoding="utf-8", newline="\n") as f:
            f.write(content)
            if content and not content.endswith("\n"):
                f.write("\n")
        written.append(rel)

    print("Apply selesai: %d file ditulis" % len(written))
    for rel in written:
        print("  + %s" % rel)
    if backed_up:
        print("Backup (.bak) dibuat untuk %d file lama." % len(backed_up))
    if rejected:
        print("DITOLAK (%d) - path tidak aman:" % len(rejected))
        for rel in rejected:
            print("  ! %s" % rel)
    print()
    print("Cek di VS Code (file berubah otomatis terdeteksi), lalu test programmu.")
    return 0


def cmd_status(root):
    root = os.path.abspath(root)
    outbox = state_path(root, "outbox")
    inbox = state_path(root, "inbox.txt")
    print("Project root : %s" % root)
    if os.path.isdir(outbox):
        snaps = sorted(f for f in os.listdir(outbox) if f.startswith("snapshot-"))
        print("Snapshot     : %d (%s)" % (len(snaps), snaps[-1] if snaps else "-"))
    else:
        print("Snapshot     : belum ada (jalankan: python bridge.py snapshot)")
    print("Inbox        : %s" % ("ada" if os.path.isfile(inbox) else "belum ada"))


def main(argv=None):
    ap = argparse.ArgumentParser(
        description="MuseBridge - jembatan file VS Code <-> Muse")
    sub = ap.add_subparsers(dest="cmd")

    p_snap = sub.add_parser("snapshot", help="buat snapshot project untuk dikirim ke Muse")
    p_snap.add_argument("folder", nargs="?", default=".",
                        help="folder project (default: folder saat ini)")

    p_apply = sub.add_parser("apply", help="terapkan balasan Muse dari inbox ke file")
    p_apply.add_argument("inbox", nargs="?", default=None,
                         help="file balasan Muse (default: .musebridge/inbox.txt)")
    p_apply.add_argument("--root", default=".",
                         help="folder project (default: folder saat ini)")

    p_status = sub.add_parser("status", help="lihat status bridge")
    p_status.add_argument("folder", nargs="?", default=".")

    args = ap.parse_args(argv)
    if args.cmd == "snapshot":
        cmd_snapshot(args.folder)
        return 0
    if args.cmd == "apply":
        inbox = args.inbox or state_path(os.path.abspath(args.root), "inbox.txt")
        return cmd_apply(args.root, inbox)
    if args.cmd == "status":
        cmd_status(args.folder)
        return 0
    ap.print_help()
    return 0


if __name__ == "__main__":
    sys.exit(main())
