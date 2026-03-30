import * as FileSystemLegacy from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';

/** Target max file size before upload (1 MiB). */
export const MAX_UPLOAD_IMAGE_BYTES = 1024 * 1024;

/**
 * SDK 54+: `getInfoAsync` on the main `expo-file-system` entry throws a deprecation error.
 * Use the legacy API for reliable byte size on `file://` URIs (see Expo FileSystem docs).
 */
async function getUriByteSize(uri) {
  if (!uri) return null;
  try {
    const info = await FileSystemLegacy.getInfoAsync(uri, { size: true });
    if (info.exists && typeof info.size === 'number') return info.size;
  } catch (e) {
    console.warn('[imageCompression] getUriByteSize failed', {
      uriPrefix: uri?.slice(0, 48),
      message: e?.message,
    });
  }
  return null;
}

/**
 * Resize so the longest edge is at most maxSide (no upscaling).
 */
function resizeActionsForMaxSide(width, height, maxSide) {
  const w = Number(width) || 0;
  const h = Number(height) || 0;
  if (!w || !h) {
    return [{ resize: { width: maxSide } }];
  }
  const longer = Math.max(w, h);
  if (longer <= maxSide) {
    return [];
  }
  if (w >= h) {
    return [{ resize: { width: maxSide } }];
  }
  return [{ resize: { height: maxSide } }];
}

function toJpegAsset(asset, result) {
  const rawName = asset.fileName || 'image';
  const base = rawName.replace(/\.[^.]+$/, '');
  return {
    ...asset,
    uri: result.uri,
    width: result.width,
    height: result.height,
    fileName: `${base || 'image'}.jpg`,
    mimeType: 'image/jpeg',
    type: 'image/jpeg',
    fileSize: undefined,
  };
}

/**
 * If the picked image is larger than maxBytes, re-encode (JPEG) and scale down
 * until it fits or the smallest preset is reached. Returns an asset-shaped object
 * compatible with expo-image-picker and FormData uploads.
 *
 * @param {import('expo-image-picker').ImagePickerAsset | null | undefined} asset
 * @param {number} [maxBytes]
 */
export async function compressImageAssetIfNeeded(asset, maxBytes = MAX_UPLOAD_IMAGE_BYTES) {
  if (!asset?.uri) {
    console.log('[imageCompression] skip — no asset.uri');
    return asset;
  }

  const { uri, width, height } = asset;
  console.log('[imageCompression] start', {
    uriPrefix: uri?.slice(0, 48),
    fileName: asset.fileName,
    fileSizeFromPicker: asset.fileSize,
    width,
    height,
    maxBytes,
  });

  let size = typeof asset.fileSize === 'number' ? asset.fileSize : null;
  if (size == null) {
    size = await getUriByteSize(uri);
  }

  const needsWork = size == null || size > maxBytes;
  console.log('[imageCompression] resolved size (bytes)', size, 'needsCompression', needsWork);

  if (size != null && size <= maxBytes) {
    console.log('[imageCompression] skip — already within limit', { size, maxBytes });
    return asset;
  }

  const maxSides = [2048, 1600, 1280, 1024, 800, 640, 480];
  const qualities = [0.82, 0.72, 0.62, 0.52, 0.42, 0.35, 0.28];

  let lastResult = null;

  try {
    for (let i = 0; i < maxSides.length; i++) {
      const actions = resizeActionsForMaxSide(width, height, maxSides[i]);
      const q = qualities[Math.min(i, qualities.length - 1)];
      console.log('[imageCompression] attempt', i + 1, '/', maxSides.length, {
        maxSide: maxSides[i],
        quality: q,
        resizeActionCount: actions.length,
      });

      const result = await ImageManipulator.manipulateAsync(uri, actions, {
        compress: q,
        format: ImageManipulator.SaveFormat.JPEG,
      });
      lastResult = result;

      const newSize = await getUriByteSize(result.uri);
      console.log('[imageCompression] after manipulate', {
        outUriPrefix: result.uri?.slice(0, 48),
        width: result.width,
        height: result.height,
        newSizeBytes: newSize,
        underLimit: newSize != null && newSize <= maxBytes,
      });

      if (newSize != null && newSize <= maxBytes) {
        const out = toJpegAsset(asset, result);
        console.log('[imageCompression] done — under limit', {
          newSizeBytes: newSize,
          maxBytes,
          fileName: out.fileName,
        });
        return out;
      }
    }

    if (lastResult) {
      const finalSize = await getUriByteSize(lastResult.uri);
      const out = toJpegAsset(asset, lastResult);
      console.log('[imageCompression] done — max attempts (best effort)', {
        finalSizeBytes: finalSize,
        maxBytes,
        fileName: out.fileName,
      });
      return out;
    }
  } catch (e) {
    console.warn('[imageCompression] manipulate failed, using original', e?.message, e);
  }

  console.log('[imageCompression] returning original asset (fallback)');
  return asset;
}
