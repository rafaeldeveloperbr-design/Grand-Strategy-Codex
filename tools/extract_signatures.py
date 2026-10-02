import os
import re
from pathlib import Path

# Pastas a ignorar
IGNORE_DIRS = {
    ".git", "node_modules", "dist", "build", ".venv", 
    "coverage", ".next", ".vscode"
}

# Extensões dos ficheiros do seu projeto (JS, TS, JSX, TSX)
FILE_EXTENSIONS = {".js", ".jsx", ".ts", ".tsx", ".py"}

# Padrões Regex para capturar declarações principais
PATTERNS = [
    # Export / declaração de Funções
    re.compile(r'^\s*(export\s+)?(async\s+)?function\s+([a-zA-Z0-9_]+)\s*\((.*?)\)', re.MULTILINE),
    # Export / declaração de Classes
    re.compile(r'^\s*(export\s+)?class\s+([a-zA-Z0-9_]+)', re.MULTILINE),
    # Arrow Functions ou Atribuições Globais/Constantes (const/let/var nome = ...)
    re.compile(r'^\s*(export\s+)?(const|let|var)\s+([a-zA-Z0-9_]+)\s*=', re.MULTILINE),
    # Interfaces e Types (TypeScript)
    re.compile(r'^\s*(export\s+)?(interface|type)\s+([a-zA-Z0-9_]+)', re.MULTILINE),
]

def extract_signatures(file_path):
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            lines = f.readlines()

        signatures = []
        for line in lines:
            # Ignora linhas de import/export simples ou comentários
            if line.strip().startswith("//") or line.strip().startswith("import"):
                continue
            
            for pattern in PATTERNS:
                match = pattern.search(line)
                if match:
                    signatures.append(line.strip())
                    break

        return signatures
    except Exception as e:
        return [f"// Erro ao ler o ficheiro: {e}"]

def main(root_dir=".", output_file="repo_signatures.txt"):
    total_files = 0
    with open(output_file, "w", encoding="utf-8") as out:
        for root, dirs, files in os.walk(root_dir):
            dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]

            for file in files:
                # Não analisa o próprio script nem a saída
                if file in ["extract_signatures.py", output_file]:
                    continue

                if Path(file).suffix in FILE_EXTENSIONS:
                    full_path = Path(root) / file
                    signatures = extract_signatures(full_path)

                    if signatures:
                        total_files += 1
                        out.write(f"\n{'='*60}\n")
                        out.write(f"FILE: {full_path}\n")
                        out.write(f"{'='*60}\n")
                        for sig in signatures:
                            out.write(sig + "\n")

    print(f"Concluído! Processados {total_files} ficheiros. Assinaturas guardadas em: {output_file}")

if __name__ == "__main__":
    main()