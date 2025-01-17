import { readJsonSync } from 'fs-extra';

import type { LokiDbFile, IResourceItem } from '@recative/definitions';

export const cleanupLoki = <T extends object>(x: T): T => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { $loki, meta, ...result } = x as any;
  return result as T;
};

export const mergeResourceList = async (
  // @ts-ignore
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  fileA: LokiDbFile<IResourceItem>,
  // @ts-ignore
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  fileB: LokiDbFile<IResourceItem>
) => {
  // This method have to be re-implemented.
};

export const mergeResourceListFile = async (pathA: string, pathB: string) => {
  const [fileA, fileB] = await Promise.all<
    [LokiDbFile<IResourceItem>, LokiDbFile<IResourceItem>]
  >([readJsonSync(pathA), readJsonSync(pathB)]);

  return mergeResourceList(fileA, fileB);
};
