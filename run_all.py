#!/usr/bin/env python3
"""NetSage AI - Master Control Launcher"""

import shutil
import subprocess
import sys

# On Windows, npm is actually npm.cmd — subprocess.run(["npm", ...]) can fail
# with FileNotFoundError unless we resolve the real executable path first.
NPM = shutil.which("npm") or "npm"


def banner():
    print("=" * 74)
    print("                 NetSage AI - Master Control Launcher")
    print("=" * 74)
    print(" [1] Run Automated Benchmark Evaluation   (python evaluate.py)")
    print(" [2] Launch Interactive Terminal Workbench (python netsage_cli.py)")
    print(" [3] Launch Web Dashboard Dev Server        (cd app && npm run dev)")
    print(" [4] Run Rule Checker Only                  (python checker/rule_checker.py)")
    print(" [Q] Quit")
    print("-" * 74)


def main():
    while True:
        banner()
        choice = input("Select an option: ").strip().lower()
        if choice == "1":
            subprocess.run([sys.executable, "evaluate.py"])
        elif choice == "2":
            subprocess.run([sys.executable, "netsage_cli.py"])
        elif choice == "3":
            subprocess.run([NPM, "run", "dev"], cwd="app")
        elif choice == "4":
            subprocess.run([sys.executable, "checker/rule_checker.py"])
        elif choice == "q":
            break
        else:
            print("Invalid choice.\n")


if __name__ == "__main__":
    main()
