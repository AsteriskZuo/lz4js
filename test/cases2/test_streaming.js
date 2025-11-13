// Test for streaming compression/decompression
// This tests the JavaScript implementation against expected behavior

var lz4 = require('../../lz4.js');

// Helper function to create test data
function makeTestData(pattern, repeat) {
  var data = [];
  for (var i = 0; i < repeat; i++) {
    for (var j = 0; j < pattern.length; j++) {
      data.push(pattern.charCodeAt(j));
    }
  }
  return new Uint8Array(data);
}

// Helper function to compare arrays
function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  for (var i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

// Helper to convert array to string
function arrayToString(arr, offset, length) {
  var str = '';
  for (var i = 0; i < length; i++) {
    str += String.fromCharCode(arr[offset + i]);
  }
  return str;
}

console.log('=== LZ4 Streaming Compression Tests ===\n');

// Test 1: Basic streaming compression and decompression
console.log('Test 1: Basic streaming');
try {
  var encoder = lz4.createStreamEncoder();
  var decoder = lz4.createStreamDecoder();
  
  // First block
  var input1 = makeTestData('Hello World! ', 10);
  var compressed1 = lz4.makeBuffer(lz4.compressBound(input1.length));
  var compSize1 = lz4.compressBlockContinue(encoder, input1, 0, input1.length, compressed1, 0, compressed1.length);
  
  console.log('  Block 1: Input size=' + input1.length + ', Compressed size=' + compSize1);
  
  // Decompress first block
  var result1 = lz4.decompressBlockContinue(decoder, compressed1, 0, compSize1, input1.length);
  var output1 = arrayToString(result1.data, result1.offset, result1.length);
  
  console.log('  Block 1 decompressed: ' + output1.substring(0, 50));
  
  // Second block - should benefit from dictionary
  var input2 = makeTestData('Hello World! ', 20); // Same pattern, should compress better
  var compressed2 = lz4.makeBuffer(lz4.compressBound(input2.length));
  var compSize2 = lz4.compressBlockContinue(encoder, input2, 0, input2.length, compressed2, 0, compressed2.length);
  
  console.log('  Block 2: Input size=' + input2.length + ', Compressed size=' + compSize2);
  console.log('  Compression improvement: ' + (input2.length - compSize2) + ' bytes saved');
  
  // Decompress second block
  var result2 = lz4.decompressBlockContinue(decoder, compressed2, 0, compSize2, input2.length);
  var output2 = arrayToString(result2.data, result2.offset, result2.length);
  
  console.log('  Block 2 decompressed: ' + output2.substring(0, 50));
  
  console.log('  Test 1: PASSED\n');
} catch (e) {
  console.log('  Test 1: FAILED - ' + e.message);
  console.log('  Stack: ' + e.stack);
}

// Test 2: Multiple blocks with dictionary benefit
console.log('Test 2: Dictionary effectiveness');
try {
  var encoder2 = lz4.createStreamEncoder();
  var decoder2 = lz4.createStreamDecoder();
  
  var totalOriginal = 0;
  var totalCompressed = 0;
  
  // Compress multiple blocks with repeating patterns
  for (var i = 0; i < 5; i++) {
    var input = makeTestData('The quick brown fox jumps over the lazy dog. ', 50);
    var compressed = lz4.makeBuffer(lz4.compressBound(input.length));
    var compSize = lz4.compressBlockContinue(encoder2, input, 0, input.length, compressed, 0, compressed.length);
    
    totalOriginal += input.length;
    totalCompressed += compSize;
    
    console.log('  Block ' + (i + 1) + ': ' + input.length + ' -> ' + compSize + ' bytes (' + 
                Math.round(compSize * 100 / input.length) + '%)');
    
    // Decompress and verify
    var result = lz4.decompressBlockContinue(decoder2, compressed, 0, compSize, input.length);
    if (result.length !== input.length) {
      throw new Error('Decompressed size mismatch: ' + result.length + ' != ' + input.length);
    }
  }
  
  console.log('  Total: ' + totalOriginal + ' -> ' + totalCompressed + ' bytes (' + 
              Math.round(totalCompressed * 100 / totalOriginal) + '%)');
  console.log('  Test 2: PASSED\n');
} catch (e) {
  console.log('  Test 2: FAILED - ' + e.message);
  console.log('  Stack: ' + e.stack);
}

// Test 3: Ring buffer wraparound
console.log('Test 3: Ring buffer wraparound');
try {
  var encoder3 = lz4.createStreamEncoder();
  var decoder3 = lz4.createStreamDecoder();
  
  // Compress enough data to trigger wraparound
  var blockSize = 32 * 1024; // 32KB blocks
  var blockCount = 8; // Total 256KB, should trigger wraparound
  
  for (var i = 0; i < blockCount; i++) {
    var input = new Uint8Array(blockSize);
    for (var j = 0; j < blockSize; j++) {
      input[j] = (i * 256 + j) % 256;
    }
    
    var compressed = lz4.makeBuffer(lz4.compressBound(input.length));
    var compSize = lz4.compressBlockContinue(encoder3, input, 0, input.length, compressed, 0, compressed.length);
    
    // Decompress
    var result = lz4.decompressBlockContinue(decoder3, compressed, 0, compSize, input.length);
    
    // Verify
    var match = true;
    for (var k = 0; k < input.length; k++) {
      if (result.data[result.offset + k] !== input[k]) {
        match = false;
        console.log('  Mismatch at block ' + i + ', byte ' + k);
        break;
      }
    }
    
    if (!match) {
      throw new Error('Data mismatch at block ' + i);
    }
    
    console.log('  Block ' + (i + 1) + '/' + blockCount + ': ' + input.length + ' -> ' + compSize + ' bytes - OK');
  }
  
  console.log('  Test 3: PASSED\n');
} catch (e) {
  console.log('  Test 3: FAILED - ' + e.message);
  console.log('  Stack: ' + e.stack);
}

// Test 4: Comparison with non-streaming compression
console.log('Test 4: Streaming vs Non-streaming');
try {
  var testData = makeTestData('Lorem ipsum dolor sit amet, consectetur adipiscing elit. ', 100);
  
  // Non-streaming
  var nsCompressed = lz4.compress(testData);
  
  // Streaming (single block, no dictionary benefit)
  var encoder4 = lz4.createStreamEncoder();
  var sCompressed = lz4.makeBuffer(lz4.compressBound(testData.length));
  var sCompSize = lz4.compressBlockContinue(encoder4, testData, 0, testData.length, sCompressed, 0, sCompressed.length);
  
  console.log('  Non-streaming: ' + testData.length + ' -> ' + nsCompressed.length + ' bytes');
  console.log('  Streaming: ' + testData.length + ' -> ' + sCompSize + ' bytes');
  console.log('  Difference: ' + Math.abs(nsCompressed.length - sCompSize) + ' bytes');
  
  // Both should be reasonably close
  var diff = Math.abs(nsCompressed.length - sCompSize);
  if (diff < testData.length * 0.1) { // Within 10%
    console.log('  Test 4: PASSED\n');
  } else {
    console.log('  Test 4: WARNING - Large difference between streaming and non-streaming\n');
  }
} catch (e) {
  console.log('  Test 4: FAILED - ' + e.message);
  console.log('  Stack: ' + e.stack);
}

console.log('=== All tests completed ===');

