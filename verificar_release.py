# © 2026 bladept696 — Centro de Comando / Hash Commander. Todos os direitos reservados.
# é proibido copiar, modificar, redistribuir ou publicar este ficheiro, no todo ou em parte, sem autorização escrita do autor.
# https://github.com/bladept696/centro-de-comando-v3
"""Verificação antes de qualquer release ou envio para o GitHub: garante que não vai nenhum dado pessoal.

Lê os teus valores sensíveis dos ficheiros locais (chaves e segredos da MiningRigRentals, webhooks, tokens,
passwords, chave privada de assinatura e dos certificados de bloco) SEM os mostrar, e procura-os:
  1. nos ficheiros que o git envia (os que já estão no repositório e os que vão no próximo commit);
  2. em todo o histórico do git (todos os ramos e etiquetas);
  3. na lista de ficheiros que entram no instalador (.iss) e no .exe (build_exe.bat / .spec).
Também recusa ficheiros de dados da app no repositório (config.json, power_profiles.json, cópias .bak…)
e padrões que são sempre segredos (webhooks do Discord, tokens de bots do Telegram, chaves privadas PEM).

Uso:   python verificar_release.py            -> 0 = pode publicar, 1 = bloqueado (diz porquê)
       python verificar_release.py --hook     -> instala um "pre-push" no git que corre isto antes de cada envio
"""
import glob
import json
import os
import re
import subprocess
import sys

RAIZ = os.path.dirname(os.path.abspath(__file__))
os.chdir(RAIZ)

# ficheiros de dados da app: nunca podem ir para o repositório nem para o instalador
PROIBIDOS = re.compile(r'(^|/)(config\.json|power_profiles\.json|block_cert_key\.json|screen_key\.json|nostr_key\.json|market\.json|nwc\.json|market_sessions\.json|auth_grace\.json|account_activity\.json|'
                       r'user_presence\.json|diff_(buckets|history|records)\.json|\.install_id|[^/]*\.bak|update-signing-key\.pem)$|(^|/)updates/', re.I)
# nomes de campos JSON que guardam segredos
CAMPOS = re.compile(r'(key|secret|token|password|passwd|pass|webhook|private|priv|seed|mnemonic|xpub)', re.I)
# padrões que são sempre segredos, estejam onde estiverem
PADROES = [
    ('webhook do Discord', re.compile(r'https://(?:canary\.|ptb\.)?discord(?:app)?\.com/api/webhooks/\d+/[\w-]{20,}')),
    ('token de bot do Telegram', re.compile(r'\b\d{8,10}:[A-Za-z0-9_-]{35}\b')),
    # só conta com o conteúdo da chave a seguir ao cabeçalho: o firmware do ESP32 traz os cabeçalhos soltos (texto do mbedTLS)
    ('chave privada PEM', re.compile(r'-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----(?:\r?\n[\w-]+:[^\n]*)*\s+[A-Za-z0-9+/=]{40}')),
]
FONTES = ['config.json', 'power_profiles.json', 'block_cert_key.json', 'screen_key.json', 'nostr_key.json', 'nwc.json', 'market.json', 'auth_grace.json'] + glob.glob('*.bak') + glob.glob('*.json.bak')
CHAVE_ASSINATURA = os.environ.get('HC_SIGN_KEY') or os.path.join(os.path.expanduser('~'), '.centro-de-comando', 'update-signing-key.pem')


def mascara(v):
    return (v[:4] + '…' + v[-2:]) if len(v) > 8 else '…'


def git(*args):
    r = subprocess.run(['git', *args], capture_output=True, cwd=RAIZ)
    return r.stdout.decode('utf-8', 'replace')


def recolher_segredos():
    """Valores sensíveis dos ficheiros locais, como (origem, campo, valor)."""
    achados = []

    def andar(obj, origem, caminho=''):
        if isinstance(obj, dict):
            for k, v in obj.items():
                c = caminho + '.' + str(k) if caminho else str(k)
                if isinstance(v, str) and CAMPOS.search(str(k)) and len(v.strip()) >= 8:
                    achados.append((origem, c, v.strip()))
                else:
                    andar(v, origem, c)
        elif isinstance(obj, list):
            for i, v in enumerate(obj):
                andar(v, origem, caminho + '[' + str(i) + ']')

    for f in FONTES:
        if not os.path.isfile(f):
            continue
        try:
            andar(json.load(open(f, encoding='utf-8')), f)
        except Exception:
            # não é JSON válido (ex.: cópia .bak partida): apanha "campo": "valor" à mão
            texto = open(f, encoding='utf-8', errors='ignore').read()
            for m in re.finditer(r'"([^"]+)"\s*:\s*"([^"]{8,})"', texto):
                if CAMPOS.search(m.group(1)):
                    achados.append((f, m.group(1), m.group(2)))
    # chave privada de assinatura das atualizações (fora do projeto): o miolo base64 conta como segredo
    if os.path.isfile(CHAVE_ASSINATURA):
        miolo = ''.join(l for l in open(CHAVE_ASSINATURA, encoding='utf-8', errors='ignore').read().splitlines() if l and not l.startswith('-----'))
        if len(miolo) >= 16:
            achados.append(('chave de assinatura', 'pem', miolo))
    # sem repetidos e sem valores que são só texto genérico (ex.: "https://" vazio)
    vistos, unicos = set(), []
    for o, c, v in achados:
        if v not in vistos and not re.fullmatch(r'https?://\S{0,12}', v):
            vistos.add(v)
            unicos.append((o, c, v))
    return unicos


def ficheiros_a_enviar():
    """Ficheiros que estão no repositório + os que vão no próximo commit (exclui os ignorados)."""
    seguidos = set(git('ls-files').split('\n'))
    preparados = set(git('diff', '--cached', '--name-only').split('\n'))
    novos = set(git('ls-files', '--others', '--exclude-standard').split('\n'))
    return sorted(f for f in (seguidos | preparados) if f), sorted(f for f in novos if f)


def main():
    problemas = []
    segredos = recolher_segredos()
    print(f'🔎 A verificar {len(segredos)} valores sensíveis lidos de {", ".join(sorted({o for o, _, _ in segredos})) or "nenhum ficheiro"} (sem os mostrar)…')

    # 1. ficheiros de dados no repositório
    enviar, novos = ficheiros_a_enviar()
    for f in enviar:
        if PROIBIDOS.search(f.replace('\\', '/')):
            problemas.append(f'ficheiro de dados no repositório: {f}  (tira-o com: git rm --cached "{f}")')

    # 2. conteúdo dos ficheiros que vão para o GitHub
    for f in enviar:
        if not os.path.isfile(f):
            continue
        try:
            b = open(f, 'rb').read()
        except Exception:
            continue
        if len(b) > 30_000_000:
            continue
        t = b.decode('utf-8', 'ignore')
        for o, c, v in segredos:
            if v in t:
                problemas.append(f'{f} contém o valor de {o} › {c} ({mascara(v)})')
        if f.lower().endswith(('.pem', '.crt')) and 'PRIVATE KEY' not in t:
            continue   # certificados públicos (ex.: cacert.pem) não são segredo
        for nome, rx in PADROES:
            m = rx.search(t)
            if m:
                problemas.append(f'{f} contém um {nome} ({mascara(m.group(0))})')
    if novos:
        print(f'ℹ️  {len(novos)} ficheiro(s) novos fora do git (não vão no envio a não ser que faças git add): ' + ', '.join(novos[:8]) + (' …' if len(novos) > 8 else ''))

    # 3. todo o histórico do git
    for o, c, v in segredos:
        hits = git('log', '--all', '--format=%h', '-S', v).split()
        if hits:
            problemas.append(f'o histórico do git tem o valor de {o} › {c} ({mascara(v)}) em {len(hits)} envio(s): {", ".join(hits[:6])}'
                             '  (é preciso reescrever o histórico e trocar a chave)')

    # 4. o que entra no instalador e no .exe
    for f in ['CentroDeComando.iss', 'build_exe.bat', 'CentroDeComando.spec']:
        if not os.path.isfile(f):
            continue
        texto = open(f, encoding='utf-8', errors='ignore').read()
        fontes = re.findall(r'Source:\s*"([^"]+)"', texto) + re.findall(r'--add-data\s+"?([^";]+)', texto) + re.findall(r"\(\s*'([^']+)'\s*,\s*'[^']*'\s*\)", texto)
        for s in fontes:
            alvo = s.replace('\\', '/').rstrip('*').rstrip('/')
            if PROIBIDOS.search(alvo) or PROIBIDOS.search(alvo + '/'):
                problemas.append(f'{f} mete no instalador/.exe um ficheiro de dados: {s}')
            elif os.path.isdir(alvo):
                for raiz, _, nomes in os.walk(alvo):
                    for n in nomes:
                        p = os.path.join(raiz, n).replace('\\', '/')
                        if PROIBIDOS.search(p):
                            problemas.append(f'{f} mete no instalador/.exe a pasta {s}, que contém o ficheiro de dados {p}')

    print()
    if problemas:
        print('⛔ BLOQUEADO — não publiques nem envies enquanto isto não estiver resolvido:')
        for p in problemas:
            print('  • ' + p)
        return 1
    print('✅ Pode publicar: nenhum dado teu vai no repositório, no histórico nem no instalador.')
    return 0


def instalar_hook():
    destino = os.path.join(RAIZ, '.git', 'hooks', 'pre-push')
    open(destino, 'w', encoding='utf-8', newline='\n').write('#!/bin/sh\n# corre a verificação de dados pessoais antes de cada envio para o GitHub\n'
                                         'python "$(git rev-parse --show-toplevel)/verificar_release.py" || {\n'
                                         '  echo "Envio cancelado pela verificação de dados pessoais."; exit 1; }\n')
    try:
        os.chmod(destino, 0o755)
    except Exception:
        pass
    print('Instalado:', destino, '— a verificação corre sozinha antes de cada git push.')


if __name__ == '__main__':
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    if '--hook' in sys.argv:
        instalar_hook()
        sys.exit(0)
    sys.exit(main())
