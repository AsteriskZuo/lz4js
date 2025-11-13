// C compatibility test for streaming LZ4 compression
// Compile: gcc test_c_compat.c -I../../../lz4/lib -L../../../lz4/lib -llz4 -o test_c_compat

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "lz4.h"

#define MESSAGE_MAX_BYTES (64 * 1024)
#define ENCODE_RING_BUFFER (128 * 1024 + MESSAGE_MAX_BYTES)
#define DECODE_RING_BUFFER ENCODE_RING_BUFFER

// Test streaming compression
int test_c_compress(const char* output_file) {
    LZ4_stream_t* lz4Stream = LZ4_createStream();
    if (!lz4Stream) {
        fprintf(stderr, "Failed to create LZ4 stream\n");
        return -1;
    }
    
    char* inpBuf = (char*)malloc(ENCODE_RING_BUFFER);
    if (!inpBuf) {
        fprintf(stderr, "Failed to allocate input buffer\n");
        LZ4_freeStream(lz4Stream);
        return -1;
    }
    
    FILE* fp = fopen(output_file, "wb");
    if (!fp) {
        fprintf(stderr, "Failed to open output file\n");
        free(inpBuf);
        LZ4_freeStream(lz4Stream);
        return -1;
    }
    
    int inpOffset = 0;
    int blockCount = 5;
    
    // Compress multiple blocks with repeating pattern
    for (int i = 0; i < blockCount; i++) {
        // Create test data with repeating pattern
        const char* pattern = "The quick brown fox jumps over the lazy dog. ";
        int patternLen = strlen(pattern);
        int blockSize = patternLen * 50; // 2250 bytes per block
        
        char* inpPtr = inpBuf + inpOffset;
        for (int j = 0; j < 50; j++) {
            memcpy(inpPtr + j * patternLen, pattern, patternLen);
        }
        
        // Compress
        char compBuf[MESSAGE_MAX_BYTES];
        int compSize = LZ4_compress_fast_continue(
            lz4Stream, inpPtr, compBuf, blockSize, MESSAGE_MAX_BYTES, 1);
        
        if (compSize <= 0) {
            fprintf(stderr, "Compression failed at block %d\n", i);
            fclose(fp);
            free(inpBuf);
            LZ4_freeStream(lz4Stream);
            return -1;
        }
        
        // Write compressed size and data
        fwrite(&compSize, sizeof(int), 1, fp);
        fwrite(&blockSize, sizeof(int), 1, fp); // Original size
        fwrite(compBuf, 1, compSize, fp);
        
        printf("Block %d: %d -> %d bytes (%.1f%%)\n", 
               i + 1, blockSize, compSize, (float)compSize * 100 / blockSize);
        
        // Update offset with wraparound
        inpOffset += blockSize;
        if (inpOffset >= ENCODE_RING_BUFFER - MESSAGE_MAX_BYTES) {
            inpOffset = 0;
        }
    }
    
    fclose(fp);
    free(inpBuf);
    LZ4_freeStream(lz4Stream);
    
    printf("C compression completed: %d blocks written to %s\n", blockCount, output_file);
    return 0;
}

// Test streaming decompression
int test_c_decompress(const char* input_file) {
    LZ4_streamDecode_t* lz4StreamDecode = LZ4_createStreamDecode();
    if (!lz4StreamDecode) {
        fprintf(stderr, "Failed to create LZ4 decode stream\n");
        return -1;
    }
    
    char* decBuf = (char*)malloc(DECODE_RING_BUFFER);
    if (!decBuf) {
        fprintf(stderr, "Failed to allocate decode buffer\n");
        LZ4_freeStreamDecode(lz4StreamDecode);
        return -1;
    }
    
    FILE* fp = fopen(input_file, "rb");
    if (!fp) {
        fprintf(stderr, "Failed to open input file: %s\n", input_file);
        free(decBuf);
        LZ4_freeStreamDecode(lz4StreamDecode);
        return -1;
    }
    
    int decOffset = 0;
    int blockIndex = 0;
    
    while (1) {
        int compSize, origSize;
        
        // Read compressed size and original size
        if (fread(&compSize, sizeof(int), 1, fp) != 1) {
            break; // End of file
        }
        if (fread(&origSize, sizeof(int), 1, fp) != 1) {
            fprintf(stderr, "Failed to read original size\n");
            break;
        }
        
        // Read compressed data
        char compBuf[MESSAGE_MAX_BYTES];
        if (fread(compBuf, 1, compSize, fp) != (size_t)compSize) {
            fprintf(stderr, "Failed to read compressed data\n");
            break;
        }
        
        // Decompress
        char* decPtr = decBuf + decOffset;
        int decSize = LZ4_decompress_safe_continue(
            lz4StreamDecode, compBuf, decPtr, compSize, MESSAGE_MAX_BYTES);
        
        if (decSize <= 0) {
            fprintf(stderr, "Decompression failed at block %d\n", blockIndex);
            break;
        }
        
        if (decSize != origSize) {
            fprintf(stderr, "Size mismatch at block %d: expected %d, got %d\n",
                    blockIndex, origSize, decSize);
            break;
        }
        
        printf("Block %d: %d -> %d bytes decompressed\n", 
               blockIndex + 1, compSize, decSize);
        
        // Verify content (first few bytes)
        printf("  Content: %.50s...\n", decPtr);
        
        // Update offset with wraparound
        decOffset += decSize;
        if (decOffset >= DECODE_RING_BUFFER - MESSAGE_MAX_BYTES) {
            decOffset = 0;
        }
        
        blockIndex++;
    }
    
    fclose(fp);
    free(decBuf);
    LZ4_freeStreamDecode(lz4StreamDecode);
    
    printf("C decompression completed: %d blocks processed\n", blockIndex);
    return 0;
}

int main(int argc, char* argv[]) {
    if (argc < 2) {
        printf("Usage:\n");
        printf("  %s compress <output_file>   - Compress test data\n", argv[0]);
        printf("  %s decompress <input_file>  - Decompress test data\n", argv[0]);
        return 1;
    }
    
    if (strcmp(argv[1], "compress") == 0) {
        if (argc < 3) {
            fprintf(stderr, "Output file required\n");
            return 1;
        }
        return test_c_compress(argv[2]);
    } else if (strcmp(argv[1], "decompress") == 0) {
        if (argc < 3) {
            fprintf(stderr, "Input file required\n");
            return 1;
        }
        return test_c_decompress(argv[2]);
    } else {
        fprintf(stderr, "Unknown command: %s\n", argv[1]);
        return 1;
    }
    
    return 0;
}

