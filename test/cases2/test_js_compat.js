// JavaScript compatibility test for streaming LZ4 compression
// Test cross-compatibility with C implementation

var lz4 = require('../../lz4.js');
var fs = require('fs');

// Compress test data and save to file (for C to decompress)
function jsCompress(outputFile) {
  var encoder = lz4.createStreamEncoder();
  
  var blocks = [];
  var blockCount = 5;
  
  // Create same test data as C version
  var pattern = 'The quick brown fox jumps over the lazy dog. ';
  var patternBytes = [];
  for (var i = 0; i < pattern.length; i++) {
    patternBytes.push(pattern.charCodeAt(i));
  }
  
  // Compress multiple blocks
  for (var i = 0; i < blockCount; i++) {
    // Create test block
    var blockData = [];
    for (var j = 0; j < 50; j++) {
      blockData = blockData.concat(patternBytes);
    }
    var input = new Uint8Array(blockData);
    
    // Compress
    var compressed = lz4.makeBuffer(lz4.compressBound(input.length));
    var compSize = lz4.compressBlockContinue(
      encoder, input, 0, input.length, compressed, 0, compressed.length);
    
    // Store block info
    blocks.push({
      compSize: compSize,
      origSize: input.length,
      data: compressed.slice(0, compSize)
    });
    
    console.log('Block ' + (i + 1) + ': ' + input.length + ' -> ' + compSize + 
                ' bytes (' + Math.round(compSize * 100 / input.length) + '%)');
  }
  
  // Write to file
  var buffers = [];
  for (var i = 0; i < blocks.length; i++) {
    var block = blocks[i];
    
    // Write compressed size (4 bytes, little-endian)
    var compSizeBuf = Buffer.alloc(4);
    compSizeBuf.writeInt32LE(block.compSize, 0);
    buffers.push(compSizeBuf);
    
    // Write original size (4 bytes, little-endian)
    var origSizeBuf = Buffer.alloc(4);
    origSizeBuf.writeInt32LE(block.origSize, 0);
    buffers.push(origSizeBuf);
    
    // Write compressed data
    buffers.push(Buffer.from(block.data));
  }
  
  fs.writeFileSync(outputFile, Buffer.concat(buffers));
  console.log('JS compression completed: ' + blockCount + ' blocks written to ' + outputFile);
}

// Decompress file created by C (or JS)
function jsDecompress(inputFile) {
  var decoder = lz4.createStreamDecoder();
  
  var data = fs.readFileSync(inputFile);
  var offset = 0;
  var blockIndex = 0;
  
  while (offset < data.length) {
    // Read compressed size
    if (offset + 4 > data.length) break;
    var compSize = data.readInt32LE(offset);
    offset += 4;
    
    // Read original size
    if (offset + 4 > data.length) break;
    var origSize = data.readInt32LE(offset);
    offset += 4;
    
    // Read compressed data
    if (offset + compSize > data.length) {
      console.log('Unexpected end of file');
      break;
    }
    
    var compData = new Uint8Array(data.buffer, data.byteOffset + offset, compSize);
    offset += compSize;
    
    // Decompress
    var result = lz4.decompressBlockContinue(decoder, compData, 0, compSize, origSize);
    
    if (result.length !== origSize) {
      console.log('Size mismatch at block ' + blockIndex + ': expected ' + 
                  origSize + ', got ' + result.length);
      break;
    }
    
    // Convert to string for display
    var str = '';
    for (var i = 0; i < Math.min(50, result.length); i++) {
      str += String.fromCharCode(result.data[result.offset + i]);
    }
    
    console.log('Block ' + (blockIndex + 1) + ': ' + compSize + ' -> ' + 
                result.length + ' bytes decompressed');
    console.log('  Content: ' + str + '...');
    
    blockIndex++;
  }
  
  console.log('JS decompression completed: ' + blockIndex + ' blocks processed');
}

// Main
var command = process.argv[2];
var filename = process.argv[3];

if (!command || !filename) {
  console.log('Usage:');
  console.log('  node test_js_compat.js compress <output_file>   - Compress test data');
  console.log('  node test_js_compat.js decompress <input_file>  - Decompress test data');
  process.exit(1);
}

if (command === 'compress') {
  jsCompress(filename);
} else if (command === 'decompress') {
  jsDecompress(filename);
} else {
  console.log('Unknown command: ' + command);
  process.exit(1);
}

