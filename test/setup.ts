/* eslint-disable @typescript-eslint/no-require-imports */
import { fs } from './mocks/expo-file-system';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

beforeEach(async () => {
  fs.reset();
  const storage = require('@react-native-async-storage/async-storage');
  await (storage.default ?? storage).clear();
});
