import sharp from 'sharp';
import logger from './logger';

export interface ImageStitchingResult {
  combinedImageBase64: string;
  layout: {
    columns: number;
    rows: number;
    imageWidth: number;
    imageHeight: number;
  };
}

/**
 * Stitch multiple images into a single grid image
 * 
 * @param imagesBase64 - Array of base64-encoded images
 * @param targetSize - Target size for the combined image (default: 1024x1024)
 * @returns Combined image as base64 and layout information
 */
export async function stitchImages(
  imagesBase64: string[],
  targetSize = 1024
): Promise<ImageStitchingResult> {
  logger.info('ImageStitcher: Starting image stitching process', {
    imageCount: imagesBase64.length,
    targetSize,
  });

  if (imagesBase64.length === 0) {
    logger.error('ImageStitcher: No images provided');
    throw new Error('Cannot stitch images: No images provided');
  }

  if (imagesBase64.length === 1) {
    logger.info('ImageStitcher: Single image detected, resizing only', {
      targetSize,
    });
    
    // Single image - just resize if needed
    const buffer = Buffer.from(imagesBase64[0], 'base64');
    const resized = await sharp(buffer)
      .resize(targetSize, targetSize, { fit: 'cover' })
      .png()
      .toBuffer();
    
    logger.info('ImageStitcher: Single image resized successfully', {
      outputSize: resized.length,
    });
    
    return {
      combinedImageBase64: resized.toString('base64'),
      layout: {
        columns: 1,
        rows: 1,
        imageWidth: targetSize,
        imageHeight: targetSize,
      },
    };
  }

  // Calculate grid layout (prefer wider grids for better viewing)
  const imageCount = imagesBase64.length;
  let columns: number;
  let rows: number;

  logger.info('ImageStitcher: Calculating optimal grid layout', {
    imageCount,
  });

  if (imageCount === 2) {
    columns = 2;
    rows = 1;
  } else if (imageCount === 3) {
    columns = 3;
    rows = 1;
  } else if (imageCount === 4) {
    columns = 2;
    rows = 2;
  } else if (imageCount <= 6) {
    columns = 3;
    rows = 2;
  } else if (imageCount <= 9) {
    columns = 3;
    rows = 3;
  } else {
    columns = 4;
    rows = Math.ceil(imageCount / 4);
  }

  // Calculate individual image size to fit in grid
  const imageWidth = Math.floor(targetSize / columns);
  const imageHeight = Math.floor(targetSize / rows);

  logger.info('ImageStitcher: Grid layout calculated', {
    imageCount,
    gridLayout: `${columns}x${rows}`,
    columns,
    rows,
    cellSize: `${imageWidth}x${imageHeight}`,
    imageWidth,
    imageHeight,
    totalCanvasSize: `${targetSize}x${targetSize}`,
  });

  // Process each image: resize and convert to buffer
  logger.info('ImageStitcher: Starting individual image processing', {
    totalImages: imagesBase64.length,
  });

  const processedImages: Buffer[] = [];
  for (let i = 0; i < imagesBase64.length; i++) {
    try {
      logger.debug('ImageStitcher: Processing image', {
        imageIndex: i + 1,
        totalImages: imagesBase64.length,
        targetSize: `${imageWidth}x${imageHeight}`,
      });

      const buffer = Buffer.from(imagesBase64[i], 'base64');
      const processed = await sharp(buffer)
        .resize(imageWidth, imageHeight, { fit: 'cover' })
        .png()
        .toBuffer();
      processedImages.push(processed);

      logger.debug('ImageStitcher: Image processed successfully', {
        imageIndex: i + 1,
        outputSize: processed.length,
      });
    } catch (error) {
      logger.error('ImageStitcher: Failed to process image', {
        imageIndex: i,
        error: (error as Error).message,
        stack: (error as Error).stack,
      });
      throw new Error(`Failed to process image ${i + 1} for stitching`);
    }
  }

  logger.info('ImageStitcher: All images processed, creating composite layout', {
    processedCount: processedImages.length,
  });

  // Create composite layout
  const composites: Array<{ input: Buffer; top: number; left: number }> = [];
  
  for (let i = 0; i < processedImages.length; i++) {
    const row = Math.floor(i / columns);
    const col = i % columns;
    
    const position = {
      top: row * imageHeight,
      left: col * imageWidth,
    };
    
    composites.push({
      input: processedImages[i],
      top: position.top,
      left: position.left,
    });

    logger.debug('ImageStitcher: Added image to composite layout', {
      imageIndex: i + 1,
      gridPosition: { row: row + 1, col: col + 1 },
      canvasPosition: position,
    });
  }

  logger.info('ImageStitcher: Creating blank canvas and compositing images', {
    canvasSize: `${targetSize}x${targetSize}`,
    backgroundColor: { r: 240, g: 240, b: 240 },
    compositeCount: composites.length,
  });

  // Create blank canvas and composite images onto it
  const canvas = sharp({
    create: {
      width: targetSize,
      height: targetSize,
      channels: 4,
      background: { r: 240, g: 240, b: 240, alpha: 1 }, // Light gray background
    },
  });

  const combinedBuffer = await canvas
    .composite(composites)
    .png()
    .toBuffer();

  const combinedImageBase64 = combinedBuffer.toString('base64');

  logger.info('ImageStitcher: Images stitched successfully!', {
    imageCount: imagesBase64.length,
    gridLayout: `${columns}x${rows}`,
    layout: { columns, rows },
    outputCanvasSize: `${targetSize}x${targetSize}`,
    outputBufferSize: combinedBuffer.length,
    outputBase64Length: combinedImageBase64.length,
  });

  return {
    combinedImageBase64,
    layout: {
      columns,
      rows,
      imageWidth,
      imageHeight,
    },
  };
}

/**
 * Build a description of the grid layout for inclusion in prompts
 * 
 * @param layout - Grid layout information
 * @param peopleNames - Names of people corresponding to grid positions
 * @returns Description text for the prompt
 */
export function buildGridLayoutDescription(
  layout: { columns: number; rows: number },
  peopleNames: string[]
): string {
  const { columns, rows } = layout;
  
  logger.info('ImageStitcher: Building grid layout description', {
    gridSize: `${columns}x${rows}`,
    peopleCount: peopleNames.length,
    people: peopleNames,
  });
  
  if (peopleNames.length === 1) {
    const description = `The reference image shows: ${peopleNames[0]}`;
    logger.info('ImageStitcher: Single person description', { description });
    return description;
  }

  const parts: string[] = [];
  parts.push(`The reference image is a ${columns}x${rows} grid containing ${peopleNames.length} people:`);
  
  for (let i = 0; i < peopleNames.length; i++) {
    const row = Math.floor(i / columns) + 1;
    const col = (i % columns) + 1;
    const position = rows === 1 
      ? `position ${i + 1}` 
      : `row ${row}, column ${col}`;
    const line = `- ${position}: ${peopleNames[i]}`;
    parts.push(line);
    
    logger.debug('ImageStitcher: Grid position mapping', {
      index: i,
      person: peopleNames[i],
      gridPosition: rows === 1 ? `position ${i + 1}` : `row ${row}, col ${col}`,
    });
  }
  
  parts.push('Use the grid to identify each person and preserve their facial features accurately.');
  
  const description = parts.join('\n');
  
  logger.info('ImageStitcher: Grid layout description complete', {
    descriptionLength: description.length,
    lines: parts.length,
  });
  
  return description;
}

/**
 * Extract the center panel from a horizontal multi-panel image
 * Useful for extracting the front-facing avatar from a 3-angle array
 * 
 * @param imageBase64 - Base64-encoded image containing multiple horizontal panels
 * @param totalPanels - Total number of panels in the horizontal layout (e.g., 3 for left/front/right)
 * @returns Base64-encoded image of the center panel
 */
export async function extractCenterPanel(
  imageBase64: string,
  totalPanels: number = 3
): Promise<string> {
  logger.info('ImageStitcher: Starting center panel extraction', {
    totalPanels,
  });

  if (totalPanels < 1) {
    logger.error('ImageStitcher: Invalid panel count');
    throw new Error('Total panels must be at least 1');
  }

  if (totalPanels === 1) {
    logger.info('ImageStitcher: Single panel detected, returning as-is');
    return imageBase64;
  }

  try {
    const buffer = Buffer.from(imageBase64, 'base64');
    const image = sharp(buffer);
    const metadata = await image.metadata();

    if (!metadata.width || !metadata.height) {
      throw new Error('Unable to read image dimensions');
    }

    logger.info('ImageStitcher: Image metadata retrieved', {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
    });

    // Calculate panel width
    const panelWidth = Math.floor(metadata.width / totalPanels);
    const centerPanelIndex = Math.floor(totalPanels / 2);
    const leftOffset = centerPanelIndex * panelWidth;

    logger.info('ImageStitcher: Extracting center panel', {
      panelWidth,
      centerPanelIndex,
      leftOffset,
      extractRegion: {
        left: leftOffset,
        top: 0,
        width: panelWidth,
        height: metadata.height,
      },
    });

    // Extract the center panel
    const extractedBuffer = await image
      .extract({
        left: leftOffset,
        top: 0,
        width: panelWidth,
        height: metadata.height,
      })
      .png()
      .toBuffer();

    const extractedBase64 = extractedBuffer.toString('base64');

    logger.info('ImageStitcher: Center panel extracted successfully', {
      originalSize: `${metadata.width}x${metadata.height}`,
      extractedSize: `${panelWidth}x${metadata.height}`,
      outputBufferSize: extractedBuffer.length,
      outputBase64Length: extractedBase64.length,
    });

    return extractedBase64;
  } catch (error) {
    logger.error('ImageStitcher: Failed to extract center panel', {
      error: (error as Error).message,
      stack: (error as Error).stack,
    });
    throw new Error(`Failed to extract center panel: ${(error as Error).message}`);
  }
}
