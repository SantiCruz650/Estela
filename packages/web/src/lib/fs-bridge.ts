import { FileSystemLogSource, PermissionRequiredError } from '@devtool/core';

type ShowOpenFilePicker = (options?: {
  types?: Array<{
    description: string;
    accept: Record<string, string[]>;
  }>;
}) => Promise<FileSystemFileHandle[]>;

export async function pickLogFile(): Promise<FileSystemFileHandle> {
  if (typeof window === 'undefined') {
    throw new Error('showOpenFilePicker no está disponible en este navegador.');
  }

  const browserWindow = window as Window & { showOpenFilePicker?: ShowOpenFilePicker };
  // VERIFY-API: showOpenFilePicker no está declarado por lib.dom, aunque forma parte de File System Access.
  if (typeof browserWindow.showOpenFilePicker !== 'function') {
    throw new Error('showOpenFilePicker no está disponible en este navegador.');
  }

  const [handle] = await browserWindow.showOpenFilePicker({
    types: [
      {
        description: 'Logs',
        accept: {
          'text/plain': ['.log', '.txt'],
        },
      },
    ],
  });

  return handle;
}

export { FileSystemLogSource, PermissionRequiredError };
