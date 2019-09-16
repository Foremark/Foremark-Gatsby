// Gatsby plugin API
import * as Gatsby from 'gatsby';
import {convertForemarkForStaticView, StaticForemark, Context} from './compile';

export async function onCreateNode(
    {
        node,
        loadNodeContent,
        actions,
        createNodeId,
        reporter,
        createContentDigest,
    }: Gatsby.CreateNodeArgs,
    options: Gatsby.PluginOptions,
): Promise<any> {
    const {createNode, createParentChildLink} = actions;

    if (node.internal.mediaType !== 'application/xhtml+xml' ||
        typeof node.name !== 'string' ||
        !node.name.match(/\.(?:mf|fm)$/i)
    ) {
        return;
    }

    const content: string = await loadNodeContent(node);

    const foremarkNode: Gatsby.Node = {
        id: createNodeId(`${node.id} >> Foremark`),
        children: [],
        parent: node.id,
        internal: {
            content: content,
            contentDigest: node.internal.contentDigest,
            owner: void 0 as any,
            type: 'Foremark',
        },
        fileAbsolutePath: void 0,
    };

    if (node.internal.type === 'File') {
        foremarkNode.fileAbsolutePath = node.absolutePath;
        foremarkNode.fileRelativePath = node.relativePath;
        foremarkNode.fileRelativePathWithoutExtension =
            stripExtension(String(node.relativePath));
    }

    createNode(foremarkNode);
    createParentChildLink({parent: node, child: foremarkNode});

    return foremarkNode;
}

function stripExtension(x: string): string {
    return x.match(/^(.*?)(?:(?:\.mf|\.fm)\.xhtml)?$/i)![1];
}

export async function createSchemaCustomization(
    {actions}: Gatsby.CreateSchemaCustomizationArgs,
    pluginOoptions: Gatsby.PluginOptions,
): Promise<void> {
    const {createTypes} = actions;
    createTypes(`
        type Foremark implements Node @infer @childOf(mimeTypes: "application/xhtml+xml") {
            id: ID!
        }
    `);
}


export async function setFieldsOnGraphQLNodeType(
    {
        type,
        cache,
        basePath,
        getNodesByType,
        getNode,
        reporter,
        pathPrefix,
    }: Gatsby.SetFieldsOnGraphQLNodeTypeArgs,
    options: Gatsby.PluginOptions,
): Promise<object> {
    if (type.name !== 'Foremark') {
        return {};
    }

    const mkCacheKey = (node: Gatsby.Node, type: string) =>
      `transformer-foremark-${type}-${node.internal.contentDigest}-${basePath}`

    const convertedCacheKey = (node: Gatsby.Node) => mkCacheKey(node, 'html');

    let fileNodes: Gatsby.Node[] | null = null;

    function getFileNodes() {
        if (process.env.NODE_ENV !== `production` || !fileNodes) {
            fileNodes = getNodesByType(`File`)
        }
        return fileNodes!;
    }

    async function getConverted(foremarkNode: Gatsby.Node): Promise<StaticForemark> {
        const convertedContent = await cache.get(convertedCacheKey(foremarkNode));
        if (convertedContent) {
            return convertedContent;
        } else {
            const content = foremarkNode.internal.content!;
            if (content == null) {
                throw new Error("content is null");
            }

            const ctx: Context = {
                files: getFileNodes(),
                foremarkFileNode: getNode(foremarkNode.parent),
                cache,
                reporter,
                pathPrefix,
            };

            const errors: string[] = [];
            const converted = await convertForemarkForStaticView(
                content,
                ctx,
                (error: string) => errors.push(error),
            );

            if (errors.length > 0) {
                const nodeName = ctx.foremarkFileNode.name ||  ctx.foremarkFileNode.id;
                reporter.warn(
                    `Foremark produced one or more errors while processing ` +
                    `the node "${nodeName}":`
                );
                for (const e of errors) {
                    reporter.warn(` - ${e}`);
                }
            }

            cache.set(convertedCacheKey(foremarkNode), converted);
            return converted;
        }
    }

    async function getHtml(foremarkNode: Gatsby.Node): Promise<string> {
        return (await getConverted(foremarkNode)).html;
    }

    async function getTitle(foremarkNode: Gatsby.Node): Promise<string> {
        return (await getConverted(foremarkNode)).title || '';
    }

    return {
        html: {
            type: 'String',
            resolve: getHtml,
        },
        title: {
            type: 'String',
            resolve: getTitle,
        },
    };
}