"""Pemeriksaan statis: tidak boleh ada nama global yang dipakai tetapi tidak didefinisikan/diimpor di server.py.

Kesalahan jenis ini lolos dari py_compile dan baru memunculkan error 500 saat fungsinya dipanggil.
"""
import ast
import builtins
import dis
import os
import unittest

SERVER = os.path.join(os.path.dirname(__file__), "..", "server.py")
ALLOWED = {"__file__", "__annotations__"}


def undefined_globals(path):
    src = open(path, encoding="utf-8").read()
    tree = ast.parse(src)
    defined = set(dir(builtins))
    for node in tree.body:
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            for a in node.names:
                defined.add((a.asname or a.name).split(".")[0])
        elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            defined.add(node.name)
        elif isinstance(node, (ast.Assign, ast.AnnAssign, ast.AugAssign)):
            targets = node.targets if isinstance(node, ast.Assign) else [node.target]
            for t in targets:
                for n in ast.walk(t):
                    if isinstance(n, ast.Name):
                        defined.add(n.id)
        elif isinstance(node, ast.Try):
            for sub in ast.walk(node):
                if isinstance(sub, (ast.Import, ast.ImportFrom)):
                    for a in sub.names:
                        defined.add((a.asname or a.name).split(".")[0])
    missing = {}

    def walk(co):
        for ins in dis.get_instructions(co):
            if ins.opname in ("LOAD_GLOBAL", "LOAD_NAME") and ins.argval not in defined:
                missing.setdefault(ins.argval, set()).add(co.co_name)
        for c in co.co_consts:
            if hasattr(c, "co_code"):
                walk(c)

    walk(compile(src, path, "exec"))
    return {k: sorted(v) for k, v in missing.items() if k not in ALLOWED}


class StaticTests(unittest.TestCase):
    def test_server_has_no_undefined_globals(self):
        self.assertEqual(undefined_globals(SERVER), {})


if __name__ == "__main__":
    unittest.main()
