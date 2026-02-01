import { readFileSync, writeFileSync, statSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { PDFDocument } from 'pdf-lib';
import { createLogger } from './logger';

const execAsync = promisify(exec);
const logger = createLogger('PDFProcessor');

export interface PDFInfo {
  pages: number;
  sizeMB: number;
  width: number;
  height: number;
}

/**
 * Get PDF information (pages, size, dimensions)
 */
export async function getPDFInfo(filePath: string): Promise<PDFInfo> {
  try {
    const stats = statSync(filePath);
    const sizeMB = stats.size / (1024 * 1024);

    const pdfBytes = readFileSync(filePath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPageCount();

    // Get dimensions from first page
    const firstPage = pdfDoc.getPage(0);
    const { width, height } = firstPage.getSize();

    await logger.info(`PDF Info: ${pages} pages, ${sizeMB.toFixed(2)} MB, ${width}x${height}px`);

    return { pages, sizeMB, width, height };
  } catch (error: any) {
    await logger.error('Failed to get PDF info', error);
    throw error;
  }
}

/**
 * Detect page rotation angle using Tesseract OSD (Orientation and Script Detection)
 */
export async function detectRotationAngle(imagePath: string): Promise<number> {
  try {
    // Use tesseract with --psm 0 (OSD mode) to detect rotation
    const { stdout } = await execAsync(`tesseract "${imagePath}" - --psm 0 2>/dev/null || true`);

    // Parse output for rotation angle
    const match = stdout.match(/Rotate:\s*(\d+)/);
    if (match) {
      const angle = parseInt(match[1], 10);
      return angle;
    }

    return 0;
  } catch (error: any) {
    await logger.debug('Rotation detection failed, assuming 0°', { error: error.message });
    return 0;
  }
}

/**
 * Check if PDF needs rotation and rotate if necessary
 * Returns: [rotatedPdfPath, wasRotated, totalPages]
 */
export async function detectAndRotatePDF(inputPath: string): Promise<[string, boolean, number]> {
  try {
    await logger.info('Checking PDF orientation...');

    const pdfBytes = readFileSync(inputPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();

    let needsRotation = false;
    const rotations: number[] = [];

    // Check first 3 pages (or all if less than 3)
    const pagesToCheck = Math.min(3, pages.length);

    for (let i = 0; i < pagesToCheck; i++) {
      const page = pages[i];

      // Render page to image for tesseract
      // We'll use ghostscript to extract page as image
      const tempImagePath = `/tmp/page_${i}_${Date.now()}.png`;

      try {
        // Extract page as PNG using ghostscript
        await execAsync(
          `gs -dSAFER -dBATCH -dNOPAUSE -sDEVICE=png16m -r150 ` +
          `-dFirstPage=${i + 1} -dLastPage=${i + 1} ` +
          `-sOutputFile="${tempImagePath}" "${inputPath}" 2>/dev/null`
        );

        // Detect rotation
        const angle = await detectRotationAngle(tempImagePath);
        rotations.push(angle);

        // Cleanup temp image
        await execAsync(`rm -f "${tempImagePath}"`);

        if (angle !== 0) {
          await logger.info(`Page ${i + 1}: ${angle}° rotation needed`);
          needsRotation = true;
        }
      } catch (err: any) {
        await logger.warn(`Failed to check rotation for page ${i + 1}`, { error: err.message });
      }
    }

    if (!needsRotation) {
      await logger.info('No rotation needed');
      return [inputPath, false, 0];
    }

    // Apply rotation to all pages based on most common rotation detected
    const mostCommonRotation = rotations.sort((a, b) =>
      rotations.filter(r => r === a).length - rotations.filter(r => r === b).length
    ).pop() || 0;

    if (mostCommonRotation === 0) {
      return [inputPath, false, 0];
    }

    await logger.info(`Rotating all pages by ${mostCommonRotation}°`);

    // Rotate pages
    const { degrees } = await import('pdf-lib');
    for (const page of pages) {
      page.setRotation(degrees(mostCommonRotation));
    }

    // Save rotated PDF
    const rotatedPath = inputPath.replace('.pdf', '_rotated.pdf');
    const rotatedBytes = await pdfDoc.save();
    writeFileSync(rotatedPath, rotatedBytes);

    await logger.info(`Rotation complete: ${rotatedPath}`);
    return [rotatedPath, true, pages.length];

  } catch (error: any) {
    await logger.error('Failed to rotate PDF', error);
    // Return original if rotation fails
    return [inputPath, false, 0];
  }
}

/**
 * Remove existing OCR text layer from PDF
 * This creates a new PDF with only images, no text
 */
export async function removeOCRLayer(inputPath: string): Promise<string> {
  try {
    await logger.info('Removing existing OCR layer...');

    const outputPath = inputPath.replace('.pdf', '_no_ocr.pdf');

    // Use ghostscript to rasterize PDF and remove text layer
    await execAsync(
      `gs -dSAFER -dBATCH -dNOPAUSE -sDEVICE=pdfwrite ` +
      `-dPDFSETTINGS=/prepress ` +
      `-dNOCACHE ` +
      `-r150 ` +
      `-sOutputFile="${outputPath}" "${inputPath}" 2>/dev/null`
    );

    await logger.info(`OCR layer removed: ${outputPath}`);
    return outputPath;

  } catch (error: any) {
    await logger.error('Failed to remove OCR layer', error);
    // Return original if removal fails
    return inputPath;
  }
}

/**
 * Check if PDF exceeds Document AI limits
 */
export function exceedsLimits(info: PDFInfo, maxPages: number, maxSizeMB: number): boolean {
  return info.pages > maxPages || info.sizeMB > maxSizeMB;
}

/**
 * Check if PDF already has searchable text (OCR layer)
 * Returns true if PDF contains extractable text
 */
export async function isSearchablePDF(filePath: string): Promise<boolean> {
  try {
    // Use pdftotext to extract text from first page
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    // Extract text from first page only (faster)
    const { stdout } = await execAsync(`pdftotext -f 1 -l 1 "${filePath}" -`);

    // Check if we got meaningful text (more than just whitespace/special chars)
    const text = stdout.trim();
    const meaningfulText = text.replace(/[\s\n\r\t]/g, '');

    // If we have at least 50 characters of text, consider it searchable
    return meaningfulText.length > 50;
  } catch (error) {
    // If pdftotext fails or extraction fails, assume not searchable
    return false;
  }
}
