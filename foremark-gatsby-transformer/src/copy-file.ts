// This module is mostly based on `gatsby-remark-copy-linked-files`. (I think
// an API for getting public URLs of file nodes should be provided as
// an official plugin!)
//
// This module provides a function `getPublicPath`. Given a file node, this
// function returns a public URL for retrieving the file.
import * as Gatsby from 'gatsby';
import * as path from 'path';
import * as fs from 'fs';

const DEPLOY_DIR = `public`;

const invalidDestinationDirMessage = (dir: any) =>
  `[foremark-gatsby-transformer You have supplied an invalid destination directory. The destination directory must be a child but was: ${dir}`;

// dest must be a child
const destinationIsValid = (dest: string) => !path.relative(`./`, dest).startsWith(`..`);

type DestDir = string | undefined | ((opts?: {name?: string, hash?: string}) => string);

export type Options = {
    destinationDir?: DestDir;
};

function validateDestinationDir(dir: DestDir): boolean {
  if (typeof dir === `undefined`) {
    return true;
  } else if (typeof dir === `string`) {
    // need to pass dummy data for validation to work
    return destinationIsValid(`${dir}/h/n`);
  } else if (dir instanceof Function) {
    // need to pass dummy data for validation to work
    return destinationIsValid(`${dir({ name: `n`, hash: `h` })}`);
  } else {
    return false;
  }
}

function defaultDestination(linkNode: Gatsby.Node): string {
  return `${linkNode.internal.contentDigest}/${linkNode.name}.${linkNode.extension}`;
}

function getDestination(linkNode: Gatsby.Node, dir: DestDir): string {
  if (dir instanceof Function) {
    // need to pass dummy data for validation to work
    const isValidFunction = `${dir({ name: `n`, hash: `h` })}` !== `${dir({})}`
    return isValidFunction
      ? `${dir({
          name: linkNode.name as any,
          hash: linkNode.internal.contentDigest,
        })}.${linkNode.extension}`
      : `${dir()}/${defaultDestination(linkNode)}`
  } else if (typeof dir === 'string') {
    return `${dir}/${defaultDestination(linkNode)}`
  } else {
    return defaultDestination(linkNode)
  }
}

function newPath(linkNode: Gatsby.Node, options: Options): string {
  const { destinationDir } = options
  const destination = getDestination(linkNode, destinationDir)
  const paths = [process.cwd(), DEPLOY_DIR, destination]
  return path.posix.join(...paths)
}

function newLinkURL(linkNode: Gatsby.Node, options: Options, pathPrefix: string): string {
  const { destinationDir } = options
  const destination = getDestination(linkNode, destinationDir)
  const linkPaths = [`/`, pathPrefix, destination].filter(lpath =>
    lpath ? true : false
  )
  return path.posix.join(...linkPaths)
}

/** Validate `options` and throw an exception if there's an error. */
export function throwIfOptionsIsInvalid(options: Options): void {
    if (!validateDestinationDir(options.destinationDir)) {
        throw new Error(invalidDestinationDirMessage(options.destinationDir));
    }
}

/** Given a file node, get a public URL for downloading it. */
export async function getPublicPath(linkNode: Gatsby.Node, options: Options, pathPrefix: string): Promise<string | null> {
    const linkPath = linkNode.absolutePath;
    if (linkNode.internal.type !== 'File' || typeof linkPath !== 'string') {
        return null;
    }

    // Get the copy destination
    const newFilePath = newPath(linkNode, options);
    const publicPath = newLinkURL(linkNode, options, pathPrefix);

    // Prevent uneeded copying
    if (linkPath !== newFilePath && !await fileExists(newFilePath)) {
        const dirname = path.posix.dirname(newFilePath);
        await fs.promises.mkdir(dirname, {recursive: true});
        await fs.promises.copyFile(linkPath, newFilePath);
    }

    return publicPath;
}

async function fileExists(path: string): Promise<boolean> {
    try {
        return (await fs.promises.stat(path)).isFile();
    } catch {
        return false;
    }
}
