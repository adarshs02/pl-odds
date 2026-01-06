#!/usr/bin/env python3
"""
Master Pipeline Runner:
1. Fetches latest completed scores.
2. Fetches current upcoming spreads (for future accumulation).
3. Runs analysis and updates the graph.
"""
import subprocess
import sys

def run_script(script_name):
    print(f"--- Running {script_name} ---")
    res = subprocess.run(["python3", f"scripts/{script_name}"], capture_output=False)
    if res.returncode != 0:
        print(f"❌ {script_name} failed.")
        return False
    return True

def main():
    steps = [
        "fetch_scores.py",
        "fetch_spreads.py",
        "analyze_and_plot.py"
    ]
    
    for step in steps:
        if not run_script(step):
            sys.exit(1)
            
    print("\n✅ Pipeline completed successfully.")

if __name__ == "__main__":
    main()
