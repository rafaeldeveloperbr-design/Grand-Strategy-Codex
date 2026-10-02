import os
import re
import argparse
from pathlib import Path

IGNORE_DIRS = {
    ".git", "node_modules", "dist", "build", ".next", ".vscode", 
    ".turbo", "coverage", "out", "venv", "__pycache__"
}

FILE_EXTENSIONS = {".js", ".jsx", ".ts", ".tsx"}

# Regex focadas em dar contexto de Arquitetura e Fluxo de Dados para IAs
PATTERNS = {
    "Export / Public API": re.compile(r'^\s*export\s+(default\s+)?(function|const|class|type|interface|enum)\s+([a-zA-Z0-9_]+)'),
    "Component/Func": re.compile(r'^\s*(export\s+)?(default\s+)?(async\s+)?function\s+([A-Z][a-zA-Z0-9_]*)'),
    "Const Component": re.compile(r'^\s*(export\s+)?const\s+([A-Z][a-zA-Z0-9_]+)\s*[:=].*(=>|React\.FC|FC)'),
    "State / React": re.compile(r'^\s*(const|let)\s*\[\s*([a-zA-Z0-9_]+)\s*,\s*set[a-zA-Z0-9_]+\s*\]\s*=\s*useState'),
    "Hook Customizado": re.compile(r'^\s*(export\s+)?(const|let)\s+(use[A-Z][a-zA-Z0-9_]+)\s*=\s*'),
    "Effect / Data Fetch": re.compile(r'^\s*(useEffect|useLayoutEffect|useQuery|useMutation|useSWR|useForm)\s*\('),
    "Function / Logic": re.compile(r'^\s*(export\s+)?(async\s+)?function\s+([a-z][a-zA-Z0-9_]*)'),
    "Arrow Func / Var": re.compile(r'^\s*(export\s+)?(const|let|var)\s+([a-zA-Z0-9_]+)\s*=\s*(async\s*)?\(.*?\)\s*=>'),
    "Interface / Type": re.compile(r'^\s*(export\s+)?(interface|type|enum)\s+([A-Z][a-zA-Z0-9_]*)'),
    # PATTERNS DO SEU JOGO - pra pegar os fixes novos
    "Unit Definitions": re.compile(r'^\s*(export\s+)?(const)\s+(UNIT_DEFINITIONS|BUILDING_DEFINITIONS|provincesData|countries)'),
    "Battle / Combat": re.compile(r'.*(calculateArmySize|finalizeBattle|battleContinuousTick|stackwipe|participantDetails|CombatResult|ActiveBattle|battleReport)'),
    "Game Actions": re.compile(r'.*(handlePause|setIsPaused|setBattleReport|setGameSpeed|handleSpeedChange|handleStopMovement|handleRetreat)'),
    "Army Panel": re.compile(r'.*(army-info-panel|regiments|UNIT_DEFINITIONS\[|getUnitIcon|getUnitLabel)'),
}

# Regex para capturar bibliotecas externas usadas no arquivo
IMPORT_PATTERN = re.compile(r'^\s*import\s+.*?from\s+[\'"]([^\'".\/][^\'"]*)[\'"]')

def analyze_file(path: Path):
    try:
        lines = path.read_text(encoding="utf-8", errors="ignore").splitlines()
    except Exception as e:
        return None

    total_lines = len(lines)
    blank_lines = sum(1 for l in lines if not l.strip())
    comment_lines = sum(
        1 for l in lines 
        if l.strip().startswith("//") or l.strip().startswith("/*") or l.strip().startswith("*")
    )
    code_lines = total_lines - blank_lines - comment_lines

    signatures = []
    external_imports = set()

    for i, line in enumerate(lines, 1):
        if len(line) > 400:
            continue
        
        stripped = line.strip()

        # Coleta dependências de bibliotecas (npm/yarn)
        imp_match = IMPORT_PATTERN.search(stripped)
        if imp_match:
            external_imports.add(imp_match.group(1))
            continue

        # Procura por estruturas importantes
        for kind, pat in PATTERNS.items():
            if pat.search(line):
                signatures.append(f"L{i:4} | [{kind:19}] {stripped[:110]}")
                break

    return {
        "path": path,
        "total": total_lines,
        "code": max(0, code_lines),
        "blank": blank_lines,
        "comments": comment_lines,
        "imports": sorted(list(external_imports)),
        "sigs": signatures
    }

def print_file_summary(data: dict):
    print("=" * 80)
    print(f"ARQUIVO: {data['path']}")
    print(f"Linhas Totais: {data['total']} | Código: {data['code']} | Comentários: {data['comments']} | Vazias: {data['blank']}")
    if data["imports"]:
        print(f"Deps Externas: {', '.join(data['imports'])}")
    print("=" * 80)
    
    if data["sigs"]:
        print("ESTRUTURA / CONTEXTO EXTRAÍDO:")
        for sig in data["sigs"]:
            print(f"  {sig}")
    else:
        print("Nenhuma assinatura relevante encontrada.")
    print("=" * 80)

def main():
    parser = argparse.ArgumentParser(description="Mapeador de código para Contexto de IA (React/TS/JS)")
    parser.add_argument("target", nargs="?", default=".", help="Diretório ou arquivo individual")
    parser.add_argument("-o", "--output", help="Nome do arquivo TXT de saída")
    args = parser.parse_args()

    target_path = Path(args.target).resolve()

    if not target_path.exists():
        print(f"Erro: O caminho '{target_path}' não existe.")
        return

    # MODO 1: Arquivo único
    if target_path.is_file():
        data = analyze_file(target_path)
        if not data:
            return

        if args.output:
            with open(args.output, "w", encoding="utf-8") as out:
                out.write(f"FILE: {data['path']}\n")
                out.write(f"Metrics: {data['total']} lines | {data['code']} code\n")
                out.write(f"Imports: {', '.join(data['imports'])}\n\n")
                for s in data["sigs"]:
                    out.write(s + "\n")
            print(f"Mapeamento salvo em: {args.output}")
        else:
            print_file_summary(data)
        return

    # MODO 2: Projeto inteiro (Diretório)
    output_file = args.output or "repo_ai_context.txt"
    results = []

    for curr_root, dirs, files in os.walk(target_path):
        dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]
        for file in files:
            file_path = Path(curr_root) / file
            if file_path.suffix not in FILE_EXTENSIONS or file_path.name == output_file:
                continue

            data = analyze_file(file_path)
            if data:
                results.append(data)

    results.sort(key=lambda x: x["total"], reverse=True)

    with open(output_file, "w", encoding="utf-8") as out:
        out.write("CONTEXTO DE ARQUITETURA PARA IA\n")
        out.write("=" * 80 + "\n\n")

        for r in results:
            try:
                rel_path = r["path"].relative_to(target_path)
            except ValueError:
                rel_path = r["path"]
                
            out.write(f"FILE: {rel_path} | Total Lines: {r['total']} | Code Lines: {r['code']}\n")
            if r["imports"]:
                out.write(f"Packages: {', '.join(r['imports'])}\n")
            out.write("-" * 80 + "\n")
            
            if r["sigs"]:
                for s in r["sigs"]:
                    out.write(s + "\n")
            else:
                out.write("(apenas lógica interna solta)\n")
            out.write("\n" + "=" * 80 + "\n\n")

    print(f"Contexto gerado com sucesso!")
    print(f"- Processados: {len(results)} arquivos")
    print(f"- Relatório salvo em: {output_file}")

if __name__ == "__main__":
    main()