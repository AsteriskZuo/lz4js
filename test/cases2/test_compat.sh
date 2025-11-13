#!/bin/bash

# Full compatibility test script

echo "=== LZ4 Streaming Cross-Compatibility Test ==="
echo ""

# Check if C test program needs to be compiled
if [ ! -f test_c_compat ]; then
    echo "Compiling C test program..."
    gcc test_c_compat.c -I../../../lz4/lib -L../../../lz4/lib -llz4 -o test_c_compat
    if [ $? -ne 0 ]; then
        echo "ERROR: Failed to compile C test program"
        echo "Make sure lz4 library is installed and path is correct"
        exit 1
    fi
    echo "C test program compiled successfully"
    echo ""
fi

export DYLD_LIBRARY_PATH=../../../lz4/lib:$DYLD_LIBRARY_PATH

# Test 1: JS compress, JS decompress (baseline)
echo "Test 1: JS -> JS"
node test_js_compat.js compress test_js.lz4
node test_js_compat.js decompress test_js.lz4
echo ""

# Test 2: C compress, C decompress (baseline)
echo "Test 2: C -> C"
./test_c_compat compress test_c.lz4
./test_c_compat decompress test_c.lz4
echo ""

# Test 3: JS compress, C decompress (cross-compatibility)
echo "Test 3: JS compress -> C decompress (Critical Test)"
node test_js_compat.js compress test_js_to_c.lz4
./test_c_compat decompress test_js_to_c.lz4
echo ""

# Test 4: C compress, JS decompress (cross-compatibility)
echo "Test 4: C compress -> JS decompress (Critical Test)"
./test_c_compat compress test_c_to_js.lz4
node test_js_compat.js decompress test_c_to_js.lz4
echo ""

echo "=== All compatibility tests completed ==="
echo "If all tests passed, JS and C implementations are compatible!"

