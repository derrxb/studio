import { dirname, basename } from 'path';

import tempfile from 'tempfile';
import { readJsonSync } from 'fs-extra';
import { merge, isEqual, omit } from 'lodash';

import type {
  LokiDbFile,
  IResourceItem,
  ILokiObject,
} from '@recative/definitions';

import { getTable } from '../db';

export const cleanupLoki = <T extends object>(x: T) => {
  return omit(x, ['$loki', 'meta']) as Omit<T, '$loki' | 'meta'>;
};

const cleanupRecord = (x: IResourceItem & ILokiObject): IResourceItem => {
  const result = omit(x, ['$loki', 'meta']) as IResourceItem;

  return result;
};

export const mergeResourceList = async (
  fileA: LokiDbFile<IResourceItem>,
  fileB: LokiDbFile<IResourceItem>
) => {
  const dbPath = tempfile('.json');
  const resourceDb = await getTable(dirname(dbPath), basename(dbPath));
  const resourceCollection = resourceDb.addCollection<IResourceItem>(
    'resources',
    {
      autoupdate: true,
      indices: ['id', 'label', 'type', 'resourceGroupId', 'importTime'],
    }
  );

  const dataA = fileA.collections[0].data;
  const dataB = fileB.collections[0].data;

  const itemIndexA = new Map<string, IResourceItem & ILokiObject>();
  const itemIndexB = new Map<string, IResourceItem & ILokiObject>();

  dataA.forEach((item) => itemIndexA.set(item.id, item));
  dataB.forEach((item) => itemIndexB.set(item.id, item));

  const mergedIdSet = new Set([...itemIndexA.keys(), ...itemIndexB.keys()]);

  mergedIdSet.forEach((id) => {
    const itemA = itemIndexA.get(id);
    const itemB = itemIndexB.get(id);

    if (itemA && isEqual(itemA, itemB)) {
      resourceCollection.insert(cleanupRecord(itemA));
      return;
    }

    if (itemA && itemB) {
      const mergedItem =
        itemA.meta.updated > itemB.meta.updated
          ? merge({}, itemB, itemA)
          : merge({}, itemA, itemB);

      resourceCollection.insert(cleanupRecord(mergedItem));
    } else if (itemA) {
      resourceCollection.insert(cleanupRecord(itemA));
    } else if (itemB) {
      resourceCollection.insert(cleanupRecord(itemB));
    }
  });

  await new Promise((resolve) => {
    setTimeout(resolve, 1000);
  });
  return readJsonSync(dbPath);
};

export const mergeResourceListFile = async (pathA: string, pathB: string) => {
  const [fileA, fileB] = await Promise.all<
    [LokiDbFile<IResourceItem>, LokiDbFile<IResourceItem>]
  >([readJsonSync(pathA), readJsonSync(pathB)]);

  return mergeResourceList(fileA, fileB);
};
