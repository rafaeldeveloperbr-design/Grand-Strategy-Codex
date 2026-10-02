import os
import re
from pathlib import Path
import argparse
from collections import defaultdict

IGNORE_DIRS = {
    ".git", "node_modules", "dist", "build", ".next", ".vscode", 
    ".turbo", "coverage", "out"
}

FILE_EXTENSIONS = {".js", ".jsx", ".ts", ".tsx"}

# Padrões que importam pra React/TS
PATTERNS = {
    "Componente/Func": re.compile(r'^\s*(export\s+)?(default\s+)?(async\s+)?function\s+([A-Z][a-zA-Z0-9_]*)'),
    "Const Component": re.compile(r'^\s*(export\s+)?const\s+([A-Z][a-zA-Z0-9_]+)\s*[:=].*(=>|React\.FC|FC)'),
    "Hook/Func": re.compile(r'^\s*(export\s+)?(const|let)\s+(use[A-Z][a-zA-Z0-9_]+|[a-z][a-zA-Z0-9_]+)\s*=\s*(async\s*)?\(.*\)\s*=>'),
    "Class": re.compile(r'^\s*(export\s+)?(abstract\s+)?class\s+([A-Z][a-zA-Z0-9_]*)'),
    "Interface/Type/Enum": re.compile(r'^\s*(export\s+)?(interface|type|enum)\s+([A-Z][a-zA-Z0-9_]*)'),
      "Func": re.compile(r'^\s*(export\s+)?(async\s+)?function\s+([a-zA-Z0-9_]+)'),
    "Const": re.compile(r'^\s*(export\s+)?const\s+([a-zA-Z0-9_]+)\s*='),
}

def analyze(path: Path):
    lines = path.read_text(encoding="utf-8", errors="ignore").splitlines()
    sigs = []
    for i, l in enumerate(lines, 1):
        if l.strip().startswith("import"): continue
        for k, pat in PATTERNS.items():
            if pat.search(l):
                sigs.append(f"L{i:4} | {l.strip()[:120]}")
    return len(lines), sigs

def analyze_file(path: Path):
    try:
        text = path.read_text(encoding="utf-8", errors="ignore")
        lines = text.splitlines()
    except Exception as e:
        return None

    total_lines = len(lines)
    blank_lines = sum(1 for l in lines if not l.strip())
    # linha comentada simples
    comment_lines = sum(1 for l in lines if l.strip().startswith("//") or l.strip().startswith("/*") or l.strip().startswith("*"))
    code_lines = total_lines - blank_lines

    signatures = []
    for i, line in enumerate(lines, 1):
        if len(line) > 400: continue # ignora linha minificada
        stripped = line.strip()
        if stripped.startswith("import ") or stripped.startswith("from "):
            continue
        
        for kind, pat in PATTERNS.items():
            m = pat.search(line)
            if m:
                signatures.append(f"L{i:4} | [{kind:17}] {stripped}")
                break
    
    return {
        "path": path,
        "total": total_lines,
        "code": code_lines,
        "blank": blank_lines,
        "sigs": signatures
    }

def main(root_dir=".", output_file="repo_map.txt", limit_warn=300):
    root = Path(root_dir)
    results = []

    for curr_root, dirs, files in os.walk(root):
        dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]
        for file in files:
            if Path(file).suffix not in FILE_EXTENSIONS:
                continue
            if file == output_file:
                continue
            
            full_path = Path(curr_root) / file
            data = analyze_file(full_path)
            if data:
                results.append(data)

    # Ordena do maior pro menor - é aqui que você vê o problema
    results.sort(key=lambda x: x["total"], reverse=True)

    with open(output_file, "w", encoding="utf-8") as out:
        out.write("RESUMO - ARQUIVOS MAIORES QUE 200 LINHAS (meta: max 300)\n")
        out.write("="*80 + "\n")
        out.write(f"{'LINHAS':<8} {'CÓDIGO':<8} {'ARQUIVO'}\n")
        out.write("-"*80 + "\n")
        for r in results:
            flag = "  <-- QUEBRAR!" if r["total"] > limit_warn else ""
            rel = r["path"].relative_to(root)
            out.write(f"{r['total']:<8} {r['code']:<8} {rel}{flag}\n")

        out.write("\n\nDETALHE POR ARQUIVO\n")
        out.write("="*80 + "\n")
        for r in results:
            rel = r["path"].relative_to(root)
            out.write(f"\n{'='*80}\n")
            out.write(f"FILE: {rel} | Total: {r['total']} | Código: {r['code']} | Vazias: {r['blank']}\n")
            out.write(f"{'='*80}\n")
            if r["sigs"]:
                for s in r["sigs"]:
                    out.write(s + "\n")
            else:
                out.write("(nenhuma assinatura encontrada - pode ser só lógica solta)\n")

    print(f"Feito! {len(results)} arquivos analisados.")
    print(f"Arquivos > {limit_warn} linhas: {sum(1 for r in results if r['total'] > limit_warn)}")
    print(f"Relatório: {output_file}")
    print(f"\nTOP 5 maiores:")
    for r in results[:5]:
        print(f" - {r['path'].relative_to(root)}: {r['total']} linhas")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Scanner React TS pra refatoração")
    parser.add_argument("root", nargs="?", default=".", help="Pasta do projeto")
    parser.add_argument("-o", "--output", default="repo_map.txt")
    args = parser.parse_args()
    main(args.root, args.output)