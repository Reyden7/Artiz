import { File } from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import { Platform } from 'react-native';
import type { ImagePickerAsset } from 'expo-image-picker';

export async function prepareImage(asset: ImagePickerAsset, maxDimension = 1600) {
  const context = ImageManipulator.ImageManipulator.manipulate(asset.uri);
  const maxSide = Math.max(asset.width, asset.height);
  if (maxSide > maxDimension) {
    context.resize(asset.width >= asset.height
      ? { width: maxDimension, height: null }
      : { width: null, height: maxDimension });
  }
  const rendered = await context.renderAsync();
  const result = await rendered.saveAsync({
    format: ImageManipulator.SaveFormat.JPEG,
    compress: 0.78,
  });
  const bytes = Platform.OS === 'web'
    ? await fetch(result.uri).then((response) => response.arrayBuffer())
    : await new File(result.uri).arrayBuffer();
  if (bytes.byteLength > 6 * 1024 * 1024) {
    throw new Error('Une photo reste trop volumineuse après compression. Choisissez une autre image.');
  }
  return bytes;
}
