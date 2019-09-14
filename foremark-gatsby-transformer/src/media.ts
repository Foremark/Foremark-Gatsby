import * as Gatsby from 'gatsby';
import * as path from 'path';
import {parseUrl} from 'query-string';
const {fluid} = require('gatsby-plugin-sharp');

import {Pattern, patternMatches} from 'foremark/dist/utils/pattern';
import {escapeXmlText} from 'foremark/dist/utils/dom';
import {TagNames} from 'foremark/dist/foremark';
import {ViewerConfig} from './config';

/**
 * Describes a media handler.
 */
export interface MediaHandler {
    /**
     * Describes the pattern of a media URL. This media handler will be used if
     * any of the specified patterns match a media URL.
     */
    patterns: ReadonlyArray<Pattern<unknown>> | null;

    /**
     * A function used to process a media element.
     */
    handler: (e: Element, ctx: MediaHandlerContext, options?: unknown) => void | PromiseLike<void>;

    /**
     * The options of the media handler. This will be passed to functions
     * specified by `handler` and `patterns`.
     */
    options?: unknown;

    /**
     * If there are multiple matching media handlers, the one with the highest
     * priority value will be chosen.
     */
    priority: number;
}

/**
 * The context data passed to a media handler. This is unique to the GatsbyJS
 * port of Foremark.
 */
export interface MediaHandlerContext {
    readonly foremarkFileNode: Gatsby.Node;
    readonly files: Gatsby.Node[];
    readonly reporter: Gatsby.Reporter;
    readonly cache: unknown;
}

/**
 * Defines built-in media handlers.
 */
export const BUILTIN_MEDIA_HANDLERS = {
    'image': {
        patterns: null,
        handler: (e: Element, ctx: MediaHandlerContext) => handleHtml5Media(e, ctx, 'img'),
        priority: 0,
    },
    'video': {
        patterns: [/\.(mp4|m4v|ogm|ogv|avi|pg|mov|wmv|webm)$/i],
        handler: (e: Element, ctx: MediaHandlerContext) => handleHtml5Media(e, ctx, 'video'),
        priority: 20,
    },
    'audio': {
        patterns: [/\.(mp3|ogg|oga|spx|wav|au|opus|m4a|wma)$/i],
        handler: (e: Element, ctx: MediaHandlerContext) => handleHtml5Media(e, ctx, 'audio'),
        priority: 10,
    },
};

export async function processMediaElement(e: Element, config: ViewerConfig, ctx: MediaHandlerContext): Promise<void> {
    const src = e.getAttribute('src');
    if (!src) {
        e.outerHTML = `<${TagNames.Error}>` +
            `<code>&lt;${TagNames.Media}&gt;</code>: missing <code>src</code>` +
        `</${TagNames.Error}>`;
        return;
    }

    try {
        let bestHandler: MediaHandler | null = null;

        for (const key in config.mediaHandlers) {
            const handler = config.mediaHandlers[key];
            if (
                handler && (
                    handler.patterns == null ||
                    handler.patterns.find(e => patternMatches(src, e, handler.options))
                ) &&
                handler.priority >
                    (bestHandler ? bestHandler.priority : Number.NEGATIVE_INFINITY)
            ) {
                bestHandler = handler;
            }
        }

        if (!bestHandler) {
            e.outerHTML = `<${TagNames.Error}>` +
                `<code>&lt;${TagNames.Media}&gt;</code>: no matching media handler ` +
                `for media URL <code>${escapeXmlText(src)}</code>` +
            `</${TagNames.Error}>`;
            return;
        }

        await bestHandler.handler(e, ctx, bestHandler.options);
    } catch (error) {
        e.outerHTML = `<${TagNames.Error}>` +
            `<code>&lt;${TagNames.Media}&gt;</code>: processing failed ` +
            `for media URL <code>${escapeXmlText(src)}</code>: ` +
            `<code>${escapeXmlText(String(error))}</code>: ` +
        `</${TagNames.Error}>`;
        return;
    }
}

async function handleHtml5Media(e: Element, ctx: MediaHandlerContext, type: 'video' | 'audio' | 'img') {
    const img = e.ownerDocument!.createElement(type);

    if (type !== 'img') {
        img.setAttribute('controls', 'controls');
    }

    let attrs = e.attributes;
    for (let i = 0, c = attrs.length; i < c; ++i) {
        img.setAttribute(attrs[i].name, attrs[i].value);
    }

    if (img.hasAttribute('src')) {
        const src = img.getAttribute('src')!;

        const linkedNode = resolveLocalNode(src, ctx);

        if (linkedNode) {
            if (type === 'img') {
                await handleLocalImage(img, ctx, linkedNode);
            } else {
                // TODO: Copy the linked file to the public path
                //       like `gatsby-remark-copy-linked-files`
                // TODO: Use the original file for SVG images. Reasons:
                //       1. `gatsby-plugin-sharp` rasterizes SVG images, increasing the processing
                //           cost on both ends.
                //       2. The rasterized PNG images don't display in some browsers, probably
                //          because they have the wrong `.svg` file extension.
                //       3. The image resolution is insufficient for printing.
            }
        }
    }

    e.parentElement!.insertBefore(img, e);
    e.parentElement!.removeChild(e);
}

function resolveLocalNode(src: string, ctx: MediaHandlerContext): Gatsby.Node | undefined {
    if (ctx.foremarkFileNode.internal.type !== 'File' ||
        typeof ctx.foremarkFileNode.absolutePath !== 'string'
    ) {
        return;
    }
    const nodePath = ctx.foremarkFileNode.absolutePath;

    // Ignore absolute URLs
    if (/^(?:[a-z0-9]+:|\/).*/.exec(src)) {
        return;
    }

    // Load a local file
    const url = parseUrl(src).url;
    const joined = path.posix.join(path.dirname(nodePath), url);

    // Find the linked node
    // FIXME: This linear search results in a quadratic site build time.
    return ctx.files.find(node => node.absolutePath === joined);
}

async function handleLocalImage(img: Element, ctx: MediaHandlerContext, linkedNode: Gatsby.Node): Promise<void> {
    // TODO: Choose image sizes smartly
    const fluidResult = await fluid({
        file: linkedNode,
        args: {},
        reporter: ctx.reporter,
        cache: ctx.cache,
    });

    if (!fluidResult) {
        return;
    }

    img.setAttribute('src', fluidResult.src);
    img.setAttribute('srcset', fluidResult.srcSet);
    img.setAttribute('sizes', fluidResult.sizes);
    if (typeof linkedNode.title === 'string' && !img.hasAttribute('title')) {
        img.setAttribute('title', linkedNode.title);
    }
}
