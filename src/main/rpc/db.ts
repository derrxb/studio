import Loki from 'lokijs';
import type { Collection, DynamicView } from 'lokijs';

import { join as joinPath } from 'path';
import { ensureDir } from 'fs-extra';

import {
  IAsset,
  IEpisode,
  IActPoint,
  IDataSlot,
  IResourceItem,
  IResourceFile,
  IResourceGroup,
  ISimpleRelease,
  IBundleRelease,
  ISeriesMetadata,
} from '@recative/definitions';

import type {
  ISetting,
  PostProcessedResourceItemForUpload,
} from '@recative/extension-sdk';

import { LokiWorkspaceLockSafeFsAdapter } from '../utils/LokiWorkspaceLockSafeFsAdapter';

export interface IMediaDatabase {
  path: string;
  resource: {
    $db: Loki;
    files: DynamicView<IResourceFile>;
    groups: DynamicView<IResourceGroup>;
    resources: Collection<IResourceFile | IResourceGroup>;
    postProcessed: Collection<PostProcessedResourceItemForUpload>;
  };
  cloud: {
    $db: Loki;
    dataSlots: Collection<IDataSlot>;
  };
  series: {
    $db: Loki;
    metadata: Collection<ISeriesMetadata>;
  };
  setting: {
    $db: Loki;
    setting: Collection<ISetting>;
  };
  episode: {
    $db: Loki;
    episodes: Collection<IEpisode>;
    assets: Collection<IAsset>;
  };
  actPoint: {
    $db: Loki;
    actPoints: Collection<IActPoint>;
  };
  release: {
    $db: Loki;
    mediaReleases: Collection<ISimpleRelease>;
    codeReleases: Collection<ISimpleRelease>;
    bundleReleases: Collection<IBundleRelease>;
  };
  additionalData: Record<string, unknown>;
}

export const getTable = (dbPath: string, jsonPath: string): Promise<Loki> => {
  const adapter = new LokiWorkspaceLockSafeFsAdapter();
  return new Promise((resolve) => {
    let db: Loki | null = null;

    const handleAutoload = () => resolve(db as unknown as Loki);

    db = new Loki(joinPath(dbPath, jsonPath), {
      adapter,
      autoload: true,
      autoloadCallback: handleAutoload,
      autosave: true,
      autosaveInterval: 500,
      autosaveCallback: () => {},
    });
  });
};

let currentDb: IMediaDatabase | null = null;

export const getDb = async (
  yamlPath: string | null = null,
  temporary = false,
  additionalData: Record<string, unknown> = {}
) => {
  const trueRootPath = temporary
    ? yamlPath
    : yamlPath || currentDb?.path || null;

  if (!trueRootPath) {
    throw new TypeError('Root path not defined, no previous path cached');
  }

  if (currentDb && currentDb.path === trueRootPath && !temporary) {
    return currentDb;
  }

  ensureDir(trueRootPath);

  const [
    resourceDb,
    cloudDb,
    actPointDb,
    episodeDb,
    releaseDb,
    seriesDb,
    settingDb,
  ] = await Promise.all([
    getTable(trueRootPath, 'resource.json'),
    getTable(trueRootPath, 'cloud.json'),
    getTable(trueRootPath, 'act-point.json'),
    getTable(trueRootPath, 'episode.json'),
    getTable(trueRootPath, 'release.json'),
    getTable(trueRootPath, 'series.json'),
    getTable(trueRootPath, 'setting.json'),
  ]);

  const resourceCollection = resourceDb.addCollection<IResourceItem>(
    'resources',
    {
      autoupdate: true,
      indices: ['id', 'label', 'type', 'resourceGroupId', 'importTime'],
    }
  );

  const postProcessedResourceCollection =
    resourceDb.addCollection<PostProcessedResourceItemForUpload>(
      'postProcessedResources',
      {
        autoupdate: true,
        indices: ['id', 'label', 'type', 'resourceGroupId', 'importTime'],
      }
    );

  const filesView = resourceCollection.addDynamicView('files');
  filesView.applyFind({
    type: { $eq: 'file' },
  });

  const groupsView = resourceCollection.addDynamicView('groups');
  filesView.applyFind({
    type: { $eq: 'group' },
  });

  const dataSlotCollection = cloudDb.addCollection<IDataSlot>('dataSlots', {
    autoupdate: true,
    indices: ['id', 'slug', 'notes', 'createTime', 'updateTime'],
  });

  const metadataCollection = seriesDb.addCollection<ISeriesMetadata>(
    'metadata',
    {
      autoupdate: true,
    }
  );

  const actPointCollection = actPointDb.addCollection<IActPoint>('actPoints', {
    autoupdate: true,
    indices: ['id', 'label', 'firstLevelPath', 'secondLevelPath', 'fullPath'],
  });

  const assetsTable = episodeDb.addCollection<IAsset>('assets', {
    autoupdate: true,
    indices: [
      'id',
      'order',
      'episodeId',
      'contentId',
      'notes',
      'createTime',
      'updateTime',
    ],
  });

  const episodesTable = episodeDb.addCollection<IEpisode>('episodes', {
    autoupdate: true,
    indices: ['id', 'label', 'order', 'largeCoverResourceId', 'createTime'],
  });

  const mediaReleasesCollection = releaseDb.addCollection<ISimpleRelease>(
    'media',
    {
      autoupdate: true,
      indices: ['id', 'committer', 'commitTime', 'notes'],
    }
  );

  const codeReleasesCollection = releaseDb.addCollection<ISimpleRelease>(
    'code',
    {
      autoupdate: true,
      indices: ['id', 'committer', 'commitTime', 'notes'],
    }
  );

  const bundleReleasesCollection = releaseDb.addCollection<IBundleRelease>(
    'bundle',
    {
      autoupdate: true,
      indices: [
        'id',
        'codeBuildId',
        'mediaBuildId',
        'committer',
        'commitTime',
        'notes',
      ],
    }
  );

  const settingCollection = releaseDb.addCollection<ISetting>('setting', {
    autoupdate: true,
    indices: ['key', 'value'],
  });

  const newDb = {
    path: trueRootPath,
    resource: {
      $db: resourceDb,
      files: filesView as DynamicView<IResourceFile>,
      groups: groupsView as DynamicView<IResourceGroup>,
      resources: resourceCollection,
      postProcessed: postProcessedResourceCollection,
    },
    cloud: {
      $db: cloudDb,
      dataSlots: dataSlotCollection,
    },
    series: {
      $db: seriesDb,
      metadata: metadataCollection,
    },
    episode: {
      $db: episodeDb,
      episodes: episodesTable,
      assets: assetsTable,
    },
    actPoint: {
      $db: actPointDb,
      actPoints: actPointCollection,
    },
    release: {
      $db: releaseDb,
      mediaReleases: mediaReleasesCollection,
      codeReleases: codeReleasesCollection,
      bundleReleases: bundleReleasesCollection,
    },
    setting: {
      $db: settingDb,
      setting: settingCollection,
    },
    additionalData,
  };

  if (!temporary) {
    currentDb = newDb;
  }

  // newDb.resource.resources.find({ type: 'file' }).forEach((file) => {
  //   if ('extensionConfigurations' in file) {
  //     delete file.url['@recative/redirect'];
  //   }

  //   newDb.resource.resources.update(file);
  //   console.log(file.id);
  // });

  newDb.resource.resources
    .find({
      tags: { $contains: 'custom:frame-sequence-pointer!' },
    })
    .forEach((resource) => {
      if (resource.type !== 'file') {
        return;
      }

      const managedFiles = newDb.resource.resources.find({
        managedBy: resource.id,
      });

      const parseResult = managedFiles.map((x) => {
        const regex = /.*?(\d+)\D*$/;
        const extractedNumber = regex.exec(x.label)?.[1];

        return {
          id: Number.parseInt(extractedNumber ?? '', 10),
          file: x,
        };
export const saveAllDatabase = (db: IMediaDatabase) => {
  const waitFor = Object.entries(db)
    .filter(([, value]) => Object.hasOwn(value, '$db'))
    .map(([key]) => key) as Array<keyof IMediaDatabase>;

  console.log(':: Waiting for:', waitFor.length);
  return Promise.all(
    waitFor.map((key) => {
      const collection = db[key] as { $db: Loki };

      return new Promise<void>((resolve, reject) => {
        collection.$db.saveDatabase((err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });

      const sortedFiles = parseResult.some((x) => Number.isNaN(x.id))
        ? managedFiles.sort((x, y) => x.label.localeCompare(y.label))
        : parseResult.sort((x, y) => x.id - y.id).map((x) => x.file);

      delete resource.extensionConfigurations[
        '@recative/extension-rs-atlas/AtlasResourceProcessor/frames'
      ];

      resource.extensionConfigurations[
        '@recative/extension-rs-atlas/AtlasResourceProcessor~~frames'
      ] = sortedFiles.map((x) => x.id).join(',');

      newDb.resource.resources.update(resource);

      console.log(
        'Updated frame sequence resource type',
        sortedFiles.map((x) => x!.label).join(',')
      );
    });

  newDb.resource.resources.find({ type: 'file' }).forEach((data) => {
    // if (
    //   data.type === 'file' &&
    //   data.url['@recative/uploader-extension-s3-oss/S3Uploader']
    // ) {
    //   console.log('cleaning', data.id);
    //   delete data.url['@recative/uploader-extension-s3-oss/S3Uploader'];
    //   newDb.resource.resources.update(data);
    // }

    if (data.type === 'file' && !data.extensionConfigurations) {
      console.log('migrated', data.id, data.extensionConfigurations);
      data.extensionConfigurations = {};
      newDb.resource.resources.update(data);
    }
  });

  return newDb;
};

export const setupDb = async (yamlPath: string) => {
  console.log(`:: Setting up db: ${yamlPath}`);
  await getDb(yamlPath);
};
