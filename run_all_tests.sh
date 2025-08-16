#!/bin/bash

echo "===== Starting Filesystem Permission Diagnostic Tests ====="
echo "This will test all file I/O operations used by the agent."
echo "Running tests from directory: $(pwd)"
echo "---------------------------------------------------------"

# Define the path to the Python executable within your virtual environment
PYTHON_EXEC="./.venv/bin/python"

# --- Verification Step ---
if [ ! -f "$PYTHON_EXEC" ]; then
    echo "❌ FATAL ERROR: Python executable not found at '$PYTHON_EXEC'"
    echo "Please ensure the virtual environment exists and is located at '/srv/icon/.venv/'"
    exit 1
fi

# --- Environment Check for Test 5 ---
# The Gemini test requires the .env file to be loaded.
if [ -f ".agent/agent.env" ]; then
    echo "INFO: Loading environment variables from .agent/agent.env for Gemini test."
    set -a
    source .agent/agent.env
    set +a
else
    echo "WARNING: .agent/agent.env file not found. Test #5 might fail if GOOGLE_API_KEY is not set."
fi


# --- Test Execution ---
chmod +x file_io_tests/*.py

# Run each test script sequentially
$PYTHON_EXEC file_io_tests/test_01_lockfile.py
$PYTHON_EXEC file_io_tests/test_02_logfile.py
$PYTHON_EXEC file_io_tests/test_03_read_context.py
$PYTHON_EXEC file_io_tests/test_04_edit_file.py
$PYTHON_EXEC file_io_tests/test_05_gemini_write.py # This is the new, critical test

echo "---------------------------------------------------------"
echo "===== All Diagnostic Tests Finished ====="
echo "The result of 'Test 05' will tell us if the Gemini API library"
echo "itself is the source of the file writing issue."
