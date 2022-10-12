import proto from 'protobufjs';
import StreamZip from 'node-stream-zip';

import { h32 } from 'xxhashjs';
import { join } from 'path';
import { fileSync } from 'tmp';
import { createHash } from 'crypto';
import { ensureDirSync, remove } from 'fs-extra';
import { readFile, writeFile } from 'fs/promises';

import {
  Zip,
  ffmpeg,
  ffprobe,
  waveform,
  screenshot,
  getFilePath,
  getFileBuffer,
  imageThumbnail,
} from '@recative/extension-sdk';
import type {
  TOOLS,
  Bundler,
  Uploader,
  IBundleProfile,
  ResourceProcessor,
  IBundlerExtensionDependency,
  IResourceExtensionDependency,
  PostProcessedResourceItemForUpload,
  PostProcessedResourceItemForImport,
} from '@recative/extension-sdk';
import type { TerminalMessageLevel } from '@recative/studio-definitions';

import { Category, IResourceFile } from '@recative/definitions';

import { getDb } from '../rpc/db';
import { cloneDeep } from './cloneDeep';
import { extensions } from '../extensions';
import { cleanupLoki } from '../rpc/query/utils';
import { getBuildPath } from '../rpc/query/setting';
import { getWorkspace } from '../rpc/workspace';
import { logToTerminal } from '../rpc/query/terminal';
import { getVersionName } from '../rpc/query/utils/getVersionName';
import { importedFileToFile } from '../rpc/query/utils/importedFileToFile';
import { STUDIO_BINARY_PATH } from '../constant/appPath';
import { HOME_DIR, ANDROID_BUILD_TOOLS_PATH } from '../constant/configPath';

import { getExtensionConfig } from './getExtensionConfig';
import { getResourceFilePath } from './getResourceFile';
import { promisifySpawn, SpawnFailedError } from './promiseifySpawn';

const resourceProcessorDependencies: IResourceExtensionDependency = {
  getResourceFilePath,
  writeBufferToResource: async (buffer: Buffer, fileName: string) => {
    const workspace = getWorkspace();
    const filePath = join(workspace.mediaPath, fileName);
    await writeFile(filePath, buffer);
    return filePath;
  },
  writeBufferToPostprocessCache: async (buffer: Buffer, fileName: string) => {
    const workspace = getWorkspace();
    const postProcessedPath = join(workspace.mediaPath, 'post-processed');
    ensureDirSync(postProcessedPath);
    const filePath = join(postProcessedPath, fileName);
    await writeFile(filePath, buffer);
    return filePath;
  },
  writeBufferToTemporaryFile: async (buffer: Buffer) => {
    const file = fileSync();
    await writeFile(file.name, buffer);

    return file.name;
  },
  updateResourceDefinition: async (
    resource:
      | IResourceFile
      | PostProcessedResourceItemForUpload
      | PostProcessedResourceItemForImport
  ) => {
    const db = await getDb();

    const resourceId = resource.id;

    const resourceDefinition = db.resource.resources.findOne({
      id: resourceId,
    });

    if (!resourceDefinition) {
      throw new Error(`Resource ${resourceId} not found`);
    }

    Object.keys(cleanupLoki(resourceDefinition)).forEach((x) => {
      if (x === 'fileName') return;
      if (x === 'postProcessRecord') return;

      if (x in resource) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (resourceDefinition as any)[x] = (resource as any)[x];
      }
    });

    db.resource.resources.update(resourceDefinition);
  },
  insertPostProcessedFileDefinition: async (
    resource:
      | PostProcessedResourceItemForUpload
      | PostProcessedResourceItemForImport,
    eraseMediaBuildId: number | null = null
  ) => {
    const db = await getDb();

    const resourceId = resource.id;

    const resourceDefinition = db.resource.resources.findOne({
      id: resourceId,
    });

    if (resourceDefinition) {
      throw new Error(`Resource ${resourceId} already existed`);
    }

    const clonedResource = cloneDeep(resource);
    if ('postProcessRecord' in clonedResource) {
      clonedResource.postProcessRecord.mediaBundleId =
        clonedResource.postProcessRecord.mediaBundleId.filter(
          (x) => x !== eraseMediaBuildId
        );

      // Here're two extra cleanup to prevent some extension blow up the database.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (clonedResource as any).postProcessedThumbnail;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (clonedResource as any).postProcessedFile;

      db.resource.postProcessed.insert(clonedResource);
    } else if ('postProcessedThumbnail' in clonedResource) {
      db.resource.resources.insert(await importedFileToFile(clonedResource));
    } else {
      db.resource.resources.insert(clonedResource);
    }
  },
  updatePostProcessedFileDefinition: async (
    resource:
      | PostProcessedResourceItemForUpload
      | PostProcessedResourceItemForImport
  ) => {
    const db = await getDb();

    const resourceId = resource.id;

    const resourceDefinition = db.resource.postProcessed.findOne({
      id: resourceId,
    });

    if (!resourceDefinition) {
      throw new Error(`Resource ${resourceId} not found`);
    }

    Object.keys(cleanupLoki(resourceDefinition)).forEach((x) => {
      if (x in resource) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (resourceDefinition as any)[x] = (resource as any)[x];
      }
    });

    db.resource.postProcessed.update(resourceDefinition);
  },
  readPathAsBuffer: (path: string) => readFile(path) as Promise<Buffer>,
  // This will be replaced later
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  logToTerminal: logToTerminal as any,
  createTemporaryZip: () => new Zip(fileSync().name),
  md5Hash: (x: Buffer) => {
    return createHash('md5').update(x).digest('hex');
  },
  xxHash: (x: Buffer) => h32(x, 0x1bf52).toString(16),
  ffmpeg,
  ffprobe,
  waveform,
  screenshot,
  getFilePath,
  getFileBuffer,
  imageThumbnail,
};

/**
 * Initialize all necessary resource processor instances.
 * @returns A map of uploader instances.
 */
export const getResourceProcessorInstances = async (terminalId: string) => {
  const projectResourceProcessor: Record<
    string,
    ResourceProcessor<string>
  > = {};
  extensions.forEach((extension) => {
    const extensionResourceProcessor = extension.resourceProcessor;

    extensionResourceProcessor?.forEach((ResourceProcessorClass) => {
      projectResourceProcessor[ResourceProcessorClass.id] =
        // @ts-ignore
        new ResourceProcessorClass({}, { ...resourceProcessorDependencies });

      projectResourceProcessor[
        ResourceProcessorClass.id
      ].dependency.logToTerminal = (
        message: string | [string, string],
        logLevel?: TerminalMessageLevel
      ) => {
        logToTerminal(terminalId, message, logLevel);
      };
    });
  });

  return projectResourceProcessor;
};

/**
 * Initialize all necessary uploader instances.
 * @param categories Categories of resources.
 * @returns A map of uploader instances.
 */
export const getUploaderInstances = async (categories: Category[]) => {
  const db = await getDb();

  const extensionConfig = await getExtensionConfig();
  const projectUploader: Record<
    string,
    { uploader: Uploader<string>; fileCategory: string[] }
  > = {};

  const settings = db.setting.setting.find();

  extensions.forEach((extension) => {
    const extensionUploader = extension.uploader;

    extensionUploader?.forEach((UploaderClass) => {
      if (!(UploaderClass.id in extensionConfig)) return;

      for (let i = 0; i < UploaderClass.acceptedFileCategory.length; i += 1) {
        const category = UploaderClass.acceptedFileCategory[i];

        if (!categories.includes(category)) continue;

        const categoryValue = settings.find(
          (setting) => setting.key === `${UploaderClass.id}~~##${category}`
        )?.value;

        if (categoryValue !== 'yes') continue;

        projectUploader[UploaderClass.id] = {
          // @ts-ignore
          uploader: new UploaderClass(extensionConfig[UploaderClass.id]),
          fileCategory: UploaderClass.acceptedFileCategory,
        };

        break;
      }
    });
  });

  return projectUploader;
};

const bundlerDependencies: IBundlerExtensionDependency = {
  /** We replace these later */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  executeExternalTool: null as any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prepareOutputFile: null as any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getOutputFilePath: null as any,
  getBuildInProtoDefinition: (fileName: string) => {
    const protoPath = join(STUDIO_BINARY_PATH, fileName);

    return proto.load(protoPath);
  },
  /** We replace it later */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  logToTerminal: null as any,
  readBundleTemplate: async (profile: IBundleProfile) => {
    const workspace = getWorkspace();

    return new StreamZip.async({
      file: join(workspace.assetsPath, profile.shellTemplateFileName),
    });
  },
  readZipFile: (path: string) => {
    return new StreamZip.async({
      file: path,
    });
  },
  getTemporaryFile: () => {
    return fileSync().name;
  },
  getVersionName: (bundleReleaseId: number, profile: IBundleProfile) => {
    return getVersionName(
      bundleReleaseId,
      profile.webRootTemplateFileName,
      profile.shellTemplateFileName
    );
  },
  getAssetFilePath: (path: string) => {
    const workspace = getWorkspace();

    return join(workspace.assetsPath, path);
  },
  getLocalConfigFilePath: (path: string) => {
    return join(HOME_DIR, path);
  },
  ffmpeg,
  ffprobe,
  waveform,
  screenshot,
  imageThumbnail,
};

export const getBundlerInstances = async (terminalId: string) => {
  const bundlers: Record<string, Bundler<string>> = {};

  extensions.forEach((extension) => {
    const extensionBundler = extension.bundler;

    extensionBundler?.forEach((BundlerClass) => {
      const bundler: Bundler<string> =
        // @ts-ignore
        new BundlerClass({}, { ...bundlerDependencies });

      bundler.dependency.executeExternalTool = async (
        toolId: typeof TOOLS[number],
        parameters: string[],
        executeInBuildPath: boolean
      ) => {
        const buildPath = await getBuildPath();
        const isJavaTool = ['bundletool', 'apksigner'].includes(toolId);
        const isBuildInTool = ['apktool', 'bundletool', 'jarsigner'].includes(
          toolId
        );
        const isMultiPlatformBinary = ['jarsigner'].includes(toolId);
        const isAndroidExternalTool = ['zipalign', 'aapt2'].includes(toolId);
        const isAndroidExternalLibTool = ['apksigner'].includes(toolId);

        if (
          (isAndroidExternalTool || isAndroidExternalLibTool) &&
          !ANDROID_BUILD_TOOLS_PATH
        ) {
          throw new SpawnFailedError(
            `Android build tools path is not set. Please set ANDROID_BUILD_TOOLS_PATH environment variable.`,
            parameters,
            -1
          );
        }

        let path = STUDIO_BINARY_PATH;

        if (isAndroidExternalTool) {
          path = ANDROID_BUILD_TOOLS_PATH ?? '';
        }

        if (isBuildInTool) {
          path = STUDIO_BINARY_PATH;
        }

        if (isAndroidExternalLibTool) {
          path = join(ANDROID_BUILD_TOOLS_PATH ?? '', 'lib');
        }

        const internalParameters: string[] = [];
        const commandSuffix = isMultiPlatformBinary
          ? `-${process.platform}-${process.arch}`
          : '';
        const executable = isJavaTool
          ? 'java'
          : join(path, `${toolId}${commandSuffix}`);

        if (isJavaTool) {
          internalParameters.push('-jar');
          internalParameters.push(join(path, `${toolId}.jar`));
        }

        await promisifySpawn(
          executable,
          [...internalParameters, ...parameters],
          executeInBuildPath ? { cwd: buildPath } : undefined,
          terminalId
        );

        return executable;
      };

      bundler.dependency.logToTerminal = (
        message: string | [string, string],
        logLevel?: TerminalMessageLevel
      ) => {
        logToTerminal(terminalId, message, logLevel);
      };

      bundler.dependency.getOutputFilePath = async (
        suffix,
        bundleReleaseId,
        profile
      ) => {
        const buildPath = await getBuildPath();

        const outputFileName = `${Reflect.get(
          bundler.constructor,
          'outputPrefix'
        )}-${profile.prefix}-${bundleReleaseId.toString().padStart(4, '0')}${
          suffix ? `-${suffix}` : ''
        }.${Reflect.get(bundler.constructor, 'outputExtensionName')}`;

        const outputPath = join(buildPath, outputFileName);

        return outputPath;
      };
      bundler.dependency.prepareOutputFile = async (
        suffix,
        bundleReleaseId,
        profile
      ) => {
        const buildPath = await getBuildPath();

        const outputFileName = await bundlers[
          BundlerClass.id
        ].dependency.getOutputFilePath(suffix, bundleReleaseId, profile);

        await remove(join(buildPath, outputFileName));

        return join(buildPath, outputFileName);
      };

      bundlers[BundlerClass.id] = bundler;
    });
  });

  return bundlers;
};
