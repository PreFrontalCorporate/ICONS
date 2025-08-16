#!/bin/bash
echo "--- Preparing and running diagnostic suite ---"

# Use the virtual environment's Python
PYTHON_EXEC="./.venv/bin/python"

# Ensure required libraries are installed in the venv
echo "Installing required packages for diagnostics..."
$PYTHON_EXEC -m pip install -q python-dotenv google-generativeai

# Run the diagnostic script
$PYTHON_EXEC diagnostics.py

echo "--- Diagnostics complete ---"
